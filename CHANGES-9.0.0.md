# Saveit 9.0.0: editor workflow

See `PLAN-9.0.md`. The screens look the same as before. Only the Image tab gained a Layers section.

**9.01 Save**
- The first Save on a capture opens the Windows dialog with every file type. **Saveit file** is the default. The type you pick there decides the format.
- After that, Save writes over the same file without asking. Save as… still chooses a new type or place. The file location is remembered after a restart.

**9.02 Select and move in the Image tab**
- Click any picture or annotation to select it, then drag to move it. Arrow keys nudge it (Shift = 10 px). Shift-click adds to the selection. Resize handles work as before.
- The Image tab panel stays open while something is selected.

**9.03 Rotate and Flip**
- They act on the selected item only, around its own centre. A picture's pixels turn, and text, step numbers and stamps really rotate.
- Grouped items turn together. With nothing selected, the whole canvas turns and every object stays separate. Nothing is flattened.
- Group and Ungroup use the existing feature (toolbar buttons, Ctrl+G and Ctrl+Shift+G, Image tab, right-click menu). Clicking or box-selecting a group selects all of it. Duplicates and pasted copies form their own new group.

**9.04 Crop**
- Crop trims pictures at the new edge and removes objects that are fully outside. Everything else stays separate and editable.

**9.05 Layers** (Image tab and the right-click menu)
- Bring forward (Ctrl+]), Send backward (Ctrl+[), Bring to front (Ctrl+Shift+]), Send to back (Ctrl+Shift+[), Group, Ungroup, **Flatten selected** (merges only the selected items into one picture) and Flatten all.

**9.06 Tools work on what you see**
- Blur and Magnify use whatever lies beneath them: pictures and annotations, not just the base layer. They stay editable and follow when moved.
- Fill, Erase and Selection (lift a piece) work on the top picture under the pointer.
- Magic Cut also removes the strip from every picture it crosses. Grab Text reads what's on screen.

**9.07 Checked** (test profile with a copy of the library, simulated mouse):
- All 13 drawing tools draw one object each.
- Image tab: corner resize, picking a picture, moving, nudging, Rotate on one picture only, and the layer buttons.
- Fill, Erase and Selection work on a picture. Grab Text read "Grab this text".
- The first-save dialog showed "Saveit file". Saving as .png wrote a real PNG, and the second Save overwrote the same file with no dialog.
- All 10 image save formats encode.
- Also checked: Undo/Redo, effects, Magic Cut, rotate/flip/flatten from the menu, and copy. No JavaScript errors.

**Known limits**
- Simplify still works on the base layer only. Flatten first to simplify a picture.
- Rotated text is edited in its upright position.
- Not tested: guide and video Save with the new dialog, and a real install-and-restart of the saved file location.
