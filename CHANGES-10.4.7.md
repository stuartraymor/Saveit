# Saveit 10.4.7

This round looked into the 9 checks in tests/layer-media-tests.cjs that had been failing since before 10.4.2 and were listed as "known failures". They covered pasting and inserting clips into the audio and video editors, and timed audio effects.

Most of them were checking the audio editor that Saveit used before 9.9.4. The current audio editor replaced it; the old one now appears only for a project that cannot be converted. So most of the failures were the tests being out of date, not the features being broken. Every feature they covered was tried again in the current editor, by checking the sound that is actually saved. Two real problems turned up.

## Paste and Insert in the video timeline's right-click menu
After you copy a video clip, Saveit says "Right-click the open timeline to paste or insert". But the video timeline's right-click menu had neither option; only Ctrl+V worked.
- The menu now has **Paste at playhead** and **Insert at playhead**. They are greyed out until a video clip has been copied.

## Audio effects stay with the audio they were put on
If you put an effect on the whole recording (for example "make 1 to 2.8 seconds quieter") and then inserted a clip or ripple-deleted a range before or inside it, the audio moved but the effect stayed where it was. It then applied to the wrong part of the recording, for example making the inserted clip quieter instead.
- This happened when the editing scope was "Selected tracks" (the default), even when the recording had only one track.
- When the edit affects every track, whole-recording effects now move and shrink with the audio, just as they do with "All tracks". With several tracks and only some chosen, nothing changes: other tracks still keep their timing.

## Checked in the current audio editor and working
Each item was checked by measuring the pitch and loudness of the mixed sound.
- **Insert at the playhead:** splits the clip, moves the later audio along, and Undo and Redo work.
- **Pasting after earlier cuts** keeps the edited audio. Repeated pastes, and copying a recording into itself, work too.
- **Restart:** inserted audio is still in the right place after reopening.
- **Volume effects:** two volume effects that overlap stack correctly, and each one only affects its own time range.
- **Moving and resizing effects:** effect bars can be dragged and resized. A time beyond the end of the audio is refused with a message, and Undo and Redo restore the effect.
- **Mute, echo, reverb and fades:** Mute silences exactly its range. Echo, reverb and fades stack without producing broken sound.
- **Save selection as sound:** makes a 1-second Library clip, keeps the recording open, and the clip can then be pasted in.
- **Effects after restart:** effects are still in place after reopening, and Trim keeps them inside the audio that is left.

## Tests
- tests/layer-media-tests.cjs now tests the current audio editor. All 20 checks pass, and it is no longer listed in tests/known-failures.json.
