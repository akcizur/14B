const ALLOWED_CHILDREN = {
  district: new Set(['street']),
  street: new Set(['block', 'parcel']),
  block: new Set(['parcel']),
  parcel: new Set(['building']),
  building: new Set(['storey', 'stairwell']),
  storey: new Set(['room']),
  room: new Set([]),
  stairwell: new Set([])
};

export function flattenWorldHierarchy(root) {
  if (!root || typeof root !== 'object') return [];
  const result = [];
  const visit = (node, parent = null, depth = 0) => {
    result.push({ id: node.id, type: node.type, parentId: parent?.id ?? null, depth });
    for (const child of node.children || []) visit(child, node, depth + 1);
  };
  visit(root);
  return result;
}

export function validateWorldHierarchy(root, buildings = []) {
  const errors = [];
  const ids = new Set();
  const buildingMap = new Map(buildings.map((building) => [building.id, building]));
  const seenBuildings = new Set();

  if (!root || root.type !== 'district' || typeof root.id !== 'string' || !root.id.trim()) {
    return ['World hierarchy must start with a named district node.'];
  }

  const visit = (node, parent = null) => {
    if (!node || typeof node !== 'object') {
      errors.push('World hierarchy contains an invalid node.');
      return;
    }
    if (typeof node.id !== 'string' || !node.id.trim()) {
      errors.push('World hierarchy nodes need stable non-empty IDs.');
      return;
    }
    if (ids.has(node.id)) errors.push(`Duplicate hierarchy ID: ${node.id}`);
    ids.add(node.id);

    if (!Object.hasOwn(ALLOWED_CHILDREN, node.type)) {
      errors.push(`Hierarchy node "${node.id}" has unsupported type "${node.type}".`);
      return;
    }
    if (parent && !ALLOWED_CHILDREN[parent.type].has(node.type)) {
      errors.push(`Hierarchy node "${node.id}" of type "${node.type}" cannot be a child of "${parent.type}".`);
    }
    if (node.type === 'building') {
      if (!buildingMap.has(node.id)) errors.push(`Hierarchy building "${node.id}" has no matching building definition.`);
      else seenBuildings.add(node.id);
      const storeys = (node.children || []).filter((child) => child?.type === 'storey');
      const definition = buildingMap.get(node.id);
      if (definition?.architecture?.storeys !== storeys.length) {
        errors.push(`Hierarchy building "${node.id}" storey count does not match its architecture definition.`);
      }
    }
    if (node.children !== undefined && !Array.isArray(node.children)) {
      errors.push(`Hierarchy node "${node.id}" children must be an array.`);
      return;
    }
    for (const child of node.children || []) visit(child, node);
  };

  visit(root);
  for (const building of buildings) {
    if (!seenBuildings.has(building.id)) errors.push(`Building "${building.id}" is missing from the world hierarchy.`);
  }
  return errors;
}

export function assertValidWorldHierarchy(root, buildings = []) {
  const errors = validateWorldHierarchy(root, buildings);
  if (errors.length) throw new Error('Invalid world hierarchy:\\n- ' + errors.join('\\n- '));
  return true;
}
