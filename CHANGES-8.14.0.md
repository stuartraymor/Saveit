# Saveit 8.14.0 — simpler right-click menus

**Paste is now universal.** Paste (menu button, Ctrl+V, Paste in the top bar): annotations paste as annotations; an image pastes **onto the open canvas as a picture**. With no capture open it opens a new capture. Ctrl+Shift+V still works.

**Right-click on a selection (12 → 8 items):** Cut, Copy, Paste, Add picture…, Duplicate, Bring to front, Send to back, Delete.
Removed: Paste image as layer, Deselect (Esc does it), Copy whole image (Copy does it when nothing is selected), Image actions….

**Right-click on a capture (18 → 14 items):** Copy, Paste, Add picture… / Crop…, Resize canvas…, Rotate right, Rotate left, Flip horizontal, Flip vertical / Grab text…, Flatten / Duplicate, Rename…, Save as…, Delete.
Removed: Resize image… (the Image tab does it), Paste as new capture, Paste image as layer, Open in editor, Undo delete (the tray button remains).

Wording: "Cut/Copy/Duplicate/Delete annotations" → Cut/Copy/Duplicate/Delete; "Copy image" → Copy; "Duplicate capture" → Duplicate; "Delete capture" → Delete; "Flatten annotations" → Flatten.

**Tested:** both menus listed exactly the items above in the running app; menu Paste put a clipboard image on the canvas as a picture (1 added, no new capture); right-clicking a selected picture showed the 8-item menu. Not tested: pasting with real Ctrl+V (it uses the same function).
