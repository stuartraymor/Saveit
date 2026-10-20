# Saveit 10.0.6 — Rotate selected objects

- **Rotate handle.** Select a rectangle, ellipse, highlight, callout, text, step number, stamp or pen stroke and a round teal handle appears on a short stem above the top-middle of its box. Drag it to turn the object about its centre; the angle shows while you drag. **Shift** snaps to 15° steps, and it also sticks lightly at 45° and 90°.
- **Everything follows the turn.** The dashed frame and the eight resize handles rotate with the object, resize cursors turn with them, and resizing works along the object's own sides while the opposite edge stays put. Clicking, the move border, the callout tail handle and moving by dragging all work on the rotated object where it really is. Text is edited upright and turns back when you finish.
- **Rotation field.** Position and size has a new **Rotation (°)** box for an exact angle (any value; it wraps to 0–360).
- **Undo, Redo, saving, copying and export** keep the angle. The Image tab's Rotate left/right and Flip buttons turn a rotated object about its own centre.
- Arrows and lines still turn by moving their end points. Blur, spotlight, magnify and pictures don't rotate.
- Tests: new `tests/rotate-tests.cjs` (15 checks). Polish 35/35, audio 24/24, MP3/M4A 6/6, review fixes 7/7, pitch checks and the 82-check suite pass.
