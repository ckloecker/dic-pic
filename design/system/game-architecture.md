# Game architecture

## Acceptance-first priority

REQ-MOV-01/02/05/07 now use immediate fixed-height floor/wall jumps plus one airborne double jump, restored by landing, wall contact, or background attachment, with a brief burst marking wall jumps.
REQ-MOV-03 preserves foot support during horizontal excavation, including floating-point boundary rounding.
Background press-to-drop and photo-guided walking/climbing reference routes remain unchanged.

REQ-LVL-01/05/07/08/09/11/16 replace strict numeric rejection with progressive strongest-edge selection and route repair.
Openness, route duration, and section count remain quality targets.
The route planner compares its bounded candidates, preferring the longest verified route that meets the section and duration targets and otherwise selecting the longest valid route.
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
| Setup UI | Two-player name validation, image upload/capture, three labeled playable thumbnail choices | REQ-SYS-01, REQ-SYS-05/15, REQ-LVL-04/12/17 |
| Terrain generator | Normalize contrast, preserve diagonal contours and local edge directions, provisionally close/fill photo shapes, and suppress tiny fragments | REQ-SYS-03, REQ-LVL-01/03/05/08/09/11 |
| Route planner and option assembly | Prioritize layout-matching photo edges by strength within safe route constraints, mark non-drillable terrain, place mandatory checkpoints, optional pickups/platforms, and avoidance/combat patrol modes, then verify final physics/enemy replay | REQ-LVL-01/07/08/09/10/11/12/15/16/18/19/22/23/24 |
| Game loop and renderer | Draw filtered photo, distinct terrain, checkpoints and gate state, pickups, moving platforms, living patrols, combat gun/projectiles, biome poses, timer, wall-jump bursts, mobile camera, and prominent instructions; full-screen mode centers the largest aspect-preserving canvas that fits the viewport | REQ-SYS-02/03/04/10/16/17/18/19, REQ-CHR-01/02/04/05, REQ-MOV-05/11, REQ-LVL-02/06/07/10/14/15/18/19/20/22/23/24 |
| Movement simulation | Immediate fixed-height floor/wall jumps and one double jump, press-to-drop climbing, airborne drill-climbing, capped downward drilling, stomp combat, temporary speed effects, moving-platform collision, and directional tunnel drilling | REQ-MOV-01 through REQ-MOV-11, REQ-CHR-02, REQ-LVL-18/19 |
| Run lifecycle | Validate safe non-border spawns and non-walking checkpoint routes, reset terrain, checkpoints, pickups, platforms, timer, projectiles, and patrols, and distinguish defeated enemies from living contact | REQ-SYS-04/08/09/10/14, REQ-LVL-07/15/18/19/22/23, REQ-MOV-11 |
| Player session controller | Retain two player names and one selected generated option across sequential rounds, then attribute each completed score to the selected player | REQ-SYS-05/06/15, REQ-LVL-12/17 |
| Enemy simulation | Generate three avoidance patrols or four to eight combat patrols in clear protected flight areas, follow seeded waypoint loops, and detect stomp/projectile/living contact | REQ-LVL-15/21, REQ-SYS-10/14, REQ-MOV-11 |
| Local leaderboard | Persist signed top-ten times in cookies with stable ties, identify the exact current attempt, and select placement-aware completion feedback | REQ-SYS-06/17 |
| Page identity | Declare a local pixel-art player-character favicon available before game setup | REQ-CHR-03 |

## Data flow

The setup UI validates both player names and accepts an uploaded or captured image.
The image is decoded, scaled into the terrain generator's pixel grid, and fingerprinted from its original bytes.
The generator initializes a fixed-seed random engine at the beginning of each batch and returns three deterministic biome/layout options with drillability masks, route checkpoints, pickups, moving platforms, scenery, and patrol mode.
After selection, both players retain the same option for sequential rounds, while run reset restores its initial state.
Once the selected player reaches the unlocked exit, the signed elapsed time is saved in a browser cookie under a digest of the image fingerprint and exact option, and the local top ten is displayed.

No image or score is sent to a server.

## Root hosting and GitHub feedback

REQ-SYS-11 assigns the project-root entry point to `index.html`, which loads assets and modules from `src/` through relative URLs.
The same entry point works under a GitHub Pages repository prefix without a build or backend.
REQ-SYS-12 assigns persistent feedback controls and category/severity URL construction to the page and app module.
The controls link to `.github/ISSUE_TEMPLATE/feedback.yml` through GitHub's new-issue page for `ckloecker/dic-pic`.
GitHub authenticates the submitter, records their account as issue author, and stores the submitted feedback in repository issues.
The app does not call GitHub's API or include credentials, photos, names, or scores in feedback URLs.
REQ-SYS-13 assigns deployment to a GitHub Actions workflow triggered only by pushes to `develop`.
The build stages `index.html` and `src/`, then stamps the triggering branch and commit into HTML metadata before uploading the Pages artifact.
REQ-SYS-12 reads these values from the current document, displays them in the feedback section, and prefills matching GitHub issue-form text fields.
Unstamped local documents visibly report that version metadata was not injected.

## Approved random-option extension

The level-options component assigns three reproducible biome/layout combinations and selects the longest verified route among its bounded candidates before final filling, drillable biome scenery, optional pickups, moving platforms, and patrols.
It selects a fixed finish gate within the outer ten percent of a varied edge and a supported start within the outer ten percent of the opposing edge.
Endpoint proximity uses the nearest footprint side, without relaxing full in-bounds artwork or safe-support validation.
One or two mandatory route checkpoints maximize geographic coverage of the required visits, with direct travel distance breaking ties.
The shared renderer omits collected checkpoints and their glow, and shows a red barrier and contrasting padlock only while the exit is locked.
A bright red X overlays the checkered finish banner while locked and is removed when the exit opens.
Collection progress remains in run state until reset restores all markers and relocks the exit.
The shared scene renderer provides biome surfaces, filling, solid decorative elements, checkered gates, and cosmetic headwear.
The setup UI shows these exact options before play and reset retains the selected option.
Scores are keyed by photo plus exact option geometry, including pickups and moving platforms.
REQ-LVL-17 requires the level-options component to initialize its random number engine with the same fixed seed and state for every three-option batch and share the resulting sequence across all generation stages.
The same image must therefore reproduce the same ordered suggestions independently of earlier generations, player names, or browser sessions.
This extension covers REQ-LVL-07/10/11/12/13/17/18/19 and REQ-CHR-04.
Elaborate scenery, pickups, and moving platforms avoid protected route clearance, while background sunshine, bubbles, and jungle light/motes remain cosmetic and respect reduced motion.
Exposed outlines are fully opaque and contrast against the photo; interiors use a uniform biome fill at 80% opacity.

## Approved session, reset, and visual extensions

REQ-SYS-14 assigns enemy contact and bottom-edge falls to a full-run reset that restores terrain, spawn, enemies, pickups, platforms, controls, and timer without recording a score.
REQ-SYS-15 assigns the setup UI two player names and the completion UI next-round player selection while retaining the same selected level option.
REQ-SYS-16 assigns prominent responsive gameplay instructions to the setup and gameplay UI.
REQ-LVL-18 assigns deterministic speed and mushroom time-subtraction pickups to level options, timed labels at collected mushroom positions to the run lifecycle and shared renderer, and accessible subtraction announcements to the fullscreen game frame.
REQ-LVL-19 assigns two bounded collidable moving platforms per option, precise fractional contact, collision-limited rider carrying, movement that pauses before player contact and resumes when clear, drill-enabled path extension, and reset restoration.
REQ-LVL-20 assigns uniform biome interior fills and stronger exposed-edge contrast to the shared terrain renderer.
REQ-CHR-05 assigns an underwater swimming-themed animated pose to the renderer only, without changing movement or collision behavior.

## Nontrivial routes, readability, and enemy extension

REQ-LVL-16 adds route-first photo-edge planning, progressive platform repair, and executable physics/enemy verification before offering any option.
REQ-LVL-01 treats 55–70% open space as a preference, with reference corridors protected from filling and scenery regardless of occupancy.
REQ-MOV-03 distinguishes active excavation at ten cells per second in every controlled direction from eighty-cell open-space walking and twenty-cell open-space climbing.
REQ-SYS-06 distinguishes the exact current attempt from stored top-ten entries and shows an unranked current-run footer when necessary.

REQ-LVL-07 assigns conservative walking-only reachability validation to the run-lifecycle component and edge-prioritized route endpoints to the route planner.
REQ-LVL-14 assigns shared photo filtering and noncolliding terrain halos to the scene renderer, without changing image analysis.
REQ-LVL-15 assigns bounded clear-corridor generation, deterministic flying patrols, and contact detection to `src/enemies.js`.
REQ-LVL-21 extends these patrols to seeded two-axis waypoint loops retained in the selected option and replayed from their initial state on reset.
The level-options component includes patrol definitions in previews and exact-option leaderboard identities.
REQ-SYS-10/14 assigns full-run reset on enemy contact or bottom-edge fall to the run lifecycle, with control clearing and no score write.
Enemy simulation runs only after the race starts and enemy contact takes priority over completion.
Manual and failure reset restore the selected terrain, initial enemies, pickups, and platforms, with a zero timer.
