# SaveIt 9.9.2

- Selected annotations now show the move cursor along their dotted border. Dragging the border moves the selected object before the active drawing tool can create another one. This includes Arrow and Stamp, imported pictures, text, shapes, lines and other annotations. Handles and arrow endpoints keep their existing adjustments. Selection borders also work over overlapping objects and on grouped selections.
- Crop's border now shows the move cursor consistently. Move the region without shifting the image, or resize it with the existing eight handles. Existing exact fields, ratio options, Apply, Cancel and undo/redo remain available.
- Cut Out now waits for confirmation. Draw a strip, move it or drag either boundary, or enter exact From/To pixels and direction in the right panel. Press the red **Cut Out** button to commit. Invalid/full-image strips are rejected; a consumed selection cannot be applied twice. Escape, Cancel and switching tools discard the pending selection. The existing pixel cutting and annotation adjustment algorithm is retained.
- Simplify now has independent width/height pixel and percentage fields, a proportions lock and size presets: 320×240, 640×480, 800×600, 1280×720 and 1920×1080, plus Original Size and Custom. Percentages always refer to the original dimensions for the current operation. A preset with a different aspect ratio unlocks proportions and the panel explains that dimensions are independent. Existing smoothing, colour choices and outline controls are retained.

The toolbar, main layout, capture, Library, Recents, video and audio interfaces retain their existing design. No runtime or dependency upgrade is included.

Simplify retains its existing behavior of merging picture layers when entering the tool; undo restores those layers. This release does not change that earlier behavior.
