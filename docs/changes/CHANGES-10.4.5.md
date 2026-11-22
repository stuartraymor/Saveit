# Saveit 10.4.5

A third hands-on round: keyboard shortcuts and fast random input, long use, the Library (folders, backup and restore), dialogs, Grab Text, drag and drop, and picture operations on 4K screenshots. These are the problems it found, and the fixes.

## Pictures are added in the order you chose them
When you opened, dropped or pasted several pictures at once, they were added in whatever order they finished loading. Big pictures came last, so the order looked random.
- This mattered most for step guides: adding 10 pictures to a guide could make the steps come out in the wrong order (in a test, the two big pictures became the last two steps instead of steps 1 and 6).
- Pictures still load at the same time, but they are now added in the order you chose them. This applies to Open, drag and drop, paste, and adding pictures to a guide. Tested with 30 pictures, 12 dropped files and 10 guide steps.

## Rotate and flip no longer freeze the window
On a 4K screenshot, Rotate and Flip froze the window for about a quarter of a second each time. The picture was re-saved inside the window.
- That work now happens in the background, so the window stays responsive. The longest freeze dropped from about 0.25 s to under 0.09 s.
- The picture and its marks now turn together in one step, so you never see arrows in the new place on top of the old picture.
- Quick clicks (for example Rotate, Flip, Rotate, Flip straight after each other) are done one after another, and Undo steps back through each of them exactly.

## Smaller fix
- In the Library, **Save…** and **Move out…** open a "Save items" box. Esc now closes it, like the other boxes.

## Checked and working well (no change needed)
- Keyboard: every tool letter switches tools in under 30 ms. Ctrl+A, Ctrl+D, arrow-key nudges, Delete, 300 × Undo and Redo, and zoom keys all work. 400 random keys, clicks and drags gave no errors and left the picture in good shape.
- Long use: opening 25 items again and again takes about 0.1 s each. Memory levels off (it does not keep growing).
- Library with 70 items: opens in 0.09 s, with paging, search, type and tag/date filters. Rename keeps unusual names exactly as typed. Folders, Copy and Paste, Batch copies, Combine, Save to folder, Move out with Undo, Backup (1 s) and Restore (all items and folders back) all work, and everything is still there after a restart.
- Grab Text from a picture: correct text in about 1.6 s, the window opens on the same screen, and Save to library and reopening keep your edits.
- Menus and boxes open in under 0.06 s. Right-click menus open in under 0.05 s.
- Repeated from 10.4.3 and 10.4.4 and still passing: blur and shadows match when zoomed, Delete/Undo races, thumbnails, step guides, and every drawing tool giving exactly the same saved picture as before.

## Not changed, and why
- Screen capture, recording and the widget were again not tested. They use the real screen and mouse, and the screens were in use.
- Memory sits at about 700 MB after opening 25 large screenshots again and again. It stays at that level and does not keep growing. Releasing pictures sooner did not lower it and made opening slower, so that change was not kept.

## Release record (2026-11-21)
- Published at https://github.com/stuartraymor/Saveit/releases/tag/v10.4.5 from main commit 5949f40. It is a normal release (not a draft or pre-release) and GitHub's "latest".
- Assets: Saveit-10.4.5.zip (779,925 bytes, SHA-256 fa24698610aa75ad85d7ef86e0d4f6c34016b22ae112d3e6dd77d32bae7649d4), .zip.sig (checked against the key in app/updater.js), .sha256, and Saveit-Setup.exe (862,208 bytes).
- The zip's app folder matches the tested app and the app installed on this PC, file for file (ignoring line endings). The main commit changes exactly the 13 files of this release; each keeps the line endings it has on main.
- Saveit-Setup.exe: tests/setup-ui-test.ps1 passed all 11 checks, installing into a scratch folder.
- Real update from GitHub: a scratch copy of 10.4.2 clicked Check for Updates, then Install Update (download and verify in 1.4 s), then Install and restart. update.log: "result: ok - Saveit was updated to version 10.4.5 and is running." (after 6 s). The updated app folder is identical to the tested one.
- The one-click link redirects to v10.4.5.
