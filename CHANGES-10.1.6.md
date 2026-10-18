# Saveit 10.1.6

- Added De-esser for sharp S and SH sounds. Adjust sibilance frequency, threshold, maximum reduction and release. Its dynamic high shelf reduces high-frequency harshness while retaining the lower voice range. Settings work on clips, tracks or the master output.
- Listen to S band helps you find the harsh range during playback. It is preview-only: WAV, MP3 and M4A always use the processed full voice. Original source audio and timing stay intact.
- De-esser, Compressor and Peak limiter now show live gain reduction in both the sidebar and larger controls. Stop clears these displays.
- Every effect now has an Open controls window, including the older volume, fade, mute, echo and reverb effects. Fields remain usable after invalid input, and errors are shown in the larger window. Reset, bypass, remove and undo remain available.
- Audio transport, undo/redo, zoom, rack-collapse and effect-order symbols now use SVG icons. Clip-panel actions have tooltips, completing the audio tooltip work from the developer review.
- The effect chain explains processing order and why a limiter should be last. Echo/reverb diagrams are labeled as illustrations rather than measured responses.

Start de-essing gently and listen to quiet words as well as harsh S sounds. Too much reduction can make speech dull or lispy. Voice presets retain their previous sound; de-essing is an explicit effect you add and tune. There is no automatic speech recognition or promise that all high-frequency noise is sibilance.

All 12 effects received a control and processing review. `AUDIO-REVIEW-10.1.6.md` records the findings, a professional-platform comparison, the remaining developer-sheet items and a prioritized feature list. Recording into the current project, project-file export/recovery, true-peak delivery, app-wide Help and the annotated-capture OCR report remain further work.
