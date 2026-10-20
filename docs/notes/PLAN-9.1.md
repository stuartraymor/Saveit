# Plan: Saveit 9.1 (resize a group as one)

## Today
- A selected group shows a separate dashed box around **each** item, with no handles for the group.
- In the Image tab the handles resize only the one picture you clicked, even when it's in a group.

## What 9.1 does (like Snagit)
1. **One dotted outline around the whole group:** a single dashed box around everything in the group, with 8 handles (4 corners, 4 sides). The per-item boxes go away.
2. **The handles resize everything together:**
   - Corners keep proportions. Hold Shift to stretch freely.
   - Sides stretch in one direction.
   - Every item keeps its place relative to the others.
   - Pictures resize, keeping their full-quality pixels.
   - Arrows, lines, pen strokes and shapes scale their points.
   - Text, step numbers, stamps and callouts scale their size.
   - Line thickness stays the same (see question 1).
3. **Same in Move / Select and in the Image tab.** In the Image tab, the Width / Height boxes and Size presets show and change the group's size. A live "W × H" label shows while dragging.
4. **Drag inside the outline** moves the whole group (already works). Arrow keys nudge it.
5. **One undo step** per resize. The group stays grouped.
6. **Several items selected without grouping** (Shift-click or drag a box) get the same outline and handles (see question 2).

## Tests
- Group a picture, an arrow, text and a rectangle, resize them from each corner and side, then Undo.
- Do it in both tabs, and with a rotated text item.
- Save and reopen. Check the export matches the screen.

## Questions
1. Should line thickness scale with the group? *Recommended: stays the same (Snagit's default).*
2. Should a multi-selection that isn't grouped also get the one outline and handles? *Recommended: yes.*
