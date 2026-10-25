# Saveit 10.3.8

- Preserve odd physical window widths and heights in screenshots, including the last row and column. Windows captures now use a still image requested at the exact DWM frame size instead of a video frame rounded to even dimensions.
- Retry if the window is resized during capture; report unavailable windows or inconsistent dimensions without silently resizing the image.
- Add native regressions for all odd/even dimension combinations, marked outer edges and one-pixel stripes, plus resize-race and invalid-window checks.
