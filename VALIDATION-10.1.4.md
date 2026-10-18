# Saveit 10.1.4: Audio studio for voiceovers and tutorials

## Acceptance and scope

Provide a polished, useful voice-effects workflow with real processing and predictable saved output. Retain original audio and editable settings, undo/redo, existing projects, the 10.1.3 bug fixes, and unrelated image/video/guide behavior. Install the validated update with a verified app/library backup for owner testing; publishing remains subject to approval.

## Implementation

- `audio-effects.js` defines five new effects, parameter bounds/defaults, voice presets, processing builders, SVG icons, frequency/transfer diagrams, and peak measurement. Filters use Web Audio biquad nodes. Diagrams use actual filter frequency responses; dynamics diagrams show the configured static transfer curve.
- `audio-dynamics-worklet.js` implements stereo-linked compression with a soft knee and attack/release smoothing, plus a zero-lookahead sample-peak limiter with immediate gain reduction and a configurable release. The same worklet runs in live and offline contexts. It adds no intentional time delay; explicit disposal stops old processors.
- `audio-engine.js` handles timed dry/processed routing, live parameter updates, rack bypass, separate output channel analysis, and per-track analysis. Old effects retain their original paths. Processing modules are loaded before constructing graphs that need them.
- `audio-editor.js` and its CSS provide the studio rack, compact parameter controls, a larger accessible controls dialog, presets, dB faders, mono/stereo waveform views, exact range inputs, selection playback, held peaks, and peak normalization. Normalization uses the rendered float mix and adds a reversible gain effect; the editor is inert during measurement to keep settings consistent.
- `audio-project.js` validates the new effect types/settings. Additional fields remain part of the existing editable JSON project model. Source recordings are not rewritten.
- Presets replace only prior effects tagged as belonging to a voice preset on the selected target. Manually added effects remain. Rack bypass preserves individual effect bypass settings.

Technical references: [AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet), [processing blocks](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process), and [biquad frequency response](https://developer.mozilla.org/en-US/docs/Web/API/BiquadFilterNode/getFrequencyResponse).

## Checks

All automated media and library work uses disposable profiles/fixtures. The native tests use a separate Electron 33.2.1 runtime and a copy of the app, verified against the source.

| Suite | Checks |
|---|---:|
| Node syntax, references, versions, line endings and stitcher | Pass |
| New Audio studio processing/UI/persistence/layout | 22 |
| Audio 10.1.3 bug regressions | 17 |
| Existing audio timeline | 24 |
| WAV/MP3/M4A export | 6 |
| Rotation | 24 |
| Editor polish | 35 |
| Step guides | 10 |
| First review regressions | 8 |
| Second review regressions | 11 |
| Pitch/playback and complete UI | 7, including 82 underlying UI checks |
| Native Audio studio | 7 |
| Native audio bug checks | 9 |
| Native PDF/save/capture/helper/OCR | 8 |

Processing checks measure attenuation, EQ center-frequency gain, compression and makeup gain, stereo-linked limiting, unchanged samples outside a timed effect, neutral dynamics without delay, rack bypass, normalization accuracy, and undo. UI checks cover preset replacement, live control changes, invalid values, expanded controls, dB gain, exact selection playback, persistence, independent stereo metering with opposite-polarity channels, and layout at 1440×1000, 1280×800, and 800×600. Native tests exercise local-file worklet loading, real IPC WAV saving, peak-ceiling measurements from that WAV, and persistence after restart.

Screenshots were inspected, including the expanded controls window. The compact sidebar intentionally scrolls; the output section remains visible, and Open controls supplies a larger adjustment surface.

The old `layer-media-tests.cjs` suite remains excluded as documented in HANDOFF: it targets the replaced pre-9.9.4 audio interface and has eight known stale failures. No listening evaluation of real speech or physical microphone noise/latency benchmark was performed. Owner listening feedback is needed to tune presets to their voice and recording setup.

## Practical limits

- This is a substantial first voice-production update, not full DAW parity.
- The limiter controls sample peaks. It does not measure reconstructed true peaks or LUFS, and later gain/effects can raise levels again. Peak normalization is separate from perceived-loudness matching.
- The rumble filter removes low-frequency energy. It is not broadband noise reduction or a de-esser.
- New recording still creates a separate item. Portable project files, recording recovery, advanced routing, plugin hosting, and speech transcription are not added here.
- Existing real-time M4A export and full-buffer memory behavior remain unchanged.

## Delivery

Version bumped with `node tools/version.js bump`. Commit and push on `v10-dev`; install using `tools/update-installed.ps1` after validation. Verify every installed file, preserve the runtime, verify the library backup, and reopen Saveit for owner testing. Do not publish a release or modify `main` without approval.
