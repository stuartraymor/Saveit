# Saveit 9.5.0: a fuller video editor

**New**
1. **Zoom & pan** (like Camtasia's Zoom-n-Pan). In the new Zoom & pan tab, click Add zoom at playhead, then drag the green box on the picture to choose where it zooms. Set the zoom %, how long it eases in and out, and when it starts and ends. Zooms get their own row on the timeline, and you can drag them like captions.
2. **Transitions tab.** All 14 transitions are now in their own tab next to Clip (they used to sit behind the Effects button).
3. **Redo**, plus **Ctrl+Z / Ctrl+Y** (and Ctrl+Shift+Z) inside the video editor. Undo keeps 100 steps.
4. **Duplicate** a clip. The copy goes right after the original, and everything later moves along.
5. **Home / End** jump to the start or end, and **Ctrl+mouse wheel** zooms the timeline.

**Fixed**
- Videos added from your library could disappear from the timeline after restarting Saveit.
- Deleting a clip that overlaps the next one (a transition) put clips out of order. Audio, captions and on-screen items now move with the clips.
- Splitting inside a transition broke it. Split now explains that you need to move out of the transition first.
- Setting a transition length, or changing a clip's speed, left captions, audio and items out of sync. Speed is now limited to 0.25×–4×.
- Added videos showed "Crossfade" but played a cut; they now start as a plain cut until you pick a transition.
- Saved videos ended with a short black frame.
- Undo missed changes to the volume slider, caption text, item colour and item timing.
- Editor shortcuts (Space, Delete, S, I, O, arrow keys) no longer act while a dialog is open.
- Missing media is now reported instead of silently removed. The editor no longer keeps loading after you switch away, and closing it while recording a voice-over is safe.
- Audio clips start in sync at the start of playback and exports. Video files released by the editor stop using memory, and unused recorded audio is no longer kept in your library.
