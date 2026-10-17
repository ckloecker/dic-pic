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

Open <http://localhost:8000/src/> in a browser. Select a photo, enter a name,
and choose **Build my level**. The camera option is available on devices and
browsers that support file-input photo capture; **Upload photo** remains
available as a fallback.

## Play

- Move with **A/D** or **left/right arrows**.
- Hold **Space** near a floor or wall to charge; release to jump. **W/up no
  longer jumps.** Three seconds reaches maximum charge, shown by **MAX READY**
  and a gold bar above the character. A full charge can cover the level's
  height, but terrain and the image's solid ceiling can stop it.
- Wall jumps launch upward and away; you keep falling while wall-charging.
  Contact allows a three-cell gap. Charge survives lost contact for 150 ms,
  but release must still be within three cells of a surface. Still-held presses
  buffer contact for 150 ms. Walking follows small inclines and declines;
  rising jumps are never snapped back onto the floor.
- Hold **Return/Enter** for the drilling bubble. Use **WASD** or the arrow keys
  to hover in all directions and cut terrain. Total speed is **one quarter**
  of normal speed, including diagonal movement. Release drill to restore gravity.
- On touch devices use the directional pad, hold/release **JUMP**, and hold
  **DRILL**. Up/down directions move vertically only in bubble mode.
- **Reset run** restores the same photo's original terrain, spawn, and timer;
  saved leaderboard entries remain. Falling out respawns you but keeps your
  elapsed time and tunnels. The flag remains fixed if its support is drilled.

The runner is 25% smaller (6-by-9 terrain cells), without changing movement
speed, jump height, or drilling radius.

Terrain follows detected horizontal/slanted and vertical photo edges as
separate platforms and walls with 80% opacity and at least 80% open space.
Long platforms use sections up to 48 cells wide with 12-cell jump gaps.
Edge detection is geometric, not semantic object recognition;
some textures can become platforms and some photo features may be omitted.
No unrelated helper platforms or walls are added. A photo without vertical
edges may not supply walls for wall jumping.

## Run tests

With the local server running, open
<http://localhost:8000/tests/unit/runner.html>. The browser-based unit runner
checks terrain generation, movement, drilling, name validation, and leaderboard
ranking, including low-contrast edge normalization and unusable-image
rejection, without installing packages.

Open <http://localhost:8000/tests/system/runner.html> for automated browser
checks of setup, opacity, Space-only jumping, the on-character charge bar,
charge/release, timer, reset, and bubble controls.
Keep the test tab visible until its summary appears.

Integrated browser checks are listed in
[`tests/acceptance/test-cases.md`](./tests/acceptance/test-cases.md).