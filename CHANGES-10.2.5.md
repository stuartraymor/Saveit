# Saveit 10.2.5

- **A proper "Updating Saveit" window.** When you click Install and restart in Check for Updates, a Saveit window with the logo and a progress bar now shows each step (waiting for Saveit to close, backing up, installing, starting the new version) instead of a PowerShell window. It closes itself when Saveit has reopened. If something goes wrong it says so in plain words and stays open with a Close button.
- The update itself is unchanged and is still done by updater.ps1 (hidden); the new program, app/saveit-updating.exe, only shows progress. If it cannot start, Saveit is opened again and nothing is changed. A development copy without the exe uses the old direct start.
- Note: the window appears when the version that is *doing* the update has it, so it shows for updates made from 10.2.5 onward.
- Built by tools/build-updating.ps1 from native/saveit-updating.cs. Tests: tests/updating-ui-test.ps1 (window, success and failure) and the existing tests/native-update.cjs (15 checks, still all passing).
