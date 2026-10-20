# Voice cleanup and loudness matching

Open an audio item in Saveit 10.1.5. The Background noise removal section is in the scrolling Audio studio panel. Master output controls stay at the bottom.

## Remove background noise

1. Click **Range**. Drag over 0.25–10 seconds of room noise with no speech, inside one clip. You can also type the selection's From/To times.
2. Click **Learn noise selection**. Saveit confirms the sample duration and sample rate.
3. Click **Select / Move**, then select the voice clip. Ctrl-click to select additional clips from recordings with the same noise and sample rate.
4. Start with **Gentle** or **Balanced**, then click **Clean selected clips**. Play the result and listen particularly to S sounds and quiet word endings.
5. Use **Undo**, **Redo**, or **Restore originals** with the cleaned clips selected to compare. Reapply with another strength if necessary; cleanup always starts with the original source.

The strength is the maximum attenuation per frequency band, rather than a guarantee that the whole noise falls by that amount. Steady fans, hiss and hum suit this tool best. A sample containing speech can remove parts of the voice. Changing traffic, clicks and other voices are harder to separate. The learned noise sample is retained only while this audio editor is open; the cleaned audio and original sources are saved in the Library.

## Match voiceover loudness

1. Finish noise cleanup, EQ, compression, fades and track balance.
2. Under **Master output**, choose a LUFS target and click **Match loudness**. This adjusts the whole current mix; it does not match individual phrases or a batch of Library items.
3. Read the measured before/after LUFS in the scrolling panel. If peak headroom prevents the target, try gentle compression, then match again. This gain-only step preserves the dynamics of your mix.
4. Listen, then save as WAV, MP3 or M4A. Matching keeps stereo output so each format uses the measured channel layout. Undo removes the matching change, including this output choice.

Matching adds a normal editable master Gain effect. You can adjust, bypass, remove or undo it. Match again after changing the mix. It needs at least 0.4 seconds and rejects silence. The peak ceiling is −1 dBFS sample peak; it is not a true-peak guarantee.

WAV preserves the measured result most directly. Matched MP3/M4A exports check decoded loudness and compensate when there is headroom. If peak safety prevents compensation, the file can be quieter. M4A uses real-time encoding and may need another pass.

## Quick listening check

- Compare a pause before and after cleanup: the fan/hiss should fall, and words should keep their clarity.
- Compare Gentle with Strong. Prefer the least reduction that makes the noise acceptable.
- Check that words, fades and video synchronization stay in place.
- Match two voiceovers to the same LUFS target, then compare their playback volume.
- Save, close and reopen the item. Cleaned audio and matching gain should remain; Restore originals and Undo should still work within their respective editing session.

Recording into an existing project and de-essing are still future work. New recording creates a separate Library item.
