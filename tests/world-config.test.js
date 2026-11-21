import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORLD_CONFIG } from '../src/world/world-config.js';
import { assertValidWorldConfig, validateWorldConfig } from '../src/world/world-validation.js';
import { assertValidWorldHierarchy, validateWorldHierarchy, flattenWorldHierarchy } from '../src/world/world-hierarchy.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public', 'models', 'manifest.json'), 'utf8'));

const entities = [
  ...WORLD_CONFIG.buildings,
  ...WORLD_CONFIG.streetProps,
  ...WORLD_CONFIG.trees,
  ...WORLD_CONFIG.vehicles,
  ...WORLD_CONFIG.pedestrians
];

test('current District 14 world catalog validates against local GLB assets', () => {
  assert.deepEqual(validateWorldConfig(WORLD_CONFIG, manifest), []);
  assert.equal(assertValidWorldConfig(WORLD_CONFIG, manifest), true);
});

test('residential street curb, sidewalk and entrance path meet cleanly', () => {
  const { curb, sidewalk, entryPath } = WORLD_CONFIG.street;
  const curbOuter = curb.z + curb.depth / 2;
  const sidewalkInner = sidewalk.z - sidewalk.depth / 2;
  assert.ok(Math.abs(curbOuter - sidewalkInner) < 1e-6,
    'outer curb edge must meet the inner sidewalk edge');
  assert.equal(sidewalk.width, WORLD_CONFIG.street.road.size[0]);
  assert.equal(curb.width, WORLD_CONFIG.street.road.size[0]);
  assert.equal(entryPath.width, 1.8);
  assert.ok(Math.abs(entryPath.thresholdDepth - 2 * 0.32) < 1e-6,
    'two outside risers and the path start must share one measured threshold depth');
});

test('all world entities have stable unique IDs and explicit collision policies', () => {
  const ids = entities.map((entity) => entity.id);
  assert.equal(ids.length, new Set(ids).size);
  for (const entity of entities) {
    assert.equal(typeof entity.id, 'string');
    assert.equal(Object.hasOwn(entity, 'collision'), true, entity.id);
    assert.ok(entity.collision === false || typeof entity.collision === 'object', entity.id);
  }
});

test('world data validates model keys, transforms and map bounds', () => {
  const invalid = structuredClone(WORLD_CONFIG);
  invalid.streetProps.push({ id: invalid.buildings[0].id, asset: 'Missing Model', position: [500, 0, 500], height: 1, collision: { type: 'bounds', scale: -1, minSize: 0 } });
  const errors = validateWorldConfig(invalid, manifest);
  assert.ok(errors.some((message) => message.includes('Duplicate world entity id')));
  assert.ok(errors.some((message) => message.includes('references missing asset')));
  assert.ok(errors.some((message) => message.includes('outside world bounds')));
  assert.ok(errors.some((message) => message.includes('collision profile')));
});

test('world runtime consumes the data catalog instead of defining placements in the renderer', () => {
  const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
  assert.match(main, /import \{ WORLD_CONFIG \} from '\.\/world\/world-config\.js'/);
  assert.match(main, /WORLD_CONFIG\.buildings\.map\(addBuilding\)/);
  assert.match(main, /WORLD_CONFIG\.streetProps\.map/);
  assert.match(main, /WORLD_CONFIG\.vehicles/);
  assert.match(main, /WORLD_CONFIG\.pedestrians/);
  assert.match(main, /assertValidWorldConfig\(WORLD_CONFIG, manifest\)/);
});


test('pedestrians define local talk interactions and gait reference speeds', () => {
  assert.ok(WORLD_CONFIG.pedestrians.every((npc) =>
    npc.interaction?.name && npc.interaction?.text && npc.interaction.radius > 0
  ));
  assert.ok(WORLD_CONFIG.pedestrians.every((npc) =>
    Number.isFinite(npc.animation?.walkSpeed) && npc.animation.walkSpeed > 0
  ));
});


test('enterable buildings define multi-storey structural architecture', () => {
  const houses = WORLD_CONFIG.buildings.filter((building) => building.role === 'house');
  assert.equal(houses.length, 1);
  assert.ok(houses.every((house) => Number.isInteger(house.architecture?.storeys)));
  assert.ok(houses.every((house) => house.architecture.storeys >= 2));
  assert.ok(WORLD_CONFIG.street.entryPath.width > 0);
  assert.equal(WORLD_CONFIG.fences, undefined, 'starter parcel must remain free of perimeter clutter');
});


test('starter world contains only one reference house and the road corridor', () => {
  assert.equal(WORLD_CONFIG.buildings.length, 1);
  assert.equal(WORLD_CONFIG.buildings[0].id, 'house-001');
  assert.equal(WORLD_CONFIG.buildings[0].height, 13.4);
  assert.deepEqual(WORLD_CONFIG.buildings[0].architecture.floorLevels, [0, 3.30, 5.77, 8.28, 11.95]);
  assert.deepEqual(WORLD_CONFIG.streetProps, []);
  assert.deepEqual(WORLD_CONFIG.trees, []);
  assert.deepEqual(WORLD_CONFIG.vehicles, []);
  assert.deepEqual(WORLD_CONFIG.pedestrians, []);
  assert.ok(WORLD_CONFIG.street.road.size[0] > WORLD_CONFIG.street.road.size[1]);
  assert.ok(WORLD_CONFIG.street.sidewalk.width > 0);
  const spawnZ = WORLD_CONFIG.spawn.position[2];
  assert.ok(Math.abs(Math.abs(spawnZ) - WORLD_CONFIG.street.sidewalk.z) < WORLD_CONFIG.street.sidewalk.depth / 2 - 0.3,
    'player must spawn on the same-side sidewalk, not in a traffic lane');
  assert.ok(spawnZ * WORLD_CONFIG.buildings[0].position[2] > 0,
    'player spawn and reference house entrance must share the same street side');
  assert.ok(Math.abs(spawnZ) > WORLD_CONFIG.street.road.size[1] / 2,
    'player spawn must stay outside the road surface');
  assert.equal(WORLD_CONFIG.street.crosswalks, undefined,
    'a zebra crossing must not appear without a junction');
  assert.equal(WORLD_CONFIG.street.laneMarkings, undefined,
    'the calm local road must not have arbitrary lane dashes');
  assert.equal(WORLD_CONFIG.street.manhole, undefined);
});

test('settlement hierarchy is unique and grows from district to rooms', () => {
  assert.deepEqual(validateWorldHierarchy(WORLD_CONFIG.hierarchy, WORLD_CONFIG.buildings), []);
  assert.equal(assertValidWorldHierarchy(WORLD_CONFIG.hierarchy, WORLD_CONFIG.buildings), true);
  const nodes = flattenWorldHierarchy(WORLD_CONFIG.hierarchy);
  assert.ok(nodes.some((node) => node.type === 'street'));
  assert.ok(nodes.some((node) => node.type === 'parcel'));
  assert.ok(nodes.some((node) => node.type === 'building' && node.id === 'house-001'));
  assert.equal(nodes.filter((node) => node.type === 'storey').length, 4);
  assert.ok(nodes.some((node) => node.type === 'stairwell'));
  assert.ok(nodes.some((node) => node.type === 'room'));
});

test('hierarchy rejects duplicate IDs and orphaned building definitions', () => {
  const invalid = structuredClone(WORLD_CONFIG.hierarchy);
  invalid.children[0].children[0].children[0].children[1].children[0].id = 'house-001-stairwell';
  assert.ok(validateWorldHierarchy(invalid, WORLD_CONFIG.buildings).some((error) => error.includes('Duplicate hierarchy ID')));
  assert.ok(validateWorldHierarchy(invalid, []).some((error) => error.includes('no matching building definition')));
});

test('runtime validates the authored settlement hierarchy before creating scene objects', () => {
  assert.match(fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8'), /assertValidWorldHierarchy\(WORLD_CONFIG\.hierarchy, WORLD_CONFIG\.buildings\)/);
});
