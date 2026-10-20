# Saveit 9.4.0: sturdier groups, faster big pictures

1. **Groups no longer merge by accident.** Items you add after restarting Saveit get fresh IDs, so a new group can't quietly join an old one.
2. **Dragging on a screenshot draws a selection box** instead of moving the whole screenshot. Click the screenshot once to select it, then drag to move it. Empty boxes drawn on top of a screenshot can be clicked inside again.
3. **Ctrl+A selects every object** on the canvas (not the screenshot itself).
4. **Groups inside groups.** Grouping two groups keeps them; Ungroup takes one level apart at a time.
5. **Undo goes back 100 steps** (was 40).
6. **Callouts grow to fit their text**, and long text wraps at the right edge of the picture instead of running off it.
7. **Faster:** many blur boxes redraw about 5× faster, and very tall scrolling captures (over 16,000 px) stay smooth when zoomed out.
8. Fixed: the "already on the bottom layer" message showed code; the Widget button could overlap Image/Video; memory used by edited pictures is now released; a capture that never finishes loading now shows an error.
