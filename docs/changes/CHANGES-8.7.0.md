# Saveit 8.7.0 — revision changes

## Ticket 3 — Compact image resize controls

- **Top of the Image tab:** Width and Height fields (in pixels), a proportion lock button (closed padlock = keep proportions, open = change each side separately; on by default), and a **Size presets** dropdown.
- The fields always show the picture's current size. They also follow the handles while you drag them.
- **Typing a width or height** resizes the picture when you press Enter or leave the field. With the lock on, the other side follows.
- **Size presets:**
  - *Original image size*: the size the picture had when it was first shown in this session.
  - *640 × 480, 800 × 600, 1280 × 720, 1920 × 1080, 2560 × 1440, 3840 × 2160*: with the lock on, the picture is scaled to fit inside that size, so it isn't stretched. With the lock off, it's set to exactly that size.
  - *Fit to window*: the picture is scaled to fit the editing area. This keeps the "Fit in window" option from the removed Resize on screen dialog.
  - *Custom size*: shown when the size doesn't match a preset. Choosing it changes nothing.
- Invalid values (empty, zero, negative, or over 16,384 pixels) are refused and the fields go back to the current size.
- Fields and handles use the same resize, so Undo works the same way for both.

**Removed:** the "Resize image…" and "Resize on screen…" buttons. What they did is covered by the fields, the presets and the handles (Ticket 2). "Canvas size…" and "Crop" are unchanged.

**Limitation:** "Original image size" is kept in memory for this session only. After restarting Saveit, it means the size when the picture is first shown. Saving it with the capture needs a change to how items are saved, which I haven't made.

**Files:** `app/index.html` (`resFields87` and the presets at the top of `imagePanel`; the wiring at the end of `renderProps`; the Image tab buttons; the handle drag updating the fields), `app/package.json`, `install.ps1`, `README.txt` (version 8.7.0).

**Tested** in the dev build:
- Width 640 with the lock on → height 360. Undo restored the previous size.
- Lock off, height 300 → 640 × 300.
- Preset 1920 × 1080 with the lock on → 1920 × 1080. Preset 800 × 600 with the lock off → 800 × 600. Original → back to 1280 × 720.
- The two removed buttons are gone; Canvas size and Crop are still there.
- A handle drag updated the fields and the status bar to the same size (1385 × 779).
- No JavaScript errors.

**Not tested:** typing invalid values in the browser's own number boxes beyond the zero case, and the Fit to window preset on a very small window.
