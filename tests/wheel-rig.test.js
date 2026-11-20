import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachWheelPivot, spinWheel } from '../src/vehicles/wheel-rig.js';

function boxCenter(object) {
  object.updateWorldMatrix(true, true);
  return new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
}

function assertVectorClose(actual, expected, epsilon = 1e-6) {
  assert.ok(actual.distanceTo(expected) <= epsilon,
    `expected ${actual.toArray()} to remain at ${expected.toArray()}`);
}

test('wheel pivot preserves an offset GLB mesh transform and keeps its center fixed while spinning', () => {
  const root = new THREE.Group();
  root.position.set(7, 0, -3);
  root.rotation.y = Math.PI / 2;
  root.scale.setScalar(1.8);

  const wheelNode = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.18, 24),
    new THREE.MeshBasicMaterial()
  );
  wheelNode.name = 'Pickup_FrontWheel_L';
  wheelNode.position.set(0, 0, 0);
  wheelNode.rotation.set(-Math.PI / 2, 0.13, 0);
  wheelNode.scale.setScalar(1.1);
  wheelNode.geometry.translate(1.25, 0.52, -1.65);
  root.add(wheelNode);

  const beforeCenter = boxCenter(wheelNode);
  const beforeMatrix = wheelNode.matrixWorld.clone();
  const beforePosition = wheelNode.getWorldPosition(new THREE.Vector3());
  const rig = attachWheelPivot(root, wheelNode, 0.32);

  assert.ok(rig);
  root.updateWorldMatrix(true, true);
  assertVectorClose(wheelNode.getWorldPosition(new THREE.Vector3()), beforePosition);
  assert.ok(wheelNode.matrixWorld.elements.every((value, index) =>
    Math.abs(value - beforeMatrix.elements[index]) < 1e-6
  ));

  const pivotCenter = rig.pivot.getWorldPosition(new THREE.Vector3());
  assertVectorClose(pivotCenter, beforeCenter);

  assert.equal(spinWheel(rig, Math.PI * 0.75), true);
  root.updateWorldMatrix(true, true);
  assertVectorClose(rig.pivot.getWorldPosition(new THREE.Vector3()), beforeCenter);
  assertVectorClose(boxCenter(wheelNode), beforeCenter);
});

test('wheel spin does not overwrite a baked pickup node quaternion', () => {
  const root = new THREE.Group();
  const wheelNode = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 18), new THREE.MeshBasicMaterial());
  wheelNode.name = 'BackWheels';
  wheelNode.rotation.x = -Math.PI / 2;
  wheelNode.geometry.translate(0.8, 0.4, 0.6);
  root.add(wheelNode);

  root.updateWorldMatrix(true, true);
  const beforeWorldQuaternion = wheelNode.getWorldQuaternion(new THREE.Quaternion());
  const rig = attachWheelPivot(root, wheelNode, 0.4);
  assert.ok(rig);
  spinWheel(rig, 1.25);

  root.updateWorldMatrix(true, true);
  const afterWheelQuaternion = wheelNode.getWorldQuaternion(new THREE.Quaternion());
  const expected = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 1.25)
    .multiply(beforeWorldQuaternion);
  assert.ok(afterWheelQuaternion.angleTo(expected) < 1e-6);
  assert.ok(Math.abs(wheelNode.rotation.x + Math.PI / 2) < 1e-6);
});

test('wheel rig rejects invalid inputs without mutating the vehicle', () => {
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  assert.equal(attachWheelPivot(root, mesh, 0), null);
  assert.equal(spinWheel(null, 1), false);
  assert.equal(spinWheel({ pivot: root }, Number.NaN), false);
});


function mergeIndexedGeometry(parts) {
  const positions = [];
  const indices = [];
  let vertexOffset = 0;
  for (const geometry of parts) {
    const attribute = geometry.getAttribute('position');
    for (let i = 0; i < attribute.count; i += 1) {
      positions.push(attribute.getX(i), attribute.getY(i), attribute.getZ(i));
    }
    for (const value of geometry.index.array) indices.push(value + vertexOffset);
    vertexOffset += attribute.count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setIndex(indices);
  merged.computeVertexNormals();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

test('merged vehicle geometry yields four original wheel rigs without duplicate overlay tyres', async () => {
  const { extractMergedWheelComponents } = await import('../src/vehicles/wheel-rig.js');
  const bodyGeometry = new THREE.BoxGeometry(4, 2, 6);
  bodyGeometry.translate(0, 1, 0);
  const parts = [bodyGeometry];
  for (const x of [-1.2, 1.2]) {
    for (const z of [-1.8, 1.8]) {
      const tyre = new THREE.CylinderGeometry(0.4, 0.4, 0.2, 16);
      tyre.rotateZ(Math.PI / 2);
      tyre.translate(x, 0.4, z);
      const rim = new THREE.CylinderGeometry(0.24, 0.24, 0.08, 16);
      rim.rotateZ(Math.PI / 2);
      rim.translate(x, 0.4, z);
      parts.push(tyre, rim);
    }
  }

  const root = new THREE.Group();
  root.position.set(4, 0, -2);
  root.rotation.y = Math.PI / 2;
  root.scale.setScalar(1.5);
  const body = new THREE.Mesh(mergeIndexedGeometry(parts), new THREE.MeshBasicMaterial());
  root.add(body);
  root.updateWorldMatrix(true, true);

  const originalTriangles = body.geometry.index.count / 3;
  const wheels = extractMergedWheelComponents(root, body);
  assert.equal(wheels.length, 4);
  assert.ok(body.geometry.index.count / 3 < originalTriangles);
  assert.equal(root.children.filter((child) => child.name.startsWith('extracted-wheel-')).length, 0);
  assert.equal(root.children.filter((child) => child.name.includes('spin-pivot')).length, 4);

  const centers = wheels.map((wheel) => wheel.pivot.getWorldPosition(new THREE.Vector3()));
  for (const wheel of wheels) {
    assert.ok(wheel.radius > 0.3);
    assert.ok(spinWheel(wheel, Math.PI / 2));
  }
  root.updateWorldMatrix(true, true);
  wheels.forEach((wheel, index) => {
    assertVectorClose(wheel.pivot.getWorldPosition(new THREE.Vector3()), centers[index]);
  });
});


const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetManifest = JSON.parse(fs.readFileSync(
  path.join(repositoryRoot, 'public', 'models', 'manifest.json'),
  'utf8'
));

function loadIndexedGlbGeometry(assetKey) {
  const file = fs.readFileSync(path.join(repositoryRoot, 'public', 'models', assetManifest[assetKey]));
  assert.equal(file.toString('ascii', 0, 4), 'glTF');
  const jsonLength = file.readUInt32LE(12);
  const json = JSON.parse(file.toString('utf8', 20, 20 + jsonLength).trim());
  const binaryStart = 20 + jsonLength + 8;
  const positionAccessor = json.accessors[json.meshes[0].primitives[0].attributes.POSITION];
  const indexAccessor = json.accessors[json.meshes[0].primitives[0].indices];
  const positionView = json.bufferViews[positionAccessor.bufferView];
  const indexView = json.bufferViews[indexAccessor.bufferView];
  const positionOffset = (positionView.byteOffset || 0) + (positionAccessor.byteOffset || 0);
  const indexOffset = (indexView.byteOffset || 0) + (indexAccessor.byteOffset || 0);
  const positionStride = positionView.byteStride || 12;
  const positionData = new Float32Array(positionAccessor.count * 3);

  for (let i = 0; i < positionAccessor.count; i += 1) {
    const offset = binaryStart + positionOffset + i * positionStride;
    positionData[i * 3] = file.readFloatLE(offset);
    positionData[i * 3 + 1] = file.readFloatLE(offset + 4);
    positionData[i * 3 + 2] = file.readFloatLE(offset + 8);
  }

  const indexBytes = indexAccessor.componentType === 5123 ? 2 : 4;
  const indices = new Uint32Array(indexAccessor.count);
  for (let i = 0; i < indexAccessor.count; i += 1) {
    const offset = binaryStart + indexOffset + i * indexBytes;
    indices[i] = indexBytes === 2 ? file.readUInt16LE(offset) : file.readUInt32LE(offset);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positionData, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

test('real Van and Bus GLBs expose four original wheel groups at measured positions and radii', () => {
  const cases = [
    { asset: 'Van', height: 1.55, expectedRadius: 0.344 },
    { asset: 'Bus', height: 3.05, expectedRadius: 0.436 }
  ];

  for (const spec of cases) {
    const geometry = loadIndexedGlbGeometry(spec.asset);
    const originalTriangleCount = geometry.index.count / 3;
    const root = new THREE.Group();
    root.position.set(3, 0, -4);
    root.rotation.y = Math.PI / 2;
    root.scale.setScalar(spec.height / geometry.boundingBox.getSize(new THREE.Vector3()).y);
    const body = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    root.add(body);
    root.updateWorldMatrix(true, true);

    const wheels = extractMergedWheelComponents(root, body);
    assert.equal(wheels.length, 4, spec.asset);
    assert.ok(body.geometry.index.count / 3 < originalTriangleCount, spec.asset);

    const centers = wheels.map((wheel) => wheel.pivot.getWorldPosition(new THREE.Vector3()));
    for (const wheel of wheels) {
      assert.ok(Math.abs(wheel.radius - spec.expectedRadius) < 0.015,
        `${spec.asset} radius ${wheel.radius}`);
      assert.ok(wheel.pivot.getWorldPosition(new THREE.Vector3()).y > 0.2);
      assert.equal(spinWheel(wheel, Math.PI * 0.5), true);
    }

    root.updateWorldMatrix(true, true);
    wheels.forEach((wheel, index) => {
      assertVectorClose(wheel.pivot.getWorldPosition(new THREE.Vector3()), centers[index]);
    });
  }
});
