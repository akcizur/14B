# Apply this remake to akcizur/14

This package is prepared as a root-experience replacement for the existing `akcizur/14` repository.

1. Extract the archive into a fresh clone of `akcizur/14` and allow it to replace matching files.
2. Keep existing repository paths that are not present in this archive. In particular, keep `public/city-courier/` so the separate arcade mode remains available from the new welcome screen.
3. Commit the combined tree to `main`.
4. GitHub Actions runs `npm test`, builds with Vite, and deploys the result to GitHub Pages.

The old procedural first-person modules under `src/core/`, `src/scenes/` and `src/world/` are not deleted by this overlay. Their tests remain in the repository, but the root `index.html` now starts the asset-driven remake in `src/main.js`.

The 68 GLB files under `public/models/` are required by the new root game. Do not omit them from the commit.
