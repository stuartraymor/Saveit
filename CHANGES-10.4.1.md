# Saveit 10.4.1

This is the first published version since 10.3.11. It includes everything in 10.3.12 and 10.4.0 (see CHANGES-10.3.12.md and CHANGES-10.4.0.md); those two were not published on their own.

## Faster capture and widget
| Measured on a 2560 × 1600 screen (tests/native-capture-timing.cjs) | Before | 10.4.1 |
|---|---|---|
| Click **Capture** (Image > Region) until you can drag a selection | 1.25–1.3 s | 0.40 s (0.63 s the first time after Saveit starts) |
| Click **Widget** until the capture bar is on screen | about 0.35 s, every time | 0.04–0.08 s |

What changed:
- **The screen is read by Saveit's own small screen reader** (`saveit-region-grab.exe`, already used by scrolling capture since 10.3.11), which stays running while Saveit is open, instead of Electron's desktopCapturer.
  - The picture is pixel-for-pixel the same (checked: 0 of 38,005 sampled pixels differ, including see-through windows).
  - If the reader is ever unavailable, Saveit falls back to desktopCapturer as before.
- **The frozen screen is handed to the region selector as raw pixels**, instead of being encoded as a PNG first (that took about half a second on a 2560 × 1440 screen).
- **The region selector is prepared in advance**, hidden, a moment after Saveit starts and again after each capture. It is rebuilt if the screens change.
- **The widget is kept (hidden) when it goes away** instead of being closed and built again every time. It is also prepared in advance a few seconds after start.
- **Capture waits less before reading the screen**: 200 ms after hiding the editor instead of 350 ms (80 ms after hiding the widget). A test paints the editor and widget bright magenta and checks they never appear in the screenshot.
- A hidden widget prepared in advance can't change the editor's settings (found by the bar-parity test while making this change).

## Grab Text, third round
A new stress test (tests/ocr-stress.cjs) draws 500 pictures with known text and reads each one through Saveit's real Grab Text. The pictures vary:
- 20 fonts (Segoe UI, Arial, Calibri, Times New Roman, Georgia, Verdana, Tahoma, Consolas, Courier New, Cambria, Trebuchet MS, Comic Sans MS, Lucida Console, Candara, Corbel, Bahnschrift, Franklin Gothic Medium, Constantia, Segoe Print, Impact);
- sizes 8 to 40 px, bold and italic;
- stretched and squeezed lettering (70% to 160% wide), tight and wide letter spacing;
- blur (up to 1.4 px), JPEG compression, slight rotation (up to 2°);
- 11 colour schemes, including dark mode, grey text, low contrast, coloured buttons, gradients, stripes and photo-like backgrounds;
- 100%, 125%, 150% and 200% display scaling;
- 14 kinds of text: sentences, capitals, money, dates, times, phone numbers, numbers and percentages, IDs and hex codes, e-mail addresses, web addresses, file paths, symbols, code, and product names.

| 500 stress pictures | Wrong characters | Read exactly right |
|---|---|---|
| 10.4.0 | 34.8% | 194 |
| 10.4.1 | 32.3% | 218 |
| 10.4.1, sharp text only (247 pictures) | 17.0% (was 19.1%) | 147 (was 132) |

Most of what is left is tiny or blurred text that Windows' own text recognition can't read (see below). On the 48 realistic screenshots of tests/ocr-bench.cjs nothing changed: 3.2% wrong characters, 132 of 148 lines exact.

What changed:
- **A short line that Windows read as nothing is read again at other enlargements.** Windows OCR sometimes returns nothing at all for a short line it can't match to words, such as `4,462,027`, `\\server\share\notes.txt` or `5 < 7 > 3`, although it reads the same picture at another size. This only happens for selections up to 1 megapixel that gave no text, so normal reads are not slower.
- **A lone narrow character, such as the "1" in a table's Qty column, is no longer skipped** by the second pass. (A re-read that gives only l, I or | is still dropped, since that is usually a border.)
- **Common misreads are corrected:**
  - `-S966.85` → `-$966.85`; `E70,441.53` → `£70,441.53`; `$999-39` → `$999.39`;
  - `3:18-3` → `3:18.3`; `6:41 .9` → `6:41.9`; `9: 35.5` → `9:35.5`; `Sep 3 , 2019` → `Sep 3, 2019`;
  - `86.2 oc` → `86.2 °C`; `500/0 off` → `50% off`; `2ø27` → `2027`; `INV-9S904` → `INV-95904`; `OxlCA62704` → `0x1CA62704`;
  - `npm install —save-dev` → `--save-dev`; `—/Downloads` → `~/Downloads`; `—$ sudo` → `~$ sudo`;
  - `a.b—c@contoso.org` → `a.b_c@contoso.org`; `example.corn` → `example.com`.
  - Each rule only fires on a pattern that isn't normal text; 13 checks make sure ordinary text ("Score 3: 25 points", "Pages 10-12", "the corn field", "He said — sure") is left alone.

## Still not readable (limits of Windows' own text recognition)
- Text that is blurred by 1 px or more, and text of 8–10 px at 100% display scaling: about half the characters are wrong. Sharpening, contrast stretching, black-and-white and padding were all tried; none helped.
- Some short lines made mostly of symbols, such as `(x * y) / 2` or `x == y && z != 0`, even large and sharp: Windows returns nothing at any enlargement.
- Fonts with old-style numbers (Corbel, Candara, Constantia) where 0 looks like o.
- The limits listed for 10.4.0 still apply.

## Checked before release
- A walkthrough of the app (tests/native-walkthrough.cjs, new): the editor with every tool's settings panel, Image/Video/Audio bars, library, Save as, a new step guide, Check for Updates, the region selector and the widget in all three modes. No page errors; the screenshots were looked over.
- Saveit still quits completely (no processes left) with the hidden widget and region selector prepared.

## Tests
- New: tests/ocr-stress.cjs (500 pictures), tests/native-capture-timing.cjs, tests/native-capture-hides-saveit.cjs, tests/native-walkthrough.cjs.
- tests/ocr-fixline-tests.js: now 55 checks.
- Tests that looked for "the" region selector or widget window now pick the one on screen, since a hidden one is kept ready.
- All passing on this version, in the real app:
  - run-node-tests (including 55 Grab Text clean-up checks);
  - native: widget-hide1022, window-capture, workflow-everyday, workflow-paste-layer, bar-parity (49 checks), gui-10310, live-scroll, video-journey, record-controls, grabtext-10312 (16), capture-hides-saveit, walkthrough;
  - ocr-bench (48 screenshots) and ocr-stress (500 pictures), numbers above;
  - browser suites review2, review103, rotate, polish, stepguide, update-ui (in Chrome).

## Release record (2026-11-19)
- Published at https://github.com/stuartraymor/Saveit/releases/tag/v10.4.1 from main commit e41c27a. It is a normal release (not a draft or pre-release) and GitHub's "latest".
- Assets: Saveit-10.4.1.zip (757,510 bytes, SHA-256 a0001904900f4c9e6a387c2c2af35e3898cdff141e5f22a529b67995791f3997), .zip.sig (checked against the key in app/updater.js), .sha256, and Saveit-Setup.exe (840,192 bytes).
- The zip's app folder matches the tested app and the app installed on this PC, file for file (ignoring line endings).
- Saveit-Setup.exe: tests/setup-ui-test.ps1 passed all 11 checks, installing into a scratch folder. On the first attempt the scripted Install click did not register; the second run passed.
- Real update from GitHub: a scratch copy of 10.3.11 clicked Check for Updates, then Install Update (download and verify), then Install and restart. update.log: "result: ok - Saveit was updated to version 10.4.1 and is running."
- Website (GitHub Pages, docs/ on main) rebuilt from e41c27a. The live pages show the new Grab Text text. The one-click link https://github.com/stuartraymor/Saveit/releases/latest/download/Saveit-Setup.exe redirects to v10.4.1.
