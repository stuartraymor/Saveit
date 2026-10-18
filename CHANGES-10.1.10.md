# Saveit 10.1.10

**Copy, then paste into email.** Right-click an image, choose Copy, and paste it into Outlook, Gmail or Teams: the finished picture appears.

- **Library Copy copies the picture.** With one image chosen in the Library, Copy (or Ctrl+C) now also puts the finished picture on the Windows clipboard, so it pastes into other apps. Before, nothing was written and the old clipboard contents were pasted. Copying several items still copies them between Saveit folders as before.
- **No more JSON text in email.** Copying selected annotations (Ctrl+C) puts only their picture on the clipboard. Before, it also wrote Saveit's internal JSON as text, which email apps could paste instead of the picture. Inside Saveit, Ctrl+V still pastes them as editable objects: Saveit keeps them in memory and recognises the copied picture by a fingerprint taken as Windows stores it. Annotations copied with an older Saveit (JSON text) still paste as editable objects.
- **Copy image in the right-click menu.** The editor's right-click menu starts with **Copy image** (the whole finished picture, Ctrl+Shift+C). Copy is now called **Copy selected**. Keyboard shortcuts are unchanged.
- Trade-off: annotations copied with Ctrl+C stay editable only while Saveit is running. After a restart they paste as a picture, as in Snagit.
- `clipboard-editable` in main.js is no longer used; it is left in place for a later cleanup.
- Checked in real Electron 33 with the real Windows clipboard (`tests/native-clipboard1110.cjs`, 9 checks): Copy image (800×450 PNG, no text), Ctrl+C of an arrow (its picture only, no text), Ctrl+V back as an editable annotation, a picture from another app pastes as a picture, old JSON annotations still paste, Library copy of one image, and Library copy of two items. Pasting into Outlook, Gmail and Teams themselves was not tested here; the clipboard now holds only a PNG picture, the same as the existing Copy image, which already worked there.
