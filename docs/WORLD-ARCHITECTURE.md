# District 14 World Architecture

**Product stage:** one continuous urban Free Play / Sandbox world.  
**Design target:** a robust open-world foundation that is easy to extend, rebalance and author without editing renderer code for every new object.

## Direction

District 14 is being built as a reusable world system, not as a one-off scene. The current city is the first world definition consumed by shared runtime systems. The same runtime should later be able to load additional streets, blocks, interiors and districts without duplicating player, collision, asset or rendering code.

The only active game mode remains **Free Play / Sandbox**. Rules World, missions, quests, scoring, economy and progression are deliberately out of scope until separately approved.

## Principles

1. **World data is the authoring layer.** Entity positions, model keys, heights, rotations, routes, collision profiles, spawn and bounds live in world catalogs.
2. **Stable entity IDs.** Every placed object has a unique ID independent of its model filename or user-facing name.
3. **Validate before building.** Missing assets, duplicate IDs, invalid transforms, out-of-bounds placements and malformed collision/route data must fail before runtime creates a partial world.
4. **Explicit collision policy.** Every world entity declares a collision profile or explicitly opts out with `collision: false`. No invisible collision assumptions.
5. **Runtime systems own behavior.** Configuration describes what exists; runtime modules own loading, animation, movement, interaction, collision and disposal.
6. **Independent content collections.** Buildings, street props, vegetation, traffic and pedestrians are separate editable collections. Interior architecture is now generated from measured building bounds, and entrance paths are tied to real doorway anchors. Furniture remains a separate future content layer.
7. **No premature procedural generation.** First make hand-authored content robust and validated. Add procedural tools only after the data contract is stable.
8. **Profile before optimizing.** Keep visual quality until measurements show where load time, memory or frame time are being spent.

## Current foundation

- `src/world/world-config.js` contains the editable catalog for the current urban map.
- The catalog holds world bounds, spawn transform, environment, road and sidewalk dimensions, buildings, street props, fences, street lights, trees, vehicles and pedestrians.
- `src/world/world-validation.js` checks stable IDs, model references, finite transforms, map bounds, collision policies, building roles, route definitions and fence data.
- `src/main.js` now consumes world definitions to construct buildings, props, vegetation, traffic and pedestrians.
- Player movement is normalized, swept in small steps and resolved against static and moving collision footprints.
- Moving actor collisions permit separation when a vehicle or pedestrian enters the player's space, avoiding a permanently trapped player.
- The current world still uses one active scene and a single global world configuration. It is a first validated authoring layer, not yet a complete streaming open-world engine.

## Intended module boundaries

```text
src/
  app/
    bootstrap.js
    GameSession.js
  core/
    WorldRuntime.js            # load, activate, pause, unload and dispose a world
    AssetRegistry.js           # GLB loading, cache, reference count and disposal
    EntityRegistry.js          # stable IDs and typed entity lookup
    WorldValidator.js          # schema and cross-reference checks
    LoadingPipeline.js         # stages, progress and recoverable errors
    SpatialIndex.js            # queries for local entities/colliders
  world/
    world-config.js            # current data-driven world catalog
    world-validation.js        # current preflight validator
    building-architecture.js   # measured shell bounds, floors, stairs, room partitions and glazing
    worlds/
      district-14/
        world.config.js
        buildings.js
        streets.js
        interiors.js
        vegetation.js
        traffic.js
        pedestrians.js
        zones.js
  systems/
    PlayerController.js
    CollisionSystem.js
    InteractionSystem.js
    TrafficSystem.js
    PedestrianSystem.js
    EnvironmentSystem.js
    StreamingSystem.js
  entities/
    buildings/
    props/
    vehicles/
    pedestrians/
  debug/
    WorldDebugOverlay.js       # bounds, colliders, entity IDs, FPS and draw calls
    WorldEditor.js             # future placement and collision authoring tools
  ui/
    Hud.js
    LoadingScreen.js
    PauseScreen.js
```

This is the target separation. Modules not listed under the current foundation are planned boundaries, not functionality claimed as already implemented. The migration should be incremental and keep the working sandbox playable after every step.

## World data contract

Every placed entity must declare:

- `id`: globally unique, stable identifier.
- `asset`: exact key from `public/models/manifest.json`.
- `position`: world-space [x, y, z] in meters.
- `height` or explicit scale: normalization rule for the source model.
- `rotationY`: world orientation.
- `collision`: a typed collision profile, or `false` for intentional no-collision.
- `zoneId`: future zone/chunk ownership when multi-zone streaming is introduced.

Specialized data:

- Buildings: enterable/backdrop role, explicit entrance anchor(s), exterior footprint and optional linked interior definition.
- Props and vegetation: collision shape based on physical footprint, not the full visual canopy unless intended.
- Vehicles: route/waypoints, lane, speed, direction and collision footprint.
- Pedestrians: walking path, speed, animation policy and collision footprint.
- Zones: bounds, load radius, unload radius, dependencies and lifecycle policy.

## Open-world scaling path

### 1. Validated content authoring
Building interiors now derive their usable dimensions from each loaded GLB shell. Storey count is configured per building; floor slabs, stair openings, corridors, partition doors, window openings and glazing are generated in the building's measured local frame. Entrance anchors drive both interaction and the exterior footpath. Furniture and decorative equipment are intentionally deferred. The editor-facing catalog remains the single source of truth.

### 2. Modular runtime
Extract asset loading, entity creation, player movement, collision, interaction, vehicle traffic and pedestrian simulation into modules with explicit inputs and lifecycle methods. Avoid hidden cross-module global arrays.

### 3. Spatial model and zones
Introduce a spatial index and named world zones. Keep today's District 14 as one zone first. Add asynchronous activation/unloading around the player only after zone ownership, object disposal and transition rules are tested. Do not load/unload objects ad hoc based only on distance.

### 4. Production asset pipeline
Create a model metadata catalog for physical dimensions, origin/pivot, normalization, collision shape, LOD variants, material policy, source and license/attribution. Validate GLB container integrity and model bounds in CI.

### 5. Rendering and simulation scale
Use frustum culling and measured distance policies. Use LOD for far buildings and vegetation. Use instancing only for repeated compatible geometry/materials where profiling shows meaningful draw-call reduction. Three.js documents `InstancedMesh` for repeated geometry and `GLTFLoader` for glTF/GLB assets: [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html), [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html).

### 6. Authoring and debug tools
Add a separate editor/debug layer for selection, transform editing, entity ID inspection, collision visualization, door anchors, zone boundaries, FPS, draw calls and asset state. Do not mix editor controls into the normal player HUD.

## Non-goals for the current stage

- No Rules World.
- No missions, quests, score, economy or progression.
- No forced switch away from Three.js + Vite.
- No multiplayer or save-game layer before entity ownership and world lifecycle are mature.
- No large procedural city generator before authored world data, validation and placement tools are reliable.

## Acceptance criteria for the architecture foundation

- Moving or adding an entity is a world-data edit, not a renderer-code edit.
- Every entity has a stable ID and explicit collision policy.
- Every model reference resolves against the local manifest.
- Invalid map data fails before scene spawning.
- Buildings, street props, vegetation, traffic and pedestrians can be extended independently.
- The same runtime can host another urban zone without cloning the current game loop.
- The current sandbox remains the only playable mode until the owner approves another mode.
