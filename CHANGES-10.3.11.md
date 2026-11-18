# Saveit 10.3.11

This release also includes everything in 10.3.10 (see CHANGES-10.3.10.md). 10.3.10 was not published on its own.

## Capture bar and widget
- The editor's capture bar and the floating widget now match exactly in Image, Video and Audio: the same buttons, the same size, the same place.
  - This is checked control by control in the real app.
- **Copy to clipboard** appears only for screenshots, in both the widget and the editor's capture bar.
  - It is hidden for Video and Audio, where it did nothing useful.
- The Effect settings button uses the same ⚙ icon in both places.

## Pasting a screenshot onto another screenshot
- Right-click a screenshot in Recent and choose **Copy**, then paste on the open screenshot with **Ctrl+V** or **right-click > Paste**.
  - Either way it is added on top as a picture you can move and resize.
  - Before, Ctrl+V added it to the library as a separate capture.
- With the Library window open, or for video and audio files, pasting still adds to the library.
- Pasting the same picture again places it slightly down and to the right, instead of exactly on top of the first copy where it could not be seen.

## Editor top bar
- **Copy** now works for videos: it copies the clip to paste into another video.
  - Before, it did nothing for videos.
- Copy's tooltip now says what it copies (image, video clip or audio).
- **Print** is greyed out with an explanation when a video or audio clip is open.

## Recording
- Recording now starts right after you click OK on the selected area, about 0.7 s.
  - Before, it could take 7–12 seconds, or wait until something on screen moved.
  - Windows only sends a new screen picture when something changes, and Saveit was waiting for a second one.
- A recorded area now has exactly the size you selected on screens where Windows reports a slightly odd size.
  - Example: a 1280 × 720 area on a 200% screen recorded as 1280 × 718.

## Check for Updates
- When your version is newer than the latest published release, the message now says so.
  - Before, it said your version was "the latest published release".
