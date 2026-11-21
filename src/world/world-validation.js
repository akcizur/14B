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

  const positive = (value) => Number.isFinite(value) && value > 0;
  const checkSize2 = (value, label) => {
    if (!Array.isArray(value) || value.length !== 2 || !value.every(positive)) {
      add(`${label} must contain two positive finite dimensions.`);
    }
  };
  if (!config.environment || !Number.isFinite(config.environment.background) ||
      !Number.isFinite(config.environment.fogColor) || !positive(config.environment.fogDensity)) {
    add('World environment settings are invalid.');
  }
  if (!config.street || typeof config.street !== 'object') {
    add('World street geometry is missing.');
  } else {
    for (const key of ['ground', 'road']) {
      const definition = config.street[key];
      if (!definition || !checkVector3(definition.position, `Street ${key} position`)) continue;
      checkSize2(definition.size, `Street ${key} size`);
    }
    for (const key of ['sidewalk', 'curb']) {
      const definition = config.street[key];
      if (!definition || !Object.values(definition).every(Number.isFinite)) add(`Street ${key} dimensions are invalid.`);
    }
    const lanes = config.street.laneMarkings;
    if (!lanes || !['startX', 'endX', 'step', 'width', 'depth', 'y'].every((key) => Number.isFinite(lanes[key])) ||
        lanes.startX > lanes.endX || !positive(lanes.step) || !positive(lanes.width) || !positive(lanes.depth)) {
      add('Street lane marking configuration is invalid.');
    }
    const crossing = config.street.crosswalks;
    if (!crossing || !Array.isArray(crossing.centersX) || !crossing.centersX.every(Number.isFinite) ||
        !['firstOffset', 'lastOffset', 'spacing', 'width', 'depth', 'y'].every((key) => Number.isFinite(crossing[key])) ||
        crossing.firstOffset > crossing.lastOffset || !positive(crossing.spacing) ||
        !positive(crossing.width) || !positive(crossing.depth)) {
      add('Street crosswalk configuration is invalid.');
    }
    if (config.street.manhole && (!checkVector3(config.street.manhole.position, 'Manhole position') ||
        !positive(config.street.manhole.radius))) add('Manhole configuration is invalid.');
  }
  const entryPath = config.street?.entryPath;
  if (!entryPath || !positive(entryPath.width) || !positive(entryPath.thickness) ||
      !positive(entryPath.thresholdDepth)) {
    add('Street entry path dimensions are invalid.');
  }

  if (!config.streetLights || !Array.isArray(config.streetLights.sides) ||
      !config.streetLights.sides.every((side) => [-1, 1].includes(side)) ||
      !Array.isArray(config.streetLights.positionsX) || !config.streetLights.positionsX.every(Number.isFinite) ||
      !positive(config.streetLights.z) || !positive(config.streetLights.poleHeight) ||
      !config.streetLights.collision || !positive(config.streetLights.collision.radius)) {
    add('Street light configuration or collision profile is invalid.');
  }

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
      if (collectionName === 'buildings' && item.role === 'house') {
        const architecture = item.architecture;
        if (!architecture || !Number.isInteger(architecture.storeys) ||
            architecture.storeys < 2 || architecture.storeys > 5) {
          add(`House "${item.id}" must declare 2–5 architectural storeys.`);
        } else if (architecture.floorLevels !== undefined &&
            (!Array.isArray(architecture.floorLevels) ||
             architecture.floorLevels.length !== architecture.storeys + 1 ||
             architecture.floorLevels[0] !== 0 ||
             architecture.floorLevels.some((value, index, all) =>
               !Number.isFinite(value) || (index > 0 && value - all[index - 1] < 2.25)))) {
          add(`House "${item.id}" has invalid metric floor levels.`);
        }
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
        if (['Van', 'Bus'].includes(item.asset)) {
          const layout = item.wheelLayout;
          if (!layout || !['radius', 'width', 'lateralRatio', 'longitudinalRatio'].every((key) =>
            Number.isFinite(layout[key]) && layout[key] > 0
          ) || layout.lateralRatio >= 0.5 || layout.longitudinalRatio >= 0.5) {
            add(`Vehicle "${item.id}" needs a valid asset-specific fallback wheel layout.`);
          }
        }
      }
      if (collectionName === 'pedestrians') {
        if (!item.interaction || typeof item.interaction.name !== 'string' ||
            !item.interaction.name.trim() || typeof item.interaction.text !== 'string' ||
            !item.interaction.text.trim() || !Number.isFinite(item.interaction.radius) ||
            item.interaction.radius <= 0 || item.interaction.radius > 5) {
          add(`Pedestrian "${item.id}" needs a valid proximity interaction definition.`);
        }
        if (item.animation && (!Number.isFinite(item.animation.walkSpeed) || item.animation.walkSpeed <= 0)) {
          add(`Pedestrian "${item.id}" has an invalid authored walk speed.`);
        }
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
