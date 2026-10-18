# Saveit — developer handoff

Development version: **10.1.5** (noise cleanup and loudness matching for owner testing; latest published release is **10.1.4**). Development branch: `v10-dev`. Repository: https://github.com/stuartraymor/Saveit

Voice cleanup: read `AUDIO-CLEANUP-10.1.5.md`, `CHANGES-10.1.5.md` and `VALIDATION-10.1.5.md`. `audio-cleanup-worker.js` performs local noise-profile spectral reduction and BS.1770-style integrated LUFS measurement; `audio-cleanup.js` owns cancellable worker jobs. Cleanup adds float WAV sources and stores each selected clip's original source index in `noiseOriginal115`; trim coordinates stay unchanged. Restore originals swaps the source pointer back. The profile is editor-local; cleaned/original sources persist. Loudness matching appends master gain, caps sample peaks at −1 dBFS and sets `loudnessStereo115` so WAV agrees with stereo mix/MP3/M4A. Lossy exports can re-encode for measured loudness compensation. The meter is not a certified true-peak or LUFS compliance implementation. Never publish 10.1.5 or update main without the owner's approval.

Audio studio: read `AUDIO-STUDIO-10.1.4.md`, `CHANGES-10.1.4.md`, and `VALIDATION-10.1.4.md`. `audio-effects.js` defines voice EQ/high-pass/dynamics/gain, presets, and response diagrams. `audio-dynamics-worklet.js` is loaded per context for stereo-linked compression and sample-peak limiting; `AudioFX.prepare(ctx,p)` must finish before scheduling active dynamics. `audio-engine.js` shares those graphs between playback/export and exposes separate channel meters. `effectsBypassed114` on a clip/track/project bypasses that rack; `voicePreset114` on an effect identifies replaceable preset effects. Peak normalization adds a normal editable gain effect, not a LUFS adjustment. New recording still creates a separate item. The owner requested voiceover/tutorial priorities. The owner authorized publishing 10.1.4. Published at https://github.com/stuartraymor/Saveit/releases/tag/v10.1.4 from main commit a44e772f652a5282a8fc7d23d0e1c6a1467d56d4. All 51 app files in Saveit-10.1.4.zip match the tested source and installed app; ZIP SHA-256: 860c4cf7bc5e876fb786dbe47210f778f8d8f9f6b79f409094864b22c56f98b9.

Audio handoff: read `CHANGES-10.1.3.md` and `VALIDATION-10.1.3.md` for the latest bug fixes and checks. Repeat now uses an app dialog, Ctrl+V pastes onto the selected track, bounce renders before master processing using internal float WAV, waveform peaks retain both stereo channels, simple mono WAV output stays mono, and trims preserve partial fade curves (`fadeFrom`/`fadeTo`). One-track/All tracks trims move to zero; trimming one track in a multitrack project preserves sync. New recording still creates a separate item. These bug fixes are included in the published 10.1.4 release; the new voice tools are described above.

This document is for a developer who has **never seen Saveit, never used Snagit, and has no history with this project**. Read sections 1–3 first (15 minutes), then 4 and 5 before you touch code. Everything else is reference.

---

## 1. What Saveit is, and why Snagit matters

**Saveit is a Windows desktop app for capturing the screen, marking it up, recording video and audio, and building step-by-step guides.** It is built for making clear work instructions and how-to documents quickly. It is written in plain JavaScript on **Electron 33.2.1**, with no build step and no framework.

It is deliberately a clone, in spirit, of two TechSmith products. The owner uses them as the **reference for behaviour, naming and icons**. When a design question comes up, the answer is almost always "do what Snagit does", unless the owner says otherwise.

### Snagit in five minutes (the thing you are matching)

**Snagit** is a screenshot tool. You press a hotkey (Print Screen), the screen dims, and you drag a box around what you want. The picture opens in the **Snagit Editor**, where you mark it up and then save, copy or share it.

- **Capture types:** a region you drag, a window, the whole screen, a **scrolling capture** (it scrolls a long page for you and stitches the pieces), and a **step capture** (a screenshot on every click). It can also record the screen as video.
- **The Editor** is a canvas with a toolbar. The tools you must know: **Arrow, Callout** (speech bubble with a tail), **Text, Shape** (rectangle/ellipse), **Line, Step** (numbered circle, auto-renumbers), **Stamp** (small icons), **Highlight, Pen, Blur** (hide private data), **Spotlight** (dim everything except a box), **Magnify** (zoom bubble), **Fill, Erase, Cut out** (remove a strip and close the gap), **Crop**, **Effects** (borders, shadows, filters). Every object you draw stays editable until you flatten it: you can select it, move it, resize it with handles, **rotate it with a round handle**, change colour, and reorder it in a **Layers** list.
- **The Library** keeps every past capture automatically, with folders and search. There is also a thin **Recent** strip at the bottom of the editor.
- **Grab Text** reads the text out of a picture (OCR) so you can copy it.
- **Share/Save** to many file types; copy to clipboard.

**Camtasia** is TechSmith's video editor: a multi-track **timeline** (video, audio, captions, on-screen items), trim/split/move clips, transitions, zoom-and-pan, callouts that appear and disappear, audio effects. Saveit's video and audio editors follow it.

You can install trial versions of both from techsmith.com to see the behaviour first-hand. That is the fastest way to understand what "match Snagit" means.

### What Saveit adds that Snagit does not
- **Step guides** that export straight to **Word, searchable PDF, PowerPoint, PNG, JPG** or a Saveit file.
- **Privacy tools:** Grab Text can find emails and phone numbers and cover them.
- A free, local, no-account tool; everything stays on the computer.

### Who uses it
Mainly people writing work instructions and training material. Plain language matters in the UI and in release notes: **the owner is not a developer** and wants every user-facing message, tooltip and change note written in simple, friendly words ("Saved to …", "Ctrl+Z to undo").

---

## 2. Get it running (about 10 minutes)

Requirements: Windows 10/11, Git, Node.js 20+ (only for tests and tooling), the Electron 33.2.1 Windows runtime.

```
git clone https://github.com/stuartraymor/Saveit.git
cd Saveit
git checkout v10-dev
```

**Run from source.** Get the Electron runtime (`electron-v33.2.1-win32-x64.zip` from the Electron GitHub releases; `install.ps1` pins its SHA-256), extract it somewhere, then:

```
path\to\electron.exe app
```

**Always run development builds against a disposable profile**, never your real library:

```
set SAVEIT_REVIEW_DATA=C:\temp\saveit-test-profile
path\to\electron.exe app
```

`SAVEIT_REVIEW_DATA` makes Electron keep its data (including the IndexedDB library) in that folder.

**Install like a user would:** double-click `Install.cmd` (it downloads and verifies the runtime unless `electron.zip` sits next to it, installs to `%LOCALAPPDATA%\Programs\Saveit`, and adds shortcuts). To update an existing install from source with a safety net, use `tools\update-installed.ps1` (see section 6).

**Tests (browser, no desktop needed):**

```
npm install playwright          # in any folder; set NODE_PATH to its node_modules
node tests/run-node-tests.js    # parses every script, checks versions and line endings
node tests/build-harness.js C:\temp\h        # builds a test copy of the app
node tests/serve.js C:\temp\h 8944           # serves it (leave running)
node tests/rotate-tests.cjs http://127.0.0.1:8944 C:\temp\evidence
```

The tests use Microsoft Edge (`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`) by default; set `SAVEIT_BROWSER_PATH` to use another Chromium. Details in section 7.

---

## 3. Repository map

```
app/                      the whole application (this folder is what gets installed)
  main.js                 Electron main process: windows, global hotkeys, capture, recording, step capture, PDF, OCR, file dialogs (CRLF line endings)
  preload.js              the bridge: exposes window.bench to the page (CRLF)
  index.html              THE EDITOR: all markup, CSS and one big script (~2,900 very long lines; see section 4)
  vedit2.js               video editor (timeline, captions, effects, export)
  aedit.js, audio-*.js    audio: recording, legacy editor, clip model, engine, timeline editor
  audiobar.js, capbar.css the Image | Video | Audio capture-bar controls, shared by the editor and the widget
  imgtools.js             pixel tools: fill, smart detection, simplify, cut
  webm.js                 writes the missing Duration into WebM files
  gif.js, stitch.js       GIF encoder; scrolling-capture stitcher
  fxdefs.js, fxui.js, icons.js, devices.js, camdraw.js   effects, icons, device lists, webcam
  widget.html, overlay.html, recbar.html, steps.html, campreview.html, camsettings.html, picker.html, quick.html, manual.html   the small windows
  ocr.ps1                 Windows OCR through PowerShell (Windows.Media.Ocr)
  pptxgen.bundle.js       third-party PowerPoint writer (licence in third-party/)
  third-party/            lamejs (MP3 encoder, LGPL-3.0), jszip, pako, pptxgenjs licences
  saveit-steps.exe        native Step Capture helper (built from native/saveit-steps.cs)
native/saveit-steps.cs    source of that helper (C#, builds with the compiler that ships with Windows)
tests/                    all automated tests and the harness (section 7)
tools/                    version.js (bump versions), update-installed.ps1 (back up + install), build-steps-helper.ps1
install.ps1, Install.cmd, Reinstall.cmd, Uninstall.cmd, uninstall.ps1    the installer
CHANGES-<version>.md      one release note per version, back to 3.6.0 (the history of every decision)
PLAN-*.md, VALIDATION-*.md, INSPECTION-*.md   older planning and validation records
AGENTS.md, CLAUDE.md, VERSIONING.md           workflow and version rules (section 5)
```

`main` on GitHub holds **published releases only**. All development happens on `v10-dev`.

---

## 4. How it works

### 4.1 Processes and windows
Electron has a **main process** (`main.js`, Node) and **renderer pages** (HTML). Security settings are on: `contextIsolation: true`, `nodeIntegration: false`. A page can only talk to the desktop through the functions in `preload.js`, which appear as `window.bench`. Most IPC handlers in `main.js` that act for the editor start with `mainSender33(e)`, which throws if the request did not come from the main window. **Keep that pattern for any new handler that reads or writes files, the clipboard or the screen.**

Windows: the editor (`index.html`); a floating **widget** (the small capture bar shown when the editor is hidden); a full-screen **overlay** for dragging a capture region (it receives a screenshot of the screen and draws on top); a **recording bar**; a **step bar** for Step Capture; a countdown window; webcam preview/settings; a picker for choosing a window; quick markup.

Global hotkeys (registered in `main.js`): Print Screen = region, Shift+Print Screen = window, Ctrl+Print Screen = full screen, Ctrl+Shift+X = region (backup), Ctrl+Shift+R = start/stop recording, Ctrl+Alt+S = step capture, F9 = add a step. Closing the editor hides it to the tray so the hotkeys keep working.

### 4.2 The editor is one big script — and that matters
`app/index.html` contains **one IIFE** with almost everything in it. A separate `.js` file cannot reach its internals (`S`, `drawShape`, `render`…), so **new editor code goes inside that script**. The file has sections marked `// ---------- name ----------` (state, storage, rendering, selection UI, pointer, Grab Text, export, capture, tools rail, properties, tray, library, keyboard, step guides, boot, then later layers). Use search, not scrolling.

**The layering pattern.** Features added later are layered on by wrapping earlier functions:

```js
const open0 = openItem;
openItem = function (it) { const r = open0.apply(this, arguments); /* extra work */ return r; };
```

`hit`, `drawShape`, `bbox`, `handles`, `setTool`, `renderProps`, `openItem`, `selBox`, `resizeByHandle`, `startText`, `commitText` have all been wrapped several times. **Order matters.** When you change behaviour, find every layer: `grep -n "name=function"`. Real example: a rotation feature worked everywhere except one later `hit` wrapper that tested the object's unrotated rectangle, so clicks selected the wrong thing. Another: the Video screen disabled toolbar tools, and the Audio screen's own cleanup re-enabled them, so the disabling had to be made repeatable. If something "should work but doesn't", suspect a wrapper that runs after yours.

The outer script runs top-to-bottom; there is an inner `(() => { … })()` block (the "9.x" features) that holds some helpers such as `bbox0`, `ROT9`, `xformShape9`. Code outside that block cannot see them. The rotation helpers (`rotOK103`, `pivot103`, `rotPt103`) were deliberately defined in the **outer** scope for this reason.

### 4.3 Data model
**Items** live in `S.items` (newest first). `kind` is one of:
- `image`: `{id, name, base (canvas), shapes[], fx, undo[], redo[]}`.
- `guide`: a step guide; `steps[]` are image items; `pageShapes[]` are shapes drawn on the guide page.
- `video`: `{blob, mp4, webm, edit, …}`; `edit` is the multi-clip timeline project (see `vedit2.js`).
- `audio`: `{tracks[], edit, audioProject}`; `audioProject` is the clip/track/effect model (`audio-project.js`); original recordings are never changed.

**Shapes** are plain objects: `{id, t, x1,y1,x2,y2, c (colour), fill, w (line width), fs (font size), …}` where `t` is `rect, ellipse, highlight, callout, text, step, stamp, pen, arrow, line, blur, spotlight, magnify, img`. Extra fields per type (`tx,ty` callout tail, `pts` pen points, `src` picture data URL, `groupId`, `hidden9`, `locked9`, `name9` layer name…). **`rot` is an angle in degrees about the centre of the object's own frame**; it applies to `text, step, stamp, rect, ellipse, highlight, callout, pen, img` (not arrow/line, which rotate by moving their end points, and not blur/spotlight/magnify).

**A fresh capture is a picture object (`t:'img'`) on a blank white base canvas** (`base._blank`), not pixels in the base. That is why the Image tab, Layers, rotation and groups all work on a capture. A canvas that contains picture objects gets a 40 px margin around it (`picMargin`), and coordinates are offset by `padX()/padY()`. Convert pointer positions with `pt(e)`.

**Undo** is a snapshot stack: `snap()` stores `cloneShapes()` (a JSON copy) before a change. Consequence: after Undo the objects are **new objects**, so any code (or test) holding a reference to the old object has a stale one. Re-find by `id`.

**Storage.** The library is in IndexedDB `capture-bench` (version 2). Small settings are in `localStorage`: `saveit.opts`, `saveit.fx`, `saveit.quality` (JPG/WebP quality), `saveit.audioKbps` (MP3/M4A), `saveit.folders`, `saveit.devices`, `saveit.cam`, `saveit.guideAddMode`, `saveit33.*`. Editable objects survive a round trip because items are saved as JSON plus blobs.

### 4.4 Capture, recording, media
- **Capture:** the main process hides the window, grabs the display with `desktopCapturer`, shows the overlay for region/window choice, and returns a PNG. Scrolling capture drives the mouse wheel and stitches frames (`stitch.js`).
- **Video recording:** `MediaRecorder` in the renderer, writing **both WebM and MP4** where the runtime supports it. MediaRecorder leaves the length out of WebM files, so `webm.js` writes the Duration into the header (new recordings, editor exports, and older recordings on save). Recording time is measured by the app, excluding pauses.
- **Video editing/export:** `vedit2.js` plays the timeline on a canvas and re-records it in real time to export (so exporting takes as long as the video).
- **Audio:** Web Audio. Mixing renders through an `OfflineAudioContext`; WAV is written by hand, **MP3 by the bundled lamejs**, **M4A through MediaRecorder `audio/mp4` (real time)**.
- **Step Capture:** `main.js` starts the native helper `saveit-steps.exe` (mouse and keyboard hooks plus Windows UI Automation, one JSON line per event on stdout: `READY`, `CLICK n`, `INFO {json}`, `TYPE n {json}`, `DOUBLE`). It falls back to an embedded PowerShell watcher if the exe is missing. The renderer turns control info into sentences in `stepTitleFrom`. The step bar is hidden by setting its opacity to 0 for 40 ms while the screenshot is taken. The helper never reads password fields; it exits when Saveit closes its stdin or on Stop.
- **Grab Text (OCR):** `ocr.ps1` calls Windows' built-in `Windows.Media.Ocr`. It enlarges tiles 2× (3× for small pictures) first, because small text is misread otherwise. `main.js` removes duplicate words from tile overlaps, groups words into rows, and puts a tab between words that are far apart. Text annotations (callouts, text boxes) are not OCR'd from pixels; their text is read from the shapes and appended.
- **Guides → files:** Word via a hand-written docx builder; **PDF by printing an HTML page with `printToPDF`** (real, searchable text; a picture-based fallback exists for the browser harness); PowerPoint via `pptxgen.bundle.js`; PNG/JPG render the guide page to a canvas.

### 4.5 Saving rules (a frequent source of surprise)
The first Save of an item in a session opens the Windows Save window at the item's last file and type; later Saves in the same session overwrite silently (`sessionSaved34`). Save as… always asks. After saving, the message "Saved to …" has an **Open folder** button. Exports show "Preparing…" (a toast with duration `0` stays until replaced). Any new export path must replace or clear that toast on success, cancel and error.

---

## 5. How the owner wants work done

1. **Version numbers** (`VERSIONING.md`): `MAJOR.MINOR.PATCH`, MINOR and PATCH each run 0–12. Every iteration adds one to PATCH; after `.12` it rolls over (`10.0.12 → 10.1.0`, `10.12.12 → 11.0.0`). Bump **only** with `node tools/version.js bump`; it updates `app/package.json`, `install.ps1` (two places) and `README.txt`, and creates `CHANGES-<version>.md`. The node tests fail if they disagree.
2. **One iteration = one finished change**, with a release note in `CHANGES-<version>.md` written in plain language (what changed, why a user cares, what was *not* changed and why).
3. **Validate, back up, install, let the owner try it.** `tools\update-installed.ps1` does the backup, install and verification (below). Then ask whether to release. **Never publish a release or touch `main` without the owner's yes.** Commit each iteration to `v10-dev` (message starts with the version) and push.
4. **Protect the owner's library.** Use disposable profiles for tests. `update-installed.ps1` copies the whole profile to a `Saveit-library-backup-before-<version>-<time>` folder next to the source, verifies the copy file by file, and checks the runtime was not changed.
5. **Report honestly.** If a test fails, say so; if something was not verified, say so. The owner relies on the notes.
6. **Ask before big or ambiguous changes.** The owner will answer short questions quickly.

### Treat outside packages as untrusted
The owner sometimes receives folders from outside reviewers or other AI assistants (scripts, patches, an `.exe`). **Read them; do not run them.** Re-implement the ideas yourself and build any binary from source you have reviewed. One reviewer's "verified" patch had a defect: it would have broken step wording because a trailing `//` comment swallowed the rest of a line. Our own test caught it.

---

## 6. Release procedure (after the owner says yes)

1. `node tools/version.js bump`, write the CHANGES file, run all tests (section 7), commit on `v10-dev`, push.
2. `powershell -NoProfile -ExecutionPolicy Bypass -File tools\update-installed.ps1` installs it on the machine and reopens Saveit.
3. Build the release commit in a **separate worktree** from `origin/main` so your working folder is untouched:
   - `git worktree add ..\release-wt -b release-X origin/main`
   - `git checkout v10-dev -- app Install.cmd Reinstall.cmd Uninstall.cmd install.ps1 uninstall.ps1 README.txt native tools/build-steps-helper.ps1 "PLAN-*.md" "CHANGES-*.md"`
   - copy `README.txt` over `SETUP.txt` (GitHub keeps both); edit `README.md` (features and the "What's new" links); commit as `Saveit X`.
   - **Do not** put `tests/`, `AGENTS.md`, `CLAUDE.md`, `VERSIONING.md`, `tools/version.js` or `tools/update-installed.ps1` on `main`.
4. Make the zip: `git -c core.autocrlf=false archive --format=zip --prefix=Saveit/ -o Saveit-X.zip HEAD -- . ":(exclude)README.md" ":(exclude).gitignore"`.
5. Check the release `app/` is byte-identical to the tested one (`diff -rq`), then `git push origin release-X:main` and `gh release create vX Saveit-X.zip --target main --title "Saveit X" --notes-file notes.md`. Tag `vX` only for published releases.

---

## 7. Testing

**Node tests (fast, no browser):** `node tests/run-node-tests.js` parses every script and inline script, checks that every file `index.html` loads exists, that `main.js` and `preload.js` keep **CRLF** line endings, that all versions agree, and runs the scroll-stitcher tests. Run it before every commit.

**Browser tests (Playwright + Edge).** `tests/build-harness.js <dir>` builds a copy of `app/` with a stub for `window.bench` (so no desktop is needed), a `window.__T` handle that exposes editor internals, and helpers (`QA.canvas`, `QA.toneWav`, `QA.openVideo`, …). Serve it with `tests/serve.js <dir> 8944`. To expose another internal to a test, add its name to the `handleNames` list in `build-harness.js`. Suites (run with `node tests/<name>.cjs http://127.0.0.1:8944 <evidence-folder>`):

| Suite | Checks | Covers |
| --- | --- | --- |
| `rotate-tests.cjs` | 24 | rotation of objects, pictures and groups |
| `polish-tests.cjs` | 35 | selection borders, cursors, Crop, Cut out, Simplify |
| `audio94-tests.cjs` | 24 | the multitrack audio timeline |
| `audio-export-tests.cjs` | 6 | WAV/MP3/M4A saving |
| `stepguide-tests.cjs` | 10 | step-guide exports, messages, Save rules, step wording |
| `review103-tests.cjs` | 8 | fixes from the first review |
| `review2-tests.cjs` | 11 | fixes from the second review (Fill, WebM, Grab Text…) |
| `audio-pitch-tests.cjs` | 7 + the 82-check regression | pitch/speed checks; **the "full browser regression suite" (`ui-tests.js`, 82 checks) runs from here**: `SAVEIT_QA_URL=http://127.0.0.1:8944 node tests/audio-pitch-tests.cjs` |

**Real-Electron tests** (need the Electron runtime): `node tests/native-stepguide.cjs <electron.exe> <app folder> <scratch folder>` (8 checks: real PDF bytes, Open folder handler, Save-window paths, a window with opacity 0 is not in a screen capture, Step Capture starts and stops the helper, right-click menu items, and **real Windows OCR on `tests/fixtures/sample-capture.png`**). `node tests/native-steps-helper.cjs` tests the helper exe; add `--live` to click and type in a small window of its own (it moves the mouse for about ten seconds, so leave the mouse alone).

**Known test caveats:**
- `layer-media-tests.cjs` has **8 stale failures** (it drives the audio screen that was replaced in 9.9.4). They pre-date version 10 and can be ignored or the file rewritten.
- The audio-pitch test "playback wall clock" can fail once when the machine is busy; re-run it alone.
- A page loaded in a hidden window stalls `requestAnimationFrame` and image decoding; browser tests must run with the page visible.
- In a harness page, once a picture object exists the canvas gains a 40 px margin; position helpers must add `__T.padX()/padY()` (mapping a screen point to image coordinates otherwise lands 40 px off).
- To find where a feature lives, `grep` for its CHANGES entry first; each file names the version that introduced it.

---

## 8. Gotchas that cost time

- **Shell quoting.** When writing code from a shell (heredocs, `node -e`), backslashes in regular expressions are silently dropped (`\d+` became `d+`). Write patch scripts and files with an editor, not `echo`/heredoc, when they contain `\`, `$` or backticks.
- **Line endings:** `main.js`, `preload.js`, `Install.cmd`, `Reinstall.cmd`, `Uninstall.cmd` are **CRLF**; `index.html`, `vedit2.js`, `package.json`, `install.ps1` are LF. Editing CRLF files with tools that normalise endings breaks `run-node-tests.js`. Patch scripts used in this project convert the find/replace text to the file's own endings.
- `index.html` has the text `</body>` inside a template literal; any tool that injects before `</body>` must use the **last** occurrence (the harness does).
- **Line comments inside long one-line functions.** Many functions are written on a single long line. Adding `// note` at the end of a statement mid-line comments out the rest of that line. Put comments on their own line or use `/* */`.
- **Test objects after Undo are new objects** (section 4.3).
- **Canvas drawing coordinates:** image space vs canvas space differ by `padX()/padY()`; screen-to-image is `pt(e)`, which divides by zoom and subtracts the pad.
- **Cursors** over handles come from `HANDLE_CURSOR` / `RZ_CUR80`, which are `Proxy` objects that turn with a rotated object. Use the table; don't set `cv.style.cursor` directly for handles.
- **Installing** closes any running Saveit. The owner may be mid-task; install at the end of a batch of iterations unless asked.
- **Antivirus:** `saveit-steps.exe` is unsigned and installs mouse/keyboard hooks. Expect a SmartScreen/Defender question; there is no code-signing certificate yet.

---

## 9. Where things stand

### Version history in one screen
3.x–8.x: capture, markup, Library, step guides, video editor foundations (see `CHANGES-3.6.0.md` … `CHANGES-8.14.0.md`).
9.0–9.8: groups, Layers panel, undo/redo, zoom & pan, visual effects, layouts and backgrounds, webcam track, fixes from the first outside QA report.
9.9.x: Audio workspace (capture bar, two microphones, multitrack timeline with clip/track/master effects, WAV export); built partly by another AI assistant (Codex).
**10.0.0** (new numbering) → **10.1.2**: Simplify size equation (pixels × percent = pixels); MP3/M4A saving; fixes from two company reviews; rotation for annotations, pictures and groups; step-guide fixes and the native Step Capture helper; tidier Video/Audio screens; right-click text menu; Fill fix; WebM lengths; more accurate Grab Text. Every one has a `CHANGES-<version>.md`.

### Two outside reviews have been worked through
1. A review of 9.9.4 (found top-bar mode bug, Fill tolerance, annotation count, audio saving formats, etc.). Done, except the items listed below.
2. A review of 10.0.11 (right-click menu, Fill flooding, WebM length, Grab Text accuracy, small fixes). Done, except Grab Text "select on the picture".

### Open work, in suggested order
1. **Grab Text: select text directly on the picture** (review item F2, high value, about half a day). After OCR, show a transparent layer over the canvas with one span per recognised word, positioned from `bench.ocrLayout()` word rectangles (`ocr.ps1` already returns every word with its rectangle in original-picture pixels). Make it a layer sized in image pixels and scaled with CSS `transform` so zoom needs no recalculation (a `ResizeObserver` on the canvas can update the scale). `user-select:text`, a `::selection` highlight, a custom `copy` handler that rebuilds clean text from the selected spans (spaces within a row, tabs for big gaps, newlines between rows), Esc / tool change / any edit removes it, and `pointer-events:none` whenever it is not active so drawing tools still work. The right-click **Copy** menu already exists (`web-contents-created` in `main.js` shows Copy for selected plain text). Add a "Select text on picture" button to the Grab Text panel (`renderProps` wrapper near the end of the Grab Text section).
2. **Button wording across Image, Video and Audio.** The same action has different names (Save / Save audio… / Export; Cut out / Delete / Ripple delete / Delete, keep gap; Crop / Trim to In–Out / Trim to range; Reset / Restore original). The owner wants one set of words but has not chosen them: ask before renaming. Also: the audio editor's own small undo/redo arrows duplicate the top-bar ones (which now work for audio and video).
3. **Video Save: soundtrack-only** (MP3/M4A from a video). GIF is now in the first Save window.
4. Smaller known limits: a rotated picture is clipped at the canvas edge (no auto-expand); Grab Text still lists sidebar labels in the row where they sit (a column splitter was tried and removed because it mis-ordered ordinary text); Step Capture cannot see clicks inside apps running as administrator; a library backup is one big file.

### Deliberately deferred (bigger features the reviewers asked for)
Cursor highlight / click effects and keys-on-screen in recordings, auto-captions from speech, noise removal and volume levelling, green screen / background removal, one-click share (Teams/Slack/Drive) and cloud sync, automatic updates, a light theme and other languages, TIFF/AVIF/HEIC images, and reopening audio/video edits as a project file. None is started. Code-signing the installer and `saveit-steps.exe` would help with antivirus warnings.

---

## 10. First-week suggestions

1. Install Snagit's trial and use it for an hour; then use Saveit for the same jobs. Note every difference.
2. Run Saveit from source with a disposable profile; capture, mark up, rotate a picture, record 5 seconds, make a 3-step guide and export it to PDF and Word.
3. Run `run-node-tests.js`, then build the harness and run `rotate-tests.cjs` and `review2-tests.cjs`.
4. Read `CHANGES-10.0.6.md`, `CHANGES-10.0.10.md`, `CHANGES-10.1.2.md` and `VERSIONING.md`, then `grep` the wrapper chain for `hit=function` in `app/index.html`.
5. Pick up open item 1 (select text on the picture). It touches the canvas layout, OCR data, the clipboard and the right-click menu, so it teaches you most of the code.

*Questions about priorities or wording go to the owner; they answer short questions quickly and prefer plain language over technical detail.*
