# Plan: Audio (Saveit 9.9.0)

A new **Audio** workspace for recording, cleaning up and saving sound, and for doing voice-over on videos. It sits beside Image and Video, so it feels like it always belonged there. References: Camtasia's audio tools and voice narration, Audacity's noise reduction, Snagit's capture flow.

## Your decisions
| Question | Decision |
|---|---|
| Scope of the first version | One recording at a time (up to two mic tracks plus computer sound): record or open, edit on a waveform, clean up, save |
| Link to video | Two-way: record while a video plays silently, **Add to video**, and **Edit in Audio** from a video |
| Save formats | WAV, MP3, M4A (AAC), WebM/Opus |
| Clean-up tools | Noise removal, Auto level, Remove silences (EQ presets come from what already exists) |
| Recording sources | Microphone, plus a switch for computer sound |
| Where it appears | Top switch **Image \| Video \| Audio**, and a toolbar **Audio** button between Video and Layers |
| Noise removal style | Built-in noise print: Learn noise, then Remove noise with a strength slider (offline) |
| Where audio lives | Library and Recent, with waveform thumbnails and an Audio filter |
| Quick recording | **Audio** joins Image and Video in both the top bar and the widget, with simple settings there; the advanced tools live in the Audio screen |
| Two microphones | Up to two mics, each recorded as **its own track** (balance and EQ each one later; Save mixes them) |
| Mic level bars | A live bar beside each chosen mic in the top bar and widget, running only while Audio is selected; the dropdown marks which mics are connected |
| After Stop | The Audio editor opens with the new recording (like video today) |
| Recording bar | Timer, a live bar per mic with a too-loud warning, Pause, Stop |

## Quick recording (top bar and widget)
Most recordings are a quick message on one mic, so this stays as simple as Image and Video. Choosing **Audio** swaps in only the audio settings:

```
Top bar / widget, Audio selected:
┌──────────────────┐  [ Image | Video | Audio ]
│ ● Record audio   │  Mic 1 [USB Podcast Mic ▾] ▮▮▮▮▮▮▯▯   [+ Mic 2]
└──────────────────┘  ☐ Computer sound      Delay [None ▾]

After "+ Mic 2":      Mic 2 [Webcam mic ▾] ▮▮▮▯▯▯▯▯ [✕]
```
- **The red button** becomes **Record audio** (microphone icon). Ctrl+Shift+X and the widget's button do the same.
- **Hidden in Audio mode:** Selection, Cursor and Effect (they don't apply). Copy to clipboard and Delay stay.
- **Mic dropdown:** lists every connected mic and greys out ones in use or unplugged. It remembers your choice, and if that mic is unplugged it falls back to the Windows default and says so.
- **Live bar:** green while talking, amber when loud, red when clipping. It only runs while Audio is selected and the window is visible, so the mic isn't kept open in the background.
- **+ Mic 2** adds a second dropdown and bar (a maximum of two). The same mic can't be picked twice.
- **Computer sound** records what the PC plays, as an extra track.
- **Recording:** a 3-2-1 countdown if Delay is set, then the small floating recording bar (timer, a live bar per mic, Pause, Stop). There is no screen outline, since nothing on screen is captured.
- **Stop:** the recording is saved to Recent and the Library and opens in the Audio screen.
- The widget and the top bar stay in sync, as Image and Video already do.

## What it will look like
The layout copies the video editor, so nothing new has to be learned: a picture area on top, a timeline below and a side panel on the right.

```
┌ Image | Video | Audio ┐   [● Record audio]  Mic: [USB Mic ▾]  [ ] Computer sound
├────────────────────────────────────────────────────────────┬───────────────────────┤
│  BIG WAVEFORM (selected area shaded, playhead line)        │ Clip | Sound | Clean  │
│  ▁▃▆█▆▃▁▂▅█▇▅▂▁▁▃▆█▆▃▁▂▅█▇▅▂▁▃▆█▆▃▁                         │ up | Export           │
│  level meter ▮▮▮▮▮▮▯▯  -12 dB      0:12.4 / 1:05.0          │ (tab content)         │
├────────────────────────────────────────────────────────────┤                       │
│ ▶ Play  ⏮  Loop   Zoom − +   In/Out  Split  Delete  Undo   │                       │
│ timeline ruler + overview strip                            │ [Save audio]          │
└────────────────────────────────────────────────────────────┴───────────────────────┘
```
While a video is linked, a small silent video preview sits at the top-left of the waveform area, so the voice can be timed to the picture.

Side panel tabs:
- **Clip:** In and Out, Split, Trim to selection, Delete selection, Fade in and out, Gain, Speed (later).
- **Sound:** the 8-band EQ with its presets (Voice boost, Podcast, Reduce rumble, Phone/radio…), low and high cut, compressor, reverb, echo, all moved over from the video editor.
- **Clean up:** Learn noise and Remove noise (strength), Auto level (target loudness: Podcast −16, Video −14, Quiet −20), Remove silences (longer than X s, shorten to Y s, with a preview of what will be cut).
- **Export:** format, quality, **Save audio…**, and **Add to video…**.

## How it is built (fits the current code)
- **New file `app/aedit.js`** for the audio editor, like `vedit2.js` for video. `AEdit.mount(host, item, api)` returns the same controller shape as the video editor (destroy, save, needsRender…), so `index.html` can treat it the same way.
- **Reuse rather than copy:** the video editor's audio engine (`buildFx`, `EQ_PRESETS`, `defFx`, `computePeaks`) is exported from `vedit2.js` through `VEdit.Core` and used by both editors. A sound fixed in one is fixed in both.
- **New item kind `audio`** in `index.html`: `addAudio()`, storage in the same IndexedDB library, a waveform thumbnail, an **Audio · n** filter chip in the Library, and support in the tray, search, rename, folders, delete and undo-delete.
- **Non-destructive edits** stored as a small project (like video): cuts and effects are a list, the original recording is never changed, and Undo/Redo work across everything. Saving renders a new file.
- **Rendering** uses `OfflineAudioContext`, which is faster than real time. Encoding to WAV is written directly. M4A and WebM use the engine's built-in WebCodecs encoders with a small muxer, and MP3 uses a bundled open-source encoder. No "keep the window in front" wait like video has.
- **Recording:** each mic through its own `getUserMedia` stream and its own recorder, started together so the tracks line up. The device lists come from the existing `devices.js` (already shared by the top bar and widget). Computer sound uses the same loopback route the screen recorder uses for "System audio". The level bars are an `AnalyserNode` per mic. The widget gets its bars from its own small analyser, so no audio passes between windows.
- **Top bar and widget:** the third mode button is added to the existing `seg` in both `index.html` and `widget.html`, and the existing mode functions (`labels()` in the widget, the mode handler at the Capture button in `index.html`) gain an `audio` branch that shows the audio settings and hides the image/video ones. The mode and mic choices sync through the same widget-options channel as today. The recording bar (`recbar.html`) gets an audio layout.

## Build order (each phase can be shipped and tested on its own)
1. **Foundations:** the `audio` item kind, the Library and Recent cards, the top switch, the toolbar Audio button, the Audio icon, an empty editor shell showing a waveform, and Open of WAV/MP3/M4A/WebM/OGG/FLAC.
2. **Quick recording:** Audio in the top-bar switch and the widget, mic dropdowns with live bars, + Mic 2, Computer sound, the red button becoming **Record audio**, the recording bar with per-mic bars, Pause/Resume, Stop, then opening in the Audio screen. Each mic and computer sound is saved as its own track.
3. **Editing:** zoomable waveform (one lane per track, with a volume, mute and solo for each), drag to select across tracks, play selection, Split, Trim, Delete, fades, gain, Undo/Redo, and the shortcuts Space, S, Del, I/O, Ctrl+Z/Y.
4. **Sound:** EQ, presets and effects (reused), with a live **Before/After** toggle so the difference can be heard.
5. **Clean up:** Learn and Remove noise (spectral noise gate), Auto level (loudness measurement), Remove silences, each with progress and Undo.
6. **Save:** WAV, MP3, M4A and WebM, with quality options, and a message that says what was written and where (the same rule as the 9.8 video fix).
7. **Video link:** Record over a video (the video plays muted in the preview), **Add to video** (placed on that video's audio track at the playhead), and **Edit in Audio** from a video's audio clip, which returns to the video after Done.
8. **Polish and tests:** icons, accessibility names, a user-style test pass like 9.8.1, new automated checks in `tests/ui-tests.js` (record from a test tone, edit, clean up, save each format and check the length and that the file decodes), and an installer bump.

## Risks and how they are handled
- **Long recordings and memory:** an hour of stereo audio decoded is about 1.4 GB. Waveforms are drawn from a downsampled summary, files over 60 minutes get a warning, and rendering is done in chunks.
- **Noise removal quality:** too much removal makes a "watery" sound. Strength defaults to moderate, Before/After makes it easy to judge, and the first version is tested on real hiss, fan and hum recordings.
- **MP3 encoder licence:** the encoder is checked before bundling (a permissive one, kept as its own file in `third-party/`).
- **Keeping the UI polished:** no existing screen changes layout. Audio only adds one toolbar button, one switch option in the top bar and the widget, and one Library chip, and they use the existing styles and icon set. The audio settings row is checked at the smallest window size, like the 9.8.1 top-bar fix.
- **Two mics drifting apart:** two USB mics have separate clocks and can drift a few milliseconds per minute. Both are recorded through one audio context and lined up on Stop, and a 30-minute two-mic test is part of phase 8.
- **Mic privacy:** the live bars open the mic only while Audio is selected and the window is visible, and close it straight away otherwise.

## Not in this version (possible later)
More than two mics, a free multi-track mixer with music and sound-effect lanes, speech-to-text captions from audio, pitch and voice changers, and batch processing.

## How you will check it
After each phase: the app installed locally, the automated suite green, and a short list of things to try yourself (for example, "Record 10 seconds with a fan running, Learn noise, Remove noise, Save MP3, play it in Media Player").
