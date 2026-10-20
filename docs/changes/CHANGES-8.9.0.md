# Saveit 8.9.0 — multi-picture canvas, step 2: the Image tab works on the selected picture

- **Which picture:** the Image tab works on the added picture you had selected when you opened it. Click any picture on the canvas to switch to it; click the background picture to work on that. The panel says which one ("Resizing picture 2 of 2" / "the background picture").
- **The canvas never changes size.** Handles, Width/Height and Size presets change only the chosen picture's box. The Image tab's size line is labelled "Canvas …".
- **Background picture:** the first time it's resized it becomes a picture object like the added ones (the canvas behind it is left empty). Undo puts it back.
- **Past the edge:** while the Image tab is open, the chosen picture shows past the canvas edge, and a thin outline marks the canvas. Copy and Save include only the canvas.
- **Lossless:** resizing a picture just changes its box, so shrinking and growing never softens it.
- **Presets:** Original = the picture's own pixel size; WxH sizes keep proportions while the lock is on; "Fit to canvas" fits and centres it.
- **Effects** (Mono, Sepia, …) now also apply to added pictures.
- The old fixed viewing surface remains, so zoom and background stay still while you resize.

**Tested:** background picture resize on the Sample capture (canvas stayed 1280 × 760, view unchanged, Undo/Redo, copy 1280 × 760); added pictures targeted on open; Width field changed only the selected picture; Mono affected pictures; reload kept both pictures.
**Limits:** annotations stay where they are when a picture moves. Pixel tools (Fill, Erase, Blur) act on the background layer only. Step 3: arrangement aids; step 4: effects scope, memory.
