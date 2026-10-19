# Character Movements

## REQ-MOV-01: Controls

If the game is accessed from a device with a keyboard, the controls shall be:
* D or right arrow: Move right
* A or left arrow: Move left
* W or up arrow: Enter background climbing (see "REQ-MOV-10")
* S or down arrow: Climb down or aim the drill down
* Space: Hold to charge, release to jump
* Return: Use the drill (see "REQ-MOV-03")

If the game is accessed from a mobile/touch-only device, the controls shall be:
* Left thumb: Controls left and right
* Right thumb: Controls jump
* A dedicated on-screen drill button: Use the drill (see "REQ-MOV-03")

Touch controls shall provide up/down buttons as well as left/right buttons.
Return or the dedicated drill button shall remain held to drill.
W/up shall not jump.
Space shall be the only keyboard jump control; the touch JUMP control shall retain the same behavior.
While background climbing, pressing either jump control shall drop immediately instead of charging or jumping (REQ-MOV-10).

## REQ-MOV-02: Wall Jump

The character shall be able to charge and jump from floors and either side
of walls. Execution occurs when the jump control is released within three
terrain cells of a floor or wall (REQ-MOV-07). A wall jump shall launch upward
and away from the wall at normal horizontal movement speed, using the same
charge duration and vertical height range as a floor jump. Gravity shall
continue while charging beside a wall; charging shall not hold the character
vertically. Outside the surface-distance tolerance, release shall cancel
without launching, even during contact grace. There shall be no free
additional airborne jumps.
While background climbing, the jump control drops instead, as specified by REQ-MOV-10.
While actively excavating, horizontal travel uses the limit in REQ-MOV-03.

## REQ-MOV-03: Drill

Holding Return or the touch DRILL control shall operate a visible directional drill, not a surrounding bubble.
The drill shall cut a narrow tunnel in the pressed direction, including diagonally, upward while climbing, and downward while standing.
With no direction pressed it shall drill in the character's horizontal facing direction.
Excavated terrain shall remain removed for the current run, including terrain supporting the finish gate.
While the drill is actively excavating intact terrain, normal horizontal movement shall be limited to background-climbing speed, twenty terrain cells per second.
Holding the drill in already-open space shall retain normal eighty-cell-per-second horizontal movement.
Background climbing shall remain twenty cells per second with normalized diagonals, including while drilling.
Excavation shall not change gravity, jump charge, or vertical jump velocity, and shall not enable hovering.
Movement limits shall hold across supported frame durations and repeated resets without duplicate animation loops.

## REQ-MOV-04: Air Movement

While "in air", i.e., executing a jump or falling, the character shall move left or right at normal speed.
Background climbing and active excavation are exceptions: REQ-MOV-10 specifies climbing speed and suspension of gravity, and REQ-MOV-03 limits horizontal active excavation without changing gravity.

## REQ-MOV-05: Charged Jumps

Holding the jump control near a floor or wall shall charge a jump. Releasing
within the contact tolerance shall execute the jump. A longer charge shall produce
a higher jump, up to a maximum charge. Charging shall take time rather than
add a separate score penalty. Charged jumps shall not enable additional
unattached airborne jumps.
Background attachment does not permit charging or launching under REQ-MOV-10.

Maximum charge shall be reached after three seconds of holding the jump
control. Holding beyond three seconds shall not increase the charge or
automatically launch the jump. A quick tap shall retain the normal jump
height. In unobstructed space, a fully charged jump shall rise by the full
level height, measured from the character's launch position to the apex.

A visible HUD charge meter shall show charge progress and explicitly indicate
when maximum charge has been reached. An additional filling charge bar shall
follow immediately above the character, with a distinct full-charge appearance.
Both indicators shall clear when charge is cancelled or a jump launches.

Normal horizontal movement shall remain available while charging. Lost contact
shall preserve charge for the grace period in REQ-MOV-07; release shall still
require current proximity as specified in REQ-MOV-02. Beginning to charge
shall start the run timer if it has not already started.

## REQ-MOV-06: Level Ceiling

The top boundary of the image shall act as a solid ceiling. The character
shall remain inside that boundary; hitting it shall stop upward movement
and allow the character to fall.
An attached background climber shall instead remain gripping the wall under REQ-MOV-10.
The camera shall remain fixed.

## REQ-MOV-07: Forgiving Surface Contact

Floor and wall contact for charging/jumping shall allow a distance of up to
three terrain cells. Charge shall survive up to 150 milliseconds without
such contact, then cancel. Contact grace shall not permit a release beyond
the three-cell distance. Jump presses shall be buffered for 150 milliseconds
before contact, allowing a still-held control to begin charging on arrival;
a release outside tolerance shall cancel rather than queue a later launch.

Walking shall follow inclines and declines, including descending floor
snapping within three cells, without intermittent charge loss. Floor snapping
shall never pull a rising jump back onto the floor. Walls must be actual
terrain; image boundaries shall not grant wall jumps.

## REQ-MOV-08: Solid Image Bottom

Status: Approved.

The image's bottom boundary shall act as a solid floor. The character shall
not fall through it and shall be able to stand, walk, and jump on it.
Removing terrain above the boundary shall not allow the character to fall
out of the image. This supersedes bottom-edge fall-and-respawn behavior in
REQ-SYS-09. The boundary is a movement constraint, not generated photo terrain.

## REQ-MOV-09: Retain Existing Charged-Jump Interaction

Status: Approved clarification; no implementation change required.

After considering immediate-jump alternatives, the user chose to keep the
existing jump interaction unchanged.
Space/touch JUMP shall continue to
charge while held and launch on release, with the current floor/wall
proximity rules, three-second maximum charge, and HUD/on-character charge
indicators specified by REQ-MOV-01/02/05/07.
REQ-MOV-10 changes background attachment to press-to-drop without changing floor/wall behavior.

The proposed responsive-jump redesign is withdrawn. This decision does not
withdraw the approved solid-bottom requirement REQ-MOV-08, whose
implementation is required.

## REQ-MOV-10: Background Climbing

Pressing W/up or touch UP shall enter background-climbing mode without requiring nearby terrain.
The character shall visibly grip the background with alternating hand and foot movements, as though climbing the back wall rather than floating inside a bubble.
Directional controls shall move the climbing character at one quarter of normal walking speed, with diagonal movement normalized.
Releasing directional controls shall hold position without gravity.
When the character's feet meet terrain or the solid image bottom while descending, climbing shall end and normal walking shall resume.
Holding Up shall allow climbing away from a standing position.
Pressing Space or touch JUMP while attached shall immediately detach and drop the character, cancelling charge and restoring gravity without an upward launch.
Holding or releasing that same jump press shall not charge or launch, even if the character lands before release.
Held Up shall not automatically reattach after dropping; a new Up press shall be required.
Climbing shall respect terrain collisions and the image boundaries unless the directional drill removes terrain.
Climbing movement and charging shall count as elapsed race time.