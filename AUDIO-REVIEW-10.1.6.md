# Audio editor review: voiceovers and tutorials

Reviewed Saveit 10.1.6 against official Adobe Audition, REAPER and iZotope RX documentation. This compares documented workflows with Saveit's source, automated measurements and native Windows checks; it is not a hands-on benchmark of those other applications or a claim of feature parity.

Saveit now covers basic multitrack voice editing, steady-noise reduction, EQ, de-essing, compression, sample-peak control and whole-mix LUFS matching. The biggest remaining professional gaps are project portability/recovery, recording retakes inside a project, delivery metering/options and automation. More effect types alone will not close those gaps.

## Effects and settings checked

Every one of the 12 effects was exercised through add, edit, larger controls, bypass, reset, remove and undo. New voice parameter minimum/default/maximum combinations render finite PCM and valid diagrams. The existing audio suites cover migration, timing, trimming, track scope, fades, effects, export, panning, presets, noise cleanup and matching. The new native suite measures de-essing in an actual saved WAV, along with local-file playback and restart persistence.

| Area | Current usability | What still needs improvement |
|---|---|---|
| Rumble filter | Corrected non-resonant 24 dB/octave high-pass, cutoff control and measured response | Dedicated 50/60 Hz hum removal with harmonics; low cut alone cannot guarantee strong hum rejection |
| Voice EQ | Neutral defaults explained; warmth, clarity, brightness, clarity frequency; live response and larger controls | Full parametric bands, bandwidth/Q, low-pass and a live spectrum |
| De-esser | New adjustable detector frequency, threshold, reduction cap, release, live reduction and preview-only band listen | Voice-specific listening trials; adjustable detector bandwidth and comparative listening presets |
| Compressor | Threshold, ratio, knee, attack, release, makeup; live editing and reduction meter | RMS/peak detector choice, lookahead, auto makeup and loudness-matched comparison |
| Peak limiter | Stereo-linked sample-peak limiting, ceiling, release and reduction meter | Oversampled true-peak measurement/limiting; a final delivery ceiling unaffected by later effects or gain |
| Gain in dB | Exact editable gain, range validation and larger controls | Consolidate the old Gain / Volume effect with the newer dB workflow |
| Gain / Volume | Legacy percentage gain remains compatible; larger controls added | Consistent dB units and less duplicate terminology |
| Fade in / Fade out | Timed ranges, editable edges, partial-fade preservation, reset and undo | Selectable fade shapes and better visual feedback for partially retained fades |
| Mute | Explicit timed muting and reversible bypass | Short boundary fades to reduce clicks in difficult waveforms |
| Echo / Delay | Delay, feedback, wet amount, timing, bypass, tails; larger controls added | Tempo-free voice/slapback presets, filtered repeats and clearer dry/wet balance |
| Reverb | Wet amount, decay, timing, bypass, tails; larger controls added | Pre-delay, room/damping controls and more natural response choices |
| Noise removal | Learned profile, bounded spectral reduction, cancellation, originals and timing retained | Listen to removed noise, before/after preview with level matching, adaptive mode and saved profiles |
| Normalize peaks | Measured sample-peak target, editable gain and undo | True-peak option and final-file delivery report |
| Match loudness | Integrated gated LUFS, editable gain, peak-headroom explanation; WAV/MP3/M4A checks | Short-term/momentary LUFS, loudness range, true peak, batch matching and explicit mono/stereo delivery choice |
| Track/clip mixer | dB gain, mute/solo, pan, stereo meters, independent clips and scopes | Larger mixer, gain automation, music ducking, phase invert and channel mapping |
| Recording settings | Default/selected mic, optional second mic, computer sound, delay, live level bars; current recording regression checks | Input/output device configuration, sample-rate/bit-depth choices, monitoring/latency tools, record into open project and recovery |
| Navigation/editing | Exact selection, selection playback, snapping, split, ripple, trim, fades, grouping, zoom and undo | Markers, spoken notes, transcript navigation, named edit history and a clearer guided voice workflow |
| Export | WAV, MP3, M4A; tested pitch/timing and LUFS behavior | 24-bit/32-bit float WAV, 44.1/48 kHz choices, stems, batch export, metadata and a faster offline AAC encoder |

Hardware permission failures, real microphone latency, acoustic noise and subjective speech quality cannot be established from synthesized fixtures. They still need listening and device testing on the owner's normal setup. M4A remains real-time and may encode more than once for loudness correction. Long projects still depend on full decoded buffers and retained source copies.

## Recommended order of further work

1. **Portable projects, automatic recovery and a restore browser.** Save sources, clips, edits and effects together; make backup/restore something users can see and verify.
2. **Record into the current project, with retakes and punch-in.** Pick a track and start point, keep earlier takes, and recover an interrupted recording. This addresses developer-sheet A6.
3. **A delivery meter and export report.** Integrated, short-term and momentary LUFS, true peak, loudness range, clipping and final-file checks. Include explicit mono/stereo, sample rate and WAV bit depth.
4. **Voice/music automation.** Editable clip-gain envelopes, smooth volume rides, music ducking and a focused mixer. This matters especially for tutorials with music or system sound.
5. **Mouth-click, plosive and breath repair.** Add focused tools before attempting broad source separation or many music effects. Preserve word endings and room tone.
6. **Parametric EQ and dedicated hum removal.** Adjustable bands/Q, low-pass, narrow 50/60 Hz cuts and harmonics. Include listening tools rather than relying only on attractive diagrams.
7. **Reusable voice chains and level-matched A/B.** Save personal presets, copy a chain between clips/tracks, compare without the louder version winning, and preview removed noise.
8. **Simpler audio workspace and discoverable help.** A clear cleanup → tone → dynamics → delivery path, fewer repeated gain controls, F1 shortcuts/help, and a noise tool that requires less scrolling.
9. **Markers and transcript-assisted editing.** Navigation by paragraph, retake or lesson section; add transcript-based editing only after selection/timeline behavior is robust.
10. **Long-recording performance and recovery testing.** Stream/cache waveforms and media, bound undo/source storage, and profile hour-long sessions before adding more expensive effects.
11. **Spectrogram and focused spectral repair.** Useful for finding clicks, hum and difficult noises, but less urgent than recording and delivery reliability.
12. **Plugin support and advanced routing.** Useful later for specialist workflows; current voice users will benefit more from the earlier items.

My recommended next development iteration is **recording into the existing project**, followed by **portable projects/recovery**. Plan the project format first so recordings, retakes and recovery share one durable structure.

## Developer-sheet status

Source: `C:\Users\stuar\Downloads\Saveit-10.1.4-issues-for-developer\ISSUES-10.1.4.md`. Its scripts were not executed.

| ID | Status after this update |
|---|---|
| R1 | Low-frequency boost and slope corrected in 10.1.5. The suggested dedicated hum notch is still a separate improvement; 60 Hz rejection from an 80 Hz low cut alone is about 10.4 dB, not a promised 15 dB. |
| V1 | Flat EQ starting point is explained in 10.1.5. Its defaults remain neutral. |
| U4 | Addressed in 10.1.6 for the audio transport, undo/redo, zoom, rack collapse and effect-order symbols with SVG icons. Native controls checked. |
| U5 | Toolbar tips were added in 10.1.5; missing clip-panel tips completed in 10.1.6. |
| A6 | Still open: New recording creates a separate Library item. |
| H1 | Still open: app-wide help/F1 discovery needs work. Local audio Editing help exists but does not replace it. |
| G1 | Still open as reported: annotated-capture OCR needs targeted reproduction. The existing clean OCR fixture passing is not proof that the boxed-row case is fixed. |
| B9 | Existing direction-mark regression passes; the exact taskbar-clock reproduction remains unverified. |
| A1 | The reviewer withdrew this as a test error. Existing zoom regressions also pass. |

The report's “check by hand” image/video/library cases are not confirmed defects and were not silently declared fixed by an audio-only change.

## Professional reference points

- [Adobe Audition: amplitude and compression effects](https://helpx.adobe.com/audition/desktop/effects-reference/amplitude-compression-effects.html): de-esser frequency/threshold controls, band-listening and reduction feedback informed the usability criteria. Saveit's dynamic high-shelf implementation is independent and does not claim to duplicate Audition's algorithms or modes.
- [REAPER: capabilities](https://www.reaper.fm/about.php): project/multitrack workflow, automation, export and delivery analysis informed the larger workflow gaps.
- [iZotope RX: repair tools](https://www.izotope.com/en/products/rx/features): specialized de-essing, mouth-click and other dialogue-repair tools informed the repair priorities. Saveit's learned steady-noise reduction is much narrower than a full restoration suite.

These sources support the comparison criteria. The priorities and implementation recommendations above are my judgment for Saveit's voiceover/tutorial audience.
