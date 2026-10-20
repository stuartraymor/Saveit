# Saveit 8.7.1 — image resize shows on screen

## Fix: resizing the picture with the handles now visibly grows it

- **Zoom holds still while you drag.** Starting a handle drag freezes "Fit" at its current zoom, so the picture doesn't refit to the window when it grows.
- **The picture is drawn at its new size while you drag**, not just the dashed box. Letting go resamples it to that size.
- **Fit zoom counts the room around the picture**, so the handles stay on screen. The room is now 25% of the longer side (was 35%).

**Tested** in the dev build with real mouse drags on a 1280 × 720 picture:
- Mid-drag screenshot: the white picture filled the grown box.
- After release: 1582 × 890 at the same zoom, so the picture is about 23% larger on screen.
- Undo restored 1280 × 720. A copy after the resize was 1582 × 890.
- No JavaScript errors.

**Not changed (see the open question):** the picture is still the canvas. Resizing it changes the canvas size, and only one picture is on the canvas at a time.
