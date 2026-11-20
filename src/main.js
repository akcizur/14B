import './styles.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { canOccupy, circleIntersectsAabb, isInInteractionRange, normalizeMovement, resolveAxisMovement } from './collision.js';
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
const interiorFurnitureBlockers = new Set([
  'Couch Large', 'Fireplace', 'Kitchen Fridge', 'Kitchen Sink', 'Oven',
  'Table Round Large', 'Chair', 'Shelf Large', 'Bed King', 'Night Stand',
  'Bathroom Sink', 'Toilet', 'Bathtub', 'Washing Machine', 'Stool'
]);
let manifest = {};
let currentInterior = null;
let gameStarted = false;
let lastToast = 0;
let lastTime = 0;
let frameTime = 0;

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
function addAnimatedActor(key, height, position, path, speed, name) {
  return createAsset(key, { height, position, parent: world, name }).then(({ root, animations }) => {
    const mixer = new THREE.AnimationMixer(root);
    const walkClip = animations.find((clip) => /walk|walking|run/i.test(clip.name));
    const idleClip = animations.find((clip) => /idle|standing/i.test(clip.name));
    const activeClip = walkClip || idleClip || animations[0];
    if (activeClip) {
      const action = mixer.clipAction(activeClip);
      action.play();
    }
    mixers.push(mixer);
    root.rotation.y = path.axis === 'z' ? 0 : Math.PI / 2;
    walkers.push({ root, mixer, path, speed, direction: 1, name, colliderHalfWidth: 0.28, colliderHalfDepth: 0.28 });
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
    addPlane(world, 'front-garden-' + side, 0, street.gardens.y, side * street.gardens.z, street.gardens.width, street.gardens.depth, grass);
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

async function addBuilding(definition) {
  const { id, asset, position, rotationY = 0, height, role, frontSide } = definition;
  const { root } = await createAsset(asset, {
    height, position, rotationY, parent: world, name: id
  });
  root.userData.role = role;
  root.userData.frontSide = frontSide;

  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  if (role === 'house') {
    const doorZ = (frontSide > 0 ? box.max.z : box.min.z) + frontSide * 0.12;
    const doorPosition = new THREE.Vector3(position[0], 0, doorZ);
    const interior = buildInterior({ x: position[0], z: position[2], frontSide, seed: id });
    interior.visible = false;
    scene.add(interior);
    const house = {
      id, name: id, root, interior,
      center: new THREE.Vector3(position[0], 0, position[2]),
      doorPosition, frontSide, size
    };
    houses.push(house);
    interactableDoors.push(house);
    addCollider(id, center.x, center.z, Math.max(4, size.x * 0.88), Math.max(3.3, size.z * 0.82));
  } else {
    addCollider(id, center.x, center.z, size.x * 0.95, size.z * 0.95);
  }
  return root;
}

function buildInterior({ x, z, frontSide, seed }) {
  const root = new THREE.Group();
  root.name = `${seed}-interior`;
  root.position.set(x, 0, z);
  root.rotation.y = frontSide < 0 ? Math.PI : 0;
  const floor = makeMaterial(0x776a59, 0.92);
  const wall = makeMaterial(0xd8d0bf, 0.94);
  const wallAccent = makeMaterial(seed.endsWith('-b') ? 0x9caea5 : 0xc6ad91, 0.92);
  const dark = makeMaterial(0x3b3d38, 0.75);
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x839ba0, roughness: 0.28, metalness: 0.1, transparent: true, opacity: 0.62 });
  addBox(root, 'interior-floor', 0, -0.12, 0, 7.0, 0.16, 4.4, floor);
  addBox(root, 'interior-ceiling', 0, 3.0, 0, 7.0, 0.14, 4.4, wallAccent, false);
  addBox(root, 'interior-left-wall', -3.43, 0, 0, 0.14, 3.0, 4.4, wall);
  addBox(root, 'interior-right-wall', 3.43, 0, 0, 0.14, 3.0, 4.4, wall);
  addBox(root, 'interior-back-wall', 0, 0, -2.15, 7.0, 3.0, 0.14, wall);
  addBox(root, 'interior-front-left', -2.55, 0, 2.15, 3.0, 3.0, 0.14, wall);
  addBox(root, 'interior-front-right', 2.55, 0, 2.15, 3.0, 3.0, 0.14, wall);
  addBox(root, 'interior-front-lintel', 0, 2.35, 2.15, 1.9, 0.65, 0.14, wall);
  addBox(root, 'interior-divider', 0.95, 0, -0.15, 0.13, 2.65, 3.9, wallAccent);
  addBox(root, 'interior-divider-return', 2.2, 0, 1.05, 2.4, 2.65, 0.13, wallAccent);
  addBox(root, 'interior-window-left', -2.15, 1.66, -2.065, 1.55, 1.05, 0.045, windowMat, false);
  addBox(root, 'interior-window-right', 2.15, 1.66, -2.065, 1.55, 1.05, 0.045, windowMat, false);
  addBox(root, 'interior-window-frame-left-top', -2.15, 2.2, -2.03, 1.72, 0.07, 0.08, dark);
  addBox(root, 'interior-window-frame-left-bottom', -2.15, 1.12, -2.03, 1.72, 0.07, 0.08, dark);
  addBox(root, 'interior-window-frame-left-center', -2.15, 1.66, -2.03, 0.07, 1.05, 0.08, dark);

  // The original remake clamped the player to the room rectangle only.
  // These world-space boxes make the room divider and large furnishings solid.
  root.updateMatrixWorld(true);
  const collisionBoxes = [];
  const addLocalCollider = (name, cx, cz, width, depth) => {
    const center = root.localToWorld(new THREE.Vector3(cx, 0, cz));
    collisionBoxes.push({
      name, minX: center.x - width / 2, maxX: center.x + width / 2,
      minZ: center.z - depth / 2, maxZ: center.z + depth / 2
    });
  };
  addLocalCollider('interior-divider', 0.95, -0.15, 0.13, 3.9);
  addLocalCollider('interior-divider-return', 2.2, 1.05, 2.4, 0.13);

  const ceilingLight = new THREE.PointLight(0xffe3b8, 1.1, 12, 2);
  ceilingLight.position.set(-1, 2.7, -0.2);
  root.add(ceilingLight);
  const kitchenLight = new THREE.PointLight(0xffe9cf, 0.55, 6, 2);
  kitchenLight.position.set(3.0, 2.3, -1.1);
  root.add(kitchenLight);

  const add = async (key, height, px, py, pz, yaw = 0) => {
    const result = await createAsset(key, { height, position: [px, py, pz], rotationY: yaw, parent: root });
    if (key === 'Rug') result.root.scale.set(0.82, 1, 0.65);
    if (interiorFurnitureBlockers.has(key)) {
      result.root.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(result.root);
      if (!box.isEmpty()) {
        const pad = key === 'Chair' || key === 'Stool' ? 0.04 : 0.08;
        const collider = {
          name: `furniture-${key}`,
          minX: box.min.x + pad, maxX: box.max.x - pad,
          minZ: box.min.z + pad, maxZ: box.max.z - pad
        };
        if (collider.minX < collider.maxX && collider.minZ < collider.maxZ) {
          collisionBoxes.push(collider);
        }
      }
    }
    return result;
  };
  const livingFurniture = [
    ['Couch Large', 0.95, -1.9, 0, 0.45, Math.PI],
    ['Rug', null, -1.8, 0.01, 0.05],
    ['Fireplace', 1.8, -2.75, 0, -1.55],
    ['Houseplant', 0.86, -3.0, 0, 1.55],
    ['Table Lamp', 0.62, -0.35, 0.76, -0.5],
    ['Kitchen Fridge', 2.05, 2.9, 0, -1.55, Math.PI],
    ['Kitchen Sink', 1.05, 2.15, 0, -0.75],
    ['Oven', 0.98, 2.9, 0, 0.1],
    ['Table Round Large', 0.78, 1.65, 0, 1.1],
    ['Chair', 0.95, 0.55, 0, 1.0, -Math.PI / 2],
    ['Chair', 0.95, 2.7, 0, 1.0, Math.PI / 2],
    ['Shelf Large', 1.95, -3.0, 0, -0.1, Math.PI / 2],
    ['Cactus', 0.58, -0.25, 0, 2.65]
  ];
  const bedroomFurniture = [
    ['Bed King', 0.9, -1.7, 0, -0.7, Math.PI],
    ['Night Stand', 0.64, -2.8, 0, -1.0],
    ['Bathroom Sink', 0.85, 2.7, 0, -1.3],
    ['Toilet', 0.82, 3.0, 0, -0.15, Math.PI],
    ['Bathtub', 0.72, 1.65, 0, -1.35],
    ['Washing Machine', 0.95, 2.85, 0, 0.75],
    ['Shelf Large', 1.95, -3.0, 0, -0.1, Math.PI / 2],
    ['Houseplant', 0.86, -2.95, 0, 1.45],
    ['Table Lamp', 0.62, -2.8, 0.76, -1.0],
    ['Stool', 0.72, 1.8, 0, 0.9],
    ['Towel Rack', 0.9, 3.05, 1.0, -1.85],
    ['Toilet Paper stack', 0.35, 3.1, 0, -0.5]
  ];
  const buildProps = async () => {
    const furniture = seed.endsWith('-b') ? bedroomFurniture : livingFurniture;
    await Promise.all([
      ...furniture.map(([key, height, px, py, pz, yaw = 0]) => add(key, height, px, py, pz, yaw)),
      add('Ceiling Light', 0.48, -1, 2.86, -0.2),
      add('Curtains Double', 1.55, -2.1, 0.68, -2.05),
      add('Window Large', 1.15, -2.15, 1.62, -2.1),
      add('Window Small', 0.82, 2.15, 1.62, -2.1)
    ]);
  };
  root.userData.collisionBoxes = collisionBoxes;
  root.userData.ready = buildProps();
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
      addCollider('street-light-' + side + '-' + x, x, side * config.z, 0.24, 0.24);
    }
  }
}

async function addVehicles() {
  for (const definition of WORLD_CONFIG.vehicles) {
    const { id, asset, height, position, direction, speed, route } = definition;
    const rotationY = route.axis === 'x'
      ? (direction > 0 ? Math.PI / 2 : -Math.PI / 2)
      : (direction > 0 ? 0 : Math.PI);
    const { root } = await createAsset(asset, {
      height, position, rotationY, parent: world, name: id
    });
    const wheelNodes = [];
    root.traverse((object) => {
      if (object.name && /wheel/i.test(object.name)) wheelNodes.push(object);
    });
    const vehicleBounds = new THREE.Box3().setFromObject(root);
    const vehicleSize = vehicleBounds.getSize(new THREE.Vector3());
    const vehicleCenter = vehicleBounds.getCenter(new THREE.Vector3());
    vehicles.push({
      id, root, wheelNodes, asset, direction, speed, route,
      colliderOffsetX: vehicleCenter.x - root.position.x,
      colliderOffsetZ: vehicleCenter.z - root.position.z,
      colliderHalfWidth: Math.max(1.05, vehicleSize.x * 0.4),
      colliderHalfDepth: Math.max(0.62, vehicleSize.z * 0.4)
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
      definition.id
    )
  ));
}

function addTrees() {
  return Promise.all(WORLD_CONFIG.trees.map(async (definition) => {
    const { id, position, height } = definition;
    const { root } = await createAsset('Tree', {
      height, position, parent: world, name: id
    });
    addCollider('trunk-' + id, position[0], position[2], 0.68, 0.68);
    return root;
  }));
}

function buildBackdrop() {
  const low = makeMaterial(0x8c9386, 0.95);
  addPlane(world, 'far-grass', 0, -0.2, 0, 150, 100, low);
}

async function buildInteriorEntranceMarker(house) {
  const { root } = await createAsset('Door', {
    height: 2.2,
    position: [house.doorPosition.x + (house.frontSide < 0 ? -0.456 : 0.456), 0, house.doorPosition.z - house.frontSide * 0.07],
    rotationY: house.frontSide < 0 ? Math.PI : 0,
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
    const local = currentInterior.interior.worldToLocal(new THREE.Vector3(x, camera.position.y, z));
    const localBounds = { minX: -3.1, maxX: 3.1, minZ: -1.8, maxZ: 1.8 };
    if (!canOccupy(local.x, local.z, playerRadius, localBounds)) return false;
    return canOccupy(x, z, playerRadius, null, currentInterior.interior.userData.collisionBoxes || []);
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
  camera.position.y = 1.7;
}
function nearestDoor() {
  if (currentInterior) return currentInterior;
  let nearest = null;
  let distance = Infinity;
  const forward = camera.getWorldDirection(new THREE.Vector3());

  for (const house of interactableDoors) {
    if (!house.root.visible) continue;

    // Do not allow entering through a side or rear wall.
    const outsideDepth = (camera.position.z - house.center.z) * house.frontSide;
    if (outsideDepth < 0.2) continue;

    const target = { x: house.doorPosition.x, z: house.doorPosition.z };
    if (!isInInteractionRange(camera.position, target, forward, 3.2, 0.28)) continue;

    const dx = camera.position.x - target.x;
    const dz = camera.position.z - target.z;
    const d = Math.hypot(dx, dz);
    if (d < distance) {
      distance = d;
      nearest = house;
    }
  }
  return nearest;
}
function enterHouse(house) {
  house.root.visible = false;
  if (house.marker) house.marker.visible = false;
  house.interior.visible = true;
  currentInterior = house;
  const cameraOffset = new THREE.Vector3(0, 1.7, 1.25).applyAxisAngle(new THREE.Vector3(0, 1, 0), house.frontSide < 0 ? Math.PI : 0);
  camera.position.set(house.center.x + cameraOffset.x, 1.7, house.center.z + cameraOffset.z);
  camera.rotation.set(0, house.frontSide < 0 ? Math.PI : 0, 0, 'YXZ');
  locationLabel.textContent = house.name.toUpperCase().replaceAll('-', ' ') + ' / INTERIOR';
  worldState.textContent = 'INDOOR';
  showToast('ENTERED / PRESS E TO EXIT');
}
function exitHouse() {
  const house = currentInterior;
  if (!house) return;
  house.interior.visible = false;
  house.root.visible = true;
  if (house.marker) house.marker.visible = true;
  currentInterior = null;
  camera.position.set(house.center.x, 1.7, house.doorPosition.z + house.frontSide * 2.4);
  camera.rotation.set(0, house.frontSide < 0 ? Math.PI : 0, 0, 'YXZ');
  locationLabel.textContent = 'DISTRICT 14 / STREET';
  worldState.textContent = 'OUTDOOR';
  showToast('BACK TO THE STREET');
}
function interact() {
  if (currentInterior) {
    exitHouse();
    return;
  }
  const house = nearestDoor();
  if (house) {
    enterHouse(house);
    return;
  }
  showToast('NO INTERACTION IN RANGE');
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
    const next = vehicle.root.position[axis] + vehicle.speed * vehicle.direction * delta;
    if (next > vehicle.route.max) vehicle.root.position[axis] = vehicle.route.min;
    else if (next < vehicle.route.min) vehicle.root.position[axis] = vehicle.route.max;
    else vehicle.root.position[axis] = next;

    for (const wheel of vehicle.wheelNodes) wheel.rotation.x += vehicle.speed * delta * 1.4;
  }
}

function updateUI() {
  coordinates.textContent = `X ${camera.position.x.toFixed(1)} · Z ${camera.position.z.toFixed(1)}`;
  const active = currentInterior || nearestDoor();
  if (currentInterior) hint.textContent = 'E / EXIT HOUSE';
  else if (active) hint.textContent = `LOOK AT DOOR · E / ENTER ${active.name.toUpperCase().replaceAll('-', ' ')}`;
  else hint.textContent = 'WASD MOVE · SHIFT RUN · MOUSE LOOK · E INTERACT';
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
  await Promise.all(houses.map((house) => house.interior.userData.ready));
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
