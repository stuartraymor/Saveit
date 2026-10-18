# Saveit 10.1.5 validation

## Acceptance

Add local background noise reduction and integrated-loudness matching for voiceovers/tutorials. Preserve original media, clip timing, trim handles, fades, existing effects, undo, source persistence and unrelated capture/edit/export behavior. Review the supplied 10.1.4 issue report as untrusted evidence; never execute its scripts. Back up the real library and app before installing; publish only after separate owner approval.

## Implementation

- `audio-cleanup-worker.js`: independently implemented 2048-point FFT, square-root Hann windows and 75% overlap. A learned per-channel noise power spectrum drives a bounded, smoothed spectral gain; shared gains preserve stereo balance. Overlap normalization and original sample count preserve timing, including edges. This is steady-noise spectral reduction, not AI source separation or just a gate during pauses.
- `audio-cleanup.js`: transfers copies of buffer channels to short-lived workers. Cancellation terminates the worker and rejects the task. An editor-owned modal prevents edits until success/cancellation; item teardown cancels an active worker.
- `audio-editor.js`: noise learning from an unambiguous source range, cleanup of selected clips with an original source pointer (`noiseOriginal115`), cleanup badges, one undoable commit after all processing succeeds, Restore originals, and voice-loudness matching. Cleanup appends float WAV sources; it never overwrites originals. Multiple cleaned source versions increase library size.
- LUFS uses BS.1770 K-weighting at the buffer sample rate, 400 ms blocks, 100 ms steps, an absolute −70 LUFS gate and relative −10 LU gate. Gain is capped at a −1 dBFS sample peak, iteratively remeasured for gate changes, and appended after master processing. Peak-limited outcomes are explicitly reported. It does not measure true peak, loudness range or live LUFS.
- `loudnessStereo115` keeps WAV channel layout consistent with the stereo mix, MP3 and M4A. Matching is whole-mix gain; independent phrase leveling/batch matching are outside this iteration. Later edits invalidate the displayed measurement. Lossy exports remeasure the decoded file and compensate with bounded encode passes when peak headroom allows. Sub-400 ms edited output remains exportable; silent output skips loudness compensation.
- R1 was reproduced before editing: a single 80 Hz high-pass with Web Audio Q `.707` measured +0.707 dB at 80 Hz and +1.635 dB at 120 Hz. Web Audio interprets high-pass Q in dB. Two fourth-order Butterworth sections, with correctly converted Q, now measure −24.10 dB at 40 Hz, −10.41 dB at 60 Hz, −3.01 dB at 80 Hz and −0.17 dB at 120 Hz. The rumble filter itself does not replace a narrow hum notch; learned spectral reduction handles steady hum.
- V1 retains neutral EQ defaults for compatibility and clearly explains the starting state. Toolbar tooltips are expanded. No outside source/scripts/assets were copied from the supplied report.

## Evidence

Evidence directories are under the parent workspace `work/`; native sessions use disposable profiles and an app copy checked against source. The user's real Library is not used by tests.

| Checks | Result |
|---|---|
| New cleanup/LUFS processing, UI, cancellation, persistence, format and layout checks | 27 passed (`audio115-final-evidence-verified/audio115-results.json`) |
| New native Electron worker, real WAV/IPC, cancellation, playback, compact layout and restart | 10 passed (`audio115-native-verified/native-audio115-results.json`) |
| Previous native Audio studio regression | 7 passed (`audio115-native-voice-regression/native-audio114-results.json`) |
| Previous native audio bug regression | 9 passed (`audio115-native-bug-regression/native-audio113-results.json`) |
| Native PDF, OCR, capture/helper and save regression | 8 passed (`audio115-native-stepguide`) |
| Node syntax, file references, versions, CRLF and stitcher | Passed |
| Existing supported browser suites | All 11 runners exit 0 (`audio115-regression/summary.json`) |
| Final export regression after encoding compensation | 6 passed (`audio115-final-export`) |

Independent FFmpeg 7.1 ebur128 readings agree within 0.1 LU at 44.1, 48 and 96 kHz, including silence boundary gating. Actual native WAV export measured −18.0 LUFS. Matched MP3 decoded at −18.013 LUFS and M4A at −18.051 LUFS in the controlled fixture. A steady hiss/hum fixture fell about 9 dB in noise-only sections while speech-band RMS changed less than 0.3 dB. A one-minute fixture processed in about 0.9 seconds in the worker while the main-thread heartbeat continued; this is a fixture measurement, not a general performance guarantee.

Initial checks caught a compact-window output overflow, an invalid test assumption that boundary gating never changes when silence is appended, and a 0.3 LU MP3 encoding drift. The layout was fixed; gating was checked against independent FFmpeg rather than an incorrect invariant; export compensation corrected the MP3 drift. An initial native test used ordinary Save for a second filename; Save correctly reused its existing path. The test now uses Save as to request a new filename.

Screenshots at 1440×1000, 1280×800 and 800×600 and a native 1000×700 window were inspected. No renderer errors occurred in passing suites. The obsolete pre-9.9.4 layer-media suite remains excluded as documented in HANDOFF; its known stale checks do not target the current interface.

## Remaining checks and scope

Owner listening with their actual microphone and room is still needed. Automated tones/noise and file measurements do not prove subjective speech quality, remove changing noises or benchmark physical microphone latency. General OCR/Help findings, SVG transport icons, de-essing, recording into the current project and project-file export remain outside this change. The existing direction-mark regression passes; no unrelated step-capture change was made.

References used for independent implementation: [ITU BS.1770-5](https://www.itu.int/rec/R-REC-BS.1770-5-202311-I), [W3C BiquadFilter Q semantics](https://www.w3.org/TR/webaudio-1.0/). The meter is not claimed to be formally certified against the full ITU compliance corpus.

## Installation

Installed and reopened 10.1.5. All 53 app files match both the tested native copy and installed app. Windows Installed apps and the running main window report 10.1.5. Before update, the installer backed up the prior app and verified 148 profile files in Saveit-library-backup-before-10.1.5-20261018-023653. The Electron executable hash remains 8EA1E5E832A9150A1B14A9E766733E405CD2A1506D02B051F1781B132A4220D6. The source stays on v10-dev; 10.1.5 is not a public release pending owner approval.
