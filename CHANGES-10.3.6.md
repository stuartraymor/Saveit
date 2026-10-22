# Saveit 10.3.6

- Clips can be dragged by their body past the right edge and snapped exactly to the video's previous end. Captured-pointer movement now preserves the grab offset instead of clamping the pointer to the last timeline time.
- Tiny pointer movements below two CSS pixels select an item without creating an edit or consuming an Undo step.
- Reset edits restores the source dimensions, default layout and source frame-rate setting as well as timeline, annotations and sound edits. Undo restores the previous state.
- Deleting the last video clip remains empty after saving and reopening. The initial project creation already supplies a first clip; reopening no longer silently recreates a deleted clip. Reset edits can recover the original recording.
- Added native end-of-video snapping, slow trimming, Reset/Undo, pointer-jitter and empty-project persistence checks.
- Added voice-over start/stop/resource-release/Undo/Redo and active GIF cancellation/retry checks. The real desktop recording journey now waits for decoded seeks before observing preview state.

See SHIPMENT-REVIEW-10.3.6.md for validation and remaining coverage limits. No public release or main update was requested.
