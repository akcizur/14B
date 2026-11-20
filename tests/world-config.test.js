import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORLD_CONFIG } from '../src/world/world-config.js';
import { assertValidWorldConfig, validateWorldConfig } from '../src/world/world-validation.js';

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
  invalid.streetProps[0].id = invalid.buildings[0].id;
  invalid.streetProps[0].asset = 'Missing Model';
  invalid.streetProps[0].position = [500, 0, 500];
  invalid.streetProps[0].collision = { type: 'bounds', scale: -1, minSize: 0 };
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
