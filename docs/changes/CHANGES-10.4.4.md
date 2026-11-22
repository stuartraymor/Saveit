# Saveit 10.4.4

A second full check, this time looking hard at what 10.4.3 changed and at quick or unusual sequences of clicks. These are the problems it found, and the fixes.

## Blur and shadows look right when zoomed in
10.4.3 made zoomed-in pictures sharper, but it also made blur and shadows shrink on screen as you zoomed in. The saved picture was always right; only the screen was wrong.
- At 400% zoom, a **Blur** box (Smooth) and the **Effects** blur looked almost unblurred on screen, so you could not see what the saved picture would look like.
- The picture's **Drop shadow** got thinner the more you zoomed, and nearly disappeared at 400%. Stamp shadows did the same.
- Now blur and shadows on screen match the saved picture at 100%, 200% and 400% (measured pixel by pixel).

## Delete, Undo delete, Delete again
If you deleted items in the Library, pressed **Undo delete**, and then deleted them again straight away, the deleted items came back the next time Saveit started. In a test, all 7 came back.
- Each item's delete and undo now happen in order, so items you deleted stay deleted, and items you brought back stay back (tested with fast clicks, three times).
- Opening an item straight after Undo delete now waits until it has been put back, so it always opens.

## Smaller fixes
- A thumbnail now finishes drawing even if one of the pictures inside it can't be loaded (before, it waited forever and was never corrected).
- A video that can't be played no longer makes the preview wait 5 seconds before giving up.
- A thin strip at the right and bottom edge of the picture could keep old drawing after zooming. The whole area is now cleared each time.
- Saving M4A no longer says "it takes as long as the audio", because since 10.4.3 it takes well under a second.
- Surround-sound audio (more than 2 channels) saved as M4A uses the old way again, which mixes all channels down properly instead of keeping only the first two.

## Checked and working well (no change needed)
- Every control in every side panel (23 panels, about 450 controls) was used in turn: no errors, no dialogs left open, and Undo brought the picture back each time. The Quick styles respond straight away.
- Repeated from 10.4.3 and still passing: sharp zoom, thumbnails, Undo delete after a restart, fast video preview, fast M4A, 4K picture open/edit/save, video and audio saving, step guides, and every drawing tool giving exactly the same saved picture as before.

## Not changed, and why
- Screen capture, recording, the widget and Grab Text on the screen were again not tested. Those tests use the real screen and mouse, and the screens were in use. The browser test suites and node tests were run.
