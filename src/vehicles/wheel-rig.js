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
