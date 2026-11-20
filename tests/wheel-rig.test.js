import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
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
  const parts = [new THREE.BoxGeometry(4, 2, 6)];
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
