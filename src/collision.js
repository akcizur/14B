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
  const stepX = dx / steps;
  const stepZ = dz / steps;
  let x = from.x;
  let z = from.z;

  for (let i = 0; i < steps; i += 1) {
    const nextX = x + stepX;
    const nextZ = z + stepZ;

    if (canMove(nextX, nextZ)) {
      x = nextX;
      z = nextZ;
      continue;
    }

    // Resolve only this sub-step from the last known safe position.
    // Never resume the original absolute trajectory after a blocked sample:
    // doing so can tunnel through a thin collider on the far side.
    const xFirst = Math.abs(stepX) >= Math.abs(stepZ);
    const axes = xFirst ? ['x', 'z'] : ['z', 'x'];
    for (const axis of axes) {
      if (axis === 'x' && canMove(x + stepX, z)) x += stepX;
      if (axis === 'z' && canMove(x, z + stepZ)) z += stepZ;
    }
  }

  return { x, z };
}


/** Wheel roll in radians for linear travel measured in world units. */
export function wheelAngularDelta(distance, radius) {
  if (!Number.isFinite(distance) || !Number.isFinite(radius) || radius <= 1e-5) return 0;
  return distance / radius;
}

/** Scale an in-place walk cycle to the actor's actual travel speed. */
export function animationTimeScale(movementSpeed, authoredWalkSpeed = 1.2) {
  if (!Number.isFinite(movementSpeed) || movementSpeed <= 0) return 0;
  if (!Number.isFinite(authoredWalkSpeed) || authoredWalkSpeed <= 0) return 1;
  return Math.max(0.25, Math.min(1.6, movementSpeed / authoredWalkSpeed));
}

/** Pick the closest target using horizontal distance only, with no view-cone gate. */
export function findNearestByDistance(position, targets, maxDistance, getPosition = (target) => target.position) {
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.z) ||
      !Array.isArray(targets) || !Number.isFinite(maxDistance) || maxDistance < 0) return null;

  let nearest = null;
  let nearestDistance = maxDistance;
  for (const target of targets) {
    const targetPosition = getPosition(target);
    if (!targetPosition || !Number.isFinite(targetPosition.x) || !Number.isFinite(targetPosition.z)) continue;
    const distance = Math.hypot(targetPosition.x - position.x, targetPosition.z - position.z);
    if (distance <= nearestDistance) {
      nearest = target;
      nearestDistance = distance;
    }
  }
  return nearest ? { target: nearest, distance: nearestDistance } : null;
}

/** Split a route move into visible segments plus an explicit end-to-start wrap. */
export function splitAxisRoute(current, signedDistance, route) {
  if (![current, signedDistance, route?.min, route?.max].every(Number.isFinite) ||
      route.min >= route.max || current < route.min || current > route.max) return [];

  if (Math.abs(signedDistance) < 1e-8) return [];
  const direction = Math.sign(signedDistance);
  let remaining = Math.abs(signedDistance);
  let cursor = current;
  const segments = [];

  while (remaining > 1e-8) {
    const boundary = direction > 0 ? route.max : route.min;
    const available = Math.abs(boundary - cursor);

    if (available < 1e-8) {
      cursor = direction > 0 ? route.min : route.max;
      continue;
    }

    const travel = Math.min(remaining, available);
    const next = cursor + direction * travel;
    const wraps = remaining - travel > 1e-8;
    segments.push({
      from: cursor,
      to: next,
      wrapTo: wraps ? (direction > 0 ? route.min : route.max) : null
    });
    remaining -= travel;
    cursor = next;
    if (wraps) cursor = direction > 0 ? route.min : route.max;
  }
  return segments;
}

function pointAabbDistanceSquared(x, z, box) {
  const dx = x < box.minX ? box.minX - x : x > box.maxX ? x - box.maxX : 0;
  const dz = z < box.minZ ? box.minZ - z : z > box.maxZ ? z - box.maxZ : 0;
  return dx * dx + dz * dz;
}

/**
 * Sweep a vehicle's axis-aligned footprint against the player's circle.
 * Existing overlap is only allowed to separate, never to push farther through.
 */
export function canMoveVehicleAlongAxis(player, playerRadius, axis, fixed, from, to, halfWidth, halfDepth, maxStep = 0.12) {
  if (!player || ![player.x, player.z, playerRadius, fixed, from, to, halfWidth, halfDepth, maxStep].every(Number.isFinite) ||
      playerRadius < 0 || halfWidth <= 0 || halfDepth <= 0 || maxStep <= 0 || !['x', 'z'].includes(axis)) return false;

  const boxAt = (value) => axis === 'x'
    ? { minX: value - halfWidth, maxX: value + halfWidth, minZ: fixed - halfDepth, maxZ: fixed + halfDepth }
    : { minX: fixed - halfWidth, maxX: fixed + halfWidth, minZ: value - halfDepth, maxZ: value + halfDepth };

  const initialBox = boxAt(from);
  const startsOverlapping = circleIntersectsAabb(player.x, player.z, playerRadius, initialBox);
  const distance = Math.abs(to - from);
  const steps = Math.max(1, Math.ceil(distance / maxStep));
  let previousSeparation = pointAabbDistanceSquared(player.x, player.z, initialBox);

  for (let index = 1; index <= steps; index += 1) {
    const sample = from + (to - from) * (index / steps);
    const box = boxAt(sample);
    const separation = pointAabbDistanceSquared(player.x, player.z, box);
    if (circleIntersectsAabb(player.x, player.z, playerRadius, box)) {
      if (!startsOverlapping) return false;
      const playerAxis = axis === 'x' ? player.x : player.z;
      if (Math.abs(playerAxis - sample) + 1e-8 < Math.abs(playerAxis - from)) return false;
      if (separation + 1e-8 < previousSeparation) return false;
    }
    previousSeparation = separation;
  }
  return true;
}
