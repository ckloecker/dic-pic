# Detailed game design

## Approved acceptance-first revision

REQ-LVL-01/05/07/08/09/11/16 now prioritize accepting photos with visible structure.
The previous 55–70% openness, four-to-six-section, and twenty-to-forty-second gates below become preferences, not rejection conditions.
Route repair shall select strong useful photo edges, connect disconnected regions, and add horizontal bridges and stepping platforms when supports are missing.
The former eighteen-cell and two-ended limits no longer apply to supplemental platforms.
Supplemental geometry remains visible, collidable, drillable, previewed, resettable, and part of exact-option score identity.
Safe endpoints, in-bounds artwork, non-walking completion, clear movement space, and actual no-drill physics/enemy replay remain mandatory.
Featureless images still reject; sparse images do not receive filler solely for an occupancy quota.
Verification covers the supplied portrait and sparse, disconnected, busy, horizontal, and vertical sources.

## Requirements covered

This design elaborates REQ-SYS-01 through REQ-SYS-06, REQ-SYS-08/09/10/11/12, REQ-LVL-01 through REQ-LVL-16, REQ-CHR-01/02/03/04, and REQ-MOV-01 through REQ-MOV-10.

## Terrain (`src/terrain.js`)

### Approved route-first revision

REQ-LVL-01/08/09/11/16 replace the earlier unconditional full-region filling, fixed platform cuts, and bounding-box orientation selection.
Preserve diagonal traced contours and local edge-direction evidence.
Plan a photo-aligned corridor before final filling and reserve its player clearance through scenery placement.
Validate the actual physics and enemy simulation without drilling or idle padding, preferring four to six sections and a twenty-to-forty-second duration.
Prefer 55–70% open cells without rejecting sparse or dense sources solely for occupancy.
Connect useful detected surfaces and add missing horizontal supports without manufacturing vertical walls.
Keep the free climbing and jumping controls; reference-route timing does not forbid shortcuts.
REQ-MOV-03 now limits active excavation to twenty cells per second horizontally, retaining eighty in open space and unchanged climbing/gravity/jump charge.
REQ-SYS-06 uses per-attempt identity for highlighting rather than matching name/time, stable equal-time ordering, and a transient unranked footer outside the stored top ten.
Research basis: [constructive generation and generator evaluation](https://www.pcgbook.com/) and [Spelunky's connected solution-path construction](https://tinysubversions.com/spelunkyGen/).

### Photo evidence and provisional filling

`generateTerrain(rgba, width, height, { layout })` normalizes luminance and traces strong horizontal/sloping and vertical Sobel edges across the complete image interior.
If five-to-ninety-five-percentile normalization collapses the range, retry with actual minimum/maximum luminance so small strong features survive; uniform images still reject.
Adjacent trace samples connect within two cells and traces shorter than ten cells or three percent of their axis are discarded.
The shared morphological closing and flood fill in `src/morphology.js` operate on complete one-cell contours.
Eight-neighbor connected components preserve diagonal contours and must span at least twelve cells and contain at least twelve solid cells.
Local traced horizontal and vertical evidence counts with a ratio greater than 1.5 classify shapes; other shapes remain neutral.
Preferred-orientation shapes and neutral shapes survive, with single-orientation fallback when no preferred shape exists.
Thin open traces become four-cell platforms or walls; enclosed components retain their complete filled silhouettes.
Parallel thin open horizontal traces within twenty cells suppress the lower duplicate.
There are no unconditional rectangular platform cuts.
Uniform images or images without usable traces raise `NoUsableEdgeError`.
The terrain retains `solid`, filtered all-shape `photoSolid`, traced `features`, and `edgeDirections`, in addition to dimensions, version, and a compatibility-only `surfaceY`.
Collision and coloring use the live mask, including separate platforms and drilled tunnels.
The renderer draws exposed outlines fully opaque and interiors at 80% opacity without moving the photo.

## Reference route (`src/route.js`)

Connect supported horizontal photo surfaces with six supported cells on each side and local real-edge evidence at both ends, without the previous eighteen-cell cap.
Connector cells are ordinary visible collision terrain, not new photo-edge evidence.
First build a four-cell waypoint graph within twenty-four cells of a real traced edge.
Use A* with original occupancy, local edge direction, and distance-to-real-edge costs to prefer photo-aligned non-retracing sections.
If natural anchors or connected paths are insufficient, extend the graph through open background and add candidate supported waypoints.
Sample a preferred finish edge and prioritize its nearest eligible final anchors while retaining the distant-start constraint.
Reserve twelve-by-eighteen clearance along the route and clear that corridor from provisional photo filling.
Remove deepest optional interior filling toward 65% open space without inventing filler to meet a ground percentage.
Keep original foot support at spawn and finish and remove an entire connector if its cells or either anchor lose support.
During repair, add three-cell-thick horizontal shelves beneath horizontal route portions and section endpoints, excluding reserved clearance.
Each shelf records only its newly added collision cells, leaving photo-edge evidence unchanged.
Reject walking-only finishes using the conservative walking graph both before and after scenery placement.
Execute walking and background-climbing inputs using `stepPlayer`, recording the actual timestep and input sequence until gate contact.
Require at least half a second of each movement mode and at least two connected sections without idle padding.
The first eight candidate attempts prioritize four or more sections and twenty-to-forty-second durations, then allow valid routes outside those quality targets.
The reference route uses walking and climbing; charged jumps remain available for player-selected shortcuts rather than being required by the recorded route.
Dilate reserved clearance by three cells to protect floor/wall contact probes from later scenery.
After scenery and patrol placement, replay the stored actions against the final mask and actual enemy simulation.
Reject drilling, enemy contact, blocked clearance, unsafe endpoints, invalid platforms/connectors, invalid timesteps, mismatched replay duration, missing sections, and premature finish.
Openness and duration are measured but their former fixed ranges do not determine final validity.
Try at most thirty-two candidates in each natural/repair graph stage and four assemblies per option.
Later assemblies retain the twelve strongest layout-weighted traces as ordinary four-cell-thick photo surfaces to suppress clutter before route repair.
Final safety failure raises `RouteGenerationError` rather than silently returning an unsafe option.
Exact-option identity revision 6 includes supplemental platform cells along with existing geometry and patrol definitions.

## Level options (`src/level.js`, `src/scene.js`)

REQ-LVL-10/11/12 add three options after photo decoding and before play.
Each batch independently shuffles the three biomes and the three layouts, pairing them without duplicate pairs.
Photo analysis and provisional closing/filling precede route planning; route clearance and optional fill removal precede biome scenery.
Exterior flood fill distinguishes open background from enclosed photo-derived regions.
Jungle trees use 27-to-45-cell silhouettes with trunks, roots, layered canopies, climbing plants, and hanging vines.
Desert uses branching cacti, stratified rocks, and bone clusters.
Underwater uses branching coral, kelp, and stratified rocks.
Placement requires terrain support, clear space outside the protected route, separation from nearby scenery anchors, and a complete in-bounds silhouette.
Part-coded cells provide bark, canopy, plant, rock, and bone textures without drawing solid artwork outside the collision mask.
Thin grass/leaf accents are cosmetic and disappear when their terrain anchor is drilled.
Biome element cells share the terrain mask and are therefore drillable with normal collision.
The shared scene renderer draws identical terrain colors, elements, gates, and biome headwear for thumbnails and live play.
Headwear stays within the original collision footprint in standing and climbing poses.
Options retain their original mask, spawn, gate, biome, and layout.
A SHA-256 digest of photo identity and serialized exact option geometry identifies leaderboard scores.
Reset clones the selected option rather than regenerating or resampling randomness.
REQ-LVL-13 adds a shared background-effects renderer between the photo and terrain.
Desert sunshine/rays, underwater bubbles/light shafts, and jungle sunbeams/leaf motes use deterministic positions with time-varying cosmetic motion.
The reduced-motion preference freezes this layer without changing gameplay or the timer.
Thumbnails show the same effect layer at its initial phase.

### Nontrivial placement, readability, and enemies

REQ-LVL-07 rejects walking-only routes before accepting any start/finish pair.
Build a conservative reachable-cell map from the candidate spawn using the actual walking step simulation at one-cell horizontal increments.
Include free downward movement and both adjacent raster rows for fractional falls so the check may reject questionable placements rather than accept an easy walking route.
Free lateral drift across clear rows deliberately over-approximates airborne gap crossing and permits caching by connected clear-row groups.
Build the row-group transition graph once per placement operation, using the physics simulator only at blocked row endpoints where automatic stepping can change height.
Only clear character footprints enter the map and the existing physics supplies automatic steps and surface snapping.
Test gate overlap against all reachable footprints, not just endpoint distance or matching floor height.
The route planner samples preferred edges and supported route endpoints across bounded attempts while retaining the existing minimum start/finish distance.
Legacy standalone `placeRun` also retains alternative supported-edge placement for terrain without a precomputed route.
REQ-LVL-14 uses a shared photo renderer with 35% saturation and 55% brightness before cosmetic effects and terrain.
Draw a one-cell dark four-neighbor terrain halo behind the unchanged terrain mask in previews and gameplay.
Keep photo analysis unfiltered and preserve the current terrain alpha channels.
REQ-LVL-15 uses two 10-by-6-cell enemies per option with horizontal patrols spanning at least 24 cells at 18 cells per second.
Choose complete clear corridors outside the reference clearance, separated from each other and at least twelve cells from the spawn and gate.
If two patrols cannot fit, reject the option with a clear generation message instead of adding overlapping or stuck enemies.
Patrol definitions are serialized in the level identity and cloned into independent runtime state.
Analytic reflected motion stays inside the corridor even after a large timestep.
Patrols remain stationary before the timer starts and have no cosmetic motion under reduced motion.
Use swept player/enemy contact to prevent tunneling at the maximum frame interval.
Split patrol sweeps at reflection endpoints so contact during a reversal cannot be missed.
REQ-SYS-10 respawns only the player and clears controls, preserving terrain, enemy progress, and race time.
Resolve enemy contact before checking completion and never save a score for contact alone.
Manual reset restores the original patrol states.

## Movement (`src/physics.js`)

The world uses terrain-mask cells as its coordinate units.
`findSpawnY(terrain, x, playerWidth, playerHeight)` places the player above
the highest point across their footprint. `createPlayer(x, y)` creates the
player state. `stepPlayer(player, input, terrain, dt)` applies horizontal
movement, gravity, charged floor/wall jump input, collision resolution, and drilling.
`input` has `move` (-1, 0, or 1), `jumpPressed`, `jumpReleased`, `jumpHeld`,
and `drill`, plus vertical directional input `moveY`. The player footprint shall
be 6 by 9 cells.
A shared contact probe shall find floor/wall terrain up to 3 cells away.
Floor probes and downward snapping shall run only when not rising.
Side probes shall exclude the foot boundary to avoid treating floor steps as walls, and shall treat the left and right image borders as virtual walls without adding terrain cells.
The top and bottom image boundaries shall remain a ceiling and floor, not wall-jump surfaces.
Downward snapping and upward stepping shall run per half-cell horizontal substep so slopes remain supported.
Pressing near a surface begins charging; release while currently near one
launches. Wall release shall set horizontal velocity to 80 cells/second away
from the wall for the launch frame; subsequent normal directional input
remains available.
The active-excavation speed limit also applies to horizontal launch travel, without changing vertical jump velocity.
Gravity continues throughout wall charging.
Charge caps at 3 seconds and interpolates jump height from
the existing normal height to the world height. Launch speed is derived from
`sqrt(2 * gravity * height)` with a half-step gravity correction for the
discrete integrator. Jump height is verified in an unobstructed tall world.
Charge survives 150 ms without contact, but release outside the 3-cell
tolerance cancels immediately. Presses are buffered for 150 ms; a still-held
press may start charging upon contact, but an invalid release never queues
a later launch. A negative remaining-buffer value represents no pending press;
zero is the inclusive 150-ms boundary, with a numerical epsilon to avoid
frame-partition rounding differences. Surface/input timers are reset on
blur and reset.
The ceiling clamps the player's top
to zero and stops upward velocity. The fixed camera never follows a jump.
Normal movement speed is 80 cells/second.
A fresh negative `moveY` edge enters persistent background climbing at 20 cells/second with normalized diagonals and no gravity.
Player state retains the previous Up input, climbing mode, drill direction, and climbing animation phase.
Directional release holds position; downward foot contact exits climbing, but Up can depart from a floor.
Jump press while climbing cancels charge, detaches immediately, and restores gravity without launching.
A consumed-jump latch prevents the same press from charging on landing or launching on release.
Another Up edge is required to reattach.
Climbing respects mask collisions, the ceiling, and the solid image bottom.
The bottom participates in floor probes and snapping but never in wall probes or the terrain mask.
The drill direction is normalized from directional input, defaulting to horizontal facing.
A rectangular cutter extends 10 cells from the player center along that direction.
Its transverse half-width covers the projected player footprint plus half a cell, producing a passable tunnel rather than a surrounding excavation.
For horizontal drilling, cells wholly below the player's feet shall remain solid so walking drill travel does not remove the supporting floor.
The cutter runs before collision checks at each half-cell movement substep and while stationary.
Probe the current cutter and its next-frame reach before excavation so rasterization cannot alternate normal and slow speeds at high frame rates.
Active excavation limits horizontal normal-mode movement to twenty cells per second, while an empty cutter retains eighty.
Excavation increments terrain version only when cells change and does not change gravity or charging state.
The renderer draws an oriented drill tip and alternates climbing hands and feet based on distance traveled.
Air movement outside climbing and active excavation remains at normal speed.
Ground movement can step up small terrain edges; higher
obstacles require a jump. Ground contact at any point below the player's
footprint counts as support.

The browser game maps D/A, arrow keys, Space, and held Return to this input
shape.
W/up enters background climbing; W/S and up/down arrows control vertical climbing and drill aim.
Space charges a jump and W/up does not jump.
Touch controls provide four directions, a jump button,
and a dedicated held drill button.

The charge meter shows progress and a distinct MAX READY label at three
seconds. A second bar immediately above the player fills with charge and
changes appearance at maximum; it clears on cancellation/launch and stays
visible inside the image even at the ceiling. The original character drawing
shall scale from 8 by 12 to 6 by 9 cells with the collision footprint.
Keyboard and pointer press/release transitions are queued so a quick
tap between animation frames is not lost. Blur, pointer cancellation,
visibility changes, and restart clear charge without launching.

## Favicon (`src/favicon.svg`, `index.html`)

REQ-CHR-03 uses a local SVG favicon declared by a `rel="icon"` link with `type="image/svg+xml"` and `sizes="any"`.
The square 16-by-16 view box centers the existing right-facing 8-by-12 player artwork at offset (4, 2), retaining its rectangle geometry and palette.
SVG crisp-edge rendering preserves the pixel-art appearance at browser-tab sizes without needing the game renderer or setup state.
The browser test loads and decodes the declared icon before setup, then compares its rasterized pixels against the existing character palette and geometry.

## Run lifecycle (`src/run.js`, `src/app.js`)

`createRun(terrain)` clones the original terrain and retains a variant's precomputed safe spawn and finish gate.
Offered options use route-validated supported endpoints, edge priority, and conservative rejection of walking-only finishes.
The gate is 12 by 18 cells, including its two poles and contrasting checkered banner.
Its position remains fixed after drilling and completion requires rectangle overlap.
No terrain is protected or added beneath it.
The canvas caption occupies normal flow below the playfield so it cannot obscure a gate at any sampled edge.
`respawnPlayer(run)` replaces only player state at the starting position; terrain, enemy patrol progress, and elapsed time survive.

Reset during play or after completion creates a fresh run from the unmodified
original terrain, retains photo/name/scores, clears controls, and resets timer
and charge display. One cancellable animation-frame handle prevents parallel
loops after resetting. Charging and background-climbing movement start race time.
The solid bottom prevents bottom-edge respawns.
Existing per-variant leaderboard entries are retained.

## Score store (`src/leaderboard.js`)

`isValidPlayerName(name)` accepts one or more Unicode letters and spaces, up
to 32 characters, with at least one letter. `getLeaderboard(levelId,
storage)` reads the sorted local top ten. `submitScore(levelId, entry,
storage)` validates, saves, sorts ascending by elapsed milliseconds, and
retains at most ten entries.
Keys are scoped by a SHA-256 digest of the image fingerprint and exact selected option.
Storage errors are surfaced to the UI.
New attempts receive a UUID, while existing entries without IDs remain readable.
Stable sorting keeps existing equal-time attempts ahead of newer ties.
`leaderboardRows` marks only the exact current attempt by ID and appends a transient unranked row if it is outside the stored top ten.
The UI uses a two-pixel outline, a "Your run" label, and `aria-current`, with a blank rank for the footer.
Storage failures still display and mark the unsaved current attempt.
Completion retains the final animation-frame elapsed time rather than mixing animation timestamps with a separate clock read.

## Root entry point and feedback (`index.html`, `src/app.js`)

REQ-SYS-11 moves the HTML entry point to the project root while retaining the implementation modules, stylesheet, and favicon in `src/`.
The browser system runner loads the root entry point, and fixture URLs resolve independently of the game page location.
REQ-SYS-12 places a feedback section outside the setup, game, and completion screens so it remains available in each state.
A labeled native select defaults to Medium and offers Low, Medium, High, and Critical.
Three button-styled links select Bug report, Feature request, or General feedback.
Each link targets `https://github.com/ckloecker/dic-pic/issues/new` with the `feedback.yml` template and custom `category` and `severity` text-field query parameters.
Text inputs in the GitHub form support URL prefilling without relying on dropdown-prefill support or repository-label permissions.
The form requires category, severity, and written feedback and offers optional reproduction steps.
Links open a new tab with `noopener noreferrer`; the UI explains GitHub submission, author attribution, repository visibility, and the absence of automatic photo or score sharing.
Focusing feedback controls clears held game inputs, and keydown events originating within the section do not enter the game input handler.

## Verification

Unit contracts are exercised by `tests/unit/runner.html`. Browser-level
acceptance checks are listed in `tests/acceptance/test-cases.md`. Requirement,
design, implementation, and test links are maintained in
`traceability/requirements-matrix.md`.
