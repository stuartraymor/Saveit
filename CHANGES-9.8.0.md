# Saveit 9.8.0: fixes from the 9.7.0 QA review, and clearer effect icons

Everything here comes from the independent 9.7.0 QA report (finding numbers F1–F16). The layout, features and look of the app are unchanged; this release makes them work the way they appear to.

## Saving and exporting
- **Save on a video now saves what you see (F9).** If the video was trimmed, split, captioned, given effects, zooms, transitions, audio changes or a layout, Save renders that edit. A video you have not touched still saves instantly as the original recording. The message says what was written, how long it is and where: "Saved the edited video (0:05.0) to …". **Cancel** in Export stops the save, and nothing is written.
- **Rendered videos match the timeline length (F5).** Rendering used to keep recording for a quarter of a second after the end, so a 5.0 s edit came out as 5.2 s. It now ends with the timeline, within one frame.
- **Long captions wrap and fit (F16).** Captions wrap inside 90% of the picture width and shrink a little if needed, so no words fall off the edges. The same rule applies to the preview, MP4, WebM and GIF.
- **Word export says what it does (F12):** "Word document; screenshots go in as pictures".

## Capture
- **Scrolling capture is more reliable and never fails silently (F11).** Frames that are not pixel-identical after scrolling (display scaling, smooth scrolling, a sticky header) are now lined up with a tolerant match, and a frame taken while the page is still moving is re-checked. If the capture still has to stop early, or the page did not scroll at all, Saveit says so and suggests Manual scroll, instead of quietly returning the first screen.
- **The recording bar shows what is recorded and its real size (F10),** for example "Window · 1898 × 1080 px" or "Region · 1172 × 552 px", the size the saved video will have.

## Editing
- **Undo right after moving a slider (F2).** Ctrl+Z and Ctrl+Y used to be ignored while an effect slider, tick box or list had focus, so the next Undo seemed to skip the effect and remove earlier work. They now undo the effect you just changed.
- **Step numbers come back with Undo (F15).** Undoing step 3 and adding a new one gives 3 again, not 4.
- **Library selection follows what you see (F14).** An item that leaves the results (for example renamed while searching) is no longer selected, so Open and Delete never act on a hidden item.

## Side panels
- **The video editor's section tabs stay at the top** while the panel scrolls (F4), and outside the Clip, Transitions and Zoom tabs the long trimming hint is folded away to give the section more room (F3).
- **Done and Reset effects stay visible** at the bottom of the image Effects panel (F3).
- **Background explains when it is hidden (F6).** With a layout that fills the frame, the Background tab says why the background is not visible and offers **Show background** (Screen on background). Background previews show the colour around a smaller screen.
- **Effect looks have names (F8)** under each sample picture, and the current look is highlighted.

## Icons
- **Every visual effect has its own symbol (F7):** a sun for Brightness, a half-filled circle for Contrast, ± for Exposure, a droplet for Saturation, a split picture for Black & white, an old photo for Sepia, swap arrows for Invert, a colour wheel for Hue, soft rings for Blur, a flame for Warm, a snowflake for Cool and a darkened frame for Vignette, each on its own coloured tile. The same icons appear beside the image Effects sliders.
- Clearer toolbar icons for **Cut out** (scissors), **Simplify**, **Blur**, **Pen** and **Highlight**.

## Accessibility (F1)
- Saveit always builds its accessibility tree, so Narrator and other assistive tools see the buttons and fields by name.
- Every field in every tool panel has a name (taken from its caption), the canvas and video preview are labelled, and messages are announced.

## Not changed
- **OCR (F13):** 2× upscaling was tried and made results worse on the QA fixture, so recognition is unchanged. The editable review step before copying remains.

## Tests
New automated tests in `tests/`:
- `node tests/run-node-tests.js`: every script parses, every file the app loads exists, line endings are kept, and the scrolling-capture stitcher is tested with identical, re-rendered and sticky-header frames.
- `node tests/build-harness.js <folder>` builds a browser copy of the app; open it and run `await QA.runAll()`. 38 checks cover each fix above plus image/video export regressions (PNG, JPG, GIF, untouched video save).
