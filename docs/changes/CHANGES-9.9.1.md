# Saveit 9.9.1: audio editing (Phase 3), and the widget matches the top bar exactly

## Capture bar
- The **Widget** button in the top bar, and the **Editor** button in the widget, now fill the room beside the logo, at the logo's height.
- **The widget is a one-to-one copy of the top bar** in Image, Video and Audio. An automated check measures every control's position and size from the logo in both bars; all of them now match (11 controls in Image, 15 in Video, 12 in Audio). Fixed along the way:
  - The widget's top row sat 2 px higher than the top bar's. Both now use the same row rules.
  - The widget's microphone lists were narrower. The "small window" sizing now only applies to the editor, since the widget window is always sized to fit its bar.
  - The same controls now have the same names for screen readers in both bars.

## Audio editing (Phase 3 of PLAN-9.9-audio.md)
Editing is non-destructive. The recording itself is never changed, every edit can be undone, and **Reset edits** returns to the full recording.
- **Select:** drag across any waveform. Double-click selects a whole piece, Shift+click selects from the playhead, Ctrl+A selects everything, and **I** / **O** set the start and end of the selection at the playhead. Esc clears it.
- **Delete** (key or button) removes the selected part and closes the gap, on every track together.
- **Trim to selection** keeps only the selected part.
- **Split** (S) cuts at the playhead. Cuts show as yellow markers on the ruler and the waveforms.
- **Fade in** / **Fade out** in seconds, shown as shaded ramps on the waveform.
- **Undo** / **Redo** (Ctrl+Z, Ctrl+Y) cover cuts, fades, volume, mute and solo.
- **Play selection** plays just the selected part (with Loop to repeat it).
- **Time ruler:** click or drag on it to move the playhead.
- **Zoom:** − / Fit / + beside the ruler, or Ctrl + mouse wheel at the pointer. The wheel scrolls sideways when zoomed in, and the view follows the playhead while playing.
- Waveforms are drawn sharper (each pixel shows the true loudest point it covers), so short sounds don't disappear when zoomed out.
- Save (WAV), the Library length, the Recent thumbnail and the status bar all follow the edited timeline. Edits are kept in the library and survive restarting the app.
- Mute and solo are now buttons only; **S** is Split.

## Tests
`await QA.runAll()` now runs 80 checks. The 14 new ones edit a test file of three tones (300, 500 and 700 Hz) and check the saved WAV by pitch and loudness: delete closes the gap, undo restores, the ruler seeks after undo, split, double-click select, trim, fade-in rising from silence, reset, zoom/Fit, the I/O keys and Esc.
