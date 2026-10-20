# Saveit 9.1.2

- Layers are strict: every item has its own layer, and Bring forward / Send backward always move one layer, overlapping or not (this already worked; now it is visible).
- After every layer move a message says where the item is now, e.g. "Now on layer 3 of 5 (1 = bottom)". At the top or bottom it says so.
- The size label on a selected picture also shows its layer.

Tested: three separate boxes A, B, C moved one layer per click (forward, forward, back) and with Ctrl+].
