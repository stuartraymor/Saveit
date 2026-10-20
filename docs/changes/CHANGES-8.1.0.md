# Saveit 8.1.0 — revision changes

Version rule for this revision: each change gets its own version number, shown in the title bar and the top-left badge (read from `app/package.json`). Tickets are reviewed one at a time.

## Ticket 1 — Middle mouse button panning

- Hold the **middle mouse button** on the image viewer to pan. Moving the mouse moves the picture in the viewer. Releasing the button ends pan mode straight away.
- Pan works with any tool selected. It never draws, selects, moves annotations or edits the image.
- Pan scrolls the viewer's existing scroll area, so zoom stays the same and the viewer's normal limits still apply.
- Pan stops if the window loses focus or the pointer capture is lost, so it can't get stuck.
- The browser's middle-click autoscroll is blocked on the viewer.
- Wheel zoom is unchanged.

**Files:** `app/index.html` (pan handler above the viewer's context-menu handler, `.panning81` cursor rule), `app/package.json`, `install.ps1`, `README.txt` (version 8.1.0).

**Tested** in the dev build with real middle-button input:
- Drag left/up by 160×90 px moved the view right/down by the same amount.
- Zoom stayed at 111% during and after the drag. Wheel zoom still changed it (to 93%).
- With the Arrow tool selected, Annotations stayed 0 and the tool stayed selected.
- Releasing the button ended pan; moving afterwards did not pan.
- Window blur during a drag ended pan; the next move did nothing.

**Not tested:** pan on a video (the video view isn't scroll-based in the same way), and touchpads (middle-button drag is a mouse action).
