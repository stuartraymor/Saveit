# Audio export regression fixtures

These synthetic fixtures contain only generated test pictures and a 440 Hz tone.

- `short-audio-source.mp4`: retained from the original failing MediaRecorder reproduction on 10.2.12. Picture duration 2.968167 s, decoded audio duration 2.559667 s. The tone is continuous in the available audio. Retaining this file prevents the corrected test recorder from hiding the original evidence; no exporter can recover the absent tail from this file alone.
- `continuous-audio-source.mp4`: generated with FFmpeg testsrc2 (640x360, 30 fps, 3 s), sine (440 Hz, 48 kHz, 3 s), libopenh264 video and AAC audio at 192 kb/s. Both picture and decoded audio last 3 s.
- `continuous-audio-source.webm`: transcode of the complete MP4 using libvpx-vp9 and libopus. Used as the full master alongside the deliberately short raw AAC copy to reproduce the unedited-save defect deterministically.

`video-audio-gaps.cjs` checks complete-input cut exports, Save, Library copy/export, and preservation of available audio in a standalone truncated import. No silence threshold was relaxed. The harness recorder separately waits for the AudioContext clock to advance before starting recording so cold device startup does not create a defective source fixture.
