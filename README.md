# Saveit

Saveit is a Snagit-style screen capture app for Windows, built for making clear work instructions and how-to guides fast.

- **Capture:** region, window, full screen, scrolling pages, step-by-step (one shot per click), and Grab Text, which reads text off the screen.
- **Record:** the screen with optional microphone, system audio and webcam.
- **Mark up:** arrows, callouts, text, shapes, numbered steps, stamps, highlight, blur, spotlight, magnify, crop, Magic Cut, plus fill, erase, cut-out and simplify tools. Each tool has its own settings panel; rotate, flip, borders and corners live in the Image tool.
- **Step guides:** build illustrated, step-by-step instructions and export them.
- **Video editor:** a multi-clip timeline where you trim and move each clip on its own, choose transitions between clips, and add captions and arrows that appear and disappear. Add your own audio, record a voice-over, use the equalizer and effects, then export to video or GIF.

## Install

1. Download the latest zip from **Releases** and extract it (right-click, Extract All).
2. Double-click `Install.cmd`.
3. If Windows says "Windows protected your PC", click **More info** then **Run anyway** (the app is not code-signed).

It installs for your user account only, with no admin rights. Setup downloads the Electron runtime (about 110 MB) once. For offline installs, put `electron-v33.2.1-win32-x64.zip`, renamed to `electron.zip`, next to `Install.cmd`.

`Reinstall.cmd` reinstalls and keeps your library. `Uninstall.cmd` removes Saveit.

See [SETUP.txt](SETUP.txt) for hotkeys and details.

What's new in 3.6.0: see [CHANGES-3.6.0.md](CHANGES-3.6.0.md).

## Run from source

Requires Electron 33: `electron app`.
