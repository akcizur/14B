import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the root experience is one open Free Play sandbox', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

  assert.ok(html.includes('<h1>DISTRICT <span>14</span></h1>'));
  assert.doesNotMatch(html, /city-courier|City Courier/i);
  assert.doesNotMatch(readme, /city-courier|City Courier/i);
  assert.match(readme, /Free Play \/ Sandbox/i);
  assert.match(main, /PointerLockControls/);
  assert.match(main, /function enterHouse/);
  assert.match(main, /function exitHouse/);
});

test('player movement is normalized and swept through the collision world', () => {
  const source = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
  assert.match(source, /normalizeMovement\(forwardInput, strafeInput\)/);
  assert.match(source, /getMovingActorColliders\(\)/);
  assert.match(source, /addObjectCollider\(root/);
  assert.match(source, /trunk-/);
});

test('house and pedestrian interactions are selected by proximity, not reticle aim', () => {
  const source = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
  assert.match(source, /findNearestByDistance\(camera\.position, available, 3\.2/);
  assert.match(source, /function nearestPedestrian\(\)/);
  assert.match(source, /walker\.interaction\.radius/);
  assert.match(source, /function openNpcDialog\(walker\)/);
  assert.doesNotMatch(source, /isInInteractionRange\(camera\.position, target, forward/);
});


test('fallback vehicle wheels are positioned in normalized root-local space', () => {
  const source = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
  assert.match(source, /worldSize\.x \/ scaleX/);
  assert.match(source, /worldCenter\.x - root\.position\.x/);
  assert.match(source, /localBounds\.min\.y - root\.position\.y\) \/ scaleY/);
  assert.match(source, /createFallbackVehicleWheels\(root, height\)/);
});
