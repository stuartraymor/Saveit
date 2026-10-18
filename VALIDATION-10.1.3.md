# Saveit 10.1.3 audio bug fixes

## Scope and acceptance

Fix the confirmed audio defects before adding professional audio features. Repeat must work in Electron; keyboard paste must reach the selected audio track; bounce must preserve rendered sound through existing master processing; stereo waveforms must show active channels; straightforward mono WAV exports must remain mono; trimming and effect defaults must be predictable; save messages must remain readable and clear of playback controls. Undo, existing projects, and unrelated image/video/guide behavior must remain functional.

## Changes and implementation

- `audio-editor.js`: app-owned Repeat form, bounded integer count, cancel/Escape, focus containment, one undo step. Ctrl+V places on the selected track and Ctrl+Shift+V inserts. Modified letter shortcuts no longer accidentally select a tool.
- Bounce renders selected clips through their clip/track processing, without the master effects or legacy master fades, and returns them through the existing master once. Internal bounce media uses float WAV to retain headroom. Original selected clips are muted and retained; solo and tails are preserved; undo restores the previous state.
- `aedit.js`: waveform buckets retain channel extrema instead of averaging stereo channels. Float WAV is used only for internal bounce media; normal WAV exports remain 16-bit PCM.
- One-track and All tracks trims rebase retained clips and timed effects to zero. Partial fades retain their original gain curves using optional `fadeFrom`/`fadeTo` values; legacy master fades are converted to equivalent timed effects for the trim. A single-track trim within a multitrack project preserves synchronization and tells the user. New effects cover their target unless an explicit range is selected.
- Simple mono WAV exports retain one channel. Stereo sources, noncentral pan, and enabled echo/reverb retain stereo; MP3/M4A behavior is unchanged.
- `index.html`: clearer empty-paste message, matching context-menu shortcuts, readable notification button, audio notification positioning above transport.
- The harness builder accepts Windows CRLF checkouts. Existing Repeat tests exercise the actual form. The MP3 size test now checks expected 192 kbps byte count and duration instead of assuming every WAV has two channels.

## Verification

Final source was tested using disposable browser storage and a separate copied Electron 33.2.1 runtime/profile. The packaged native test app was verified byte-for-byte against every file in `app/`.

| Check | Result |
|---|---|
| Node syntax, references, line endings, versions, stitcher | Pass |
| Rotation | 24 pass |
| Editor polish | 35 pass |
| Existing audio timeline | 24 pass |
| WAV/MP3/M4A export | 6 pass |
| Step guides | 10 pass |
| Review 10.0.3 regressions | 8 pass |
| Second review regressions | 11 pass |
| Audio pitch and complete UI regression | 7 pass, including 82 underlying UI checks |
| New audio 10.1.3 regressions | 17 pass |
| New native audio 10.1.3 checks | 9 pass |
| Native PDF/save paths/capture/helper/OCR | 8 pass |
| Native helper probe/lifecycle | 2 pass |

The new bounce checks compare rendered PCM before and after with master gain, track gain/pan, solo, effects tails, and intermediate levels above full scale. The native test checks Repeat without `prompt()`, keyboard paste, undo, zoom, effect defaults, real IPC file output, notification contrast/placement, and small-window inspector reachability. Screenshots were visually inspected.

Initial MP3 testing detected an obsolete stereo-WAV compression-ratio assumption after mono export was fixed. The revised test independently checks MP3 bytes against bitrate and duration; export then passed. A further PCM comparison exposed changed gain curves when trimming part of a fade. That failed before the repair and passed after it, with maximum sample difference below 0.00000002. An initial native test launch lacked a packaged resources directory; a separate packaged test app corrected the test environment. The native step-guide suite requires an absolute disposable-profile path and a quitting flag to avoid hanging on hide-to-tray during cleanup; its cleanup was corrected and it exited successfully. No product behavior was weakened to bypass these failures.

The obsolete `layer-media-tests.cjs` suite was excluded as documented in HANDOFF: it targets the replaced pre-9.9.4 audio interface and has eight known stale failures. Physical microphone quality, long-running hardware drift, and the company's 30-minute benchmark were not remeasured in this batch. Fake microphone capture and playback/export pitch checks did run.

## Deferred

Recording into the current project, portable editable project files, recording recovery, loudness tools, noise cleanup, mixer redesign, icon changes, and broader terminology changes remain outside this bug-fix update. New recording still creates a separate Library item. Zoom worked in both browser and native Electron and needed no source change. Existing native inputs were already tabbable; small-window inspector controls were reachable by scrolling.

## Delivery

Development branch: `v10-dev`. Install through `tools/update-installed.ps1` after validation, with app/profile backup and file verification. Do not publish a release or change `main` until the owner has tried this version and approves release.
