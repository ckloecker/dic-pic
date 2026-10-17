# Acceptance test cases

Run the game at `http://localhost:8000/src/` in a current desktop browser and, for
touch behavior, a mobile browser or device. These checks map to the approved
requirements and are intended to be performed on the integrated application.

| ID | Requirements | Check | Expected result |
|---|---|---|---|
| AT-01 | REQ-SYS-01, REQ-SYS-02 | Open the app in a supported browser and resize to a narrow viewport. | Game setup is usable, then the game renders as a responsive 2D platformer. |
| AT-02 | REQ-SYS-03, REQ-LVL-01, REQ-LVL-03, REQ-LVL-04 | Upload an image with a visible horizontal boundary and start a level. | The image remains visible behind automatically generated terrain; no tracing is needed; terrain leaves at least 80% of the map open. |
| AT-02b | REQ-LVL-05 | Upload a uniform image without a visible edge. | The game rejects the image and clearly asks for another photo instead of creating an arbitrary floor. |
| AT-03 | REQ-LVL-04 | Use the camera capture control on a device with a camera; separately deny/cancel camera access and upload a file. | A captured photo can start a level; upload remains usable when capture is denied or unavailable. |
| AT-04 | REQ-SYS-04 | Start moving or charging, note the timer, then touch the exit flag. | Timer begins with player movement or charging, stops on contact with the flag, and the completion view shows the elapsed time. Merely crossing the flag's horizontal position at another height does not finish. |
| AT-05 | REQ-SYS-05 | Enter a valid name, then try digits, punctuation, and a 33-character value. | Only letters/spaces (maximum 32 characters) are accepted. |
| AT-06 | REQ-SYS-06 | Finish the same image level more than once, then finish a different image level. | The result and that image's local top ten appear; scores are sorted fastest-first and kept per level in this browser. |
| AT-07 | REQ-MOV-01/04/10 | Use A/D, arrows, Space, and held Return on desktop; try W/up without drilling; use touch movement, jump, and drill controls. | Space alone controls keyboard jumping. W/up enters background climbing without drilling. Air movement remains at normal speed. |
| AT-08 | REQ-MOV-02/07 | Charge near each side of a wall, then release; repeat away from all surfaces. | Gravity continues during wall charging. Release within three cells launches up and away from the wall; distant releases never launch. |
| AT-09 | REQ-MOV-03/10 | Hold drill; aim in all directions, including up while climbing and down while standing; release drill. | An oriented drill cuts a narrow permanent tunnel only in the aimed direction, defaulting to facing. Drilling does not change walking, climbing, gravity, or jump charge. No bubble appears. |
| AT-10 | REQ-CHR-01, REQ-LVL-02 | Inspect the character and generated overlay. | The character and retro pixel-art presentation are original and do not reproduce a named game's character or artwork. |
| AT-11 | REQ-LVL-06 | Inspect terrain over a detailed photo. | Terrain is 80% opaque (20% transparent), keeping the original image visible. |
| AT-12 | REQ-MOV-05/06/07/10 | Hold jump for three seconds on terrain or attached to the background, keep holding, then release. Repeat with a quick tap and partial charge. | HUD and on-character bars fill; MAX READY and a gold character bar mark maximum. Holding does not launch. Release launches, with increasing height up to full-level height. The ceiling stops ascent. Charge clears on launch, blur, or contact-grace expiry, not drilling. No unattached air jumps occur. |
| AT-13 | REQ-SYS-08 | Drill terrain, move and charge, then choose Reset run. Repeat after completion. | Same photo and name, original undug terrain and spawn, zero timer and charge, no held controls, saved scores retained, and no score for an abandoned run. |
| AT-14 | REQ-MOV-08, REQ-SYS-09 | Drill downward through terrain to the image bottom, then walk and charge/release a jump. | Feet stop at the solid bottom; walking and jumping work without a respawn or timer/tunnel reset. |
| AT-15 | REQ-LVL-07 | Drill all support from beneath the flag. | The flag stays at its original position, even floating. No terrain is protected. |
| AT-16 | REQ-LVL-08 | Upload a scene with desks at different heights, or the synthetic platform fixture. | Platforms follow visible photo edges at multiple heights, retain empty space below them, and are not connected into one arbitrary ramp. No unrelated helper platforms are added. |
| AT-17 | REQ-LVL-09 | Upload a photo with long horizontal and vertical edges. | Long platforms have sections of at most 48 cells and 12-cell gaps; walls follow vertical edges; at least 80% of the map remains open. |
| AT-18 | REQ-MOV-07 | Walk both ways on a slanted surface while charging; briefly lose contact, then return or release farther than three cells away. Press jump shortly before landing. | Small slopes retain support and charge. Charge survives 150 ms contact loss, but distant release cancels. A still-held press within 150 ms of contact starts charging; older presses do not. |
| AT-19 | REQ-CHR-02, REQ-MOV-05 | Inspect the runner and charge indicator while moving/charging and near the ceiling. | Runner is 6-by-9 cells; bar follows above it and remains inside the image. Normal speed and jump height are unchanged. |
| AT-20 | REQ-MOV-10 | Press Up, climb in all directions, release directions, descend onto terrain, and jump from the background while holding Up. | Alternating hands/feet visibly grip the wall. Movement is quarter speed with normalized diagonals; idle holds position. Landing restores walking; jumping detaches and falls without reattaching until a fresh Up press. |
| AT-21 | REQ-CHR-03 | Open the game before selecting a photo and inspect the browser tab icon. | The icon depicts the original player character with its hat, teal outfit, orange scarf, and pixel-art silhouette. |
