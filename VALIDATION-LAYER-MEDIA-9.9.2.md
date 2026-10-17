# Layer, media and audio-effects follow-up

Starting point: `18cf3f3be3edba6b311605a6d83a8b28c8187036`. Branch: `codex/9.9.2-layer-media-polish`. October 17, 2026.

## Findings and changes

The grouping defect was reproduced before changes: selecting two Layers rows enabled the side-panel Group action while both toolbar Group/Ungroup buttons stayed disabled. The Layers-specific property renderer bypassed the existing toolbar state updater. It now calls that updater and also recognizes group ID zero correctly.

Layer up/down retains the existing one-step order implementation and refreshes the panel, with separate Top layer/Bottom layer actions. Effects Flatten uses the existing layer-flattening path, keeps Effects open, retains its settings and supports undo. The image is flattened before effects are applied; effects are not baked twice.

The audio model still uses the existing global cut list. Optional per-track source regions add clip positioning and gaps without rewriting the original audio samples. Legacy tracks without regions retain their original time alignment. Region scheduling is shared by playback, waveform drawing and WAV export. History snapshots keep immutable Blob references and restore tracks, regions and processing settings together. The Library record now persists regions along with the existing track fields.

`app/audio-timeline.js` implements timed audio regions and the compact effects UI. Timed processing uses standard Web Audio nodes, with the same graph for playback and offline WAV export. Effects apply to the full mix; per-track volume/mute/solo remain available. Timed bars can be moved, resized, edited numerically, overlapped and undone. Cuts, trims and insertion remap their timing. A selection can be mixed into a separate WAV Library sound-effect clip without opening another editor.

Media context menus preserve the open destination. Clipboard clips are held by value inside SaveIt. Audio is copied as heard, including source edits, levels, mute/solo and effects. Edited video copies reuse the existing video render engine; preparing a long edited video takes approximately playback time. Video pasted into a destination stores its media in the existing embedded-blob map rather than depending on the source Library item. Overlap uses the existing video preview/transition behavior. Middle insertion splits crossing clips and shifts later media/captions/overlays/zoom/effect ranges.

A rapid video-paste failure was reproduced during testing: a second paste was rejected while the first preview seek was still completing, after its clip already appeared. Completing the paste operation before asynchronously seeking the preview fixes this. Right-clicking the timeline also no longer begins a left-button seek/drag.

## Validation

| Check | Result |
| --- | --- |
| New layer/media/effects scenarios | **20 passed, 0 failed**, no renderer exceptions |
| Earlier 9.9.2 cursor/Crop/Cut Out/Simplify scenarios | **34 passed, 0 failed** |
| Native Electron with isolated profile and real preload | **15 passed, 0 failed** |
| Node script/inline parsing, asset references, CRLF and stitcher tests | PASS |
| Existing complete regression suite | **78 passed, 2 failed** |

New scenarios cover group selection and toolbar state, exact ordering and undo, context labels, Effects Flatten, stacked audio, middle insertion, correct exported samples and gaps, repeated/self-copy, source preservation, Library and Recents menus, audio persistence, numerical timed-effect sample levels and stacking, effect dragging/resizing/invalid ranges, mute/echo/reverb/fades, custom sound effects, timing remapping after cuts/trims/insertion, video overlap/ripple insertion, caption timing, trimmed source rendering, embedded source media and reopening/export.

Native checks use packaged source matching this checkout and a separate profile, disposable PNG/WAV fixtures, real context menus, Layers grouping, Effects Flatten, audio stacking, timed effects, selection-to-sound-effect saving, Paste/Ctrl+V and visible waveforms after insertion. No real devices are recorded by these checks. Native screenshots were reviewed at the desktop's device scale factor 2.

The two broad-suite failures remain the synthetic microphone pitch checks already reproduced on unchanged 9.9.1/earlier 9.9.2: Mic 1 measured 461 Hz against 440 Hz, Mic 2 680 Hz against 660 Hz in this run. Deterministic audio edit/mix/effect sample tests pass; this follow-up does not claim those recording/codec assertions are fixed.

Evidence is saved outside source control in the adjacent `layer-media-evidence/` directory: `layer-media-results.json`, `native-layer-results.json`, `native-waveform.json`, `broad-regression-results.json`, `previous-polish/polish-results.json` and PNGs of the new panels/native UI. No new dependency was added.

## Trying the changes

1. Select two layers using Ctrl/Shift-click in Layers. Use Group in either the toolbar or panel. Layer up/down moves through the displayed order.
2. Open an image, choose Effects, then Flatten at the top to include annotations/pictures in subsequent effects. Ctrl+Z restores editable layers.
3. Keep a destination audio/video open. Right-click a source in Library or Recents and choose Copy audio/video clip, then right-click the waveform/timeline to paste or insert. Direct add/insert commands are also available on the source menu.
4. In Audio, choose an effect and Add effect. A waveform selection sets its initial range; otherwise it starts at the playhead. Drag the bar/body or either end, or enter From/To/Amount in the right panel. Overlapping bars stack processing.
5. Select a waveform range and choose Save selection as sound effect. Find it in Library/Recents, rename it normally if desired, and paste it as an independent track.

Reproduce with the existing harness on port 8941 and `node tests/layer-media-tests.cjs <url> <evidence-dir>`. Native checks use `tests/native-layer-media-smoke.cjs` with `SAVEIT_ELECTRON_PATH` pointing to a separate packaged runtime and the disposable fixtures. Keep `SAVEIT_REVIEW_DATA` out of normal desktop launches.
