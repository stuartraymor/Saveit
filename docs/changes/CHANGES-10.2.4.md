# Saveit 10.2.4

- **One-file installer, Saveit-Setup.exe.** Download it, double-click it, click Install. A Saveit-branded window shows the logo and a progress bar while it installs, then offers "Open Saveit". It carries the release zip inside itself and runs the same install.ps1 as Install.cmd (new -FromSetup switch that reports progress), so the install itself is unchanged: per-user, no admin rights, library and settings kept, shortcuts and Settings > Apps entry added. If Saveit is open, Setup asks before closing it. Failures show a plain message and a Show details button.
- Built by `tools/build-setup.ps1` from `native/saveit-setup.cs` using the C# compiler that ships with Windows. Published as the asset `Saveit-Setup.exe` on each release; https://github.com/stuartraymor/Saveit/releases/latest/download/Saveit-Setup.exe always points at the newest one.
- install.ps1 test hook (only when SAVEIT_REVIEW_DATA is set): SAVEIT_SETUP_TEST_ROOT installs into a scratch folder. Test: `tests/setup-ui-test.ps1`.
- Like Install.cmd, the exe is not code-signed, so Windows shows "Windows protected your PC" once (More info, Run anyway).
