import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modelDir = path.join(root, 'public', 'models');
const manifest = JSON.parse(fs.readFileSync(path.join(modelDir, 'manifest.json'), 'utf8'));

test('the supplied asset manifest contains all 68 selected GLB models', () => {
  assert.equal(Object.keys(manifest).length, 68);
});

test('every manifest model exists and has a valid GLB 2.0 container', () => {
  for (const [name, file] of Object.entries(manifest)) {
    const absolute = path.join(modelDir, file);
    assert.ok(fs.existsSync(absolute), `${name} is missing (${file})`);
    const buffer = fs.readFileSync(absolute);
    assert.equal(buffer.toString('ascii', 0, 4), 'glTF', `${name} has no GLB magic`);
    assert.equal(buffer.readUInt32LE(4), 2, `${name} is not GLB version 2`);
    assert.equal(buffer.readUInt32LE(8), buffer.length, `${name} has an invalid GLB byte length`);
    const jsonLength = buffer.readUInt32LE(12);
    assert.equal(buffer.toString('ascii', 16, 20), 'JSON', `${name} has no JSON chunk`);
    assert.doesNotThrow(() => JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength)), `${name} has invalid glTF JSON`);
  }
});

test('all runtime asset references resolve to supplied models', () => {
  const source = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
  const references = new Set();
  const patterns = [
    /(?:createAsset|loadGLTF|addAnimatedActor)\(\s*['"]([^'"]+)['"]/g,
    /\badd\(\s*['"]([^'"]+)['"]\s*,\s*(?:null|\d)/g,
    /\[['"]([^'"]+)['"]\s*,\s*\d/g
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) references.add(match[1]);
  }
  for (const name of references) assert.ok(manifest[name], `Runtime references missing model: ${name}`);
});

test('the remake retains FPS input, house transitions and animated model support', () => {
  const source = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
  assert.match(source, /PointerLockControls/);
  assert.match(source, /GLTFLoader/);
  assert.match(source, /AnimationMixer/);
  assert.match(source, /function enterHouse/);
  assert.match(source, /function exitHouse/);
  assert.match(source, /event\.code === 'KeyE'/);
});
