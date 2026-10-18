# Saveit 10.0.12 — Right-click text menu and small fixes

From the second company review (of 10.0.11).

- **Right-click menu on text everywhere.** Right-clicking in the Grabbed text box, a step title, a name field or the Library search now shows Cut, Copy, Paste and Select all (Cut and Paste are greyed out when they can't apply). Right-clicking plain selected text shows Copy. The canvas, thumbnails and timelines keep their own menus.
- **Clean step names.** Invisible direction marks that Windows puts in some names (the taskbar clock showed `Click "Clock 7:33 PM ?10/?17/?2026"`) are removed: `Click "Clock 7:33 PM 10/17/2026"`.
- **The Library opens with an empty search,** instead of the last search being applied with no sign of it.
- **GIF in a video's first Save window,** next to MP4 and WebM, to match Save as….

Note: the review's suggested patch for the step-name fix would have broken the step wording code (a comment swallowed the rest of the line), so it was written differently and is covered by a test.

Tests: `tests/review2-tests.cjs` (3 checks) and one new check in `tests/native-stepguide.cjs` that the real right-click menu has the right items. All other suites pass.
