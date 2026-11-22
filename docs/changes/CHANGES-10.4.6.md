# Saveit 10.4.6

A fourth hands-on round. It covered damaged and unusual files, every Save format, GIF export from videos, and audio projects with several tracks. These are the problems it found, and the fixes.

## Saving a picture as PowerPoint gave a file PowerPoint can't open
If you clicked **Save** and gave the file a `.pptx` name, Saveit wrote a PNG picture under that name, so PowerPoint couldn't open it. For a step guide, nothing was saved at all.
- Save now makes a real PowerPoint file at the name you chose, with a title slide and the picture (or one slide per step for a guide).
- Tested: the saved file opens as a PowerPoint presentation with its slides and picture.

## Damaged videos no longer land in the library
A video file that can't be played (damaged, or not really a video) was added to the library as an empty "Video 0.0 MB" item with a blank thumbnail. Opening it only said "That file could not be opened."
- Saveit now checks the video first. If it can't be read, you see "That video could not be opened. Try MP4 or WebM." and nothing is added.
- Good MP4 and WebM files still open straight away (0.2 to 0.7 s, with a thumbnail).

## Files Saveit can't open now say so
Opening, dropping or pasting a file Saveit can't use (for example a .txt or .pdf) did nothing at all, with no message.
- Now you see, for example: "Saveit can't open notes.txt. It opens pictures, videos, audio and .saveit files."
- Pasting such a file no longer says "Pasted into library".

## A damaged .saveit file no longer says "Opened"
A .saveit file from Saveit that held an unknown kind of item said "Opened …" while nothing opened. It now says "That file is not a Saveit file, or it is damaged.", like other damaged .saveit files.

## Checked and working well (no change needed)
- **Unusual pictures:**
  - WebP, a JPG named .png, and SVGs with and without a size all open correctly.
  - A phone photo that is stored sideways opens the right way up.
  - Very large pictures open: 16000 × 9000 in 2.5 s, and 1200 × 30000 in 1.6 s.
  - File names with Japanese characters, accents and emoji are kept exactly.
- **Broken files:** an empty or fake picture, a broken MP3, and a damaged or unrelated .saveit file all give a clear message, with no errors.
- **GIF from a video:** a 7-second video became a 480 × 270 animated GIF of 70 frames in 3.3 s, and the window never froze.
- **Audio with several tracks:**
  - Add audio… puts the new clip on its own track, and + Track adds an empty one.
  - Undo and Redo step back and forward through both.
  - The saved WAV contains both tracks mixed together.
  - After a restart, the tracks and clips are exactly as they were.
- Every other Save format for pictures, guides, videos and audio goes to the code that makes that format.

## Not changed, and why
- A PNG that is cut off part-way still opens, with the missing part shown white and no message. This is how browsers show such files, and the part that is there is kept.
- Screen capture, recording, scrolling capture (stitching) and the widget were again not tested. They use the real screen and mouse, and the screens were in use.
