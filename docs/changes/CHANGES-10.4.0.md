# Saveit 10.4.0

This version also includes everything in 10.3.12 (see CHANGES-10.3.12.md). 10.3.12 was not published on its own.

## Grab Text, second round
Measured on 48 screenshots: the 12 test pages of tests/ocr-bench.cjs, each at 100%, 125%, 150% and 200% display scaling. Lines that must match exactly: 148.

| | Wrong characters | Lines exactly right |
|---|---|---|
| 10.3.11 (released) | 7.9% | 91 |
| 10.3.12 | 3.4% | 125 |
| 10.4.0 | 3.2% | 132 |

What changed:
- **Tables paste into a spreadsheet as columns.** Every cell of a table row is now separated by a tab. Before, some cells were separated by a tab and others by a plain space, depending on how close they sat.
- **Short pieces inside a line are no longer dropped.**
  - Example: the "11" in "2026-11-07" came out as "2026- -07".
  - When such a piece can't be read on its own, it is read again together with the text beside it.
  - This is only done for short pieces right next to recognised words, so a full-screen Grab Text is not slower (3.3 s for a 2560 × 1440 screen, the same as before).
- **Quotes, brackets and code operators found by the second pass are kept.** Example: the `"` in `console.log("Free shipping")`.
- **A symbol Windows can't read in a code line (often `=>`) no longer leaves a tab in the middle of the line.**
- **Codes and IDs:** a stray space is removed in codes like "A- 1009" and "7F3A-91 C2-0B8E".
- **Selection > Grab text:** the editor's capture button now says **Grab text**, the same as the floating widget's.
- **Real screens with a sidebar.** On a real desktop screenshot of a sidebar beside a conversation, the sidebar list now comes first, then the conversation. Before, each sidebar item was mixed into a conversation line.

## Still not readable (limits of Windows' own text recognition)
- Some long file paths. Example: `%APPDATA%\Saveit\library\2026-11`.
  - Windows OCR returns nothing for these, even after cutting them out, enlarging, padding, splitting, black-and-white, inverting, or making them bolder or thinner.
  - Only the en-US recognition language is installed on the test PC.
- The `·` separator and `=>` are not read.
- Tiny text at 100% scaling sometimes swaps look-alikes ("wamings", "Ticket IO", "412.0").
- I and l are confused in words like "Savelt" and "Ul". Saveit does not guess at these.

## Tests
- tests/native-grabtext-10312.cjs: 16/16 PASS, in the real app with a real mouse and keyboard. New since 10.3.12: **Selection > Grab text**, then Capture, then dragging over a table that is really on screen. It is read as tab-separated rows, and nothing is added to the library.
- tests/ocr-fixline-tests.js (new, part of run-node-tests.js): 27 checks of the text clean-up: money, web addresses, IDs, code, table columns, rows and sidebar columns.
- tests/ocr-bench.cjs:
  - now also measures 125% and 150% display scaling;
  - `OCR_OLD_PRESCALE=1` measures 10.3.11 and older.
- Also passing:
  - run-node-tests;
  - native-bar-parity, native-workflow-everyday, native-workflow-paste-layer, native-gui-10310;
  - native-ocr1112, apart from its file-path check, which 10.3.11 fails too;
  - browser suites review2, review103, rotate, polish, stepguide, update-ui (run in Chrome; Edge does not start on the test PC).
- Not run: video-flow. It only runs on Edge, and it covers video editing, which this version does not change.
