# Saveit 10.3.11 validation

Tested on 2026-11-18 on Windows 11 with two monitors (one at 200%).

All app runs used disposable profiles and a disposable runtime copy. The owner's library was not touched. This builds on VALIDATION-10.3.10.md.

## New real-app checks (real Electron, real mouse and keyboard input)

### native-bar-parity: 49/49 PASS
- In Image, Video and Audio, every shared control of the widget and the editor's capture bar was compared: shown or hidden, size, and position relative to the Capture button.
- All match within 2 px.
- Screenshots of both bars per mode are in the evidence folder.

### native-workflow-paste-layer: 16/16 PASS
1. Take two screenshots.
2. Right-click the first in Recent and choose Copy. The clipboard holds it at full size, and the open picture does not change.
3. Paste on the open picture with right-click > Paste. It arrives as a picture layer at real size, inside the picture, and selected.
4. Drag it. It moves.
5. Paste again with Ctrl+V. It goes onto the same picture, offset from the first copy, and nothing is added to the library.
6. Ctrl+Z, then Ctrl+Y.
7. Ctrl+Shift+C copies the combined picture at the second screenshot's size. The first screenshot is unchanged.

### native-workflow-everyday: 17/17 PASS
- Screenshot, then Arrow, Text ("Click here") and Step (numbered 1, 2, 3).
- Ctrl+Z, then the Redo button.
- Crop + Enter.
- Save PNG: the file written has the cropped size.
- Copy.
- Library opens and closes with Escape.
- Widget button: the editor hides. Capturing from the widget adds the screenshot and brings the editor back.
- Check for Updates shows the correct status.
- No page errors.

### native-video-journey: PASS, three runs in a row
- It runs the real region picker, records, pauses and resumes, stops, edits, and exports to MP4 and WebM.
- Before this version, it failed:
  - first on the recorded size (718 instead of 720);
  - then on the recording start (12.4 s, or never on a still screen).

## Other native and browser checks
- native-gui-10310: 14/14 PASS. It now expects Copy to clipboard to be hidden for Video in the editor too.
- native-window-capture: 6/6 PASS.
- native-widget-hide1022: 16/16 PASS.
- native-record-controls: PASS.
- native-live-scroll A–G: 7/7 PASS.
- Node tests: all pass.

Browser suites that passed:
- rotate 24
- polish 34
- audio94 23
- audio-export 6
- audio113 16
- stepguide 10
- review103 8
- review2 11
- update-ui 13
- video-editor 41
- video-annotation 8
- video-audio-gaps 7
- video-flow 8
- video-timeline-controls 5
- flatten 5
- voice-effects 12

These fail on 10.3.9 too, with the same checks:
- layer-media: 9 failures
- audio114: 1 failure
- audio115: 5 failures
- audio116: 1 failure

## Tried and reverted
- I showed the top Undo/Redo for videos so the top-right buttons would not shift.
- video-timeline-controls showed that the video editor intentionally has exactly one Undo, beside the timeline.
- I kept that existing design and reverted the change.

## Measurements
- Recording start after OK on the selected area:
  - Before: 7–12 s in the journey. Compose waited 6.9 s for a second screen frame.
  - Now: about 0.7 s. Compose takes 1 ms.
- Recording size on the 200% screen:
  - Windows reports the screen as 801 points tall, and the stream is 1600 px.
  - A 640 × 360 selection now records at 1280 × 720 (it was 1280 × 718).
