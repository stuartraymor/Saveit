# Saveit 10.2.10

- Restored the floating video recording bar with timer, Pause/Resume and Stop, as in 10.2.8.
- The bar is explicitly movable. Drag its timer or empty background to another monitor; the buttons remain clickable. Capture exclusion remains enabled, but moving the bar onto another screen avoids capture backends that ignore exclusion.
- Keeps the adaptive timeline menus and live In/Out field updates from 10.2.9.

Validation: all Node checks and both focused browser checks passed. Disposable-profile native Electron checks passed for visible/movable recording controls, draggable background, clickable buttons, Pause/Resume states and Stop command delivery. Only one display was available, so cross-monitor dragging was not exercised.
