# Grab Text accuracy review (Saveit 10.1.11 → 10.1.12)

A friend reported that Grab Text "mixes up letters and fonts". This is what a measured test found, what was fixed, and what is left.

## How it was tested

Known text was drawn in real windows and captured the way a screen capture is (Chromium text rendering, at 100% and 150% display scale), then read by Grab Text and compared character by character:

- 10 fonts (Segoe UI, Calibri, Arial, Times New Roman, Georgia, Consolas, Courier New, Verdana, Tahoma, Cambria) at 12, 14 and 18 px, plus bold and italic
- money, dates, phone numbers, serial codes, passwords, an email address, a URL, a Windows file path, program code
- dark mode, faint grey text, white text on a blue button, red error text, 10–11 px text
- three app windows with icons, toggles, checkboxes and borders (to make sure nothing adds junk)

## What was wrong (10.1.11)

| Kind of text | Result |
|---|---|
| Ordinary sentences in common fonts | Very good: about 0.4% of characters wrong |
| Money (`$1,234.56`) | Often `Sl,234.56`, `S 1,234.56` or `Sl,234.S6`: right in only 7 of 19 pictures |
| Numbers with zeros or ones | Sometimes `O` for `0`, `l` or `I` for `1` |
| Codes and passwords mixing `I l 1 O 0` | Often wrong, and parts dropped (`#A1B8-0O8B-I1l5` → `B8-008B-1115`) |
| File paths with backslashes | **Dropped entirely**: Windows OCR leaves out words it can't make sense of |
| Courier New and some serif fonts at 12–14 px | Garbled (`The quick` → `Che gu±ck`) |
| Program code | `>=` dropped, `"OK"` → `"0K"` |

The letters are recognised by Windows' own OCR engine (Windows.Media.Ocr), the same engine for every app on the PC. Its main weaknesses are look-alike characters and silently dropping text that doesn't look like words.

## What was changed (10.1.12)

1. **Dropped words are read again.** After the first read, any ink that looks like text but wasn't recognised is cut out and read on its own. This recovers file paths and similar text, and added no junk on the app-window tests.
2. **Look-alike fixes where the meaning is clear:** money after a misread `$`, tokens that are plainly numbers, hex codes and money decimal points. Mixed letter-and-digit codes are deliberately left alone.

Measured in the real app (22 pictures): character errors 4.40% → **2.49%**; money read exactly 7 → **14 of 19**; the file path is read instead of dropped; ordinary sentences unchanged; about 0.3 s slower.

Also tried and measured, with no gain for this engine: different enlargement (2×, 4×), greyscale, white margins, inverting dark mode, contrast stretch, thickening thin fonts.

## What is still not right

- **Ambiguous characters in codes and passwords:** in Segoe UI and Arial a capital I and a small l look identical, and O and 0 nearly so. No OCR can be sure there. Check codes and passwords by eye.
- **Courier New and thin serif fonts at small sizes** are still read poorly by the Windows engine.
- **An icon next to text is sometimes read as a letter** (a bell read as `h`).
- **A file path's backslash** may still be read wrongly (`C:\Users` → `C:Wsers`).

## Possible next step

A different OCR engine would fix more of the above. Tesseract is free and open source, and is especially better at monospace fonts and code. It would add about 30–40 MB to Saveit and has to be downloaded and bundled, so it needs your go-ahead. Grab Text could then offer it as an option, or use it automatically for code-like text.
