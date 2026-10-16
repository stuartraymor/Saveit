# Saveit 8.0.0 — changes for review

Development branch `v8.0-dev`. 3.7.0 is kept as the stable baseline: git tag `v3.7.0` (branch `main`) and the read-only folder `Saveit-3.7.0-stable`.

## 8.01 — Version 8.0
- Version 8.0.0 in `package.json` (title bar and brand badge read it), the installer banner, the Settings › Apps entry and the README.

## 8.02 — Move / Select button
- Shows a cursor icon, a slash and a four-way move icon, using the button's existing width. The button's size and position are unchanged.

## 8.03 — Live tool previews
- In the right-hand panel, the Arrow style, Shape and Quick style thumbnails are drawn with the current colour, fill, line width, opacity, shadow and line style (solid, dashed or dotted).
- They update while you drag a slider or pick a colour. When an object is selected they show that object's style.
- Line style only shows on tools that support it (arrow, line, shape, ellipse, pen).

## 8.05 — Image, Video and Effects buttons (replaces the planned tabs)
- New **Video** button next to Image.
- Image, Video and Effects turn green while their panel is showing. Clicking Image or Effects again goes back to the tool settings.
- Image is greyed out while a video is open, and Video is greyed out while an image is open.
- In a video, the right-hand panel switches with the buttons:
  - **Video**: trim/split, Clip, Audio, Captions, Export. It's the default.
  - **Effects**: Transitions and Sound effects (EQ, low/high cut, boost, level control, reverb, echo).
  - **A drawing tool** (Move / Select, Arrow, Text, Shape, Ellipse, Line, Step, Stamp, Highlight, Blur): the Draw on video controls, with that tool picked. Image-only tools show a short message instead.
- Code: `index.html` (the "8.0" block at the end of the main script) and `vedit2.js` (`data-pane` views, `pane()` / `tool()` on the editor).

## Known issues
- In a video, the Sound effects controls are wider than the side panel, so it scrolls sideways. 3.7.0's Audio sub-tab does the same.
- In a video, the Video panel is the default, so clicking Video while it is showing does nothing.
- A drawing tool picked for a video stays active after you switch back to the Video panel, as it did in 3.7.0 when you changed sub-tabs.
