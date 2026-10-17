# Game architecture

## Scope

The game is a dependency-free, browser-based 2D platformer. It uses a single
HTML page, responsive CSS, ES modules, and a canvas rendered at a pixel-art
resolution. Browser APIs provide image selection, camera capture, local score
storage, and cryptographic level identifiers.

## Components and requirement allocation

| Component | Responsibility | Requirements |
|---|---|---|
| Setup UI | Name validation, image upload/capture, start flow | REQ-SYS-01, REQ-SYS-05, REQ-LVL-04 |
| Terrain generator | Normalize contrast and trace image-aligned platforms/walls, split long platforms, retain at least 80% open space, or request another photo | REQ-SYS-03, REQ-LVL-01, REQ-LVL-03, REQ-LVL-05, REQ-LVL-08/09 |
| Game loop and renderer | Draw the photo, 80%-opaque terrain overlay, original 6-by-9 character, fixed flag, timer, HUD and character charge bars, and responsive controls | REQ-SYS-02, REQ-SYS-03, REQ-SYS-04, REQ-CHR-01/02, REQ-MOV-05, REQ-LVL-02, REQ-LVL-06, REQ-LVL-07 |
| Movement simulation | Charged floor/wall/background jumps, tolerant surface contact and press buffering, air movement, solid ceiling/bottom, quarter-speed background climbing, and directional tunnel drilling | REQ-MOV-01 through REQ-MOV-10, REQ-CHR-02 |
| Run lifecycle | Clone original terrain for reset and detect contact with the fixed flag; solid bottom prevents bottom-edge respawns | REQ-SYS-08, REQ-SYS-09, REQ-SYS-04, REQ-LVL-07 |
| Local leaderboard | Persist and rank level scores in this browser | REQ-SYS-06 |
| Page identity | Declare a local pixel-art player-character favicon available before game setup | REQ-CHR-03 |

## Data flow

The setup UI validates a player's name and accepts an uploaded or captured
image. The image is decoded, scaled into the terrain generator's pixel grid,
and fingerprinted from its original bytes. The generator returns a pixel
collision mask. The game loop combines that mask with the original image as
the scene background. Once the player reaches the exit, the elapsed time is
saved under the image fingerprint and the local top ten is displayed.

No image or score is sent to a server.
