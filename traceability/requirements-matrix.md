# Requirements traceability

## Distance-based jump grace revision

The user approved distance-based grace: three terrain cells after losing floor contact and four cells after losing wall contact.
REQ-MOV-07 specifies straight-line grace distances, floor-over-wall precedence, consumption on launch, and clearing on background attachment; REQ-MOV-02 references wall grace.
The [movement design](../design/detailed/game-components.md#movement-srcphysicsjs) allocates last-contact positions and distance checks to `stepPlayer` in [physics](../src/physics.js).
Four [unit regressions](../tests/unit/unit-tests.js) initially failed: floor-grace distances, walking off a cliff at 30/60/144 Hz, wall grace on both sides, and no extra airborne or post-attachment jumps.
Verification on 2026-10-23 passed **94/94 unit checks** and **23/23 browser system checks** in Chromium.
[ST-12](../tests/system/system-tests.md) and [AT-08/18](../tests/acceptance/test-cases.md) specify integrated verification.

## Immediate variable-height jumps and horizontal drilling revision

The user approved immediate floor/wall launch with the existing minimum impulse, a 250-millisecond hold window, and maximum rise of twice the normal height.
REQ-MOV-01/02/05/07 replace charge-and-release behavior, REQ-MOV-09 is superseded, and REQ-MOV-10 retains background press-to-drop.
REQ-MOV-03 now explicitly requires level horizontal excavation at fractional heights and floating-point floor boundaries.
The [movement design](../design/detailed/game-components.md#movement-srcphysicsjs) allocates immediate impulse, launch-relative target-apex assistance, release cancellation, and directional excavation substeps to [physics](../src/physics.js).
The [architecture](../design/system/game-architecture.md#acceptance-first-priority) records these movement changes, and [app indicators](../src/app.js) and [control guidance](../index.html) use the quarter-second hold window.
The [unit regressions](../tests/unit/unit-tests.js) initially reproduced horizontal support removal and the lack of immediate launch.
An isolated replay of the original vertical-substep drilling behavior sank from y=31 to y=37 and removed thirty supporting floor cells during one second of rightward drilling.
The fixed replay stayed at y=31 and removed no floor cells, while continuing to excavate horizontally.
Both left/right directions, walking/background climbing, fractional and floating-point-boundary heights, and 30/60/120 Hz are covered.
The jump regressions measure tap, intermediate, maximum, and extended-hold apex heights at 30/60/120 Hz, plus walls, press buffering, airborne rejection, ceiling contact, and held-input landing.
Verification on 2026-10-23 passed **90/90 unit checks** and **23/23 browser system checks** in Chromium, with browser caching disabled for the system run.
The [browser checks](../tests/system/browser-tests.js) verify immediate launch, timer start, partial/full meter and following bar, release/blur cancellation, background drop, and existing gameplay regressions.
The desert fixture supplies sufficient headroom for testing the complete hold window rather than colliding early with overhead jungle terrain.
A real pointer press on touch JUMP moved the rendered player upward before release and cleared the hold meter after release.
Physical touch-device testing remains outstanding.
[ST-05/08/12](../tests/system/system-tests.md) and [AT-08/09/12/18](../tests/acceptance/test-cases.md) specify repeatable integrated verification.

## Design artifacts

- [System architecture](../design/system/game-architecture.md) allocates
  requirements to components.
- [Detailed design](../design/detailed/game-components.md) specifies terrain
  detection, collision, charged jumps, background climbing, directional tunnel drilling, run lifecycle, root hosting, and GitHub feedback.

## Approved reproducible generation requirement

The user approved reproducible randomness so that the same image always creates the very same three level suggestions.
[REQ-LVL-17](../requirements/level-design-requirements.md#req-lvl-17-reproducible-random-generation) requires the same fixed seed and initial random engine state for each generation batch, and REQ-LVL-12 links the three-option choice to this guarantee.
The [architecture](../design/system/game-architecture.md#approved-random-option-extension) and [detailed option design](../design/detailed/game-components.md#level-options-srcleveljs-srcscenejs) allocate the shared reproducible sequence across shuffling, routes, endpoints, scenery, and enemies.

| Requirement | Implementation surface | Verification |
|---|---|---|
| REQ-LVL-17, derived from REQ-SYS-03 and REQ-LVL-12 | [Option assembler](../src/level.js) creates a fresh fixed-seed random engine for every batch and shares it across downstream generation. | [Unit tests](../tests/unit/unit-tests.js) compare serialized default-generated suggestions; [AT-33](../tests/acceptance/test-cases.md) covers repeat uploads and independent sessions. |

The fixed-seed implementation is included in commit `e975781` for issue #14 and retained for issue #17 flight paths.
Default-generation reproducibility passes in the automated unit suite.
Independent-browser acceptance under AT-33 remains a manual check.

## Approved deployed feedback version revision

The user approved deployment-time branch/commit injection and automatic Pages deployment from `develop` only.
REQ-SYS-12 now includes visible and prefilled deployed-version metadata, and REQ-SYS-13 specifies develop-only stamped deployment.
The [architecture](../design/system/game-architecture.md#root-hosting-and-github-feedback) and [detailed design](../design/detailed/game-components.md#deployment-version-injection) allocate HTML stamping, browser metadata consumption, issue fields, and the Pages pipeline.
The [workflow](../.github/workflows/pages.yml) stages runtime files and calls the [stamping script](../scripts/stamp-build.mjs).
The [app](../src/app.js) reads the current document's metadata and adds it to all category/severity links, while the [issue form](../.github/ISSUE_TEMPLATE/feedback.yml) accepts branch and commit fields.
Before implementation, the [integration tests](../tests/integration/build-metadata.test.mjs) failed because the stamping script was missing and the [browser tests](../tests/system/browser-tests.js) reproduced absent metadata and version display.
Verification on 2026-10-21 passed **6/6 deployment integration tests** and **22/22 browser system checks**.
The staged artifact displayed the exact synthetic develop/SHA pair and preserved it in all feedback categories after severity changes under a path prefix, with no horizontal overflow at 320 pixels.
Workflow and issue-form YAML checks verified the develop-only trigger, event metadata, artifact path, job permissions, and branch/commit fields.
VS Code reported no diagnostics in the changed implementation, workflow, form, or test files.
Post-deployment ST-27/28 and AT-32 require Pages configuration and the updated issue template on the default branch.

## Approved root hosting and GitHub feedback revision

The user approved root-level hosting and GitHub issue feedback with Bug report, Feature request, and General feedback categories and Low, Medium, High, and Critical severity for every category.
REQ-SYS-11/12 are allocated in the [architecture](../design/system/game-architecture.md#root-hosting-and-github-feedback) and [detailed design](../design/detailed/game-components.md#root-entry-point-and-feedback-indexhtml-srcappjs).
The [root entry point](../index.html), [feedback controls](../src/app.js), and [GitHub issue form](../.github/ISSUE_TEMPLATE/feedback.yml) implement these requirements without a backend or embedded credentials.
The [browser checks](../tests/system/browser-tests.js) and ST-01/26/27 and AT-01/31 cover root assets, all twelve category/severity combinations, keyboard isolation, feedback availability, and GitHub author attribution.
Before implementation, browser checks reproduced the missing root setup and feedback controls.
Verification on 2026-10-21 passed **21/21 browser system checks** at the server root and **21/21** under `/dic-pic/`, including existing gameplay regressions.
The issue-form YAML and required fields validated, and responsive checks at 1280, 390, and 320 pixels found no horizontal page overflow.
The changed implementation and browser tests have no VS Code diagnostics.
Execution evidence is recorded in the [system procedures](../tests/system/system-tests.md#root-hosting-and-github-feedback-verification).
GitHub-hosted form prefilling and author attribution require deployment to the default branch and signed-in acceptance verification; local tests do not claim to submit an issue.

## Current approved acceptance-first revision

The user reported that strict generation rejected most photos and approved acceptance-first strongest-edge selection, route repair, longer bridges, and supplemental horizontal platforms.
The user explicitly retained rejection for genuinely featureless images rather than generating a photo-independent layout.
REQ-LVL-01/05/07/08/09/11/16 now make density, reference duration, and section count quality targets instead of photo-rejection gates.
Safe in-bounds endpoints, no walking-only finish, protected clearance, no-drill completion, and safe enemy simulation remain mandatory.
The [architecture](../design/system/game-architecture.md) and [detailed design](../design/detailed/game-components.md) allocate progressive natural-edge planning, widened connectivity with horizontal supports, and strongest-edge retry stages.
The initial revised tests passed 73/76 and reproduced the nineteen-cell bridge rejection, sparse-photo density rejection, and percentile-normalization loss of a small strong edge.
The [terrain analyzer](../src/terrain.js) retains small high-contrast features and can select the twelve strongest layout-weighted traces to suppress clutter.
The [route planner](../src/route.js) connects real surfaces without the old eighteen-cell cap and supplies thin horizontal shelves where the repaired route lacks support.
The [option assembler](../src/level.js) retries strongest-edge repair while preserving biome choices and final replay validation.
Revision-6 exact-option identity includes supplemental platform metadata as well as collision geometry, scenery, and patrols.
Current verification on 2026-10-19 passed **77/77 unit checks and 18/18 browser system checks**, with no VS Code diagnostics.
Detailed evidence appears under [ST-25](../tests/system/system-tests.md#current-execution-acceptance-first-photo-repair) and [AT-30](../tests/acceptance/test-cases.md).
The supplied portrait was processed locally without modification or addition to the repository, producing eighteen verified choices across six seeded batches.
The earlier portrait rejection below is historical and superseded by this revision.
The four existing photo fixtures produced thirty-six verified options across three seeds each, and four sparse/disconnected/busy synthetic sources produced twenty-four verified options across two seeds each.
Every one of these seventy-eight sampled options passed final actual physics/enemy replay without drilling and conservative walking-only rejection.
Tests verify strongest-edge prioritization, longer real-edge bridges, supplemental platform collision/drilling/reset, clear endpoints and corridors, stable exact-option previews, and unchanged gameplay/scoreboard regressions.
The finite test sample is evidence of improved acceptance, not a universal guarantee for unseen photos.

## Approved 👍 issue implementation revision

The user approved implementation of open issues with at least one 👍 and directed that issue-specific `@AI` comments be followed.
The user directly excluded #6, so it is not in scope despite GitHub reporting one 👍 reaction at the time of inspection.
The in-scope issues are #3, #5, #9, #10, #11, #14, #15, and #16.
No conflicting eligible issues were found, so no issue was selected for closure as a duplicate.
The user specified one to three pickups of each type, five-second effects, no stacking, and timer refresh on recollection, and asked that this be documented in issue #3.
The user specified two 12-by-3-cell platforms at 18 cells per second, bounded clear paths, optional-route status, and path extension after drilling for issue #14.
The user specified visual-only underwater swimming for issue #16.
The user specified full reset on enemy contact and bottom-edge contact, and confirmed that generated spawns must not be on image borders for issue #11.
The user specified two player names and player selection after each round for issue #15.
The [system requirements](../requirements/system-requirements.md) define full failure reset, sequential players, and prominent controls.
The [level requirements](../requirements/level-design-requirements.md) define uniform high-contrast terrain, deterministic pickups, and optional moving platforms.
The [character requirements](../requirements/character-design-requirements.md) define the underwater visual pose.
The [detailed design](../design/detailed/game-components.md) allocates generation, rendering, physics, and run lifecycle behavior.

| Requirement | Issue | Implementation surface | Verification |
|---|---|---|---|
| REQ-SYS-16 | #9 | `index.html`, `src/styles.css` | ST-29, AT-34, browser control-visibility assertion. |
| REQ-LVL-20 | #10 | `src/scene.js` | ST-30, AT-35, uniform interior RGB and contrast checks. |
| REQ-LVL-18 | #3/#5 | `src/level.js`, `src/run.js`, `src/physics.js`, `src/app.js`, `src/scene.js` | ST-31, AT-36, pickup counts, collision, timers, refresh, reversal, and reset checks. |
| REQ-SYS-14 | #11 | `src/run.js`, `src/app.js`, `src/physics.js` | ST-09/21, ST-31/32, AT-14/28/36/37, full-reset tests. |
| REQ-LVL-19 | #14 | `src/level.js`, `src/run.js`, `src/physics.js`, `src/scene.js` | ST-32, AT-37, safe paths, rider collision, path extension, and reset tests. |
| REQ-SYS-15, REQ-LVL-17 | #15 | `index.html`, `src/app.js`, `src/level.js`, `src/leaderboard.js` | ST-33, AT-33/38, deterministic-generation and sequential-score tests. |
| REQ-CHR-05 | #16 | `src/app.js`, `src/scene.js` | ST-34, AT-39, fixed-footprint visual animation test. |

Before implementation, the unit runner passed **74/86** checks.
The twelve failures reproduced the missing speed boost, pickup state, moving-platform behavior, full-run reset, uniform fill, underwater pose, generated pickup/platform metadata, and deterministic default generation.
The browser runner reproduced the missing prominent control treatment.
Further failures in the baseline browser run were analyzed separately and are not attributed to these requirements without retesting.

### Final automated verification and local commits

Verification on 2026-10-23 passed **88/88 unit checks** and **23/23 browser system checks** in Chromium.
The [unit runner](../tests/unit/runner.html) covers pickup counts and timed effects, moving-platform collision and extension, complete reset state, safe spawns, deterministic suggestions after an intervening different image, uniform filling, swimming artwork, and flying paths.
The [browser runner](../tests/system/runner.html) verifies actual bottom/enemy resets, restored excavated terrain, cleared held input, no failure score writes, prominent controls, identical initial courses for both players, and correct next-player score attribution.
Existing movement, preview, feedback, timer, reset-loop, stable-score-tie, unranked-score, and storage-error regressions also pass.
The reset rendering check compares opaque gameplay geometry and initial patrol/platform/pickup artwork separately from animated swimming and browser-dependent filtered-photo rasterization.
The placement fixtures now require safe inset supports instead of relying on starts at the image bottom.
The vertical-photo geometry check includes approved supplemental platform cells, which the changed random sequence can select during route repair.
VS Code reports no diagnostics in the changed JavaScript implementation and test files.
Setup and gameplay checks at 320-, 390-, and 1280-pixel viewport widths found no horizontal overflow and retained all six touch controls during play.

| Issue | Resolving implementation commit | Verification |
|---|---|---|
| [#3](https://github.com/ckloecker/dic-pic/issues/3) | `61fe766` | REQ-LVL-18 speed, duration, refresh, collection, and reset unit checks. |
| [#5](https://github.com/ckloecker/dic-pic/issues/5) | `28c1f7d` | REQ-LVL-18 horizontal/vertical input and drill reversal unit checks. |
| [#9](https://github.com/ckloecker/dic-pic/issues/9) | `e215399`, `a96f1ba` | REQ-SYS-16 setup/gameplay guidance and browser visibility checks. |
| [#10](https://github.com/ckloecker/dic-pic/issues/10) | `c4876b7` | REQ-LVL-06/20 uniform RGB, opaque outlines, translucent interiors, and browser compositing checks. |
| [#11](https://github.com/ckloecker/dic-pic/issues/11) | `6c21cf3` | REQ-SYS-14 exact run-state restoration and actual browser bottom/enemy contact checks. |
| [#14](https://github.com/ckloecker/dic-pic/issues/14) | `e975781` | REQ-LVL-17/19 reproducible suggestions, platform movement, collision, path extension, and reset checks. |
| [#15](https://github.com/ckloecker/dic-pic/issues/15) | `821dd69` | REQ-SYS-15 browser round selection, unchanged course, correct names, and stable tied attempts. |
| [#16](https://github.com/ckloecker/dic-pic/issues/16) | `3be4ffe` | REQ-CHR-05 animated swimming pixels inside the unchanged collision footprint. |
| [#17](https://github.com/ckloecker/dic-pic/issues/17) | `8b66f7a` | REQ-LVL-21 deterministic flight paths, clear bounds, reset replay, and two-axis swept contact. |

The issue-workflow rules are persisted in [AGENTS.md](../AGENTS.md) by non-closing commit `8e16cfe`.
No eligible issue conflict was found, and the previously excluded issue #6 was not implemented.
The resolving commits are local and use `Fixes #N`; GitHub issue closure has not occurred or been verified.
SSH access failed host-key verification, and noninteractive HTTPS push authorization failed because no usable credentials were available.
Physical Android/iOS, camera permissions, simultaneous real touch input, and GitHub deployment remain unverified.

### Random flying paths: issue #17

Issue [#17](https://github.com/ckloecker/dic-pic/issues/17) had one thumbs-up when rechecked before implementation and had no implementation comments.
[REQ-LVL-21](../requirements/level-design-requirements.md#req-lvl-21-reproducible-random-flying-paths) and revised REQ-LVL-15 allocate seeded two-axis flight to the [enemy design](../design/detailed/game-components.md#nontrivial-placement-readability-and-enemies).
The [enemy simulator](../src/enemies.js) generates looping waypoint paths inside clear flight rectangles, avoiding terrain, reference clearance, spawn/finish margins, other enemies, and initial moving-platform sweeps.
Distance-based phase and two-axis sweeps preserve constant speed and detect contact across waypoint turns.
The [option identity](../src/level.js) advances to revision 9 and includes the retained path and initial phase.
Before implementation, the [unit suite](../tests/unit/unit-tests.js) passed 86/88 checks, failing specifically for missing waypoint paths and missed vertical swept contact.
After implementation, all 88 unit checks pass, including large timesteps, path bounds, terrain clearance, deterministic generation, reset replay, vertical contact, turn contact, and false-positive rejection.
[AT-40](../tests/acceptance/test-cases.md) defines integrated flying-path acceptance.

## Historical approved strict route-first revision

The user approved slower intact-ground excavation at twenty cells per second, open movement at eighty, optional digging, and unrestricted climbing and full-height jumping.
The user approved strict 55–70% openness, four to six sections, twenty-to-forty-second no-drill reference routes, connectors up to eighteen cells attached at both ends, and bounded clear rejection without relaxed fallbacks.
These approvals update REQ-MOV-03/04, REQ-SYS-06, and REQ-LVL-01/08/09/11 and add REQ-LVL-16.
The [architecture](../design/system/game-architecture.md) and [component design](../design/detailed/game-components.md) replace fixed cuts and bounding-box verticality with photo-edge evidence, protected corridors, optional fill removal, and final replay validation.
Research was grounded in the [PCG textbook's constructive-generation/evaluation overview](https://www.pcgbook.com/) and [Spelunky's solution-path-first construction](https://tinysubversions.com/spelunkyGen/).
No unverified Tanagra or Launchpad source is used as evidence.
Initial tests reproduced fast excavation, missing diagonal shoulder contours, missing current-attempt rows, absent route planning, and invalid density before implementation.
An explicit idle-padding mutation later reproduced a replay-validation gap before its fix.
Current verification on 2026-10-19 passed **75/75 unit checks and 17/17 browser system checks**, with no VS Code diagnostics.
Detailed evidence and measured seed-123 options appear in [ST-05/22/23/24](../tests/system/system-tests.md#historical-execution-strict-photo-aligned-reference-routes-and-current-run-results) and [AT-06/09/16/17/29](../tests/acceptance/test-cases.md).
The diagonal shoulder-connectivity defect recorded in the historical revision below is now fixed with eight-neighbor component grouping.
The supplied portrait now fails the approved minimum ground requirement after corridor clearance and is explicitly rejected, not silently filled with artificial material.
Reference paths use walking and background climbing; charged jumps and drilling remain available as player-selected shortcuts.
Exact-option identity is revision 5 and includes geometry, connectors, biome/layout, spawn, finish, and patrols.
Completion checks restore their own score key, and controlled-frame checks stop gameplay before restoring native scheduling.
Cleanup removed only three precisely identified earlier test-score entries, restored browser request/focus overrides, and stopped the temporary local server.
Physical mobile, camera, and simultaneous touch verification remain outstanding.

## Requirement links

| Requirement | Implementation | Verification |
|---|---|---|
| REQ-SYS-01 | [HTML](../index.html), [responsive styles](../src/styles.css) | ST-01: desktop browser and narrow-viewport checks; physical Android/iOS and camera validation remain outstanding. |
| REQ-SYS-02 | [Renderer](../src/app.js), [physics](../src/physics.js) | ST-01/ST-06: 2D rendering and controls. |
| REQ-SYS-03 | [Terrain](../src/terrain.js), [reference-route planning](../src/route.js), [photo renderer](../src/app.js) | Unit multi-height/edge and strict seeded route tests; integrated browser route fixture (ST-02/22). |
| REQ-SYS-04 | [Timer and completion](../src/app.js), [flag contact](../src/run.js) | Browser charge/timer test; unit flag overlap test rejects horizontal-only crossing. |
| REQ-SYS-05 | [Validation](../src/leaderboard.js), [setup](../src/app.js) | Unit name tests and automated browser invalid-name check. |
| REQ-SYS-06 | [Attempt identities and row projection](../src/leaderboard.js), [result UI](../src/app.js), [current-run outline](../src/styles.css) | Unit exact-attempt/tied-name-time highlighting and transient footer; actual browser completion, stable ties, top-ten-only persistence, outline/aria label, and storage failure; ST-24/AT-06. |
| REQ-SYS-08 | [Run cloning](../src/run.js), [reset UI and animation cancellation](../src/app.js) | Unit terrain/timer restoration; browser reset checks name, timer, charge, held input, no score write, and exactly one native animation loop across five resets. |
| REQ-SYS-09 | Superseded by REQ-SYS-14; [game loop](../src/app.js) resets the full run on bottom contact. | Unit reset-state checks and browser bottom-contact reset, including a zero timer and cleared held controls. |
| REQ-SYS-10/14 | [Enemy contact](../src/enemies.js), [full reset](../src/run.js), [contact priority and control clearing](../src/app.js) | Unit full-state restoration and swept contact; browser real contact, no score writes, held-input clearing, and manual reset; ST-21/AT-28. |
| REQ-SYS-11 | [Root entry page](../index.html), [root browser runner](../tests/system/runner.html); [root hosting design](../design/detailed/game-components.md#root-entry-point-and-feedback-indexhtml-srcappjs) | Browser root setup, module/style paths, live CSS, and root-runner checks; ST-01/AT-01. |
| REQ-SYS-12 | [Feedback UI](../index.html), [severity, version metadata, and input isolation](../src/app.js), [issue form](../.github/ISSUE_TEMPLATE/feedback.yml); [feedback design](../design/detailed/game-components.md#root-entry-point-and-feedback-indexhtml-srcappjs) | Browser twelve category/severity URLs, injected and local version values, form field contracts, no private parameters, keyboard isolation, and setup/play/completion availability; ST-26/27/28, AT-31/32. |
| REQ-SYS-13 | [Pages workflow](../.github/workflows/pages.yml), [HTML stamping](../scripts/stamp-build.mjs), [metadata consumers](../src/app.js); [deployment design](../design/detailed/game-components.md#deployment-version-injection) | Six script integration tests, injected-document browser checks, and ST-28/AT-32 version/deployment acceptance checks. |
| REQ-LVL-01 | [Photo-shape analysis and strongest-edge selection](../src/terrain.js), [clearance and adaptive support](../src/route.js), [final option validation](../src/level.js) | Unit sparse/busy/disconnected source acceptance without density filler, safe final replay, and protected clearance; ST-02/22/25, AT-02/25/29/30. |
| REQ-LVL-02 | [Terrain renderer](../src/app.js) | ST-06: original retro-style overlays visually inspected. |
| REQ-LVL-03 | [Normalized Sobel detection](../src/terrain.js) | Unit strong/low-contrast edge tests. |
| REQ-LVL-04 | [Upload/camera inputs](../index.html), [decoding](../src/app.js) | Automated browser upload tests; physical camera support/denial testing remains outstanding. |
| REQ-LVL-05 | [NoUsableEdgeError and sparse-edge normalization](../src/terrain.js), [progressive repair](../src/level.js), [error UI](../src/app.js) | Unit/browser uniform-image rejection while sparse, busy, horizontal, vertical, and disconnected edge sources remain accepted; ST-25/AT-30. |
| REQ-LVL-06 | [Live-mask exposure and alpha](../src/scene.js), [compositing](../src/app.js) | Unit alpha 255 for tops, sides, undersides, and newly drilled boundaries, alpha 204 for interiors; browser verifies interior blending; ST-07/18, AT-11/25. |
| REQ-LVL-07 | [Conservative walking reachability and cloning](../src/run.js), [edge-prioritized route endpoints](../src/route.js), [shared gate renderer](../src/scene.js) | Unit flat/bottom/sloped/falling walking-route rejection, every seeded option, clear distant placement, bounds, and fixed gate; ST-16/19, AT-23/26. |
| REQ-LVL-08 | [Multi-edge platforms](../src/terrain.js), [bridges, supplemental platforms and no-drill corridor](../src/route.js) | Unit supported twelve/eighteen/nineteen-cell bridges, sparse-source horizontal shelves, reset, and executable routes; ST-22/23/25, AT-16/29/30. |
| REQ-LVL-09 | [Eight-neighbor contours and removal of fixed cuts](../src/terrain.js), [photo-derived route geometry](../src/route.js) | Unit diagonal shoulder retention, no periodic rectangular cuts, real-edge wall jumps, and no invented non-photo filler/walls; ST-11/22, AT-17. |
| REQ-LVL-10 | [Biome definitions and collidable silhouettes](../src/level.js), [scenery rendering](../src/scene.js) | Seeded tests verify large trees, vines, cacti, bones, coral, kelp, drilling, and safe placement; browser preview/live/reset checks; ST-15/17, AT-22/24. |
| REQ-LVL-11 | [Local edge-direction evidence](../src/terrain.js), [evidence-weighted route search](../src/route.js), [closing and region filling](../src/morphology.js) | Unit raw mixed-region ratios > 2, direction metadata, diagonal connectivity, single-orientation fallback, and final horizontal/vertical photo routes; ST-16/18/22, AT-17/22/25. |
| REQ-LVL-12 | [Suggestion generation and identity](../src/level.js), [choice UI and SHA-256 keys](../src/app.js), [thumbnail controls](../index.html) | Unit exactly three distinct reproducible options and immutable original geometry; browser verifies pre-play choice gating, preview/live geometry, selected biome, and exact scene restoration; ST-15/AT-23. |
| REQ-LVL-13 | [Biome effects](../src/scene.js), [layer order and reduced motion](../src/app.js) | Unit checks distinct effects, time-varying motion, and static reduced-motion output; ST-17/AT-24. |
| REQ-LVL-14 | [Shared filtered photo and terrain halo](../src/scene.js), [live rendering](../src/app.js) | Unit measured darkening/desaturation, context restoration, halo pixels, and unchanged collision; browser interior compositing and preview/live comparisons; ST-20/AT-27. |
| REQ-LVL-15 | [Clear patrol generation, reflected movement, and swept contact](../src/enemies.js), [biome artwork](../src/scene.js), [option identity](../src/level.js) | Unit two bounded clear patrols, protected margins, repeated/large timesteps, reversal contact, distinct artwork, score identity, and reset; browser idle/live/reset checks; ST-21/AT-28. |
| REQ-LVL-16 | [Photo-guided planning, horizontal support repair and replay](../src/route.js), [strongest-edge retry and protected scenery](../src/level.js), [route-safe patrols](../src/enemies.js) | Unit diverse photo acceptance, actual no-drill physics/enemy replay, clear safe endpoints, non-walking completion, idle-padding rejection, longer bridges and resettable supplemental supports; browser actual completion and sparse-photo previews/reset; ST-22/23/24/25, AT-29/30. |
| REQ-CHR-01 | [Character renderer](../src/app.js) | ST-06: original character visually inspected. |
| REQ-CHR-03 | [SVG player icon](../src/favicon.svg), [favicon declaration](../index.html); [detailed favicon design](../design/detailed/game-components.md#favicon-srcfaviconsvg-indexhtml) | Browser test loads and decodes the icon before setup and compares every 16-by-16 RGBA pixel with the player artwork; ST-14/AT-21. |
| REQ-CHR-02 | [Player dimensions](../src/physics.js), [scaled renderer](../src/app.js), [flag anchoring](../src/run.js) | Unit verifies 6-by-9 collision dimensions and normal speed; browser sprite bounds and bar-following checks; ST-11/AT-19. |
| REQ-CHR-04 | [Biome headwear renderer](../src/scene.js), [walking and climbing integration](../src/app.js) | Unit all three headwear images distinct and confined to the six-by-nine footprint; browser preview/live checks across all biomes; ST-15/AT-22. |
| REQ-MOV-01 | [Input mapping](../src/app.js), [four-way touch controls](../index.html) | Browser verifies Space charge/release, W/up background climbing without drilling, and downward drill input; physical simultaneous touch-button testing remains outstanding. |
| REQ-MOV-02 | [Floor/wall probes, wall grace, and immediate launch](../src/physics.js) | Unit verifies terrain-wall and image-border launches up/away on press despite opposing input, four-cell wall grace away from the last wall, hold assistance, and no unattached air jumps; ST-12/AT-08. |
| REQ-MOV-03 | [Active-excavation probe, speed selection, and directional cutter](../src/physics.js), [drill renderer/input](../src/app.js) | Unit verifies 20-cell/s active excavation at 30/60/120 Hz, 80-cell/s open drilling, eight-direction cuts, persistent tunnels, gravity/hold assistance, upward/downward drilling, and repeated level horizontal excavation at fractional heights and floating-point floor boundaries; ST-05/AT-09. |
| REQ-MOV-04 | [Normal air movement](../src/physics.js) | Unit verifies normal horizontal airborne speed with and without drilling, with quarter-speed climbing tested separately. |
| REQ-MOV-05 | [Immediate launch and held-ascent simulation](../src/physics.js), [HUD and character bars/input](../src/app.js) | Unit measures normal tap rise, intermediate holds, twice-normal maximum, 250 ms cap, no repeated held jumps, ceiling/airborne rejection, and drilling preservation; browser immediate launch, meter/bar, timer, release, and blur; ST-08/AT-12. |
| REQ-MOV-06 | [Ceiling collision](../src/physics.js), [fixed scene](../src/app.js) | Unit verifies y >= 0, stopped upward velocity, and subsequent gravity. |
| REQ-MOV-07 | [Shared contact probes, snapping, press buffer, and contact-loss grace](../src/physics.js) | Unit verifies three-cell floor/wall tolerance including image borders, walking on slopes, 150 ms still-held press buffering, three-cell floor and four-cell wall grace including cliff walk-off at 30/60/144 Hz, grace consumption and attachment clearing, assistance after leaving support, release cancellation, and no upward snapping or top/bottom boundary wall jumps; ST-12/AT-08/18. |
| REQ-MOV-08 | [Boundary-aware floor probes and bottom clamp](../src/physics.js), [game loop](../src/app.js) | Unit empty-mask landing/walking/charging/jumping, nearest terrain above bottom, descending climber landing, and drilling to indestructible bottom; browser drill-down/standing/jump check; ST-09/AT-14. |
| REQ-MOV-09 | Superseded by REQ-MOV-01/02/05/07 immediate variable-height jumps. | See the immediate-jump verification above. |
| REQ-MOV-10 | [Immediate drop and consumed-press latch](../src/physics.js), [input and drop HUD](../src/app.js) | Unit immediate downward velocity, no charge/release launch even after landing, held-Up suppression, fresh-Up attachment, and unchanged floor jumps; browser drop-on-press and drill-release grip; ST-13/AT-20. |

## Requirement derivation

| Detailed requirement | Parent |
|---|---|
| REQ-LVL-01 through REQ-LVL-12 | REQ-SYS-03; REQ-LVL-01/09/10/11 now favor substantial photo shapes and complete filling instead of the withdrawn 80% open-space rule; REQ-LVL-12 defines pre-play choice and variant identity |
| REQ-LVL-14/15 | REQ-SYS-02/03; readable photo-derived scenes and predictable biome patrols extend the selected-option design |
| REQ-SYS-10 | REQ-SYS-04/08; approved enemy contact respawns only the player, unlike manual reset |
| REQ-LVL-13 | REQ-LVL-02/10; biome-specific cosmetic background effects with reduced-motion support |
| REQ-CHR-01/02 | REQ-SYS-02 |
| REQ-CHR-03 | REQ-CHR-01; presents the original player character as the game page identity |
| REQ-CHR-04 | REQ-CHR-01/02 and REQ-LVL-10; cosmetic biome headwear within the unchanged player footprint |
| REQ-MOV-01 through REQ-MOV-07 | REQ-SYS-02; REQ-MOV-05 also changes timing under REQ-SYS-04; REQ-MOV-07 elaborates REQ-MOV-02/05 |
| REQ-SYS-08, REQ-SYS-09 | REQ-SYS-04 run lifecycle |
| REQ-MOV-08 | REQ-SYS-02; supersedes REQ-SYS-09 for bottom-edge falls |
| REQ-MOV-09 | REQ-SYS-02; historical charge-and-release decision superseded by the approved immediate-jump revision |
| REQ-MOV-10 | REQ-SYS-02/04; background climbing now consumes jump press as a drop instead of extending charged jumps |

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

### Drop controls, random biome options, and elaborate scenery

The user approved immediate press-to-drop climbing, the 12-by-18 checkered gate, three distinct biome/layout suggestions, bounded morphological closing/region filling, and random edge-oriented placement.
REQ-MOV-10 and REQ-LVL-07 were revised alongside new REQ-LVL-10/11/12 and REQ-CHR-04 before implementation.
Initial tests passed 47/51, with expected failures for the missing suggestions module, two drop-control cases, and gate sizing.
The user subsequently approved larger silhouette-collidable scenery and reduced-motion-aware cosmetic biome effects under REQ-LVL-10/13.
Those added tests first passed 56/58, failing the missing effects renderer and missing elaborate scenery.
Final unit verification covers 36 seeded options, actual tree silhouette height, all biome/layout/edge choices, measured orientation ratios, 80% open space including scenery, closed-gap/region budgets, safe placement, drilling, reset, and consumed drop presses.
Browser verification uses reduced motion for exact preview/live geometry comparisons and separately enables animation to verify moving bubbles without race-time changes.
Visual inspection found the former overlaid canvas caption could obscure an edge finish gate.
A failing caption-versus-canvas bounds check was added, then the caption was moved below the playfield.
A real browser traversal completed a jungle variant in 3.64 seconds, displayed the result, and saved exactly one variant-keyed leaderboard entry.
That test entry was removed or its prior value restored without changing unrelated saved data.
Final verification on 2026-10-18: **58/58 unit checks and 13/13 browser system checks passed** in Chromium with HTTP caching disabled.
VS Code reported no diagnostics in the changed production or test files.
The narrow-frame check used a 390-pixel iframe with a 375-pixel content viewport and document width, confirming no horizontal overflow and three usable 341-pixel-wide choices.
All three biome thumbnails and the full jungle scene were visually inspected.
Physical Android/iOS, camera permissions, and simultaneous real touch input remain unverified.

### Substantial layouts, full-region filling, and opaque outlines

The user approved replacing the global 80% open-space cap with substantial-shape selection and tiny-fragment suppression, allowing large complete enclosed photo regions.
REQ-LVL-01/03/06/09/10/11, both designs, acceptance/system procedures, and tests were revised together.
New tests initially passed 58/60, reproducing translucent exposed outlines and ineffective horizontal/vertical selection.
The old generator changed processing order under a solid budget and attempted filling after duplicate suppression and platform splitting had broken the contours.
The corrected pipeline closes and fills complete photo contours, selects substantial orientation-specific components, and cuts traversal gaps afterward.
Morphology was extracted into a shared module so the level-options component no longer performs post-splitting filling.
The obsolete generator, biome-placement, and game-start occupancy caps were removed.
The old checkerboard orientation test was replaced with separate tall and wide objects, since connected square checkerboard geometry does not establish an orientation preference.
Measured on the mixed-orientation SVG: horizontal retains 6,447 platform-region cells and zero wall-region cells; vertical retains 6,789 wall-region cells and zero platform-region cells; balanced retains both, occupying 23.0% of the map.
These collision-mask measurements exclude biome decoration and do not rely on different biome colors as a proxy for geometry.
Outline tests check alpha 255 on all four exposure directions and after excavation, and alpha 204 in interiors.
Large-region/noise tests verify complete large-object filling above the former cap and rejection of tiny isolated fragments.
Earlier 80%-open-space and whole-overlay-transparency verification records above are historical and superseded.
Final verification on 2026-10-18: **62/62 unit checks and 14/14 browser system checks passed** in Chromium with HTTP caching disabled.
The additional single-orientation regression confirms that the orientation preference retains available photo geometry rather than inventing missing walls.
The mixed-fixture horizontal, vertical, and balanced previews were visually inspected and show distinct filled silhouettes.
VS Code reported no diagnostics in the changed production and test files.
Verification procedures and execution details are recorded in [ST-07/16/18](../tests/system/system-tests.md) and [AT-25](../tests/acceptance/test-cases.md).
Physical Android/iOS, camera permissions, and simultaneous real touch input remain unverified.

### Non-walking placement, readable photos, and flying patrols

The user approved rejecting walking-only routes, filtering the displayed photo and adding dark terrain boundaries, and implementing wasp/scarab/jellyfish patrols.
The user explicitly selected player-only enemy respawning with time and drilled terrain preserved, rather than full run reset.
REQ-LVL-07 was tightened and REQ-LVL-14/15 and REQ-SYS-10 were added alongside both designs and ST-19/20/21 and AT-26/27/28.
Before implementation, new checks passed 62/66, reproducing missing patrols, accepted flat/bottom walking routes, missing route validation, and missing photo filtering.
Placement now checks a conservative walking-reachability graph that includes automatic steps, downhill movement, and free lateral drift across clear rows.
Clear-row graph groups share cached reachability, avoiding repeated full physics simulations while trying alternate starts, gates, and edges.
The displayed photo uses 35% saturation and 55% brightness, while a one-cell dark terrain halo leaves collision and interior opacity unchanged.
Two 10-by-6-cell enemies follow checked clear horizontal corridors at 18 cells per second with at least twelve cells of spawn/finish clearance.
Patrol definitions are retained in previews, reset state, and revision-4 option identities.
Swept relative contact includes reversal endpoints; collision respawns only the player, clears held input, and takes priority over completion.
Final verification on 2026-10-18: **68/68 unit checks and 15/15 browser system checks passed** in Chromium with HTTP caching disabled.
Browser focus emulation was enabled to prevent hidden-tab animation throttling without substituting the native animation scheduler.
The dedicated contact test advances controlled animation frames through a real drilled tunnel and enemy collision, verifying preserved time/tunnels, no score writes, cleared movement input, and exact manual reset of terrain and enemy positions.
The existing charge-bar test was corrected to account for its intended image-edge clamp now that safe non-walking starts can lie at the picture edge.
The supplied portrait was opened locally without modification or addition to the repository.
Eighteen portrait options across six deterministic batches passed both-direction ten-second walking simulations without reaching the finish.
One measured portrait batch generated all three suggestions in 427 ms after route-graph optimization.
Portrait thumbnails were visually inspected for recognizable filtered imagery, separated terrain boundaries, and distinct biome enemy artwork.
VS Code reported no diagnostics in the changed production and test files.
Follow-up investigation confirmed a separate pre-existing shoulder-contour defect: detected 113-cell and 75-cell sloped traces split under four-neighbor solid-component grouping and are largely discarded as tiny fragments.
That contour-connectivity defect was diagnosed but is not changed by this placement/readability/enemy revision.
Physical Android/iOS, camera permissions, and simultaneous real touch input remain unverified.

### Horizontal drill support and image-border wall jumps

REQ-MOV-03 now requires horizontal drilling while walking to preserve cells below the player's feet, and REQ-MOV-02/07 recognize the left and right image borders as virtual wall-jump surfaces while retaining the distinct top-ceiling and bottom-floor behavior.
The detailed movement design, unit tests, AT-08/09, and ST-12 were updated before production changes.
The new unit cases initially failed as expected: horizontal drilling removed the supporting floor, and the image side borders did not allow jump charging.
`src/physics.js` now excludes cells below the player's feet from horizontal drill excavation and includes the vertical image sides in wall-contact probes without modifying the terrain mask.
Verification on 2026-10-21: **78/78 unit tests and 18/18 automated browser system tests passed** in Chromium, including both new regressions and the existing wall, ceiling, floor, and drill tests.
