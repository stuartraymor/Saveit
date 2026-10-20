# Saveit 9.2.0: Layers panel

A new **Layers** button sits on the toolbar next to Image. It opens the Layers panel on the right; click the button again or pick another tool to close it.

**The layer list**
- Shows every layer, top layer first, with its number (1 = bottom), a thumbnail and a name. The Background (canvas) is listed at the bottom.
- Click a row to make it the active (selected) layer. Shift or Ctrl+click selects several. Selecting on the canvas highlights the matching row.
- Double-click a name, or use Rename, to name a layer. Names are saved with the capture.
- Drag a row to reorder the layers.
- Eye button: hides or shows a layer. Hidden layers are left out of saves and copies.
- Lock button: locks a layer so it can't be clicked on the canvas. It can still be selected in the list.

**Buttons in the panel**
- Bring forward, Send backward, Bring to front, Send to back.
- Rename, Duplicate, Delete, Group, Ungroup, Hide/show, Lock/unlock, Select all, Deselect.
- Flatten selected, Flatten all.

**Tested:** opened the panel on four layers; selected a row; renamed a layer; drag-reordered; hid a layer (left out of the export) and locked one (canvas clicks pass through it); clicked the canvas (the row followed); used Bring forward (the list updated); picked another tool (the panel closed); Undo restored everything. Earlier test sets passed again, with no JavaScript errors.
