# District 14 Settlement Growth Plan

**Current stage:** one road, one parcel, one reference house.  
**Runtime:** Three.js + Vite.  
**World mode:** Free Play / Sandbox only.

## Direction

District 14 is being rebuilt outward from one dimensionally correct house. The project must prove its building scale, street access, interior circulation and window alignment before adding density. A small coherent place is more useful than a large collection of disconnected props.

Rules World, missions, scoring, economy and progression remain out of scope until separately approved.

## Non-negotiable principles

1. **The exterior shell is the dimensional source of truth.** Interior clear width, depth, floor height, roof height and façade positions are derived from the loaded GLB transform and its measured bounds.
2. **Street and building share one coordinate system.** Door anchors, thresholds, entry walkways, sidewalk levels and spawn points are world-space metres.
3. **A building is structure first.** Floor slabs, partitions, stairwells, corridors, openings, windows and glass are generated before furniture or decoration.
4. **Vertical circulation must be real.** Stair flights, intermediate landing, upper-floor void and walkable height transition must agree with each other.
5. **Windows follow the façade.** Recognizable window/glass meshes in the exterior GLB are measured and reused as aperture anchors. A regular façade grid is only a fallback when the asset does not expose identifiable window geometry.
6. **World data is hierarchical.** District → street → block (when enclosed by multiple streets) → parcel → building → storey → room. Do not spawn unrelated buildings directly into the scene.
7. **Stable IDs and preflight validation.** Missing assets, duplicate IDs, invalid dimensions and broken hierarchy links must fail before the scene is created.
8. **No decorative content ahead of the structure.** Furniture, appliances, loose props, trees, NPCs and traffic are intentionally absent from the starter slice.
9. **No premature procedural city generator.** Add hand-authored parcels and validate each step before introducing procedural placement.

## Current starter slice

```text
DISTRICT 14
└── Main street
    └── Parcel 001
        └── House 001
            ├── Stairwell
            ├── Ground floor
            │   ├── Entry hall
            │   ├── Main room
            │   └── Service room
            ├── First floor
            │   ├── Corridor
            │   ├── Room A
            │   └── Room B
            └── Second floor
                ├── Corridor
                ├── Room A
                └── Room B
```

The current scene intentionally omits every other building and street prop. The model catalogue is retained for later stages, but unused assets are not fetched.

## Growth constraints

The first neighbouring parcel must not alter the dimensions or entrance of House 001. A new building requires its own measured GLB bounds, explicit front side, storey count, collision footprint and hierarchy node. Add the first secondary street only after the first two parcels fit along the primary frontage without narrowing the sidewalk or blocking the road.

## Architecture modules

- `src/world/world-config.js`: one street, one parcel, one building, and the authored settlement tree.
- `src/world/world-validation.js`: validates entity definitions, model references, coordinates, dimensions and collision policies.
- `src/world/world-hierarchy.js`: checks node types, parent/child rules, unique IDs and consistency between building definitions and storey count.
- `src/world/building-architecture.js`: measures exterior shell bounds, extracts named façade glass/window geometry, derives the interior plan, generates the floor slabs, walls, stair flights, landings, room partitions, openings, frames and glazing.
- `src/main.js`: builds the primary road, the reference building, the entry path and the first-person runtime.

## Building dimensions and circulation

All distances are metres. The current generator clamps dimensions to practical values while staying inside the measured shell:

- exterior wall thickness: 0.14–0.28 m, default 0.18 m;
- structural floor slab: 0.12–0.22 m, default 0.16 m;
- clear storey height: normally up to 3.2 m, with a minimum of 2.55 m;
- stair flights: two opposing flights with a half-floor landing and an opening through upper slabs;
- stair clear flight width: 0.72–0.88 m;
- door openings: 0.92–1.12 m wide, up to 2.18 m high;
- window openings: derived from named GLB meshes when found, otherwise generated at a consistent façade rhythm.

The upper-storey slab is cut around the stair core. The walkability check allows the player onto the upper level only through the stair flights and landing, not through the open stairwell void. Height is derived from the player's position along the stair rather than teleporting between floors.

These are starter architectural parameters, not a substitute for checking the actual GLB model and in-game proportions. If the measured asset does not provide enough clear space for a safe stair and corridor, building creation fails rather than silently inventing a bigger interior.

## Street-to-house relationship

- The house front is defined in the building's local frame, then rotated into world space.
- The exterior door anchor uses the measured shell face and its outward normal.
- The short landing and access path lead to the sidewalk on the same side of the street.
- The spawn remains on the street side and faces the first reference house.
- The house footprint is a physical obstruction; the doorway interaction is available from the approach side, not through a side or rear wall.

## Growth order

1. **Reference house:** validate its actual GLB bounds, entry, floors, stairs, windows and glass.
2. **First neighbouring parcel:** add one adjacent lot with a clear street frontage and a separately measured building.
3. **Street frontage:** establish setbacks, driveway/footpath widths, parcel boundaries and consistent door alignment.
4. **Building variety:** add a second building type only after the first house is accepted as the scale reference.
5. **Block:** add a side street and connect parcels into a meaningful block rather than extending arbitrary rows.
6. **Neighbourhood:** add services, greenery, traffic and pedestrians only after the street and building geometry is stable.

Every growth step adds a node to the hierarchy and a matching validated world definition. Existing geometry is not moved implicitly by adding a new parcel.

## Verification and limitations

Automated tests cover:
- world configuration and asset references;
- hierarchy consistency and stable IDs;
- measured shell bounds including model rotation/scale;
- floorplate generation and stair height progression;
- walkability inside the upper stair opening;
- extraction of identifiable facade window/glass meshes.

A green build does not prove the visual placement of the supplied GLB model in a real browser session. Final visual inspection must still confirm that the measured model's real entrance, façade and glass correspond to the generated structure.

## Explicit non-goals

- No furniture, appliances or decorative interior equipment in this stage.
- No traffic, NPCs, vegetation or scattered street props in the starter slice.
- No missions, quests, progression, score, economy or Rules World.
- No framework rewrite or multiplayer layer.
- No procedural city generation before the authored hierarchy is stable.
