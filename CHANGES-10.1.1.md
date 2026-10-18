# Saveit 10.1.1 — WebM videos show their length

From the second company review (B10). WebM videos that Saveit saved had no length stored in the file (a video checked with ffprobe read 0.00 s), so players couldn't show how long it was and seeking was unreliable. The MP4 of the same recording was fine.

- **New recordings** are stored with their length written into the WebM, measured from when you pressed Record to when you stopped, with any time you paused left out.
- **Videos exported from the editor** (Export, or Save after editing) get their WebM length from the timeline.
- **Older recordings** that were made without a length get one when you save them: Saveit measures the video, writes the length into the saved file, and your original stays as it was.
- The fix adds 11 bytes to the file header and doesn't re-encode anything. A file that already has a length, or one that isn't laid out the way the browser writes WebM, is left untouched.

Tests: four checks in `tests/review2-tests.cjs` (10 now), using real WebM files from the browser: the length is written and plays back with seeking, older files are measured and patched once, an editor export has its length, and a recording with a pause is stored with the right length. All other suites pass.
