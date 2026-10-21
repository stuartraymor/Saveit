# Saveit 10.3.5: hands-on timeline review

Installed locally on October 21, 2026. The installer verified 58 application files, backed up 111 profile files and reopened Saveit. Existing library/settings were preserved. No public release or main update.

## Fixes found through real UI operation

- **Clips would not reliably snap to the start or neighbouring clips.** Dragging left a small gap even with Snap on: the calculation treated an unsnapped opposite edge as a better match. It now chooses actual snap candidates from both edges. Tests cover zero, leading/trailing edges, zoom, Snap off and Alt bypass. A yellow guide shows the snap time.
- **Dragging toward off-screen clips stopped at the visible timeline edge.** Zoomed timelines now scroll horizontally while the pointer is held near either side. Targets and scale stay fixed during the drag; cancellation or loss of capture finishes it cleanly.
- **Seeking cleared the selected effect or annotation.** Clicking the time ruler now preserves the selection, so Start here / End here remain available after positioning the playhead. Clicking blank track space still clears the selection.
- **Changing drawing tools could edit the previous annotation.** Selecting another drawing tool now clears the previous annotation selection, allowing a new shape over existing content. Select continues to select/edit objects.
- **Drawing Blur could stop editor updates.** The drawing overlay passed a size-only object to drawImage. It now provides a reusable picture canvas; live drawing and edited exports pass without renderer errors.
- **Crop naming/instructions were ambiguous.** Stop crop is now Apply crop. Instructions explain edge/corner handles, moving the box, Apply and Cancel. Delete tooltips describe the selected item.

The snapping baseline follows the familiar clip-edge/marker/playhead alignment documented in [Adobe Premiere's snapping guide](https://helpx.adobe.com/premiere/desktop/edit-projects/change-clip-sequence/snap-clips.html). Saveit's controls and implementation remain its own.

## Verification

| Checks | Result |
|---|---:|
| Native Electron UI journey | 26/26 |
| Video editor regression | 42/42 |
| User flow and responsive layout | 7/7 |
| Grouped timeline controls | 5/5 |
| Node checks and diff whitespace | Passed |

The native journey used real buttons, fields, pointer drags and save controls in an isolated profile. Read-only injected getters observed state. Native window/UIA evidence records the exact review process, viewport and DPI.

Exercised Split, Duplicate, both Delete modes, Undo/Redo/Reset, every range action, transport and looping, zoom/Fit, hide/show, crop Apply/Cancel/Reset, all 14 transitions, all 12 visual effects, 42 layout/background preset buttons, webcam placement, audio import/volume/mute/fades, master sound preset/reset, captions, all supported drawing tools including Text/Select, and annotation timing/duplication/removal. Inventoried visible buttons in all eight video settings tabs.

An edited project with clip movement, step and Blur annotations exported as MP4, WebM and GIF; all three independently decoded in FFmpeg and had the expected two-second duration. Save copy to Library also completed. The video regression verifies frame counts, timed annotation visibility, audio continuity/pitch, 60 fps, CPU-load output and playback at cuts.

## Scope and limits

This iteration used a generated 12-second moving 640x360 pattern and tone for repeated UI tasks, then short edited exports. It did not repeat the prior six-minute assembly or test a new long physical screen/microphone recording. Physical device, 4K and every hardware-codec combination are outside this pass. Voice-over recording and cancellation during a long active export were not newly exercised here. No remaining failure was observed in the checks above.
