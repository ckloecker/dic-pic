# System test procedures

Run the app from the repository root using `python -m http.server 8000`, then
open `http://localhost:8000/src/`. Use
`tests/fixtures/edge-photo.svg` as the repeatable image input.

Automated browser procedures are available at
`http://localhost:8000/tests/system/runner.html`. Keep that tab visible while
tests run; background tabs can throttle animation frames. These tests use
`platform-photo.svg` and `uniform-photo.svg` and do not write test scores.

| ID | Requirements | Procedure | Expected result |
|---|---|---|---|
| ST-01 | REQ-SYS-01 | Open the app in a current browser and at desktop and narrow/mobile viewport sizes. | Setup and play screens render without dependencies and remain usable at both sizes. |
| ST-02 | REQ-SYS-03, REQ-LVL-01, REQ-LVL-03, REQ-LVL-04 | Upload the fixture, start a level, and inspect the scene and generated collision mask. | Upload starts a level, the photo remains visible, edge-shaped terrain is automatic, and at least 80% of the map remains open. |
| ST-02b | REQ-LVL-05 | Upload a uniform image without visible edges. | Contrast normalization cannot invent a contour; the game rejects the image and asks for another. |
| ST-03 | REQ-SYS-04 | Leave the player idle, move or charge, then touch the exit flag. | The timer stays at zero until player-driven movement or charging, and stops on actual contact with the flag, not a horizontal crossing at another height. |
| ST-04 | REQ-SYS-05, REQ-SYS-06 | Try invalid and valid names, complete two runs of the same image, then inspect results. | Invalid names cannot start; valid names are saved with sorted per-image scores in this browser. |
| ST-05 | REQ-MOV-01 through REQ-MOV-04, REQ-MOV-10 | Use Space and touch JUMP; use W/up to climb without drilling; aim held drill in all directions. | Space charges/releases jumps; normal airborne movement is full speed. Background climbing is quarter speed with normalized diagonals and idle grip; directional drilling preserves movement physics and excavates permanent tunnels. |
| ST-06 | REQ-CHR-01, REQ-LVL-02 | Inspect the rendered character and level overlay. | Visuals use original character art and a general retro pixel-art style. |
| ST-07 | REQ-LVL-06 | Sample rendered terrain colors against the source photo. | Composited color is 80% terrain and 20% source image, within one channel rounding unit. |
| ST-08 | REQ-MOV-05/06, REQ-SYS-04 | Hold Space to maximum, then release; cancel another charge with blur; jump into the ceiling. | Both bars fill; three seconds reaches MAX READY and a gold character bar, counting as race time. Launch clears both bars; blur cancels without launch; the ceiling blocks upward travel. |
| ST-09 | REQ-SYS-08/09, REQ-MOV-08 | Reset a modified run; drill down to the bottom, walk and jump there. | Reset restores all run state without changing saved scores; the solid bottom prevents falling out or respawning and supports walking and jumping. |
| ST-10 | REQ-LVL-07/08 | Drill under the flag and inspect a multi-height photo. | Flag remains fixed without protected support; multiple separate platforms follow image edges. |
| ST-11 | REQ-LVL-09, REQ-CHR-02 | Inspect sparse terrain and runner scale. | 6-by-9 character; at most 48-cell horizontal platform sections with 12-cell gaps; detected vertical walls; at least 80% open space. |
| ST-12 | REQ-MOV-02/07 | Charge while walking on inclines/declines and while falling beside walls. Test three-cell/150-ms limits and buffered presses. | Slopes retain charge; walls do not stop gravity; release requires current three-cell contact. Charge grace and press buffering expire at 150 ms. |
| ST-13 | REQ-MOV-10 | Climb without drilling, stop directional input, drill and release drill, jump from the background, and descend onto terrain. | Animated hands/feet grip the back wall; idle and drill release retain grip; jump detaches without held-Up reattachment; landing restores walking. |
| ST-14 | REQ-CHR-03 | Load the game before setup; fetch and decode its declared favicon and compare rasterized pixels with player artwork. | The local SVG loads successfully and matches the original character geometry and colors without starting a game. |

## Execution record

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
