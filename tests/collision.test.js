import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canOccupy,
  circleIntersectsAabb,
  isInInteractionRange,
  normalizeMovement,
  resolveAxisMovement
} from '../src/collision.js';

const wall = { minX: 1, maxX: 2, minZ: -1, maxZ: 1 };

test('circle collision uses rounded AABB corners rather than an expanded square', () => {
  assert.equal(circleIntersectsAabb(0.78, 1.22, 0.3, wall), false);
  assert.equal(circleIntersectsAabb(0.85, 1.15, 0.3, wall), true);
  assert.equal(circleIntersectsAabb(0.5, 0, 0.3, wall), false);
});

test('walkable bounds include the player radius and reject invalid coordinates', () => {
  const bounds = { minX: -3, maxX: 3, minZ: -2, maxZ: 2 };
  assert.equal(canOccupy(2.69, 0, 0.3, bounds), true);
  assert.equal(canOccupy(2.71, 0, 0.3, bounds), false);
  assert.equal(canOccupy(Number.NaN, 0, 0.3, bounds), false);
});

test('diagonal movement is normalized to the same total speed as axial movement', () => {
  const diagonal = normalizeMovement(1, 1);
  const axial = normalizeMovement(1, 0);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - 1) < 1e-10);
  assert.equal(Math.hypot(axial.x, axial.z), 1);
  assert.deepEqual(normalizeMovement(0, 0), { x: 0, z: 0 });
});

test('interaction range requires proximity and a forward-facing direction', () => {
  const player = { x: 0, z: 0 };
  const door = { x: 0, z: -2 };
  assert.equal(isInInteractionRange(player, door, { x: 0, z: -1 }), true);
  assert.equal(isInInteractionRange(player, door, { x: 0, z: 1 }), false);
  assert.equal(isInInteractionRange(player, { x: 0, z: -5 }, { x: 0, z: -1 }), false);
});

test('movement resolves against obstacles and slides along a free axis', () => {
  const from = { x: 0, z: 0 };
  const to = { x: 1.5, z: 0.5 };
  const resolved = resolveAxisMovement(from, to, (x, z) => !circleIntersectsAabb(x, z, 0.3, wall));
  assert.ok(resolved.x > 0.5 && resolved.x < 0.7);
  assert.ok(resolved.z > 0);
});

test('swept movement cannot tunnel through a thin obstacle', () => {
  const obstacle = { minX: 1, maxX: 1.2, minZ: -1, maxZ: 1 };
  const result = resolveAxisMovement(
    { x: 0, z: 0 },
    { x: 3, z: 0 },
    (x, z) => !circleIntersectsAabb(x, z, 0.3, obstacle)
  );
  assert.ok(result.x <= obstacle.minX - 0.3 + 1e-8);
  assert.ok(result.x >= 0);
});

test('swept movement stays on the safe side until it can slide around an obstacle', () => {
  const obstacle = { minX: 1, maxX: 1.2, minZ: -1, maxZ: 1 };
  const result = resolveAxisMovement(
    { x: 0, z: 0 },
    { x: 3, z: 0 },
    (x, z) => !circleIntersectsAabb(x, z, 0.3, obstacle)
  );
  assert.ok(result.x <= obstacle.minX - 0.3 + 1e-8);
  assert.equal(result.z, 0);
});
