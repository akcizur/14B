import './styles.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { canOccupy, canMoveVehicleAlongAxis, circleIntersectsAabb, findNearestByDistance, animationTimeScale, normalizeMovement, splitAxisRoute, wheelAngularDelta, resolveAxisMovement } from './collision.js';
import { attachWheelPivot, extractMergedWheelComponents, spinWheel } from './vehicles/wheel-rig.js';
import { buildBuildingInterior } from './world/building-architecture.js';
import { assertValidWorldHierarchy } from './world/world-hierarchy.js';
import { WORLD_CONFIG } from './world/world-config.js';
import { assertValidWorldConfig } from './world/world-validation.js';

const mount = document.getElementById('game');
const canvas = document.getElementById('screenCanvas');
const loadingScreen = document.getElementById('loading');
const loadingBar = document.getElementById('loadingBar');
const loadingText = document.getElementById('loadingText');
const welcomeScreen = document.getElementById('welcomeScreen');
const pauseScreen = document.getElementById('pauseScreen');
const startButton = document.getElementById('startButton');
const resumeButton = document.getElementById('resumeButton');
const hint = document.getElementById('hint');
const toast = document.getElementById('toast');
const coordinates = document.getElementById('coordinates');
const locationLabel = document.getElementById('locationLabel');
const worldState = document.getElementById('worldState');
const clockLabel = document.getElementById('clock');
const npcDialog = document.getElementById('npcDialog');
const npcDialogName = document.getElementById('npcDialogName');
const npcDialogText = document.getElementById('npcDialogText');

const BASE = import.meta.env.BASE_URL || './';
const MODEL_URL = (name) => `${BASE}models/${name}`;
const loader = new GLTFLoader();
const assetCache = new Map();
const mixers = [];
const vehicles = [];
const walkers = [];
const colliders = [];
const interactableDoors = [];
const houses = [];
const keyState = new Set();
const playerRadius = 0.3;
let manifest = {};
let currentInterior = null;
let gameStarted = false;
let lastToast = 0;
let lastTime = 0;
let frameTime = 0;
let activeNpcDialog = null;

const scene = new THREE.Scene();
scene.background = new THREE.Color(WORLD_CONFIG.environment.background);
scene.fog = new THREE.FogExp2(WORLD_CONFIG.environment.fogColor, WORLD_CONFIG.environment.fogDensity);
const camera = new THREE.PerspectiveCamera(73, 1, 0.08, 180);
camera.position.set(...WORLD_CONFIG.spawn.position);
camera.rotation.set(...WORLD_CONFIG.spawn.rotation, 'YXZ');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const controls = new PointerLockControls(camera, renderer.domElement);
controls.pointerSpeed = 0.75;

const world = new THREE.Group();
world.name = 'district-world';
scene.add(world);

function makeMaterial(color, roughness = 0.9, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
function addBox(parent, name, x, y, z, sx, sy, sz, material, cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  mesh.name = name;
  mesh.position.set(x, y + sy / 2, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function addPlane(parent, name, x, y, z, sx, sz, material) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), material);
  mesh.name = name;
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function addCollider(name, x, z, width, depth) {
  if (![x, z, width, depth].every(Number.isFinite) || width <= 0 || depth <= 0) return;
  colliders.push({ name, minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 });
}
function addObjectCollider(root, name, scale = 0.82, minSize = 0.3) {
  root.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(root);
  if (bounds.isEmpty()) return;
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  if (![size.x, size.z, center.x, center.z].every(Number.isFinite)) return;
  const width = Math.max(minSize, size.x * scale);
  const depth = Math.max(minSize, size.z * scale);
  addCollider(name, center.x, center.z, width, depth);
}
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(lastToast);
  lastToast = window.setTimeout(() => toast.classList.remove('visible'), 2100);
}
function updateLoading(value, message) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  loadingBar.style.width = `${pct}%`;
  loadingText.textContent = `${message} · ${pct}%`;
}
function shadowify(root) {
  root.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
      if (object.material) {
        const mats = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of mats) {
          if ('envMapIntensity' in material) material.envMapIntensity = 0.8;
        }
      }
    }
  });
}
function normalizeToHeight(root, targetHeight) {
  root.updateMatrixWorld(true);
  const original = new THREE.Box3().setFromObject(root);
  const size = original.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.y) || size.y < 1e-5) return root;
  root.scale.multiplyScalar(targetHeight / size.y);
  root.updateMatrixWorld(true);
  const scaled = new THREE.Box3().setFromObject(root);
  root.position.y -= scaled.min.y;
  root.updateMatrixWorld(true);
  return root;
}
async function loadGLTF(key) {
  if (assetCache.has(key)) return assetCache.get(key);
  const file = manifest[key];
  if (!file) throw new Error(`Asset not found in supplied pack: ${key}`);
  const task = loader.loadAsync(MODEL_URL(file));
  assetCache.set(key, task);
  try {
    return await task;
  } catch (error) {
    assetCache.delete(key);
    throw error;
  }
}
async function createAsset(key, options = {}) {
  const gltf = await loadGLTF(key);
  const root = gltf.animations?.length ? SkeletonUtils.clone(gltf.scene) : gltf.scene.clone(true);
  if (options.height) normalizeToHeight(root, options.height);
  shadowify(root);
  if (options.name) root.name = options.name;
  if (options.position) root.position.set(...options.position);
  if (options.rotationY !== undefined) root.rotation.y = options.rotationY;
  if (options.scale) root.scale.multiply(new THREE.Vector3(...options.scale));
  if (options.parent) options.parent.add(root);
  return { root, animations: gltf.animations || [] };
}
function addAnimatedActor(key, height, position, path, speed, name, collision, animation, interaction) {
  return createAsset(key, { height, position, parent: world, name }).then(({ root, animations }) => {
    const mixer = new THREE.AnimationMixer(root);
    const walkClip = animations.find((clip) => /walk|walking|run/i.test(clip.name));
    const idleClip = animations.find((clip) => /idle|standing/i.test(clip.name));
    const activeClip = walkClip || idleClip || animations[0];
    if (activeClip) {
      const action = mixer.clipAction(activeClip);
      if (activeClip === walkClip) {
        action.setEffectiveTimeScale(animationTimeScale(speed, animation?.walkSpeed ?? 1.2));
      }
      action.play();
    }
    mixers.push(mixer);
    root.rotation.y = path.axis === 'z' ? 0 : Math.PI / 2;
    walkers.push({ root, mixer, path, speed, direction: 1, name, interaction, colliderHalfWidth: collision.halfWidth, colliderHalfDepth: collision.halfDepth });
    return root;
  });
}

function addStreetBase() {
  const grass = makeMaterial(0x718267);
  const asphalt = makeMaterial(0x444a4a, 0.98);
  const concrete = makeMaterial(0xb9b6aa, 0.95);
  const curb = makeMaterial(0x9e9e92, 0.96);
  const marking = makeMaterial(0xd8d8cb, 0.95);
  const street = WORLD_CONFIG.street;

  addPlane(world, 'district-ground', ...street.ground.position, ...street.ground.size, grass);
  addPlane(world, 'street-road', ...street.road.position, ...street.road.size, asphalt);

  for (const side of [-1, 1]) {
    addPlane(world, 'sidewalk-' + side, 0, street.sidewalk.y, side * street.sidewalk.z, street.sidewalk.width, street.sidewalk.depth, concrete);
    addBox(world, 'curb-' + side, 0, street.curb.y, side * street.curb.z, street.curb.width, street.curb.height, street.curb.depth, curb);
  }

  const lanes = street.laneMarkings;
  for (let x = lanes.startX; x <= lanes.endX; x += lanes.step) {
    addPlane(world, 'lane-dash-' + x, x, lanes.y, 0, lanes.width, lanes.depth, marking);
  }

  const crossing = street.crosswalks;
  for (const centerX of crossing.centersX) {
    for (let offset = crossing.firstOffset; offset <= crossing.lastOffset; offset += 1) {
      addPlane(world, 'crosswalk-' + centerX + '-' + offset, centerX + offset * crossing.spacing,
        crossing.y, 0, crossing.width, crossing.depth, marking);
    }
  }

  if (street.manhole) {
    const manholeConfig = street.manhole;
    const manhole = new THREE.Mesh(
      new THREE.CylinderGeometry(manholeConfig.radius, manholeConfig.radius, 0.024, 28),
      makeMaterial(0x343a38, 0.66, 0.45)
    );
    manhole.name = 'street-manhole';
    manhole.position.set(...manholeConfig.position);
    manhole.receiveShadow = true;
    world.add(manhole);
  }
}

function addEntryWalkway(house) {
  const config = WORLD_CONFIG.street.entryPath;
  const sidewalk = WORLD_CONFIG.street.sidewalk;
  const normal = house.doorNormal.clone();
  if (Math.abs(normal.z) < 0.75) return;

  // The house sits on the same signed side as its sidewalk. The door normal
  // must point toward that sidewalk, not toward the opposite side of the road.
  const side = Math.sign(house.center.z) || -Math.sign(normal.z);
  const sidewalkEdge = side * (sidewalk.z + sidewalk.depth / 2 - 0.06);
  const distance = (sidewalkEdge - house.doorPosition.z) / normal.z;
  if (!Number.isFinite(distance) || distance <= config.thresholdDepth + 0.15 ||
      Math.sign(distance) !== Math.sign(1)) return;

  const yaw = Math.atan2(normal.x, normal.z);
  const pathStart = house.doorPosition.clone().addScaledVector(normal, config.thresholdDepth / 2);
  const pathEnd = house.doorPosition.clone().addScaledVector(normal, distance);
  const pathLength = pathStart.distanceTo(pathEnd);
  const material = makeMaterial(0x99998f, 0.94);
  const landing = new THREE.Mesh(
    new THREE.BoxGeometry(config.width + 0.45, config.thickness, config.thresholdDepth),
    material
  );
  landing.name = `${house.id}-entry-landing`;
  landing.position.copy(house.doorPosition).addScaledVector(normal, config.thresholdDepth / 2);
  landing.position.y = config.thickness / 2;
  landing.rotation.y = yaw;
  landing.receiveShadow = true;
  world.add(landing);

  if (pathLength > 0.1) {
    const path = new THREE.Mesh(
      new THREE.BoxGeometry(config.width, config.thickness, pathLength),
      material
    );
    path.name = `${house.id}-entry-walkway`;
    path.position.copy(pathStart).add(pathEnd).multiplyScalar(0.5);
    path.position.y = config.thickness / 2;
    path.rotation.y = yaw;
    path.receiveShadow = true;
    world.add(path);
  }
}

async function addBuilding(definition) {
  const { id, asset, position, rotationY = 0, height, role, frontSide, collision } = definition;
  const { root } = await createAsset(asset, {
    height, position, rotationY, parent: world, name: id
  });
  root.userData.role = role;
  root.userData.frontSide = frontSide;

  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  if (role === 'house') {
    const architecture = buildBuildingInterior(root, definition);
    const interior = architecture.root;
    interior.visible = false;
    scene.add(interior);
    const house = {
      id, name: id, root, interior,
      center: root.position.clone(),
      doorPosition: architecture.doorPosition,
      doorNormal: architecture.outward,
      frontSide,
      rotationY: root.rotation.y,
      size,
      architecture: architecture.plan
    };
    houses.push(house);
    interactableDoors.push(house);
    addEntryWalkway(house);
    addCollider(id, center.x, center.z, Math.max(collision.minWidth, size.x * collision.scaleX), Math.max(collision.minDepth, size.z * collision.scaleZ));
  } else {
    addCollider(id, center.x, center.z, Math.max(collision.minWidth, size.x * collision.scaleX), Math.max(collision.minDepth, size.z * collision.scaleZ));
  }
  return root;
}

async function addStreetProps() {
  await Promise.all(WORLD_CONFIG.streetProps.map(async (definition) => {
    const { id, asset, height, position, rotationY = 0, collision } = definition;
    const { root } = await createAsset(asset, {
      height, position, rotationY, parent: world, name: id
    });
    if (collision) {
      addObjectCollider(root, 'prop-' + id, collision.scale, collision.minSize);
    }
  }));

  const fenceConfig = WORLD_CONFIG.fences;
  if (!fenceConfig || fenceConfig.count === 0 || !fenceConfig.sides.length) return;
  const fenceAsset = await loadGLTF(fenceConfig.asset);
  const fenceBase = fenceAsset.scene;

  for (const side of fenceConfig.sides) {
    for (let index = 0; index < fenceConfig.count; index += 1) {
      const root = fenceBase.clone(true);
      root.traverse((object) => {
        if (!object.isMesh) return;
        if (Array.isArray(object.material)) object.material = object.material.map((material) => material.clone());
        else if (object.material) object.material = object.material.clone();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (material && material.color) material.color.lerp(new THREE.Color(0x68736a), 0.15);
        }
      });
      normalizeToHeight(root, fenceConfig.height);
      root.position.set(fenceConfig.startX + index * fenceConfig.spacing, 0, side * fenceConfig.z);
      root.rotation.y = side > 0 ? Math.PI : 0;
      shadowify(root);
      world.add(root);
      addObjectCollider(root, 'fence-' + side + '-' + index, fenceConfig.collision.scale, fenceConfig.collision.minSize);
    }
  }
}

function addStreetLights() {
  const pole = makeMaterial(0x363e3b, 0.4, 0.72);
  const glow = new THREE.MeshStandardMaterial({ color: 0xf2e5c7, emissive: 0xffdba1, emissiveIntensity: 1.2 });
  const config = WORLD_CONFIG.streetLights;

  for (const side of config.sides) {
    for (const x of config.positionsX) {
      const root = new THREE.Group();
      root.position.set(x, 0, side * config.z);
      addBox(root, 'lamp-post', 0, 0, 0, 0.12, config.poleHeight, 0.12, pole);
      addBox(root, 'lamp-arm', side > 0 ? 0.38 : -0.38, config.poleHeight - 0.22, 0, 0.9, 0.1, 0.1, pole);
      addBox(root, 'lamp-head', side > 0 ? 0.74 : -0.74, config.poleHeight - 0.38, 0, 0.42, 0.14, 0.28, glow, false);
      const light = new THREE.PointLight(0xffe2b0, 0.42, 9, 2);
      light.position.set(side > 0 ? 0.72 : -0.72, config.poleHeight - 0.45, 0);
      root.add(light);
      world.add(root);
      addCollider('street-light-' + side + '-' + x, x, side * config.z, config.collision.radius * 2, config.collision.radius * 2);
    }
  }
}

/**
 * Place a rotation pivot at the wheel's actual geometric center and reparent
 * the imported GLB node without changing its world transform. The pivot is
 * intentionally identity-oriented: local X is the axle on every supplied
 * vehicle model. The source node's original quaternion stays untouched.
 */
function createFallbackVehicleWheels(root, layout) {
  const originalYaw = root.rotation.y;
  root.rotation.y = 0;
  root.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(root);
  const worldSize = bounds.getSize(new THREE.Vector3());
  const worldCenter = bounds.getCenter(new THREE.Vector3());

  const scaleX = Math.max(1e-6, Math.abs(root.scale.x));
  const scaleY = Math.max(1e-6, Math.abs(root.scale.y));
  const scaleZ = Math.max(1e-6, Math.abs(root.scale.z));

  // Convert the world-space model bounds once into the normalized vehicle
  // root's local coordinates. No wheel inherits the model's normalization twice.
  const localSize = new THREE.Vector3(
    worldSize.x / scaleX,
    worldSize.y / scaleY,
    worldSize.z / scaleZ
  );
  const localCenter = new THREE.Vector3(
    (worldCenter.x - root.position.x) / scaleX,
    (worldCenter.y - root.position.y) / scaleY,
    (worldCenter.z - root.position.z) / scaleZ
  );
  const localGround = (bounds.min.y - root.position.y) / scaleY;
  root.rotation.y = originalYaw;
  root.updateWorldMatrix(true, true);

  const radius = layout.radius;
  const tyreWidth = layout.width;
  const radiusLocal = radius / scaleY;
  const widthLocal = tyreWidth / scaleX;
  const rubber = makeMaterial(0x171916, 0.98);
  const hub = makeMaterial(0x74796f, 0.52, 0.3);
  const wheels = [];

  for (const side of [-1, 1]) {
    for (const axlePosition of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.name = `generated-wheel-pivot-${side}-${axlePosition}`;
      pivot.position.set(
        localCenter.x + side * localSize.x * layout.lateralRatio,
        localGround + radiusLocal,
        localCenter.z + axlePosition * localSize.z * layout.longitudinalRatio
      );
      root.add(pivot);

      // Keep the pivot aligned with the vehicle's local X axle. Only the
      // cylinder meshes are turned sideways; the spin pivot remains identity.
      const tyre = new THREE.Mesh(
        new THREE.CylinderGeometry(radiusLocal, radiusLocal, widthLocal, 20),
        rubber
      );
      tyre.rotation.z = Math.PI / 2;
      tyre.castShadow = true;
      tyre.receiveShadow = true;
      pivot.add(tyre);

      for (const face of [-1, 1]) {
        const cap = new THREE.Mesh(
          new THREE.CylinderGeometry(radiusLocal * 0.43, radiusLocal * 0.43, widthLocal * 0.1, 16),
          hub
        );
        cap.rotation.z = Math.PI / 2;
        cap.position.x = face * widthLocal * 0.47;
        cap.castShadow = true;
        pivot.add(cap);
      }
      wheels.push({ pivot, radius, axle: 'x' });
    }
  }
  return wheels;
}

function collectVehicleWheels(root, routeAxis, asset, wheelLayout) {
  const wheelNodes = [];
  root.updateWorldMatrix(true, true);
  root.traverse((object) => {
    if (object.isMesh && object.name && /wheel|tyre|tire/i.test(object.name)) {
      wheelNodes.push(object);
    }
  });

  const wheels = wheelNodes.map((wheelNode) => {
    const bounds = new THREE.Box3().setFromObject(wheelNode);
    if (bounds.isEmpty()) return null;
    const size = bounds.getSize(new THREE.Vector3());

    // The axle is local X. Pick the two radial dimensions after the vehicle's
    // route orientation has been applied, not the dimension along the axle.
    const diameter = routeAxis === 'x'
      ? Math.max(size.x, size.y)
      : Math.max(size.y, size.z);
    const radius = diameter * 0.5;
    if (!Number.isFinite(radius) || radius <= 0.06) return null;
    return attachWheelPivot(root, wheelNode, radius);
  }).filter(Boolean);

  // Van and Bus have no named wheel nodes, but their indexed GLB geometry
  // contains four disconnected tyre/rim groups. Extract their original parts
  // before using the authored fallback wheel layout.
  if (wheels.length === 0 && wheelLayout) {
    const bodyMeshes = [];
    root.traverse((object) => {
      if (object.isMesh) bodyMeshes.push(object);
    });
    if (bodyMeshes.length === 1) {
      const extracted = extractMergedWheelComponents(root, bodyMeshes[0]);
      if (extracted.length === 4) return extracted;
    }
    return createFallbackVehicleWheels(root, wheelLayout);
  }
  return wheels;
}


async function addVehicles() {
  for (const definition of WORLD_CONFIG.vehicles) {
    const { id, asset, height, position, direction, speed, route, collision } = definition;
    const rotationY = route.axis === 'x'
      ? (direction > 0 ? Math.PI / 2 : -Math.PI / 2)
      : (direction > 0 ? 0 : Math.PI);
    const { root } = await createAsset(asset, {
      height, position, rotationY, parent: world, name: id
    });
    const wheels = collectVehicleWheels(root, route.axis, asset, definition.wheelLayout);
    const vehicleBounds = new THREE.Box3().setFromObject(root);
    const vehicleSize = vehicleBounds.getSize(new THREE.Vector3());
    const vehicleCenter = vehicleBounds.getCenter(new THREE.Vector3());
    vehicles.push({
      id, root, wheels, asset, direction, speed, route,
      colliderOffsetX: vehicleCenter.x - root.position.x,
      colliderOffsetZ: vehicleCenter.z - root.position.z,
      colliderHalfWidth: Math.max(collision.minHalfWidth, vehicleSize.x * collision.scaleX),
      colliderHalfDepth: Math.max(collision.minHalfDepth, vehicleSize.z * collision.scaleZ)
    });
  }
}

async function addPedestrians() {
  await Promise.all(WORLD_CONFIG.pedestrians.map((definition) =>
    addAnimatedActor(
      definition.asset,
      definition.height,
      definition.position,
      definition.path,
      definition.speed,
      definition.id,
      definition.collision,
      definition.animation,
      definition.interaction
    )
  ));
}

function addTrees() {
  return Promise.all(WORLD_CONFIG.trees.map(async (definition) => {
    const { id, position, height } = definition;
    const { root } = await createAsset('Tree', {
      height, position, parent: world, name: id
    });
    const radius = definition.collision.radius;
    addCollider('trunk-' + id, position[0], position[2], radius * 2, radius * 2);
    return root;
  }));
}

function buildBackdrop() {
  const low = makeMaterial(0x8c9386, 0.95);
  addPlane(world, 'far-grass', 0, -0.2, 0, 150, 100, low);
}

async function buildInteriorEntranceMarker(house) {
  const markerPosition = house.doorPosition.clone().addScaledVector(house.doorNormal, -0.035);
  const markerYaw = Math.atan2(-house.doorNormal.x, -house.doorNormal.z);
  const { root } = await createAsset('Door', {
    height: 2.2,
    position: [markerPosition.x, markerPosition.y, markerPosition.z],
    rotationY: markerYaw,
    parent: world,
    name: `${house.name}-door-marker`
  });
  house.marker = root;
}

function getMovingActorColliders() {
  const dynamic = [];
  for (const vehicle of vehicles) {
    const centerX = vehicle.root.position.x + vehicle.colliderOffsetX;
    const centerZ = vehicle.root.position.z + vehicle.colliderOffsetZ;
    dynamic.push({
      name: `moving-${vehicle.id}`,
      minX: centerX - vehicle.colliderHalfWidth,
      maxX: centerX + vehicle.colliderHalfWidth,
      minZ: centerZ - vehicle.colliderHalfDepth,
      maxZ: centerZ + vehicle.colliderHalfDepth
    });
  }
  for (const walker of walkers) {
    dynamic.push({
      name: `walker-${walker.name}`,
      minX: walker.root.position.x - walker.colliderHalfWidth,
      maxX: walker.root.position.x + walker.colliderHalfWidth,
      minZ: walker.root.position.z - walker.colliderHalfDepth,
      maxZ: walker.root.position.z + walker.colliderHalfDepth
    });
  }
  return dynamic;
}

function canPlayerOccupy(x, z, previous = null) {
  if (currentInterior) {
    const interior = currentInterior.interior;
    const local = interior.worldToLocal(new THREE.Vector3(x, camera.position.y, z));
    const feetY = local.y - 1.7;
    if (!canOccupy(local.x, local.z, playerRadius, interior.userData.walkBounds)) return false;
    if (!interior.userData.canWalkAt(local.x, local.z, feetY, playerRadius)) return false;
    return canOccupy(x, z, playerRadius, null, interior.userData.collisionBoxes || []);
  }

  const worldBounds = WORLD_CONFIG.bounds;
  if (!canOccupy(x, z, playerRadius, worldBounds, colliders)) return false;

  // If a moving actor has entered the player's space, allow movement that
  // increases separation so the player cannot become permanently trapped.
  const dynamic = getMovingActorColliders();
  for (const box of dynamic) {
    if (!circleIntersectsAabb(x, z, playerRadius, box)) continue;
    if (!previous || !circleIntersectsAabb(previous.x, previous.z, playerRadius, box)) return false;
    const centerX = (box.minX + box.maxX) / 2;
    const centerZ = (box.minZ + box.maxZ) / 2;
    const before = Math.hypot(previous.x - centerX, previous.z - centerZ);
    const after = Math.hypot(x - centerX, z - centerZ);
    if (after <= before) return false;
  }
  return true;
}
function movePlayer(delta) {
  if (!controls.isLocked || !gameStarted) return;
  const previous = camera.position.clone();
  const running = keyState.has('ShiftLeft') || keyState.has('ShiftRight');
  const speed = running ? 7.0 : 4.2;
  const forwardInput = (keyState.has('KeyW') || keyState.has('ArrowUp') ? 1 : 0) -
    (keyState.has('KeyS') || keyState.has('ArrowDown') ? 1 : 0);
  const strafeInput = (keyState.has('KeyD') || keyState.has('ArrowRight') ? 1 : 0) -
    (keyState.has('KeyA') || keyState.has('ArrowLeft') ? 1 : 0);
  const movement = normalizeMovement(forwardInput, strafeInput);
  if (movement.x === 0 && movement.z === 0) return;

  const move = speed * delta;
  controls.moveForward(move * movement.x);
  controls.moveRight(move * movement.z);

  const requested = { x: camera.position.x, z: camera.position.z };
  const resolved = resolveAxisMovement(
    { x: previous.x, z: previous.z },
    requested,
    (x, z) => canPlayerOccupy(x, z, previous),
    0.16
  );
  camera.position.x = resolved.x;
  camera.position.z = resolved.z;
  if (currentInterior) {
    const interior = currentInterior.interior;
    const local = interior.worldToLocal(camera.position.clone());
    const feetY = interior.userData.getWalkHeight(local.x, local.z, local.y - 1.7);
    const eyePosition = interior.localToWorld(new THREE.Vector3(local.x, feetY + 1.7, local.z));
    camera.position.y = eyePosition.y;
  } else {
    camera.position.y = 1.7;
  }
}
function nearestDoor() {
  if (currentInterior) return null;
  const available = interactableDoors.filter((house) => {
    if (!house.root.visible) return false;
    const outside = camera.position.clone().sub(house.doorPosition);
    return outside.dot(house.doorNormal) >= 0.2;
  });
  return findNearestByDistance(camera.position, available, 3.2, (house) => house.doorPosition);
}
function nearestPedestrian() {
  if (currentInterior) return null;
  const candidates = walkers.filter((walker) => {
    if (!walker.interaction || !walker.root.visible) return false;
    const distance = Math.hypot(
      walker.root.position.x - camera.position.x,
      walker.root.position.z - camera.position.z
    );
    return distance <= walker.interaction.radius;
  });
  return findNearestByDistance(
    camera.position,
    candidates,
    5,
    (walker) => walker.root.position
  );
}
function closeNpcDialog() {
  if (!activeNpcDialog) return;
  activeNpcDialog = null;
  npcDialog.classList.add('is-hidden');
}
function openNpcDialog(walker) {
  activeNpcDialog = walker;
  npcDialogName.textContent = walker.interaction.name;
  npcDialogText.textContent = walker.interaction.text;
  npcDialog.classList.remove('is-hidden');
  toast.classList.remove('visible');
}
function yawForDirection(direction) {
  return Math.atan2(-direction.x, -direction.z);
}
function enterHouse(house) {
  house.root.visible = false;
  if (house.marker) house.marker.visible = false;
  house.interior.visible = true;
  currentInterior = house;

  const entry = house.interior.userData.entryPoint.clone();
  entry.y += 1.7;
  camera.position.copy(house.interior.localToWorld(entry));
  const inward = house.doorNormal.clone().negate();
  camera.rotation.set(0, yawForDirection(inward), 0, 'YXZ');
  locationLabel.textContent = house.name.toUpperCase().replaceAll('-', ' ') + ' / INTERIOR';
  worldState.textContent = 'INDOOR';
  showToast('ENTERED / E TO EXIT · STAIRS TO UPPER FLOORS');
}
function exitHouse() {
  const house = currentInterior;
  if (!house) return;
  house.interior.visible = false;
  house.root.visible = true;
  if (house.marker) house.marker.visible = true;
  currentInterior = null;
  const outside = house.doorPosition.clone().addScaledVector(house.doorNormal, 2.4);
  camera.position.set(outside.x, house.doorPosition.y + 1.7, outside.z);
  camera.rotation.set(0, yawForDirection(house.doorNormal), 0, 'YXZ');
  locationLabel.textContent = 'DISTRICT 14 / STREET';
  worldState.textContent = 'OUTDOOR';
  showToast('BACK TO THE STREET');
}
function interact() {
  if (activeNpcDialog) {
    closeNpcDialog();
    return;
  }
  if (currentInterior) {
    exitHouse();
    return;
  }

  const pedestrian = nearestPedestrian();
  const door = nearestDoor();
  if (pedestrian && (!door || pedestrian.distance <= door.distance)) {
    openNpcDialog(pedestrian.target);
    return;
  }
  if (door) {
    enterHouse(door.target);
    return;
  }
  showToast('PŘIBLIŽ SE K OBJEKTU NEBO OBYVATELI');
}

function animateActors(delta) {
  for (const mixer of mixers) mixer.update(delta);

  for (const walker of walkers) {
    const axis = walker.path.axis || 'x';
    const next = walker.root.position[axis] + walker.speed * walker.direction * delta;
    if (next > walker.path.max) {
      walker.root.position[axis] = walker.path.max;
      walker.direction = -1;
      walker.root.rotation.y = axis === 'x' ? -Math.PI / 2 : Math.PI;
    } else if (next < walker.path.min) {
      walker.root.position[axis] = walker.path.min;
      walker.direction = 1;
      walker.root.rotation.y = axis === 'x' ? Math.PI / 2 : 0;
    } else {
      walker.root.position[axis] = next;
    }
  }

  for (const vehicle of vehicles) {
    const axis = vehicle.route.axis;
    const current = vehicle.root.position[axis];
    const planned = splitAxisRoute(current, vehicle.speed * vehicle.direction * delta, vehicle.route);
    let travelled = 0;
    let stopped = false;

    for (const segment of planned) {
      const segmentDistance = segment.to - segment.from;
      const steps = Math.max(1, Math.ceil(Math.abs(segmentDistance) / 0.12));
      for (let index = 1; index <= steps; index += 1) {
        const candidate = segment.from + segmentDistance * (index / steps);
        const fixed = axis === 'x'
          ? vehicle.root.position.z + vehicle.colliderOffsetZ
          : vehicle.root.position.x + vehicle.colliderOffsetX;
        const clear = canMoveVehicleAlongAxis(
          { x: camera.position.x, z: camera.position.z },
          playerRadius,
          axis,
          fixed,
          vehicle.root.position[axis] + (axis === 'x' ? vehicle.colliderOffsetX : vehicle.colliderOffsetZ),
          candidate + (axis === 'x' ? vehicle.colliderOffsetX : vehicle.colliderOffsetZ),
          vehicle.colliderHalfWidth,
          vehicle.colliderHalfDepth
        );
        if (!clear) {
          stopped = true;
          break;
        }
        const previous = vehicle.root.position[axis];
        vehicle.root.position[axis] = candidate;
        travelled += Math.abs(candidate - previous);
      }
      if (stopped) break;
      if (segment.wrapTo !== null) {
        vehicle.root.position[axis] = segment.wrapTo;
      }
    }

    if (travelled > 0) {
      for (const wheel of vehicle.wheels) {
        const angle = wheelAngularDelta(travelled, wheel.radius);
        // Every pivot is identity-oriented in vehicle-local space, with its
        // X axis aligned to the axle. Keep the imported mesh rest transform.
        spinWheel(wheel, angle);
      }
    }
  }
}

function updateUI() {
  coordinates.textContent = `X ${camera.position.x.toFixed(1)} · Z ${camera.position.z.toFixed(1)}`;
  const door = nearestDoor();
  const pedestrian = nearestPedestrian();

  if (activeNpcDialog) {
    const distance = Math.hypot(
      activeNpcDialog.root.position.x - camera.position.x,
      activeNpcDialog.root.position.z - camera.position.z
    );
    if (distance > 3.8 || !activeNpcDialog.root.visible) closeNpcDialog();
  }

  if (currentInterior) hint.textContent = 'E / OPUSTIT DŮM · SCHODIŠTĚ / DALŠÍ PODLAŽÍ';
  else if (activeNpcDialog) hint.textContent = 'E / ZAVŘÍT ROZHOVOR';
  else if (pedestrian && (!door || pedestrian.distance <= door.distance)) {
    hint.textContent = `E / PROMLOUVIT · ${pedestrian.target.interaction.name.toUpperCase()}`;
  } else if (door) hint.textContent = `E / VSTOUPIT · ${door.target.name.toUpperCase().replaceAll('-', ' ')}`;
  else hint.textContent = 'WASD POHYB · SHIFT BĚH · MYŠ POHLED · E INTERAKCE';
}
function resize() {
  const width = Math.max(1, mount.clientWidth);
  const height = Math.max(1, mount.clientHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

async function initWorld() {
  const response = await fetch(MODEL_URL('manifest.json'));
  if (!response.ok) throw new Error(`Cannot load asset manifest (${response.status}).`);
  manifest = await response.json();
  assertValidWorldConfig(WORLD_CONFIG, manifest);
  assertValidWorldHierarchy(WORLD_CONFIG.hierarchy, WORLD_CONFIG.buildings);
  addStreetBase();
  buildBackdrop();

  const steps = [
    ['Buildings', async () => {
      await Promise.all(WORLD_CONFIG.buildings.map(addBuilding));
      await Promise.all(houses.map(buildInteriorEntranceMarker));
    }],
    ['Street assets', addStreetProps],
    ['Street lights', addStreetLights],
    ['Greenery', addTrees],
    ['Traffic', addVehicles],
    ['Pedestrians', addPedestrians]
  ];

  for (let i = 0; i < steps.length; i += 1) {
    updateLoading(12 + (i / steps.length) * 76, steps[i][0]);
    await steps[i][1]();
  }
  updateLoading(94, 'Finishing scene');
  scene.traverse((object) => {
    if (object.isMesh && object.geometry?.attributes?.uv && !object.geometry.attributes.uv2) {
      object.geometry.setAttribute('uv2', object.geometry.attributes.uv.clone());
    }
  });
  updateLoading(100, 'Ready');
  worldState.textContent = 'READY';
  window.setTimeout(() => {
    loadingScreen.classList.add('is-hidden');
    welcomeScreen.classList.remove('is-hidden');
  }, 240);
}

const hemi = new THREE.HemisphereLight(0xe6eff0, 0x62604c, 1.65);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe6c8, 2.2);
sun.position.set(-18, 28, 15);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -48;
sun.shadow.camera.right = 48;
sun.shadow.camera.top = 38;
sun.shadow.camera.bottom = -38;
sun.shadow.bias = -0.00018;
sun.shadow.normalBias = 0.025;
sun.shadow.radius = 4;
scene.add(sun);

renderer.setAnimationLoop((time) => {
  const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
  lastTime = time;
  frameTime += delta;
  if (gameStarted && controls.isLocked) {
    movePlayer(delta);
    animateActors(delta);
    updateUI();
  }
  renderer.render(scene, camera);
  if (frameTime > 1) {
    clockLabel.textContent = new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
    frameTime = 0;
  }
});

startButton.addEventListener('click', () => {
  gameStarted = true;
  welcomeScreen.classList.add('is-hidden');
  controls.lock();
});
resumeButton.addEventListener('click', () => {
  pauseScreen.classList.add('is-hidden');
  controls.lock();
});
controls.addEventListener('lock', () => {
  pauseScreen.classList.add('is-hidden');
});
controls.addEventListener('unlock', () => {
  if (gameStarted && !welcomeScreen.classList.contains('is-hidden')) return;
  if (gameStarted) pauseScreen.classList.remove('is-hidden');
});
window.addEventListener('keydown', (event) => {
  keyState.add(event.code);
  if (event.code === 'KeyE' && !event.repeat && gameStarted) interact();
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
});
window.addEventListener('keyup', (event) => keyState.delete(event.code));
window.addEventListener('blur', () => keyState.clear());
window.addEventListener('resize', resize, { passive: true });
resize();

initWorld().catch((error) => {
  console.error('[District 14] Initialization failed:', error);
  loadingText.textContent = 'ASSET LOAD FAILED — CHECK MODELS DIRECTORY';
  loadingText.style.color = '#ffb9a6';
});

window.addEventListener('beforeunload', () => {
  controls.unlock();
  renderer.setAnimationLoop(null);
  for (const mixer of mixers) mixer.stopAllAction();
  renderer.dispose();
});
