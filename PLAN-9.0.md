# Plan: Saveit 9.0 (editor workflow)

Starts from 8.14.0 (branch `v8.0-dev`). Tickets 9.01–9.07, released together as 9.0.0. Each ticket gets a test in the running app, and your OK before the next one starts.

## What's wrong today (found in the code)

| Problem | Cause |
|---|---|
| Save only offers PNG | The Windows save dialog gets **one** file type, the one in the format box (`main.js` `save` handler). |
| No way to move a picture in the Image tab | The Image tab only has resize handles. Clicking a picture selects it; dragging inside does nothing. |
| Rotate / Flip merge everything | `transformImage` flattens the whole canvas into one picture, then turns it. |
| Crop merges nothing, but cuts only the base layer | `applyCrop` crops the white base. Pictures are only shifted, never trimmed, so they still stick out past the new edge. |
| Blur shows white / does nothing | Since 8.13 the capture is a **picture on a white base**. Blur and Magnify read pixels from the base only, so they blur white. |
| Fill, Erase, Selection, Simplify, Magic Cut | Same cause: they work on the base layer, not on the picture you see. |
| Layers | Only Bring to front and Send to back, and only in the right-click menu. No step up or down, no Group. |

## Steps

**Ticket 9.01: Save dialog shows every file type, Saveit file first**
- The first Save on a capture that has never been saved opens the Windows dialog with **all** file types for that kind (image: Saveit, PNG, JPG, WebP, BMP, ICO, SVG, HTML, PDF, Word). **Saveit file is the default.**
- The type you pick in the Windows dialog decides the format, so the format box isn't needed for the first save.
- After that, Save writes to the same file again without asking. Save as… still lets you choose a new type or place.
- Guides and videos get the same treatment with their own lists (guide: Saveit first; video: MP4 first).

**Ticket 9.02: Select and move in the Image tab**
- Drag inside the selected picture to move it. Arrow keys nudge (Shift = 10 px). The resize handles stay as they are.
- Clicking an arrow, text or other annotation in the Image tab selects it too, so Rotate and Flip (ticket 9.03) can act on it.
- Clicking empty canvas clears the selection.

**Ticket 9.03: Rotate and Flip act on what is selected**
- **Picture selected:** only that picture turns or mirrors, in place around its own centre. Its pixels stay sharp. Nothing is flattened.
- **Annotation selected** (arrow, line, pen, shape, blur, highlight, text, callout, step number, stamp): only that annotation turns or mirrors around its own centre. Text turns sideways and stays editable.
- **Several selected** (Shift-click or drag a box): each one turns on its own. **Grouped items** turn together as one unit.
- **Nothing selected:** the whole canvas turns (width and height swap), and every picture and annotation stays a separate object.
- New **Group / Ungroup** (Ctrl+G / Ctrl+Shift+G, and in the right-click menu). Grouped items select, move, rotate and flip as one.

**Ticket 9.04: Crop keeps objects separate**
- Crop cuts the canvas to the box. Pictures that cross the edge are trimmed at the edge, objects fully outside are removed, and everything inside stays a separate, editable object. Nothing is flattened. Undo restores everything.

**Ticket 9.05: Layer buttons in the Image tab**
- A **Layers** row: Bring forward one, Send back one, Bring to front, Send to back.
- **Flatten selected:** merges only the selected items into one picture (for example two pictures and an arrow become one picture). **Flatten all** stays as it is now.
- Same items in the right-click menu. Shortcuts: Ctrl+] forward, Ctrl+[ back, Ctrl+Shift+] front, Ctrl+Shift+[ back of all.

**Ticket 9.06: Tools work on what you see**
- **Blur** and **Magnify** use everything underneath them on screen (all pictures and annotations below), not the base layer. They stay editable: move the blur box and it blurs whatever is under its new spot.
- **Grab Text** reads what's on screen inside your box.
- **Fill, Erase, Selection (lift a piece), Simplify, Magic Cut** work on the **top picture under the pointer**. If there's no picture there, they work on the base layer as before.
- The "Press Flatten first" warning from 8.13 is removed.

**Ticket 9.07: Check every feature**
- Test every tool, menu item, tab and Save type in the running app, using real clicks on a **copy** of your library (from `Saveit-library-backup-before-8.14.0`), never the real one.
- Fix whatever is broken and list each item as tested OK, fixed, or not tested.
- Then make a new library backup, install 9.0.0 and write the change notes.

## Decisions (2026-10-16)

1. After the first save, **Save writes over the same file** without asking. Save as… picks a new type or place.
2. Text, callouts, step numbers and stamps **really rotate** (sideways, still editable).
3. Layers: **buttons only** for now. A Layers list can come later.
