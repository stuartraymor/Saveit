# Saveit 9.1.0: resize a group as one

See `PLAN-9.1.md`.

- A group, or any multi-selection, now shows **one dashed outline** around everything, with 8 handles, instead of a box around each item.
- **Dragging a handle resizes everything together.** Corners keep proportions (Shift stretches freely); sides stretch in one direction.
  - Pictures, arrows, lines, pen strokes and shapes scale with the group.
  - Text, step numbers, stamps and callouts scale their size.
  - Line thickness stays the same.
- A live "W × H" label shows while you drag. Each resize is one undo step, and the group stays grouped.
- In the **Image tab**, the box, handles, Width / Height and Size presets work on the group. The panel reads "Resizing the N selected items together".

**Tested** (simulated mouse): grouped a picture, an arrow, text and a rectangle.
- Corner drag in Move / Select gave a proportional result, with line thickness unchanged. Undo restored it.
- In the Image tab: clicking a grouped item selected the group, a side drag stretched the width only, and typing 300 in Width resized the group to 300 × 159.
- Earlier test sets passed again, with no JavaScript errors.
