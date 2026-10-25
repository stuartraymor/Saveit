# Saveit 10.3.8 — odd-pixel window capture repair

Installed and reopened locally on October 25, 2026. All 61 application files matched the source. The installer backed up and verified 124 profile files and reported no profile changes. Backup: `C:/Users/stuar/Code/Saveit-library-backup-before-10.3.8-20261025-133332`.

## Defect and repair

The previous video-based screenshot path reproduced the failure: an owned 285×171 window produced 284×170. This was a loss in the capture stream before the canvas received the image.

Windows screenshots now query physical visible window bounds from DWM and request an Electron still image at those exact dimensions. The image is accepted only if both dimensions match and the window has not changed size during the operation. A resize triggers a bounded retry; closed, minimized or unmeasurable windows produce an error rather than a silently resized image. The video recorder and non-Windows screenshot fallback are unchanged.

The small bounds helper is built from `native/saveit-window-bounds.cs` with `tools/build-window-bounds.ps1`, using the Windows .NET Framework compiler. Its only native imports check the window and read its frame bounds. It does not capture pixels or persist user data. The compiled helper and source are included locally. Release packaging must carry the helper with `window-capture.js`.

## Verification

- Reproduced the old 285×171 → 284×170 failure with the video path in an isolated runtime.
- Fixed native path passed 285×171, 285×170, 286×171, 286×172, 570×340 and 900×520.
- Each image retained a marked last row and column, corner marker and 80 exact alternating black/white one-pixel stripes. This checks actual edge preservation and rules out stretching a cropped frame back to the expected size. It is not a certification of color fidelity.
- Repeated all six cases with the capture application at forced scale 1 and the host's native scale 2. The owned target used scale 1 to create actual odd physical HWND dimensions; Windows display settings were not changed.
- Real application window-picker workflow produced a 285×171 editable capture and saved a 285×171 PNG.
- Resize-race retry, wrong thumbnail size, closed source, invalid source IDs and invalid handles: passed.
- Node syntax/assets/version/stitch and capture regressions: passed. Export helper suite: passed. Browser Save PNG/PDF checks: passed. Update UI: 12 checks passed.
- REA inspected the compiled helper as a complete x64 managed PE referencing mscorlib 4.0. Its static evidence is `ev_b76f25fdd3ee854a6d4e1809b00d937c433d9b50161a27901f0cfe9a73a3649c`, SHA-256 `7eaed71846a48bcfa1b1b0099f31548ac490214a358763b68837e08dd6aeb927`. Static inspection does not establish runtime behavior; the native tests do.

The physical-bounds choice follows Microsoft's [GetWindowRect documentation](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindowrect), which distinguishes physical DWM frame bounds from DPI-adjusted window rectangles. The still-image request uses Electron's documented [thumbnailSize parameter](https://www.electronjs.org/docs/latest/api/desktop-capturer).

Multiple physical monitors and non-Windows behavior were not retested. No GitHub push, main update, tag or public release was performed. The earlier one-pixel screenshot limitation is resolved for the tested Windows path.
