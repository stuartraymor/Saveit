# Saveit 10.3.12

## Grab Text reads more accurately
Measured on 24 realistic screenshots (paragraphs, small menu text, dark mode, code, a table, buttons, grey text, IDs, a sidebar, tiny print, coloured backgrounds), each at 100% and 200% display scaling (tests/ocr-bench.cjs):
- Wrong characters: **8.6% before, 4.2% now**.
- Lines read exactly right: **29 of 68 before, 61 of 74 now** (the sidebar check now expects six lines, one column after the other, instead of three).

What changed:
- **Pictures are enlarged once, by the right amount.**
  - Before, small selections were enlarged twice (2× in the editor, then 3× more), about 6× in all. Letters blurred together: "in" was read as "m", and "warnings" as "wamings".
  - Now the picture is enlarged 2× in total. This read best on both 100% and 200% screens.
- **Quote marks and dots stay on their line.** A `"`, `.` or `,` above or below the middle of a line no longer becomes a line of its own, or splits a line of code in two.
- **Side-by-side columns are read one after the other.** Example: a sidebar beside a page.
  - Before, their lines were mixed together ("Welcome back" / "Dashboard" / "You have 4 tasks" / "Projects"…).
  - Tables still keep each row on one line, because their cells line up.
- **Money:** "s 1,284.50" and "Sl,2S4.50" come out as "$1,284.50" (and "$1,254.50"). This happens only when the result is a real amount, so words like "Sales" are never changed.
- **Web addresses** come out whole: "https : / / api . example . com/v2" becomes "https://api.example.com/v2".
- **Codes and IDs:** a letter O in a dash-separated code ("7F3A-91C2-OB8E") or a hex number ("0x8O070005") becomes a zero.
- **Code:** on lines that are clearly code, the spaces Windows adds around punctuation are removed. "items. reduce( (a, b)" becomes "items.reduce((a, b)", and "fetch ( "…" ) ;" becomes "fetch("…");". The space after `if`, `for` and `while` is kept.

## Known limits (Windows' own text recognition)
- Some long file paths are not read at all. Example: `%APPDATA%\Saveit\library\2026-11`.
  - Windows OCR returns nothing for these, even cut out on their own, enlarged, or split in two.
  - The rest of the picture is still read.
  - The same happens in 10.3.11.
- Tiny or unusual fonts can still swap look-alike characters, e.g. "log" read as "10g", and a dot lost in "4.12.0".

## Tests
- New: tests/native-grabtext-10312.cjs, the real app with a real mouse and keyboard. 13/13 pass:
  - paste a screenshot and press O;
  - Read whole image on a table;
  - drag a box over a sidebar;
  - Join lines;
  - code at 200%;
  - drag a box around one line;
  - the text is copied to the clipboard automatically.
- New: tests/ocr-bench.cjs, the accuracy measurement above.
