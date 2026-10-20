# Saveit 3.7.0 — changes for review

Implements the 3.7 release plan with Stuart's answers to its open questions.

## Changes

1. **Slim selection bar.** While you select a region, the bar sits beside the selection and holds only width/height, common sizes, Capture, and one Redo/Cancel button.
   - The button reads Cancel before there is a selection. Once you've drawn one it reads Redo, and after a redo it reads Cancel again.
   - The other options (image/video, area, cursor, clipboard, effect, audio) are chosen in the widget or editor beforehand. They stay in the overlay's page, hidden, so the effect preview and the settings sent back still work.
   - The dead Pause/Stop/timer stubs were removed from view.
   - Code: `overlay.html` (`placeBar`, `#toggle`).
2. **Widget.** It now reopens where you last moved it; the position is saved in `workflows.json` as `widgetPos`. Labels match the editor: "Copy to clipboard", "System audio", "Microphone".
3. **Cursor in recordings.** A spike confirmed that on Windows, Chromium includes the pointer whatever the `cursor` constraint says. Tested with `getDisplayMedia` (`'never'` and `{exact:'never'}`) and the legacy `chromeMediaSource` desktop/screen paths. So in video mode the Cursor option is now greyed out, with a tooltip explaining why. A real fix needs a native capture path; see "Not done" below.
4. **Zoom control.** It's the same size as the old dropdown:
   - Type an exact percentage (10–800%).
   - Small ▲/▼ arrows step through 10, 25, 33, 50, 67, 75, 100, 125, 150, 200, 300, 400, 600 and 800%.
   - The arrow keys work in the box (Shift steps by 10).
   - The ▾ menu has Fit to window and 25–800%.
   - The hidden `#zoom` select is kept for compatibility.
   - **Top bar layout:** capture options sit in two rows lined up with the brand row and the Capture button. In image mode, Copy to clipboard, Effect and Delay are on the Capture row. In video mode, System audio, Microphone and Webcam take that row, Copy to clipboard and Delay move up, and Cursor is hidden because Windows always records the pointer.
5. **Eraser.**
   - "Nearby colour" now samples around the brush (`ImgTools.ringColor`). It used to use the whole image's most common colour.
   - New choices: erase picture pixels, annotations it touches, or both; and a round or square brush.
   - Undo restores the whole stroke, including removed annotations.
6. **Simplify.** The vague Light/Medium/Strong presets are gone.
   - Size: shows the exact current size, with width, height and % inputs that stay in proportion, plus the new size and the pixel saving.
   - Colours: a list of exact counts (4,096 down to 8).
   - Smoothing is shown as a percentage.
   - Result: an estimated PNG file size before and after.
   - Presets now say what they do (Half size, Fewer colours, Sketch, Reset).
7. **Video on-screen items.** They use the same dashed outline, 8 handles, resize cursors and proportional corners as still images (`selBox` / `resizeByHandle` are passed to `vedit2.js`). Drawing on the video and numeric start/end times were already there.

## Tested (in the running app, real mouse input)

- Zoom: typing 250%, the arrow steps, the 800% limit, and Fit from the menu.
- Top bar: no row overflows at a 1267 px window in either mode.
- Eraser: nearby colour on a dark area stays dark; annotation erasing removes touched shapes; undo brings them back.
- Simplify: typing a width sets the height and %; the size and file-size estimate are shown; Apply gives the exact size, and undo restores it.
- Selection bar, through real captures:
  - Before a selection, only Cancel shows.
  - After a selection, the bar appears under it.
  - Redo turns into Cancel.
  - Typing 400 × 300 gives a 400 × 300 capture.
  - Cancel adds nothing.
- Widget: labels match; Cursor is disabled in video mode; after a real OS drag, the widget reopens at the moved position.
- Video: a recorded clip with a box showed all 8 resize cursors, and edge-dragging resized it.
- Regressions: the 3.6 handle checks (11/11) and Magic Cut checks (6/6) still pass. The handoff baseline suite passes 25/25 on 3.7.

## Not done (decisions needed)

- **Pointer always shows in recordings.** The options are a native capture helper with draw-mouse off (for example ffmpeg's gdigrab, which adds about 80 MB), or accepting the limitation.
- **General/Video tabs in the side panel:** deferred.
- **Shared options module for the widget and editor top row:** not built. Slimming the overlay removed the main source of drift; the widget and editor labels now match.

## Added after review

- **Webcam settings window (⚙ next to Webcam in the editor and the widget).**
  - It opens one window with a live preview. The settings are camera, shape (circle, square, wide 16:9), corners, position (4 corners), size (10–45% of the recording's width), border on/off with colour and thickness, and mirror.
  - Settings save instantly to `saveit.cam`. The recorder, this window and the pre-recording webcam dialog all draw through the same `camdraw.js`.
  - Tested: settings chosen in the window (square, top-left, 30%, magenta 8 px border, mirror off) showed up exactly in a real recorded frame.
- **Layout:** the editor's top bar and the widget use the same compact two-row layout. Capture and Record are red everywhere, including the selection bar.
- **Widget and editor share one spot.** Clicking Widget opens the widget with its Saveit logo exactly where the editor's logo was. Switching Image/Video keeps the left edge still, so only the settings on the right change. Clicking Editor brings the editor back with its logo on the widget's, unless the editor is maximized. The positions are tested to within 1 px.
- **Full-screen selection:** a dashed outline around the screen, the bar at the top centre, and a hint. Dragging draws a new area instead of moving the whole-screen selection.
- **One capture bar style:** the editor's capture controls and the widget share `capbar.css`, with compact 24/28 px rows, grey boxes, the version number in both brands and the record icon on both buttons. Every control sits at the same offset from the Saveit logo in both, measured in image and video modes.
