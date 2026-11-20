/**
 * Runtime validation for editable world data.
 * Validation runs before any world objects are spawned so bad map data fails
 * early with readable diagnostics instead of half-building a broken scene.
 */
export function validateWorldConfig(config, assetManifest) {
  const errors = [];
  const add = (message) => errors.push(message);

  if (!config || typeof config !== 'object') return ['World config must be an object.'];
  if (typeof config.id !== 'string' || !config.id.trim()) add('World config needs a non-empty id.');
  if (!Number.isInteger(config.version) || config.version < 1) add('World config version must be a positive integer.');

  const bounds = config.bounds;
  if (!bounds || !['minX', 'maxX', 'minZ', 'maxZ'].every((key) => Number.isFinite(bounds[key])) ||
      bounds.minX >= bounds.maxX || bounds.minZ >= bounds.maxZ) {
    add('World bounds must contain finite, increasing min/max X/Z values.');
  }

  const checkVector3 = (value, label) => {
    if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
      add(`${label} must be a finite [x, y, z] vector.`);
      return false;
    }
    return true;
  };

  if (!config.spawn || !checkVector3(config.spawn.position, 'World spawn position')) {
    // The vector validation already added a useful message.
  }
  if (config.spawn?.rotation && (!Array.isArray(config.spawn.rotation) ||
      config.spawn.rotation.length !== 3 || !config.spawn.rotation.every(Number.isFinite))) {
    add('World spawn rotation must be a finite [x, y, z] vector.');
  }

  if (!assetManifest || typeof assetManifest !== 'object') add('Asset manifest must be an object.');

  const ids = new Set();
  const collections = ['buildings', 'streetProps', 'trees', 'vehicles', 'pedestrians'];
  for (const collectionName of collections) {
    const items = config[collectionName];
    if (!Array.isArray(items)) {
      add(`World collection "${collectionName}" must be an array.`);
      continue;
    }
    for (const item of items) {
      if (!item || typeof item !== 'object') {
        add(`World collection "${collectionName}" contains an invalid entry.`);
        continue;
      }
      if (typeof item.id !== 'string' || !item.id.trim()) {
        add(`Entry in "${collectionName}" is missing a stable id.`);
      } else if (ids.has(item.id)) {
        add(`Duplicate world entity id: ${item.id}`);
      } else {
        ids.add(item.id);
      }
      if (typeof item.asset !== 'string' || !assetManifest?.[item.asset]) {
        add(`World entity "${item.id || '(unnamed)'}" references missing asset "${item.asset}".`);
      }
      const validPosition = checkVector3(item.position, `World entity "${item.id || '(unnamed)'}" position`);
      if (validPosition && bounds) {
        const [x, , z] = item.position;
        if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) {
          add(`World entity "${item.id}" is outside world bounds.`);
        }
      }
      if (!Number.isFinite(item.height) || item.height <= 0) {
        add(`World entity "${item.id || '(unnamed)'}" needs a positive height.`);
      }
      if (item.rotationY !== undefined && !Number.isFinite(item.rotationY)) {
        add(`World entity "${item.id || '(unnamed)'}" has an invalid rotationY.`);
      }
      if (!Object.prototype.hasOwnProperty.call(item, 'collision')) {
        add(`World entity "${item.id || '(unnamed)'}" must declare a collision profile or collision: false.`);
      } else if (item.collision !== false && (!item.collision || typeof item.collision !== 'object')) {
        add(`World entity "${item.id || '(unnamed)'}" has an invalid collision profile.`);
      } else if (item.collision && collectionName === 'streetProps') {
        if (item.collision.type !== 'bounds' || !Number.isFinite(item.collision.scale) ||
            item.collision.scale <= 0 || !Number.isFinite(item.collision.minSize) ||
            item.collision.minSize <= 0) add(`Street prop "${item.id}" has an invalid bounds collision profile.`);
      } else if (item.collision && collectionName === 'buildings') {
        const c = item.collision;
        if (c.type !== 'bounds' || !['scaleX', 'scaleZ', 'minWidth', 'minDepth'].every((key) => Number.isFinite(c[key]) && c[key] > 0)) {
          add(`Building "${item.id}" has an invalid bounds collision profile.`);
        }
      } else if (item.collision && collectionName === 'trees') {
        if (item.collision.type !== 'cylinder' || !Number.isFinite(item.collision.radius) || item.collision.radius <= 0) {
          add(`Tree "${item.id}" has an invalid trunk collision profile.`);
        }
      } else if (item.collision && collectionName === 'vehicles') {
        const c = item.collision;
        if (c.type !== 'bounds' || !['scaleX', 'scaleZ', 'minHalfWidth', 'minHalfDepth'].every((key) => Number.isFinite(c[key]) && c[key] > 0)) {
          add(`Vehicle "${item.id}" has an invalid collision profile.`);
        }
      } else if (item.collision && collectionName === 'pedestrians') {
        const c = item.collision;
        if (c.type !== 'bounds' || !['halfWidth', 'halfDepth'].every((key) => Number.isFinite(c[key]) && c[key] > 0)) {
          add(`Pedestrian "${item.id}" has an invalid collision profile.`);
        }
      }
      if (collectionName === 'buildings' && !['house', 'backdrop'].includes(item.role)) {
        add(`Building "${item.id || '(unnamed)'}" must declare role "house" or "backdrop".`);
      }
      if (collectionName === 'buildings' && item.role === 'house' && ![-1, 1].includes(item.frontSide)) {
        add(`House "${item.id}" must declare frontSide as -1 or 1.`);
      }
      if (collectionName === 'vehicles') {
        if (!Number.isFinite(item.speed) || item.speed <= 0 || ![-1, 1].includes(item.direction)) {
          add(`Vehicle "${item.id}" has invalid speed or direction.`);
        }
        if (!item.route || !['x', 'z'].includes(item.route.axis) ||
            !Number.isFinite(item.route.min) || !Number.isFinite(item.route.max) ||
            item.route.min >= item.route.max) {
          add(`Vehicle "${item.id}" has an invalid route.`);
        }
      }
      if (collectionName === 'pedestrians') {
        if (!Number.isFinite(item.speed) || item.speed <= 0 ||
            !item.path || !['x', 'z'].includes(item.path.axis) ||
            !Number.isFinite(item.path.min) || !Number.isFinite(item.path.max) ||
            item.path.min >= item.path.max) {
          add(`Pedestrian "${item.id}" has an invalid walking path or speed.`);
        }
      }
    }
  }

  if (config.fences) {
    if (!assetManifest?.[config.fences.asset]) add(`Fence system references missing asset "${config.fences.asset}".`);
    for (const key of ['height', 'startX', 'spacing', 'z']) {
      if (!Number.isFinite(config.fences[key])) add(`Fence configuration has invalid ${key}.`);
    }
    if (!Number.isInteger(config.fences.count) || config.fences.count < 0) add('Fence count must be a non-negative integer.');
    if (!Array.isArray(config.fences.sides) || !config.fences.sides.every((side) => [-1, 1].includes(side))) {
      add('Fence sides must be an array containing only -1 and 1.');
    }
    if (!config.fences.collision || !Number.isFinite(config.fences.collision.scale) ||
        config.fences.collision.scale <= 0 || !Number.isFinite(config.fences.collision.minSize) ||
        config.fences.collision.minSize <= 0) add('Fence collision profile is invalid.');
  }

  if (bounds && config.spawn?.position && config.spawn.position.length === 3 &&
      config.spawn.position.every(Number.isFinite)) {
    const [x, , z] = config.spawn.position;
    if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) {
      add('World spawn must be inside world bounds.');
    }
  }

  return errors;
}

export function assertValidWorldConfig(config, assetManifest) {
  const errors = validateWorldConfig(config, assetManifest);
  if (errors.length) {
    throw new Error('Invalid world configuration:\n- ' + errors.join('\n- '));
  }
  return true;
}
