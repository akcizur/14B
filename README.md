# DISTRICT 14

District 14 is a Three.js + Vite first-person neighbourhood sandbox being developed as a compact, dimensionally consistent artificial habitat in outer space. The setting is protected by a massive ring structure (working concept name: **Starship Ring**) and contains an artificial atmosphere.

The urban layout is intentionally constrained to **exactly three streets**. One long, dominant Main Street defines the setting; two secondary streets provide limited connection and variety. The world should expand vertically and longitudinally rather than becoming a conventional street grid. The setting's Czechoslovak 1950–1975 architectural character is paired with restrained retro-futurist technology.

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

## World hierarchy

```text
District 14 Habitat
└── Habitat / Protective Ring
    └── Three-Street Urban Layout
        ├── Main Street (dominant long axis)
        ├── Street 02 (secondary)
        └── Street 03 (secondary)
            └── Parcels
                └── Buildings
                    ├── Stairwell
                    ├── Storeys
                    └── Rooms
```

The street topology and ring geometry remain design tasks. Do not generate additional streets or treat a technical streaming loop as a visible circular road.

## Project layout

- `src/main.js`: runtime, scene creation, input and interaction.
- `src/world/world-config.js`: editable road, parcel building definitions and settlement hierarchy.
- `src/world/world-validation.js`: validates world entities, model keys, dimensions and collision definitions.
- `src/world/world-hierarchy.js`: validates the district → street → parcel → building → storey → room hierarchy.
- `src/world/building-architecture.js`: measures GLB shells and builds dimension-matched floorplates, stair flights, partitions, wall openings, window frames and glass.
- `src/collision.js`: player movement and collision helpers.
- `public/models/`: local GLB asset library and manifest.
- `tests/`: world, hierarchy, building geometry, stairs, GLB and collision regression tests.

Documentation starts at [docs/README.md](docs/README.md), with the complete world lore in [docs/lore/](docs/lore/README.md).

## Scope

The only active mode remains Free Play / Sandbox. No missions, progression, scoring, Rules World or other game mode is being introduced.

## Assets

The supplied asset archive did not include a complete license manifest. Confirm the original asset licences and attribution requirements before wider public distribution. The project keeps the models locally and does not hotlink third-party model files.
