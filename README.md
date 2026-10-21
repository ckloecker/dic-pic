# dic-pic

## Development workflow

This repository uses a requirements-first, test-driven V-model. Work from the
requirements toward implementation on the left side of the V, then verify each
level against its corresponding tests on the right side. Keep requirement IDs
stable and trace them through design, implementation, and tests.

Do not infer missing product behavior. Clarify ambiguous or missing
requirements before implementing them. Define the relevant tests from the
approved requirements and design before writing production code, then confirm
that they fail for the expected reason before implementing the behavior.

## Repository structure

- `requirements/` — approved, uniquely identified product and system
  requirements.
- `design/system/` — system-level decomposition and interfaces.
- `design/detailed/` — component-level design and implementation guidance.
- `src/` — production implementation.
- `tests/unit/` — detailed-design/component verification.
- `tests/integration/` — component and interface integration verification.
- `tests/system/` — system-level requirement verification.
- `tests/acceptance/` — user and product requirement acceptance verification.
- `traceability/` — links between requirements, design, implementation, and
  verification evidence.

See the README in each directory for what belongs there. Keep each change
traceable to approved requirements and update its verification evidence when
behavior changes.

## Start the game

This is a dependency-free static web app. From the repository root, start a
local server with Python:

```powershell
python -m http.server 8000
```

Open <http://localhost:8000/> in a browser.
Select a photo, enter a name, choose **Suggest three levels**, then select a thumbnail to play.
The camera option is available on devices and
browsers that support file-input photo capture; **Upload photo** remains
available as a fallback.

## GitHub Pages and team feedback

In repository **Settings > Pages**, select **GitHub Actions** as the build and deployment source.
The [Pages workflow](./.github/workflows/pages.yml) publishes automatically on pushes to `develop` only.
Other branches do not replace the site.
If the `github-pages` environment restricts deployment branches, allow `develop` in its protection settings.
The workflow stages the root entry page and runtime assets, then injects the deployed branch and full commit SHA before publishing.
The root [entry page](./index.html) uses relative asset paths, so it also works under a repository URL such as `https://ckloecker.github.io/dic-pic/`.
No dependency installation, backend, or personal GitHub token is required.

The game's feedback section offers **Bug report**, **Feature request**, and **General feedback** buttons.
Choose **Low**, **Medium**, **High**, or **Critical** severity for any category, then use its button to open the GitHub issue form in a new tab.
Review the prefilled category, severity, deployed branch, and full commit SHA, write the feedback, and submit while signed in to GitHub.
The feedback section also displays the deployed branch and commit.
Unstamped local copies explicitly display and submit `Not injected` instead of guessing the tested version.
GitHub stores the feedback as an issue attributed to the submitter's GitHub account.
The game does not automatically attach photos, runner names, or scores.
Feedback is public in a public repository, and a private repository requires appropriate access.

Keep Issues enabled in `ckloecker/dic-pic` and merge the [feedback issue form](./.github/ISSUE_TEMPLATE/feedback.yml) into the repository's default branch before using the deployed buttons.
GitHub loads issue forms from the default branch, regardless of which branch supplies the Pages site.
Category and severity are recorded in the issue body rather than relying on label permissions.
Maintainers can label and triage the issues for the next development iteration.
The live GitHub form must include the branch and commit fields from the latest template to retain the new version information.

## Play

- Move with **A/D** or **left/right arrows**.
- Hold **Space** near a floor or wall to charge; release to jump.
  **W/up does not jump.**
  Press **Space** while climbing to drop immediately, without charging or launching on release.
  Three seconds reaches maximum charge, shown by **MAX READY**
  and a gold bar above the character. A full charge can cover the level's
  height, but terrain and the image's solid ceiling can stop it.
- Wall jumps launch upward and away; you keep falling while wall-charging.
  Contact allows a three-cell gap. Charge survives lost contact for 150 ms,
  but release must still be within three cells of a surface. Still-held presses
  buffer contact for 150 ms. Walking follows small inclines and declines;
  rising jumps are never snapped back onto the floor.
- Press **W/up** to grip and climb the background wall.
  Use directions to climb at **one quarter** of walking speed, including diagonals.
  Release directions to hold position; landing feet-first restores walking.
  Press **Space** to drop; press Up again to reattach.
- Hold **Return/Enter** to cut a narrow tunnel in the pressed direction.
  Without directional input, drill toward the character's facing direction.
  Drill upward while climbing or downward while standing.
  Excavating intact ground limits horizontal travel to **20 cells/second**, the same speed as climbing.
  Walking or drilling through open space stays at **80 cells/second**.
  Gravity and charged jumps are unchanged.
- On touch devices use the directional pad, hold/release **JUMP**, and hold
  **DRILL**.
  UP enters background climbing; directions also aim the drill.
- **Reset run** restores the same photo's original terrain, spawn, and timer;
  saved leaderboard entries remain.
  The solid image bottom supports walking and jumping even after drilling.
  The checkered finish gate remains fixed if its support is drilled.
- Avoid flying patrols: wasps in jungle, hovering scarabs in desert, and jellyfish underwater.
  Enemy contact returns you to the selected spawn and clears held controls, but keeps the running timer, drilled tunnels, and enemy progress.
  Manual reset also restores the enemies to their original positions.

The runner is 25% smaller (6-by-9 terrain cells), without changing movement
speed or jump height.

Terrain follows detected horizontal/slanted and vertical photo contours as platforms, walls, and complete enclosed solid regions.
Exposed outlines are fully opaque, including sides, undersides, and drilled tunnel boundaries.
Only interior filling is 80% opaque.
The displayed photo is darkened and desaturated, with a narrow dark border around terrain to improve separation from busy images.
Photo analysis still uses the unfiltered original image.
Terrain no longer receives automatic rectangular cuts that invent vertical wall faces.
Edge detection is geometric, not semantic object recognition;
some textures can become platforms and some photo features may be omitted.
Visible, collidable, drillable bridges may connect separated photo edges.
Where natural supports are missing, the generator can add longer bridges and horizontal stepping platforms, including freestanding platforms.
No freestanding vertical walls are invented.
A photo without vertical edges may not supply walls for wall jumping.

Each batch offers jungle, desert, and underwater biomes with shuffled horizontal, vertical, and balanced layouts.
Biomes change terrain surfaces, filling, drillable roots/cacti/coral and rocks, and the runner's cosmetic explorer hat/fedora/diving bell.
Jungle scenery includes large layered trees three to five runner heights tall, grass, climbing plants, and hanging vines.
Desert adds branching cacti, layered rocks, and bone clusters; underwater adds branching coral, kelp, and layered rocks.
Substantial scenery follows its visible drillable collision silhouette; thin grass and leaf accents are cosmetic.
Desert sunshine and shimmering rays, underwater bubbles and light shafts, and jungle dappled light and leaf motes animate behind gameplay.
The photo and checkered finish remain visible, and the reduced-motion preference freezes the effects without changing physics or race timing.
Horizontal and vertical layouts prioritize locally detected horizontal/sloped or vertical-ish edges, while balanced layouts consider both.
Photos with only one usable orientation do not gain invented walls.
One-cell morphological closing bridges tiny contour gaps before provisional enclosed-region filling.
Eight-neighbor grouping preserves diagonal contours such as shoulders instead of discarding their fragments.
Generation reserves a contiguous photo-edge-aligned main corridor before final filling and scenery.
**55–70% open space**, **4–6 traversal sections**, and a **20–40-second reference route** are quality targets, not reasons to reject your photo.
Every offered option still has an executable no-drill route with safe in-bounds endpoints and no walking-only finish.
The recorded route mixes supported walking and background climbing and is replayed against the final terrain and enemy simulation.
There is no waiting added to reach the duration target.
Free climbing, full-height charged jumps, and optional drilling still allow skilled shortcuts; the reference duration is not a minimum finishing time.
Deep optional filling is removed without inventing filler, and substantial photo features are preferred over tiny fragments.
Generation first tries photo-derived geometry, then widens route connectivity and supplies missing horizontal supports.
If clutter prevents a safe option, it prioritizes the strongest layout-relevant edges and retries with repaired platforms.
Strong sparse edges survive even when they occupy less than five percent of the image.
No photo is rejected merely for missing a density, route-duration, or section-count target.
Truly featureless images still clearly ask for another photo; safety failures remain explicit rather than offering an unverified option.
Use [the route fixture](./tests/fixtures/route-photo.svg) for repeatable playable options.
The sparser [platform](./tests/fixtures/platform-photo.svg) and [mixed-orientation](./tests/fixtures/mixed-orientation-photo.svg) fixtures also exercise acceptance and route repair.
Each thumbnail shows the exact chosen terrain, starting position, and finish gate.
The two-pole checkered gate is twice the runner's width and height, stays inside the image, and uses safe support nearest a randomly selected edge.
The starting position is distant from the gate rather than always on the left.
Walking-only routes are rejected, including automatic small steps and falling onto the picture bottom.
Generation tries alternative starts, gates, and edges and repairs support geometry before reporting an inability to build a safe option.
The conservative route check also rejects questionable gap-crossing routes rather than risk accepting a trivial walk.
Two flying enemies patrol checked clear corridors away from the start and finish, reversing without pathfinding or passing through terrain.
Patrols appear in thumbnails and begin moving only when the race starts.
Reset restores the selected variant without rerandomizing, and leaderboards are separated by exact photo/variant identity.
The result list outlines the exact current attempt and labels it **Your run**, even when another entry has the same name and time.
An attempt outside the top ten appears underneath with no place and is not stored as an eleventh score.
Equal-time entries retain their existing order.

## Run tests

With the local server running, open
<http://localhost:8000/tests/unit/runner.html>. The browser-based unit runner
checks terrain generation, movement, drilling, name validation, and leaderboard
ranking, including low-contrast edge normalization and unusable-image
rejection, without installing packages.

Open <http://localhost:8000/tests/system/runner.html> for automated browser
checks of setup, opacity, Space-only jumping, the on-character charge bar,
charge/release, timer, reset, press-to-drop climbing, biome previews, scenery, background effects, reduced motion, directional drilling, the solid bottom, enemy-contact respawning, no-drill route completion, and exact current-run scoreboard highlighting.
Keep the test tab visible until its summary appears.

Integrated browser checks are listed in
[`tests/acceptance/test-cases.md`](./tests/acceptance/test-cases.md).