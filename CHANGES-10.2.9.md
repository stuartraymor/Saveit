# Saveit 10.2.9

- Timeline right-click menus adapt to video, audio, captions, on-screen items, zooms and visual effects. Includes relevant settings, duplicate/delete, video/audio mute, split, add media, range controls and undo/redo.
- In/Out fields follow timeline marker drags and Set In/Set Out immediately. Right-clicking the preview selects the on-screen item under the pointer without drawing or moving it.
- Video recording controls stay hidden automatically, avoiding capture backends that do not honor window capture exclusion. Stop with Ctrl+Shift+R or the Saveit tray menu. Audio-only recording keeps its controls.
- Verified with browser timeline regressions, Node checks, and a disposable-profile native Electron check that the video recording control window remains hidden.

Validation: all Node checks passed; focused menu/range browser checks passed, including video mute/undo, audio-specific options and preview item hit testing. Full video suite: 28/30 required passed, with the same two MP4-source export audio-silence failures reproduced on unchanged 10.2.8 (0.22 s and 0.20 s). Three pre-existing TODO failures remain. Native Electron disposable-profile check confirms the video recording bar is hidden. This check verifies window visibility, not a full screen recording/export.
