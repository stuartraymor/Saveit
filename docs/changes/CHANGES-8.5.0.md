# Saveit 8.5.0 — revision changes

## Ticket 6 — Library folder indicators and image counts

- **Folders:** each folder thumbnail has a count badge in the bottom-right corner (a folder symbol and the number). It's the number of captures directly in that folder. The label under it now also says how many subfolders it has, e.g. "3 items · 1 folder".
- **Guides:** a guide (a collection of captures made as steps) has the same badge showing its step count, e.g. a two-step guide shows a folder symbol with 2.
- The counts update when captures are added, moved or deleted, because the Library redraws after each change.
- Captures inside a folder keep their existing label (with the folder name), since they aren't collections.
- Folder counts mean "directly inside this folder". Subfolder contents are counted in their own folder, not in the parent.

**Files:** `app/index.html` (`.ncount` badge CSS; folder card and guide card markup in `renderLib`), `app/package.json`, `install.ps1`, `README.txt` (version 8.5.0).

**Tested** in the dev build:
- Made a two-step guide: its badge showed 2.
- Made `Project` and `Project / Sub`, moved three captures into `Sub`: `Sub` showed 3 and `Project` showed 0 directly inside, with the label "0 items · 1 folder".
- The screenshot shows the badges clear of the checkbox, the FOLDER/GUIDE tag and the delete button.
- No JavaScript errors.

**Not tested:** the badge on folders with many items beyond the two-digit range (it grows wider, but I didn't check it visually), and the count after a folder is renamed or deleted with the Library open (the same redraw path as the moves above).
