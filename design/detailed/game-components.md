# Detailed game design

## Requirements covered

This design elaborates REQ-SYS-01 through REQ-SYS-06, REQ-SYS-08/09, REQ-LVL-01 through
REQ-LVL-09, REQ-CHR-01/02, and REQ-MOV-01 through REQ-MOV-07.

## Terrain (`src/terrain.js`)

`generateTerrain(rgba, width, height)` normalizes luminance and traces multiple
locally strong horizontal/sloping edges throughout the image using a Sobel
gradient. Adjacent column samples can connect only within two vertical cells;
short noise traces are discarded. Each surviving trace becomes a four-cell
thick platform directly below that edge, not a filled region to the bottom.
Nearby duplicates within 20 cells are suppressed to avoid trapping the runner
between the upper and lower outline of one object. Comparable-strength traces
(within 10%) prefer upper outlines. No unrelated connector platforms are added.
Uniform images or images without usable traces raise `NoUsableEdgeError`.
The terrain retains `{ width, height, surfaceY, solid, version }`, where
`surfaceY` is only a compatibility summary; collision and coloring use the
live mask, including each separate platform and drilled tunnel.
The same tracing procedure shall connect vertical edges from row to row to create
four-cell-wide walls. Horizontal traces shall use a repeating 48-solid /
12-empty cell pattern relative to their start. Duplicate suppression shall
use complete accepted outlines, including gaps, so a weaker parallel edge
cannot refill a gap. Horizontal platforms shall be allocated before walls
to retain safe spawn/goal support. The total solid-cell budget shall be 20%
of the image; features exceeding it shall be skipped.
`openSpaceRatio(terrain)` must remain at least 0.8.
The renderer draws terrain at 80% opacity without moving the photo.

The renderer draws the original photo behind a chunky, contrasting terrain
overlay. The terrain mask is also the source of collision geometry. Tunnels
are holes in this same mask and remain for the current run.

## Movement (`src/physics.js`)

The world uses terrain-mask cells as its coordinate units.
`findSpawnY(terrain, x, playerWidth, playerHeight)` places the player above
the highest point across their footprint. `createPlayer(x, y)` creates the
player state. `stepPlayer(player, input, terrain, dt)` applies horizontal
movement, gravity, charged floor/wall jump input, collision resolution, and drilling.
`input` has `move` (-1, 0, or 1), `jumpPressed`, `jumpReleased`, `jumpHeld`,
and `drill`, plus vertical bubble input `moveY`. The player footprint shall
be 6 by 9 cells. A shared contact probe shall find floor/wall terrain up to
3 cells away. Floor probes and downward snapping shall run only when not
rising. Side probes shall exclude the foot boundary to avoid treating floor
steps as walls. Downward snapping and upward stepping shall run per half-cell
horizontal substep so slopes remain supported.
Pressing near a surface begins charging; release while currently near one
launches. Wall release shall set horizontal velocity to 80 cells/second away
from the wall for the launch frame; subsequent normal directional input
remains available. Gravity continues throughout wall charging.
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
drilling, blur, and reset.
The ceiling clamps the player's top
to zero and stops upward velocity. The fixed camera never follows a jump.
Normal movement speed is 80 cells/second. The drilling bubble moves at 20
cells/second in any direction with normalized diagonals, no gravity, and no
momentum. A radius-10 bubble centered on the character clears its circular
footprint at each half-cell movement substep, including while stationary.
It respects image boundaries but cuts all terrain, including flag supports.
Entering/leaving cancels charge and discards vertical momentum; leaving
restores gravity without jumping. Air movement outside the bubble remains at
normal speed. Ground movement can step up small terrain edges; higher
obstacles require a jump. Ground contact at any point below the player's
footprint counts as support.

The browser game maps D/A, arrow keys, Space, and held Return to this input
shape. W/S and up/down arrows move vertically in bubble mode; outside it
Space charges a jump and W/up does not. Touch controls provide four directions, a jump button,
and a dedicated held drill button.

The charge meter shows progress and a distinct MAX READY label at three
seconds. A second bar immediately above the player fills with charge and
changes appearance at maximum; it clears on cancellation/launch and stays
visible inside the image even at the ceiling. The original character drawing
shall scale from 8 by 12 to 6 by 9 cells with the collision footprint.
Keyboard and pointer press/release transitions are queued so a quick
tap between animation frames is not lost. Blur, pointer cancellation,
visibility changes, and restart clear charge without launching.

## Run lifecycle (`src/run.js`, `src/app.js`)

`createRun(terrain)` clones the original terrain and creates a safe starting
position and opposite-side flag from actual platform tops, anchoring the
flagpole to its own column on sloping terrain. The flag remains
fixed even after all terrain beneath it has been drilled. No terrain is
protected or added beneath it. Completion requires overlap with
the flag, not merely crossing its horizontal position at another height.
`respawnPlayer(run)` replaces only player state at the starting position;
terrain and elapsed time survive.

Reset during play or after completion creates a fresh run from the unmodified
original terrain, retains photo/name/scores, clears controls, and resets timer
and charge display. One cancellable animation-frame handle prevents parallel
loops after resetting. Charging starts race time; falling and respawning do
not reset it. Existing per-image leaderboard entries are retained.

## Score store (`src/leaderboard.js`)

`isValidPlayerName(name)` accepts one or more Unicode letters and spaces, up
to 32 characters, with at least one letter. `getLeaderboard(levelId,
storage)` reads the sorted local top ten. `submitScore(levelId, entry,
storage)` validates, saves, sorts ascending by elapsed milliseconds, and
retains at most ten entries. Keys are scoped by a SHA-256 fingerprint of the
image file bytes. Storage errors are surfaced to the UI.

## Verification

Unit contracts are exercised by `tests/unit/runner.html`. Browser-level
acceptance checks are listed in `tests/acceptance/test-cases.md`. Requirement,
design, implementation, and test links are maintained in
`traceability/requirements-matrix.md`.
