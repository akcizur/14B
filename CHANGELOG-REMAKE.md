# District 14 Remake integration

- Promoted the supplied 68-model asset-driven remake to the root application entry point.
- Kept the existing City Courier arcade route available as a separate mode in the main welcome panel.
- Added player-circle collision against world AABBs and axis sliding when diagonal movement meets an obstacle.
- Added interior collision boxes for the structural divider and large furniture.
- Added regression tests for collision geometry, asset integrity, model-manifest references and the City Courier route.
- Updated the Pages workflow to test and build the remake without downloading unused PBR textures from the legacy renderer.
- Kept the original procedural source modules in the repository when applied as an overlay; they are no longer the root entry point.

Validation in the build workspace: 11/11 remake and asset tests passed, and the two new JavaScript modules pass `node --check`. A local Vite production build was not completed because the environment could not reach the npm registry to install Vite.
