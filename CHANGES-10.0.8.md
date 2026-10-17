# Saveit 10.0.8 — Rotate pictures

- **Pictures rotate too.** Select a picture (a capture, or an image you added or pasted) and drag the round teal rotate handle above it, in Move / Select or in the Image tab. It works like it does for annotations: the angle shows while you drag, **Shift** snaps to 15°, it sticks lightly at 45° and 90°, and the Rotation (°) box in Position and size sets an exact angle.
- **In the Image tab** the dashed box and its eight handles turn with the picture, resize cursors turn too, resizing works along the picture's own sides with the opposite edge fixed, and typing a Width or Height keeps its centre. Rotate left/right now just change the angle of a turned picture, and Flip mirrors its pixels.
- A picture can be part of a group that you rotate together with other objects.
- Parts of a turned picture that go past the edge of the canvas are cut off, as when you move a picture off the edge. Use Resize canvas first if you need room.
- Tests: `tests/rotate-tests.cjs` now has 24 checks (4 new for pictures). All other suites still pass.
