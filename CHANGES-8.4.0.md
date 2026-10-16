# Saveit 8.4.0 — revision changes

## Ticket 5 — Better effects preview images

- The Effects tiles (Original, Mono, Sepia, Vivid, Fade, Cool, Warm, Dramatic, Invert) now show each effect on the same **sample picture**: a colourful flower with a stem, leaves, distant flowers, light and shadow. Before, they showed your own picture, so a dark photo made every tile dark.
- The sample is drawn in code (`fxSample()` in `app/index.html`), so it needs no photo licence and no attribution. It's built once and reused.
- Tile size, layout and the Effects page design are unchanged.

**Not done / limitations**
- The sample is an illustration, not a photograph. If you want a real photo, send one (with its licence) and I'll swap it in.
- Blur and Sharpen aren't among the Effects tiles, because this app doesn't have a Sharpen effect. Blur and the other adjustments are in the Adjust sliders.

**Files:** `app/index.html` (`fxSample`, the Effects tile drawing), `app/package.json`, `install.ps1`, `README.txt` (version 8.4.0).

**Tested** in the dev build:
- Opened a near-black test image and the Effects tab: all 9 tiles are colourful and distinct, and none are dark.
- No JavaScript errors.
