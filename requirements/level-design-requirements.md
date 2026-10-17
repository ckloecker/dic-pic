# Level Design

See "REQ-SYS-03: Level Setup".

## REQ-LVL-01: Basic Level Design

A level consists of "open space" and solid obstacles/ground.
The outlines of the solid level components shall follow visible lines in the input image (see "REQ-SYS-03").
At least 80% of the map shall be space open for free character movement.

## REQ-LVL-02: Level Aesthetics

The generated level overlay (see "REQ-SYS-03") shall use a general retro
pixel-art platformer aesthetic and shall not reproduce the distinctive
artwork of an existing game.

## REQ-LVL-03: Automatic Terrain Generation

The game shall normalize image contrast and automatically generate solid
terrain from visible edges in the selected image without requiring the player
to trace the terrain manually.
At least 80% of the generated map shall remain open space as required by
REQ-LVL-01.

## REQ-LVL-04: Image Input

The player shall be able to select an image by uploading a file or by taking a
photo with the device camera. Upload shall remain available when camera access
is unavailable or denied.

## REQ-LVL-05: No Usable Edge

If contrast normalization and edge detection cannot find a usable visible edge
in the selected image, the game shall reject that image and clearly ask the
player to select another one.

## REQ-LVL-06: Transparent Terrain Overlay

The generated level overlay shall be 20% transparent (80% opaque) so the
original image remains visible through it.

## REQ-LVL-07: Fixed Exit Flag

The exit flag shall initially be placed on terrain. Its position shall remain
fixed for the run, even if terrain beneath it is removed and the flag is left
floating in the air. No undrillable terrain shall be added to support it.

## REQ-LVL-08: Image-Aligned Vertical Terrain

Generated terrain shall follow visible features at multiple heights in the
input image rather than reduce the image to one continuous, gently ramped
floor. Separate platforms shall support jumping between image features.
The generator shall not add helper platforms unrelated to detected image
edges, nor reject an image merely because its platform gaps exceed the
normal, uncharged jump's reach. Full-height charged jumps (REQ-MOV-05) and
drilling (REQ-MOV-03) shall provide the traversal mechanics.

## REQ-LVL-09: Sparse Platforms and Photo-Aligned Walls

The generator shall retain strong horizontal/slanted and vertical photo
edges as platforms and walls, favoring strong features and leaving at least
80% open space. Long horizontal platforms shall be split into sections of
at most 48 terrain cells separated by 12-cell gaps to encourage jumping.
Generated walls shall follow detected vertical photo edges and support
wall jumping. No unrelated helper platforms or walls shall be invented;
photos without usable vertical edges need not produce walls.