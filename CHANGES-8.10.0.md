# Saveit 8.10.0 — multi-picture canvas, step 3: comparing size and placement

- Once a capture has added pictures, the **canvas edge is always outlined** (thin dashed line), so you can see the fixed boundary.
- The **selected picture shows its size and position** in a small label ("800 × 600 at 242, 70") that updates as you move or resize it.
- **Arrow keys nudge** the selected picture (Shift moves further); X / Y / Width / Height boxes, Duplicate, To front / To back already worked.
- Pictures can go past the canvas edge and show there while the Image tab is open; saved and copied images are clipped to the canvas.

**Tested:** selecting a picture by click showed the label; arrow keys moved it 2 px right and 10 px down (label updated). No errors.
**Limits:** the X/Y boxes in the side panel refresh when you re-select (existing behaviour after a nudge). Past-the-edge display happens in the Image tab only.
