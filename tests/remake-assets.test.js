import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modelDir = path.join(root, 'public', 'models');
const manifest = JSON.parse(fs.readFileSync(path.join(modelDir, 'manifest.json'), 'utf8'));

test('the remake ships all 68 selected GLB models', () => {
  assert.equal(Object.keys(manifest).length, 68);
});

test('every manifest entry is a complete GLB 2.0 file', () => {
  for (const [name, file] of Object.entries(manifest)) {
    const absolute = path.join(modelDir, file);
    assert.ok(fs.existsSync(absolute), `${name} is missing`);
    const bytes = fs.readFileSync(absolute);
    assert.equal(bytes.toString('ascii', 0, 4), 'glTF', `${name} has no GLB header`);
    assert.equal(bytes.readUInt32LE(4), 2, `${name} is not GLB 2.0`);
    assert.equal(bytes.readUInt32LE(8), bytes.length, `${name} has an invalid byte length`);
    const jsonLength = bytes.readUInt32LE(12);
    assert.equal(bytes.toString('ascii', 16, 20), 'JSON', `${name} has no JSON chunk`);
    assert.doesNotThrow(() => JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength)), `${name} has invalid JSON`);
  }
});

test('all hard-coded model keys used by the scene exist in the manifest', () => {
  const source = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
  const keys = [
    'Building Green', 'Building Red', 'Building Red Corner', 'Brown Building', 'Big Building', 'Small Building',
    'Car', 'SUV', 'Pickup Truck', 'Police Car', 'Van', 'Bus', 'Man', 'Animated Woman', 'Adventurer',
    'Bench', 'Mailbox', 'Traffic Light', 'Manhole Cover', 'Planter & Bushes', 'Tree', 'Stop sign', 'Fire hydrant',
    'Trash Can', 'Fence', 'Bus Stop', 'Bus stop sign', 'Greenhouse', 'Dumpster', 'Air conditioner', 'Washing Line',
    'Bed King', 'Bathtub', 'Bathroom Sink', 'Toilet', 'Couch Large', 'Kitchen Fridge', 'Kitchen Sink', 'Oven',
    'Chair', 'Table Round Large', 'Shelf Large', 'Houseplant', 'Curtains Double', 'Ceiling Light', 'Washing Machine',
    'Night Stand', 'Rug', 'Fireplace', 'Door', 'Cactus', 'Toilet Paper stack', 'Towel Rack', 'Stool', 'Table Lamp',
    'Window Large', 'Window Small'
  ];
  for (const key of keys) assert.ok(manifest[key], `Missing model key: ${key}`);
});

test('the root experience exposes City Courier without replacing the remake', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
  assert.ok(html.includes('<h1>DISTRICT <span>14</span></h1>'));
  assert.match(html, /href="\.\/city-courier\/"/);
  assert.match(main, /PointerLockControls/);
  assert.match(main, /function enterHouse/);
  assert.match(main, /function exitHouse/);
});
