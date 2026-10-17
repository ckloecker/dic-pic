# Requirements traceability

## Design artifacts

- [System architecture](../design/system/game-architecture.md) allocates
  requirements to components.
- [Detailed design](../design/detailed/game-components.md) specifies terrain
  detection, collision, charged jumps, background climbing, directional tunnel drilling, and run lifecycle.

## Requirement links

| Requirement | Implementation | Verification |
|---|---|---|
| REQ-SYS-01 | [HTML](../src/index.html), [responsive styles](../src/styles.css) | ST-01: desktop browser and narrow-viewport checks; physical Android/iOS and camera validation remain outstanding. |
| REQ-SYS-02 | [Renderer](../src/app.js), [physics](../src/physics.js) | ST-01/ST-06: 2D rendering and controls. |
| REQ-SYS-03 | [Terrain](../src/terrain.js), [run placement](../src/run.js), [photo renderer](../src/app.js) | Unit multi-height/edge tests; browser fixture and local classroom-photo inspection (ST-02/ST-10). |
| REQ-SYS-04 | [Timer and completion](../src/app.js), [flag contact](../src/run.js) | Browser charge/timer test; unit flag overlap test rejects horizontal-only crossing. |
| REQ-SYS-05 | [Validation](../src/leaderboard.js), [setup](../src/app.js) | Unit name tests and automated browser invalid-name check. |
| REQ-SYS-06 | [Scores](../src/leaderboard.js), [result UI](../src/app.js) | Unit per-image top-ten sorting; saved browser entries retained during reset. |
| REQ-SYS-08 | [Run cloning](../src/run.js), [reset UI and animation cancellation](../src/app.js) | Unit terrain/timer restoration; browser reset checks name, timer, charge, held input, and no score write. |
| REQ-SYS-09 | [Solid bottom](../src/physics.js) supersedes bottom-edge respawning; [game loop](../src/app.js) no longer triggers it | Unit bottom landing/walking/jumping and excavated-bottom tests; browser drill-down test confirms no respawn. |
| REQ-LVL-01 | [Terrain mask](../src/terrain.js) | Unit measured open-space ratio >= 0.8, including dense features, and open space beneath upper platforms. |
| REQ-LVL-02 | [Terrain renderer](../src/app.js) | ST-06: original retro-style overlays visually inspected. |
| REQ-LVL-03 | [Normalized Sobel detection](../src/terrain.js) | Unit strong/low-contrast edge tests. |
| REQ-LVL-04 | [Upload/camera inputs](../src/index.html), [decoding](../src/app.js) | Automated browser upload tests; physical camera support/denial testing remains outstanding. |
| REQ-LVL-05 | [NoUsableEdgeError](../src/terrain.js), [error UI](../src/app.js) | Unit uniform-image rejection and browser rejection/reselection check. |
| REQ-LVL-06 | [Opacity constant](../src/terrain.js), [compositing](../src/app.js) | Unit asserts 0.8; automated browser checks actual 80% composited colors at three platform heights. |
| REQ-LVL-07 | [Fixed flag](../src/run.js), [flag renderer](../src/app.js) | Unit drills all support to the bottom, verifies no protected terrain and unchanged flag coordinates. |
| REQ-LVL-08 | [Multi-edge platforms](../src/terrain.js) | Unit multiple image-aligned platform heights, no unrelated connectors, open gaps, and near-duplicate suppression; browser synthetic-photo rendering; local classroom-photo inspection. |
| REQ-LVL-09 | [Bidirectional edge tracing and solid budget](../src/terrain.js) | Unit checks repeated 48-cell sections/12-cell gaps, duplicate edges not refilling gaps, vertical photo-edge walls that support actual wall jumps, and dense-feature open-space ratio >= 0.8; ST-11/AT-17. |
| REQ-CHR-01 | [Character renderer](../src/app.js) | ST-06: original character visually inspected. |
| REQ-CHR-03 | [SVG player icon](../src/favicon.svg), [favicon declaration](../src/index.html); [detailed favicon design](../design/detailed/game-components.md#favicon-srcfaviconsvg-srcindexhtml) | Browser test loads and decodes the icon before setup and compares every 16-by-16 RGBA pixel with the player artwork; ST-14/AT-21. |
| REQ-CHR-02 | [Player dimensions](../src/physics.js), [scaled renderer](../src/app.js), [flag anchoring](../src/run.js) | Unit verifies 6-by-9 collision dimensions and normal speed; browser sprite bounds and bar-following checks; ST-11/AT-19. |
| REQ-MOV-01 | [Input mapping](../src/app.js), [four-way touch controls](../src/index.html) | Browser verifies Space charge/release, W/up background climbing without drilling, and downward drill input; physical simultaneous touch-button testing remains outstanding. |
| REQ-MOV-02 | [Floor/wall probes and release-to-jump](../src/physics.js) | Unit verifies left/right wall jumps up/away despite input toward wall, continued gravity while charging, grounded release, and no surface-free air jumps. |
| REQ-MOV-03 | [Directional cutter and substep excavation](../src/physics.js), [oriented drill renderer/input](../src/app.js) | Unit eight-direction cuts, uncut terrain behind/away from drill, facing fallback, persistent tunnels, version invalidation, upward penetration, downward drilling, unchanged speed/gravity/charge; ST-05/AT-09. |
| REQ-MOV-04 | [Normal air movement](../src/physics.js) | Unit verifies normal horizontal airborne speed with and without drilling, with quarter-speed climbing tested separately. |
| REQ-MOV-05 | [Charge simulation](../src/physics.js), [HUD and character bars/input](../src/app.js) | Unit three-second cap, numerical full-height rise, partial strength, no automatic launch, grace-expiry cancellation, drilling preservation, and background launch. Browser tests check bar filling, full-charge color, following the smaller sprite, launch/blur clearing, and timer. |
| REQ-MOV-06 | [Ceiling collision](../src/physics.js), [fixed scene](../src/app.js) | Unit verifies y >= 0, stopped upward velocity, and subsequent gravity. |
| REQ-MOV-07 | [Shared contact probes, snapping, grace and input buffer](../src/physics.js) | Unit verifies 3-cell floor/wall tolerance, continuous charged ascent/descent on slopes, 150-ms charge grace and held-press buffering, distant-release cancellation with no queued launch, and no upward snapping/boundary jumps; ST-12/AT-18. |
| REQ-MOV-08 | [Boundary-aware floor probes and bottom clamp](../src/physics.js), [game loop](../src/app.js) | Unit empty-mask landing/walking/charging/jumping, nearest terrain above bottom, descending climber landing, and drilling to indestructible bottom; browser drill-down/standing/jump check; ST-09/AT-14. |
| REQ-MOV-09 | [Unchanged floor/wall charged-jump interaction](../src/physics.js) | Existing REQ-MOV-01/02/05/07 regression tests rerun successfully. |
| REQ-MOV-10 | [Climbing state, edge-triggered attachment, normalized movement, and background jump](../src/physics.js), [animated gripping pose and timer](../src/app.js) | Unit quarter-speed directions/diagonals, idle hold, landing/walking transitions, collision/ceiling/side bounds, jump detachment/fresh-Up reattachment; browser W/up attach/hold/timer, drill-release grip, background jump/fall, and changing hand-pose pixels; ST-13/AT-20. |

## Requirement derivation

| Detailed requirement | Parent |
|---|---|
| REQ-LVL-01 through REQ-LVL-09 | REQ-SYS-03; REQ-LVL-02 also supports REQ-SYS-02; REQ-LVL-05 elaborates REQ-LVL-03; REQ-LVL-09 elaborates REQ-LVL-08 |
| REQ-CHR-01/02 | REQ-SYS-02 |
| REQ-CHR-03 | REQ-CHR-01; presents the original player character as the game page identity |
| REQ-MOV-01 through REQ-MOV-07 | REQ-SYS-02; REQ-MOV-05 also changes timing under REQ-SYS-04; REQ-MOV-07 elaborates REQ-MOV-02/05 |
| REQ-SYS-08, REQ-SYS-09 | REQ-SYS-04 run lifecycle |
| REQ-MOV-08 | REQ-SYS-02; supersedes REQ-SYS-09 for bottom-edge falls |
| REQ-MOV-09 | REQ-SYS-02; confirms unchanged REQ-MOV-01/02/05/07 after withdrawal of the proposed jump redesign |
| REQ-MOV-10 | REQ-SYS-02/04; replaces bubble traversal with background climbing and extends REQ-MOV-05 to background attachment |

## Verification record

Before implementation, revised tests failed for the expected reasons:
opacity remained 0.7; multiple photo edges were reduced to one floor; the
run lifecycle module did not exist; charged input and ceiling behavior were
missing. The bubble revision then failed quarter-speed, hovering, circular
excavation, charge-transition, and fixed-flag tests against the old drill.
Regression tests also reproduced fractional support loss and duplicate
object outlines obstructing a charged jump.

Previous execution (2026-10-17): **31/31 unit tests and 6/6 automated browser
system tests passed**. An additional browser-controlled traversal on the platform
fixture reached the flag, displayed and saved the 31.42-second result, then
reset after completion to `0.00` while retaining the saved score.

### Space, slopes, smaller runner, and wall-jump revision

The user's confirmed choices revised REQ-MOV-01/02/05, added REQ-MOV-07 and
REQ-CHR-02, and revised REQ-LVL-01/03 with derived REQ-LVL-09. The user explicitly
required current three-cell proximity at release even during grace, and
continued falling while wall-charging. These supersede immediate charge
cancellation on contact loss and grounded-only charged jumps.

Tests were changed before production code: **30/41 unit checks passed**
against the former implementation. Expected failures included continuous
platforms without jump gaps, absent vertical walls, the former 8-by-12
footprint, lost descending-slope support, absent wall jumps, immediate charge
cancellation, and missing input buffering. The browser Space-charge test also
failed against the old mapping. Dimension-dependent regression fixtures were
updated to place the smaller player's feet on the same surfaces. The old
duplicate-outline assertion was moved away from a newly required platform
gap, with a new assertion that duplicates cannot refill that gap.

Latest execution (2026-10-17): **41/41 unit checks and 8/8 automated browser
system checks passed** in Chromium. A boundary regression also reproduced
press-buffer expiry at exactly 150 ms with 50-ms frames; the fix preserves
that boundary independent of frame partitioning, while rejecting 151 ms.
Browser validation disabled its cache and emulated a visible/focused page
to avoid stale scripts and hidden-tab animation throttling; production
blur/visibility cancellation was not weakened.

Physical mobile/camera/multi-touch testing and renewed assessment of the
original classroom photo's playability remain outstanding. The previous
31.42-second completion was before this terrain/character revision; a new
full browser completion was not part of the current automated checks.

Run the [unit runner](../tests/unit/runner.html) and
[browser system runner](../tests/system/runner.html) through the local HTTP
server. Acceptance procedures are in
[test-cases.md](../tests/acceptance/test-cases.md), and broader system
procedures/limitations are in [system-tests.md](../tests/system/system-tests.md).

### Background climbing, directional drill, and solid-bottom revision

The user approved persistent quarter-speed background climbing with idle grip, charged jumps from the background, fresh-Up reattachment after jumping, and directional drilling that preserves movement physics.
REQ-MOV-01/03/04/05/06/09 and REQ-CHR-02 were reconciled with new REQ-MOV-10 and the previously approved REQ-MOV-08.
Both design artifacts and the acceptance/system procedures were updated together.
The older bubble and bottom-respawn execution records above are historical, not the current behavior.

Tests were revised before production changes: **37/46 unit checks passed**, with nine expected failures for drill speed/gravity, circular excavation, charge cancellation, missing background attachment/jumping, and the missing solid bottom.
The revised browser suite initially passed **6/9**, failing background climbing, drill-release grip, and solid-bottom behavior.
Additional boundary regressions first reproduced nonzero climbing velocity at the image edges and descending floor snapping past photo terrain just above the bottom.
Those defects were corrected in the shared movement simulation.

Final execution (2026-10-17): **49/49 unit checks and 10/10 automated browser system checks passed** in Chromium with browser caching disabled.
The browser suite also checks changing hand-pose pixels while climbing, existing charge indicators, reset, and no score writes for abandoned runs.
The climbing pose and revised controls were visually inspected on the integrated canvas.
No production dependencies or build tooling were added.
Physical Android/iOS, camera permissions, simultaneous touch input, and a renewed classroom-photo play-through remain unverified.

### Player-character favicon

REQ-CHR-03 was added with corresponding architecture allocation, detailed design, and ST-14/AT-21 procedures before implementation.
The new browser check first failed as expected because the game page did not declare a favicon.
The local SVG reproduces the original right-facing character rectangles and palette, centered in a square icon.
Verification on 2026-10-17: **11/11 browser system checks passed** in Chromium with caching disabled, including successful favicon loading/decoding before setup and an exact comparison of all 16-by-16 RGBA pixels.
