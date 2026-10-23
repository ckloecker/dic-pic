# System test procedures

Run the app from the repository root using `python -m http.server 8000`, then open `http://localhost:8000/`.
Use `tests/fixtures/route-photo.svg` as the repeatable playable image input.

Automated browser procedures are available at
`http://localhost:8000/tests/system/runner.html`. Keep that tab visible while
tests run; background tabs can throttle animation frames. These tests use
`route-photo.svg`, sparse `platform-photo.svg`, and `uniform-photo.svg`.
Completion checks temporarily write only their exact fixture score key and restore its original value in `finally`.

| ID | Requirements | Procedure | Expected result |
|---|---|---|---|
| ST-01 | REQ-SYS-01/11 | Open the project root URL in a current browser at desktop and narrow/mobile viewport sizes, including a repository-path hosting prefix. | The root URL serves the setup screen with working styles, icon, and modules, and play remains usable at both sizes. |
| ST-02 | REQ-SYS-03, REQ-LVL-01/03/04/16 | Upload route-capable and sparse fixtures, start a level, and inspect the collision mask. | Both provide three playable choices; photo edges remain visible; density is a preference rather than a rejection gate. |
| ST-02b | REQ-LVL-05 | Upload a uniform image without visible edges. | Contrast normalization cannot invent a contour; the game rejects the image and asks for another. |
| ST-03 | REQ-SYS-04 | Leave the player idle, move or charge, then touch the exit flag. | The timer stays at zero until player-driven movement or charging, and stops on actual contact with the flag, not a horizontal crossing at another height. |
| ST-04 | REQ-SYS-05, REQ-SYS-06 | Try invalid and valid names, complete two runs of the same image, then inspect results. | Invalid names cannot start; valid names are saved with sorted per-image scores in this browser. |
| ST-05 | REQ-MOV-01 through REQ-MOV-04, REQ-MOV-10 | Use Space and touch JUMP; climb without drilling; walk while drilling horizontally across supported terrain; aim drill in all directions and measure horizontal excavation at 30/60/120 Hz. | Horizontal drilling preserves the supporting floor. Active horizontal excavation is 20 cells/s; open walking/drilling is 80; climbing is 20 with normalized diagonals; gravity and charge remain unchanged. |
| ST-06 | REQ-CHR-01, REQ-LVL-02 | Inspect the rendered character and level overlay. | Visuals use original character art and a general retro pixel-art style. |
| ST-07 | REQ-LVL-06 | Sample tops, sides, undersides, tunnel boundaries, and interiors against the photo. | Exposed outlines are fully opaque; interiors blend 80% terrain and 20% background within one rounding unit. |
| ST-08 | REQ-MOV-05/06, REQ-SYS-04 | Press Space or touch JUMP and compare tap, partial, 250 ms, and longer holds; blur during ascent and jump into the ceiling. | Press launches and starts race time immediately; hold raises the apex from approximately 38.6 to 77.1 cells; both bars fill to MAX JUMP; release and blur end assistance without another impulse; the ceiling blocks upward travel and ends assistance. |
| ST-09 | REQ-SYS-08/09/14, REQ-MOV-08 | Reset a modified run, then drill down to the image bottom. | Manual reset and bottom contact restore the original run state without changing saved scores; bottom contact clears the timer and does not leave the player at the boundary. |
| ST-10 | REQ-LVL-07/08 | Drill under the flag and inspect a multi-height photo. | Flag remains fixed without protected support; multiple separate platforms follow image edges. |
| ST-11 | REQ-LVL-09, REQ-CHR-02 | Inspect terrain and runner scale. | 6-by-9 character; no unconditional rectangular cuts or invented freestanding vertical walls; diagonal photo contours survive noise suppression. |
| ST-12 | REQ-MOV-02/07 | Walk inclines/declines and press jump beside terrain walls and both vertical image borders; test three-cell contact and 150 ms buffered presses; press just after walking off a cliff and after leaving a wall. | Slopes retain support; eligible presses launch immediately upward and away from walls; still-held presses buffer for 150 ms; release cancels queued launches; continued assistance does not require surface contact; floor grace extends three cells and wall grace four cells from the last contact, once per launch. |
| ST-13 | REQ-MOV-10 | Climb, stop, drill and release drill, then press jump; hold through landing and release. | Animated hands/feet grip the wall; jump press drops immediately without charge or launch; held Up does not reattach; a consumed drop press cannot charge on landing or jump on release. |
| ST-14 | REQ-CHR-03 | Load the game before setup; fetch and decode its declared favicon and compare rasterized pixels with player artwork. | The local SVG loads successfully and matches the original character geometry and colors without starting a game. |
| ST-15 | REQ-LVL-10/11/12, REQ-CHR-04 | Generate three suggestions, compare preview/live geometry, inspect biome headwear and textures, drill elements, then reset. | Three distinct labeled options precede play; biome elements collide and drill; headwear is cosmetic; reset restores the exact selected option. |
| ST-16 | REQ-LVL-07/11/16 | Generate seeded batches and measure local edge evidence, closing/filling, spawn distance, and gate extents. | All biome/layout/edge choices occur; layout uses real local edge directions; the 12-by-18 gate and distant start are clear and in bounds. |
| ST-17 | REQ-LVL-10/13 | Compare effects at different times with and without reduced motion; inspect scenery scale, anchors, collision, and drilling. | Effects freeze under reduced motion; jungle trees span 27-45 cells; substantial scenery remains collidable/drillable. |
| ST-18 | REQ-LVL-01/06/11 | Use raw mixed-orientation and large-region/noise unit fixtures; compare masks and alpha channels. | Horizontal and vertical preferred-region cell ratios exceed two; balanced retains both; tiny fragments are absent; source photo filling precedes protected route clearance; exposed outlines have alpha 255 and interiors 204. |
| ST-19 | REQ-LVL-07 | Test flat floors, the empty solid bottom, slopes, downward walking routes, and elevated alternatives; generate seeded options. | Walk-only pairs are rejected regardless of distance, alternatives remain distant and in bounds, and unsatisfiable generation shows a clear error. |
| ST-20 | REQ-LVL-06/14 | Sample filtered photo colors and terrain halo pixels; compare thumbnails/live scenes and excavate. | Photo darkens/desaturates without affecting image analysis or artwork, the halo has no collision, and opaque outlines/translucent interiors persist. |
| ST-21 | REQ-LVL-12/15/21, REQ-SYS-08/10/14 | Observe each biome's enemies idle and moving; cross patrols while drilling and holding controls, then manually reset. | Two clear, bounded, separated patrols follow their seeded flight paths safely; contact fully resets terrain, timer, enemies, pickups, platforms, player state, and held input without a score write. |
| ST-22 | REQ-LVL-01/08/09/11/16 | Generate diverse seeded photos and replay final physics/enemies; tamper with duration evidence, clearance, and drilling. | Numeric target misses do not reject valid options; no-drill, clear endpoints/corridors, movement variety, and non-walking completion remain mandatory. |
| ST-23 | REQ-LVL-08/16 | Test twelve/eighteen/nineteen-cell supported gaps, missing edge evidence, and sparse-source supplemental shelves. | Longer bridges are allowed; natural-edge bridges retain real anchors; supplemental horizontal platforms need not attach at both ends and remain drillable/resettable without obstructing clearance. |
| ST-24 | REQ-SYS-06, REQ-LVL-16 | Replay the same selected route to actual completion twice; populate ten faster entries and replay; simulate storage failure. | Exact current attempt alone is outlined/labeled, stable ties retain the older entry, an unranked footer has no place and does not persist, and failed saves remain visible with an explicit error. |
| ST-25 | REQ-LVL-01/03/05/07/08/09/11/12/16 | Generate three choices for the portrait, sparse horizontal/vertical edges, disconnected platforms, dense clutter, and older sparse fixtures; also upload a uniform image. | Edge-bearing sources use route repair and strongest-edge selection rather than density rejection; final replays remain safe and no-drill; only the uniform source rejects for missing visible edges. |
| ST-26 | REQ-SYS-12 | Select each severity and inspect all three category links; use the controls by keyboard during a run; inspect the GitHub form. | All twelve category/severity combinations prefill the repository form, no private game data is included, feedback remains available at setup/play/completion, and keyboard input does not affect gameplay. |
| ST-27 | REQ-SYS-12 | After merging the issue form into the default branch, open each category from the deployed site and review the form while signed in. | GitHub shows the selected category and severity, accepts written feedback, and records the signed-in GitHub user as author on submission. |
| ST-28 | REQ-SYS-12/13 | Push to `develop` with Pages configured for GitHub Actions; inspect the published version and all feedback links, then compare with an unstamped local copy. | Only `develop` triggers deployment; the game displays and submits the exact branch and full triggering SHA, while local copies explicitly report Not injected. |
| ST-29 | REQ-SYS-16 | Inspect control guidance during setup and play at desktop and mobile viewport widths. | Setup and gameplay controls have prominent headings, clear visual grouping, readable instructions, and usable touch buttons without horizontal overflow. |
| ST-30 | REQ-LVL-06/20 | Sample exposed outlines and at least four solid interior cells per biome from previews and gameplay. | Outlines have stronger contrast against the photo; same-biome interiors have uniform RGB values and alpha 204; decorative details remain occasional. |
| ST-31 | REQ-LVL-18 | Compare eight-by-eight-cell pickup artwork and auras in previews and gameplay; move through the aura alone and then the body of each type; simulate five seconds, collect duplicates, and reset. | Vivid yellow lightning bolts and magenta/red spotted mushrooms remain recognizable with dark outlines and soft auras at both rendering scales; aura-only contact neither collects nor blocks, while body contact collects without blocking; speed doubles movement and mushrooms reverse directional input for five seconds; duplicates refresh timers without stacking; reset restores pickups and clears effects. |
| ST-32 | REQ-LVL-19 | Record platform positions over time, ride a platform, drill a path barrier, and inspect route replay/reset. | Both collidable platforms move at 18 cells/s, reverse at clear boundaries, extend into newly drilled space, remain outside the required reference route, and return to preview positions on reset. |
| ST-33 | REQ-SYS-15/REQ-LVL-17 | Start with two names, complete a round, select the next player, and restart the selected option; compare generation across reloads. | Both players play the same deterministic ordered suggestions and selected course; next-round selection changes score attribution while restoring the course and timer. |
| ST-34 | REQ-CHR-05 | Compare underwater player pixels across different animation phases and compare with a non-underwater biome. | Swimming artwork visibly animates only underwater and remains inside the unchanged 6-by-9 collision footprint. |
| ST-35 | REQ-LVL-15/17/21 | Observe two-axis enemy flight, reset and replay identical timed inputs, and cross vertical path segments and waypoint turns. | Paths and motion repeat, stay clear of terrain and protected areas, and swept contact resets the full run without tunneling or bounding-box false positives. |

## Current voted-issue verification

Execution on 2026-10-23 passed **88/88 unit checks** and **23/23 browser system checks** in Chromium.
ST-09/21 verify full failure resets, including timer, drilled terrain, held controls, initial enemies, and no saved score.
ST-29/30 cover prominent controls and uniform terrain filling without changing outline/interior opacity.
ST-31/32 have unit coverage for pickup counts, five-second non-stacking effects, refresh, reversal, moving-platform collision, path extension, and full reset.
ST-33 verifies the second player receives the same initial course with a zero timer and that their completed round is saved under their own name.
ST-34/35 have unit coverage for animated swimming within the unchanged footprint and reproducible two-axis flying paths with swept contact across vertical segments and turns.
The integrated enemy-contact check restores an actually excavated cell and verifies the reset player remains idle with cleared controls.
Rendering comparisons isolate opaque gameplay artwork from swimming animation and browser-dependent filtered-photo rasterization.
Setup and gameplay fit 320-, 390-, and 1280-pixel viewports without horizontal overflow, retaining all six touch buttons during play.
The existing leaderboard, movement, feedback, preview, timer, and animation-loop checks also pass.
Physical mobile, camera, deployment, and independent-browser acceptance checks remain outstanding.

## Deployed feedback version verification

Execution on 2026-10-21 passed **6/6 deployment script integration tests** and **22/22 browser system checks** with HTTP caching disabled.
The injection tests initially failed because the script did not exist, and the browser tests reproduced missing HTML metadata and version display.
Integration tests cover exact branch/full SHA, HTML escaping including replacement-string metacharacters, unchanged source HTML, missing branch, missing or invalid SHA, and missing HTML markers.
Browser checks cover local Not injected values and a separately stamped document across all twelve category/severity combinations.
A staged artifact under a project-style URL prefix displayed and submitted `develop` and the synthetic full SHA `0123456789abcdef0123456789abcdef01234567`.
The full SHA wrapped without horizontal overflow at a 320-pixel viewport.
Workflow YAML checks confirmed the develop-only push trigger, GitHub event metadata, static artifact path, and scoped job permissions.
The issue-form YAML includes branch and commit text inputs.
VS Code reported no diagnostics in changed implementation, workflow, form, or test files.
The GitHub-hosted workflow and updated form remain post-deployment checks under ST-27/28; no deployment or issue submission was performed locally.

## Root hosting and GitHub feedback verification

Execution on 2026-10-21 passed **21/21 browser system checks** at the server root and **21/21** beneath `/dic-pic/`, with HTTP caching disabled.
The new checks initially reproduced the missing project-root setup and feedback UI before implementation.
ST-01 verifies the root entry point, relative module/style URLs, loaded styles, and unchanged fixture upload and gameplay behavior.
ST-26 verifies all twelve category/severity combinations, required issue-form fields, new-tab protections, no extra private query parameters, feedback availability through completion, and keyboard isolation during play.
The issue form parsed successfully as YAML and its required fields were checked.
Responsive checks at 1280, 390, and 320 pixels found no horizontal page overflow or feedback buttons outside the viewport.
The changed HTML, JavaScript, CSS, issue form, and browser tests have no VS Code diagnostics.
ST-27 remains a post-deployment acceptance check because GitHub must load the issue form from the default branch.
No GitHub issue was submitted during verification.

## Current execution: acceptance-first photo repair

Execution on 2026-10-19: **77/77 unit checks and 18/18 browser system checks passed** in Chromium with HTTP caching disabled.
The approved revision retains featureless-image rejection but replaces density, section-count, and duration rejection with quality preferences and progressive geometry repair.
The initial revised unit baseline passed 73/76, reproducing the nineteen-cell bridge cap, sparse-photo density rejection, and percentile-normalization loss of a small strong edge.
ST-25 now covers sparse horizontal edges, a single narrow vertical object, disconnected platforms, and dense checkerboard clutter at two deterministic seeds each.
All twenty-four resulting synthetic options pass actual no-drill replay and conservative walking-only rejection.
Additional checks verify strongest-trace selection without source mutation, preserved source geometry, horizontal-only supplemental shelves, clear corridors, ordinary drilling of added cells, and exact reset.
The new browser check uploads the previously unsuitable sparse platform fixture, receives three previews, selects one, and verifies exact scene restoration without starting the timer.
Existing opacity, preview/live consistency, climbing/drop, excavation, reset scheduling, enemy-contact preservation, actual route completion, and scoreboard checks remain passing.
The descent test's timeout now accommodates climbing from a high spawn to the bottom at twenty cells per second instead of assuming a lower spawn.
Final local generation and replay checks accepted every option in this sample:

| Source | Seeds | Verified options |
|---|---|---|
| Supplied portrait | 1–6 | 18/18 |
| Edge fixture | 1–3 | 9/9 |
| Sparse platform fixture | 1–3 | 9/9 |
| Mixed-orientation fixture | 1–3 | 9/9 |
| Route fixture | 1–3 | 9/9 |
| Four sparse/disconnected/busy synthetic cases | 123 and 456 | 24/24 |

This finite sample demonstrates the acceptance improvement without claiming a universal acceptance rate for unseen photos.
Final portrait batches, including replay validation, took approximately 1.1–1.8 seconds in this environment.
The supplied portrait remains local, unmodified, and absent from repository fixtures.
Its repaired biome thumbnails were visually inspected for retained photo contours, supplemental horizontal supports, clear goals, and distinct scenery.
Uniform-image rejection, safe in-bounds endpoints, and final non-walking completion remain mandatory.
VS Code reported no diagnostics in the changed implementation and test files.
Browser tests restore only their own exact score key and leave gameplay stopped.
Physical Android/iOS, camera permissions, and simultaneous real touch input remain unverified.

## Historical execution: strict photo-aligned reference routes and current-run results

Execution on 2026-10-19: **75/75 unit checks and 17/17 browser system checks passed** in Chromium with HTTP caching disabled.
The initial added baseline passed 68/71, reproducing missing shoulder contours, fast excavation, and absent exact-attempt scoreboard rows.
The route-module and strict-criteria tests then reproduced the missing planner and invalid density.
A later explicit three-second idle-padding mutation initially failed at 74/75 and passed after final replay validation rejected idle padding.
ST-05 measures active excavation at twenty cells per second at 30, 60, and 120 Hz while empty drilling remains eighty.
The native animation check performs five resets and verifies exactly one scheduled frame and no duplicate frame timestamp.
ST-22 replays final options with actual movement and enemy simulation, validates clearance and final openness, and rejects wrong duration, missing sections, drilling, idle padding, blocked clearance, and changed occupancy.
ST-23 checks twelve/eighteen-cell bridges, rejects nineteen-cell gaps and missing support/evidence, and verifies original photo evidence is not mutated.
Raw edge fixtures retain diagonal shoulder-like slopes and local direction metadata without artificial periodic cuts.
A second substantial vertical-column photo verifies valid routes, photo-derived collision geometry, and room for elaborate jungle trees and vines.
Sparse source images clearly reject instead of receiving invented filler.
ST-24 completes the real application through recorded directional keyboard input without drilling, including ranked, equal-time, unranked, and simulated failed-save outcomes.
It verifies the two-pixel outline, "Your run", `aria-current`, blank unranked place, stable ties, and top-ten-only persistence.
The integrated patrol check still verifies player-only respawn, preserved time and tunnel pixels, cleared held controls, no score writes, and exact manual reset.
Controlled-frame checks stop gameplay before restoring scheduling, and completion tests restore only their fixture's original score key.
After verification, three precisely identified earlier test-score entries were removed without clearing unrelated storage, browser request/focus overrides were restored, and the temporary server was stopped.
VS Code reported no diagnostics in changed production and test files.
The supplied portrait was opened locally without modification or copying into the repository.
It now clearly rejects because insufficient photo-derived ground survives the approved corridor and 55–70% open-space criteria; no threshold was relaxed.
A seed-123 three-option route-fixture batch took about 610 ms:

| Biome / layout | Reference seconds | Sections | Open cells |
|---|---|---|---|
| Desert / vertical | 36.03 | 5 | 64.34% |
| Underwater / balanced | 25.58 | 5 | 63.74% |
| Jungle / horizontal | 32.01 | 5 | 64.50% |

Reference routes mix walking and background climbing; charged jumping and drilling remain unrestricted player-selected shortcuts.
The source portrait rejection and route-fixture thumbnails/live geometry were inspected.
Historical raw platform and mixed-orientation fixtures are not guaranteed to satisfy the new minimum amount of ground.
Physical Android/iOS, camera permissions, and simultaneous real touch input remain unverified.

## Historical execution: non-walking routes, readability, and enemy contact

Execution on 2026-10-18: **68/68 unit checks and 15/15 browser system checks passed** in Chromium with HTTP caching disabled.
The initial new unit baseline passed 62/66 and reproduced absent enemies, walk-only placement acceptance, missing reachability validation, and missing photo treatment.
ST-19 checks flat floors, the image bottom, slopes, walking falls, elevated alternatives, and all seeded options against the conservative reachability graph.
ST-20 measures photo darkening/desaturation, restored rendering context, noncolliding halo pixels, unchanged terrain alpha, and matching preview/live artwork.
ST-21 measures protected clear patrol corridors, repeated reflection, large timesteps, swept contact including reversal endpoints, distinct biome artwork, and patrol-aware option identity.
The integrated enemy-contact check drives keyboard climbing and drilling through a real terrain region into a patrol using controlled animation frames.
It verifies return to the selected spawn, preserved elapsed time and tunnel pixels, cleared held controls, no completion or score writes, and exact manual reset of the initial terrain/enemies.
Native animation checks required browser focus emulation after hidden-tab throttling caused timeouts; no production scheduling changes were needed.
Eighteen options generated locally from the supplied portrait passed both-direction ten-second walking-only simulations without finishing.
A measured portrait suggestion batch took 427 ms after row-group route-graph optimization.
The filtered portrait thumbnails, dark terrain boundaries, and biome enemy artwork were visually inspected.
The portrait attachment was not modified or stored as a repository fixture.
VS Code reported no diagnostics in changed production and test files.
A separate diagnosed limitation remains: four-neighbor grouping fragments diagonal shoulder contours despite successful edge tracing.
Physical Android/iOS, camera permissions, and simultaneous real touch input remain unverified.

## Historical execution: substantial layouts and opaque outlines

Execution on 2026-10-18: **62/62 unit checks and 14/14 automated browser system checks passed** in Chromium with HTTP caching disabled.
The new outline/layout tests initially passed 58/60, reproducing the reported failures before implementation.
ST-07/18 verify opaque tops, sides, undersides, and newly exposed drilled boundaries, with only interiors at 80% opacity.
ST-16/18 and AT-25 verify complete filling before traversal cuts, distinct orientation masks, large regions without an occupancy cap, and tiny-fragment suppression.
On the [mixed-orientation fixture](../fixtures/mixed-orientation-photo.svg), horizontal retains 6,447 wide-object cells and no tall-object cells, vertical retains 6,789 tall-object cells and no wide-object cells, and balanced retains both at 23.0% total solid.
The browser suite generates and plays all three fixture options, retaining the existing reset, biome, climbing, drilling, and charge checks.
A single-orientation regression verifies that vertical preference does not invent walls when a photo contains only horizontal geometry.
The three mixed-fixture previews were visually inspected, confirming clearly different filled platform, wall, and balanced silhouettes with opaque boundaries.
VS Code reported no diagnostics in the changed production and test files.
The former occupancy and whole-overlay-opacity results below are historical and superseded by this execution.
Physical Android/iOS, camera permissions, and simultaneous real touch input remain unverified.

## Historical biome, drop, finish-gate, and effects revision

Execution on 2026-10-18: **58/58 unit checks and 13/13 automated browser system checks passed** in Chromium with HTTP caching disabled.
Tests were updated before implementation, initially reproducing missing drop behavior, finish sizing, suggestion generation, elaborate scenery, and background effects.
Browser checks verify three distinct choices before play, exact preview/live geometry, exact initial-scene restoration, unobscured edge gates, and animation/reduced-motion behavior without race-time changes.
Seeded unit checks measure actual tree silhouettes, all biome/layout/edge choices, collision/drilling, safe starts and gates, morphological closing and bounded filling, and the 80% open-space minimum.
A real jungle run finished in 3.64 seconds and saved one variant-keyed leaderboard entry; test score changes were then cleaned up without altering unrelated entries.
Three biome thumbnails and the full jungle scene were visually inspected.
A 390-pixel iframe had a 375-pixel content viewport and document width with three 341-pixel-wide choices, confirming no horizontal overflow.
VS Code reported no diagnostics in the changed production and test files.
Physical Android/iOS, camera permissions, and simultaneous real touch input remain unverified.

## Historical execution record

- ST-01: Passed in Chromium at desktop and 390 px viewport widths. Android,
  iOS, and other default browsers were not available for device-level testing.
- ST-02: Passed with the repeatable SVG fixture; image upload and visible
  background verified. Terrain edge detection and the revised 80% open-space bound
  also pass unit tests.
- ST-02b: Passed in-browser with a uniform image: the rejection message
  appeared, Start became disabled, and another image could be selected.
- ST-03: Automated browser checks confirm idle/charge/movement timing.
  A browser-controlled bubble traversal of the new platform fixture completed
  in 31.42 seconds and displayed/saved the result. Unit tests also verify
  contact versus horizontal-only crossing.
- ST-04: Automated invalid-name and reset/no-score-write checks pass.
  Per-image top-ten sorting/persistence passes unit tests; result display and
  score saving were also exercised with the new platform fixture.
- ST-05: Automated keyboard charge and bubble controls pass. Unit checks
  measure horizontal/vertical/diagonal speed, hover, excavation, and gravity
  restoration. On-screen layout was checked at 390 px without overflow;
  physical touch-device and simultaneous touch-button testing remain outstanding.
- ST-06: Visually inspected in-browser; implementation uses an original
  character and does not reuse a named game's artwork.
- ST-07: Automated browser sampling verifies the 80% blend at three platform
  heights.
- ST-08: Automated charge/release/MAX/timer and blur checks; unit checks cover
  full-height launch strength, airborne rejection, charge cancellation,
  fractional-coordinate support, and ceiling collision.
- ST-09: Automated reset UI check plus unit restoration/respawn checks.
  Reset after browser completion returned to play at `0.00` and retained the
  displayed saved score.
- ST-10: Unit checks for fixed flag and separated platforms. The supplied
  classroom photo was opened locally and visually inspected; desks and board
  edges produce platforms at their actual image heights. The photo was not
  copied into the repository.

### Space/slope/wall-jump revision

Latest automated results: **41/41 unit checks and 8/8 browser system checks
passed** in Chromium on 2026-10-17. Browser checks now verify Space-only
jumping, partial/full character charge-bar pixels, the bar following the
6-by-9 sprite, and clearing on launch/cancellation. Unit checks cover
three-cell floor/wall distances, charged slope ascent/descent, left/right
wall launch with continuing gravity, charge preservation/expiry at 150 ms,
press buffering across different frame durations, rejected distant releases,
and generated vertical edges supporting actual wall jumps.

The earlier completion/score-saving and original classroom-photo inspections
above predate this revision. A new full browser completion and fresh
classroom-photo play-through have not been performed. Physical mobile,
camera permissions, and simultaneous touch controls remain unverified.

### Background-climbing and tunnel-drill revision

The current ST-05/09/13 and AT-07/09/12/14/19/20 procedures supersede the historical bubble and bottom-respawn expectations above.
The revised unit tests initially passed 37/46 against the previous implementation, reproducing all nine expected movement/drill/bottom failures.
The revised browser suite initially passed 6/9, reproducing missing background climbing, drill-release grip, and solid-bottom behavior.
Additional regressions cover climbing boundary velocities and nearest-floor snapping just above the image bottom.
Final execution on 2026-10-17: **49/49 unit checks and 10/10 browser system checks passed** in Chromium with caching disabled.
The climbing pose and revised controls were visually inspected on the integrated canvas.
Physical Android/iOS, camera permissions, simultaneous touch input, and a renewed classroom-photo play-through remain unverified.

### Player-character favicon

ST-14 initially failed because no favicon was declared.
After implementation, **11/11 browser system checks passed** in Chromium on 2026-10-17 with caching disabled.
The new check fetches and decodes the favicon before setup, then compares every rasterized pixel against the player character's geometry and palette.
