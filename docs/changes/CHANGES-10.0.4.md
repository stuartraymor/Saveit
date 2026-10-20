# Saveit 10.0.4 — Cursor on arrow and line ends

- The two end points of an **Arrow** or **Line** now show the **grab hand** (a closed hand while you drag), instead of a crosshair. Box handles on shapes, text, pictures and groups keep their two-headed resize arrows, and the move cursor stays on the dotted border and the body.
- Tests: cursor test added to `tests/review103-tests.cjs` (rectangle corners and sides, arrow and line ends, dragging). Polish suite still 35/35.
