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
  assert.equal(gltf.meshes?.length, 1, 'the supplied GLB packs the entire building into one mesh');
  assert.equal(gltf.meshes[0].primitives.length, 7, 'the building mesh uses seven material groups');
  assert.ok(gltf.nodes?.some((node) => Number.isInteger(node.mesh)));
});

test('reference GLB glass bounds span the ground and upper facade', () => {
  const gltf = readGlbJson(assetPath);
  const materialIndex = gltf.materials.findIndex((material) => material.name === 'window_glass');
  assert.ok(materialIndex >= 0);
  const glassPrimitive = (gltf.meshes || []).flatMap((mesh) => mesh.primitives || [])
    .find((primitive) => primitive.material === materialIndex);
  assert.ok(glassPrimitive);
  const accessor = gltf.accessors?.[glassPrimitive.attributes?.POSITION];
  assert.ok(accessor?.min && accessor?.max);
  const meshNode = gltf.nodes.find((node) => node.mesh === gltf.meshes.indexOf(
    gltf.meshes.find((mesh) => mesh.primitives.includes(glassPrimitive))
  ));
  assert.ok(meshNode?.scale, 'the GLB must retain the authored mesh transform');
  const scale = Math.max(...meshNode.scale);
  // The source node is rotated 90 degrees around X: source Z is facade height.
  assert.ok((accessor.max[2] - accessor.min[2]) * scale > 2.5,
    'the transformed glass geometry must span several storey bands');
  assert.ok((accessor.max[0] - accessor.min[0]) * scale > 1.8,
    'the transformed glass geometry must include separated facade windows');
});
