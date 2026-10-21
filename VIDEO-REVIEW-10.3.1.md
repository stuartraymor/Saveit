# Saveit video review — 10.3.1

Reviewed October 21, 2026. Four confirmed editor defects were fixed and installed locally as Saveit 10.3.1. The application was reopened. The update verified all 58 application files and backed up 109 profile files; your library and settings were retained.

## What was fixed

1. **Step numbers and stamps could disappear after reopening a project.** They appeared immediately, but placing them did not schedule a project save. They now save without another edit. Verified by reading the saved project after an actual placement.
2. **The last clip jumped too far while dragging.** Its new position extended the timeline, changing the pixel-to-time conversion during the same drag. The scale now stays fixed until release. A 100-pixel drag reaches the expected time.
3. **Arrow keys moved 0.1 seconds instead of one frame.** Left/Right now use the project frame rate; Shift still moves one second.
4. **Ripple delete left spanning audio out of sync.** Closing the gap now removes the same time range from spanning audio, captions, annotations and other timed items. The test confirms that deleting the first 1.5 seconds makes the remaining audio start at source time 1.5.

## Recording and export checks

| Recording | MP4 | WebM | Encoded frames |
| --- | --- | --- | --- |
| Short: approximately 2 seconds | Passed picture/frame/duration checks | Passed picture/frame/duration checks | 60 or 61, matching the measured duration at 30 fps |
| Medium: approximately 30 seconds | Passed picture/frame/duration checks | Passed picture/frame/duration checks | 901 in each |
| Longer: approximately 3 minutes | Passed picture/frame/duration checks | Passed picture/frame/duration checks | 5,400 in each |

These synthetic recordings used Saveit's actual recording function, a moving 640 × 360 canvas, a 440 Hz test tone, and Pause/Resume. Every edited export contained an arrow, box, circle, line, highlight, text, step number, stamp, blur and a caption. A decoded sample frame was visually inspected. Independent FFmpeg decoding confirmed that a timed box was absent before its start, present during its range, and absent after its end in both MP4 and WebM.

The initial three-minute MP4 measured 180.032 seconds and exported in about 24.7 seconds. WebM measured 180.016 seconds and exported in about 23.4 seconds. These are measurements on this machine and test scene, not general performance guarantees.

A separate real Electron desktop test recorded a controlled region, used the real recording bar's Pause/Resume/Stop buttons, and saved MP4 and WebM through the actual Save dialog. A 640 × 360 logical region correctly produced 1280 × 720 pixels on this 200% scale display. The recording contained about 6.2 seconds of active recording, excluding a two-second pause. Microphone, webcam and system sound were disabled in that desktop test. A second native test imported a clip, cut out a section, and saved both edited formats with sound.

## Other results

- All 37 existing video-suite checks passed after the fixes, including three checks previously marked as deferred.
- Four added checks passed separately: saving step/stamp placement, and independently decoded MP4/WebM annotation timing.
- All seven audio-gap regression checks passed, including edited, unedited, library-copy and bulk-export paths.
- Playback around cuts passed under normal conditions and simulated CPU load. The existing short-run sync checks measured only a few milliseconds of picture/clock drift.
- 2× speed preserved the test tone's pitch; 60 fps export produced the expected frame count.
- In/Out trimming, cut, Undo, resize, offline-media preservation/relink, crop, keyboard playback and accessibility checks passed.
- Node parsing, version, line-ending and stitch checks passed. Git diff whitespace checks passed.

The initial In/Out test failure came from assuming that a nominal three-second recording was exactly three seconds. The test now uses its measured duration. A long-run test initially exhausted Node memory while transferring a video as a JSON number array; the test now transfers base64 and preserves original recordings. Neither test-runner issue was counted as a product fix.

## Audio follow-up

The first three-minute synthetic-tone run contained approximately 0.51 seconds of trailing silence in both edited formats. Its original recording was not preserved, so that run alone cannot establish whether recording or export caused the missing tone.

The repeated test waits for the synthetic AudioContext to start before recording and preserves both original formats. Its original WebM decodes to a full 180.000 seconds of audio (the file measures 180.015 seconds); its original AAC copy decodes to 179.968 seconds. Both exports from that preserved WebM passed independent audio decoding with no silence interval of 30 ms or longer at a -40 dB threshold; each contained all 5,400 expected video frames. The repeated MP4 export took about 23.1 seconds and WebM about 23.6 seconds. The permanent test now waits for audio startup and preserves originals. This is a test-source sensitivity finding, not a claimed production audio fix. Real microphone and loopback recordings still need longer listening/sync checks.

## Limits and remaining work

This is not a claim that every recording scenario is fully verified. The longest real-time recording in this review was three minutes. Multi-hour recordings, 1080p/4K recording under sustained load, webcam combinations, real microphone/system-audio mixing, device loss, disk-full recovery, cancellation during a long export, and playback in every external player remain unverified. Only a representative timed box received an independent pixel-level timing assertion; all nine supported drawing tools were included in the sample exports, with visual sampling rather than exhaustive per-tool image comparisons.

The four fixes are installed locally. No GitHub release was published. The repository's AGENTS.md says: “After installation, ask the user whether to release that version on GitHub. Do not publish a GitHub release or update main without the user's approval.”
