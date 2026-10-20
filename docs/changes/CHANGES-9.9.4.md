# SaveIt 9.9.4 — Audio timeline

- A larger Audio workspace with named, independently selectable clips, stacked tracks, a persistent ruler and transport, zoom/scroll, snapping and precise time fields. Image annotation tools are hidden while editing audio; Recents remains collapsible.
- Select/Move selects and drags clips; Range selects time on the targeted track. Drag clip edges to trim without changing speed/pitch or losing original samples. Drag the corner handles for fades. Split selected clips, duplicate/repeat/group them, move between tracks, and apply adjustable crossfades to same-track overlaps.
- Delete leaves a gap. Ripple delete closes the gap on the selected tracks; All tracks is an explicit scope. Undo/redo treats a completed drag as one action.
- Add audio files directly, drag audio from Library/Recents or Explorer, append after a selected clip, insert on a track, or stack on a new track. Ctrl+C/Ctrl+X copy/cut selected audio; Paste uses the audio clipboard. Original source files stay intact.
- Editable clip, track and Master effects with visible targets, timing blocks, bypass, reset, removal and processing order. Gain, Fade in/out, Mute, Echo/Delay and Reverb have appropriate controls, including delay, feedback, decay and wet mix. Settings preview during playback and share the export scheduler.
- Track pan, clip gain/mute, a master peak/clipping meter and optional effect tails. Save selections as reusable sound clips. Bounce selected clips to a new track while retaining and muting the originals, with undo.
- Existing audio edits convert to the clip model only after validation. Original source blobs and an original-edit snapshot are retained. Unsupported timelines fall back to the original editor with a message. Image/video functionality and user settings remain in place.

Start with **Select / Move** to arrange clips, or **Range** to cut a word or passage. Select a clip, track name, or effect block to edit its properties on the right. **Restore original edit** is available and can itself be undone.

Seeking or rebuilding an effect while playing starts its delay/reverb history at that playhead. Existing 9.9.3 effects preserve their old processing until their sound parameters are edited. External effect plugins, advanced noise repair and independent pitch/time stretching are outside this release.
