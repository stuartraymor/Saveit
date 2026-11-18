# Saveit 10.3.10

## Scrolling capture, rebuilt
- Select an area, scroll the page yourself (mouse wheel, scroll bar, keys, any speed), then click **Capture** on the bar. Nothing finishes on its own.
- Only new content below what is already captured is added. Scrolling back up, or down again through captured content, never repeats or damages the picture.
- Sticky headers and fixed footers appear once. A picture that only changes from side to side is no longer mistaken for a fixed footer.
- Much faster: the selected area is read in about 12–36 ms (it was 0.5–0.8 s), with exact pixels and without the mouse pointer. Fast scrolling, page-sized jumps and smooth scrolling are followed.
- Display dithering and colour-profile jitter no longer break matching. A window border changing colour when the bar appears is ignored.
- Long pages up to 32,000 px. The bar says when the maximum is reached, when it cannot line a view up, and when you are revisiting captured content.

## Capture
- Right-click inside a finished region selection captures it, the same as the Capture button. Right-click before a selection only closes the selector. It never takes an empty screenshot and never captures twice.
- The floating widget shows **Copy to clipboard** only for screenshots. The top bar's Clipboard option is unchanged.
- One taskbar icon: Saveit's Start menu, desktop and pinned shortcuts get the same app identity as the running app.
  - This is repaired automatically at startup.
  - If a duplicate pinned icon remains, unpin it once and pin Saveit again.

## Voice effects (Audio editor and video editor)
- Six new effects: **Deep Voice**, **High Pitch**, **Robot**, **Radio / Telephone**, **Echo** and **Reverb**.
- Each has adjustable settings, Wet/dry mix and Reset.
- Deep Voice and High Pitch change pitch without changing speed or length.
- Effects are non-destructive and saved in the project. They can be turned on or off, or removed, per clip, per time range, per track or for the whole project.
- In the video editor they apply to the selected clip's audio without changing timing.
- Tested on real speech: pitch within 30 cents of target from −12 to +12 semitones, identical length, no clipping (a safety stage keeps Radio below 0 dBFS), no clicks.

## Audio editor fixes
- Recording can no longer start twice and leave the microphone open.
- **Add audio** creates a new track, as the drop zone says. A file that cannot be read is named, and the others are still added.
- Delete and Ripple delete remove the selection, not the last effect added.
- Space, S, Delete, Home and Ctrl+Z work again after using a slider or checkbox.
- Seeking and zooming bring the playhead into view.
- Muted clips are dimmed and labelled.
- Range delete and Trim no longer move a clip's fades to the cut edges.
- Copying or saving a short selection renders only that part, not the whole project.
- Short fades on long clips keep their length.
- Undo and redo no longer recompute every waveform.
- The Split button now agrees with the S key.
- You are warned if a microphone stops sending sound during a recording.

## Video editor and recording fixes
- Remove/Keep middle need a real In/Out range.
- Delete & close gap only closes space that no other clip covers.
- Changing an audio clip's speed no longer moves video clips.
- Voice-over uses the chosen microphone, starts in sync after playback starts, and stops when playback stops.
- Editing is blocked while exporting.
- A new capture or library click no longer silently cancels a running export.
- The microphone is released after recording with microphone and system sound.
- The Stop hotkey no longer shows Saveit in the last frames.
- A second record hotkey during area selection or countdown is ignored.
