# Saveit 10.5.2

## No white flash when you click Capture on a large screen
- On a 4K screen the selection screen could still flash white (or black) for a moment after **Capture**: Windows shows a newly opened full-screen window blank for a few frames before its page is drawn.
- The selection window is now see-through until the frozen screen is drawn into it, so those first frames show your real screen, which looks the same. The window-opening animation stays off.
- The frozen screen is always the sharp full-resolution picture, so text doesn't go soft and then sharp as the selection screen opens.

## Capture responds much faster
- The screen now starts dimming as soon as the editor or widget is out of the way, about 0.1–0.17 s after you click (it was about 0.25–0.5 s).
- The selection window is put up invisibly while the editor hides. It is left out of screenshots, so it can dim the screen while the screenshot is still being taken underneath it. The frozen picture slips in under the dimming a moment later. It looks identical, because it is the same screen.
- You can start dragging, or press Esc or right-click to cancel, as soon as the dimming appears.
- The screenshot's pixels are reused instead of copied again.
