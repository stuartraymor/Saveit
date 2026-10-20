# Saveit 10.1.2 — Grab Text reads more accurately

From the second company review (B11). On the sample picture, Grab Text read `J-2041` as `1-2041`, joined table cells together with spaces, and mixed the text of a callout into the table rows behind it.

- **Reads the picture at 2× (3× for small pictures) before recognising it.** Windows text recognition is far more accurate on larger text. On the sample, 0 of 8 job codes were read correctly before; all 8 are now. Word positions stay in the original picture's pixels, so Replace text and Redaction are unaffected.
- **Columns stay apart.** Words that are far apart in a row are separated by a tab instead of a space, so a table row reads `J-2041⇥Gripper finger, 6061⇥Plant 3⇥8⇥In process⇥Oct 14⇥6.5` and pastes into a spreadsheet as cells.
- **Text annotations are read from the shapes.** Callouts and text boxes are no longer read from the flattened picture, where they hid and got mixed into the text behind them. Their words are added after the text read from the picture, separated by a blank line.

Not changed: sidebar labels are still listed in the row where they sit, next to the table. Splitting a sidebar from a table reliably isn't possible from positions alone without sometimes mis-ordering ordinary text. A way to select exactly the words you want on the picture is planned.

Tests: a browser check for annotations (11 in `tests/review2-tests.cjs` now) and a real Windows OCR check in Electron on the sample picture (`tests/fixtures/sample-capture.png`): all 8 job codes, tab-separated rows, and word positions in the original pixels. All other suites pass.
