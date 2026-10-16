# Plan — fixed canvas with several independent pictures

**Goal:** the canvas stays one fixed size. Pictures are objects on it. Each picture can be added, moved and resized on its own without changing the canvas, the zoom, the view or the other pictures. Exports and copies are the canvas.

## What already exists (so we don't rebuild it)

The editor already has a **picture object** (`t:'img'`, created today by Magic Cut). It:
- keeps its **own full-resolution image** (`src`, a PNG data URL) and draws it scaled into a box, so resizing never softens it;
- is **selected, moved and resized with the existing handles** (`resizeByHandle`), and shows the X / Y / Width / Height boxes in the "Selected" panel;
- takes part in **undo and redo** (shapes are copied in each undo step);
- is **saved with the capture** (inside the saved shapes) and **drawn into exports** (`drawComposite` draws every shape);
- can be raised, lowered, duplicated and deleted like any other object.

So no new file format and no new resize engine is needed. The base picture (what you captured) stays the canvas background until the user moves or resizes it.

## Steps (one at a time; each gets a new version number and your approval)

**Step 1 — 8.8.0 — Add a picture to the canvas**
- "Add picture…" (file picker; also works for several files at once) puts each picture on the open canvas as an object, scaled down to fit the canvas if it's larger, centred, and selected.
- Move and resize with the existing handles in Move / Select. Each picture is independent.
- Undo/redo, save and reopen, Copy and Save all include the pictures.
- Not in this step: the Image tab handles, the base picture as an object, effects scope.

**Step 2 — 8.9.0 — The Image tab works on the selected picture**
- The eight handles, Width / Height fields and Size presets resize the **selected picture object**, not the canvas.
- With only the base picture, the first resize or move turns it into a picture object, and the canvas keeps its size. The area it leaves shows the canvas background.
- This replaces the 8.7.2 fixed viewing surface, which is no longer needed because the canvas itself is fixed.

**Step 3 — 8.10.0 — Comparing size and placement**
- The canvas edge is always drawn as a thin outline.
- The selected picture shows its size and position; nudge with the arrow keys; align and distribute are already in the editor for several selected objects.
- Pictures can extend past the canvas edge; they're clipped in exports.

**Step 4 — 8.11.0 — Effects, background and limits**
- Decide and implement what effects apply to (see question 1).
- Canvas background: transparent (default) or a colour.
- Memory and speed with many large pictures (store as blobs instead of text, limit count/size, warn).
- Library thumbnails show the whole canvas.

**Step 5 — 8.12.0 — Regression pass and notes**
- Test every existing editing tool with pictures present.
- Remove the old single-picture resize code that's no longer used.
- Update the change notes and the manual.

## Open questions

1. **Effects (Mono, Sepia, Vivid…):** today they apply to the base picture only. Recommended: apply to the **whole canvas** (all pictures together). The other option is per picture.
2. **How do you add a picture?** Recommended: an **"Add picture…" button in the Image tab** and in the right-click menu, so Paste and drag-and-drop still open a new capture. Another option: make Paste / drag-and-drop add to the open canvas.
3. **Canvas background:** transparent (checkerboard on screen, transparent in saved PNG) or white. Recommended: transparent, with a colour option in step 4.

## Risks

- Pixel tools (Fill, Erase, Blur, Simplify, Grab Text) work on the **base picture only**, not on picture objects. A picture object would need to be flattened first ("Flatten" already does this).
- Picture objects are stored inside the saved shapes as text, which makes the saved capture larger. Step 4 addresses this.
- Magic Cut and crop on a canvas with several pictures use the base picture; this will be checked in step 5.
