# Saveit 10.3.6: shipment preparation review

Installed and reopened locally on October 21, 2026. Application files verified: 58. Profile files backed up: 109. Changes remain on the development branch; no public release or main update.

## Four fixes from normal editing tasks

| Observed hang-up | Fixed behaviour |
|---|---|
| Grabbing a clip body and moving it to the video's end stopped one grab-offset short. A clip intended to start at 12 seconds stopped at 11 seconds. | Captured pointer movement can extend beyond the ruler's right edge. The clip keeps its grab offset and snaps its leading edge exactly to 12 seconds. |
| A one-pixel hand movement created a no-op edit and consumed Undo. | Movements below two CSS pixels select the item without editing. The next Undo reverses the previous real edit. |
| Reset edits left changed layout, video size and frame rate active. | Reset restores source dimensions, plain layout and Same as recording frame rate, along with timeline/annotation/sound edits. Undo restores the prior settings. |
| Deleting the final video clip looked correct until reopening, when it silently returned. | The empty saved timeline stays empty. Reset recovers the original recording and Undo can return to the empty state. |

End-of-video tests also verified moving an annotation and dragging its end handle to the exact video end. Slow small trim movements, snapping between clip edges, zoomed scrolling, Snap off and Alt bypass passed.

## Completed verification

| Suite | Result |
|---|---:|
| Native Electron editing tasks | 32/32 |
| Video editor regression | 42/42 |
| User flows, voice-over, cancellation and responsive layout | 9/9 |
| Grouped timeline controls | 5/5 |
| Node checks and diff whitespace | Passed |

These 88 checks cover the tested video controls and workflows. The native suite uses actual buttons, fields, pointer drags and save dialogs in a disposable profile; read-only getters observe state. It visits all eight video settings tabs and exercises transitions, visual effects, layouts, audio import, captions, drawing tools, undo/redo, crop, range actions, transport and export. Native window/UIA evidence records the review process and display scaling.

## Fresh recording through export

A separate native run used the actual region picker and recording bar, recorded an owned on-screen training page for 8.275 seconds with Pause/Resume/Stop, trimmed both a beginning and a middle range, split clips, moved/resized/restyled an arrow, edited text, added a step and caption, added test narration, previewed, renamed and reopened the saved project.

The picker selected 640x360 desktop units at 200% scaling, producing the expected 1280x720 video. Final edited MP4 and WebM each contained 218 frames. Their durations were 7.296000 s and 7.275509 s. FFmpeg independently decoded both files. MP4/WebM/GIF editing exports also passed in the native control suite.

Voice-over start/stop, microphone release and Undo/Redo were exercised through the real recording controls with a controlled synthetic microphone in the browser harness. Cancelling an active roughly 28-second GIF job preserved the project, wrote no partial output, and allowed a subsequent valid GIF export. This replaces the untested voice-over/cancellation coverage noted in the previous review.

## Shipment scope

No unresolved failure remains in the checks above. This is a video/recording workflow pass, not certification of every feature or device. Physical microphone/webcam quality, multiple-display/DPI combinations, long high-resolution capture, clean-machine installation/updating, and the complete image/audio-only workflows were not qualified by this pass. The earlier longer multi-clip export test was not repeated here. Public release packaging, signing and publication remain outside this iteration.
