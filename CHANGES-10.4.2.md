# Saveit 10.4.2

## Grab Text window
Grab Text still starts the same way: **Selection > Grab text**, then **Capture** (in the editor or the widget). Drag a box, adjust it if needed, and press **Grab text**. Two windows then open:
- the new **Grab Text window**, with the text;
- the **Saveit editor**, with the picture of the area you grabbed (so it can be marked up or saved like any capture).

The Grab Text window opens straight away and shows "Reading text…" until the text is ready. It is a small word processor:
- **Editing:**
  - Undo and redo; paragraph styles (Normal, Heading 1–3, Quote, Code); font and size.
  - Bold, italic, underline, strikethrough; text colour and highlight.
  - Alignment, bullets, numbering, indent; clear formatting.
- **Table:** lines with columns (Grab Text puts a tab between table columns) become a real table. It pastes into Word and Excel as a table.
- **Text tools:**
  - join lines into one paragraph, join wrapped lines but keep paragraphs;
  - remove blank lines, fix spacing, tabs to spaces;
  - UPPERCASE, lowercase, Title Case, Sentence case;
  - straight quotes and dashes, keep only numbers and symbols;
  - sort lines, remove duplicate lines.

  Each tool works on the selection, or on everything when nothing is selected.
- **Find and replace** (Ctrl+F, Ctrl+H, F3): match case, replace one, replace all.
- **Wrap** on or off, **zoom** 75–200% (or Ctrl+mouse wheel).
- **Spelling:** a right-click shows suggestions, plus cut, copy, paste and paste as plain text.
- **Copy all** (Ctrl+Shift+C) puts the text on the clipboard, together with its formatting for programs that use it.
- **Save as…** a text file (.txt) or a web page with the formatting (.html, opens in Word).
- **Print** (Ctrl+P).
- **Picture:** the picture the text was read from is shown beside the text, to check what was read; click it to zoom.
- **Grab again** (Ctrl+G) grabs another area. **Editor** brings the Saveit editor forward.
- **This session's grabs:** earlier grabs stay in a list at the bottom while Saveit is open, so nothing is lost when you grab again.
- Word, character and line counts.
- Closing the window only hides it, so the next grab opens it instantly. Like the editor, it is never in your screenshots.

## Save grabbed text in the library
Nothing is saved automatically. **Save to library** (Ctrl+S) saves the text under the name at the top of the window.
- After a change, the button says **Save changes**, and saving updates the same library item.
- The **Library** has a new **Text** filter. Saved texts show a preview of their first lines.
- Double-click a saved text to open it again in the Grab Text window; the editor keeps whatever it has open.
- Saved texts can be renamed, put in folders, deleted, backed up and restored, and saved to files (.txt or .html) like other items.
- Saved texts stay in the Library, not in Recent, so Recent stays for captures.

## Grab Text reads better on bright, dark and stretched text
When the first reading looks doubtful (odd-looking words, or letter-shaped marks that were not read), Saveit reads the area again and keeps the best reading:
- **A cleaned copy:** dark text on white everywhere. The background is worked out area by area, so dark toolbars, light pages, gradients, glare and noise all become plain black on white.
- **Unusual letter shapes:** when the letters are unusually wide or narrow, it also reads copies with the width corrected.
- **Choosing a reading:** each reading is scored on how believable it is (real-looking words, numbers, dates and e-mail addresses count up; stray letters and odd symbols count down). Lines found only in an extra reading are added.
- **Small areas only:** this happens for selections up to 1 megapixel. A clear reading is not read again.
- **Sloping lines:** words that Windows reports as one sloping line now stay on one line. Before, the second half could come out as a separate line above the first.

| Measured with Saveit's real Grab Text | 10.4.1 | 10.4.2 |
|---|---|---|
| New test: 240 pictures with bright, dark, mixed, low-contrast and stretched text (tests/ocr-stress-contrast.cjs) | 17.6% wrong characters, 140 exact | 6.6%, 159 exact |
| · text stretched wide / tall / squashed | 38% / 18% / 21% | 6% / 6% / 3% |
| · solid dark backgrounds / dark and light areas stacked / photo-like backgrounds | 31% / 19% / 24% | 8% / 5% / 9% |
| The 500 varied pictures (tests/ocr-stress.cjs) | 32.3%, 218 exact | 30.2%, 223 exact |
| 48 realistic screenshots (tests/ocr-bench.cjs) | 3.17%, 132 of 148 lines exact | 3.17%, 132 of 148 lines exact |

Cost: about 0.2 s more on a doubtful reading; a clear reading takes the same time as before.

Still hard:
- text squeezed to about 60% width, where the letters touch;
- very small, blurred or heavy bold fonts;
- some short strings on noisy dark backgrounds that Windows' text recognition returns empty even after cleaning.

## Faster capture
| Measured on a 2560 × 1600 screen (tests/native-capture-timing.cjs) | 10.4.1 | 10.4.2 |
|---|---|---|
| Click **Capture** until the region selector is on screen, ready to drag | 0.45–0.63 s (about 1 s the first time after start) | 0.31–0.48 s (0.37 s the first time) |

What changed:
- **Saveit's windows vanish at once:** they turn fully transparent before they are hidden, so they leave the screen on the next frame instead of after the Windows hide animation. The wait is now 50 ms instead of 200 ms.
  - The test that paints the editor and widget bright magenta still finds 0.00% of them in the screenshot (8 runs each).
- **The selector appears ready to use:** it shows only once the frozen screen is drawn in it, so it never appears blank and takes the mouse straight away.
- **Faster drawing in the selector:** its hidden window is no longer slowed down by Windows' background throttling, and the screen's pixels are converted four bytes at a time.
- **No wait on the first capture:** the screen reader helper starts with Saveit, not on the first capture.

## Tests
- **New:**
  - tests/native-grabtext-window.cjs: 34 checks in the real app. Widget > Selection > Grab text; adjusting the box; both windows open; editing tools; copy with formatting; Save to library and Save changes; the Text filter in the Library; reopening a saved text; the window staying out of captures; quitting.
  - tests/ocr-stress-contrast.cjs: 240 pictures.
- **Changed:**
  - native-grabtext-10312 reads the text from the Grab Text window, and expects the picture in the editor.
  - The browser test harness has no Grab Text window, so it keeps the in-editor text dialog, which the browser version still uses.
  - The browser suites that only looked for Edge now also take `SAVEIT_BROWSER_PATH` (Chrome works).
- **One command for testing:** `tools\test-all.ps1`.
  - `-Quick` runs the node checks, the main browser suites and the most important real-app tests in 5–10 minutes. `-Full` runs everything (about 45 minutes). `-Area grabtext,capture,...` runs one part.
  - It copies the installed Saveit to a temporary test copy with this folder's app, and never touches the installed copy or your library.
  - Browser suites run three at a time. Real-app tests run one after another.
  - Failures that also happen in 10.4.1 are listed in tests/known-failures.json and reported as KNOWN; only NEW failures make the run fail. A summary is written to summary.txt.
- **Full run for 10.4.2:**
  - Passed: the node checks; the browser suites; and in the real app: Grab Text window, Grab Text on 48 screenshots, widget and editor button parity, widget hiding, the capture leaving Saveit out, capture timing (0.29–0.41 s), the 10.3.10 GUI checks, the walkthrough, the everyday workflow, callouts, clipboard, video 11.9 and the steps helper.
  - live-scroll, window-capture and paste-layer passed when run again by themselves (paste-layer is unreliable in 10.4.1 too).
  - Same as 10.4.1, not caused by this version: the step guide save-folder check, one OCR picture in native-ocr1112 (that test still improved from 3.45% to 2.63%), and the audio 11.3–11.6 tests, which need their own source copy. These are listed in tests/known-failures.json.
  - Not run properly, because of test setup and not Saveit: native-smoke, layer-media-smoke, record-controls and the two video journeys (they need their own runtime copy inside their evidence folder).

## Release record (2026-11-21)
- Published at https://github.com/stuartraymor/Saveit/releases/tag/v10.4.2 from main commit f4f39f0. It is a normal release (not a draft or pre-release) and GitHub's "latest".
- Assets: Saveit-10.4.2.zip (776,569 bytes, SHA-256 5f9aafd083a8e074e8889ce3e414db2762a95d969d3eeafaaf713471981600d2), .zip.sig (checked against the key in app/updater.js), .sha256, and Saveit-Setup.exe (859,136 bytes).
- The zip's app folder matches the tested app and the app installed on this PC, file for file (ignoring line endings). The main commit changes exactly the 17 files of this release; each keeps the line endings it has on main.
- Saveit-Setup.exe: tests/setup-ui-test.ps1 passed all 11 checks, installing into a scratch folder.
- Real update from GitHub: a scratch copy of 10.4.1 clicked Check for Updates, then Install Update (download and verify), then Install and restart. update.log: "result: ok - Saveit was updated to version 10.4.2 and is running." The updated app folder is identical to the tested one.
- Website (GitHub Pages, docs/ on main) rebuilt from f4f39f0; the learn page shows the Save to library step. The one-click link redirects to v10.4.2.
