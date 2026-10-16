# Saveit 8.6.0 — revision changes

## Ticket 2 — Automatic image resize handles

- **Opening the Image tab** shows a dashed box around the picture with eight square handles: one at each corner and one in the middle of each side. No extra button is needed.
- **Dragging a handle** moves that edge; the opposite edge stays where it is.
  - **Corners** keep the proportions while "Corner handles keep proportions" is on (the Move / Select setting). Hold **Shift** to do the opposite for one drag.
  - **Side handles** keep the proportions too while that setting is on. When it's off, they change only their own side.
- **The picture doesn't change while you drag.** The dashed box shows the new size. When you let go, the picture is resampled to that size.
- **Undo** (Ctrl+Z) restores the picture, as with other changes.
- **Clicking** a handle without moving it, or clicking outside the picture, changes nothing.
- **Closing the Image tab** removes the box and handles. The picture is unchanged.
- **Handle size** stays the same on screen at any zoom.
- The **space around the picture** (so the handles can be dragged outward) is shown only while the Image tab is open. It's not included in saved, copied or exported images.

**Behaviour to know about**
- Resizing flattens annotations into the picture, as the existing "Resize image…" dialog already does. Undo brings them back.
- Guides (step guides) don't show the handles; resize them one step at a time.
- The existing "Resize on screen…" and "Resize image…" buttons are still there. Ticket 3 replaces them.

**Files:** `app/index.html` (`rzOn80`, `rzMargin80`, `rzHandles80`, `commitResize80`, the pointer handlers and overlay drawing near the end of the main script; `pad()` and `exportCanvas()`), `app/package.json`, `install.ps1`, `README.txt` (version 8.6.0).

**Tested** in the dev build with real mouse drags:
- Opened the Image tab on a 1280 × 720 picture: the dashed box and eight handles appeared.
- Dragged the bottom-right corner outward by about 100 px: the picture became 1385 × 779 (proportional). Undo restored 1280 × 720.
- Dragged the left handle inward by about 200 px: the picture became 1078 × 607 (proportional).
- Closed the Image tab: the extra space disappeared, and the copied image was 1280 × 720.
- No JavaScript errors.

**Not tested:** resizing with the proportions setting off, Shift on a corner, very large pictures, and the "click outside" case beyond the logic.
