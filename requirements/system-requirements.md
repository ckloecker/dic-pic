# System Requirements

## REQ-SYS-01: Platform

The game shall be accessible using a web browser.
It shall run under Android, Windows, and iOS using the default web browsers.

## REQ-SYS-02: Game Design

The game shall be a 2D platformer.

## REQ-SYS-03: Level Setup

A level shall be created based on an uploaded or taken photo, i.e., an image.
The image's visible edges will be the ground for the player character to move on.
The image shall still be visible as background.
The player shall choose one of three generated biome/layout previews before starting, as specified by REQ-LVL-12.
Placement shall prioritize safe support nearest a randomly selected edge and a distant start, rejecting walking-only pairs and trying alternatives as specified by REQ-LVL-07.

## REQ-SYS-04: Gameplay

The main goal of the game is for the character to get to the exit as fast as possible.
As soon as the character is moved by the player, a timer shall start.
Beginning to charge a jump shall also start the timer, even before the
character moves (see REQ-MOV-05).
As soon as the character has reached the exit, the timer shall stop.

## REQ-SYS-05: Player Name

After game startup or initial access, the player shall be prompted to enter their name.
The player name shall be letters and spaces only, with a maximum length of 32 characters.

## REQ-SYS-06: Leaderboard

After successfully reaching the exit, the player shall see their time.
Along the time, a leaderboard with the top 10 lowest times for this level shall be shown with the respective player name.
Leaderboard entries shall be stored in the browser and shall not be shared
with other devices or browsers.
The exact just-completed attempt shall have a clearly outlined row labeled "Your run".
If that attempt does not enter the top ten, it shall appear beneath the ranked entries with no rank, without persisting an eleventh score.
Identical names and times shall not cause another attempt to be highlighted.
Existing attempts shall precede new attempts with equal times.

## REQ-SYS-08: Restart Run

The game shall provide a reset control to start the current level over.
It shall be available during play and after completion. Reset shall retain
the photo, player name, and saved leaderboard entries, restore the original
terrain and starting position, clear held controls, and reset the timer to
zero. An abandoned run shall not record a score.

## REQ-SYS-09: Falling Out of the Level

Status: Superseded for bottom-edge falls by REQ-MOV-08.

The solid image bottom shall prevent falling out of the level, including after excavation.
Bottom-edge contact shall not respawn the character or reset the timer or tunnels.

## REQ-SYS-10: Enemy Contact

Status: Approved.

Contact with any flying patrol enemy shall immediately return the character to the selected starting position.
Enemy contact shall preserve the running timer, drilled terrain, selected option, and enemy patrol progress.
The returned character shall have fresh movement state and held controls shall be cleared.
Enemy contact shall take priority over simultaneous finish contact and shall not record a score.
Manual reset shall continue to restore terrain, enemy starting positions, controls, and the timer under REQ-SYS-08.