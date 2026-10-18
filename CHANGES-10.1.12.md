# Saveit 10.1.12

## Flatten button on Erase, Fill and Magic Cut

- These three tools change only one picture: the screenshot under the pointer. Annotations (arrows, boxes, text) and other pasted pictures stay on top and are not affected, so Erase could not rub them out.
- Their panels now have a small **Flatten** button at the right of the heading, like Effects. It merges every annotation and picture into the image, so the tool works through all of them. The tool stays selected, and Ctrl+Z restores the separate layers. The button is greyed out when there is nothing to flatten.
- Checked by `tests/flatten-tools-tests.cjs` (6 checks), including erasing through a flattened arrow.

## Grab Text is more accurate

A full accuracy test is described in `GRAB-TEXT-REVIEW-10.1.12.md`. Measured in the real app on 22 test pictures with known text:

| | 10.1.11 | 10.1.12 |
|---|---|---|
| Character errors overall | 4.40% | **2.49%** |
| Money amounts read exactly (`$1,234.56`) | 7 of 19 | **14 of 19** |
| A file path (`C:\Users\…\report-01.docx`) | dropped entirely | **read** (one look-alike slip) |
| Ordinary sentences | 0.39% | 0.39% |
| Time per Grab Text | 0.7 s | 1.0 s |

- **Dropped words are read again.** Windows OCR silently leaves out words it cannot make sense of, such as file paths. After the first read, Saveit now finds ink that looks like text but was not recognised, cuts it out on its own and reads it again. On test windows with icons, toggles and borders this added no junk.
- **Look-alike characters are fixed where the meaning is clear:** a money amount after a misread $ (`Sl,234.S6` → `$1,234.56`), tokens that are plainly numbers (`1O,OO8.OO` → `10,008.00`), hex codes (`Ox80070005` → `0x80070005`), and a decimal point read as a dash in money (`$1,234-56` → `$1,234.56`). Mixed letter-and-digit codes such as `8B0O-1Il7` and passwords are left alone, because there the right answer cannot be known.
- Tried and measured, but not adopted because they did not help this engine: enlarging tiles 2× or 4× instead of 3×, greyscale, a white margin, inverting dark mode, contrast stretch and thickening thin fonts.
- New `tests/native-ocr1112.cjs` (real Electron 33 and Windows OCR, 6 checks plus a scored detail file).
