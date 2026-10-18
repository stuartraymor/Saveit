# Saveit 10.1.7

Video editor fixes from `VIDEO-EDITOR-REVIEW-10.1.6.md` (B numbers) and the company's 10.1.4 video editor review (V/VU numbers). New test suite: `tests/video-editor-tests.cjs`.

- **Missing media is kept, not deleted (B5).** When a clip's video or audio file can't be found, its clips are kept offline in the project instead of being removed. Before, the next edit deleted them for good. The Clip tab lists offline media with a **Relink…** button; picking the file puts the clips back where they were.
- **Changing Size keeps on-screen items in place (B6).** Arrows, text, boxes, blur areas and zoom boxes are scaled and fitted into the new frame, the same way the video is, including line widths and text size.
- **A new Size is saved (V2).** Changing only the Whole video Size now makes Save render the video at that size. Before, it saved an untouched copy at the old size.
- **Typed crop works without selecting the clip (V4).** With nothing selected, the Clip tab edits the clip under the playhead and says so ("at the playhead"). Before, the boxes were greyed out and typed values were ignored.
- **Play plays on (B10).** Play and Space play from the playhead to the end, even when a clip is selected. The new **Play selection** button (Shift+Space) plays only the selected item or the In–Out range, and Loop applies to it.
- **Undo keeps your place (B19).** Undo and Redo keep the selected clip or item and the In–Out range.
- **Duplicated on-screen items get unique ids (B21).**
- **Tooltips and field names (VU1, VU3).** Tooltips added to Add videos…, Reset, Add caption, the eight editor tabs and the four Layout tabs. Clear accessible names added to the In/Out, crop, zoom, effect, on-screen item and caption fields.
- Not reproduced in the test copy: V5 (I/O keys after clicking the timeline) and V7 (Export-tab quality changing the top-bar Save size). Both are checked by the new suite and pass.
- Still open, planned next: offline frame-by-frame export (B1/V1: dropped frames and silence in edited saves), the playback engine (B2–B4, B14, B16, B22), the timeline (B7, B9, B17, B20), copy/cut/paste and a right-click menu on timeline items, and Audio studio effects for video sound. The suite has todo checks for several of these.
