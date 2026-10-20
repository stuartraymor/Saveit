# User's development and release workflow

Version numbers follow VERSIONING.md: start at 10.0.0, add one to the last number for each completed user-requested change, and after .12 roll over to the next number (10.0.12 -> 10.1.0). Bump with `node tools/version.js bump`, which keeps app/package.json, the installer and README.txt consistent and creates the CHANGES file for the release notes.

Install with `powershell -NoProfile -ExecutionPolicy Bypass -File tools\update-installed.ps1` (it backs up the library first, verifies every file, then reopens Saveit).

Validate the changes (`node tests/run-node-tests.js` plus the browser suites), install the new version, and open it on the desktop for the user to test. Preserve all existing settings and media; use disposable profiles for automated testing and back up the real profile before updating the installed application.

Save every iteration to GitHub (https://github.com/stuartraymor/Saveit): commit on the `v10-dev` branch (message starts with the version) and push the branch. Tag `v<version>` only when a version is published as a release.

Every release zip must be signed before it is published: run node tools/sign-release.js Saveit-X.zip and upload the zip, the .sig and the .sha256 together (see HANDOFF.md section 6a). Installed copies refuse unsigned releases. Keep the private signing key outside the repository and backed up.

After installation, ask the user whether to release that version on GitHub. Do not publish a GitHub release or update `main` without the user's approval.
