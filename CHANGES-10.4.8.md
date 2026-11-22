# Saveit 10.4.8

## A smaller capture widget
- The red **Close** button now sits in the widget's second row, under **Copy to clipboard**, instead of in its own space at the right edge.
- This makes the widget narrower: 64 pixels narrower in Image and Audio mode, and 21 pixels narrower in Video mode. Nothing else moved, and Close never covers another control.

## Release record (2026-11-22)
- Published at https://github.com/stuartraymor/Saveit/releases/tag/v10.4.8 from main commit b86abe3. It is a normal release (not a draft or pre-release) and GitHub's "latest". It includes everything from 10.4.6 and 10.4.7.
- Assets: Saveit-10.4.8.zip (780,638 bytes, SHA-256 a1b090b2b63cb08f81971512cdb8242c9c7c510b46dda6047247ac9e450bc79f), .zip.sig (checked against the key in app/updater.js), .sha256, and Saveit-Setup.exe (863,232 bytes).
- All 69 files in the release's app folder match the tested source, ignoring line endings. The main commit changes exactly 17 files, and each keeps the line endings it has on main.
- Website: docs/images/widget.png now shows the new widget, with its size updated in docs/index.html. The sitemap date and README.md "What's new" were updated too. The live page at https://stuartraymor.github.io/Saveit/ shows the new picture.
- Saveit-Setup.exe: tests/setup-ui-test.ps1 passed all 11 checks, installing into a scratch folder.
- Real update from GitHub: a scratch copy of 10.4.5 clicked Check for Updates, then Install Update (download and verify in 1.4 s), then Install and restart. update.log: "result: ok - Saveit was updated to version 10.4.8 and is running." (after 6 s).
- The one-click link redirects to v10.4.8.
