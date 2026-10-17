# User's development and release workflow

For each completed user-requested change, increment the application's patch version (9.9.3 follows 9.9.2). Keep app/package.json, installer version, and release notes consistent.

Validate the changes, install the new version, and open it on the desktop for the user to test. Preserve all existing settings and media; use disposable profiles for automated testing and back up the real profile before updating the installed application.

After installation, ask the user whether to release that version on GitHub. Do not publish a GitHub release or push release changes without the user's approval.
