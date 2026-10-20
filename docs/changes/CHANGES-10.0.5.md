# Saveit 10.0.5 — Polish from the 9.9.4 review

- **Video timeline row labels are readable.** VIDEO, AUDIO, CAPTIONS and ON-SCREEN ITEMS used to be drawn underneath the playhead and clips, so the playhead hid letters ("V DEO"). They are now drawn on top, on a small dark backing.
- **Short mic names.** Recorded tracks are named **Mic 1** and **Mic 2** (or **Microphone** for a single mic) instead of the full device name such as "Microphone Array on SoundWire Device (9- Cirrus Logic XU)". You can still rename any track.
- **The "C" next to M and S** on each audio track is now a labelled pan indicator: **Pan C** (or Pan L / Pan R), with a tooltip.
- Not changed: the recording **Delay** option stays as it is (None, 3, 5, 10 s). The review's accessibility note about the audio bar could not be reproduced: the mic picker, + Mic 2, Computer sound and Delay all have accessible names.
- Tests: two more checks in `tests/review103-tests.cjs` (7 total). Polish 35/35, audio timeline 24/24, MP3/M4A 6/6, pitch checks and the full 82-check suite pass.
