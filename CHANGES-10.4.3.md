# Saveit 10.4.3

A hands-on check of the whole app: every tool, panel and dialog was opened and timed, and full jobs were done from start to finish (open, edit, save, export, close, reopen) for pictures, videos, audio, step guides and the Library. These are the problems it found, and the fixes.

## Sharper when you zoom in (Magic Cut box and its label)
When you drew a Magic Cut box and zoomed in, the box, its handles and the label above it ("256 × 114 at 448, 266 · layer 1 of 7") went blurry. The same happened to arrows, text and every other mark. Saveit drew the picture at its own size and then stretched it to fit the zoom and the Windows display scale.
- Saveit now draws at the size you see, so outlines, handles, labels, arrows and text stay sharp when zoomed in.
- The screenshot itself still gets softer above 100%. That is the real picture being enlarged, the same as in any picture viewer.
- Drawing and moving things is as fast as before (measured on 1080p and 4K pictures at 100%, 200% and 400%).

## Undo delete really brings items back
In the Library, **Delete** followed by **Undo delete** said "Restored", but items you had not opened since starting Saveit were lost when Saveit closed ("Save failed… Capture data is missing"). In a test, 6 of 7 items were gone after a restart.
- Saveit now keeps the deleted items' saved data until Undo delete can no longer bring them back. After Undo, all 7 came back, survived a restart and opened with their pictures.

## Thumbnails show the picture
- After a restart, big screenshots (for example 4K) could show a blank white thumbnail with only the arrows on it, in Recent and in the Library. The thumbnail was drawn before the screenshot had finished loading. It is now redrawn when the picture is ready, and the Library's copy is corrected.
- A new step guide had an empty thumbnail in Recent and the Library until you edited it. It now shows the first step.

## Videos open faster
When a video opened, the preview stayed black for about 2½ seconds, and the first click on the timeline took more than a second. Saveit asked the video to jump to a time before the video file was ready, then waited for its 2½-second safety limit.
- The first picture now shows straight away. The first timeline click takes about 0.08 s instead of 1.2 s.

## M4A audio saves in a moment
Saving audio as M4A used to take as long as the audio itself (20 seconds for 20 seconds of sound, an hour for an hour; with Match loudness turned on, up to three times longer). It also cut off the last twentieth of a second.
- M4A now uses the same fast encoder as video saving: 20 seconds of audio saves in about 0.3 s instead of 20 s. The sound is identical in quality and timing, and nothing is cut off at the end.
- If a computer can't use the fast encoder, Saveit uses the old way automatically.

## Checked and working well (no change needed)
- Every tool and panel responds within one or two screen refreshes. Switching Image, Video and Audio takes about 0.03 s. The Library opens in 0.03–0.06 s with 150 items, and Saveit starts in about 1.1 s with 150 items.
- A 4K screenshot: opens in 0.6 s, undo and redo are instant, and Save as PNG, JPG, PDF, Word, BMP and Saveit takes about 0.5 s each. Everything was still there after a restart.
- Video: trim, remove middle, split, undo and redo, annotations, autosave, and Save as MP4 and WebM (checked with ffprobe: correct length, frame count and sound).
- Audio: open, play, split, effects, undo and redo, Save as WAV and MP3, reopen.
- Step guides: made from 6 Library pictures; Word, PDF, PowerPoint, PNG, JPG and Saveit files saved in 0.6–1.3 s; reopened from Recent and from the .saveit file.

## Not changed, and why
- Screen capture, recording, the widget and Grab Text on the screen were not tested this time. Those tests use the real screen and mouse, and the screens were in use. The browser test suites and node tests were run.
- On a small screen (1280 × 720) the tool ribbon needs a scroll bar to reach Layers, and the video preview is small. This is a layout question for the owner, so it was left as it is.
