# SaveIt 9.9.4 validation

Approved scope: the Audio workspace proposal reviewed on October 17, 2026. Starting commit `f510f54cb34b49254de576f2a5d053ab4e594fb4`; branch `codex/9.9.4-audio-timeline`. No third-party dependency or runtime upgrade.

## Implementation and preservation

New audio-only modules separate the versioned clip model (`audio-project.js`), common live/offline scheduling (`audio-engine.js`), and timeline/inspector (`audio-editor.js`, `audio-editor.css`). The previous editor, capture implementation, decoder and WAV encoder remain available. `index.html` stores/hydrates the new project and recovery snapshot, integrates media drop/copy/paste, and hides the image rail only in the Audio workspace.

Source blobs remain in the existing item record. A clip references its source and stores source in/out and timeline start separately. Conversion maps legacy shared edits and inserted regions into independent clips, validates them before committing, and retains original edits/regions. Legacy master effects use their original processing until their sound parameters are changed. Unsupported projects retain their data and show the original editor with an explanatory message.

All automated tests use disposable files and profiles, never the user's actual recording devices or media. Before the local update, the existing window must flush its Library saves and hide; the targeted installed processes are then stopped. The old application and full real profile are copied to a timestamped backup, every profile file is verified against the copy, the staged application payload is checked, and profile hashes are checked again before reopening. Installation results and a full manifest are stored adjacent to the repository under `installation-backups/before-9.9.4-*/`.

## Checks

| Check | Result |
| --- | --- |
| New timeline/model/effects/clipboard scenarios | 24 passed, 0 failed; no renderer errors |
| Existing full browser regression suite | 82 passed, 0 failed |
| Packaged Electron with real preload, IPC and disposable IndexedDB | 16 passed, 0 failed |
| Browser capture/export/playback pitch/speed checks | 7 passed, 0 failed, including the full-suite wrapper |
| Native capture/export/playback pitch/speed checks | 7 passed, 0 failed |
| Earlier image cursor/Crop/Cut Out/Simplify checks | 34 passed, 0 failed |
| Video copy/paste/insert checks plus renderer check | 4 passed, 0 failed |
| App/inline parsing, asset references, CRLF and stitcher tests | Passed |

The original 14 audio-editing assertions in the broad suite retain their numerical audio checks, with gestures updated to the approved interface: Range for time selection, explicit Ripple Delete, independent clips, trim then reposition, clip fade controls and confirmed Restore original edit. The historical 9.9.2 layer-media suite's old audio UI assertions are superseded by the new timeline suite; its separate video checks still pass.

Focused checks cover real mouse movement/edge trimming/cross-track placement and one-step undo, scoped and all-track cuts, disjoint ripple selections, keyboard nudges, insert/append/stack, clip FX isolation, effect order/bypass/reset/remove/edge dragging, effect timing on split/move/trim, live preview/meters, stereo/pan, explicit tails, grouping/repetition/crossfades, source identity, persistence/hydration, drag/drop, selected-audio copy/cut/paste, bounce retaining muted originals, and a five-minute source reusing decoded audio/peaks during a drag. The long-source gesture completed in under 100 ms in the measured run with zero new decodes.

Migration sample comparisons include legacy cuts, gaps, inserted regions, global fades, volume and all six effect types. The six effect-type cases match sample-for-sample; the cut/insert/fade case has maximum floating-point sample difference about 1.2e-7. Center-pan upmix was corrected to preserve mono levels, and near-identical floating-point clip endpoints no longer add a phantom output frame.

Native checks verify packaged source identity, actual clip trim/undo, effect fields and live controls, Recents paste, mouse move with effects, a reload retaining clips/effects, and export through the real preload/IPC to valid stereo 48 kHz PCM. Source tone pitch and real-time editor loopback checks remain within 1 Hz and the established timing limits. Native screenshots were reviewed at the desktop's high-DPI scale. A global range-input flex rule was overridden so the horizontal scrollbar no longer consumes timeline height.

## Practical limits

The sound clipboard stores a rendered copy of the selected audible audio, including its effects; independent source clips/effects remain editable in the original project. Grouping keeps clips editable. Bouncing creates a new rendered clip, retains and mutes the selected originals, and undoes in one step. Same-track overlap mixes until an explicit crossfade is added.

Playback and export use the same graphs, but seeking/rebuilding a delay/reverb starts new effect history at the seek point. Tail export is explicit and bounded; source audio is never time-stretched by trimming. External VST hosting, independent pitch/time stretching and advanced noise repair were not in the approved first release.

Evidence directories adjacent to source: `audio94-evidence/`, `audio94-pitch-evidence/`, `audio94-native-evidence/`, and `audio94-native-pitch-evidence/`. Commands: build/serve the external harness on port 8944, run `tests/audio94-tests.cjs`, `tests/audio-pitch-tests.cjs` with `SAVEIT_QA_URL`, and `tests/native-audio94.cjs` / pitch `--native` with `SAVEIT_ELECTRON_PATH` pointing to the separate review runtime. Do not set `SAVEIT_REVIEW_DATA` for normal launches.

GitHub publication requires the user's separate approval after installation and testing.
