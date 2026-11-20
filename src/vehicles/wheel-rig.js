import * as THREE from 'three';

/**
 * Re-parent an imported wheel under an identity-oriented pivot at the actual
 * geometric center of its GLB mesh. Object3D.attach preserves the complete
 * world transform, including baked node rotations and scales.
 *
 * The District 14 vehicle assets use the vehicle-local X axis as the wheel axle.
 * Keeping the pivot identity-oriented means its X rotation is a pure wheel spin.
 */
export function attachWheelPivot(root, wheelNode, radius) {
  if (!root?.isObject3D || !wheelNode?.isObject3D ||
      !Number.isFinite(radius) || radius <= 0) return null;

  root.updateWorldMatrix(true, true);
  wheelNode.updateWorldMatrix(true, false);

  const bounds = new THREE.Box3().setFromObject(wheelNode);
  if (bounds.isEmpty()) return null;

  const worldCenter = bounds.getCenter(new THREE.Vector3());
  const localCenter = root.worldToLocal(worldCenter.clone());

  const pivot = new THREE.Group();
  pivot.name = `${wheelNode.name || 'wheel'}-spin-pivot`;
  pivot.position.copy(localCenter);
  root.add(pivot);

  root.updateWorldMatrix(true, true);
  pivot.updateWorldMatrix(true, false);
  pivot.attach(wheelNode);

  return { pivot, radius, axle: 'x' };
}

/** Rotate around the identity pivot's local X axle without changing GLB rest pose. */
export function spinWheel(wheel, radians) {
  if (!wheel?.pivot?.isObject3D || !Number.isFinite(radians)) return false;
  wheel.pivot.rotateX(radians);
  return true;
}

/**
 * Extract disconnected tyre/rim islands from a single merged GLB mesh.
 * The supplied Van and Bus models contain their original wheels in one indexed
 * primitive; the components are separate in the triangle graph even though
 * GLTF exposes only one scene node. This preserves the actual source geometry.
 */
export function extractMergedWheelComponents(root, mesh) {
  if (!root?.isObject3D || !mesh?.isMesh || !mesh.geometry?.index || !mesh.parent) return [];

  const source = mesh.geometry.clone();
  const position = source.getAttribute('position');
  const index = source.index?.array;
  if (!position || !index || index.length < 12 || index.length % 3 !== 0) {
    source.dispose();
    return [];
  }

  source.computeBoundingBox();
  const modelBounds = source.boundingBox;
  const modelSize = modelBounds.getSize(new THREE.Vector3());
  const modelHeight = modelSize.y;
  const halfWidth = modelSize.x * 0.5;
  const halfLength = modelSize.z * 0.5;
  if (modelHeight <= 1e-5 || halfWidth <= 1e-5 || halfLength <= 1e-5) {
    source.dispose();
    return [];
  }

  const vertexCount = position.count;
  const parent = new Uint32Array(vertexCount);
  const rank = new Uint8Array(vertexCount);
  for (let i = 0; i < vertexCount; i += 1) parent[i] = i;

  const find = (value) => {
    let current = value;
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]];
      current = parent[current];
    }
    return current;
  };
  const union = (left, right) => {
    let a = find(left);
    let b = find(right);
    if (a === b) return;
    if (rank[a] < rank[b]) [a, b] = [b, a];
    parent[b] = a;
    if (rank[a] === rank[b]) rank[a] += 1;
  };

  for (let i = 0; i < index.length; i += 3) {
    union(index[i], index[i + 1]);
    union(index[i + 1], index[i + 2]);
  }

  const components = new Map();
  const triangleRoots = new Uint32Array(index.length / 3);
  for (let triangle = 0; triangle < index.length; triangle += 3) {
    const a = index[triangle];
    const b = index[triangle + 1];
    const c = index[triangle + 2];
    const componentId = find(a);
    triangleRoots[triangle / 3] = componentId;

    let component = components.get(componentId);
    if (!component) {
      component = {
        indices: [],
        min: [Infinity, Infinity, Infinity],
        max: [-Infinity, -Infinity, -Infinity],
        vertexIds: new Set()
      };
      components.set(componentId, component);
    }
    component.indices.push(a, b, c);

    for (const vertexId of [a, b, c]) {
      if (component.vertexIds.has(vertexId)) continue;
      component.vertexIds.add(vertexId);
      const values = [position.getX(vertexId), position.getY(vertexId), position.getZ(vertexId)];
      for (let axis = 0; axis < 3; axis += 1) {
        if (values[axis] < component.min[axis]) component.min[axis] = values[axis];
        if (values[axis] > component.max[axis]) component.max[axis] = values[axis];
      }
    }
  }

  const wheelParts = new Map();
  for (const [componentId, component] of components) {
    const sizeX = component.max[0] - component.min[0];
    const sizeY = component.max[1] - component.min[1];
    const sizeZ = component.max[2] - component.min[2];
    const radial = Math.max(sizeY, sizeZ);
    if (radial <= 1e-5) continue;

    const circularity = Math.abs(sizeY - sizeZ) / radial;
    const axleRatio = sizeX / radial;
    const centerX = (component.min[0] + component.max[0]) * 0.5;
    const centerY = (component.min[1] + component.max[1]) * 0.5;
    const centerZ = (component.min[2] + component.max[2]) * 0.5;

    const isWheelPart =
      radial >= modelHeight * 0.05 &&
      radial <= modelHeight * 0.55 &&
      circularity <= 0.25 &&
      axleRatio <= 0.55 &&
      centerY <= modelBounds.min.y + modelHeight * 0.4 &&
      Math.abs(centerX) >= halfWidth * 0.55 &&
      Math.abs(centerZ) >= halfLength * 0.25;

    if (!isWheelPart) continue;

    const quadrant = `${centerX >= 0 ? 1 : -1}:${centerZ >= 0 ? 1 : -1}`;
    let group = wheelParts.get(quadrant);
    if (!group) {
      group = {
        componentIds: new Set(),
        indices: [],
        min: [Infinity, Infinity, Infinity],
        max: [-Infinity, -Infinity, -Infinity]
      };
      wheelParts.set(quadrant, group);
    }
    group.componentIds.add(componentId);
    group.indices.push(...component.indices);
    for (let axis = 0; axis < 3; axis += 1) {
      group.min[axis] = Math.min(group.min[axis], component.min[axis]);
      group.max[axis] = Math.max(group.max[axis], component.max[axis]);
    }
  }

  // If the geometry is not unambiguously four wheel groups, leave it unchanged.
  if (wheelParts.size !== 4 || [...wheelParts.values()].some((group) => group.componentIds.size < 2)) {
    source.dispose();
    return [];
  }

  const selectedComponents = new Set();
  for (const group of wheelParts.values()) {
    for (const id of group.componentIds) selectedComponents.add(id);
  }

  const bodyIndices = [];
  for (let triangle = 0; triangle < triangleRoots.length; triangle += 1) {
    if (selectedComponents.has(triangleRoots[triangle])) continue;
    const offset = triangle * 3;
    bodyIndices.push(index[offset], index[offset + 1], index[offset + 2]);
  }
  if (bodyIndices.length < 3) {
    source.dispose();
    return [];
  }

  const bodyGeometry = source.clone();
  bodyGeometry.setIndex(new THREE.BufferAttribute(new Uint32Array(bodyIndices), 1));
  bodyGeometry.clearGroups();
  bodyGeometry.addGroup(0, bodyIndices.length, 0);
  bodyGeometry.computeBoundingSphere();

  const worldScale = mesh.getWorldScale(new THREE.Vector3());
  const wheels = [];
  const createdMeshes = [];

  for (const [quadrant, group] of wheelParts) {
    const componentBounds = new THREE.Box3(
      new THREE.Vector3(group.min[0], group.min[1], group.min[2]),
      new THREE.Vector3(group.max[0], group.max[1], group.max[2])
    );
    const componentSize = componentBounds.getSize(new THREE.Vector3());
    const radius = Math.max(
      componentSize.y * Math.abs(worldScale.y),
      componentSize.z * Math.abs(worldScale.z)
    ) * 0.5;
    if (!Number.isFinite(radius) || radius <= 0.06) continue;

    const wheelGeometry = source.clone();
    wheelGeometry.setIndex(new THREE.BufferAttribute(new Uint32Array(group.indices), 1));
    wheelGeometry.clearGroups();
    wheelGeometry.addGroup(0, group.indices.length, 0);
    wheelGeometry.boundingBox = componentBounds.clone();
    wheelGeometry.boundingSphere = componentBounds.getBoundingSphere(new THREE.Sphere());

    const wheelMesh = new THREE.Mesh(wheelGeometry, mesh.material);
    wheelMesh.name = `extracted-wheel-${quadrant.replace(':', '-')}`;
    wheelMesh.castShadow = mesh.castShadow;
    wheelMesh.receiveShadow = mesh.receiveShadow;
    wheelMesh.position.copy(mesh.position);
    wheelMesh.quaternion.copy(mesh.quaternion);
    wheelMesh.scale.copy(mesh.scale);
    wheelMesh.matrixAutoUpdate = mesh.matrixAutoUpdate;
    if (!mesh.matrixAutoUpdate) wheelMesh.matrix.copy(mesh.matrix);

    mesh.parent.add(wheelMesh);
    createdMeshes.push(wheelMesh);
    root.updateWorldMatrix(true, true);

    const wheel = attachWheelPivot(root, wheelMesh, radius);
    if (wheel) wheels.push(wheel);
  }

  if (wheels.length !== 4) {
    for (const wheel of wheels) wheel.pivot.parent?.remove(wheel.pivot);
    for (const wheelMesh of createdMeshes) wheelMesh.geometry.dispose();
    source.dispose();
    bodyGeometry.dispose();
    return [];
  }

  mesh.geometry = bodyGeometry;
  source.dispose();
  return wheels;
}
