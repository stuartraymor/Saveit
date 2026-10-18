# Saveit 10.1.6 — Video editor review

**Scope.** The company review you pasted covers the **audio** editor only. This document covers the **video** editor (`app/vedit2.js`, 757 lines, and its wiring in `app/index.html`).

The video editor has not changed since **10.1.1**. Versions 10.1.3–10.1.6 changed only audio. So 10.1.6's video editor is the same one shipped in 10.1.1.

Source read: `C:\Users\stuar\Documents\Codex\2026-10-17\https-github-com-stuartraymor-saveit-blob\work\Saveit` (branch `v10-dev`, 2c040aa). It matches the installed 10.1.6.

**Method.** I read the whole editor line by line, plus how it saves, opens and exports. I have **not** tested these bugs in the running app yet. Each finding has a confidence label:
- **Certain**: the code plainly does this.
- **Likely**: the code points this way, but timing or hardware decides how bad it is.
- **Check**: needs a hands-on reproduction.

There is no test suite for the video editor. Only `layer-media-tests.cjs` and a few other checks touch it. That is probably why these bugs reached users.

---

## 1. The short version

The video editor has a long list of features: transitions, zoom & pan, visual effects, layouts, captions, on-screen items and GIF. But three design choices underneath it cause most of what people describe as "buggy":

1. **Export is a real-time screen recording of the preview.** The editor plays the timeline on a canvas and records it with `MediaRecorder`. Any CPU hiccup becomes a dropped frame, a stutter or audio drift in the **saved file**. Every export also takes as long as the video.
2. **Playback keeps one `<video>` element per clip, held only loosely in sync.** Clips may drift up to **0.35 s** before being corrected with a hard jump. You see this as lip-sync errors, stutters, and black or frozen frames at cuts. It gets worse with every Split.
3. **The timeline always stretches to fit the project length.** When you drag the last clip or its end, the scale changes under the mouse, so the clip seems to run away.

Fix those three before adding features. Two smaller bugs can lose work (§2, B5 and B6). Fix those first because they are cheap.

---

## 2. Bugs and defects (ranked)

| # | Problem | Where | What the user sees | Confidence | Fix |
|---|---|---|---|---|---|
| **B1** | Export plays the edit in real time and records the canvas. The clock is the wall clock (`S.t += now - last`), frames come from a 33 ms `setTimeout`, and the video elements play freely. WebM and MP4 encoders run **at the same time**. | `vedit2.js:223-240`, `231-232` | Stutters, repeated or skipped frames and audio drift in saved videos, worse on slower PCs or long edits. A 20-minute edit takes 20+ minutes. The toast asks users to keep the window "in front". | Certain (design); Likely (how often) | Render offline, frame by frame. Seek each frame (`requestVideoFrameCallback`) or decode with WebCodecs `VideoDecoder`. Encode with `VideoEncoder`/`AudioEncoder` and a bundled MP4/WebM muxer (Electron 33 has WebCodecs). Mix audio with `OfflineAudioContext`, as the Audio studio already does. Encode only the format the user picked. |
| **B2** | A/V sync tolerance is 0.35 s. Corrections are hard `currentTime` jumps. | `vedit2.js:181`, `183` (webcam) | Voice and picture visibly out of sync, then a jump or click when corrected. | Certain | Drive everything from one master clock (the `AudioContext` time). Nudge `playbackRate` for small drift and seek only for large drift (more than about 80 ms). |
| **B3** | At a cut, the next clip's element may not be ready. `drawClip` then draws nothing (`readyState<2` returns early). Pre-seeking happens only for video clips starting within 1.5 s. | `vedit2.js:182`, `187` | A black flash or frozen frame between clips, in preview and in exports. | Likely | Keep a frame cache for the next clip, or hold the last drawn frame until the new one is ready. B1's offline export removes this from saved files. |
| **B4** | Every clip gets its own `<video>` element **and** its own audio effects chain: 8 EQ filters, a compressor, a delay and a convolver with a newly generated 1.8 s random impulse. | `vedit2.js:162-164`, `24`, `30-31` | Splitting a recording into 40 pieces creates 40 video decoders and 40 reverbs. Opening is slow, memory climbs, and Chromium may refuse more media players. Reverb sounds slightly different on every clip because each impulse is random. | Certain (design); Likely (symptoms) | Keep one element per **source**, not per clip, plus one spare for the incoming clip. Build effect chains only for clips that have effects. Share one fixed impulse. |
| **B5** | When a project opens with missing media, its clips are removed from the live project object (`e === it.edit`). The toast says they "come back if you Undo", but the undo history is empty at that point. Any later edit saves the removal. | `vedit2.js:737-738` | **Lost clips.** One accidental edit after a "media could not be found" message deletes them for good. | Certain | Keep missing clips in the project as "offline" placeholders: grey, skipped in playback, with a **Relink** option. Never filter them out of the saved project. |
| **B6** | Changing **Size** (Whole video) changes `e.W/e.H` but does not move on-screen items or zoom boxes, which are stored in project pixels. | `vedit2.js:585` | After switching 1920×1080 to 1280×720 or vertical, arrows, text, blur boxes and zoom areas are in the wrong place or off the frame. Blur boxes moving off private data is a privacy risk. | Certain | Scale `ovs` and `zooms` (and stroke widths and font sizes) by the new/old ratio. For aspect changes, fit them into the new frame. |
| **B7** | The timeline scale is always fitted to the total length (`xOf/tOf` use `D()`). `tOf` also clamps to the current end. | `vedit2.js:383`, `396`, `433` | Dragging the last clip, or its right edge, makes the whole timeline rescale under the mouse, so the clip jitters or "runs away". You also can't drag a clip past the current end in one move. | Certain | Freeze the scale for the whole drag. Give the timeline a fixed pixels-per-second scale with extra space after the end, as every professional editor does. |
| **B8** | Voice-over: the start time is read, then `MediaRecorder.start()` runs **before** `eng.play()` finishes its async seek. Input latency is not measured. Echo cancellation and noise suppression are forced on. Only the default microphone is used. | `vedit2.js:605-608` | Narration lands slightly late or early, and the offset varies per take. Voice sounds "phone-like" from browser processing. No microphone picker, no level meter, no countdown. The Audio screen has all three. | Certain (code); Likely (offset size) | Start recording after playback really starts and store the measured offset. Turn browser processing off by default. Reuse the Audio studio's recorder (device picker, meters) and cleanup tools. |
| **B9** | Ripple edits move only clips that **start** after the edit point. Audio, captions and items that **span** the point stay where they are. | Delete `505-506`, Duplicate `483`, transition length `513`, speed `580` | After a ripple delete, music or narration that crosses the cut slips out of sync with the picture. | Certain | Pick one rule and apply it everywhere. Camtasia-style: ripple only the clip's own track. Or "ripple all tracks", which splits spanning clips. Show which one is on (a toggle). |
| **B10** | The **Play** button and Space play only the current selection (selected clip, caption, item or In–Out) and then stop. | `vedit2.js:519-520`, `523` | "Playback stops by itself." This is easy to mistake for a bug, because the button label changes to "Play clip" quietly. | Certain | Space and Play play from the playhead. Add **Play selection** (Shift+Space) as a separate action. |
| **B11** | Only the **first** zoom found at a time is used (`find`). A zoom always starts and ends at the full frame. | `vedit2.js:190` | Overlapping zooms are ignored. You can't pan from one area to another while zoomed in, which is the main thing Camtasia's Zoom-n-Pan is used for. | Certain | Treat zooms as keyframes. Each zoom eases from the previous zoom's box, not from the full frame. |
| **B12** | The webcam is shown only while the original recording's clip is on screen. The `e.cam.off` sync offset has no control. In-app webcam recordings are mirrored by default. | `vedit2.js:160`, `220` | The webcam vanishes over pasted or added clips. It can't be re-synced if it drifts. Text and gestures are mirrored in the exported video. | Certain (code); Check (whether the mirror is intended) | Put the webcam on its own track in the timeline. Add an offset control. Mirror the preview only and not the export, or make mirroring a clearly labelled option. |
| **B13** | No master limiter. Clip volume goes to 300%, Boost to 300%, and the compressor adds up to 1.9× makeup gain. | `vedit2.js:36`, `317`, `352` | Distorted, clipped audio in exports. | Certain | Add a true-peak limiter on the master. Better still, route video audio through the 10.1.x Audio studio chain (§4). |
| **B14** | The whole timeline and the preview overlay are redrawn every animation frame, even when nothing changes. Items that need the frame underneath (blur, spotlight, magnify) allocate a **new full-size canvas each frame**. | `vedit2.js:726-727`, `207` | Fans spin and the UI lags when idle, worse with long projects or blur boxes. | Certain | Redraw only when something changes or during playback. Reuse one scratch canvas. |
| **B15** | Each edit (350 ms debounce) rewrites the whole Library record: original video blob, both exports and every added media blob. | `index.html:458` (`changed→persist`), `355` | Hitches after edits on large recordings, plus heavy disk writes. | Likely (needs measuring) | Store media blobs once in their own IndexedDB store, keyed by id. Save only the project JSON on edits. |
| **B16** | Scrubbing seeks every active element on each mouse move and waits up to 2.5 s for each (`seekEl`). MediaRecorder WebM has few keyframes and no cue index. | `vedit2.js:18`, `214`, `444` | Slow, laggy scrubbing on long recordings. | Likely | Limit seeks to one in flight (drop stale ones). Show timeline thumbnails while dragging. Consider remuxing recordings with cues, or using MP4. |
| **B17** | Time resolution is 0.1 s: the clock (`m:ss.s`), arrow keys and number boxes. There is no frame stepping. | `vedit2.js:6`, `716`, inputs `step=0.1` | Cuts can't be placed on an exact frame. The display has no hours for long recordings. | Certain | Use a frame-based clock (`h:mm:ss:ff`). `,`/`.` or ←/→ step one frame, Shift steps 1 s. Snap edits to frame boundaries. |
| **B18** | Export options: Full/720p/480p only, a fixed 8 Mbps bitrate, a fixed 30 fps capture stream. Saving to the Library stores **both** WebM and MP4. | `vedit2.js:229`, `232`, `342`, `702` | 60 fps recordings are saved at 30 fps. 4K can't be exported at 1080p. Library size doubles. | Certain | Presets (1080p30, 1080p60, 720p, "Same as recording"), a frame rate choice, a quality setting, and one stored format. |
| **B19** | Undo/Redo clears the selection and resets the Out point to the end. | `vedit2.js:503` | After Undo, your In–Out range and selected clip are gone. | Certain | Keep selection (by id) and In/Out across undo. |
| **B20** | Clip edge handles are 9 px circles at both ends and are hit-tested before the clip body. | `vedit2.js:424` | Short clips can't be grabbed to move them, only trimmed. You have to zoom in. | Certain | Hide or shrink handles when a clip is narrower than about 30 px. Test the body first in its middle third. |
| **B21** | Duplicated on-screen items get id `old + 1000 + count`, which can collide. | `vedit2.js:499` | Possible odd selection or undo behaviour with many duplicates. | Likely | Use `newId(e,'o')`. |
| **B22** | The keyboard handler listens on the whole document. Space/S/Delete/I/O act whenever focus isn't in a text field, including when a side-panel button has focus. | `vedit2.js:709-717` | Pressing Space on a focused button may both press it and start playback. | Check | Ignore keys when focus is on a button or select. Or move the shortcuts to the editor's own focus area. |

---

## 3. Compared with professional editors

Reference: **Camtasia** (the owner's stated model), with **Premiere Pro / DaVinci Resolve** as the professional baseline. This comparison is based on their published feature sets, not on hands-on benchmarking.

| Area | Saveit 10.1.6 | Camtasia | Premiere / Resolve | Gap |
|---|---|---|---|---|
| **Tracks** | Video lanes made automatically, one per source. Only the top clip is visible; no stacking except the webcam layout. No track lock, hide or mute. | Unlimited tracks with lock, hide and mute. Clips on upper tracks layer over lower ones. | Same, plus track targeting and patching. | **High.** No picture-in-picture, no overlays of a second recording, no image or title on top of video. |
| **Clip transform** | None. Crop and Layout presets only. | Move, scale, rotate and opacity with handles on the canvas. | Same, with keyframes. | **High.** Basic need for tutorials. |
| **Media** | "Add videos…" dialog and audio files. **No still images or title cards as clips.** | Media bin with images, library assets and title templates. | Project bin, bins, metadata. | **High** (images and titles); Medium (bin). |
| **Timeline look** | Coloured bars with a waveform. No thumbnails. Fit-to-length scale (B7). | Thumbnails, waveforms, markers, fixed scale. | Same, plus timecode ruler and track heights. | Medium |
| **Editing tools** | Split, ripple delete, delete keep gap, In/Out cut or trim, duplicate, overlap for transitions. | Plus multi-select, group, copy/paste on the timeline, ripple toggle, extend frame, magnetic tracks. | Plus roll, slip, slide, ripple and razor tools; three-point editing. | **High** (multi-select, copy/paste, group); Medium (roll/slip). |
| **Navigation** | Zoom ±, Ctrl+wheel, Home/End, ←/→ 0.1 s. | Frame step, markers, zoom to fit. | J/K/L shuttle, frame step, markers, timecode jump. | **High** (frame step, markers); Medium (J/K/L). |
| **Speed** | 0.25×–4× presets. | Clip speed, freeze/extend frame. | Speed ramps, reverse, freeze frame, optical flow. | Medium (freeze frame, custom speed). |
| **Animation** | Zoom only, one at a time (B11). On-screen items pop in and out with no fade. | Animations (zoom-n-pan with pan), behaviours (fade, slide, pop), cursor effects. | Keyframes on any property. | **High** for tutorials (pan between areas, item fades). |
| **Cursor and clicks** | None (deferred). | Cursor highlight, magnify, click ripple and sound, cursor smoothing, hide cursor. Needs cursor data recorded separately. | Not applicable. | **High.** Camtasia's signature tutorial feature. Needs recorder changes. |
| **Annotations** | Arrow, box, circle, line, highlight, text, step, stamp, blur; colour and width. | Callout library, sketch-motion, blur/pixelate, spotlight, keystroke callouts. | Titles, graphics templates. | Medium (spotlight/magnify in video, text styles, keystrokes) |
| **Captions** | Manual list: text, time, 3 positions, size, colour, box. Burned in. | Speech-to-text, SRT import/export, styles, accessibility standards. | Auto-transcribe, SRT/VTT, caption tracks. | **High** (SRT/VTT import/export; auto-captions with Windows speech or Whisper) |
| **Audio** | Constant clip volume, fades, old 8-band EQ/compressor/reverb/echo, master chain, voice-over. **Separate from the newer Audio studio.** | Volume points, audio ducking, noise removal, levelling, fade presets. | Envelopes, mixer, Essential Sound/Fairlight, loudness. | **High.** Volume envelopes, ducking, noise removal and loudness, which Saveit's Audio studio already has. |
| **Visual effects** | 12 filters with fades, layouts and backgrounds. | Colour adjust, green screen, device frames, LUTs. | Full colour grading. | Low–Medium (green screen was deferred) |
| **Export** | Real-time (B1). WebM/MP4/GIF. Full/720/480. Fixed 30 fps and 8 Mbps. | Faster-than-real-time render, presets, MP4/GIF/audio-only, batch. | Queue, presets, hardware encode, sidecar captions. | **High.** Speed and reliability first, then presets. |
| **Project safety** | Project lives inside the Library item. Missing media is dropped (B5). No relink, no autosave versions, no project file. | `.tscproj` file, autosave, relink. | Project files, autosave versions, relink, proxies. | **High** (relink, no data loss); Medium (project file, proxies) |
| **Help and access** | Tooltips. The timeline is one canvas; clips can't be selected by keyboard. | Shortcut list, tutorials. | Customisable shortcuts. | Medium (shortcut sheet/F1, keyboard access to clips) |

**What Saveit does well already:** the plain-English hints and tooltips, a solid crop tool, Layouts with webcam and background presets (Camtasia Rev style), stackable visual effects with fades, GIF export, and safe undo of almost every action. Keep this style while adding the missing features.

---

## 4. One product, two audio engines

The Video screen's audio (`buildFx`, `vedit2.js:20-37`) is the **9.x chain**. The Audio screen got a new engine in 10.1.3–10.1.6: de-esser, noise removal, loudness matching, limiter, meters, mic picker.

A tutorial maker records **video** with narration. They get none of the new tools unless they export the sound, clean it in Audio and bring it back. Users will see this as "the audio is fine in one place and bad in another".

**Recommendation:** route each video audio clip and the video master through `audio-effects.js` and `audio-engine.js`. Add a limiter and a loudness target on export. Reuse the Audio studio recorder for voice-over (B8).

---

## 5. Recommended order of work

Following the version rule (next is 10.1.7):

**Stage 1: make what exists dependable (bugs)**
1. **10.1.7: no lost work, no misplaced items.** B5 (offline clips + Relink), B6 (rescale items on Size change), B19 (undo keeps selection), B21, B10 (Space plays from playhead). Small, low risk, removes the worst surprises.
2. **10.1.8: playback engine.** B4 (one element per source), B2 (master clock, tighter sync), B3 (no black frames at cuts), B14 (redraw only when needed), B16 (seek throttling).
3. **10.1.9: offline export.** B1 + B18: frame-by-frame render with WebCodecs and a bundled muxer, offline audio mix, presets and frame rate, one stored format. This is the largest single change and the biggest quality win.
4. **10.1.10: timeline.** B7 (fixed scale while dragging), B17 (frame-accurate time and stepping), B9 (one ripple rule plus a toggle), B20 (short clips), clip thumbnails.
5. **10.1.11: audio.** B8 + B13 + §4: Audio studio recorder and effects in the video editor, master limiter, loudness on export.

**Stage 2: close the professional gaps (features), most valuable for tutorials first**
6. Clip transform (move, scale, opacity) and **real stacked video tracks**, plus still images and title cards as clips.
7. Multi-select, group, copy/paste and markers on the timeline.
8. Zoom-n-pan as a chain of keyframes (B11) and fade in/out for on-screen items.
9. Captions: SRT/VTT import and export, then auto-captions.
10. Audio volume envelopes and automatic music ducking under voice.
11. Cursor highlight and click effects. Needs the recorder to save cursor positions and clicks separately; plan this together with the recording format.
12. Project storage: blobs stored once (B15), relink, autosave versions, optional project file.

**Before any of this:** write `tests/video-editor-tests.cjs` with the existing harness. Start with one failing test per Stage 1 bug: reproduce, then fix, so each claim above is confirmed or dropped. The bugs marked **Check** (B12 mirror intent, B22 keyboard) should be reproduced first.

---

## 6. The company's 10.1.4 video editor review, and status after 10.1.7

The company's review measured saved files with ffprobe/ffmpeg. It confirms B1 with numbers: edited saves drop 13–22% of frames, freeze for up to 324 ms, and go silent for up to 0.85 s near the start. Untouched saves are perfect copies.

| Their ID | Matches | Status in 10.1.7 |
|---|---|---|
| V1 dropped frames / silence | B1, B3 | Open. Planned as the offline export rewrite. |
| V2 output Size ignored | new | **Fixed.** A Size change alone did not count as an edit, so Save copied the original. |
| V3 Fade in from black barely shows | B1 | Open. The fade starts at black in the preview; real-time recording starts late, so the saved file misses it. Fixed by the export rewrite. A fade-length box is still worth adding. |
| V4 typed crop ignored | new | **Fixed.** With nothing selected, the Clip tab edits the clip under the playhead. |
| V5 I/O keys | — | Not reproduced in the test copy; covered by a passing test. |
| V6 Saturation very weak | new | Open (small). Map 0% to greyscale and 100% to the original. |
| V7 Export quality carries to top-bar Save | — | Not reproduced; covered by a passing test. |
| Copy/cut/paste on the timeline, right-click menu on clips | §3 | Open. Next feature after the bug stages. |
| VU1 tooltips, VU3 field names | — | **Fixed.** |
| VU2 timeline not keyboard-reachable, VU4 timeline toolbar, VU6 J/K/L | §3, B17 | Open. |
| VU5 Audio studio on video sound | §4 | Open. |

Also fixed in 10.1.7 from this review: **B5** (offline clips + Relink), **B6** (Size rescales items), **B10** (Play plays on; Shift+Space plays the selection), **B19** (Undo keeps selection and In–Out), **B21** (unique ids).

`tests/video-editor-tests.cjs` reproduced each of these before the fix. Before the fix, it also confirmed B4 (6 video elements for 6 clips), B7 (a 100 px drag moved the clip 1.0 s instead of 0.28 s), B9, B14 (about 165 timeline redraws a second while idle) and B17. Those stay as todo checks for their versions. B22 turned out different from my guess: Space on a focused button does **not** press the button; it starts playback instead. That is a keyboard-access bug.

## 7. What this review did not cover
- Screen **recording** quality (frame rate, cursor capture, MediaRecorder settings). It is a separate module and worth its own pass, because export quality can't beat recording quality.
- Measured performance numbers (CPU, memory, save times). B4, B14, B15 and B16 should be profiled with a 30–60 minute recording.
- The image editor, Library and step guides.
