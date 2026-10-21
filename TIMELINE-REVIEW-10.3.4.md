# Saveit 10.3.4 timeline and export review

Installed locally on October 21, 2026. Library/settings backed up; 58 application files verified and 111 profile files backed up. Development branch only; no public release or main update.

## Changes

- Grouped Split, Delete, Delete (keep gap), Add videos and Duplicate clip directly above the timeline. Delete closes a gap when that operation is available; Delete (keep gap) preserves timing.
- Added the range actions in that same group: Trim beginning, Trim end, Remove middle and Keep middle. Keep middle replaces Keep selected part and removes both ends outside In/Out. Remove middle removes the In/Out range.
- Moved In/Out directly below Undo, Redo and Reset edits, above the timeline. Removed the duplicate range/trim controls from the sidebar.
- Highlight and other annotation tools hide clip/range action rows while keeping annotation history available. Hide timeline hides the full editing group, range fields, selection status, zoom and Snap. Playback remains available.
- Renamed Clip to Crop. Removed duplicate visible history controls and redundant start-playback control; Play from start remains.
- Fixed lower video, caption and annotation tracks becoming unreachable: timeline tracks now scroll vertically.
- Fixed a preview buffering path that could flash black by retaining the last decoded picture. A deterministic regression reproduces decoder readiness loss and verifies the retained image.

## Validation

- All Node checks passed; video regression 42/42, user-flow checks 7/7 and timeline-control checks 5/5 passed.
- Assembled three independent two-minute source files through the native application's import/Add videos flow. Trimmed both ends, tested Keep middle and Undo, and removed a range across a clip boundary. Final duration: 5:40.
- Added step, text and highlight annotations plus a caption spanning a cut. Checked duplicate/Undo, timeline scrolling, zoom/Fit, autosave and reopening the saved project.
- Exported MP4 (H.264/AAC) and WebM (VP9/Opus) through the real export controls and save flow. Both files fully decoded and contained 10,200 video frames. Durations were 340.011 and 340.000 seconds.
- Independently sampled audio in all three clips: expected 440, 660 and 880 Hz tones were present. Samples immediately before and after both source changes contained the expected source colour, without black cut frames.
- Reviewed the control layout and tested responsive layouts from 850x700 to 1440x1000.

## Limits

This longer test used controlled 640x360 colour scenes and tones imported into the editor, rather than a fresh six-minute screen recording or a high-motion/4K performance benchmark. It verifies assembly, editing, annotations, persistence and export for this project. Recording coverage remains in the existing regression work; this iteration does not claim a new long recording test.
