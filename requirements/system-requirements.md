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
The player character shall start on one arbitrary side of the level.
A level exit shall be placed on a roughly opposite side of the level.

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

## REQ-SYS-08: Restart Run

The game shall provide a reset control to start the current level over.
It shall be available during play and after completion. Reset shall retain
the photo, player name, and saved leaderboard entries, restore the original
terrain and starting position, clear held controls, and reset the timer to
zero. An abandoned run shall not record a score.

## REQ-SYS-09: Falling Out of the Level

Status: Superseded for bottom-edge falls by approved REQ-MOV-08; that change
is not implemented yet. The existing game still uses the behavior below.

If the player falls out of the world, they shall respawn at the starting
position. The timer shall keep running and drilled tunnels shall remain.