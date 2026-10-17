# Saveit 9.8.1: small things a person notices

Found by using the app the way a person does: dragging, clicking, typing and resizing the window.

- **Blur shows where it goes while you drag.** The pixelation now previews live, and a dashed outline marks the exact area. Before, nothing appeared until you let go (the preview was blurring an empty background layer instead of the picture). **Spotlight** and **Magnify** show the same dashed outline while dragging.
- **Crop is back on the toolbar**, next to Grab Text, where people look for it (it was only reachable with K or through the Image panel).
- **Zoom with the keyboard:** Ctrl + zooms in, Ctrl − zooms out, Ctrl 0 fits the picture to the window. The zoom arrows say so in their tooltips.
- **Add caption puts you straight into typing:** the new caption's text is selected, so you can just type over "New caption". The caption ✕ button now says "Delete this caption".
- **Narrow windows:** at the smallest window sizes, Undo, Redo, Print and Zoom no longer sit on top of the Cursor and Copy to clipboard boxes. Those two boxes move to their own line instead. Wide windows look the same as before.

Checked and working as expected: drawing tools all show feedback while dragging, Text (type, Escape, double-click to edit), Step numbers, select/move/Delete, box-select, arrow-key nudge, Ctrl+D, Shift for straight lines, Crop with Enter and Undo, Ctrl+S, Save as and Escape, Library search/select/double-click/Escape, New menu, right-click menu, video play/pause, split with S, Undo/Redo.

Tests: `await QA.runAll()` now has 50 checks, including new ones for all of the above.
