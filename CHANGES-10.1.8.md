# Saveit 10.1.8

Video editor playback engine (B numbers from `VIDEO-EDITOR-REVIEW-10.1.6.md`). Checked by `tests/video-editor-tests.cjs` (22 required checks).

- **One video player per source, not per clip (B4).** Splitting a recording into many pieces no longer creates a decoder and an audio-effects chain for every piece. Each source keeps a small pool: the clip that is playing, at most one clip coming up, and one spare. Measured: 6 clips from one recording now use 2 video elements instead of 6.
- **Splits play straight through (B3).** A clip that carries straight on from the one before it (the result of a Split) takes over that clip's player while it is still playing, so the cut needs no seek. A clip that isn't decoded in time shows the last picture instead of a black frame. Black frames did not occur with the short test clip even before this change, so the fix is not proven by measurement yet.
- **Picture and sound stay together (B2).** The playback clock follows the audio hardware. Small drift is corrected by nudging a player's speed (by up to 8%), and only drift over 0.25 s jumps; before, drift up to 0.35 s was left alone and then fixed with a jump. Playback and saving wait until the players have really started before the clock runs. Measured under simulated CPU load: largest drift 3 ms, against 34 ms in 10.1.7.
- **Faster scrubbing (B16).** Seeks no longer pile up while you drag the playhead. Only the newest position is prepared, and the picture updates after each one.
- **Less work while idle (B14).** The timeline and preview overlay are redrawn only while playing or when something changes, plus twice a second as a safety net. Measured idle redraws: 2 a second, down from about 165.
- **Space and Enter on buttons (B22).** On a button reached with the keyboard (Tab), Space or Enter presses that button. After a mouse click, Space still plays and pauses as before.
- Still open: offline frame-by-frame export (B1/V1), the timeline (B7, B9, B17, B20), copy/cut/paste on the timeline, and Audio studio effects for video sound.
