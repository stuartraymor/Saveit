# Saveit 10.0.7 — Rotate a group, and a few edge cases

- **Rotate several objects together.** Select two or more (rectangles, ellipses, highlights, callouts, text, steps, stamps, pen strokes, arrows, lines) and the group box gets the same teal rotate handle. The group turns about its centre: each object takes on the angle and moves around the centre, and arrows and lines have their end points moved. **Shift** snaps to 15°. One Undo puts everything back. A group that contains a blur, spotlight, magnify or picture can't be rotated.
- **The rotate handle is always reachable.** If there is no room above an object (for example it touches the top edge of a blank canvas), the handle moves below it and still turns the object the way you drag.
- Rotated text, steps and stamps resize from a corner and keep their angle. Locked or hidden objects don't turn.
- Tests: `tests/rotate-tests.cjs` now has 20 checks. Polish 35/35, audio 24/24, MP3/M4A 6/6, review fixes 7/7, pitch checks and the full 82-check suite pass, and the app boots in real Electron with no errors.
