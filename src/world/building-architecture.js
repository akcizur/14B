import * as THREE from 'three';

const EPSILON = 1e-4;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function boxCorners(box) {
  const points = [];
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) points.push(new THREE.Vector3(x, y, z));
    }
  }
  return points;
}

/**
 * Measures a model in its own horizontal frame, but in world metres.
 * Translation and rotation are removed; normalization scale is preserved.
 */
export function measureBuildingBounds(buildingRoot) {
  buildingRoot.updateWorldMatrix(true, true);
  const origin = buildingRoot.getWorldPosition(new THREE.Vector3());
  const orientation = buildingRoot.getWorldQuaternion(new THREE.Quaternion());
  const rigid = new THREE.Matrix4().compose(origin, orientation, new THREE.Vector3(1, 1, 1));
  const inverseRigid = rigid.invert();
  const bounds = new THREE.Box3();

  buildingRoot.traverse((object) => {
    if (!object.isMesh || !object.geometry) return;
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    const sourceBounds = object.geometry.boundingBox;
    if (!sourceBounds || sourceBounds.isEmpty()) return;
    const toBuildingFrame = new THREE.Matrix4().multiplyMatrices(inverseRigid, object.matrixWorld);
    for (const point of boxCorners(sourceBounds)) bounds.expandByPoint(point.applyMatrix4(toBuildingFrame));
  });

  if (bounds.isEmpty()) throw new Error(`Building "${buildingRoot.name}" has no measurable mesh bounds.`);
  return {
    minX: bounds.min.x, maxX: bounds.max.x,
    minY: bounds.min.y, maxY: bounds.max.y,
    minZ: bounds.min.z, maxZ: bounds.max.z
  };
}

export function measureFacadeOpenings(buildingRoot, measuredBounds = measureBuildingBounds(buildingRoot)) {
  buildingRoot.updateWorldMatrix(true, true);
  const origin = buildingRoot.getWorldPosition(new THREE.Vector3());
  const orientation = buildingRoot.getWorldQuaternion(new THREE.Quaternion());
  const inverseRigid = new THREE.Matrix4()
    .compose(origin, orientation, new THREE.Vector3(1, 1, 1))
    .invert();
  const candidates = [];

  buildingRoot.traverse((object) => {
    if (!object.isMesh || !object.geometry) return;
    const labels = [];
    let parent = object;
    while (parent && parent !== buildingRoot.parent) {
      if (parent.name) labels.push(parent.name);
      parent = parent.parent;
      if (parent === buildingRoot.parent) break;
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) if (material?.name) labels.push(material.name);
    if (!/(window|glass|glazing|fenster)/i.test(labels.join(' '))) return;

    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    const source = object.geometry.boundingBox;
    if (!source || source.isEmpty()) return;
    const transform = new THREE.Matrix4().multiplyMatrices(inverseRigid, object.matrixWorld);
    const local = new THREE.Box3();
    for (const point of boxCorners(source)) local.expandByPoint(point.applyMatrix4(transform));
    const size = local.getSize(new THREE.Vector3());
    if (size.y < 0.35 || Math.max(size.x, size.z) < 0.3) return;

    const center = local.getCenter(new THREE.Vector3());
    const distances = [
      ['front', Math.abs(measuredBounds.maxZ - center.z)],
      ['back', Math.abs(center.z - measuredBounds.minZ)],
      ['left', Math.abs(center.x - measuredBounds.minX)],
      ['right', Math.abs(measuredBounds.maxX - center.x)]
    ].sort((a, b) => a[1] - b[1]);
    const [side, distanceToFacade] = distances[0];
    if (distanceToFacade > 0.65) return;

    candidates.push({
      side,
      minX: local.min.x, maxX: local.max.x,
      minY: local.min.y, maxY: local.max.y,
      minZ: local.min.z, maxZ: local.max.z,
      centerX: center.x,
      centerY: center.y,
      centerZ: center.z
    });
  });

  // A framed window can be split into glass, rails and mullions. Merge pieces
  // that belong to the same physical aperture before creating the interior.
  const merged = [];
  for (const item of candidates.sort((a, b) => a.side.localeCompare(b.side) || a.centerY - b.centerY || a.centerX - b.centerX)) {
    const existing = merged.find((candidate) =>
      candidate.side === item.side &&
      Math.abs(candidate.centerX - item.centerX) < 0.42 &&
      Math.abs(candidate.centerY - item.centerY) < 0.42 &&
      Math.abs(candidate.centerZ - item.centerZ) < 0.42
    );
    if (!existing) {
      merged.push({ ...item });
      continue;
    }
    existing.minX = Math.min(existing.minX, item.minX);
    existing.maxX = Math.max(existing.maxX, item.maxX);
    existing.minY = Math.min(existing.minY, item.minY);
    existing.maxY = Math.max(existing.maxY, item.maxY);
    existing.minZ = Math.min(existing.minZ, item.minZ);
    existing.maxZ = Math.max(existing.maxZ, item.maxZ);
    existing.centerX = (existing.minX + existing.maxX) / 2;
    existing.centerY = (existing.minY + existing.maxY) / 2;
    existing.centerZ = (existing.minZ + existing.maxZ) / 2;
  }

  return merged.map((item) => ({
    side: item.side,
    center: item.side === 'front' || item.side === 'back' ? item.centerX : item.centerZ,
    sill: item.minY - measuredBounds.minY,
    width: item.side === 'front' || item.side === 'back'
      ? item.maxX - item.minX
      : item.maxZ - item.minZ,
    height: item.maxY - item.minY,
    centerY: item.centerY - measuredBounds.minY
  })).filter((item) => item.width >= 0.45 && item.height >= 0.45);
}

export function deriveInteriorPlan(bounds, architecture = {}, frontSide = 1) {
  const values = [bounds?.minX, bounds?.maxX, bounds?.minY, bounds?.maxY, bounds?.minZ, bounds?.maxZ];
  if (!values.every(Number.isFinite) ||
      bounds.maxX - bounds.minX < 3.8 ||
      bounds.maxZ - bounds.minZ < 3.8 ||
      bounds.maxY - bounds.minY < 5.8) {
    throw new Error('Building bounds are too small or invalid for a multi-storey interior.');
  }

  if (![-1, 1].includes(frontSide)) throw new Error('Building frontSide must be -1 or 1.');
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const height = bounds.maxY - bounds.minY;
  const storeys = clamp(Math.floor(architecture.storeys ?? 3), 2, 5);
  const wall = clamp(architecture.wallThickness ?? 0.18, 0.14, 0.28);
  const slab = clamp(architecture.slabThickness ?? 0.16, 0.12, 0.22);
  const floorHeight = Math.min(architecture.maxFloorHeight ?? 3.2, (height - slab * 1.5) / storeys);
  if (floorHeight < 2.55) throw new Error('Building is too short for the requested storey count.');

  const inner = {
    minX: bounds.minX + wall,
    maxX: bounds.maxX - wall,
    minZ: bounds.minZ + wall,
    maxZ: bounds.maxZ - wall
  };
  const innerWidth = inner.maxX - inner.minX;
  const innerDepth = inner.maxZ - inner.minZ;
  const flightWidth = Math.min(0.88, Math.max(0.72, (innerWidth - 1.05) / 2));
  const stairGap = 0.12;
  const stairWidth = flightWidth * 2 + stairGap;
  if (stairWidth + 1.25 > innerWidth) throw new Error('Building footprint cannot fit a safe stairwell and corridor.');

  const stairRun = Math.min(2.35, innerDepth * 0.52);
  const treadCount = 9;
  const treadDepth = stairRun / treadCount;
  const stairMinX = inner.minX + 0.12;
  const stairMaxX = stairMinX + stairWidth;
  const stairMinZ = inner.minZ + 0.2;
  const stairMaxZ = stairMinZ + stairRun;
  const landingDepth = Math.min(0.68, innerDepth - stairRun - 0.42);
  const stairOpening = {
    minX: stairMinX - 0.08,
    maxX: stairMaxX + 0.08,
    minZ: stairMinZ - 0.08,
    maxZ: stairMaxZ + landingDepth
  };
  const corridorWidth = 1.0;
  const corridorWallX = Math.min(stairMaxX + corridorWidth, inner.maxX - 1.2);
  const entryX = clamp(corridorWallX - corridorWidth / 2,
    inner.minX + 0.85, inner.maxX - 0.85);
  const windowWidth = clamp(width * 0.16, 0.9, 1.35);
  const windowHeight = clamp(floorHeight * 0.39, 1.05, 1.3);
  const windowSill = clamp(floorHeight * 0.29, 0.82, 1.0);

  return {
    bounds: { ...bounds },
    baseY: bounds.minY,
    topY: bounds.minY + floorHeight * storeys,
    storeys,
    width,
    depth,
    height,
    wall,
    slab,
    floorHeight,
    inner,
    innerWidth,
    innerDepth,
    stair: {
      minX: stairMinX, maxX: stairMaxX,
      minZ: stairMinZ, maxZ: stairMaxZ,
      width: stairWidth,
      flightWidth,
      gap: stairGap,
      treadCount,
      treadDepth,
      rise: floorHeight / (treadCount * 2),
      landingDepth,
      opening: stairOpening,
      laneOneX: stairMinX + flightWidth / 2,
      laneTwoX: stairMinX + flightWidth + stairGap + flightWidth / 2
    },
    corridorWidth,
    corridorWallX,
    entryX,
    entryZ: frontSide > 0 ? inner.maxZ - 0.72 : inner.minZ + 0.72,
    doorWidth: clamp(width * 0.14, 0.92, 1.12),
    doorHeight: Math.min(2.18, floorHeight - 0.55),
    windowWidth,
    windowHeight,
    windowSill,
    walkBounds: {
      minX: inner.minX + 0.16,
      maxX: inner.maxX - 0.16,
      minZ: inner.minZ + 0.16,
      maxZ: inner.maxZ - 0.16
    }
  };
}

export function getInteriorWalkHeight(plan, x, z, currentFeetY = plan.baseY) {
  const { stair } = plan;
  const currentLevel = clamp(Math.round((currentFeetY - plan.baseY) / plan.floorHeight), 0, plan.storeys - 1);
  const inStairDepth = z >= stair.minZ - 0.18 && z <= stair.maxZ + stair.landingDepth;
  const inLaneOne = Math.abs(x - stair.laneOneX) <= stair.flightWidth / 2 - 0.04 &&
    z >= stair.minZ && z <= stair.maxZ;
  const inLaneTwo = Math.abs(x - stair.laneTwoX) <= stair.flightWidth / 2 - 0.04 &&
    z >= stair.minZ && z <= stair.maxZ;

  if (inLaneOne && plan.storeys > 1) {
    const level = clamp(Math.floor((currentFeetY - plan.baseY + plan.floorHeight * 0.49) / plan.floorHeight), 0, plan.storeys - 2);
    const t = clamp((z - stair.minZ) / (stair.maxZ - stair.minZ), 0, 1);
    return plan.baseY + level * plan.floorHeight + t * plan.floorHeight * 0.5;
  }
  if (inLaneTwo && plan.storeys > 1) {
    const level = clamp(Math.floor((currentFeetY - plan.baseY + EPSILON) / plan.floorHeight), 0, plan.storeys - 2);
    const t = clamp((z - stair.minZ) / (stair.maxZ - stair.minZ), 0, 1);
    return plan.baseY + level * plan.floorHeight + plan.floorHeight * (1 - t * 0.5);
  }
  if (inStairDepth && x > stair.minX - 0.05 && x < stair.maxX + 0.05 &&
      z > stair.maxZ - 0.15 && z <= stair.maxZ + stair.landingDepth) {
    const lowerLevel = clamp(Math.floor((currentFeetY - plan.baseY) / plan.floorHeight), 0, plan.storeys - 2);
    return plan.baseY + lowerLevel * plan.floorHeight + plan.floorHeight * 0.5;
  }
  return plan.baseY + currentLevel * plan.floorHeight;
}

export function isInteriorPositionWalkable(plan, x, z, currentFeetY = plan.baseY, radius = 0.3) {
  const bounds = plan.walkBounds;
  if (x < bounds.minX + radius || x > bounds.maxX - radius ||
      z < bounds.minZ + radius || z > bounds.maxZ - radius) return false;

  const level = Math.round((currentFeetY - plan.baseY) / plan.floorHeight);
  if (level <= 0) return true;

  const opening = plan.stair.opening;
  const insideOpening = x >= opening.minX && x <= opening.maxX &&
    z >= opening.minZ && z <= opening.maxZ;
  if (!insideOpening) return true;

  const stair = plan.stair;
  const onFlight = (
    Math.abs(x - stair.laneOneX) <= stair.flightWidth / 2 - radius * 0.65 ||
    Math.abs(x - stair.laneTwoX) <= stair.flightWidth / 2 - radius * 0.65
  ) && z >= stair.minZ - 0.08 && z <= stair.maxZ + 0.08;
  const onLanding = z > stair.maxZ - 0.16 && z <= stair.maxZ + stair.landingDepth &&
    x >= stair.minX - 0.08 && x <= stair.maxX + 0.08;
  return onFlight || onLanding;
}

function addBox(parent, name, x, bottomY, z, sx, sy, sz, material, colliders = null) {
  if (sx <= EPSILON || sy <= EPSILON || sz <= EPSILON) return null;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  mesh.name = name;
  mesh.position.set(x, bottomY + sy / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  if (colliders) colliders.push(mesh);
  return mesh;
}

function addWallSection(parent, axis, name, coordinate, start, end, bottom, height, thickness, material, colliders = null) {
  if (end - start <= EPSILON || height <= EPSILON) return;
  const center = (start + end) / 2;
  if (axis === 'x') {
    addBox(parent, name, center, bottom, coordinate, end - start, height, thickness, material, colliders);
  } else {
    addBox(parent, name, coordinate, bottom, center, thickness, height, end - start, material, colliders);
  }
}

function addWindow(parent, axis, name, coordinate, center, width, bottom, height, thickness, glass, frame) {
  const depth = Math.max(0.025, thickness * 0.2);
  const frameSize = 0.055;
  const addFrame = (part, x, y, z, sx, sy, sz) => addBox(parent, `${name}-frame-${part}`, x, y, z, sx, sy, sz, frame);
  if (axis === 'x') {
    addBox(parent, `${name}-glass`, center, bottom + 0.045, coordinate, width - 0.09,
      Math.max(0.2, height - 0.09), depth, glass, null);
    addFrame('left', center - width / 2, bottom, coordinate, frameSize, height, thickness * 0.72);
    addFrame('right', center + width / 2, bottom, coordinate, frameSize, height, thickness * 0.72);
    addFrame('bottom', center, bottom, coordinate, width, frameSize, thickness * 0.72);
    addFrame('top', center, bottom + height - frameSize, coordinate, width, frameSize, thickness * 0.72);
    addFrame('mullion', center, bottom, coordinate, frameSize * 0.72, height, thickness * 0.72);
  } else {
    addBox(parent, `${name}-glass`, coordinate, bottom + 0.045, center, depth,
      Math.max(0.2, height - 0.09), width - 0.09, glass, null);
    addFrame('left', coordinate, bottom, center - width / 2, thickness * 0.72, height, frameSize);
    addFrame('right', coordinate, bottom, center + width / 2, thickness * 0.72, height, frameSize);
    addFrame('bottom', coordinate, bottom, center, thickness * 0.72, frameSize, width);
    addFrame('top', coordinate, bottom + height - frameSize, center, thickness * 0.72, frameSize, width);
    addFrame('mullion', coordinate, bottom, center, thickness * 0.72, height, frameSize * 0.72);
  }
}

function buildWallWithOpenings(parent, options) {
  const { axis, name, coordinate, start, end, floorY, height, thickness, material, frame, glass, openings = [], colliders = null } = options;
  const sorted = openings.map((opening) => ({
    ...opening,
    start: clamp(opening.center - opening.width / 2, start, end),
    end: clamp(opening.center + opening.width / 2, start, end)
  })).filter((opening) => opening.end - opening.start > EPSILON)
    .sort((a, b) => a.start - b.start);
  let cursor = start;
  let index = 0;

  for (const opening of sorted) {
    if (opening.start < cursor + EPSILON) continue;
    addWallSection(parent, axis, `${name}-solid-${index++}`, coordinate, cursor, opening.start,
      floorY, height, thickness, material, colliders);
    if (opening.sill > 0) {
      addWallSection(parent, axis, `${name}-sill-${index++}`, coordinate, opening.start, opening.end,
        floorY, opening.sill, thickness, material, colliders);
    }
    const openingTop = opening.sill + opening.height;
    if (openingTop < height) {
      addWallSection(parent, axis, `${name}-lintel-${index++}`, coordinate, opening.start, opening.end,
        floorY + openingTop, height - openingTop, thickness, material, colliders);
    }
    if (opening.kind === 'window') {
      addWindow(parent, axis, `${name}-window-${index}`, coordinate, opening.center,
        opening.width, floorY + opening.sill, opening.height, thickness, glass, frame);
    } else {
      const frameSize = 0.065;
      if (axis === 'x') {
        addBox(parent, `${name}-door-frame-left`, opening.start, floorY, coordinate, frameSize,
          opening.height, thickness * 0.75, frame);
        addBox(parent, `${name}-door-frame-right`, opening.end, floorY, coordinate, frameSize,
          opening.height, thickness * 0.75, frame);
        addBox(parent, `${name}-door-frame-top`, opening.center, floorY + opening.height - frameSize,
          coordinate, opening.width, frameSize, thickness * 0.75, frame);
      } else {
        addBox(parent, `${name}-door-frame-left`, coordinate, floorY, opening.start,
          thickness * 0.75, opening.height, frameSize, frame);
        addBox(parent, `${name}-door-frame-right`, coordinate, floorY, opening.end,
          thickness * 0.75, opening.height, frameSize, frame);
        addBox(parent, `${name}-door-frame-top`, coordinate, floorY + opening.height - frameSize,
          opening.center, thickness * 0.75, frameSize, opening.width, frame);
      }
    }
    cursor = opening.end;
  }
  addWallSection(parent, axis, `${name}-solid-end`, coordinate, cursor, end,
    floorY, height, thickness, material, colliders);
}

function addSlopedRail(parent, name, x, y1, z1, y2, z2, material) {
  const dy = y2 - y1;
  const dz = z2 - z1;
  const length = Math.hypot(dy, dz);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.065, length, 0.065), material);
  rail.name = name;
  rail.position.set(x, (y1 + y2) / 2, (z1 + z2) / 2);
  rail.rotation.x = Math.atan2(dz, dy);
  rail.castShadow = true;
  parent.add(rail);
}

function addFloorWithStairOpening(parent, plan, name, y, material, leaveOpening) {
  const { inner, slab } = plan;
  const opening = plan.stair.opening;
  if (!leaveOpening) {
    addBox(parent, name, (inner.minX + inner.maxX) / 2, y - slab,
      (inner.minZ + inner.maxZ) / 2, plan.innerWidth, slab, plan.innerDepth, material);
    return;
  }
  const pieces = [
    { minX: inner.minX, maxX: opening.minX, minZ: inner.minZ, maxZ: inner.maxZ },
    { minX: opening.maxX, maxX: inner.maxX, minZ: inner.minZ, maxZ: inner.maxZ },
    { minX: opening.minX, maxX: opening.maxX, minZ: inner.minZ, maxZ: opening.minZ },
    { minX: opening.minX, maxX: opening.maxX, minZ: opening.maxZ, maxZ: inner.maxZ }
  ];
  for (const [index, piece] of pieces.entries()) {
    addBox(parent, `${name}-part-${index}`, (piece.minX + piece.maxX) / 2, y - slab,
      (piece.minZ + piece.maxZ) / 2, piece.maxX - piece.minX, slab,
      piece.maxZ - piece.minZ, material);
  }
}

function buildStairs(parent, plan, floorIndex, materials) {
  const { stair, floorHeight } = plan;
  const floorY = plan.baseY + floorIndex * floorHeight;
  const halfHeight = floorHeight / 2;
  const tread = stair.treadDepth;
  const count = stair.treadCount;
  for (let index = 0; index < count; index += 1) {
    const rise = (index + 1) * stair.rise;
    const zOne = stair.minZ + (index + 0.5) * tread;
    const zTwo = stair.maxZ - (index + 0.5) * tread;
    addBox(parent, `stair-${floorIndex}-flight-a-step-${index + 1}`, stair.laneOneX,
      floorY, zOne, stair.flightWidth, rise, tread - 0.012, materials.step);
    addBox(parent, `stair-${floorIndex}-flight-b-step-${index + 1}`, stair.laneTwoX,
      floorY + halfHeight, zTwo, stair.flightWidth, rise, tread - 0.012, materials.step);
  }

  addBox(parent, `stair-${floorIndex}-half-landing`, (stair.minX + stair.maxX) / 2,
    floorY + halfHeight, stair.maxZ + stair.landingDepth / 2 - 0.02,
    stair.width + 0.08, 0.12, stair.landingDepth + 0.04, materials.landing);

  const railHeight = 0.94;
  const startY = floorY + railHeight;
  const middleY = floorY + halfHeight + railHeight;
  const endY = floorY + floorHeight + railHeight;
  addSlopedRail(parent, `stair-${floorIndex}-rail-a`,
    stair.laneOneX - stair.flightWidth * 0.47, startY, stair.minZ,
    middleY, stair.maxZ, materials.rail);
  addSlopedRail(parent, `stair-${floorIndex}-rail-b`,
    stair.laneTwoX + stair.flightWidth * 0.47, middleY, stair.maxZ,
    endY, stair.minZ, materials.rail);
}

function buildFloorPartitions(parent, plan, level, materials, colliders) {
  const floorY = plan.baseY + level * plan.floorHeight;
  const height = plan.floorHeight - plan.slab;
  const inner = plan.inner;
  const stair = plan.stair;
  const corridorWall = plan.corridorWallX;
  if (corridorWall >= inner.maxX - 0.9) return;

  // A corridor connects the entrance and stair core to each room. Door openings
  // are built into the corridor wall so every room remains reachable.
  buildWallWithOpenings(parent, {
    axis: 'z',
    name: `level-${level}-corridor-wall`,
    coordinate: corridorWall,
    start: inner.minZ + 0.18,
    end: inner.maxZ - 0.18,
    floorY,
    height,
    thickness: 0.12,
    material: materials.partition,
    frame: materials.frame,
    glass: materials.glass,
    colliders,
    openings: [
      { kind: 'door', center: inner.minZ + plan.innerDepth * 0.28, width: 0.88, sill: 0, height: Math.min(2.12, height - 0.1) },
      { kind: 'door', center: inner.minZ + plan.innerDepth * 0.74, width: 0.88, sill: 0, height: Math.min(2.12, height - 0.1) }
    ]
  });

  const roomStart = corridorWall + 0.12;
  const roomWidth = inner.maxX - roomStart;
  if (roomWidth < 1.65 || plan.innerDepth < 3.9) return;

  const dividerZ = inner.minZ + plan.innerDepth * 0.53;
  const doorCenter = roomStart + Math.min(0.58, roomWidth * 0.28);
  const doorWidth = Math.min(0.92, roomWidth * 0.38);
  buildWallWithOpenings(parent, {
    axis: 'x',
    name: `level-${level}-room-divider`,
    coordinate: dividerZ,
    start: roomStart,
    end: inner.maxX,
    floorY,
    height,
    thickness: 0.12,
    material: materials.partition,
    frame: materials.frame,
    glass: materials.glass,
    colliders,
    openings: [{ kind: 'door', center: doorCenter, width: doorWidth, sill: 0, height: Math.min(2.12, height - 0.1) }]
  });

  // Keep the stair shaft clear at every storey.
}

export function buildBuildingInterior(buildingRoot, definition = {}) {
  const bounds = measureBuildingBounds(buildingRoot);
  const frontSide = definition.frontSide ?? 1;
  const plan = deriveInteriorPlan(bounds, definition.architecture || {}, frontSide);
  const facadeWindows = measureFacadeOpenings(buildingRoot, bounds);
  const origin = buildingRoot.getWorldPosition(new THREE.Vector3());
  const orientation = buildingRoot.getWorldQuaternion(new THREE.Quaternion());
  const interior = new THREE.Group();
  interior.name = `${definition.id || buildingRoot.name}-architectural-interior`;
  interior.position.copy(origin);
  interior.quaternion.copy(orientation);

  const materials = {
    floor: new THREE.MeshStandardMaterial({ color: 0x777a75, roughness: 0.92 }),
    wall: new THREE.MeshStandardMaterial({ color: 0xc7c5bd, roughness: 0.91 }),
    partition: new THREE.MeshStandardMaterial({ color: 0xb8b7ae, roughness: 0.92 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x454d4b, roughness: 0.56, metalness: 0.28 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x91aeb7, roughness: 0.16, metalness: 0.08, transparent: true,
      opacity: 0.44, depthWrite: false, side: THREE.DoubleSide
    }),
    step: new THREE.MeshStandardMaterial({ color: 0x85857c, roughness: 0.9 }),
    landing: new THREE.MeshStandardMaterial({ color: 0x929188, roughness: 0.9 }),
    rail: new THREE.MeshStandardMaterial({ color: 0x555d59, roughness: 0.62, metalness: 0.22 }),
    roof: new THREE.MeshStandardMaterial({ color: 0xaaa99f, roughness: 0.92 })
  };

  const collidableMeshes = [];
  const { inner, baseY, floorHeight, storeys, wall } = plan;
  const wallHeight = floorHeight - plan.slab;
  const frontZ = frontSide > 0 ? plan.bounds.maxZ - wall / 2 : plan.bounds.minZ + wall / 2;
  const backZ = plan.bounds.minZ + wall / 2;
  const leftX = plan.bounds.minX + wall / 2;
  const rightX = plan.bounds.maxX - wall / 2;

  const openingsForFacade = (side, level, fallback) => {
    const floorY = baseY + level * floorHeight;
    const measured = facadeWindows.filter((window) => {
      const windowBottom = window.sill;
      const windowTop = windowBottom + window.height;
      return window.side === side &&
        window.center >= (side === 'front' || side === 'back' ? inner.minX : inner.minZ) + 0.18 &&
        window.center <= (side === 'front' || side === 'back' ? inner.maxX : inner.maxZ) - 0.18 &&
        windowBottom >= level * floorHeight + 0.42 &&
        windowTop <= (level + 1) * floorHeight - plan.slab - 0.12;
    }).map((window) => ({
      kind: 'window',
      center: window.center,
      width: Math.min(window.width, side === 'front' || side === 'back' ? plan.innerWidth * 0.42 : plan.innerDepth * 0.42),
      sill: window.sill - level * floorHeight,
      height: Math.min(window.height, wallHeight - 0.58)
    })).filter((window) => window.sill > 0 &&
      window.sill + window.height < wallHeight - 0.02);
    return measured.length ? measured : fallback;
  };

  for (let level = 0; level < storeys; level += 1) {
    const floorY = baseY + level * floorHeight;
    addFloorWithStairOpening(interior, plan, `level-${level}-floor`, floorY, materials.floor, level > 0);

    const defaultFront = level === 0
      ? [
          { kind: 'window', center: inner.minX + plan.innerWidth * 0.15, width: plan.windowWidth, sill: plan.windowSill, height: plan.windowHeight },
          { kind: 'door', center: plan.entryX, width: plan.doorWidth, sill: 0, height: plan.doorHeight },
          { kind: 'window', center: inner.minX + plan.innerWidth * 0.84, width: plan.windowWidth, sill: plan.windowSill, height: plan.windowHeight }
        ]
      : [
          { kind: 'window', center: inner.minX + plan.innerWidth * 0.25, width: plan.windowWidth, sill: plan.windowSill, height: plan.windowHeight },
          { kind: 'window', center: inner.minX + plan.innerWidth * 0.72, width: plan.windowWidth, sill: plan.windowSill, height: plan.windowHeight }
        ];
    const frontOpenings = [
      ...openingsForFacade(frontSide > 0 ? 'front' : 'back', level, []).filter((opening) =>
        level !== 0 || Math.abs(opening.center - plan.entryX) >= (opening.width + plan.doorWidth) / 2 + 0.12
      ),
      ...(level === 0 ? [{ kind: 'door', center: plan.entryX, width: plan.doorWidth, sill: 0, height: plan.doorHeight }] : [])
    ];
    const resolvedFrontOpenings = frontOpenings.some((opening) => opening.kind === 'window')
      ? frontOpenings
      : defaultFront;
    const backOpenings = openingsForFacade(frontSide > 0 ? 'back' : 'front', level, [
      { kind: 'window', center: inner.minX + plan.innerWidth * 0.28, width: plan.windowWidth, sill: plan.windowSill, height: plan.windowHeight },
      { kind: 'window', center: inner.minX + plan.innerWidth * 0.73, width: plan.windowWidth, sill: plan.windowSill, height: plan.windowHeight }
    ]);
    const leftOpenings = openingsForFacade('left', level, [{
      kind: 'window',
      center: inner.minZ + plan.innerDepth * 0.57,
      width: Math.min(plan.windowWidth, plan.innerDepth * 0.35),
      sill: plan.windowSill,
      height: plan.windowHeight
    }]);
    const rightOpenings = openingsForFacade('right', level, leftOpenings);

    buildWallWithOpenings(interior, {
      axis: 'x', name: `level-${level}-front`, coordinate: frontZ,
      start: inner.minX, end: inner.maxX, floorY, height: wallHeight,
      thickness: wall, material: materials.wall, frame: materials.frame, glass: materials.glass,
      openings: resolvedFrontOpenings
    });
    buildWallWithOpenings(interior, {
      axis: 'x', name: `level-${level}-back`, coordinate: backZ,
      start: inner.minX, end: inner.maxX, floorY, height: wallHeight,
      thickness: wall, material: materials.wall, frame: materials.frame, glass: materials.glass,
      openings: backOpenings
    });
    buildWallWithOpenings(interior, {
      axis: 'z', name: `level-${level}-left`, coordinate: leftX,
      start: inner.minZ, end: inner.maxZ, floorY, height: wallHeight,
      thickness: wall, material: materials.wall, frame: materials.frame, glass: materials.glass,
      openings: leftOpenings
    });
    buildWallWithOpenings(interior, {
      axis: 'z', name: `level-${level}-right`, coordinate: rightX,
      start: inner.minZ, end: inner.maxZ, floorY, height: wallHeight,
      thickness: wall, material: materials.wall, frame: materials.frame, glass: materials.glass,
      openings: rightOpenings
    });

    buildFloorPartitions(interior, plan, level, materials, collidableMeshes);
  }

  for (let level = 0; level < storeys - 1; level += 1) {
    buildStairs(interior, plan, level, materials);
  }
  addBox(interior, 'roof-slab', (inner.minX + inner.maxX) / 2, plan.topY - plan.slab,
    (inner.minZ + inner.maxZ) / 2, plan.innerWidth, plan.slab, plan.innerDepth, materials.roof);

  const entryPoint = new THREE.Vector3(plan.entryX, plan.baseY, plan.entryZ);
  const doorPoint = new THREE.Vector3(plan.entryX, plan.baseY,
    frontSide > 0 ? plan.bounds.maxZ + 0.12 : plan.bounds.minZ - 0.12);
  const outward = new THREE.Vector3(0, 0, frontSide).applyQuaternion(orientation).normalize();
  interior.updateMatrixWorld(true);
  const doorPosition = doorPoint.clone().applyMatrix4(interior.matrixWorld);

  for (const mesh of collidableMeshes) {
    const box = new THREE.Box3().setFromObject(mesh);
    if (box.isEmpty()) continue;
    mesh.updateWorldMatrix(true, false);
  }
  const collisionBoxes = collidableMeshes.map((mesh) => {
    const box = new THREE.Box3().setFromObject(mesh);
    return {
      name: mesh.name,
      minX: box.min.x, maxX: box.max.x,
      minZ: box.min.z, maxZ: box.max.z
    };
  });

  const ambient = new THREE.PointLight(0xffe5c9, 0.72, Math.max(plan.width, plan.depth) * 1.8, 2);
  ambient.position.set(plan.entryX, plan.baseY + floorHeight * 0.72, (inner.minZ + inner.maxZ) / 2);
  interior.add(ambient);

  interior.userData.plan = plan;
  interior.userData.walkBounds = plan.walkBounds;
  interior.userData.collisionBoxes = collisionBoxes;
  interior.userData.entryPoint = entryPoint;
  interior.userData.doorLocal = doorPoint;
  interior.userData.getWalkHeight = (x, z, feetY) => getInteriorWalkHeight(plan, x, z, feetY);
  interior.userData.canWalkAt = (x, z, feetY, radius = 0.3) => isInteriorPositionWalkable(plan, x, z, feetY, radius);

  return { root: interior, plan, doorPosition, outward };
}
