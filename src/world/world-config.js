/**
 * District 14 starter settlement.
 *
 * All world distances are metres. The first playable slice deliberately keeps
 * only the primary street corridor and one reference house. Growth happens by
 * adding parcels and buildings to the hierarchy, not by scattering props.
 */
export const WORLD_CONFIG = {
  id: 'district-14',
  version: 2,
  units: 'meters',

  bounds: { minX: -28, maxX: 28, minZ: -23, maxZ: 23 },
  spawn: {
    position: [0, 1.7, 6.15],
    rotation: [0, 0, 0]
  },

  environment: {
    background: 0xaebcc0,
    fogColor: 0xaebcc0,
    fogDensity: 0.0082
  },

  street: {
    ground: { position: [0, -0.11, 0], size: [60, 50] },
    road: { position: [0, -0.025, 0], size: [54, 9] },
    sidewalk: { z: 5.9, width: 54, depth: 2.45, y: 0.015 },
    curb: { z: 4.62, width: 54, depth: 0.2, height: 0.16, y: -0.03 },
    entryPath: { width: 1.45, thickness: 0.07, thresholdDepth: 0.8 },
    laneMarkings: { startX: -24, endX: 24, step: 8, width: 3.2, depth: 0.1, y: 0.004 },
    crosswalks: { centersX: [0], firstOffset: -4, lastOffset: 4, spacing: 0.82, width: 0.43, depth: 8.2, y: 0.008 }
  },

  buildings: [
    {
      id: 'house-001',
      asset: 'Building Green',
      position: [0, 0, -13],
      height: 10.1,
      rotationY: 0,
      role: 'house',
      frontSide: 1,
      architecture: { storeys: 3, wallThickness: 0.18, slabThickness: 0.16 },
      collision: { type: 'bounds', scaleX: 0.88, scaleZ: 0.82, minWidth: 4, minDepth: 3.3 }
    }
  ],

  // Settlement grows in a deliberate order:
  // district -> street -> parcel -> building -> storey -> rooms.
  hierarchy: {
    id: 'district-14',
    type: 'district',
    children: [
      {
        id: 'street-main',
        type: 'street',
        children: [
          {
            id: 'parcel-001',
            type: 'parcel',
            children: [
              {
                id: 'house-001',
                type: 'building',
                children: [
                  { id: 'house-001-stairwell', type: 'stairwell' },
                  {
                    id: 'house-001-ground-floor',
                    type: 'storey',
                    children: [
                      { id: 'house-001-entry-hall', type: 'room' },
                      { id: 'house-001-living-room', type: 'room' },
                      { id: 'house-001-service-room', type: 'room' }
                    ]
                  },
                  {
                    id: 'house-001-first-floor',
                    type: 'storey',
                    children: [
                      { id: 'house-001-first-corridor', type: 'room' },
                      { id: 'house-001-first-room-a', type: 'room' },
                      { id: 'house-001-first-room-b', type: 'room' }
                    ]
                  },
                  {
                    id: 'house-001-second-floor',
                    type: 'storey',
                    children: [
                      { id: 'house-001-second-corridor', type: 'room' },
                      { id: 'house-001-second-room-a', type: 'room' },
                      { id: 'house-001-second-room-b', type: 'room' }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },

  // Empty collections are deliberate: this first slice is the reference
  // building + the street. Add a system only when the next growth phase needs it.
  streetProps: [],
  trees: [],
  vehicles: [],
  pedestrians: [],

  streetLights: {
    sides: [],
    positionsX: [],
    z: 5.95,
    poleHeight: 4.4,
    collision: { radius: 0.12 }
  }
};
