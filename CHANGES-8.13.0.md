# Saveit 8.13.0 — new captures are a movable picture on a white base layer

- Every **new capture** (screen capture, paste, opened file, frame grab, combined image) now opens as a **picture object on a white base layer**. With **Move / Select** you can drag it anywhere on the canvas and resize it with the corner and side handles, right on the main screen. The canvas stays the same size.
- Canvases with pictures get a small margin so the handles are never cut off at the canvas edge.
- The white is the **Canvas background** (Image tab); change it to transparent, black or any colour.
- Undo steps now **share** picture data instead of copying it, so a full-screen picture doesn't bloat memory.
- Blank canvases, the Sample capture, restored `.saveit` files and **existing** captures are unchanged. Existing captures turn into the same layout when you move or resize them in the Image tab.

**Heads-up:** Fill, Erase, Blur, Simplify and Grab Text work on the base layer, not on the picture. Press **Flatten** (Image tab) first when you want them on the picture.

**Tested** (fresh app, real mouse): dropped picture opened as 1 picture on white; corner-handle resize and Undo; drag up-left (position -210, -123) with white showing; copy kept the white base; thumbnail correct. Not re-tested after a restart for this path (saving of pictures was tested in 8.8.0).
