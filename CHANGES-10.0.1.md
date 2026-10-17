# Saveit 10.0.1 — Simplify size equation

- Simplify now starts with a size equation: **Starting pixels × Percent = Ending pixels**. Type a percent (50, 75, 72, any decimal) or the ending number of pixels (800,000, 10,000…) and the other box, the width and the height all update. Percent is of the total pixels, so 50% keeps half of them. The result is the nearest whole-pixel size that keeps the proportions.
- The **Size preset** menu now goes from 320 × 240 up through 720p, 1080p, 1440p, 4K, 5K and 8K to 8000 × 8000 (64 MP). 64 megapixels is the largest picture the editor can hold, so nothing larger is offered.
- The four buttons at the top (Half size, Fewer colours, Sketch, Reset) are now one **Quick style** menu. Half size is just 50% in the equation.
- Simplify still works on the whole canvas, as before. Everything else (smoothing, colours, outline, file-size estimate, undo) is unchanged.
- Tests: new equation test; the browser polish suite passes 35 of 35.
