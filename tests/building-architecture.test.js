import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  buildBuildingInterior,
  deriveInteriorPlan,
  getInteriorWalkHeight,
  isInteriorPositionWalkable,
  measureBuildingBounds,
  measureFacadeOpenings
} from '../src/world/building-architecture.js';

function createShell({ width = 12, height = 10.1, depth = 9, scale = 1, rotation = Math.PI / 2 } = {}) {
  const root = new THREE.Group();
  root.name = 'test-building';
  root.position.set(7, 0, -4);
  root.rotation.y = rotation;
  root.scale.setScalar(scale);
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial()
  );
  shell.position.y = height / 2;
  root.add(shell);
  root.updateMatrixWorld(true);
  return root;
}

test('building dimensions are measured in metres in the rotated model-local frame', () => {
  const shell = createShell({ width: 12, height: 10.1, depth: 9, scale: 1.25 });
  const bounds = measureBuildingBounds(shell);
  assert.ok(Math.abs((bounds.maxX - bounds.minX) - 15) < 1e-4);
  assert.ok(Math.abs((bounds.maxZ - bounds.minZ) - 11.25) < 1e-4);
  assert.ok(Math.abs((bounds.maxY - bounds.minY) - 12.625) < 1e-4);
});

test('interior floorplates and roof are derived from the measured exterior shell', () => {
  const shell = createShell();
  const { root, plan } = buildBuildingInterior(shell, {
    id: 'house-test',
    architecture: { storeys: 3, wallThickness: 0.18, slabThickness: 0.16 }
  });
  assert.equal(plan.storeys, 3);
  assert.ok(plan.innerWidth < plan.width);
  assert.ok(plan.innerDepth < plan.depth);
  assert.ok(plan.floorHeight >= 2.55 && plan.floorHeight <= 3.2);
  assert.ok(plan.topY <= plan.bounds.maxY);
  assert.ok(root.getObjectByName('level-0-floor'));
  assert.ok(root.getObjectByName('stair-0-flight-a-step-1'));
  assert.ok(root.getObjectByName('stair-1-flight-b-step-9'));
  assert.ok(root.children.some((child) => child.name.includes('-glass')));
  assert.ok(root.userData.collisionBoxes.length > 0);
});

test('U-stair flights create continuous half-floor to full-floor height transitions', () => {
  const plan = deriveInteriorPlan({
    minX: -6, maxX: 6,
    minY: 0, maxY: 10.1,
    minZ: -4.5, maxZ: 4.5
  }, { storeys: 3 });
  const stair = plan.stair;
  const low = getInteriorWalkHeight(plan, stair.laneOneX, stair.minZ, 0);
  const half = getInteriorWalkHeight(plan, stair.laneOneX, stair.maxZ, 0);
  const secondFlightStart = getInteriorWalkHeight(plan, stair.laneTwoX, stair.maxZ, half);
  const upper = getInteriorWalkHeight(plan, stair.laneTwoX, stair.minZ, half);
  assert.ok(Math.abs(low - plan.baseY) < 1e-5);
  assert.ok(Math.abs(half - (plan.baseY + plan.floorHeight / 2)) < 1e-5);
  assert.ok(Math.abs(secondFlightStart - half) < 1e-5);
  assert.ok(Math.abs(upper - (plan.baseY + plan.floorHeight)) < 1e-5);

  const nextStoreyStart = getInteriorWalkHeight(plan, stair.laneOneX, stair.minZ, upper);
  const nextStoreyLanding = getInteriorWalkHeight(plan, stair.laneOneX, stair.maxZ, upper);
  assert.ok(Math.abs(nextStoreyStart - upper) < 1e-5);
  assert.ok(Math.abs(nextStoreyLanding - (upper + plan.floorHeight / 2)) < 1e-5);
});

test('upper floor stair opening allows the stair lanes but blocks the open void', () => {
  const plan = deriveInteriorPlan({
    minX: -6, maxX: 6,
    minY: 0, maxY: 10.1,
    minZ: -4.5, maxZ: 4.5
  }, { storeys: 3 });
  const opening = plan.stair.opening;
  const floorY = plan.baseY + plan.floorHeight;
  const gapX = (plan.stair.laneOneX + plan.stair.laneTwoX) / 2;
  const stairZ = (plan.stair.minZ + plan.stair.maxZ) / 2;
  assert.equal(isInteriorPositionWalkable(plan, plan.stair.laneOneX, stairZ, floorY), true);
  assert.equal(isInteriorPositionWalkable(plan, gapX, stairZ, floorY), false);
  assert.ok(opening.maxX > opening.minX && opening.maxZ > opening.minZ);
});


test('named exterior GLB window and glass meshes are detected on their real facades', () => {
  const shell = createShell();
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.15, 0.06),
    new THREE.MeshStandardMaterial({ name: 'Glass' })
  );
  glass.name = 'front-window-glazing';
  glass.position.set(-2.5, 2.1, 4.45);
  shell.add(glass);

  const sideWindow = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 1.2, 1.35),
    new THREE.MeshStandardMaterial()
  );
  sideWindow.name = 'left-window-frame';
  sideWindow.position.set(-5.95, 5.2, 0.8);
  shell.add(sideWindow);
  shell.updateMatrixWorld(true);

  const openings = measureFacadeOpenings(shell);
  assert.equal(openings.length, 2);
  assert.ok(openings.some((opening) =>
    opening.side === 'front' && Math.abs(opening.center + 2.5) < 0.05 &&
    Math.abs(opening.width - 1.4) < 0.1
  ));
  assert.ok(openings.some((opening) =>
    opening.side === 'left' && Math.abs(opening.center - 0.8) < 0.05
  ));
});
