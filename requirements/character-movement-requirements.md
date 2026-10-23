# Character Movements

## REQ-MOV-01: Controls

If the game is accessed from a device with a keyboard, the controls shall be:
* D or right arrow: Move right
* A or left arrow: Move left
* W or up arrow: Enter background climbing (see "REQ-MOV-10")
* S or down arrow: Climb down or aim the drill down
* Space: Press to jump immediately; hold briefly to jump higher
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

The character shall jump immediately on pressing the jump control within three terrain cells of a floor, either side of a terrain wall, or either vertical image side border (REQ-MOV-07).
A wall jump shall launch upward and away from the wall at normal horizontal movement speed, using the same hold window and vertical height range as a floor jump.
Outside the surface-distance tolerance, a press shall not launch unless buffered until contact under REQ-MOV-07.
There shall be no free additional airborne jumps.
While background climbing, the jump control drops instead, as specified by REQ-MOV-10.
While actively excavating, horizontal travel uses the limit in REQ-MOV-03.

## REQ-MOV-03: Drill

Holding Return or the touch DRILL control shall operate a visible directional drill, not a surrounding bubble.
The drill shall cut a narrow tunnel in the pressed direction, including diagonally, upward while climbing, and downward while standing.
With no direction pressed it shall drill in the character's horizontal facing direction.
When drilling horizontally while walking, the tunnel shall not excavate cells below the player's feet or remove the supporting floor.
The horizontal cut shall preserve the first supporting row below the character's footprint, including when floating-point rounding puts the feet infinitesimally beyond an integer row.
Repeated left/right excavation shall not deepen its own floor.
Background-climbing horizontal excavation shall retain its vertical position when no vertical direction is pressed.
Excavated terrain shall remain removed for the current run, including terrain supporting the finish gate.
While the drill is actively excavating intact terrain, normal horizontal movement shall be limited to background-climbing speed, twenty terrain cells per second.
Holding the drill in already-open space shall retain normal eighty-cell-per-second horizontal movement.
Background climbing shall remain twenty cells per second with normalized diagonals, including while drilling.
Excavation shall not change gravity, the jump hold window, or vertical jump velocity, and shall not enable hovering outside background climbing.
Movement limits shall hold across supported frame durations and repeated resets without duplicate animation loops.

## REQ-MOV-04: Air Movement

While "in air", i.e., executing a jump or falling, the character shall move left or right at normal speed unless a temporary speed pickup is active under REQ-LVL-18.
Background climbing and active excavation are exceptions: REQ-MOV-10 specifies climbing speed and suspension of gravity, and REQ-MOV-03 limits horizontal active excavation without changing gravity.

## REQ-MOV-05: Immediate Variable-Height Jumps

Pressing Space or touch JUMP near an eligible surface shall immediately apply the existing normal-jump minimum impulse.
Continuing to hold the control shall increase upward velocity during a 250-millisecond window measured from launch.
A quick tap shall retain the existing normal rise of approximately 38.6 terrain cells in unobstructed space.
A full hold shall rise at most twice the normal jump height, approximately 77.1 cells, rather than a full level height.
Intermediate holds shall produce intermediate heights.
Releasing shall stop additional upward assistance without launching again or cancelling existing momentum.
Holding beyond the window shall not increase jump height or automatically jump again on landing.
Gravity and collision shall remain active, and ceiling contact shall stop upward assistance.
The hold window shall remain valid after leaving the launch surface, without permitting additional unattached airborne jumps.
Background attachment shall retain press-to-drop under REQ-MOV-10.
A visible HUD meter and a bar immediately above the character shall show hold progress with a distinct maximum appearance.
Both indicators shall clear on release, cancellation, ceiling contact, or the end of ascent.
Normal horizontal movement shall remain available while holding, subject to the active-excavation limit.
An immediate jump shall start the run timer.

## REQ-MOV-06: Level Ceiling

The top boundary of the image shall act as a solid ceiling. The character
shall remain inside that boundary; hitting it shall stop upward movement
and allow the character to fall.
An attached background climber shall instead remain gripping the wall under REQ-MOV-10.
The camera shall remain fixed.

## REQ-MOV-07: Forgiving Surface Contact

Floor and wall contact for launching shall allow a distance of up to three terrain cells.
Jump presses shall be buffered for 150 milliseconds before contact, allowing a still-held control to launch immediately on arrival.
A release before contact shall cancel the buffered press rather than queue a later launch.
After launch, upward assistance shall depend on the hold window rather than continued surface contact.

Walking shall follow inclines and declines, including descending floor snapping within three cells.
Floor snapping shall never pull a rising jump back onto the floor.
Terrain walls shall be actual terrain, while the left and right image borders shall also grant wall contact and wall jumps.
The top image boundary remains the ceiling specified by REQ-MOV-06, and the bottom remains the floor specified by REQ-MOV-08; neither shall grant wall jumps.

## REQ-MOV-08: Bottom-Edge Run Reset

Status: Superseded by REQ-SYS-14.

Falling to the image bottom shall reset the entire run under REQ-SYS-14.
The image bottom shall no longer be a safe surface for continued play.

## REQ-MOV-09: Superseded Charge-and-Release Interaction

Status: Superseded by the approved immediate variable-height jump revision in REQ-MOV-01/02/05/07.

The previous hold-to-charge and release-to-launch interaction is replaced by launch-on-press with a 250-millisecond upward-assistance window.
Failure resets under REQ-MOV-08/REQ-SYS-14 and background press-to-drop under REQ-MOV-10 remain unchanged.

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
Climbing movement and immediate jumping shall count as elapsed race time.
