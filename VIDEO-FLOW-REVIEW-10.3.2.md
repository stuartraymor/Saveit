# Saveit video editing flow review — 10.3.2

October 21, 2026. Reviewed the path from opening a recording through selecting, trimming, annotating, navigating and exporting it. This iteration makes the current editor easier to use without changing its media format or rendering engine.

## Professional references

The comparison uses official documentation, rather than claiming a hands-on comparison with licensed applications.

- [Adobe Premiere: activate timeline snapping](https://helpx.adobe.com/premiere/desktop/edit-projects/change-clip-sequence/snap-clips.html) documents a visible snapping toggle that aligns clips with edges, markers and the playhead. Saveit now exposes its snapping state and lets the user turn it off; Alt temporarily bypasses it during a drag.
- [Adobe Premiere: navigate sequences](https://helpx.adobe.com/premiere/desktop/edit-projects/change-clip-sequence/navigate-sequences-in-the-timeline.html) documents timeline navigation and zoom controls. Saveit's added Fit action gives a direct route back to the full timeline after detailed editing.
- [TechSmith Camtasia: video editing](https://www.techsmith.com/camtasia/features/video-editor/) describes importing media, trimming/cutting/rearranging on a timeline, and exporting the result. Saveit's common edit commands now stay beside the timeline, and the export destinations are named explicitly.

The matching-inspector behavior and narrow-window arrangement are design decisions from this review, informed by those workflows; they are not claims of exact parity with either editor.

## Findings and fixes

| Friction found | Change made |
| --- | --- |
| Common edit actions were buried in the right panel and disappeared when using annotation or sound-effect tools. | Split, Delete, Add videos, Duplicate, Undo, Redo and Reset now stay above the timeline. |
| Selecting an audio clip, caption or annotation could leave unrelated settings visible. | Selection reveals the matching inspector. Selecting a video clip preserves an already useful Clip, Audio or Transitions panel. |
| Snapping was enabled implicitly, with no obvious control. | Added a visible Snap toggle with an accessible pressed state and explanatory tooltip. |
| Returning from a zoomed timeline required repeated minus clicks. | Added Fit, which restores the full timeline and resets horizontal scroll. |
| Delete's gap-closing behavior was unclear. | Video selection labels the action Ripple delete and explains the gap behavior. Delete (keep gap) is separate. Inapplicable selection actions are disabled. |
| Global trimming controls crowded every inspector. | Clip properties appear first. Whole-timeline In/Out trimming stays in the Clip panel; Audio, Captions, Effects and Export no longer carry those controls. |
| Save edited video did not make its library destination obvious. | Renamed it Save copy to Library and added Export file… for choosing a format and a file destination. Text explains which size setting applies to each path. |
| Empty caption and annotation lanes consumed preview space. | They appear when used. The empty audio lane remains available. On the 1366 × 768 test viewport, preview height increased from about 246 to 265 pixels despite adding the persistent action row. |
| Timeline keyboard navigation had no explicit focus target. | The timeline is keyboard-focusable, announces its controls, and shows a focus outline. |
| At narrow widths, the timeline could overlap the settings panel. | The narrow layout now scrolls the editor and settings in sequence, with no intersecting panel bounds. Settings remain reachable below the timeline. |
| Drawing instructions incorrectly suggested dragging for every tool. | Instructions now distinguish a single click for step numbers and stamps. Repeated placement still works. |

## Verification

- Existing video suite: 41/41 checks passed after the main flow changes, including annotation persistence/timing, audio/frame retention, speed, trims, Undo, selection playback, dragging and frame stepping.
- After reorganizing the Clip panel and fixing narrow-window layout, the 13 affected existing checks passed again.
- New editing-task suite: seven checks including renderer-error detection cover repeated annotation placement with Undo/Redo, timeline-driven inspector selection, snapping on/off, Fit and keyboard frame stepping, playable file export, and responsive layout.
- Window sizes checked: 1440 × 1000, 1366 × 768, 1024 × 768 and 850 × 700. Screenshots were inspected. Tests assert panel non-overlap and that controls can be reached by scrolling. The narrow layout also opens the export dialog through the actual controls.
- Real Electron 33.2.1 with a disposable profile and Saveit 10.3.2: imported a recording, removed an In/Out section, exported MP4 from the new Export file button, and saved WebM from the top bar. Both files were independently probed for duration, frame count and audio streams.
- Node syntax/version/line-ending/stitch checks and Git whitespace checks passed.

A native test initially read the duration display before its next animation-frame update. The screenshot showed that the cut had completed. The test now waits for the visible duration to update before asserting; this was test synchronization, not another product fix.

## Scope and limits

This is an inspection and engineering validation, not a study with new users. Narrow windows intentionally require scrolling to reach the settings panel. Sizes smaller than 850 × 700, screen-reader testing, and every combination of overlays or many stacked tracks were not exhaustively verified. Multi-selection, track locking and larger timeline feature additions remain separate work. The prior three-minute recording/export review remains applicable; this iteration did not rerun long recording-duration tests because recording and rendering code did not change.

Saveit 10.3.2 was installed and reopened. All 58 application files were verified, and 109 profile files were backed up. Existing library and settings were preserved.

No GitHub release or main-branch update is part of this review/edit/fix request.
