SAVEIT 10.2.3 - WINDOWS SETUP
============================

INSTALL
1. Right-click the downloaded zip, choose "Extract All...", then open the extracted folder.
2. Double-click Install.cmd.
3. If Windows shows "Windows protected your PC", click "More info", then "Run anyway".
   (It appears because the app is not code-signed. It is safe to continue.)
Setup installs for your user account only (no admin rights) and adds Start menu and
desktop shortcuts. Saveit opens when it finishes.
If this folder contains electron.zip, setup works offline. If not, it downloads the
app runtime (about 110 MB, one time) from GitHub and checks it.

FILES IN THIS FOLDER
  Install.cmd     Install Saveit (also updates an existing install)
  Reinstall.cmd   Remove and install again, keeping your library and settings
  Uninstall.cmd   Remove Saveit (asks whether to delete your library too)
You can also uninstall from Settings > Apps > Installed apps > Saveit, or the
"Uninstall Saveit" shortcut in the Start menu.

WHAT IT DOES
- Capture: region, window, full screen, scrolling pages, step-by-step (a shot per click),
  and Grab Text (reads text off the screen).
- Record the screen with optional microphone, system audio and webcam.
- Mark up: arrows, callouts, text, shapes, steps, stamps, highlight, pen, blur,
  spotlight, magnify, fill, erase, cut out, simplify, crop, effects, Smart Move.
  Select an object and drag the round rotate handle above it to turn it (Shift = 15 degree steps).
- Step guides: build illustrated work instructions and export them.
- Audio: record one or two microphones and the computer's sound, edit on a multitrack
  timeline, and save as WAV, MP3 or M4A.
- Video editor: multi-clip timeline, trim and move clips, transitions, captions and
  on-screen arrows/text that appear and disappear, audio tracks, voice-over, equalizer
  and effects, export to video or GIF.

HOTKEYS
  Print Screen          Region capture
  Shift+Print Screen    Window capture
  Ctrl+Print Screen     Full-screen capture
  Ctrl+Shift+X          Region capture (backup)
  Ctrl+Shift+R          Start / stop screen recording
  Ctrl+Alt+S            Step capture (F9 adds one)
Saveit lives in the system tray near the clock; closing the window keeps the hotkeys
working. Right-click the tray icon for options, "Start with Windows", and Quit.

If Print Screen opens Snipping Tool instead, turn off
Settings > Accessibility > Keyboard > "Use the Print screen key to open screen capture",
then quit and reopen Saveit.

Saved images go to Pictures; recordings go to Videos.
