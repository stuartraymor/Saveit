# Saveit 10.1.5

- Background noise removal learns a short noise-only range, then cleans selected voice clips. Gentle, Balanced, Strong and Maximum settings reduce steady fan noise, hiss and hum. Processing stays on your computer and can be cancelled.
- Original source audio, clip timing, trim handles, fades and effects are kept. Cleaned clips are marked on the timeline. Undo, Redo and Restore originals let you compare; reapplying cleanup starts from the original source.
- Match loudness measures the whole mix in integrated LUFS and adds editable master gain. Choose −14, −16, −18, −20 or −23 LUFS. If the −1 dBFS sample-peak ceiling prevents the target, Saveit shows the achieved loudness and suggests compression before matching again.
- Matching keeps stereo output for consistent measurement across WAV, MP3 and M4A. Lossy exports check their decoded loudness and compensate for encoding changes when peak headroom allows. M4A still encodes in real time and can need another encoding pass.
- The Rumble filter now uses a non-resonant 24 dB/octave low cut. It no longer boosts the low voice range. Existing Rumble filter effects and voice presets use the corrected response.
- Voice EQ explains that it starts flat. More audio toolbar buttons now have tooltips. Compact windows keep the output controls visible while the effects and cleanup panel scrolls.

Choose a noise sample without speech; a bad sample or strong reduction can affect the voice. Cleanup works best on steady noise, rather than changing traffic, clicks or other voices. A learned sample lasts until you close the editor and must use the same sample rate as the clips being cleaned. Original and cleaned sources are retained, so the library can use more disk space.

Loudness is based on BS.1770 K-weighting and gated 400 ms blocks, with checks against an independent meter. Matching needs at least 0.4 seconds. It adjusts the current mix; it does not automatically level each phrase or match a batch of Library items. Match again after editing. Peak protection measures samples, not inter-sample true peaks; encoded output can be quieter when peak headroom prevents matching. De-essing, recording into the current project, and editable project-file export remain future work.

The supplied developer report was read as evidence, without running its scripts. This iteration addresses the audio filter and flat-EQ explanations and adds cleanup/loudness tools. OCR and general app help are separate follow-up work; SVG transport icons and recording into the open project are also deferred. Existing direction-mark wording regression checks still pass.
