# Saveit 8.0.0 — changes for review

Development branch `v8.0-dev`. 3.7.0 is kept as the stable baseline: git tag `v3.7.0` (branch `main`) and the read-only folder `Saveit-3.7.0-stable`.

## 8.01 — Version 8.0
- Version 8.0.0 in `package.json` (title bar and brand badge read it), the installer banner, the Settings › Apps entry and the README.

## 8.02 — Move / Select button
- Shows a cursor icon, a slash and a four-way move icon, using the button's existing width. The button's size and position are unchanged.

## 8.03 — Live tool previews
- In the right-hand panel, the Arrow style, Shape and Quick style thumbnails are drawn with the current colour, fill, line width, opacity, shadow and line style (solid, dashed or dotted).
- They update while you drag a slider or pick a colour. When an object is selected they show that object's style.
- Line style only shows on tools that support it (arrow, line, shape, ellipse, pen).

## 8.05 — Image, Video and Effects buttons (replaces the planned tabs)
- New **Video** button next to Image.
- Image, Video and Effects turn green while their panel is showing. Clicking Image or Effects again goes back to the tool settings.
- Image is greyed out while a video is open, and Video is greyed out while an image is open.
- In a video, the right-hand panel switches with the buttons:
  - **Video**: trim/split, Clip, Audio, Captions, Export. It's the default.
  - **Effects**: Transitions and Sound effects (EQ, low/high cut, boost, level control, reverb, echo).
  - **A drawing tool** (Move / Select, Arrow, Text, Shape, Ellipse, Line, Step, Stamp, Highlight, Blur): the Draw on video controls, with that tool picked. Image-only tools show a short message instead.
- Code: `index.html` (the "8.0" block at the end of the main script) and `vedit2.js` (`data-pane` views, `pane()` / `tool()` on the editor).

## 8.04 — Video crop controls
- The Video panel's Clip section has a **Crop** row: Start crop, Stop crop, Cancel and Reset crop. Only the buttons that apply right now are shown.
- **Start crop** picks the clip you selected (or the clip under the playhead) and fills in its clip settings. The preview shows the clip's whole frame with a crop box.
  - Drag the box to move it, or drag a handle to resize it.
  - The L / T / R / B % boxes follow as you drag, and typing in them moves the box.
- **Stop crop** (or Enter) keeps the crop, and the preview shows the cropped picture. **Cancel** (or Esc) goes back to the crop you had.
- One Undo removes a whole crop session.
- Playing, picking another clip, switching to Effects or a drawing tool, or any other editor button ends crop mode first and keeps the crop.
- Fixed: on smaller windows the timeline covered the bottom of the video preview. The preview now fits its area.

## 8.06 — Webcam recording crop repair
The live "see yourself" webcam window shown while recording didn't match what was recorded. It now uses the same maths as the recording (`camdraw.js`):
- **Size:** a 120 px minimum made the preview bigger than the recorded webcam on small regions. The minimum is removed.
- **Mirror:** the preview was always mirrored. It now follows the Mirror setting.
- **Border:** the preview was always a 2 px white border. It now uses the chosen colour and thickness, scaled like the recording.
- **Rounded corners:** the preview used a % radius, so the Rectangle shape's corners didn't match. It now uses the same radius as the recording.
- **Framing:** the preview opened the camera at 640×360 while the recorder used 1280×720. On 4:3 webcams that gave different framing. Both now use 1280×720.
- **Full-screen recording on a second monitor:** the preview appeared on the monitor the pointer was on. It now appears on the recorded monitor.
- **Region crop:** the region was scaled from screen points to video pixels with one factor taken from the width. It now scales across and down separately and stays inside the frame, so the crop can't slip up or down if the captured frame's shape differs from the display's.

Tested in the dev build with a real 640×400-point region recording on a 2× display:
- With a test camera (rectangle, rounded, 30%, magenta 6 px border, mirror off), the preview window sat at the same position and size, with the same corners, border and mirroring, as the webcam in the saved video.
- With the real screen, the recorded frame lines up with a screenshot of the same region at zero offset, and the length (3.6 s) is right.
- The saved recording reopens from the library with the same 1280×800 cropped frame.

## 8.07 — Image and video effects audit

### What exists
**Image Effects panel:**
- 9 filter presets: Original, Mono, Sepia, Vivid, Fade, Cool, Warm, Dramatic, Invert.
- Adjust sliders: Brightness, Contrast, Saturation, Hue, Blur, Grayscale, Sepia, plus Vignette.
- Drop shadow (with softness) and edges (Straight, Torn paper, Zigzag, Wave, with depth).
- Reset effects.

**Image panel:** border (thickness, colour, style, inside/outside) and corners (square, rounded, each corner separately).

**Capture-time and library effects** (`fxdefs.js`, the top-bar Effect menu and the library's batch apply): drop shadow, border, rounded corners, torn edge, black & white, sepia, vignette, soften, brighten, contrast, invert.

**Video, in the Effects panel:**
- 14 transitions with a length setting and "use on every clip".
- Sound effects for the whole video or the selected clip: 8-band EQ with presets, low/high cut, boost, level control, reverb, echo and echo time.

**Video, in the Video panel:** fade in/out from black, speed, crop, volume, mute, and audio fades.

### Tested in the dev build
- **Image:** apply preset, slider, shadow, edge, vignette and border; undo/redo; switching Tools / Image / Effects; Reset; reload (effects saved); Copy (the exported image matches the preview pixel for pixel); thumbnails.
- **Video:** split a clip and crossfade (blends correctly mid-transition; undo removes it); EQ drag and undo; export with fade-in and crop (the saved video starts black, then shows the cropped picture); reload.

### Fixed
- **Undo/redo didn't work for any image effect.** Presets, Adjust sliders, vignette, shadow, edges, Reset, border thickness/colour and per-corner radius saved no undo step, so Undo jumped back to whatever was done before. Each change can now be undone; a slider drag counts as one step.
- **Thumbnails ignored image effects.** The Recent tray, library and guide covers showed the plain picture. They now show filters, border, shadow and edges.
- **EQ sliders overlapped.** A global 80 px minimum width made each vertical band 80 px wide, so grabbing one band could move its neighbour. This also made the video side panel scroll sideways, and the 12 kHz band wrapped to a second row. All 8 bands now fit and only the grabbed one moves.
- **Sound sliders needed two Undos.** Clicking a slider saved two undo steps (pointer down and focus), so the first Undo seemed to do nothing. It now saves one.
- **Stale clip boxes.** With no clip selected, the Video panel's clip boxes showed the previous clip's numbers and Speed showed "0.25×". They are now blank until you pick a clip.
- Removed the duplicate "Sound effects" heading added in 8.05.

### Limitations (not changed)
- There are no visual filters for video (black & white, brightness and so on); only image effects have them. Adding them would be a new feature.
- With an edge style (torn, zigzag, wave) the border isn't drawn. The two don't combine.
- Effects applied to many images at once from the library can't be undone.
- An exported video can run slightly longer than the edit (2.2 s for a 2.0 s test), because export records in real time.
- Not tested: GIF export, PDF/Word export with effects (they use the same compositor as Copy), and how sound effects actually sound (only their settings and undo were checked).

## Known issues
- In a video, the Video panel is the default, so clicking Video while it is showing does nothing.
- Window recordings: the webcam preview still sits in the screen's corner, but the webcam is recorded in the window's corner. Saveit doesn't know where the chosen window is on screen, so fixing this needs the window's position from Windows.
- Not tested: two monitors with different scaling, and changing webcam settings during a recording (the recording keeps the settings it started with, as before).
- A drawing tool picked for a video stays active after you switch back to the Video panel, as it did in 3.7.0 when you changed sub-tabs.
