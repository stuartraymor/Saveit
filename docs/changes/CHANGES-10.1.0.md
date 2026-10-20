# Saveit 10.1.0 — Fill stays where you click

From the second company review (B1). Fill had two problems on the sample picture: one click flooded 39% of it, and the text inside the filled rows turned into faint ghosts.

- **Letters are no longer eaten.** The "Grow edge" step (which tidies the soft edge around a filled shape) used to spread into the letters inside the filled area and wear them away. It now skips small separate objects such as letters, and still tidies the edge of a shape.
- **A tighter default.** "Similar colours" now starts at 3 (it was 5). On the sample, the page background and the grey rows are only 5 shades apart, so at 5 they counted as one area. You can still raise it to catch gradients and soft edges.
- **A clear message for very large fills.** If a fill covers more than a quarter of the picture you see "That filled 39% of the picture (…). Ctrl+Z to undo, or lower Similar colours and try again."

Result on the sample capture: the same click now fills 13% (just the area you clicked), and none of the letters are changed.

Tests: three new Fill checks in `tests/review2-tests.cjs` (9 now); the 10.0.3 check was updated to the new default. All other suites pass.
