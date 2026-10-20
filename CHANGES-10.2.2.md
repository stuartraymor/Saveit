# Saveit 10.2.2

- **Hide button on the capture widget.** A small red round x sits at the bottom right of the widget. Click it to put the widget away without opening the editor and without closing Saveit, for example when you opened the widget on the wrong page and want it out of the way while you find the right spot. Saveit keeps running: click the Saveit icon in the system tray (or use Print Screen) to bring things back. Nothing else in the widget or editor changed.
- Test: tests/native-widget-hide1022.cjs (button is red, small, bottom right, covers no control; clicking it removes the widget and neither opens the editor nor quits).
