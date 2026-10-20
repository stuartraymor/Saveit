# Saveit 10.3.0

- MP4 Save, library exports/copy and recording-to-clipboard now render from the complete WebM master when available instead of using the parallel raw AAC/MP4 copy. The raw copy can end its sound early even when the master has the complete sound.
- Preserves the original recording and edits. A standalone imported file whose audio was already missing cannot have that sound recovered without another source.
- Check for Updates now distinguishes inaccessible GitHub downloads from a repository with no releases, and provides an Open release page button on errors. Public update access still requires GitHub to make the repository available to signed-out requests.
- Regression evidence: retained the original short-audio MP4; complete reference MP4 and WebM sources; checks for cut exports, unedited MP4 Save and library copy. The test recorder now waits for its AudioContext clock to advance before recording, preventing a cold audio-device startup from making a faulty test source.

Validation: the old version fails the new unedited Save and library-copy audio-length regressions; the repaired version passes all seven audio-gap checks. All 12 updater unit checks and 12 updater UI checks passed. The source AAC diagnostic has 2.559667 s of audio and 2.968167 s of video; full-source exports have no added silent gaps. Public GitHub access still returns 404 for this account and must be restored by GitHub.
Full video editor regression: 34/34 required checks passed; three existing timeline TODO checks remain unresolved.
