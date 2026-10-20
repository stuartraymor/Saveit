# Saveit 3.6.0 — changes for review

Base: Saveit 3.1.0, plus the 3.5 developer handoff (capture menus, crop/resize, OCR repair, library catalog, presets, PowerPoint, backup/restore). The 3.5 handoff's review-only settings were removed: separate data folder, disabled global hotkeys, and quit-on-close.

## What changed in 3.6.0

1. **Webcam and microphone selection**
   - The capture widget's Mic, Webcam, Audio and Effect controls didn't respond to clicks. They sat inside a `display:contents` wrapper, so they were caught by the window-drag region. Fixed in `widget.html`.
   - New `devices.js` lists cameras and microphones, fills the device pickers, and opens the chosen device.
   - If the chosen device is missing, it falls back to the default device and says so. If access is blocked, it shows a clear message.
   - Device pickers were added to the editor's top bar and to the widget. The choice is saved and passed between them, and recording uses it (`exact` deviceId).
2. **Save as**
   - The file-type dropdown next to Save as was removed. The element is kept hidden, and Ctrl+S still saves in the last-used type.
   - The Save as dialog lists every format, marks the current default, and adds a JPG/WebP quality slider and a "Use this file type for the Save button" option.
3. **Selection handles**
   - A selected object shows a dashed outline with 8 square handles. Text, step and stamp objects only get corner handles, because they scale evenly.
   - Corner handles keep proportions; Shift, or turning off the option in Move / Select, lets you resize freely. Edge handles change one side.
   - The cursor changes to the matching resize cursor over each handle.
   - The outline and handles are drawn only when `ui=true`, so they never appear in exports.
   - Exact X/Y/W/H fields were added. Step guides use the same resizing. The video editor keeps its original handle set (`legacyHandles`).
4. **Mouse-wheel zoom**
   - Zooms toward the pointer, from 10% to 800%, and only changes the view.
   - Shift+wheel scrolls instead. While the whole image fits in the window, it stays centered.
5. **Properties panel by tool**
   - Each tool shows only its own settings.
   - Rotate, flip, resize, border and corners moved to a new **Image** tool, which replaces the Image ▾ menu (the same menu is still on right-click). Image also holds the name, tags and pin.
   - Border has style (solid/dashed/dotted/double) and placement (around the image or over its edge). Corners can be square or rounded, with an option to set each corner separately.
   - Text gets font family, size, color, bold, italic, underline and alignment.
   - Pen, arrow, line and shape get a line style (solid/dashed/dotted).
   - Blur can pixelate or smoothly blur. Spotlight has a darkness setting and Magnify has a zoom level.
   - Edit/Redact captured text moved to the Grab Text panel. Effects keeps filters, adjustments, shadow and edges.
6. **Toolbar renames**
   - The first two buttons are now **Move / Select** and **Magic Cut**, with new icons.
7. **Bug fix**
   - Spotlight didn't dim the area outside its box; the path order was wrong. This bug was already in 3.1.

Most edits are in `app/index.html` (`renderProps`, `bindPanel`, `imagePanel`, `textFormat`, `handles`/`applyBox`/`resizeByHandle`, `setViewZoom`, `drawComposite`/`cornerPath`/`strokeBorder`). The other files changed are `widget.html` and the new `devices.js`.

## Tested

The changes were tested in the running app with real mouse and wheel input:
- Device detection and selection, including real OS clicks on the widget.
- A short recording that used the chosen webcam and microphone.
- All 8 handles and their cursors, plus the exact size fields.
- Wheel zoom anchoring and zoom limits.
- That exports don't include the handles.
- Every tool's panel, text formatting, line styles, rotate/flip, borders, per-corner radius, and Magic Cut pieces.

The 3.5 handoff regression suites only partly ran (their selectors were updated for the moved controls):
- Baseline: 25/25 passed.
- Advanced: the first 7 passed, then it stopped because it looks for the old "Saveit Review" window title.
- The extras, ui, ocr, outputs and tools suites weren't run against 3.6.

## Not covered

- No physical print was tested.
- Long recordings weren't tested.
- The ui-test layout checks expect the 3.5 toolbar and will need updating.
- Step guides still have their own Word/PDF/JPG/Saveit export buttons, which already existed and were left in place.

## Install

Run `Install.cmd`. It downloads the Electron 33.2.1 runtime (about 110 MB) and checks its SHA-256 before installing. It keeps any existing Saveit library.
