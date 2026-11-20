# DISTRICT 14

District 14 is a Three.js + Vite first-person neighbourhood sandbox. The world is being rebuilt as a deliberately small, dimensionally consistent settlement rather than a crowded showcase.

## Current playable slice

- One primary road corridor with sidewalks and a pedestrian crossing.
- One reference house on one parcel.
- Three structural storeys generated from the measured dimensions of the house's local GLB shell.
- Interior floor slabs, wall thickness, a U-shaped stair core, corridor, room divisions, door openings, window apertures, frames and glazing.
- A generated entrance landing and access path connected to the nearest sidewalk from the computed facade entrance anchor.
- No furniture, appliances, loose decoration, traffic, pedestrians, perimeter clutter or extra buildings in this stage.

The model catalogue remains in `public/models/` for later expansion. Only assets referenced by the current world definition are loaded at runtime.

## Run locally

Requires Node.js 20 or newer.

```sh
npm install
npm run dev
```

For checks and a production build:

```sh
npm test
npm run build
npm run preview
```

## Controls

| Input | Action |
|---|---|
| `W A S D` or arrow keys | Move |
| `Shift` | Run |
| Mouse | Look |
| `E` | Enter / exit the house |
| `Esc` | Pause / release mouse |

## World growth model

The editable hierarchy is intentionally explicit:

```text
District
└── Street
    └── Parcel
        └── Building
            ├── Stairwell
            ├── Ground floor
            │   └── Rooms
            ├── First floor
            │   └── Rooms
            └── Second floor
                └── Rooms
```

Future houses are added as new parcels along the existing street. Only after the street frontage, plot dimensions, building access and house scale are stable do we add further streets, junctions and blocks. The current scene is the scale reference for those additions.

## Project layout

- `src/main.js`: runtime, scene creation, input and interaction.
- `src/world/world-config.js`: editable road, parcel building definitions and settlement hierarchy.
- `src/world/world-validation.js`: validates world entities, model keys, dimensions and collision definitions.
- `src/world/world-hierarchy.js`: validates the district → street → parcel → building → storey → room hierarchy.
- `src/world/building-architecture.js`: measures GLB shells and builds dimension-matched floorplates, stair flights, partitions, wall openings, window frames and glass.
- `src/collision.js`: player movement and collision helpers.
- `public/models/`: local GLB asset library and manifest.
- `tests/`: world, hierarchy, building geometry, stairs, GLB and collision regression tests.

Start at the [documentation index](docs/README.md). The dimensional and construction specification is [Reference House & Street](docs/REFERENCE-HOUSE-AND-STREET.md); the system boundaries are in [World Architecture](docs/WORLD-ARCHITECTURE.md), and the staged expansion path is in [Settlement Growth](docs/SETTLEMENT-GROWTH.md).

## Scope

The only active mode remains Free Play / Sandbox. No missions, progression, scoring, Rules World or other game mode is being introduced.

## Assets

The supplied asset archive did not include a complete license manifest. Confirm the original asset licences and attribution requirements before wider public distribution. The project keeps the models locally and does not hotlink third-party model files.
