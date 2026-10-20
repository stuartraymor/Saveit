# Saveit 10.1.3

- Repeat now opens a small Saveit dialog, so it works in the installed Windows app. You can enter 1–20 additional copies, cancel, and undo the result.
- Ctrl+V pastes copied audio onto the selected track at the playhead. Ctrl+Shift+V inserts it and moves later audio along. The right-click shortcuts now agree with these actions.
- Bouncing selected clips keeps their sound: master effects are applied once, soloed tracks remain audible, and loud intermediate audio is kept without clipping before the master volume is applied. Original clips stay available and the bounce can be undone.
- Stereo recordings no longer look silent when the left and right channels have opposite polarity.
- Trim to range moves the kept audio to the start for a one-track project or an All tracks trim. Trimming just one track in a multitrack project keeps its timing with the other tracks and explains this in a message. Timed effects move with a whole-project trim, and keeping part of a fade preserves its sound.
- New track and master effects cover the whole target unless you have selected a time range.
- Straight mono projects save as mono WAV files. Panning, stereo sources, echo, or reverb keep stereo output so the sound is preserved. WAV exports remain 16-bit.
- The Open folder button is readable, audio save messages sit above playback controls, and an empty paste explains that a clip must be copied first.
- Zoom and access to the bottom of the side panel were checked in the real Windows app; both worked and needed no change.

This is a bug-fix update. Recording into the current project, project-file export, voice cleanup, loudness matching, new mixer controls, and the broader icon/wording redesign are left for later. New recording still creates a separate Library item.
