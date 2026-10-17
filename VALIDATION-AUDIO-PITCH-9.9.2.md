# Audio pitch verification — October 17, 2026

Starting commit: `eb19db43d49f44450504ac091bf505ec64d1df42`. Branch: `codex/9.9.2-audio-pitch-verification`.

## Diagnosis

Reproduced both outstanding assertions before editing: microphone 1 reported 467 Hz instead of 440 Hz; microphone 2 reported 680 Hz instead of 660 Hz. The test counted every sample sign change in the first second, including very low amplitude Opus startup transients. The decoded original already contained these extra crossings. Stable waveform windows measured 440/660 Hz, and thresholded full-period measurements also measured the correct tones across the first second. Mixing and PCM export preserved frequency, duration and sample rate.

These were false pitch failures in the test measurement. No product audio transformation, sample-rate override or version change is justified. The installed 9.9.2 remains running with its existing audio implementation. Its audio/editor/main/preload source hashes match this checkout. Earlier validation reports retain their historical failures; this investigation supersedes those outstanding findings.

## Changes

- Add `QA.toneAnalysis`: synthetic-tone measurement using amplitude hysteresis, interpolated full periods and median period. It takes no expected frequency and reports energy, cycle count and stability.
- Use it for the two microphone assertions, retaining their original frequency tolerance. Add requirements for audible energy, hundreds of cycles and >95% stable periods. No startup segment is discarded from these two assertions.
- Add browser and native Electron checks for 44.1/48 kHz PCM import, mixed-rate tracks, actual MediaRecorder capture, mute/solo exports and real editor playback loopback. Recorded/exported tones must be within 1 Hz with >99% stable cycles; recording length must match elapsed capture within 150 ms. Playback must match expected duration within 150 ms of wall time, and loopback duration within 100 ms.
- Negative controls introduce a 48/44.1 sample-rate equivalent pitch shift, half speed and double speed: these measure 478.91, 220 and 880 Hz and are correctly rejected as 440 Hz. A correct tone with injected near-silent startup noise still measures 440 Hz.

## Results

| Check | Result |
| --- | --- |
| Full browser regression suite | 82 passed, 0 failed (previous 80 plus two stability assertions) |
| Browser pitch/speed scenarios, full-suite wrapper and renderer-error check | 7 passed, 0 failed |
| Native profile/source identity, pitch/speed scenarios and renderer-error check | 7 passed, 0 failed |
| Node parsing, asset references, CRLF and stitcher regression | Passed |

Final native recording measurements: input 439.9947 / 660.0116 Hz, exported WAV 439.9905 / 660.0077 Hz. A 3.3039-second capture decoded/exported to 3.3000 seconds. Editor playback loopback measured 440.0035 Hz and lasted 3.3000 seconds; wall time was 3.371 seconds including scheduled startup and automation overhead. Browser loopback measured 440.0051 Hz with 3.3000-second duration and 3.354-second wall time.

Synthetic source AudioContexts are warmed up before capture timing. An initial un-warmed native fixture lost 187 ms while its source graph started; its pitch was correct. Fixture cleanup was made idempotent to avoid closing an already closed test AudioContext. Neither issue required product changes or relaxed acceptance limits.

Tests used generated tones and disposable profiles, not physical microphones or user media. They verify software capture/decoding/playback/export paths, not a particular microphone driver or hardware clock. No file in `%APPDATA%\Saveit`, any user media directory or the installed app was changed. No installation or migration was needed because the application payload is unchanged.

Evidence outside Git: adjacent `pitch-probe-results.json` (original failure and raw/input/mix/WAV measurements) and `pitch-evidence/{audio-pitch.json,native-audio-pitch.json,installed-source-hashes.json}`.

Reproduce: build an external harness with `node tests/build-harness.js <external-directory>`, serve it with `node tests/serve.js <external-directory> 8943`, then run `node tests/audio-pitch-tests.cjs` with Playwright available through `NODE_PATH`. For native verification, set `SAVEIT_ELECTRON_PATH` to the separate `review-9.9.2/Saveit.exe` and add `--native`. Never set `SAVEIT_REVIEW_DATA` on a normal user launch.
