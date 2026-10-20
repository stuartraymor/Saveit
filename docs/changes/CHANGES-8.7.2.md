# Saveit 8.7.2 — image resize keeps the view still

## Fix: the viewing area no longer snaps when you resize

- While the **Image tab** is open, the viewing area keeps the same **size, zoom and position**. Resizing only changes the picture drawn inside it, so the background and border stay put and the picture visibly gets bigger or smaller.
- This works the same for the **handles**, the **Width/Height fields** and the **Size presets**.
- Dragging a corner or side handle keeps the **opposite edge fixed**. The picture's top-left corner moves to where the box was, so a left or top handle moves the picture's left or top edge on screen.
- **Undo and redo** put the picture back at its earlier size and position inside the same viewing area.
- **Closing the Image tab** returns to the normal view and "Fit" zoom, as before. The saved picture is the picture itself, with no extra space around it.
- Copy and export are unchanged: they never include the room around the picture.

**How it works:** opening the Image tab creates a fixed viewing surface (the picture plus room around it, about 25% of the longer side on each side) and freezes the zoom. Changes to the picture's size move its top-left corner inside that surface instead of resizing the surface. Code: `app/index.html` (`padX`/`padY`, `layoutStage`, `render`, `pt`, `positionTe`, `syncWs80`, `commitResize80`, undo/redo snapshots).

**Tested** in the dev build with real mouse drags on a 1280 × 720 picture:
- Bottom-right corner drag: the picture became 1582 × 890; the canvas area, its size on screen, scroll position and zoom were identical before and after. Before/after screenshots show the same background with a bigger picture.
- Left-side drag: 1440 × 810, view unchanged.
- Undo twice: back to 1582 × 890, then 1280 × 720, view unchanged.
- Width field (900) and the 1920 × 1080 preset: picture resized, view unchanged.
- Closing the tab: normal layout at 54% fit; the copied image was 1280 × 720.
- No JavaScript errors.

**Not done (separate larger change):** a fixed canvas that is independent of the picture, and several pictures on one canvas. The saved picture is still the one picture. Growing a picture past the viewing surface's edge clips it on screen until you zoom out.
