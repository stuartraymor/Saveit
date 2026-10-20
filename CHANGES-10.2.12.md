# Saveit 10.2.12

- Clearer trim controls, grouped under “Trim using In / Out”: Trim beginning removes before In; Trim end removes after Out; Remove middle deletes between In and Out and joins the remaining parts; Keep selected part keeps only the part between In and Out.
- All four actions use the timeline In/Out markers and number boxes, regardless of the playhead or selected clip. They apply across video, audio and timed items and can be undone.
- Keeps automatic In/Out updates and the visible movable recording bar.

Validation: all Node checks passed. Browser checks verify all four operations use numeric In/Out with a different playhead position, apply to video/audio/captions, and Undo restores the content.
