# Saveit

Saveit is a Snagit-style screen capture app for Windows, built for making clear work instructions and how-to guides fast.

- **Capture:** region, window, full screen, scrolling pages, step-by-step (one shot per click), and Grab Text, which reads text off the screen.
- **Record:** the screen with optional microphone, system audio and webcam, or audio on its own.
- **Mark up:** arrows, callouts, text, shapes, numbered steps, stamps, highlight, blur, spotlight, magnify, crop, Magic Cut, plus fill, erase, cut-out and simplify tools. Each tool has its own settings panel; select an object and drag the round **rotate handle** above it to turn it (annotations, pictures and groups) (Shift snaps to 15 degrees), and flip, borders and corners live in the Image tool.
- **Step guides:** build illustrated, step-by-step instructions and export them.
- **Video editor:** a multi-clip timeline where you trim and move each clip on its own, choose transitions between clips, and add captions and arrows that appear and disappear. Add your own audio, record a voice-over, use the equalizer and effects, then export to video or GIF.
- **Audio:** record a quick voice message from one or two microphones (each on its own track) and the computer's sound, with live level bars. Edit on a multitrack timeline: cut, trim, split, move and fade clips, add effects per clip, track or master, and save as WAV, MP3 or M4A.

## Install

1. Download the latest zip from **Releases** and extract it (right-click, Extract All).
2. Double-click `Install.cmd`.
3. If Windows says "Windows protected your PC", click **More info** then **Run anyway** (the app is not code-signed).

It installs for your user account only, with no admin rights. Setup downloads the Electron runtime (about 110 MB) once. For offline installs, put `electron-v33.2.1-win32-x64.zip`, renamed to `electron.zip`, next to `Install.cmd`.

`Reinstall.cmd` reinstalls and keeps your library. `Uninstall.cmd` removes Saveit.

See [SETUP.txt](SETUP.txt) for hotkeys and details.

What's new: [10.0.8](CHANGES-10.0.8.md) · [10.0.7](CHANGES-10.0.7.md) · [10.0.6](CHANGES-10.0.6.md) · [10.0.5](CHANGES-10.0.5.md) · [10.0.4](CHANGES-10.0.4.md) · [10.0.3](CHANGES-10.0.3.md) · [10.0.2](CHANGES-10.0.2.md) · [10.0.1](CHANGES-10.0.1.md) · [10.0.0](CHANGES-10.0.0.md) · [9.9.4](CHANGES-9.9.4.md) · [9.9.3](CHANGES-9.9.3.md) · [9.9.2](CHANGES-9.9.2.md) · [9.9.1](CHANGES-9.9.1.md) · [9.9.0](CHANGES-9.9.0.md) · [9.8.1](CHANGES-9.8.1.md) · [9.8.0](CHANGES-9.8.0.md) · [9.7.0](CHANGES-9.7.0.md) · [9.6.0](CHANGES-9.6.0.md) · [9.5.0](CHANGES-9.5.0.md) · [9.4.0](CHANGES-9.4.0.md) · [9.3.0](CHANGES-9.3.0.md) · [9.2.0](CHANGES-9.2.0.md) · [9.1.0](CHANGES-9.1.0.md) · [9.0.0](CHANGES-9.0.0.md) · [8.0.0](CHANGES-8.0.0.md) · [3.7.0](CHANGES-3.7.0.md).

## Run from source

Requires Electron 33: `electron app`.
