# DISTRICT 14 — Remake

Asset-driven Three.js first-person neighborhood built from the supplied GLB collection. The remake is the root experience. The separately maintained City Courier arcade mode remains available at `/city-courier/`.

## Main experience

- First-person exploration of a compact residential district, with pointer-lock mouse look.
- Two enterable, furnished interiors built from the supplied furniture and appliance models.
- 68 locally stored GLB models covering residential buildings, street props, vehicles, pedestrians and interior objects. Only models referenced by the manifest are fetched; assets are cached after the first load.
- Animated pedestrians and moving road traffic, including animated wheel nodes when supplied by the model.
- Daylight, soft fog, shadow mapping, tone mapping and a restrained CRT/grain-inspired interface.
- Loading screen, welcome screen, pause handling, coordinates and in-game clock.
- Walk/run movement with wall, building, street-prop and large-furniture collision; diagonal movement slides along obstacles.

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

- `src/main.js`: scene setup, asset loading, buildings, interiors, actors, interactions and game loop.
- `src/collision.js`: shared circle-versus-box collision and wall-sliding movement helpers.
- `src/styles.css`: HUD, loading, welcome and pause interface.
- `public/models/`: 68 selected local GLB assets and `manifest.json`.
- `public/city-courier/`: separate City Courier arcade mode.
- `tests/`: world-system and asset integrity regression tests.

## Asset licensing

The supplied asset archive did not include a complete license manifest. The models are kept local and are not hotlinked, but confirm each original asset's license and attribution requirements before wider public distribution.

## Notes

This is an asset-driven remake, not a binary conversion of the earlier DWG house. The DWG remains a separate CAD source. Building shells and the two playable interiors are assembled from the supplied GLB city, vehicle, character and interior assets.
