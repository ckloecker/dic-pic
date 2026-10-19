# Level Design

See "REQ-SYS-03: Level Setup".

## REQ-LVL-01: Basic Level Design

A level consists of "open space" and solid obstacles/ground.
The outlines of the solid level components shall follow visible lines in the input image, except for bounded gap filling, biome obstacles, and route clearance approved in REQ-LVL-10/11/16 (see "REQ-SYS-03").
The generator shall favor substantial photo-derived shapes and suppress tiny isolated terrain fragments.
Generation shall prioritize accepting photos with usable visible structure and producing safe playable options over numeric density targets.
55–70% open collision-mask cells is a quality target, not a rejection condition.
Sparse photos shall not receive filler merely to reach a ground percentage.
Safe starts and finish areas shall remain clear, with a validated no-drilling main route under REQ-LVL-16.

## REQ-LVL-02: Level Aesthetics

The generated level overlay (see "REQ-SYS-03") shall use a general retro
pixel-art platformer aesthetic and shall not reproduce the distinctive
artwork of an existing game.

## REQ-LVL-03: Automatic Terrain Generation

The game shall normalize image contrast and automatically generate solid
terrain from visible edges in the selected image without requiring the player
to trace the terrain manually.
Terrain selection shall satisfy the clutter and traversal policy in REQ-LVL-01.

## REQ-LVL-04: Image Input

The player shall be able to select an image by uploading a file or by taking a
photo with the device camera. Upload shall remain available when camera access
is unavailable or denied.

## REQ-LVL-05: No Usable Edge

If contrast normalization and edge detection cannot find a usable visible edge
in the selected image, the game shall reject that image and clearly ask the
player to select another one.
Photos with usable edges shall undergo strongest-edge selection and route repair rather than rejection for density, duration, section count, or missing natural supports.

## REQ-LVL-06: Transparent Terrain Overlay

All exposed terrain outlines, including sides, undersides, and excavated boundaries, shall be fully opaque.
Only interior filling shall be 20% transparent (80% opaque), keeping the original image visible through it.

## REQ-LVL-07: Fixed Finish Gate

The exit shall be a conspicuous two-pole gate with a checkered finish banner, approximately twice the character's width and height.
The complete gate artwork and completion area shall remain within the image bounds.
Its initial position shall prioritize safe support nearest a randomly selected level edge, not always the right edge, subject to the non-walking-route rule.
The player shall start at a safe distant position, usually opposite the gate, so the route is not trivial.
Placement shall reject start/finish pairs reachable by walking alone, including automatic small steps, slopes, and gravity-driven falls along the solid picture bottom.
Generation shall try alternative safe placements and edges and repair terrain with supplemental platforms before reporting an inability to construct a safe non-walking route.
The gate shall remain fixed for the run, even if its supporting terrain is drilled away.
No undrillable terrain shall be added to support it.

## REQ-LVL-08: Image-Aligned Vertical Terrain

Generated terrain shall follow visible features at multiple heights in the
input image rather than reduce the image to one continuous, gently ramped
floor. Separate platforms shall support jumping between image features.
Detected photo edges shall guide generated support, with supplemental bridges and stepping platforms permitted under REQ-LVL-16.
Full-height charged jumps and background climbing remain available, and drilling is an optional shortcut rather than a requirement to finish.

## REQ-LVL-09: Sparse Platforms and Photo-Aligned Walls

The generator shall retain strong horizontal/slanted and vertical photo
edges as platforms and walls, favoring substantial strong features rather than many tiny fragments.
Platform interruptions shall serve the validated route rather than unconditionally cut filled shapes into artificial rectangular walls.
Generated walls shall follow detected vertical photo edges and support
wall jumping.
Supplemental horizontal platforms and bridges may repair traversal under REQ-LVL-16, but freestanding vertical walls shall not be invented to fake verticality;
photos without usable vertical edges need not produce walls.
Diagonal contours shall remain connected through noise suppression, including shoulder-like slopes.

## REQ-LVL-10: Random Biomes

Status: Approved.

Each generated option shall have a randomly assigned jungle, desert, or underwater biome.
Jungle shall use leafy surfaces, soil filling, solid roots/rocks, and an explorer hat.
Desert shall use sand surfaces, bone-patterned filling, solid rocks/cacti, and an original fedora.
Underwater shall use seabed sand, solid coral/rocks, and a diving bell.
Randomly placed biome elements shall be part of the drillable collision mask, not merely background decoration.
Headwear shall be cosmetic and shall not change character size, controls, gravity, or movement.
Jungle scenery shall include trees approximately three to five character heights tall, layered leafy canopies, ground grass, climbing plants, and hanging vines anchored to terrain.
Desert scenery shall include larger branching cacti, layered rock formations, and bone clusters.
Underwater scenery shall include branching coral, kelp, and layered rocks.
Substantial scenery shall collide and drill along its visible solid silhouette.
Thin grass and leaf accents may be cosmetic.
Solid scenery shall not overlap the start or finish.

## REQ-LVL-11: Random Base Layouts

Status: Approved.

Each generated option shall randomly favor horizontal, vertical, or balanced photo-edge geometry using local detected edge directions rather than whole-object bounding boxes.
Horizontal layouts shall prioritize horizontal/sloped traversal edges, vertical layouts shall prioritize vertical-ish traversal edges, and balanced layouts shall consider both.
Mixed-orientation photos shall produce measurably different collision geometry, not merely different feature processing order.
Small gaps in detected photo contours shall be bridged using morphological closing before enclosed-region filling and platform splitting.
Enclosed photo-derived regions may be filled only as compatible with route clearance and breathing room.
Strong useful edges shall be prioritized over weak clutter when route repair is needed.
Traversal gaps shall remain open after filling.
No global 80% open-space cap shall apply.
The generator shall retain photo alignment, usable traversal gaps, and rejection of images without usable edges.

## REQ-LVL-12: Choose Between Three Suggestions

Status: Approved.

After selecting a photo, the player shall see three playable thumbnails with biome and layout labels before play.
The options shall have distinct biome/layout pairs.
Selecting an option shall start exactly its previewed terrain, biome, spawn, and gate.
Reset shall restore that chosen option without rerandomizing.
Scores shall be keyed by the photo and exact generated option, not mixed across different layouts.

## REQ-LVL-13: Biome Background Effects

Status: Approved.

Desert shall have sunshine with slowly shimmering rays.
Underwater shall have rising bubbles and soft light shafts.
Jungle shall have dappled sunbeams and drifting leaf motes.
Effects shall be subtle cosmetic layers behind terrain, scenery, player, and finish, keeping the photo and finish readable.
Effects shall not affect collision, movement, or race timing.
Effects shall become static when the player requests reduced motion.

## REQ-LVL-14: Readable Photo Background and Terrain

Status: Approved.

The displayed photo shall be darkened and desaturated while remaining recognizable.
Generated terrain shall have a narrow dark outer border or shadow that does not change collision geometry.
Opaque terrain outlines and 80%-opaque interiors shall remain as specified in REQ-LVL-06.
Thumbnails and gameplay shall use the same background and terrain treatment.
Image analysis shall continue to use the unfiltered original photo.

## REQ-LVL-15: Flying Patrol Enemies

Status: Approved.

Levels shall include predictable flying patrol enemies with wasp artwork in jungle, hovering scarab artwork in desert, and jellyfish artwork underwater.
Patrols shall reverse within checked, obstacle-free corridors without chasing, becoming stuck, leaving the image, or passing through terrain.
The entire swept enemy footprint shall avoid the spawn and finish with a safety margin.
Thumbnails shall show the initial enemies and selecting or resetting an option shall retain its exact patrol definitions.
Enemy motion shall begin with the race timer, leaving the initial previewed scene and idle player safe.
Enemy contact shall return the player to the selected spawn while preserving elapsed race time and drilled terrain, as specified in REQ-SYS-10.

## REQ-LVL-16: Photo-Aligned Reference Route

Status: Approved.

Generation shall plan a contiguous traversal corridor aligned to detected photo edges before finalizing filling, scenery, and enemies.
Every offered option shall include a reference route verified with the actual movement and enemy simulation without drilling.
Four to six traversal sections and twenty to forty seconds are quality targets rather than rejection conditions.
The route shall provide varied traversal and breathing room rather than a straight walk or continuous digging.
Idle waiting shall not be used to inflate the reference duration.
The corridor shall normally provide at least twelve cells of width and eighteen cells of height, with larger clearance for jump arcs.
Generation shall progressively repair traversal by connecting useful edges, adding longer bridges, and adding horizontal stepping platforms where natural supports are missing.
There is no universal eighteen-cell limit or two-ended attachment requirement for supplemental platforms.
Photo geometry shall remain the primary guide, with additions serving specific route or safe-area needs rather than an arbitrary occupancy quota.
Connectors and supplemental platforms shall be visible, collidable, drillable, previewed, and restored on reset.
No unsupported freestanding vertical walls shall be invented to achieve verticality.
Filling and scenery shall not obstruct the validated route, and enemy timing shall be included in final route verification.
Walking-only finishes shall remain rejected.
Existing free background climbing, full-height charged jumps, and drilling shall remain available, including skilled shortcuts.
The reference duration is not a guaranteed minimum completion time for other routes.
Generation shall use bounded planning and repair stages, preserving hard safety and no-drill completion guarantees instead of relaxing them.
Validation shall cover diverse sparse, busy, horizontal, and vertical images and the supplied portrait rather than only a specially suitable fixture.