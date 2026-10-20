# Saveit 8.2.0 — revision changes

## Ticket 4 — Remove redundant Effects controls

- **Image tab:** removed the "Effects and adjustments…" button and its "Look" group. The main toolbar's Effects button opens and closes the Effects tab, as before, and keeps its green highlight.
- **Library:** removed the Effect dropdown, its settings gear and the Apply button. Effects are still applied from the viewer's Effects tab. The effect processing itself, and all saved effects, are unchanged.
- The top bar's capture-time Effect menu is unchanged.

**Files:** `app/index.html` (Image panel markup and wiring, Library toolbar markup and wiring), `app/package.json`, `install.ps1`, `README.txt` (version 8.2.0).

**Tested** in the dev build:
- Image tab shows no Effects button.
- Main Effects button: opens (green, Effects panel), closes (back to Quick styles), opens again.
- Library opens; Delete and Undo delete are present; the effect dropdown and Apply are gone; Escape closes it.
- No JavaScript errors.

**Not tested:** applying an effect to several images at once from the Library (its only route was the removed Apply button; that was the point of removing it — the same effects can be applied one image at a time from the viewer).
