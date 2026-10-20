# Saveit 8.11.0 — multi-picture canvas, step 4: background, effects, limits

- **Canvas background** (Image tab): Transparent (default), White, Black or any colour. It's drawn behind all pictures, appears in copies, exports and thumbnails, and is saved with the effects. Undo works.
- **Effects (Mono, Sepia, …)** apply to the background picture and all added pictures together; annotations stay sharp (done in 8.9.0, kept).
- **Size guard:** adding pictures is refused with a message when the capture's pictures would total about 90 MB, to protect memory and saved size. Photos over 4096 px are already reduced (8.8.0).
- Library thumbnails show the whole canvas including the background.

**Tested:** shrank the background picture so the canvas showed (transparent), set Black (opaque), Undo restored transparent. No errors.
**Not done:** storing pictures as separate files instead of inside the capture (undo still copies them); the limit message was not triggered in testing.
