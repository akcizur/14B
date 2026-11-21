import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetPath = path.join(root, 'public', 'models', 'building-green.glb');

function readGlbJson(filePath) {
  const bytes = fs.readFileSync(filePath);
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'asset must be a GLB binary');
  assert.equal(bytes.readUInt32LE(4), 2, 'asset must use GLB 2.0');
  const jsonLength = bytes.readUInt32LE(12);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a, 'first GLB chunk must be JSON');
  return JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8').trim());
}

test('reference GLB exposes distinct shell, glazing and entrance materials', () => {
  const gltf = readGlbJson(assetPath);
  const names = new Set((gltf.materials || []).map((material) => material.name));
  assert.ok(names.has('brick_shadeGreen'));
  assert.ok(names.has('window_glass'));
  assert.ok(names.has('door_white'));
  assert.ok(gltf.meshes?.length >= 3);
  assert.ok(gltf.nodes?.some((node) => Number.isInteger(node.mesh)));
});

test('reference GLB has enough vertical glazing rows for the four-level datum', () => {
  const gltf = readGlbJson(assetPath);
  const materialIndex = gltf.materials.findIndex((material) => material.name === 'window_glass');
  assert.ok(materialIndex >= 0);
  const glassMeshes = (gltf.meshes || []).filter((mesh) =>
    (mesh.primitives || []).some((primitive) => primitive.material === materialIndex)
  );
  assert.ok(glassMeshes.length > 0);
  const positions = glassMeshes.flatMap((mesh) => (mesh.primitives || [])
    .filter((primitive) => primitive.material === materialIndex)
    .map((primitive) => primitive.attributes?.POSITION)
  ).filter(Number.isInteger);
  assert.ok(positions.length > 0, 'glazing primitives must reference vertex positions');
  const rows = new Set();
  for (const accessorIndex of positions) {
    const accessor = gltf.accessors?.[accessorIndex];
    if (!accessor?.min || !accessor?.max) continue;
    const centreY = (accessor.min[1] + accessor.max[1]) / 2;
    rows.add(Math.round(centreY * 100) / 100);
  }
  assert.ok(rows.size >= 2, 'glazing must contain separate vertical facade bands');
});
