# Saveit 10.0.10 — Native Step Capture helper (clicks and typing)

Fix 7 from the step-guide proposal. Step Capture now uses a small native helper, **saveit-steps.exe**, that ships in the app folder. It is built from `native/saveit-steps.cs` with the C# compiler that comes with Windows (`tools/build-steps-helper.ps1`), so the source is in the repository.

- **Names clicks the way Snagit does.** It asks Windows for the control under the mouse at the moment of the click, using the modern UI Automation interface. Steps now read `Click "Start"`, `Select "Save as" from the "File" menu`, `Open the "Insert" tab`, `Click in the "Address and search bar" box`, and `Right-click "Desktop"`. The old PowerShell watcher couldn't see most of Windows 11 and often gave "Click here".
- **Faster and more reliable.** It starts in about 0.1 s (the PowerShell watcher took about 1.1 s), and left clicks, right clicks and double clicks are caught as they happen instead of by checking the mouse every 10 ms. A double click is one step.
- **Typing becomes an instruction.** What you type into a field is added to the step that clicked the field, for example `Type "invoice 42" in the "Search" box.` Typing is reported when you click elsewhere or press Enter or Tab.
- **Fallback.** If `saveit-steps.exe` is missing or can't start, the old PowerShell watcher is used, so Step Capture still works.

**Privacy.** The helper runs only while Step Capture is running, and it ends when you press Stop or Saveit closes. It reads the keys you type in any program during that time, but only to build the typing instruction. **It never reads what is typed into password fields**, and it sends its results only to Saveit. You can edit or delete any instruction in the guide before exporting.

**Limits.** Windows doesn't let a normal program watch clicks inside apps running as administrator (Task Manager, some installers). Those steps fall back to "Click here". Because the helper is a new unsigned program that watches the mouse and keyboard, antivirus or SmartScreen may question it; it is built from the included source.

Tests: `tests/native-steps-helper.cjs --live` (3 checks, including clicking and typing in a small test window of its own, and that a password never appears in the output), `tests/native-stepguide.cjs` (6 checks in real Electron, including that Step Capture starts the helper and Stop ends it), and 2 new checks in `tests/stepguide-tests.cjs` for the wording and typed text. All other suites pass.
