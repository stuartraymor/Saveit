# Saveit 10.1.11

**You can see what you type in a callout.**

- **The cause.** Callouts without a fill (new callouts, and Quick styles 1–6) showed white letters and a white cursor on a white typing box, so the box looked empty while you typed. When you finished, the text was drawn in black. The helper that chooses dark or light text was given white written as `#fff`, read it as dark blue, and chose white text.
- **Fixed.** The helper now understands every colour form (`#fff`, `#ffffff`, colours with transparency and `rgb()`). Callouts without a fill are typed in dark letters on a light blue box, so you can see your text and where you are typing. Callouts with a fill keep their own colour, with dark or white letters to suit it, as before.
- **Long text stays in view.** The typing box grows downward with your text. Before, it kept the callout's original size and hid the newest words until you finished.
- The same fixes apply to callouts typed on a step-guide page.
- Checked in real Electron 33 (`tests/native-callout1111.cjs`, 16 checks): every Fill colour, every Quick style, and long text in a small callout. The step-guide page box uses the same rules but was not checked in the real app.
