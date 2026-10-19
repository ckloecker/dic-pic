# Game architecture

## Acceptance-first priority

REQ-LVL-01/05/07/08/09/11/16 replace strict numeric rejection with progressive strongest-edge selection and route repair.
Openness, route duration, and section count remain quality targets.
The route planner may connect separated edges and add longer bridges or horizontal stepping platforms, without manufacturing freestanding vertical walls.
Every offered option must still pass actual no-drill replay, walking-only rejection, safe endpoint checks, and final enemy verification.
Truly featureless photos remain explicitly rejected.

## Scope

The game is a dependency-free, browser-based 2D platformer. It uses a single
HTML page, responsive CSS, ES modules, and a canvas rendered at a pixel-art
resolution. Browser APIs provide image selection, camera capture, local score
storage, and cryptographic level identifiers.

## Components and requirement allocation

| Component | Responsibility | Requirements |
|---|---|---|
| Setup UI | Name validation, image upload/capture, three labeled playable thumbnail choices | REQ-SYS-01, REQ-SYS-05, REQ-LVL-04/12 |
| Terrain generator | Normalize contrast, preserve diagonal contours and local edge directions, provisionally close/fill photo shapes, and suppress tiny fragments | REQ-SYS-03, REQ-LVL-01/03/05/08/09/11 |
| Route planner and option assembly | Build bounded photo-edge connectors, reserve a contiguous no-drill corridor, trim optional fill, protect clearance, and verify final physics/enemy replay | REQ-LVL-01/07/08/09/10/11/12/15/16 |
| Game loop and renderer | Draw filtered photo, outlined biome terrain, flying patrols, cosmetic headwear, fixed gate, timer, charge bars, and controls | REQ-SYS-02/03/04/10, REQ-CHR-01/02/04, REQ-MOV-05, REQ-LVL-02/06/07/10/14/15 |
| Movement simulation | Charged floor/wall jumps, press-to-drop climbing, tolerant surface contact and press buffering, air movement, solid ceiling/bottom, quarter-speed background climbing, and directional tunnel drilling | REQ-MOV-01 through REQ-MOV-10, REQ-CHR-02 |
| Run lifecycle | Validate non-walking placements, clone selected terrain/enemies for reset, respawn on enemy contact, and detect fixed-gate contact | REQ-SYS-04/08/09/10, REQ-LVL-07/15 |
| Enemy simulation | Generate clear protected patrol corridors, reflect bounded motion, and detect swept contact | REQ-LVL-15, REQ-SYS-10 |
| Local leaderboard | Persist the top ten with stable ties and identify the exact current attempt, including an unsaved unranked footer | REQ-SYS-06 |
| Page identity | Declare a local pixel-art player-character favicon available before game setup | REQ-CHR-03 |

## Data flow

The setup UI validates a player's name and accepts an uploaded or captured
image. The image is decoded, scaled into the terrain generator's pixel grid,
and fingerprinted from its original bytes.
The generator returns three biome/layout options with pixel collision masks.
After selection, the game loop combines the chosen mask with the original image as the scene background.
Once the player reaches the exit, the elapsed time is saved under a digest of the image fingerprint and exact option, and the local top ten is displayed.

No image or score is sent to a server.

## Approved random-option extension

The level-options component assigns three random biome/layout combinations and plans a photo-aligned reference route before final filling, drillable biome scenery, and patrols.
It selects an edge-prioritized fixed finish gate and distant supported start as route endpoints.
The shared scene renderer provides biome surfaces, filling, solid decorative elements, checkered gates, and cosmetic headwear.
The setup UI shows these exact options before play and reset retains the selected option.
Scores are keyed by photo plus exact option geometry.
This extension covers REQ-LVL-07/10/11/12/13 and REQ-CHR-04.
Elaborate scenery uses visible collision silhouettes outside protected route clearance, while background sunshine, bubbles, and jungle light/motes remain cosmetic and respect reduced motion.
Exposed outlines are fully opaque and only interior filling is 80% opaque.

## Nontrivial routes, readability, and enemy extension

REQ-LVL-16 adds route-first photo-edge planning, progressive platform repair, and executable physics/enemy verification before offering any option.
REQ-LVL-01 treats 55–70% open space as a preference, with reference corridors protected from filling and scenery regardless of occupancy.
REQ-MOV-03 distinguishes active excavation at twenty cells per second from eighty-cell open-space walking.
REQ-SYS-06 distinguishes the exact current attempt from stored top-ten entries and shows an unranked current-run footer when necessary.

REQ-LVL-07 assigns conservative walking-only reachability validation to the run-lifecycle component and edge-prioritized route endpoints to the route planner.
REQ-LVL-14 assigns shared photo filtering and noncolliding terrain halos to the scene renderer, without changing image analysis.
REQ-LVL-15 assigns bounded clear-corridor generation, deterministic flying patrols, and contact detection to `src/enemies.js`.
The level-options component includes patrol definitions in previews and exact-option leaderboard identities.
REQ-SYS-10 assigns contact-triggered player-only respawning to the run lifecycle and control clearing to the game loop.
Enemy simulation runs only after the race starts and enemy contact takes priority over completion.
Manual reset restores the selected terrain and initial enemies, while enemy contact preserves drilled terrain and elapsed time.
