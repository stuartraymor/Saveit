# Saveit 8.12.0 — multi-picture canvas, step 5: regression pass

Tested on a 1280 × 720 canvas with two added pictures:
- Rotate right: pictures baked in (720 × 1280, 0 annotations); Undo restored 1280 × 720 with 2 pictures.
- Flatten: pictures baked in; Undo restored them.
- Arrow tool still selects; Effects (Sepia) applies; Library opens; Copy gives the 1280 × 720 canvas.
- Earlier steps re-checked: add, move/resize each picture, Undo/Redo, save and reopen, background colour. No JavaScript errors.

**Kept on purpose:** the "Resize image…" item in the right-click menu (it resizes the whole canvas and flattens, as before). The old "Resize on screen" dialog code is unused but left in place.

**Known limits of the multi-picture canvas:** Fill, Erase, Blur, Simplify and Grab Text work on the background layer only; pictures past the canvas edge show only in the Image tab; undo copies picture data (large pictures use memory); original size for the background picture is remembered per session.
See `PLAN-multi-picture-canvas.md` and `CHANGES-8.8.0.md` to `CHANGES-8.11.0.md`.
