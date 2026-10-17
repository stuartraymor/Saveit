# Saveit

Saveit is a Snagit-style screen capture app for Windows, built for making clear work instructions and how-to guides fast.

- **Capture:** region, window, full screen, scrolling pages, step-by-step (one shot per click), and Grab Text, which reads text off the screen.
- **Record:** the screen with optional microphone, system audio and webcam, or audio on its own.
- **Mark up:** arrows, callouts, text, shapes, numbered steps, stamps, highlight, blur, spotlight, magnify, crop, Magic Cut, plus fill, erase, cut-out and simplify tools. Each tool has its own settings panel; rotate, flip, borders and corners live in the Image tool.
- **Step guides:** build illustrated, step-by-step instructions and export them.
- **Video editor:** a multi-clip timeline where you trim and move each clip on its own, choose transitions between clips, and add captions and arrows that appear and disappear. Add your own audio, record a voice-over, use the equalizer and effects, then export to video or GIF.
- **Audio:** record a quick voice message from one or two microphones (each on its own track) and the computer's sound, with live level bars. Edit on a multitrack timeline: cut, trim, split, move and fade clips, add effects per clip, track or master, and save as WAV.

## Install

1. Download the latest zip from **Releases** and extract it (right-click, Extract All).
2. Double-click `Install.cmd`.
3. If Windows says "Windows protected your PC", click **More info** then **Run anyway** (the app is not code-signed).

It installs for your user account only, with no admin rights. Setup downloads the Electron runtime (about 110 MB) once. For offline installs, put `electron-v33.2.1-win32-x64.zip`, renamed to `electron.zip`, next to `Install.cmd`.

`Reinstall.cmd` reinstalls and keeps your library. `Uninstall.cmd` removes Saveit.

See [SETUP.txt](SETUP.txt) for hotkeys and details.

What's new: [9.9.4](CHANGES-9.9.4.md) · [9.9.3](CHANGES-9.9.3.md) · [9.9.2](CHANGES-9.9.2.md) · [9.9.1](CHANGES-9.9.1.md) · [9.9.0](CHANGES-9.9.0.md) · [9.8.1](CHANGES-9.8.1.md) · [9.8.0](CHANGES-9.8.0.md) · [9.7.0](CHANGES-9.7.0.md) · [9.6.0](CHANGES-9.6.0.md) · [9.5.0](CHANGES-9.5.0.md) · [9.4.0](CHANGES-9.4.0.md) · [9.3.0](CHANGES-9.3.0.md) · [9.2.0](CHANGES-9.2.0.md) · [9.1.0](CHANGES-9.1.0.md) · [9.0.0](CHANGES-9.0.0.md) · [8.0.0](CHANGES-8.0.0.md) · [3.7.0](CHANGES-3.7.0.md).

## Run from source

Requires Electron 33: `electron app`.
