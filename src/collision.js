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

/** Check walkable bounds and all solid boxes without making corners square. */
export function canOccupy(x, z, radius, bounds, colliders = []) {
  if (![x, z, radius].every(Number.isFinite) || radius < 0) return false;
  if (bounds && (
    x - radius < bounds.minX || x + radius > bounds.maxX ||
    z - radius < bounds.minZ || z + radius > bounds.maxZ
  )) return false;
  return !colliders.some((box) => circleIntersectsAabb(x, z, radius, box));
}

/** Resolve blocked diagonal motion by sliding along the available axis. */
export function resolveAxisMovement(from, to, canMove) {
  let x = from.x;
  let z = from.z;
  if (canMove(to.x, to.z)) return { x: to.x, z: to.z };
  if (canMove(to.x, z)) x = to.x;
  if (canMove(x, to.z)) z = to.z;
  return { x, z };
}
