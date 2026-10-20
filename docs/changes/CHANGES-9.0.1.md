# Saveit 9.0.1: full feature check

No screen changes.

**Fixed**
- **Simplify** did nothing on new captures, because the picture sits above an empty layer. Choosing Simplify now merges the pictures into the image first; Ctrl+Z restores them.
- After a restart, the empty layer under a picture was treated as a real picture in the Image tab. Its "empty" marker is now saved with the capture.

**Checked and working** (test copy of the library, simulated mouse and app functions)
- All 13 drawing tools, typing text, Undo/Redo, Duplicate, Delete, Copy and paste annotations.
- Align, Group and Ungroup (toolbar), and rotating a group.
- Effects panel and applying an effect. Crop with Apply and Undo. Simplify. Magic Cut. Fill, Erase and Selection on pictures.
- Grab Text, and the Redact sensitive text window.
- All image save types including PowerPoint. All guide save types (Word, PDF, PNG, JPG, Saveit). Video MP4 save.
- A Saveit file saves and reopens with its pictures. All 12 captures in the library copy open without errors.
- Library: opens, rename, duplicate, delete. Zoom. Copy whole image.
- After a restart, the saved file location, the pictures and the empty-layer marker are all kept.

**Not checked:** screen capture and recording themselves, the widget, and printing (these need real screen and printer interaction).
