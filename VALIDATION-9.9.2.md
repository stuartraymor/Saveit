# SaveIt 9.9.2 validation and handoff

Update: the two outstanding audio pitch assertions below were resolved as test measurement defects. See [audio pitch verification](VALIDATION-AUDIO-PITCH-9.9.2.md) for the current 82/82 result and native playback evidence. Results below describe the earlier run.

October 17, 2026. Starting commit: `46d1df7a54d69794455b8717e13c9a1ca6f783a4`. Development branch: `codex/9.9.2-final-polish`.

## Result

The requested selection, Crop, Cut Out workflow and Simplify dimension refinements are implemented. Existing colour options remain. No dependencies or runtime versions changed. The original source checkout's uncommitted installer edits and the installed 9.9.1 app remain untouched.

| Verification | Result |
| --- | --- |
| Existing Node parsing, assets, CRLF and four stitcher scenarios | PASS |
| Generated browser harness | PASS |
| New real-pointer interaction scenarios | **34 passed, 0 failed**, no renderer exceptions |
| Native Electron 33.2.1 with packaged 9.9.2 and separate profile | **8 passed, 0 failed** |
| Unchanged editor visual comparison | **0 changed pixels** out of 939,060; 1269×740, scale factor 1, exact comparison with tolerance 0 |
| PowerShell installer syntax | PASS; installer not executed |
| Existing broad regression suite | **78 passed, 2 failed**; failures are the two synthetic microphone pitch assertions below |

The focused suite covers Arrow at 50%, 80% and 120% zoom; all supported annotation borders/handles; Stamp creation on empty canvas; overlapping selections; locked/hidden objects; endpoints; tool switching; groups; imported images in Image mode; saving/reloading positions through IndexedDB; Crop at 50% and 100%, bounds, stationary base, resizing, cancellation, apply and undo/redo; both Cut Out axes, adjustment, exact fields, invalid/full-size strips, bounds, repeat/double-click, cancellation and unchanged cutting pixels; Simplify bidirectional pixels/percentages, original reference, independent dimensions, presets, rounding/limits, cancellation, annotation scaling, undo and existing colour presets.

Native smoke verifies app identity, disposable profile, source match, real preload version, pending Cut Out, linked Simplify controls, cancellation and editable Arrow creation. It does not capture the user's desktop, record real microphones/cameras, install over the existing app, or publish anything. The existing broad suite exercises video/PNG/JPG/GIF export, Library filtering, accessibility, waveform editing and other existing behavior using disposable media and stubbed bridges.

## Outstanding audio assertions

The first untouched 9.9.1 full baseline was 79/80, failing the synthetic Mic 2 pitch assertion (680 Hz measured, expected 660 Hz). The final 9.9.2 full suite was 78/80: Mic 1 measured 473 Hz (expected 440 Hz), Mic 2 measured 680 Hz. A focused recheck against the **unchanged 9.9.1 harness reproduced both failures**: Mic 1 474 Hz and Mic 2 680 Hz. These are reproducible baseline failures in the synthetic capture/export checks. This investigation does not establish whether they reflect the test timing/codec or the audio implementation; no physical microphone conclusion is justified. No audio source files changed. Do not describe all release checks as passing.

## Artifacts and review

The adjacent `polish-evidence/` directory contains `polish-results.json`, `native-results.json`, `regression-results.json`, `audio-baseline-recheck.json`, `visual-comparison.json`, the black visual diff and before/after PNGs, plus native and panel screenshots. The parent workspace contains the original full baseline JSON. These internal artifacts and disposable profiles are excluded from the setup ZIP.

`INSPECTION-9.9.2.md` records repository/executable identity, reuse, baseline and risks. `CHANGES-9.9.2.md` is the user-facing change summary. The setup ZIP contains the authored app, original installation entry points with 9.9.2 version metadata, README and changes. It uses the existing verified Electron download mechanism; it is not an offline runtime bundle.

No GitHub push, tag or public release was performed. The installer download and installation side effects were not exercised against the user's installation. The existing installer still has its established destructive replacement behavior; the pre-existing malformed retry edits remain only in the original checkout and are not included in this release candidate. Runtime security updates and licensing decisions for publication remain outside the supplied refinement scope.

## Reproduction

Use the project's existing Node runtime and externally available Playwright with installed Edge:

```powershell
node tests/run-node-tests.js
node tests/build-harness.js <external-harness-directory>
node tests/serve.js <external-harness-directory> 8933
# In a second shell, with Playwright available through NODE_PATH:
node tests/polish-tests.cjs http://127.0.0.1:8933 <external-evidence-directory>
```

For native smoke, copy the existing Electron runtime to a separate directory and copy this checkout's `app/` into its `resources/app/`. Set `SAVEIT_ELECTRON_PATH` to that copy's `Saveit.exe`, place a disposable 800×450 `native-fixture.png` in the evidence directory, then run `node tests/native-smoke.cjs <external-evidence-directory>`. The runner creates its own profile and quits only its own process. A packaged executable uses its own resources, so passing another source directory to the installed Saveit.exe is insufficient; the smoke runner verifies identity before editing.

Simplify retains the earlier picture-layer merge on tool entry; undo restores it. Cut Out retains the existing processing algorithm; this work changes selection/confirmation. The initial inspection and these limits should accompany review of the release candidate.
