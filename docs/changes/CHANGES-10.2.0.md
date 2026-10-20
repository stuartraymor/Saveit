# Saveit 10.2.0 — Check for Updates

A small **Check for Updates →** link now sits at the right end of the bar along the bottom of the editor. It does nothing until you click it: there are no automatic checks and no notices, and the rest of the editor is unchanged.

**How it works**
1. Click the link. Saveit asks GitHub (the official `stuartraymor/Saveit` releases) for the latest published, stable release and compares it with the version you have.
2. If you are up to date it says **"Saveit is up to date."** If a newer version is available it shows the version number, the release notes and an **Install Update** button. A pre-release, a draft or an older version is never offered.
3. **Install Update** downloads the release into a temporary folder and **verifies it before anything is installed**: every release is digitally signed, and Saveit checks the signature against a key built into the app, plus GitHub's own checksum for the file. A file that fails either check is deleted and nothing is installed.
4. Saveit then asks you to save your work and confirm. It will not offer to close while a recording, Step Capture, an export or a save is running, and it never force-closes.
5. Saveit closes on its own, a separate updater installs the new version, and Saveit opens again and tells you which version is now installed. Your library, settings, projects and shortcuts are not touched.
6. **Recovery:** the previous version is backed up first. If the new version does not start properly, the updater puts the previous version back and starts it, and Saveit tells you what happened. If GitHub is unreachable, a download is cut off, or anything else goes wrong, you get a plain message and Saveit is left as it was.

**Good to know**
- This is the first version with the updater, so you install 10.2.0 the usual way (download the zip, run `Install.cmd`). From the next release on, the link can install it for you. Earlier releases are not signed, so the link shows them as "can't be installed automatically" and points you to the release page.
- Updates install only in the installed copy of Saveit, not when it is run from source.
- Every release must now be signed (`node tools/sign-release.js`), which adds a `.sig` file next to the zip. See HANDOFF.md, section 6a. The signing key is kept on the publisher's computer, outside the repository, and must be backed up.

**Not changed:** Install.cmd and the existing installer work exactly as before. The updater does not use them, because they stop Saveit by force and remove the whole install folder. It reuses their copy steps and registry entry, and never touches the runtime or shortcuts.

**Tests:** `tests/updater-unit.cjs` (12 checks of versions, signatures, the zip reader and the check/download path with tampered, unsigned, truncated and redirected files), `tests/update-ui-tests.cjs` (11 checks of the link and dialogs, including that nothing contacts GitHub on its own), and `tests/native-update.cjs` (15 checks in a real Saveit: a real update from the old version to a newer one with the library and settings intact, rollback from a release that crashes and from one that never starts, a tampered download refused, the app never force-closed, and the real installed Saveit untouched). All other suites pass.
