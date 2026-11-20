import test from 'node:test';
import assert from 'node:assert/strict';
import { canOccupy, circleIntersectsAabb, resolveAxisMovement } from '../src/collision.js';

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

test('movement resolves against obstacles and slides along a free axis', () => {
  const from = { x: 0, z: 0 };
  const to = { x: 1.5, z: 0.5 };
  const resolved = resolveAxisMovement(from, to, (x, z) => !circleIntersectsAabb(x, z, 0.3, wall));
  assert.equal(resolved.x, 0);
  assert.equal(resolved.z, 0.5);
});
