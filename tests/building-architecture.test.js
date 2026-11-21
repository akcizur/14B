import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  buildBuildingInterior,
  deriveInteriorPlan,
  getInteriorWalkHeight,
  isInteriorPositionWalkable,
  measureBuildingBounds,
  measureStructuralBounds,
  measureFacadeDoors,
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
    new THREE.MeshStandardMaterial({ name: 'brick_wall' })
  );
  shell.name = 'main-building-wall';
  shell.position.y = height / 2;
  root.add(shell);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 2.1, 0.06),
    new THREE.MeshStandardMaterial({ name: 'door_white' })
  );
  door.name = 'entrance-door';
  door.position.set(0, 1.05, depth / 2 - 0.01);
  root.add(door);

  const lowerPane = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.55, 0.04),
    new THREE.MeshStandardMaterial({ name: 'window_glass' })
  );
  lowerPane.name = 'front-window-lower-pane';
  lowerPane.position.set(-3, 1.0, depth / 2 - 0.04);
  root.add(lowerPane);

  const upperPane = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.55, 0.04),
    new THREE.MeshStandardMaterial({ name: 'window_glass' })
  );
  upperPane.name = 'front-window-upper-pane';
  upperPane.position.set(-3, 1.58, depth / 2 - 0.04);
  root.add(upperPane);

  const sideWindow = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 1.2, 1.35),
    new THREE.MeshStandardMaterial()
  );
  sideWindow.name = 'left-window-frame';
  sideWindow.position.set(-width / 2 + 0.03, 5.2, 0.8);
  root.add(sideWindow);

  root.updateMatrixWorld(true);
  return root;
}

test('single GLB mesh with material groups keeps door, glass and shell bounds separate', () => {
  const parts = [];
  const materials = [
    new THREE.MeshStandardMaterial({ name: 'brick_shadeGreen' }),
    new THREE.MeshStandardMaterial({ name: 'door_white' }),
    new THREE.MeshStandardMaterial({ name: 'window_glass' })
  ];
  const addPart = (geometry, materialIndex) => {
    geometry.clearGroups();
    geometry.addGroup(0, geometry.index.count, materialIndex);
    parts.push(geometry);
  };

  const shell = new THREE.BoxGeometry(12, 10.1, 9);
  shell.translate(0, 5.05, 0);
  addPart(shell, 0);

  const door = new THREE.BoxGeometry(1.2, 2.1, 0.06);
  door.translate(0, 1.05, 4.47);
  addPart(door, 1);

  const lowerPane = new THREE.BoxGeometry(1.4, 0.55, 0.04);
  lowerPane.translate(-3, 1.0, 4.46);

  const upperPane = new THREE.BoxGeometry(1.4, 0.55, 0.04);
  upperPane.translate(-3, 1.58, 4.46);

  const glazing = mergeGeometries([lowerPane, upperPane]);
  assert.ok(glazing);
  glazing.clearGroups();
  glazing.addGroup(0, glazing.index.count, 2);
  parts.push(glazing);

  const geometry = mergeGeometries(parts, true);
  assert.ok(geometry);
  const root = new THREE.Group();
  root.name = 'glb-style-single-mesh';
  root.add(new THREE.Mesh(geometry, materials));
  root.updateMatrixWorld(true);

  const structure = measureStructuralBounds(root);
  const [measuredDoor] = measureFacadeDoors(root, structure);
  const windows = measureFacadeOpenings(root, structure, measuredDoor);
  assert.ok(Math.abs((structure.maxX - structure.minX) - 12) < 1e-4);
  assert.ok(Math.abs((structure.maxY - structure.minY) - 10.1) < 1e-4);
  assert.ok(Math.abs(measuredDoor.width - 1.2) < 0.03);
  assert.ok(Math.abs(measuredDoor.height - 2.1) < 0.03);
  assert.equal(windows.length, 1);
  assert.ok(Math.abs(windows[0].width - 1.4) < 0.03);
  assert.ok(Math.abs(windows[0].height - 1.13) < 0.08);
});

test('building dimensions are measured in metres in the rotated model-local frame', () => {
  const shell = createShell({ width: 12, height: 10.1, depth: 9, scale: 1.25 });
  const bounds = measureBuildingBounds(shell);
  assert.ok(Math.abs((bounds.maxX - bounds.minX) - 15) < 1e-4);
  assert.ok(Math.abs((bounds.maxZ - bounds.minZ) - 11.25) < 1e-4);
  assert.ok(Math.abs((bounds.maxY - bounds.minY) - 12.625) < 1e-4);
});

test('structural footprint ignores isolated roof trim and is taken from the wall body', () => {
  const shell = createShell({ rotation: 0 });
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(2, 1.5, 0.2),
    new THREE.MeshStandardMaterial({ name: 'sandstone_trim' })
  );
  trim.position.set(0, 10.6, 4.45);
  shell.add(trim);
  shell.updateMatrixWorld(true);
  const structural = measureStructuralBounds(shell);
  assert.ok(Math.abs((structural.maxY - structural.minY) - 10.1) < 1e-4);
  assert.ok(Math.abs((structural.maxX - structural.minX) - 12) < 1e-4);
});

test('door and windows are measured from individual GLB mesh geometry', () => {
  const shell = createShell({ rotation: 0 });
  const structural = measureStructuralBounds(shell);
  const [door] = measureFacadeDoors(shell, structural);
  const windows = measureFacadeOpenings(shell, structural, door);
  assert.ok(door);
  assert.equal(door.side, 'front');
  assert.ok(Math.abs(door.width - 1.2) < 0.03);
  assert.ok(Math.abs(door.height - 2.1) < 0.03);
  assert.equal(windows.length, 2);
  assert.ok(windows.some((window) => window.side === 'front' &&
    Math.abs(window.width - 1.4) < 0.03 && Math.abs(window.height - 1.13) < 0.08));
  assert.ok(windows.some((window) => window.side === 'left' &&
    Math.abs(window.width - 1.35) < 0.03));
});

test('interior uses measured floors, stair core, real door opening and real glazing', () => {
  const shell = createShell({ rotation: 0 });
  const { root, plan, doorPosition, outward } = buildBuildingInterior(shell, {
    id: 'house-test',
    frontSide: 1,
    architecture: {
      storeys: 2,
      floorLevels: [0, 3.1, 6.2],
      wallThickness: 0.18,
      slabThickness: 0.16
    }
  });
  assert.equal(plan.storeys, 2);
  assert.equal(plan.floorLevels.length, 3);
  assert.ok(plan.innerWidth < plan.width);
  assert.ok(plan.innerDepth < plan.depth);
  assert.ok(plan.floorHeights.every((height) => height >= 2.25));
  assert.ok(plan.topY <= plan.bounds.maxY);
  assert.ok(root.getObjectByName('level-0-floor'));
  assert.ok(root.getObjectByName('stair-0-flight-a-step-1'));
  assert.ok(root.getObjectByName('stair-0-flight-b-step-10'));
  assert.ok(root.children.some((child) => child.name.startsWith('level-0-front-window-') && child.name.endsWith('-glass')));
  assert.ok(root.children.some((child) => child.name.startsWith('level-0-front-door-left-')));
  assert.ok(root.userData.collisionBoxes.length > 0);
  assert.ok(doorPosition.z > 0);
  assert.ok(outward.z > 0.99);
});

test('U-stair flights create continuous half-floor and full-floor transitions', () => {
  const plan = deriveInteriorPlan({
    minX: -6, maxX: 6,
    minY: 0, maxY: 10.1,
    minZ: -4.5, maxZ: 4.5
  }, { storeys: 3 });
  const stair = plan.stair;
  const low = getInteriorWalkHeight(plan, stair.laneOneX, stair.maxZ, plan.baseY);
  const half = getInteriorWalkHeight(plan, stair.laneOneX, stair.minZ, plan.baseY);
  const secondFlightStart = getInteriorWalkHeight(plan, stair.laneTwoX, stair.minZ, half);
  const upper = getInteriorWalkHeight(plan, stair.laneTwoX, stair.maxZ, half);
  assert.ok(Math.abs(low - plan.baseY) < 1e-5);
  assert.ok(Math.abs(half - (plan.baseY + plan.floorHeight / 2)) < 1e-5);
  assert.ok(Math.abs(secondFlightStart - half) < 1e-5);
  assert.ok(Math.abs(upper - (plan.baseY + plan.floorHeight)) < 1e-5);

  const nextStoreyStart = getInteriorWalkHeight(plan, stair.laneOneX, stair.maxZ, upper);
  const nextStoreyLanding = getInteriorWalkHeight(plan, stair.laneOneX, stair.minZ, upper);
  assert.ok(Math.abs(nextStoreyStart - upper) < 1e-5);
  assert.ok(Math.abs(nextStoreyLanding - (upper + plan.floorHeight / 2)) < 1e-5);
});

test('upper floor void blocks walking outside stair flights and landing', () => {
  const plan = deriveInteriorPlan({
    minX: -6, maxX: 6,
    minY: 0, maxY: 10.1,
    minZ: -4.5, maxZ: 4.5
  }, { storeys: 3 });
  const opening = plan.stair.opening;
  const floorY = plan.baseY + plan.floorLevels[1];
  const gapX = (plan.stair.laneOneX + plan.stair.laneTwoX) / 2;
  const stairZ = (plan.stair.minZ + plan.stair.maxZ) / 2;
  assert.equal(isInteriorPositionWalkable(plan, plan.stair.laneOneX, stairZ, floorY), true);
  assert.equal(isInteriorPositionWalkable(plan, gapX, stairZ, floorY), false);
  assert.ok(opening.maxX > opening.minX && opening.maxZ > opening.minZ);
});
