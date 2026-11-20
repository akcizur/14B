const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** A circle-versus-AABB test in the horizontal X/Z plane. */
export function circleIntersectsAabb(x, z, radius, box) {
  if (![x, z, radius, box?.minX, box?.maxX, box?.minZ, box?.maxZ].every(Number.isFinite)) {
    return false;
  }
  const closestX = clamp(x, box.minX, box.maxX);
  const closestZ = clamp(z, box.minZ, box.maxZ);
  const dx = x - closestX;
  const dz = z - closestZ;
  return dx * dx + dz * dz < radius * radius - 1e-8;
}

/** Keep diagonal movement at the same speed as axial movement. */
export function normalizeMovement(forward, strafe) {
  if (![forward, strafe].every(Number.isFinite)) return { x: 0, z: 0 };
  const length = Math.hypot(forward, strafe);
  if (length < 1e-8) return { x: 0, z: 0 };
  const scale = length > 1 ? 1 / length : 1;
  return { x: forward * scale, z: strafe * scale };
}

/** Check whether the player is close enough and looking towards a target. */
export function isInInteractionRange(position, target, forward, maxDistance = 3.2, minFacingDot = 0.28) {
  const values = [
    position?.x, position?.z, target?.x, target?.z,
    forward?.x, forward?.z, maxDistance, minFacingDot
  ];
  if (!values.every(Number.isFinite) || maxDistance < 0) return false;

  const dx = target.x - position.x;
  const dz = target.z - position.z;
  const distanceSquared = dx * dx + dz * dz;
  if (distanceSquared > maxDistance * maxDistance) return false;
  if (distanceSquared < 1e-8) return true;

  const forwardLength = Math.hypot(forward.x, forward.z);
  if (forwardLength < 1e-8) return false;

  const facing = (dx * forward.x + dz * forward.z) /
    (Math.sqrt(distanceSquared) * forwardLength);
  return facing >= minFacingDot;
}

/** Check walkable bounds and all solid boxes without making corners square. */
export function canOccupy(x, z, radius, bounds, colliders = []) {
  if (![x, z, radius].every(Number.isFinite) || radius < 0) return false;
  if (bounds && (
    x - radius < bounds.minX || x + radius > bounds.maxX ||
    z - radius < bounds.minZ || z + radius > bounds.maxZ
  )) return false;
  return !colliders.some((box) => circleIntersectsAabb(x, z, radius, box));
}

/**
 * Sweep a moving circle in short steps. When a diagonal step is blocked,
 * try the dominant axis first and then the remaining axis to preserve sliding.
 */
export function resolveAxisMovement(from, to, canMove, maxStep = 0.2) {
  if (![from?.x, from?.z, to?.x, to?.z, maxStep].every(Number.isFinite) || maxStep <= 0) {
    return { x: from?.x ?? 0, z: from?.z ?? 0 };
  }

  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const distance = Math.max(Math.abs(dx), Math.abs(dz));
  const steps = Math.max(1, Math.ceil(distance / maxStep));
  let x = from.x;
  let z = from.z;

  for (let i = 1; i <= steps; i += 1) {
    const targetX = from.x + dx * (i / steps);
    const targetZ = from.z + dz * (i / steps);

    if (canMove(targetX, targetZ)) {
      x = targetX;
      z = targetZ;
      continue;
    }

    const xFirst = Math.abs(dx) >= Math.abs(dz);
    const axes = xFirst ? ['x', 'z'] : ['z', 'x'];
    for (const axis of axes) {
      if (axis === 'x' && canMove(targetX, z)) x = targetX;
      if (axis === 'z' && canMove(x, targetZ)) z = targetZ;
    }
  }

  return { x, z };
}
