# Saveit 10.3.7 local review — October 25, 2026

Installed and reopened locally. All 59 application files matched the checkout. The update wrapper backed up 125 profile files, verified them, and reported no profile changes. Backup: `C:/Users/stuar/Code/Saveit-library-backup-before-10.3.7-20261025-132123`.

## Changes and evidence

- Window screenshots now use an actual capture frame instead of a screen-sized desktopCapturer thumbnail. Native tests returned 570×340 and 900×520 at host 200% scaling and with Electron forced to scale 1. The latter is a controlled scale test, not a change to Windows display scaling.
- Exports default to Documents/Saveit Exports. Format-specific destination memory applies to image, video, audio and project saves; batch exports remember their folder too. Previously saved absolute paths remain usable.
- Single-format exports correct a mismatched extension and require confirmation before overwriting an existing corrected target. Multi-format Save still accepts an offered extension.
- Screenshot PDF pages fit their image. A real 556×326 browser export yielded a 417×244.5-point page. Guide page layout is retained.
- Save identifies its format and honors the current format on an initial save; the chooser visibly marks its current choice.
- Recording dimensions are read from the video after it starts. An owned external test window produced a recording bar reading Window · 570 × 340 px; ffprobe independently measured the saved WebM at 570×340. The bar explicitly names System audio.
- Updater result parsing accepts Windows PowerShell's UTF-8 BOM. File verification uses streaming .NET SHA-256 rather than depending on Get-FileHash module discovery. The release instructions now include Saveit-Setup.exe in the publication command.

## Verification

- Node syntax, assets, version agreement, CRLF and stitch regressions: passed.
- Export helper/PDF regression: 6 checks passed; additional browser Save PNG, selected chooser state and real PDF checks passed.
- Updater unit suite: 13 groups passed. Native isolated updater: 15 checks passed, including signed upgrade, tampering refusal, busy handling, crash/no-health rollback and preservation of test data and the actual installed application.
- Update UI: 12 checks passed.
- Video workflow suite: all 8 workflow checks and renderer-error check passed, including export playback, responsive timeline, voice-over and cancellation.
- Video editor suite: 40 checks passed on the broad run; its two annotation checks initially lacked the decoder path. Both passed on rerun with FFPROBE set to the installed TatsiaCraft tool. No application repair was needed for these two harness failures.
- Native window screenshot dimensions and native window recording feedback/output: passed as described above.

## REA and limits

REA inventoried the installed 10.3.6 Electron application: `ev_2d9169d2aba54a9f5193740ff9e3fe886dd35d8f77e730c56ebe86176fbd22c3`; summary `ev_b228fb2c6631d7730de386aa821071b1e7dedc8ae60a5d948e7d6395576901fe`. Its semantic coverage was partial owing to result/heap limits. It is static artifact evidence, not proof of runtime behavior; focused source reads and native/browser tests supplied the behavior checks.

The capture stream can round an odd physical dimension down by one pixel: an additional forced-scale-1 285-pixel-wide fixture produced 284 pixels. The large screen-width enlargement is fixed; exact odd-pixel preservation remains a limitation. Multiple monitors, changing Windows itself to 100%, physical microphone/webcam quality and the audit's intermittent nonresponsive tools were not qualified in this iteration. Optional workflow redesigns were not undertaken.

No GitHub push, main update, tag or public release was performed. User review must precede publication.
