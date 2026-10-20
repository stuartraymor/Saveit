# SaveIt 9.9.3

- Resolve the two outstanding microphone pitch test failures: the old counter treated near-silent Opus startup fluctuations as additional cycles. The corrected test measures stable full periods without changing the audio.
- Verify recording, mute/solo WAV export, mixed 44.1/48 kHz input, and actual editor playback with generated tones in both browser and native desktop tests. Deliberate speed/pitch errors are rejected.
- Retain all 9.9.2 editing, layer, media paste and audio-effects improvements. The audio-processing implementation is unchanged.

The full browser suite passes 82 assertions. See VALIDATION-AUDIO-PITCH-9.9.2.md for the investigation and measurements. This version increment identifies the verified build for user testing. Existing settings and media are preserved during the local update.
