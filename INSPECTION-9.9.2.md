# SaveIt 9.9.2 initial inspection — October 17, 2026

Inspection completed before implementation. Scope: supplied sections 1–6.4. The supplied plan stopped at the 6.5 heading; the user delegated judgment and agreed that extra colour controls were optional. Retain the existing colour controls without adding another colour system.

## Identity and safe baseline

- Running main process: PID 435740, `C:\Users\stuar\AppData\Local\Programs\Saveit\Saveit.exe`; window title and packaged `resources/app/package.json`: **9.9.1**. EXE file version **33.2.1** identifies the Electron runtime, not SaveIt's release.
- Source: `C:\Users\stuar\Downloads\Saveit-Setup-Online\Saveit`, origin `https://github.com/stuartraymor/Saveit.git`, branch `v8.0-dev`, commit `46d1df7a54d69794455b8717e13c9a1ca6f783a4`. All source `app/` files match installed files by SHA-256. No application-file differences were found.
- Pre-existing change: only `install.ps1` is modified in the source checkout. Its added process-wait loop has missing variable names and is syntactically invalid. Preserve this file untouched; work from the committed installer in the isolated worktree. Do not run the modified installer.
- Isolated worktree: this `saveit/` directory, branch `codex/9.9.2-final-polish`, starting at the exact commit above. The parent chat workspace has no commits and only an unrelated untracked `snagit-quick-look.json` referring to TechSmith Snagit; it is preserved.
- No settings or media are copied, deleted, or edited. Browser testing uses disposable canvas/media fixtures and a separate browser profile. Electron supports `SAVEIT_REVIEW_DATA` for a separate native test profile.

## Application and reusable components

Electron 33.2.1, authored JavaScript/HTML/CSS, Canvas 2D, Electron preload/IPC. No C++ compilation applies. Most editor logic is inline in `app/index.html`; processing is in `imgtools.js`; video editing uses `vedit2.js`; audio editing uses `aedit.js` and capture/device controls use `audiobar.js`/`devices.js`. MediaRecorder/Web Audio handle recording and mixing; Electron supplies desktop capture, clipboard, native dialogs, OCR integration and filesystem export.

Actual running UI inspected through the exact SaveIt window: Image canvas/right panel, Video timeline/right panel, Audio waveform/right panel, Library modal, Recents strip and floating capture widget. Dark colours, existing toolbar, narrow right panel, numeric inputs, buttons and handles are reusable. Capture selection/recording/settings implementations were also read. No real screen/audio recording or destructive action was performed. Accessibility exposes the native shell but not the web controls; screenshots and isolated browser DOM tests complement it. Renderer process reports device scale factor 2. Settings are distributed between capture controls, effect/webcam panels, context menus, workflow settings and local storage; no general Settings page was found.

Library payloads/catalog live in IndexedDB `capture-bench` version 2; localStorage stores capture options, styles and UI preferences. `recordItem`, `persistNow`, project export/import and `openItem` preserve editable objects. Library and Recents share these records. Clipboard supports rendered images/files and serialized editable annotations through `preload.js`/`main.js`. Undo/redo uses snapshots of the image, annotations and effects.

| Requested change | Current implementation and finding | Scoped components |
| --- | --- | --- |
| Selection movement/cursors | `handles`, `selBox`, `bbox`, `hitHandle`, `hit`, `moveShape` already support geometry/undo. No hit test for the drawn dotted rectangle. Stamp creation precedes movement; Arrow's hit test follows its stroke rather than its rectangle. Several capture/bubble event handlers can overwrite cursors. Image tab adds picture resize handlers. | `index.html`: selection geometry, canvas pointer handlers, Image-tab dispatch |
| Crop adjustment | Eight handles, inside movement, exact numeric controls and ratio control already exist. Hover handler runs in capture phase, then the generic bubble handler overwrites its cursor. Strict interior hit test misses exact border points. | `index.html`: `cropHit`, crop pointer handlers; reuse bounds and apply algorithm |
| Cut Out confirmation | `S.cutRect` previews the strip only while dragging; pointer release calls `applyCut`. Exact amount buttons also apply immediately. `ImgTools.cut` and `applyCut` already close the gap and shift annotations. | `index.html`: strip selection/adjustment, panel, confirmation and transient-state cleanup; retain `imgtools.js` cutting algorithm |
| Simplify dimensions | Width, height and one scale field are linked to a single 1–100% factor. No independent dimensions, ratio lock or size dropdown. Detail, colour count, outline, PNG estimate and preview already exist. Existing preset buttons include Half size, Fewer colours, Sketch and Reset. | `index.html`: Simplify panel/state/preview/apply; `imgtools.js`: optional separate preview dimensions |

## Baseline validation and build/install

- `node tests/run-node-tests.js`: PASS. All authored JS and inline scripts parse, assets exist, required CRLF is intact; four stitcher scenarios pass.
- `node tests/build-harness.js <external folder>`: PASS. Existing test harness builds without modifying application source.
- Existing `QA.runAll()` in isolated headless installed Edge: **79 passed, 1 failed**, 29.5 seconds. Existing failure: “Save WAV with Mic 2 solo has only Mic 2 (660 Hz)” measured 680 Hz. Other image/export, video/GIF, audio editing, accessibility, toolbar and Library assertions passed. The pitch failure predates edits; no audio repair is included in this scope.
- Packaging is an authored `app/` folder plus per-user PowerShell installer. Installer pins and verifies official Electron 33.2.1 by SHA-256, copies app assets and adds shortcuts. There is no transpiler, npm build script or dependency install needed. Tests are in `tests/`, with a bridge-stubbed browser harness and generated disposable media. Preserve runtime version and architecture.

## Dependencies, decisions and risks

1. Correct selection hit-testing before Stamp/Arrow creation; retain handle priority and existing endpoint controls. Match the actual drawn border and use screen-sized hit tolerance at any zoom. Preserve locked/hidden layers and overlapping selected-object priority.
2. Reuse Crop bounds/handles and stop conflicting hover dispatch. Keep cancellation, Enter/apply and image geometry unchanged during adjustment.
3. Retain a pending Cut Out strip, add boundary/move adjustment and exact inputs, then a red **Cut Out** confirmation in the existing panel. Reject empty/full/invalid strips, clear consumed selection immediately, and reuse the processing/undo algorithm.
4. Simplify percentages use the operation's original dimensions. Add independent width/height and percentages, lock, common exact presets and clear indication when a preset unlocks proportions. Keep existing colour options. Clamp valid dimensions to the existing image-resize limits (16,384 per side; 64 million pixels).

Main risks: layered event handlers, Image-tab special resizing, groups/locked layers, zoom transforms, asynchronous image readiness, stale previews after undo or item switches, annotation scaling and undo boundaries. Existing Simplify merges picture layers when entering the tool; preserve that established behavior and document it rather than changing layering architecture here. Public publication, installing over the user's running app and modifying the original dirty installer are outside this local refinement checkpoint. Release artifacts and validation must identify any remaining test limitations.
