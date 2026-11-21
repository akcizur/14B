import * as THREE from 'three';

const EPSILON = 1e-4;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function boxCorners(box) {
  const points = [];
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) points.push(new THREE.Vector3(x, y, z));
    }
  }
  return points;
}

function getBuildingFrame(buildingRoot) {
  buildingRoot.updateWorldMatrix(true, true);
  const origin = buildingRoot.getWorldPosition(new THREE.Vector3());
  const orientation = buildingRoot.getWorldQuaternion(new THREE.Quaternion());
  const rigid = new THREE.Matrix4().compose(origin, orientation, new THREE.Vector3(1, 1, 1));
  return { origin, orientation, inverseRigid: rigid.invert() };
}

function transformedMeshBounds(mesh, inverseRigid) {
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  const source = mesh.geometry.boundingBox;
  if (!source || source.isEmpty()) return null;
  const transform = new THREE.Matrix4().multiplyMatrices(inverseRigid, mesh.matrixWorld);
  const box = new THREE.Box3();
  for (const point of boxCorners(source)) box.expandByPoint(point.applyMatrix4(transform));
  return box.isEmpty() ? null : box;
}

function meshMaterialNames(mesh) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.map((material) => material?.name || '').filter(Boolean);
}

function matchingMaterialSlots(mesh, pattern) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  if (Array.isArray(mesh.material)) {
    return materials.map((material, materialIndex) => ({ material, materialIndex }))
      .filter(({ material }) => pattern.test(material?.name || ''));
  }
  const materialName = materials[0]?.name || '';
  return pattern.test(materialName) || pattern.test(mesh.name || '')
    ? [{ material: materials[0], materialIndex: null }]
    : [];
}

function materialGroupBounds(mesh, slot, inverseRigid) {
  if (slot.materialIndex === null) return transformedMeshBounds(mesh, inverseRigid);
  const result = new THREE.Box3();
  for (const vertices of getTriangleComponents(mesh.geometry, slot.materialIndex)) {
    result.union(localComponentBox(mesh, vertices, inverseRigid));
  }
  return result.isEmpty() ? null : result;
}

function measureBoundsFromMeshes(buildingRoot, predicate) {
  const { inverseRigid } = getBuildingFrame(buildingRoot);
  const bounds = new THREE.Box3();
  buildingRoot.traverse((object) => {
    if (!object.isMesh || !object.geometry || !predicate(object)) return;
    const box = transformedMeshBounds(object, inverseRigid);
    if (box) bounds.union(box);
  });
  return bounds.isEmpty() ? null : bounds;
}

/** Measures the full authored GLB envelope in the building-local metre frame. */
export function measureBuildingBounds(buildingRoot) {
  const bounds = measureBoundsFromMeshes(buildingRoot, () => true);
  if (!bounds) throw new Error('Building "' + buildingRoot.name + '" has no measurable mesh bounds.');
  return {
    minX: bounds.min.x, maxX: bounds.max.x,
    minY: bounds.min.y, maxY: bounds.max.y,
    minZ: bounds.min.z, maxZ: bounds.max.z
  };
}

/**
 * The dominant brick/wall body defines the usable structural footprint.
 * Roof trims, window frames and projecting decorative parts must not enlarge
 * the room plan or move the interior wall planes.
 */
export function measureStructuralBounds(buildingRoot) {
  const { inverseRigid } = getBuildingFrame(buildingRoot);
  const candidates = [];
  buildingRoot.traverse((object) => {
    if (!object.isMesh || !object.geometry) return;
    for (const slot of matchingMaterialSlots(object, /(brick|wall|facade|masonry)/i)) {
      const box = materialGroupBounds(object, slot, inverseRigid);
      if (!box) continue;
      const size = box.getSize(new THREE.Vector3());
      candidates.push({ box, score: size.x * size.y });
    }
  });
  if (!candidates.length) return measureBuildingBounds(buildingRoot);
  candidates.sort((a, b) => b.score - a.score);
  const box = candidates[0].box;
  return {
    minX: box.min.x, maxX: box.max.x,
    minY: box.min.y, maxY: box.max.y,
    minZ: box.min.z, maxZ: box.max.z
  };
}

/** Split an indexed GLB mesh into disconnected surface islands. */
function getTriangleComponents(geometry, materialIndex = null) {
  const position = geometry.getAttribute('position');
  const index = geometry.index?.array;
  const totalElements = index ? index.length : position.count;
  const ranges = materialIndex === null
    ? [{ start: 0, count: totalElements }]
    : geometry.groups.filter((group) => group.materialIndex === materialIndex);
  const components = [];

  for (const range of ranges) {
    const start = Math.max(0, Math.floor(range.start / 3));
    const faceCount = Math.floor(range.count / 3);
    const vertexFaces = new Map();
    const faceVertices = new Array(faceCount);

    for (let localFace = 0; localFace < faceCount; localFace += 1) {
      const cursor = range.start + localFace * 3;
      const ids = index
        ? [index[cursor], index[cursor + 1], index[cursor + 2]]
        : [cursor, cursor + 1, cursor + 2];
      faceVertices[localFace] = ids;
      for (const id of ids) {
        if (!vertexFaces.has(id)) vertexFaces.set(id, []);
        vertexFaces.get(id).push(localFace);
      }
    }

    const visited = new Uint8Array(faceCount);
    for (let face = 0; face < faceCount; face += 1) {
      if (visited[face]) continue;
      const stack = [face];
      const vertices = new Set();
      visited[face] = 1;
      while (stack.length) {
        const current = stack.pop();
        for (const id of faceVertices[current]) {
          vertices.add(id);
          for (const adjacent of vertexFaces.get(id) || []) {
            if (!visited[adjacent]) {
              visited[adjacent] = 1;
              stack.push(adjacent);
            }
          }
        }
      }
      components.push([...vertices]);
    }
  }
  return components;
}

function localComponentBox(mesh, vertexIds, inverseRigid) {
  const position = mesh.geometry.getAttribute('position');
  const transform = new THREE.Matrix4().multiplyMatrices(inverseRigid, mesh.matrixWorld);
  const box = new THREE.Box3();
  for (const id of vertexIds) {
    box.expandByPoint(new THREE.Vector3(
      position.getX(id), position.getY(id), position.getZ(id)
    ).applyMatrix4(transform));
  }
  return box;
}

function nearestFacadeSide(box, structure) {
  const center = box.getCenter(new THREE.Vector3());
  return [
    { side: 'front', distance: Math.abs(structure.maxZ - center.z), plane: structure.maxZ },
    { side: 'back', distance: Math.abs(center.z - structure.minZ), plane: structure.minZ },
    { side: 'left', distance: Math.abs(center.x - structure.minX), plane: structure.minX },
    { side: 'right', distance: Math.abs(structure.maxX - center.x), plane: structure.maxX }
  ].sort((a, b) => a.distance - b.distance)[0];
}

function materialMatches(mesh, pattern) {
  const labels = [mesh.name, ...meshMaterialNames(mesh)].join(' ');
  return pattern.test(labels);
}

/** Read the actual door mesh rather than inventing a centered doorway. */
export function measureFacadeDoors(buildingRoot, structure = measureStructuralBounds(buildingRoot)) {
  const { inverseRigid } = getBuildingFrame(buildingRoot);
  const candidates = [];
  buildingRoot.traverse((object) => {
    if (!object.isMesh || !object.geometry) return;
    for (const slot of matchingMaterialSlots(object, /door/i)) {
      const box = materialGroupBounds(object, slot, inverseRigid);
      if (!box) continue;
      const size = box.getSize(new THREE.Vector3());
      if (size.y < 0.45 || Math.max(size.x, size.z) < 0.2) continue;
      const facade = nearestFacadeSide(box, structure);
      if (facade.distance > 0.5) continue;
      candidates.push({ box, facade, area: size.x * size.y });
    }
  });
  candidates.sort((a, b) => b.area - a.area);
  return candidates.map(({ box, facade }) => {
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    return {
      side: facade.side,
      center: facade.side === 'front' || facade.side === 'back' ? center.x : center.z,
      sill: box.min.y - structure.minY,
      width: facade.side === 'front' || facade.side === 'back' ? size.x : size.z,
      height: size.y,
      plane: facade.plane,
      centerX: center.x,
      centerY: center.y,
      minX: box.min.x, maxX: box.max.x,
      minY: box.min.y, maxY: box.max.y,
      minZ: box.min.z, maxZ: box.max.z
    };
  });
}

/**
 * Measures independent glass islands in the GLB. Two stacked panes with the
 * same horizontal centre are merged into one physical window opening. Window
 * frames and roof trims are deliberately not treated as window dimensions.
 */
export function measureFacadeOpenings(buildingRoot, structure = measureStructuralBounds(buildingRoot), door = null) {
  const { inverseRigid } = getBuildingFrame(buildingRoot);
  const candidates = [];
  buildingRoot.traverse((object) => {
    if (!object.isMesh || !object.geometry) return;
    let slots = matchingMaterialSlots(object, /(window.?glass|glazing)/i);
    if (!slots.length && meshMaterialNames(object).length === 0 && /window/i.test(object.name || '')) {
      slots = [{ material: object.material, materialIndex: null }];
    }

    for (const slot of slots) {
      for (const vertexIds of getTriangleComponents(object.geometry, slot.materialIndex)) {
        const box = localComponentBox(object, vertexIds, inverseRigid);
        const size = box.getSize(new THREE.Vector3());
        if (size.y < 0.12 || Math.max(size.x, size.z) < 0.12) continue;
        const facade = nearestFacadeSide(box, structure);
        if (facade.distance > 0.42) continue;

        // Tiny panes mounted within the entrance leaf are not facade windows.
        if (door && box.min.x < door.maxX - 0.02 && box.max.x > door.minX + 0.02 &&
            box.min.y < door.maxY - 0.02 && box.max.y > door.minY + 0.02) continue;

        const center = box.getCenter(new THREE.Vector3());
        candidates.push({
          side: facade.side,
          centerAxis: facade.side === 'front' || facade.side === 'back' ? center.x : center.z,
          plane: facade.side === 'front' || facade.side === 'back' ? center.z : center.x,
          minU: facade.side === 'front' || facade.side === 'back' ? box.min.x : box.min.z,
          maxU: facade.side === 'front' || facade.side === 'back' ? box.max.x : box.max.z,
          minY: box.min.y,
          maxY: box.max.y
        });
      }
    }
  });

  candidates.sort((a, b) =>
    a.side.localeCompare(b.side) || a.centerAxis - b.centerAxis || a.minY - b.minY
  );
  const merged = [];
  for (const item of candidates) {
    const target = merged.find((candidate) => {
      const verticalGap = Math.max(0, item.minY - candidate.maxY, candidate.minY - item.maxY);
      return candidate.side === item.side &&
        Math.abs(candidate.centerAxis - item.centerAxis) < 0.045 &&
        Math.abs(candidate.plane - item.plane) < 0.085 &&
        Math.abs((candidate.maxU - candidate.minU) - (item.maxU - item.minU)) < 0.09 &&
        verticalGap < 0.11;
    });
    if (!target) {
      merged.push({ ...item });
      continue;
    }
    target.minU = Math.min(target.minU, item.minU);
    target.maxU = Math.max(target.maxU, item.maxU);
    target.minY = Math.min(target.minY, item.minY);
    target.maxY = Math.max(target.maxY, item.maxY);
    target.centerAxis = (target.minU + target.maxU) / 2;
    target.plane = (target.plane + item.plane) / 2;
  }

  return merged.map((item) => ({
    side: item.side,
    center: item.centerAxis,
    sill: item.minY - structure.minY,
    width: item.maxU - item.minU,
    height: item.maxY - item.minY,
    centerY: (item.minY + item.maxY) / 2 - structure.minY,
    plane: item.plane
  })).filter((item) => item.width >= 0.35 && item.height >= 0.35);
}

export function deriveInteriorPlan(bounds, architecture = {}, frontSide = 1, door = null) {
  const values = [bounds?.minX, bounds?.maxX, bounds?.minY, bounds?.maxY, bounds?.minZ, bounds?.maxZ];
  if (!values.every(Number.isFinite) ||
      bounds.maxX - bounds.minX < 3.8 ||
      bounds.maxZ - bounds.minZ < 3.8 ||
      bounds.maxY - bounds.minY < 5.8) {
    throw new Error('Building structural bounds are too small or invalid for an interior.');
  }
  if (![-1, 1].includes(frontSide)) throw new Error('Building frontSide must be -1 or 1.');

  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const height = bounds.maxY - bounds.minY;
  const wall = clamp(architecture.wallThickness ?? 0.18, 0.14, 0.28);
  const slab = clamp(architecture.slabThickness ?? 0.16, 0.12, 0.22);
  const floorLevels = Array.isArray(architecture.floorLevels)
    ? [...architecture.floorLevels]
    : Array.from({ length: clamp(Math.floor(architecture.storeys ?? 3), 2, 5) + 1 }, (_, i) =>
        i * Math.min(3.1, (height - slab) / clamp(Math.floor(architecture.storeys ?? 3), 2, 5))
      );
  if (floorLevels.length < 3 || Math.abs(floorLevels[0]) > 0.02 ||
      floorLevels.some((level, index) => !Number.isFinite(level) ||
        (index > 0 && level - floorLevels[index - 1] < 2.25))) {
    throw new Error('Building floorLevels must start at zero and increase by at least 2.25 metres.');
  }

  const baseY = bounds.minY + (door?.sill ?? architecture.doorSill ?? 0);
  const floorHeights = floorLevels.slice(1).map((level, index) => level - floorLevels[index]);
  const storeys = floorHeights.length;
  const topY = baseY + floorLevels[floorLevels.length - 1];
  if (topY > bounds.maxY - 0.08) {
    throw new Error('Interior top floor exceeds the measured structural shell.');
  }

  const inner = {
    minX: bounds.minX + wall,
    maxX: bounds.maxX - wall,
    minZ: bounds.minZ + wall,
    maxZ: bounds.maxZ - wall
  };
  const innerWidth = inner.maxX - inner.minX;
  const innerDepth = inner.maxZ - inner.minZ;
  const stairFlightWidth = clamp(architecture.stairFlightWidth ?? 0.98, 0.82, 1.02);
  const stairGap = 0.12;
  const stairWidth = stairFlightWidth * 2 + stairGap;
  if (stairWidth + 1.35 > innerWidth) {
    throw new Error('Building footprint cannot fit a two-flight stairwell and side rooms.');
  }

  const entryX = door?.center ?? architecture.doorCenter ?? (inner.minX + inner.maxX) / 2;
  const stairMinX = clamp(entryX - stairWidth / 2, inner.minX + 0.16, inner.maxX - stairWidth - 0.16);
  const stairMaxX = stairMinX + stairWidth;
  const stairRun = Math.min(2.35, innerDepth * 0.51);
  // Leave a full-height landing between the front door and the first tread.
  const stairFrontZ = frontSide > 0 ? inner.maxZ - 1.05 : inner.minZ + 1.05;
  const stairBackZ = frontSide > 0 ? stairFrontZ - stairRun : stairFrontZ + stairRun;
  const stairMinZ = Math.min(stairFrontZ, stairBackZ);
  const stairMaxZ = Math.max(stairFrontZ, stairBackZ);
  const landingDepth = Math.min(0.9, innerDepth - stairRun - 1.45);
  if (landingDepth < 0.68) throw new Error('Building depth cannot fit a safe stair landing.');

  const stairOpening = {
    minX: stairMinX - 0.08,
    maxX: stairMaxX + 0.08,
    minZ: frontSide > 0 ? stairMinZ - landingDepth : stairMinZ - 0.08,
    maxZ: frontSide > 0 ? stairMaxZ + 0.08 : stairMaxZ + landingDepth
  };
  const averageFloorHeight = floorHeights.reduce((sum, value) => sum + value, 0) / storeys;
  const doorWidth = door?.width ?? architecture.doorWidth ?? 1.0;
  const doorHeight = door?.height ?? architecture.doorHeight ?? 2.1;
  const walkBounds = {
    minX: inner.minX + 0.14, maxX: inner.maxX - 0.14,
    minZ: inner.minZ + 0.14, maxZ: inner.maxZ - 0.14
  };

  return {
    bounds: { ...bounds },
    baseY,
    topY,
    floorLevels,
    floorHeights,
    storeys,
    width,
    depth,
    height,
    wall,
    slab,
    floorHeight: averageFloorHeight,
    inner,
    innerWidth,
    innerDepth,
    stair: {
      minX: stairMinX, maxX: stairMaxX,
      minZ: Math.min(stairMinZ, stairMaxZ),
      maxZ: Math.max(stairMinZ, stairMaxZ),
      width: stairWidth,
      flightWidth: stairFlightWidth,
      gap: stairGap,
      treadCount: architecture.stairTreads ?? 10,
      treadDepth: stairRun / (architecture.stairTreads ?? 10),
      rise: floorHeights[0] / ((architecture.stairTreads ?? 10) * 2),
      landingDepth,
      opening: stairOpening,
      laneOneX: stairMinX + stairFlightWidth / 2,
      laneTwoX: stairMinX + stairFlightWidth + stairGap + stairFlightWidth / 2,
      frontSide
    },
    corridorWidth: 1.0,
    entryX,
    entryZ: frontSide > 0 ? inner.maxZ - 0.58 : inner.minZ + 0.58,
    doorWidth,
    doorHeight,
    walkBounds
  };
}

function findFloorLevel(plan, feetY) {
  const relative = feetY - plan.baseY;
  let level = 0;
  for (let index = 1; index < plan.floorLevels.length; index += 1) {
    if (relative >= plan.floorLevels[index] - 0.04) level = index;
  }
  return clamp(level, 0, plan.storeys - 1);
}

export function getInteriorWalkHeight(plan, x, z, currentFeetY = plan.baseY) {
  const { stair } = plan;
  const level = findFloorLevel(plan, currentFeetY);
  const floorBase = plan.baseY + plan.floorLevels[level];
  const floorHeight = plan.floorHeights[level];
  const run = stair.maxZ - stair.minZ;
  const inLaneOne = Math.abs(x - stair.laneOneX) <= stair.flightWidth / 2 - 0.04 &&
    z >= stair.minZ && z <= stair.maxZ;
  const inLaneTwo = Math.abs(x - stair.laneTwoX) <= stair.flightWidth / 2 - 0.04 &&
    z >= stair.minZ && z <= stair.maxZ;

  if (stair.frontSide > 0 && inLaneOne) {
    const t = clamp((stair.maxZ - z) / run, 0, 1);
    return floorBase + t * floorHeight * 0.5;
  }
  if (stair.frontSide > 0 && inLaneTwo) {
    const t = clamp((z - stair.minZ) / run, 0, 1);
    return floorBase + floorHeight * (0.5 + t * 0.5);
  }
  if (stair.frontSide < 0 && inLaneOne) {
    const t = clamp((z - stair.minZ) / run, 0, 1);
    return floorBase + t * floorHeight * 0.5;
  }
  if (stair.frontSide < 0 && inLaneTwo) {
    const t = clamp((stair.maxZ - z) / run, 0, 1);
    return floorBase + floorHeight * (0.5 + t * 0.5);
  }

  const onLanding = Math.abs(x - (stair.minX + stair.maxX) / 2) <= stair.width / 2 + 0.08 &&
    (stair.frontSide > 0
      ? z >= stair.minZ - stair.landingDepth && z < stair.minZ + 0.04
      : z > stair.maxZ - 0.04 && z <= stair.maxZ + stair.landingDepth);
  if (onLanding) return floorBase + floorHeight * 0.5;
  return floorBase;
}

export function isInteriorPositionWalkable(plan, x, z, currentFeetY = plan.baseY, radius = 0.3) {
  const bounds = plan.walkBounds;
  if (x < bounds.minX + radius || x > bounds.maxX - radius ||
      z < bounds.minZ + radius || z > bounds.maxZ - radius) return false;
  const level = findFloorLevel(plan, currentFeetY);
  if (level <= 0) return true;

  const opening = plan.stair.opening;
  const insideOpening = x >= opening.minX && x <= opening.maxX &&
    z >= opening.minZ && z <= opening.maxZ;
  if (!insideOpening) return true;

  const stair = plan.stair;
  const onFlight = (
    Math.abs(x - stair.laneOneX) <= stair.flightWidth / 2 - radius * 0.65 ||
    Math.abs(x - stair.laneTwoX) <= stair.flightWidth / 2 - radius * 0.65
  ) && z >= stair.minZ - 0.08 && z <= stair.maxZ + 0.08;
  const onLanding = Math.abs(x - (stair.minX + stair.maxX) / 2) <= stair.width / 2 &&
    (stair.frontSide > 0
      ? z >= stair.minZ - stair.landingDepth && z <= stair.minZ
      : z >= stair.maxZ && z <= stair.maxZ + stair.landingDepth);
  return onFlight || onLanding;
}

function addBox(parent, name, x, bottomY, z, sx, sy, sz, material, colliders = null) {
  if (sx <= EPSILON || sy <= EPSILON || sz <= EPSILON) return null;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  mesh.name = name;
  mesh.position.set(x, bottomY + sy / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  if (colliders) colliders.push(mesh);
  return mesh;
}

function addWallSection(parent, axis, name, coordinate, start, end, bottom, height, thickness, material, colliders) {
  if (end - start <= EPSILON || height <= EPSILON) return;
  const center = (start + end) / 2;
  if (axis === 'x') {
    addBox(parent, name, center, bottom, coordinate, end - start, height, thickness, material, colliders);
  } else {
    addBox(parent, name, coordinate, bottom, center, thickness, height, end - start, material, colliders);
  }
}

function addWindow(parent, axis, name, coordinate, center, width, bottom, height, thickness, glass, frame) {
  const frameSize = 0.055;
  const depth = Math.max(0.035, thickness * 0.24);
  if (axis === 'x') {
    addBox(parent, name + '-glass', center, bottom + 0.035, coordinate, width - 0.07,
      Math.max(0.2, height - 0.07), depth, glass);
    addBox(parent, name + '-frame-left', center - width / 2, bottom, coordinate,
      frameSize, height, thickness * 0.72, frame);
    addBox(parent, name + '-frame-right', center + width / 2, bottom, coordinate,
      frameSize, height, thickness * 0.72, frame);
    addBox(parent, name + '-frame-bottom', center, bottom, coordinate,
      width, frameSize, thickness * 0.72, frame);
    addBox(parent, name + '-frame-top', center, bottom + height - frameSize, coordinate,
      width, frameSize, thickness * 0.72, frame);
  } else {
    addBox(parent, name + '-glass', coordinate, bottom + 0.035, center, depth,
      Math.max(0.2, height - 0.07), width - 0.07, glass);
    addBox(parent, name + '-frame-left', coordinate, bottom, center - width / 2,
      thickness * 0.72, height, frameSize, frame);
    addBox(parent, name + '-frame-right', coordinate, bottom, center + width / 2,
      thickness * 0.72, height, frameSize, frame);
    addBox(parent, name + '-frame-bottom', coordinate, bottom, center,
      thickness * 0.72, frameSize, width, frame);
    addBox(parent, name + '-frame-top', coordinate, bottom + height - frameSize, center,
      thickness * 0.72, frameSize, width, frame);
  }
}

function buildWallWithOpenings(parent, options) {
  const { axis, name, coordinate, start, end, floorY, height, thickness, material, frame, glass, openings = [], colliders = null } = options;
  const sorted = openings.map((opening) => ({
    ...opening,
    start: clamp(opening.center - opening.width / 2, start, end),
    end: clamp(opening.center + opening.width / 2, start, end)
  })).filter((opening) => opening.end - opening.start > EPSILON)
    .sort((a, b) => a.start - b.start);
  let cursor = start;
  let index = 0;

  for (const opening of sorted) {
    if (opening.start < cursor + EPSILON) continue;
    addWallSection(parent, axis, name + '-solid-' + index++, coordinate, cursor,
      opening.start, floorY, height, thickness, material, colliders);
    if (opening.sill > 0) {
      addWallSection(parent, axis, name + '-sill-' + index++, coordinate,
        opening.start, opening.end, floorY, opening.sill, thickness, material, colliders);
    }
    const openingTop = opening.sill + opening.height;
    if (openingTop < height) {
      addWallSection(parent, axis, name + '-lintel-' + index++, coordinate,
        opening.start, opening.end, floorY + openingTop, height - openingTop, thickness, material, colliders);
    }
    if (opening.kind === 'window') {
      addWindow(parent, axis, name + '-window-' + index, coordinate, opening.center,
        opening.width, floorY + opening.sill, opening.height, thickness, glass, frame);
    } else {
      const frameSize = 0.065;
      if (axis === 'x') {
        addBox(parent, name + '-door-left-' + index, opening.start, floorY,
          coordinate, frameSize, opening.height, thickness * 0.72, frame);
        addBox(parent, name + '-door-right-' + index, opening.end, floorY,
          coordinate, frameSize, opening.height, thickness * 0.72, frame);
        addBox(parent, name + '-door-top-' + index, opening.center,
          floorY + opening.height - frameSize, coordinate,
          opening.width, frameSize, thickness * 0.72, frame);
      } else {
        addBox(parent, name + '-door-left-' + index, coordinate, floorY,
          opening.start, thickness * 0.72, opening.height, frameSize, frame);
        addBox(parent, name + '-door-right-' + index, coordinate, floorY,
          opening.end, thickness * 0.72, opening.height, frameSize, frame);
        addBox(parent, name + '-door-top-' + index, coordinate,
          floorY + opening.height - frameSize, opening.center,
          thickness * 0.72, frameSize, opening.width, frame);
      }
    }
    cursor = opening.end;
  }
  addWallSection(parent, axis, name + '-solid-end', coordinate, cursor,
    end, floorY, height, thickness, material, colliders);
}

function addSlopedRail(parent, name, x, y1, z1, y2, z2, material) {
  const dy = y2 - y1;
  const dz = z2 - z1;
  const length = Math.hypot(dy, dz);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.055, length, 0.055), material);
  rail.name = name;
  rail.position.set(x, (y1 + y2) / 2, (z1 + z2) / 2);
  rail.rotation.x = Math.atan2(dz, dy);
  rail.castShadow = true;
  parent.add(rail);
}

function addFloorWithStairOpening(parent, plan, name, y, material, leaveOpening) {
  const { inner, slab } = plan;
  const opening = plan.stair.opening;
  if (!leaveOpening) {
    addBox(parent, name, (inner.minX + inner.maxX) / 2, y - slab,
      (inner.minZ + inner.maxZ) / 2, plan.innerWidth, slab, plan.innerDepth, material);
    return;
  }
  const pieces = [
    { minX: inner.minX, maxX: opening.minX, minZ: inner.minZ, maxZ: inner.maxZ },
    { minX: opening.maxX, maxX: inner.maxX, minZ: inner.minZ, maxZ: inner.maxZ },
    { minX: opening.minX, maxX: opening.maxX, minZ: inner.minZ, maxZ: opening.minZ },
    { minX: opening.minX, maxX: opening.maxX, minZ: opening.maxZ, maxZ: inner.maxZ }
  ];
  for (const [index, piece] of pieces.entries()) {
    addBox(parent, name + '-part-' + index, (piece.minX + piece.maxX) / 2, y - slab,
      (piece.minZ + piece.maxZ) / 2, piece.maxX - piece.minX, slab,
      piece.maxZ - piece.minZ, material);
  }
}

function buildStairs(parent, plan, floorIndex, materials) {
  const { stair } = plan;
  const floorY = plan.baseY + plan.floorLevels[floorIndex];
  const floorHeight = plan.floorHeights[floorIndex];
  const halfHeight = floorHeight / 2;
  const tread = stair.treadDepth;
  const count = stair.treadCount;
  for (let index = 0; index < count; index += 1) {
    const rise = (index + 1) * floorHeight / (count * 2);
    const zOne = stair.frontSide > 0
      ? stair.maxZ - (index + 0.5) * tread
      : stair.minZ + (index + 0.5) * tread;
    const zTwo = stair.frontSide > 0
      ? stair.minZ + (index + 0.5) * tread
      : stair.maxZ - (index + 0.5) * tread;
    addBox(parent, 'stair-' + floorIndex + '-flight-a-step-' + (index + 1),
      stair.laneOneX, floorY, zOne, stair.flightWidth, rise, tread - 0.012, materials.step);
    addBox(parent, 'stair-' + floorIndex + '-flight-b-step-' + (index + 1),
      stair.laneTwoX, floorY + halfHeight, zTwo, stair.flightWidth, rise, tread - 0.012, materials.step);
  }

  const landingZ = stair.frontSide > 0
    ? stair.minZ - stair.landingDepth / 2
    : stair.maxZ + stair.landingDepth / 2;
  addBox(parent, 'stair-' + floorIndex + '-half-landing',
    (stair.minX + stair.maxX) / 2, floorY + halfHeight - 0.06, landingZ,
    stair.width + 0.08, 0.12, stair.landingDepth + 0.04, materials.landing);

  const railHeight = 0.94;
  const startY = floorY + railHeight;
  const middleY = floorY + halfHeight + railHeight;
  const endY = floorY + floorHeight + railHeight;
  if (stair.frontSide > 0) {
    addSlopedRail(parent, 'stair-' + floorIndex + '-rail-a',
      stair.laneOneX - stair.flightWidth * 0.46, startY, stair.maxZ,
      middleY, stair.minZ, materials.rail);
    addSlopedRail(parent, 'stair-' + floorIndex + '-rail-b',
      stair.laneTwoX + stair.flightWidth * 0.46, middleY, stair.minZ,
      endY, stair.maxZ, materials.rail);
  } else {
    addSlopedRail(parent, 'stair-' + floorIndex + '-rail-a',
      stair.laneOneX - stair.flightWidth * 0.46, startY, stair.minZ,
      middleY, stair.maxZ, materials.rail);
    addSlopedRail(parent, 'stair-' + floorIndex + '-rail-b',
      stair.laneTwoX + stair.flightWidth * 0.46, middleY, stair.maxZ,
      endY, stair.minZ, materials.rail);
  }
}

function buildFloorPartitions(parent, plan, level, materials, colliders) {
  const floorY = plan.baseY + plan.floorLevels[level];
  const height = plan.floorHeights[level] - plan.slab;
  const stair = plan.stair;
  const inner = plan.inner;
  const doorHeight = Math.min(2.12, height - 0.12);
  const doorCenterZ = stair.frontSide > 0
    ? stair.maxZ + 0.42
    : stair.minZ - 0.42;

  // Each half of the stair core opens directly to a clear, window-facing room.
  // The core is shared; these openings are apartment doors, not decorative cuts.
  for (const [side, x] of [['left', stair.minX], ['right', stair.maxX]]) {
    buildWallWithOpenings(parent, {
      axis: 'z',
      name: 'level-' + level + '-' + side + '-stair-room-wall',
      coordinate: x,
      start: inner.minZ + 0.12,
      end: inner.maxZ - 0.12,
      floorY,
      height,
      thickness: 0.14,
      material: materials.partition,
      frame: materials.frame,
      glass: materials.glass,
      colliders,
      openings: [{
        kind: 'door',
        center: doorCenterZ,
        width: 0.92,
        sill: 0,
        height: doorHeight
      }]
    });
  }
}

export function buildBuildingInterior(buildingRoot, definition = {}) {
  const bounds = measureStructuralBounds(buildingRoot);
  const fullBounds = measureBuildingBounds(buildingRoot);
  const doors = measureFacadeDoors(buildingRoot, bounds);
  const requestedSide = definition.frontSide ?? 1;
  const door = doors.find((candidate) => candidate.side === (requestedSide > 0 ? 'front' : 'back')) ||
    doors[0] || null;
  const explicitDoor = definition.architecture?.door;
  const resolvedDoor = door || (explicitDoor ? {
    center: explicitDoor.center,
    sill: explicitDoor.sill ?? 0,
    width: explicitDoor.width,
    height: explicitDoor.height,
    side: requestedSide > 0 ? 'front' : 'back',
    minX: explicitDoor.center - explicitDoor.width / 2,
    maxX: explicitDoor.center + explicitDoor.width / 2,
    minY: bounds.minY + (explicitDoor.sill ?? 0),
    maxY: bounds.minY + (explicitDoor.sill ?? 0) + explicitDoor.height
  } : null);
  if (!resolvedDoor) throw new Error('Building "' + buildingRoot.name + '" has no measurable entrance door mesh.');
  const facadeWindows = measureFacadeOpenings(buildingRoot, bounds, resolvedDoor);
  const plan = deriveInteriorPlan(bounds, definition.architecture || {}, requestedSide, resolvedDoor);
  const frame = getBuildingFrame(buildingRoot);
  const interior = new THREE.Group();
  interior.name = (definition.id || buildingRoot.name) + '-architectural-interior';
  interior.position.copy(frame.origin);
  interior.quaternion.copy(frame.orientation);

  const materials = {
    floor: new THREE.MeshStandardMaterial({ color: 0x89877f, roughness: 0.94 }),
    wall: new THREE.MeshStandardMaterial({ color: 0xc9c7bd, roughness: 0.93 }),
    partition: new THREE.MeshStandardMaterial({ color: 0xbebcb2, roughness: 0.94 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x4c514c, roughness: 0.62, metalness: 0.18 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x9bb7c0, roughness: 0.2, metalness: 0.04,
      transparent: true, opacity: 0.48, depthWrite: false, side: THREE.DoubleSide
    }),
    step: new THREE.MeshStandardMaterial({ color: 0x8a887f, roughness: 0.93 }),
    landing: new THREE.MeshStandardMaterial({ color: 0x98968c, roughness: 0.93 }),
    rail: new THREE.MeshStandardMaterial({ color: 0x535951, roughness: 0.66, metalness: 0.2 }),
    roof: new THREE.MeshStandardMaterial({ color: 0xa09e93, roughness: 0.94 }),
    foundation: new THREE.MeshStandardMaterial({ color: 0x777970, roughness: 0.94 })
  };

  const collidableMeshes = [];
  const inner = plan.inner;
  const wallHeight = plan.floorHeights[0] - plan.slab;
  const frontZ = requestedSide > 0 ? bounds.maxZ - plan.wall / 2 : bounds.minZ + plan.wall / 2;
  const backZ = requestedSide > 0 ? bounds.minZ + plan.wall / 2 : bounds.maxZ - plan.wall / 2;
  const leftX = bounds.minX + plan.wall / 2;
  const rightX = bounds.maxX - plan.wall / 2;
  const frontSideName = requestedSide > 0 ? 'front' : 'back';
  const backSideName = requestedSide > 0 ? 'back' : 'front';
  const sourceDoorCenter = resolvedDoor.center;

  // The actual GLB entrance threshold is above grade. Keep that datum instead
  // of silently placing the interior floor underneath the authored door.
  const plinthHeight = Math.max(0, plan.baseY - fullBounds.minY);
  if (plinthHeight > 0.02) {
    addBox(interior, 'ground-floor-foundation', 0,
      fullBounds.minY, 0, plan.width - 2 * plan.wall, plinthHeight,
      plan.depth - 2 * plan.wall, materials.foundation);
  }

  function openingsFor(side, level) {
    const floorBase = plan.floorLevels[level];
    const floorTop = plan.floorLevels[level + 1] ?? plan.floorLevels[level] + plan.floorHeights[level];
    return facadeWindows.filter((window) => {
      if (window.side !== side) return false;
      const sill = window.sill - (plan.baseY - bounds.minY) - floorBase;
      return sill >= 0.18 && sill + window.height <= floorTop - floorBase - plan.slab - 0.08;
    }).map((window) => ({
      kind: 'window',
      center: window.center,
      width: window.width,
      sill: window.sill - (plan.baseY - bounds.minY) - floorBase,
      height: window.height,
      plane: window.plane
    }));
  }

  for (let level = 0; level < plan.storeys; level += 1) {
    const floorY = plan.baseY + plan.floorLevels[level];
    const levelHeight = plan.floorHeights[level];
    const floorOpenings = level > 0;
    addFloorWithStairOpening(interior, plan, 'level-' + level + '-floor',
      floorY, materials.floor, floorOpenings);

    const doorOpening = level === 0 ? [{
      kind: 'door',
      center: sourceDoorCenter,
      width: resolvedDoor.width,
      sill: 0,
      height: Math.min(resolvedDoor.height, levelHeight - 0.18)
    }] : [];
    const frontOpenings = [...openingsFor(frontSideName, level), ...doorOpening];

    buildWallWithOpenings(interior, {
      axis: 'x', name: 'level-' + level + '-front',
      coordinate: frontZ,
      start: inner.minX, end: inner.maxX,
      floorY, height: levelHeight - plan.slab,
      thickness: plan.wall,
      material: materials.wall, frame: materials.frame, glass: materials.glass,
      openings: frontOpenings
    });
    buildWallWithOpenings(interior, {
      axis: 'x', name: 'level-' + level + '-back',
      coordinate: backZ,
      start: inner.minX, end: inner.maxX,
      floorY, height: levelHeight - plan.slab,
      thickness: plan.wall,
      material: materials.wall, frame: materials.frame, glass: materials.glass,
      openings: openingsFor(backSideName, level)
    });
    buildWallWithOpenings(interior, {
      axis: 'z', name: 'level-' + level + '-left',
      coordinate: leftX,
      start: inner.minZ, end: inner.maxZ,
      floorY, height: levelHeight - plan.slab,
      thickness: plan.wall,
      material: materials.wall, frame: materials.frame, glass: materials.glass,
      openings: openingsFor('left', level)
    });
    buildWallWithOpenings(interior, {
      axis: 'z', name: 'level-' + level + '-right',
      coordinate: rightX,
      start: inner.minZ, end: inner.maxZ,
      floorY, height: levelHeight - plan.slab,
      thickness: plan.wall,
      material: materials.wall, frame: materials.frame, glass: materials.glass,
      openings: openingsFor('right', level)
    });

    buildFloorPartitions(interior, plan, level, materials, collidableMeshes);
  }

  for (let level = 0; level < plan.storeys - 1; level += 1) {
    buildStairs(interior, plan, level, materials);
  }
  addBox(interior, 'roof-slab', (inner.minX + inner.maxX) / 2,
    plan.topY - plan.slab, (inner.minZ + inner.maxZ) / 2,
    plan.innerWidth, plan.slab, plan.innerDepth, materials.roof);

  const entryPoint = new THREE.Vector3(plan.entryX, plan.baseY, plan.entryZ);
  const doorPoint = new THREE.Vector3(
    sourceDoorCenter,
    bounds.minY + resolvedDoor.sill,
    requestedSide > 0 ? bounds.maxZ + 0.12 : bounds.minZ - 0.12
  );
  const outward = new THREE.Vector3(0, 0, requestedSide).applyQuaternion(frame.orientation).normalize();
  interior.updateMatrixWorld(true);

  const doorPosition = doorPoint.clone().applyMatrix4(interior.matrixWorld);
  const collisionBoxes = collidableMeshes.map((mesh) => {
    const box = new THREE.Box3().setFromObject(mesh);
    return {
      name: mesh.name,
      minX: box.min.x, maxX: box.max.x,
      minZ: box.min.z, maxZ: box.max.z
    };
  });

  const ambient = new THREE.PointLight(0xffe6d1, 0.34, Math.max(plan.width, plan.depth) * 1.7, 2);
  ambient.position.set(plan.entryX, plan.baseY + plan.floorHeights[0] * 0.7,
    (inner.minZ + inner.maxZ) / 2);
  interior.add(ambient);

  interior.userData.plan = plan;
  interior.userData.walkBounds = plan.walkBounds;
  interior.userData.collisionBoxes = collisionBoxes;
  interior.userData.entryPoint = entryPoint;
  interior.userData.doorLocal = doorPoint;
  interior.userData.getWalkHeight = (x, z, feetY) => getInteriorWalkHeight(plan, x, z, feetY);
  interior.userData.canWalkAt = (x, z, feetY, radius = 0.3) =>
    isInteriorPositionWalkable(plan, x, z, feetY, radius);
  interior.userData.facadeWindows = facadeWindows;
  interior.userData.facadeDoor = resolvedDoor;

  return { root: interior, plan, doorPosition, outward };
}
