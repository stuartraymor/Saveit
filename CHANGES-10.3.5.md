# Saveit 10.3.5

- Fixed clip-body snapping: an unsnapped opposite edge no longer overrides an edge that found a snap target. Clips align at zero, neighbouring edges, playhead and range markers, with a visible snap guide.
- Kept snap targets and pixel tolerance stable during a drag, including zoomed timelines and edge trimming. Snap off and Alt bypass remain available.
- Added horizontal edge scrolling while dragging clips or range markers on a zoomed timeline. Pointer cancellation or loss of capture now finishes the drag cleanly.
- Ruler seeking preserves the selected item so annotation/effect Start here and End here controls remain available.
- Switching drawing tools clears the previous annotation selection, avoiding accidental edits to the previous object.
- Fixed Blur drawing preview passing a non-image placeholder to drawImage, which could stop editor updates. Preview now uses a reusable picture canvas.
- Renamed Stop crop to Apply crop and clarified handle-based cropping. Delete tooltips now describe the selected item.
- Added a native Electron journey covering real pointer drags, all timeline action buttons, transitions, effects, layouts, audio, captions, annotations and MP4/WebM/GIF output.

No public release or main-branch update was requested.
