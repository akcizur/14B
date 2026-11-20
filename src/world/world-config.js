/**
 * District 14 world definition.
 *
 * Coordinates are in meters. This file is the authoring surface for the current
 * Free Play world: add or move locations here instead of editing the renderer.
 * Runtime systems consume these definitions and validate them before spawning.
 */
export const WORLD_CONFIG = {
  id: 'district-14',
  version: 1,
  units: 'meters',

  bounds: { minX: -40, maxX: 40, minZ: -29, maxZ: 29 },
  spawn: {
    position: [0, 1.7, 4],
    rotation: [0, 0, 0]
  },

  environment: {
    background: 0xaebcc0,
    fogColor: 0xaebcc0,
    fogDensity: 0.0082
  },

  street: {
    ground: { position: [0, -0.11, 0], size: [94, 70] },
    road: { position: [0, -0.025, 0], size: [82, 9] },
    sidewalk: { z: 5.9, width: 82, depth: 2.45, y: 0.015 },
    curb: { z: 4.62, width: 82, depth: 0.2, height: 0.16, y: -0.03 },
    gardens: { z: 14.3, width: 82, depth: 13, y: 0 },
    entryPath: { width: 1.5, thickness: 0.07, thresholdDepth: 0.8 },
    laneMarkings: { startX: -37, endX: 37, step: 8, width: 3.6, depth: 0.12, y: 0.004 },
    crosswalks: { centersX: [-25, 25], firstOffset: -4, lastOffset: 4, spacing: 0.82, width: 0.43, depth: 8.2, y: 0.008 },
    manhole: { position: [5, 0.01, 0.45], radius: 0.38 }
  },

  buildings: [
    { id: 'house-a', asset: 'Building Green', position: [-10.5, 0, -12.5], height: 10.1, rotationY: 0, role: 'house', frontSide: 1, architecture: { storeys: 3 }, collision: { type: 'bounds', scaleX: 0.88, scaleZ: 0.82, minWidth: 4, minDepth: 3.3 } },
    { id: 'house-b', asset: 'Building Red', position: [10.5, 0, 12.5], height: 10.1, rotationY: Math.PI, role: 'house', frontSide: -1, architecture: { storeys: 3 }, collision: { type: 'bounds', scaleX: 0.88, scaleZ: 0.82, minWidth: 4, minDepth: 3.3 } },
    { id: 'city-corner-west', asset: 'Building Red Corner', position: [-26.5, 0, -17.5], height: 13.5, rotationY: 0, role: 'backdrop', collision: { type: 'bounds', scaleX: 0.95, scaleZ: 0.95, minWidth: 0.3, minDepth: 0.3 } },
    { id: 'city-brown-east', asset: 'Brown Building', position: [27.5, 0, 17.5], height: 15.5, rotationY: Math.PI, role: 'backdrop', collision: { type: 'bounds', scaleX: 0.95, scaleZ: 0.95, minWidth: 0.3, minDepth: 0.3 } },
    { id: 'city-center-background', asset: 'Big Building', position: [0, 0, -25.8], height: 17.0, rotationY: 0, role: 'backdrop', collision: { type: 'bounds', scaleX: 0.95, scaleZ: 0.95, minWidth: 0.3, minDepth: 0.3 } },
    { id: 'city-low-south', asset: 'Small Building', position: [0, 0, 25.5], height: 9.2, rotationY: Math.PI, role: 'backdrop', collision: { type: 'bounds', scaleX: 0.95, scaleZ: 0.95, minWidth: 0.3, minDepth: 0.3 } }
  ],

  streetProps: [
    { id: 'bench-west', asset: 'Bench', height: 0.86, position: [-18, 0, -6], rotationY: 0, collision: { type: 'bounds', scale: 0.82, minSize: 0.34 } },
    { id: 'bench-east', asset: 'Bench', height: 0.86, position: [18, 0, 6], rotationY: Math.PI, collision: { type: 'bounds', scale: 0.82, minSize: 0.34 } },
    { id: 'mailbox-west', asset: 'Mailbox', height: 1.0, position: [-14.8, 0, -7.8], rotationY: 0, collision: { type: 'bounds', scale: 0.72, minSize: 0.28 } },
    { id: 'mailbox-east', asset: 'Mailbox', height: 1.0, position: [14.8, 0, 7.8], rotationY: Math.PI, collision: { type: 'bounds', scale: 0.72, minSize: 0.28 } },
    { id: 'planter-west', asset: 'Planter & Bushes', height: 1.1, position: [-20, 0, -8.1], rotationY: 0, collision: { type: 'bounds', scale: 0.62, minSize: 0.45 } },
    { id: 'planter-east', asset: 'Planter & Bushes', height: 1.1, position: [20, 0, 8.1], rotationY: Math.PI, collision: { type: 'bounds', scale: 0.62, minSize: 0.45 } },
    { id: 'traffic-light-west', asset: 'Traffic Light', height: 4.1, position: [-25, 0, -4.7], rotationY: 0, collision: { type: 'bounds', scale: 0.18, minSize: 0.28 } },
    { id: 'traffic-light-east', asset: 'Traffic Light', height: 4.1, position: [25, 0, 4.7], rotationY: Math.PI, collision: { type: 'bounds', scale: 0.18, minSize: 0.28 } },
    { id: 'stop-sign-west', asset: 'Stop sign', height: 2.05, position: [-34, 0, 6], rotationY: 0, collision: { type: 'bounds', scale: 0.2, minSize: 0.28 } },
    { id: 'hydrant-east', asset: 'Fire hydrant', height: 0.95, position: [3.8, 0, -6.2], rotationY: 0, collision: { type: 'bounds', scale: 0.7, minSize: 0.3 } },
    { id: 'trash-east', asset: 'Trash Can', height: 0.95, position: [21.5, 0, -6.2], rotationY: 0, collision: { type: 'bounds', scale: 0.75, minSize: 0.32 } },
    { id: 'manhole-west', asset: 'Manhole Cover', height: 0.04, position: [-5, 0, 0.6], rotationY: 0, collision: false },
    { id: 'power-box-west', asset: 'Power Box', height: 1.45, position: [-18, 0, -8.1], rotationY: 0, collision: { type: 'bounds', scale: 0.82, minSize: 0.34 } },
    { id: 'bus-stop-east', asset: 'Bus Stop', height: 2.8, position: [28, 0, 6.9], rotationY: Math.PI, collision: { type: 'bounds', scale: 0.82, minSize: 0.4 } },
    { id: 'bus-stop-sign-east', asset: 'Bus stop sign', height: 2.0, position: [29.7, 0, 6.5], rotationY: Math.PI, collision: { type: 'bounds', scale: 0.35, minSize: 0.28 } },
    { id: 'greenhouse-west', asset: 'Greenhouse', height: 2.4, position: [-26, 0, -14], rotationY: 0, collision: { type: 'bounds', scale: 0.88, minSize: 0.4 } },
    { id: 'dumpster-east', asset: 'Dumpster', height: 1.55, position: [25, 0, -10.4], rotationY: 0, collision: { type: 'bounds', scale: 0.82, minSize: 0.4 } },
    { id: 'air-conditioner-west', asset: 'Air conditioner', height: 0.8, position: [-10, 6.5, -12.8], rotationY: Math.PI, collision: false },
    { id: 'washing-line-east', asset: 'Washing Line', height: 1.75, position: [10, 0, 13.2], rotationY: 0, collision: { type: 'bounds', scale: 0.86, minSize: 0.3 } }
  ],

  fences: {
    asset: 'Fence',
    height: 1.1,
    sides: [-1, 1],
    startX: -17,
    count: 9,
    spacing: 1.15,
    z: 20.45,
    collision: { type: 'bounds', scale: 0.92, minSize: 0.22 }
  },

  streetLights: {
    sides: [-1, 1],
    positionsX: [-30, -10, 10, 30],
    z: 5.95,
    poleHeight: 4.4,
    collision: { radius: 0.12 }
  },

  trees: [
    { id: 'tree-01', asset: 'Tree', position: [-27, 0, -16], height: 7.1, collision: { type: 'cylinder', radius: 0.34 } },
    { id: 'tree-02', asset: 'Tree', position: [-21, 0, -19], height: 7.45, collision: { type: 'cylinder', radius: 0.34 } },
    { id: 'tree-03', asset: 'Tree', position: [-5, 0, -17], height: 7.8, collision: { type: 'cylinder', radius: 0.34 } },
    { id: 'tree-04', asset: 'Tree', position: [6, 0, -17], height: 7.1, collision: { type: 'cylinder', radius: 0.34 } },
    { id: 'tree-05', asset: 'Tree', position: [22, 0, -18], height: 7.45, collision: { type: 'cylinder', radius: 0.34 } },
    { id: 'tree-06', asset: 'Tree', position: [29, 0, -14], height: 7.8, collision: { type: 'cylinder', radius: 0.34 } },
    { id: 'tree-07', asset: 'Tree', position: [-27, 0, 16], height: 7.1, collision: { type: 'cylinder', radius: 0.34 } },
    { id: 'tree-08', asset: 'Tree', position: [-21, 0, 19], height: 7.45, collision: { type: 'cylinder', radius: 0.34 } },
    { id: 'tree-09', asset: 'Tree', position: [-5, 0, 17], height: 7.8, collision: { type: 'cylinder', radius: 0.34 } },
    { id: 'tree-10', asset: 'Tree', position: [6, 0, 17], height: 7.1, collision: { type: 'cylinder', radius: 0.34 } },
    { id: 'tree-11', asset: 'Tree', position: [22, 0, 18], height: 7.45, collision: { type: 'cylinder', radius: 0.34 } },
    { id: 'tree-12', asset: 'Tree', position: [29, 0, 14], height: 7.8, collision: { type: 'cylinder', radius: 0.34 } }
  ],

  vehicles: [
    { id: 'traffic-car-west', asset: 'Car', height: 1.42, position: [-28, 0, -1.62], direction: 1, speed: 7.2, route: { axis: 'x', min: -44, max: 44 }, collision: { type: 'bounds', scaleX: 0.4, scaleZ: 0.4, minHalfWidth: 1.05, minHalfDepth: 0.62 } },
    { id: 'traffic-suv-east', asset: 'SUV', height: 1.53, position: [-9, 0, 1.62], direction: -1, speed: 5.8, route: { axis: 'x', min: -44, max: 44 }, collision: { type: 'bounds', scaleX: 0.4, scaleZ: 0.4, minHalfWidth: 1.05, minHalfDepth: 0.62 } },
    { id: 'traffic-pickup-west', asset: 'Pickup Truck', height: 1.58, position: [12, 0, -1.62], direction: 1, speed: 6.1, route: { axis: 'x', min: -44, max: 44 }, collision: { type: 'bounds', scaleX: 0.4, scaleZ: 0.4, minHalfWidth: 1.05, minHalfDepth: 0.62 } },
    { id: 'traffic-police-east', asset: 'Police Car', height: 1.4, position: [28, 0, 1.62], direction: -1, speed: 7.4, route: { axis: 'x', min: -44, max: 44 }, collision: { type: 'bounds', scaleX: 0.4, scaleZ: 0.4, minHalfWidth: 1.05, minHalfDepth: 0.62 } },
    { id: 'traffic-van-east', asset: 'Van', height: 1.55, position: [-18, 0, 1.62], direction: -1, speed: 5.2, route: { axis: 'x', min: -44, max: 44 }, wheelLayout: { radius: 0.29, width: 0.15, lateralRatio: 0.41, longitudinalRatio: 0.32 }, collision: { type: 'bounds', scaleX: 0.4, scaleZ: 0.4, minHalfWidth: 1.05, minHalfDepth: 0.62 } },
    { id: 'traffic-bus-west', asset: 'Bus', height: 3.05, position: [4, 0, -1.68], direction: 1, speed: 3.7, route: { axis: 'x', min: -44, max: 44 }, wheelLayout: { radius: 0.44, width: 0.22, lateralRatio: 0.42, longitudinalRatio: 0.34 }, collision: { type: 'bounds', scaleX: 0.4, scaleZ: 0.4, minHalfWidth: 1.05, minHalfDepth: 0.62 } }
  ],

  pedestrians: [
    { id: 'walker-man-a', asset: 'Man', height: 1.82, position: [-24, 0, -6], path: { min: -26, max: 22, axis: 'x' }, speed: 0.78, animation: { walkSpeed: 1.2 }, interaction: { name: 'Soused', text: 'Dobrý večer. Jen se vracím domů.', radius: 2.35 }, collision: { type: 'bounds', halfWidth: 0.28, halfDepth: 0.28 } },
    { id: 'walker-woman-a', asset: 'Animated Woman', height: 1.78, position: [20, 0, 6], path: { min: -20, max: 25, axis: 'x' }, speed: 0.64, animation: { walkSpeed: 1.2 }, interaction: { name: 'Sousedka', text: 'Ráno je tu největší klid. Večer už je ulice živější.', radius: 2.35 }, collision: { type: 'bounds', halfWidth: 0.28, halfDepth: 0.28 } },
    { id: 'walker-adventurer', asset: 'Adventurer', height: 1.72, position: [-8, 0, -6.2], path: { min: -23, max: 23, axis: 'x' }, speed: 0.55, animation: { walkSpeed: 1.2 }, interaction: { name: 'Návštěvník', text: 'Zkouším si najít cestu přes celé sídliště.', radius: 2.35 }, collision: { type: 'bounds', halfWidth: 0.28, halfDepth: 0.28 } },
    { id: 'walker-woman-b', asset: 'Animated Woman-nIItLV9nxS', height: 1.76, position: [8, 0, 6.25], path: { min: -24, max: 24, axis: 'x' }, speed: 0.72, animation: { walkSpeed: 1.2 }, interaction: { name: 'Sousedka', text: 'Autobus dnes zase nabírá zpoždění.', radius: 2.35 }, collision: { type: 'bounds', halfWidth: 0.28, halfDepth: 0.28 } }
  ]
};
