# Saveit complete-video walkthrough — 10.3.3

October 21, 2026. Completed a real desktop recording-to-export workflow, fixed annotation and timeline issues found along the way, and installed the verified update. Your existing library and settings were preserved.

## The video made during the review

1. Opened Video mode, chose Region, dragged the recording area in the real region picker and pressed Record.
2. Used the actual recording bar to pause, resume and stop. Recorded approximately 8.35 seconds of active screen content in a controlled tutorial window.
3. Removed the first 0.5 seconds, cut another 0.5 seconds from the middle, and split a later clip.
4. Drew an arrow, changed its colour and width, moved it, resized its endpoint, and set when it appears.
5. Added text, edited its wording and size, changed its colour and timing, duplicated it and undid the duplicate.
6. Added a numbered step, a caption and an audio file. Used timeline zoom/Fit and preview playback.
7. Renamed the project, allowed autosave, reloaded the application and reopened the project through Recent. Confirmed the annotations and edited text remained saved.
8. Used Export file to save both MP4 and WebM. Independently decoded both complete files and inspected frames with the annotations.

The delivered demo is the actual exported result. It contains a synthetic test tone as its audio track; microphone, system audio and webcam were disabled for this controlled walkthrough. This was an approximately seven-second edited video, not another long-duration recording test.

## What was fixed

| Problem reproduced | Result in 10.3.3 |
| --- | --- |
| Changing annotation colour or width could update the preview without updating the saved project. | Both changes schedule autosave immediately. The checks read the stored project, rather than trusting the preview. |
| The colour/width controls could show a previous tool's settings after selecting an annotation. | The selected item's own style is displayed. |
| Existing on-screen text had no direct editing control. | Added editable text and text size to the selected-item panel, with autosave and Undo/Redo. Enter finishes a text edit. |
| New annotations near the end could continue beyond the visible timeline. | Default ranges fit inside the project duration. Captions, zooms and effects use the same bounded creation range. Adding an annotation at the exact end moves the preview back to its visible range. |
| Moving an annotation to the right could place its end outside the project and make it hard to reach. | Moves and edge trims keep timed-item ends inside the project. Legacy out-of-range items are constrained when the user moves or trims them. |
| Typing annotation/caption times could produce ranges beyond the project. | Those edits stay within the project and retain a positive duration. |
| Caption typing did not request a save until leaving the field. | Caption text saves while the field remains focused. |

Colour/text edit sessions create a single Undo step, including colour changes supplied through keyboard-style input events. Width and text-size changes have their own Undo steps. The changes do not replace the recording or export engines.

## Verification

- Six original annotation-editing cases failed against 10.3.2, establishing the failures before the repair. All six now pass.
- Two additional focused cases pass: saving caption text while focused with bounded typed times, and creating zoom/effect ranges at the end of the project.
- Existing video suite: **41/41 passed**, including export frame/audio checks, independently decoded annotation timing, trims, cut, Undo, playback, speed, keyboard use and accessibility.
- Editing-flow suite: **7/7 passed**, including selection-driven inspectors, snapping, Fit, file export, panel non-overlap and four window sizes.
- Complete native journey: passed on Electron 33.2.1 with Saveit 10.3.3 and a disposable profile. The final project reopened with three annotations, the caption and added audio.
- Final exports: **1280 × 720**, **220 video frames** each. MP4 contains H.264/AAC and measures **7.360 seconds**. WebM contains VP9/Opus and measures **7.348 seconds**. Both fully decode without errors and retain their audio streams.
- Decoded frames were visually inspected to confirm the moved/resized arrow, edited text, caption and step marker appear in the actual export. The inspected output contains no selection handles.
- Node syntax/version/line-ending/stitch checks and Git whitespace checks passed.

The native test uses the actual region picker, recording bar, editing controls, Recent item and format dialog. Read-only project/database observations verify the result. Colour values are supplied directly to the HTML colour control's input/change events; the operating system's colour-picker interaction itself is not tested. The save dialog returns an automated test destination, while Saveit writes the real files.

## Installed result and scope

Installed and reopened **10.3.3**. All **58 application files** were verified, and **111 profile files** were backed up before updating. Existing library and settings were retained.

The demo and validation evidence accompany this review. This pass does not establish every webcam/microphone/system-audio combination, multi-hour project, disk failure or external-player compatibility scenario. The earlier short/medium/long export review remains separate evidence. No public release or main-branch update was requested.
