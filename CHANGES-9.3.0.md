# Saveit 9.3.0: groups behave properly

1. **Groups in the Layers panel.** Each group shows as its own row (e.g. "Group 1 · 3 items") with its items indented underneath.
   - Click the group row to select the whole group. Drag it to move the group to another layer position.
   - Double-click the group row to rename it.
   - Its eye and lock buttons hide or lock the whole group.
   - A dashed group row means only some of its items are selected.
2. **Click once for the group, click again for one item** (like PowerPoint). The first click on a grouped item selects the group; a second click selects just that item so you can move or edit it alone. Click empty space to start over.
3. **Group does exactly what you selected.** It no longer pulls in the rest of an old group. The grouped items are placed next to each other in the layer order. The toolbar Group button follows the same rules.
4. **Easier selecting.**
   - Empty (unfilled) boxes and ellipses can be clicked anywhere inside, not just on the outline.
   - Shift+click on empty space no longer clears your selection, and a Shift+drag box adds to the selection.
   - Hidden and locked layers are skipped by the drag box.
5. **Consistent highlighting.** Selecting on the canvas highlights the group row and its items in the panel, and the panel selection shows on the canvas.

Also fixed: a click with a tiny mouse wobble counted as a drag.

**Tested** (simulated mouse):
- Clicked inside an empty box; Shift-selected three items; Shift+clicked empty space (the selection was kept).
- Ctrl+G grouped them. Clicking once then again selected the group, then just the item. Dragging the drilled item moved only it; dragging the group moved all of it.
- Grouped a box (picked out of a group) with text: that made a new two-item group.
- In the panel: group rows with indented items; clicked, renamed and dragged a group row.
- Earlier test sets passed again, with no JavaScript errors.
