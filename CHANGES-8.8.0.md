# Saveit 8.8.0 — multi-picture canvas, step 1: Add picture

Part of `PLAN-multi-picture-canvas.md`.

## Add picture…

- **Where:** a new **Add picture…** button in the Image tab (under Canvas size / Crop), and in the right-click menus (on the canvas, and on a capture in the tray). Paste and drag-and-drop still open a new capture, as before.
- **What it does:** opens a file picker (you can choose several pictures at once). Each picture is put on the open canvas as its own object, centred and scaled down to fit if it's larger than the canvas. Several pictures are offset slightly so they don't hide each other. The last one is selected.
- **Each picture is independent.** Select it with Move / Select, drag it to move, use the handles to resize, or type X / Y / Width / Height in the "Selected image piece" panel. Opacity, drop shadow, To front / To back, Duplicate and Delete work too. **The canvas stays the same size.**
- **Undo and redo** work for each picture added or changed.
- **Save and reopen:** pictures are saved with the capture and come back after restarting Saveit.
- **Copy, Save and export** include the pictures at canvas size.
- **Large photos:** pictures wider or taller than 4096 pixels (or files over 6 MB) are reduced to 4096 pixels on the long side, so saved captures stay a reasonable size. Smaller files are kept exactly as they are.
- Not available on step guides (a message explains).

**Files:** `app/index.html` (`addPictures88`, `pictureUrl88`; `pasteImageLayer` takes an offset; the Image tab button and both menus), `app/package.json`, `install.ps1`, `README.txt` (version 8.8.0).

**Tested** in the dev build (the file picker is fed test files, since the native dialog can't be scripted):
- Added a 800 × 600 red PNG and a 400 × 300 green JPEG to a 1280 × 720 canvas: canvas stayed 1280 × 720; the copy showed red at the left, green in the middle, and white elsewhere.
- Narrowing the green picture to 200 px wide revealed the red one behind it. The canvas did not change.
- Undo reverted the narrowing, then removed the green picture; redo brought it back.
- Added a 4500 × 3000 photo from the right-click menu: it appeared, scaled to fit.
- After restarting the app, both captures reopened with their pictures in the right places (red + green; blue).
- The Sample capture still opens with its original 6 annotations.
- No JavaScript errors.

**Not done in this step (next steps in the plan):** the Image tab's handles, Width / Height and presets still resize the **base picture**, not the selected picture object (step 2). Effects still apply to the base picture only (step 4).

**Known limitations:** Fill, Erase, Blur, Simplify and Grab Text work on the base picture only, not on added pictures (use Flatten first). Many large pictures make the saved capture large (step 4 addresses this).
