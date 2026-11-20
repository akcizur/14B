# DISTRICT 14 — Remake

Asset-driven Three.js first-person urban open world, currently delivered as one continuous Free Play / Sandbox experience. World placement is defined in validated data catalogs so districts, buildings, props, interiors, traffic and pedestrians can be extended independently.

## Main experience

- First-person exploration of a compact residential district, with pointer-lock mouse look.
- Two enterable, furnished interiors built from the supplied furniture and appliance models.
- 68 locally stored GLB models covering residential buildings, street props, vehicles, pedestrians and interior objects. Only models referenced by the manifest are fetched; assets are cached after the first load.
- Animated pedestrians and moving road traffic, including animated wheel nodes when supplied by the model.
- Daylight, soft fog, shadow mapping, tone mapping and a restrained CRT/grain-inspired interface.
- Loading and welcome screens, pause handling, coordinates and local device clock.
- Normalized walk/run movement with swept collision checks, obstacle sliding, static street/building collisions, moving vehicle and pedestrian collision footprints, and furniture collision inside both interiors.

## Run locally

Requires Node.js 20 or newer.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. For a production build:

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
| Mouse | Look around |
| `E` | Enter / exit a house |
| `Esc` | Pause / release mouse |

## Project layout

- `src/main.js`: application bootstrap and runtime orchestration.
- `src/world/world-config.js`: editable world catalog for map geometry, buildings, street props, vegetation, traffic and pedestrians.
- `src/world/world-validation.js`: validates entity IDs, model references, transforms, collision profiles and routes before scene creation.
- `src/collision.js`: reusable circle/AABB collision, swept movement, directional interaction and normalized input helpers.
- `src/styles.css`: HUD, loading, welcome and pause interface.
- `public/models/`: 68 selected local GLB assets and `manifest.json`.
- `tests/`: world-system and asset integrity regression tests.

## World architecture

See [World Architecture](docs/WORLD-ARCHITECTURE.md) for the design principles, current data-driven foundation, target module structure and future open-world scaling stages.

## World architecture

See [World Architecture](docs/WORLD-ARCHITECTURE.md) for architecture principles, the current data-driven foundation, target module boundaries and the open-world scaling path.

## Current scope

District 14 currently contains one open Free Play / Sandbox world. A possible future Rules World is intentionally out of scope and will only be considered after the sandbox is reviewed and approved.

## Asset licensing

The supplied asset archive did not include a complete license manifest. The models are kept local and are not hotlinked, but confirm each original asset's license and attribution requirements before wider public distribution.

## Notes

This is an asset-driven remake, not a binary conversion of the earlier DWG house. The DWG remains a separate CAD source. Building shells and the two playable interiors are assembled from the supplied GLB city, vehicle, character and interior assets.
