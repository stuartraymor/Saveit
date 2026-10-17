# Saveit 10.0.9 — Step guide fixes

From the step-guide fix proposal for 9.9.4 (fixes 1 to 6), written into version 10 and tested.

1. **The step bar stays out of step screenshots.** While Step Capture takes a screenshot the bar is made fully transparent for a moment (about 40 ms) and then shown again, even if the grab fails. It used to show up inside captured steps.
2. **The Add step mode is remembered.** Region, Window or Full screen stays as you chose it after each step, and the next guide starts with the last choice.
3. **Clear progress and results.** Word, PDF, JPG, PowerPoint, PNG and Saveit-file exports show "Preparing…" at once and keep it until the Save window opens. After saving you see "Saved to …" with an **Open folder** button that shows the file in Explorer. If you cancel the Save window the message goes away.
4. **Save asks once per session.** The first Save of an item in each session opens the Save window at the file you saved last time (same folder, name and file type), so pressing Enter overwrites it. After that, Save in the same session writes over the file silently, as before. This applies to images, video, audio and guides. Save as… always asks.
5. **Same formats everywhere.** The guide panel has **PowerPoint** and **PNG** buttons next to Word, PDF, JPG and Saveit. Library Save offers all six for guides, and starts in Documents for documents and Pictures for pictures.
6. **PDF has real, searchable text.** Guide PDFs used to be pictures of pages. They are now built as pages of text (title, step number, heading, instructions, screenshot), so you can search, copy and have them read aloud. Each step stays together on one page. The old picture PDF is used only where printing isn't available.

Also: the Open folder button's handler checks that the request comes from the main window.

Tests: `tests/stepguide-tests.cjs` (8 checks) and `tests/native-stepguide.cjs` (5 checks in real Electron, including that a window with opacity 0 is not in a screen capture). Rotation 24/24, polish 35/35, audio 24/24, MP3/M4A 6/6, review fixes 7/7, pitch checks and the 82-check suite pass.
