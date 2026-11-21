/**
 * District 14 reference settlement.
 * All geometry is authored in metres. The first slice is deliberately one
 * measured building, one connected access path and one simple residential street.
 */
export const WORLD_CONFIG = {
  id: 'district-14',
  version: 3,
  units: 'meters',

  bounds: { minX: -20, maxX: 20, minZ: -16, maxZ: 14 },
  spawn: {
    position: [0, 1.7, -4.0],
    rotation: [0, 0, 0]
  },

  environment: {
    background: 0xb9c2c2,
    fogColor: 0xb9c2c2,
    fogDensity: 0.0065
  },

  street: {
    ground: { position: [0, -0.11, -1.4], size: [38, 28] },
    road: { position: [0, -0.025, 0], size: [36, 6] },
    sidewalk: { z: 4.0, width: 36, depth: 1.6, y: 0.015 },
    curb: { z: 3.1, width: 36, depth: 0.2, height: 0.14, y: -0.02 },
    entryPath: { width: 1.8, thickness: 0.07, thresholdDepth: 0.64 }
  },

  buildings: [
    {
      id: 'house-001',
      asset: 'Building Green',
      position: [0, 0, -8.8],
      height: 13.4,
      rotationY: 0,
      role: 'house',
      frontSide: 1,
      architecture: {
        storeys: 4,
        // Calibrated to the four visible facade bands in building-green.glb.
        // Level zero is the actual door threshold, not an assumed ground datum.
        floorLevels: [0, 3.30, 5.77, 8.28, 11.95],
        wallThickness: 0.18,
        slabThickness: 0.16,
        stairFlightWidth: 0.98,
        stairTreads: 10
      },
      collision: { type: 'bounds', scaleX: 0.94, scaleZ: 0.9, minWidth: 4, minDepth: 3.3 }
    }
  ],

  // D14 hierarchy is grown deliberately: district -> street -> parcel -> house
  // -> storeys -> rooms. The shared stairwell belongs to the building.
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
                      { id: 'house-001-ground-left-room', type: 'room' },
                      { id: 'house-001-ground-right-room', type: 'room' }
                    ]
                  },
                  {
                    id: 'house-001-first-floor',
                    type: 'storey',
                    children: [
                      { id: 'house-001-first-left-room', type: 'room' },
                      { id: 'house-001-first-right-room', type: 'room' }
                    ]
                  },
                  {
                    id: 'house-001-second-floor',
                    type: 'storey',
                    children: [
                      { id: 'house-001-second-left-room', type: 'room' },
                      { id: 'house-001-second-right-room', type: 'room' }
                    ]
                  },
                  {
                    id: 'house-001-third-floor',
                    type: 'storey',
                    children: [
                      { id: 'house-001-third-left-room', type: 'room' },
                      { id: 'house-001-third-right-room', type: 'room' }
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

  streetProps: [],
  trees: [],
  vehicles: [],
  pedestrians: [],

  streetLights: {
    sides: [],
    positionsX: [],
    z: 4.0,
    poleHeight: 4.4,
    collision: { radius: 0.12 }
  }
};
