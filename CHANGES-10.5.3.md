# Saveit 10.5.3

Stabilisation pass: the five reported capture problems, the Page editor's missing Grab text and columns, and other faults found on the way.

## Window capture ("Capture failed")
- **Cause:** the picture was asked from Electron at the size of the window's visible frame. Electron returns the whole window rectangle, including the invisible resize borders Windows puts around most windows, scaled to fit. The sizes therefore never matched for ordinary windows and the capture ended with "The window changed size during capture". Only borderless windows worked. On the test machine 3 of 4 open windows failed.
- **Fix:** `saveit-window-bounds.exe grab <window>` reads the window's own picture (so other windows in front do not matter) and cuts it to the visible frame. A window that gives no picture this way is brought to the front and read from the screen. A minimized window is restored first. Windows that draw at a different scaling are measured in their own units.
- Every failure now says what happened and what to do (window closed, cannot be read, minimized). The "Capture failed" message no longer carries "Error invoking remote method".
- Faster: about 0.15 s per window (it took 0.8 s when it worked and 2.5 s to fail).

## Scrolling capture
- **Effects no longer appear.** The selection bar showed "+ Add effect" for Scrolling. It now shows only what belongs to the capture type; effects stay for Region and Full screen. The button reads **Start scrolling**.
- **Scrolling up works.** Only content below the starting view was kept, and a capture that began by scrolling up said "Can't line this up". Content above is now put in front of the picture; direction can change at any time. The length limit holds in both directions.
- **The selected area keeps a dashed outline** for the whole capture. Before, nothing marked the area once the selection screen closed. The outline is click-through, stays on top through focus changes, and is never in the picture.
- The bar's window shadow fell on the bottom rows of the area and left a faint band in each captured piece. Removed.
- A whole-screen selection in Scrolling or Grab text no longer turns into an ordinary Full screen capture.

## Grab Text
- **Grab text is on every page** of the Page window (it was hidden unless the page began as a grab).
- **Grab text from the Page window keeps your page.** The picture of the grabbed area appears on the right with the text read from it in a box underneath: **Copy text**, **Insert into page**, **Insert picture**. Select part of the box to copy or insert only that part.
- Grab Text from the editor or the widget ends in the Page window, in front. The editor used to come to the front with the screenshot, which looked like an ordinary capture. The grabbed text box is shown there too.

## Page editor
- **Columns** (Layout > Columns): one to eight columns for the whole page, or only for the selected paragraphs; space between; line between; **column break** (Insert > Column break, Ctrl+Shift+Enter).
- Columns and column breaks are kept in Word files (as sections, checked in Microsoft Word), PDF, print and web pages, and come back when a Word file with columns is opened.
- More page sizes: Executive, Tabloid, A3, A5. Margins: Moderate and **Custom** (0.25 to 3 in). Word files keep the exact margin.

## Other fixes
- A second capture started while the selection screen or window picker was open (hotkey pressed twice) opened a second screen on top, and both ended with the same answer. It is now ignored.
- A selection window only accepts its own answer.
- Starting a recording area, a capture or Step Capture while another one is being set up is ignored (they could stack). Capture hotkeys do nothing during Step Capture; before, their selection screen's clicks became steps.
- **Quit from the tray during a recording or Step Capture** no longer closes Saveit and loses the take; it asks you to stop first.
- The recording bar is placed on the display being recorded, not the one the pointer is on.
- The widget comes back after a quiet preset capture. Step Capture started with the widget up no longer leaves the widget in every step.
- Step Capture gives back F9 only if it took it (a preset's F9 hotkey was removed). One failed step no longer blocks the rest of the guide.
- Scrolling capture: a problem while finishing no longer leaves Capture and Cancel both switched off; a screen read that never answers is given up after 4 s.
- If the selection screen's page stops working, the capture is cancelled instead of leaving a full-screen window up.
- Redact: applying after another picture was opened no longer changes the wrong picture.
- Hotkeys and preset hotkeys start nothing while a recording is running or starting. A preset whose capture was switched to Video or Steps in the selection bar ends quietly.
- Copy to clipboard right after a capture waits until the picture is ready (a large capture could copy a blank image).
- Editor shortcuts no longer act behind the Report a bug dialog.
- Effects chosen for a capture that became Steps, Video or Grab text are not applied to a later capture.

## Tests
- New: upward-scrolling stitcher cases (11), window-capture unit tests (6 groups), and three real-app suites that run on one display without moving the mouse: `native-window-capture-1053` (18 checks), `native-scroll-1053` (20), `native-page-1053` (34). `tests/native-driver.cjs` and `tests/side-display-hook.cjs` keep real-app tests off the screen in use.

## Known limits
- The window picker still takes about 0.75 s to open (Windows' window list); not changed here.
- A window that refuses to give its picture and cannot be brought to the front (some programs running as administrator) is reported, not captured; use Region.
- Columns always have equal widths. Headers, footers, page numbers and footnotes are not in the Page editor yet.
