# Saveit 10.5.5

## Edited videos are saved with their edits from the Library
- **Library > Save…** and **Move out…** wrote a video as it was recorded when you chose WebM (and MP4 for some imported videos), without your trims, captions or other edits. **Move out…** then removed the item from the Library, edits included.
- They now save the video as it looks and sounds in the video editor, in MP4 or WebM. A message shows while an edited video is being made, because that takes longer than copying a file.
- A recording that was never changed is still copied as it is, with no waiting.
- If an edited video cannot be made as WebM on this computer, it is skipped (and stays in the Library, counted as skipped) instead of being written under the wrong file type.

## For developers
- `tools/make-release.js` builds the release commit on `main` in each file's own line-ending style.
- New test: `tests/library-video-save-tests.cjs` (6 checks).
