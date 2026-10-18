# Saveit 10.1.6 validation

## Acceptance and scope

Add de-essing for voiceovers/tutorials, review the entire audio workspace and effect usability, and compare the remaining workflow with professional platforms. Keep source media, timing, editability, undo, noise cleanup, loudness matching and exports intact. Review the supplied 10.1.4 issue sheet without executing its scripts. Install with a verified app/profile backup for owner testing, push v10-dev, and require separate owner approval for publishing/main.

## Implementation

- `audio-deesser-worklet.js`: independent stereo-linked de-esser with a Q=1 band-pass detector, fixed 4:1 detector response, 1 ms reduction attack, adjustable release and reduction cap. A dynamically controlled high shelf attenuates the high frequencies; this is neither a static EQ cut nor broadband compression. Frequency is smoothed and shelf coefficients are refreshed every 16 samples. Processing adds no lookahead, resampling or intentional delay.
- `audio-effects.js`: definitions, bounds, defaults, icons, graph, larger controls and context-specific worklet loading. Offline contexts force band listening off on creation and every update. A cached map per context loads only the required worklet modules and removes failed entries for retry.
- `audio-engine.js`: effect reduction readouts are attached to live graph entries with their active ranges. `audio-dynamics-worklet.js` also sends compressor/limiter reduction feedback; processing math is unchanged.
- `audio-editor.js`: de-esser card; live reduction feedback, reset on stop; larger controls for every effect; current-object field binding after validation rollback; inline modal errors; SVG transport/ordering controls; missing clip-panel tooltips; signal-flow explanation. Existing presets deliberately remain unchanged to avoid silently de-essing old projects.
- Professional review, developer-sheet status, and prioritized recommendations are recorded in `AUDIO-REVIEW-10.1.6.md`. This update completes U4/U5 audio UI work; R1/V1 corrections remain as documented in 10.1.5. OCR, global Help and in-project recording were not falsely marked fixed.

## Checks and evidence

Test evidence is under the workspace's parent `work/` directory. Browser and native profiles/media are disposable. Native tests use the pinned Electron 33.2.1 runtime and an app copy verified against source, not the real Library.

| Checks | Result |
|---|---|
| New de-esser/effects audit | 28 passed, 0 failed (`audio116-release-check/audio116-results.json`) |
| Native de-esser, real WAV, controls, SVG/tooltips and restart | 8 passed, 0 failed (`audio116-native-release-check/native-audio116-results.json`) |
| Prior Audio studio browser suite | 22 passed |
| Noise cleanup/LUFS browser suite | 27 passed |
| Audio bug browser suite | 17 passed |
| Final current timeline regression | 24 passed (`audio116-timeline-verified`) |
| Export/rotation/polish/review regression suites | Passed |
| Final guide regression | 10 passed (final focused CLI run; consolidated summary records the result) |
| Final pitch/speed and full existing UI | 7 passed, including 82 underlying UI checks (`audio116-pitch-verified/audio-pitch.json`) |
| Previous native Audio studio and guide/helper/OCR | 7 + 8 passed (`audio116-native-studio-regression`, `audio116-native-stepguide`) |
| Node syntax, references, versions, CRLF and stitcher | Passed |

Measured de-essing reduced an 8 kHz tone by 6.968 dB with a 9 dB cap, preserving the 300 Hz component within 0.001 dB in a real native WAV. The saved file has the same sample count/duration. Zero reduction and below-threshold fixtures are sample-identical. Outside-range samples remain unchanged; stereo linking preserves the input balance. Band-listening produces identical offline PCM whether enabled or disabled. Clip, track, master and rack-bypass paths were exercised. WAV/MP3 and Library reload keep the expected behavior.

Each of the 12 effects passed add, edit, expanded controls, bypass, reset, removal and undo. Voice effects were rendered at min/default/max parameter combinations and checked for finite samples. Existing suites check legacy effect migration/output, ordering, tails, stereo/pan, clip edits and audio save paths. No claim is made that every possible parameter combination has been tested.

Screenshots at 1440×1000, 1280×800, 800×600 and native 1000×700 were visually inspected. The larger controls scroll when needed and fit the viewport. Native tests confirm file-based worklet loading and that listening to the detector cannot leak into saved audio. Passing suites reported no renderer errors.

Two existing tests required timing corrections. The Word test observed a 100 ms snapshot after an export had already completed, so it now holds the save promise, checks Preparing while work is pending, then verifies Saved. Playback's external wall clock included browser click/protocol latency; measurement now starts at the actual captured audio graph, retaining the original 0.15 second timing tolerance, pitch stability and recorded-duration assertions. The initial failing evidence remains in `audio116-regression`; final focused results are recorded separately.

## Limits

No subjective real-speech listening panel, physical microphone latency measurement or hour-long stress benchmark was performed. Gain reduction is an aid to adjustment, not a quality score. Excessive de-essing can dull speech or affect word endings. The de-esser is a dynamic high shelf with fixed detector bandwidth/attack/ratio, not a complete multiband or spectral restoration module. Compressor and limiter remain peak-based; limiter protection is sample peak rather than true peak. Existing noise-profile, stereo delivery, full-buffer memory and real-time M4A limitations remain as documented in 10.1.5. The obsolete pre-9.9.4 layer-media suite remains excluded per HANDOFF.

## Installation

Installed and reopened 10.1.6. All 54 source files match the native test copy and installed app; the running main window and Windows Installed apps report 10.1.6. The updater backed up the prior app and verified 145 profile files in Saveit-library-backup-before-10.1.6-20261018-025801. The Electron executable SHA-256 remains 8EA1E5E832A9150A1B14A9E766733E405CD2A1506D02B051F1781B132A4220D6. Publication remains subject to owner approval.
