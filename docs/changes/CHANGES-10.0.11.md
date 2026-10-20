# Saveit 10.0.11 — Video and Audio screens match the rest

From the 9.9.4 review's consistency notes, limited to what was really there:

- **Video:** the toolbar tools that don't apply to a video are now greyed out, with "(works on images, not on a video)" in their tooltip, instead of answering a click with a message. They are Magic Cut, Callout, Pen, Spotlight, Magnify, Fill, Erase, Cut out, Simplify, Crop and Grab Text. Arrow, Rectangle, Ellipse, Line, Highlight, Text, Step, Stamp, Blur and Move / Select still work on a video. Opening an image turns everything back on.
- **The Zoom box is hidden in Video and Audio,** where it was blank and did nothing.
- Fixed while testing: after the Audio screen, opening a video could leave the tools enabled until the next click.

Checked and left as it is:
- **Audio** already hides the image toolbar (the review looked at an older state).
- The audio screen's own undo and redo arrows stay next to the top-bar ones, which work for audio and video since 10.0.3.
- Button wording (Save audio…, Delete / Ripple delete, Reset / Restore) is unchanged: renaming it across three screens would change many labels at once, so it is better done with your say on the exact words.

Tests: one new check in `tests/review103-tests.cjs` (8 now). All other suites pass.
