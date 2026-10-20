# Saveit 9.9.0: Audio, part 1 (quick recording and the Audio screen)

Phases 1 and 2 of [PLAN-9.9-audio.md](PLAN-9.9-audio.md).

## A tidier capture bar (top bar and widget, identical)
- **Logo only.** The "Saveit" lettering and version number are gone from the top bar and the widget; the window title already shows them. Hovering the logo still shows the version. If saving ever fails, the logo gets a red ring (the warning used to turn the text red).
- The Capture button column is narrower, which makes room for the new switch: **Image | Video | Audio**.

## Quick audio recording
- Choose **Audio** in the top bar or the widget. Only the audio settings stay:
  - **Mic** with its dropdown and a **live level bar** (green, amber when loud, red when it would clip).
  - **+ Mic 2** records a second microphone **on its own track** (up to two). The same mic can't be picked twice, and "Default microphone" counts as the mic it stands for.
  - **Computer sound** records what the PC is playing, as another track.
  - **Delay** works as for screenshots and video.
  Selection, Cursor, Copy to clipboard and Effect are hidden in Audio mode, because they don't apply.
- The red button becomes **Record audio** (with a microphone icon). Ctrl+Shift+X and the widget's button do the same.
- While recording, the editor steps aside and a small bar at the top of the screen shows the countdown, the timer, a live bar for each track, **Pause** and **Stop**.
- **Stop** saves the recording to Recent and the Library, and opens it in the Audio screen.
- The level bars only use the microphone while Audio is chosen and the window is visible. They switch off as soon as you choose Image or Video.
- The top bar and the widget share their audio settings, so a change in one shows up in the other.

## The Audio screen
- New **Audio** button on the toolbar, between Video and Layers. It opens the audio that is open, otherwise the newest audio, otherwise a start page with **Record audio** and **Open audio file…**.
- Each track has its own lane with its waveform, a **volume** slider (0–200%), **M** (mute) and **S** (solo).
- **Play / Pause** (Space), **Start** (Home), Loop, click or drag on a waveform to move the playhead, and arrow keys to step (Shift for 5 s).
- **Save audio (WAV)…** (or the main Save, or Ctrl+S) mixes the tracks as you hear them, with volume, mute and solo applied. The message says the length and where it was saved. WAV files go to the Music folder by default.
- **New recording** starts another recording with the capture-bar settings.
- Drawing tools are greyed out while audio is open.

## Library
- Audio sits beside images and videos: a waveform thumbnail, an **Audio** filter, search, rename, folders, Duplicate, Delete and Undo delete, Save to folder (WAV), and library backup and restore.
- **Open** accepts WAV, MP3, M4A/AAC, OGG/Opus, FLAC and WebM audio.

## Coming next (from the plan)
Trimming and splitting, EQ and effects, Clean up (noise removal, auto level, remove silences), MP3/M4A/WebM saving, and voice-over on videos.

## Tests
`await QA.runAll()` now runs 66 checks, including 16 new ones for audio: capture-bar contents, two different mics, live bars, record → two tracks, mic bars returning, tools greyed, mute/solo checked in the saved WAV by its pitch, WAV length, the Audio filter, and switching back to Image. The harness has two fake microphones (test tones), stand-ins for the widget and the recording bar, and a no-cache server (`tests/serve.js`).
