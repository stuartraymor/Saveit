# Saveit 10.0.2 — Save audio as MP3 or M4A

- Audio can now be saved as **MP3** or **M4A** as well as WAV. They appear in Save, **Save as…**, the audio editor's **Save audio…** button (was "Export WAV…") and the Library's Save selected. The file is exactly what you hear: all tracks, clips and effects.
- MP3 files are about a tenth the size of WAV and play everywhere (email, Teams, the web). M4A (AAC) is also small and suits phones and Apple devices.
- **Save as…** has an **MP3 and M4A quality** choice: 96, 128, 160, 192 (default), 256 or 320 kbps. Saveit remembers your choice.
- MP3 is made with the bundled lamejs encoder (LGPL-3.0, `app/third-party/lame.min.js`, licence kept beside it). It works offline.
- M4A is encoded by the app's built-in AAC encoder in real time, so a 3-minute recording takes about 3 minutes to save. Keep the window open. MP3 and WAV are much faster.
- WAV saving is unchanged. Opening MP3, M4A, OGG and FLAC files already worked.
- Tests: new `tests/audio-export-tests.cjs` (6 checks: valid files, length, pitch of three tones, size, quality, Save paths, format lists). The 24 audio-timeline checks, the pitch checks and the full 82-check browser suite still pass.
