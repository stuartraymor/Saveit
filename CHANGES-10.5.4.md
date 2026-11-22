# Saveit 10.5.4

The Page editor becomes more of a word processor, and more faults from the continuing review are fixed.

## Page editor
- **Header, footer and page numbers** (Layout > Header & footer): text at the top and bottom of every page, page numbers at the bottom centre, bottom right or top right, as "1, 2, 3" or "Page 1 of 3". They are shown faintly on the sheet while you edit, and are kept with the page.
  - PDF and Word files carry them on every page (checked in Microsoft Word). A Word file's header, footer and page numbers come back when it is opened.
  - Printing shows the header and footer text. Windows' print does not add the page numbers; save as PDF and print that when you need them.
- **Styles:** Title, Subtitle and Heading 4 join Normal, Heading 1-3, Quote and Code. They save to Word as the matching Word styles and come back from Word files.
- **Contents** (Insert > Contents): a list of the page's headings, indented by level. Click a line to go to its heading. Click Contents again to update it.
- **Footnotes** (Insert > Footnote): a small number in the text and the note at the end of the page. Numbers follow the order in the text; deleting a number removes its note. Double-click a number to go to its note.
- **Format painter** (Home): copies the look of the text the cursor is in (font, size, colour, highlight, bold, italic, underline, strikethrough) to the text you drag over next. Esc cancels.
- **Indents** (line spacing menu): Indent the first line, Hanging indent, No indent. Word files keep them.
- **Tables** (right-click a cell): make the first row a header row, merge with the cell on the right, split a merged cell, make the columns the same width, shade a cell or a row. All can be undone.

## Fixes
- **PDF pages had dark margins.** The window's dark colour was painted around the white page in every PDF. PDFs are white to the edge now.
- Word files: a paragraph with both a left indent and a first-line indent wrote two indent entries (invalid); it writes one.
- **Saving a guide as PDF** left its chosen file name behind. The next export (library backup, a guide's Word or JPG button, a video's GIF) was written over that PDF without asking. Fixed.
- **Library > Move out…** removed every selected item whose name matched a saved file, so an item that could not be saved was deleted too when another item had the same name. Only items that were really saved are removed, and the message says how many stayed.
- Quit while the library is still saving (more than 5 seconds) hid Saveit in the tray instead of quitting. It quits when the save finishes.
- Opening a video with no sound left one audio engine open each time. It is closed.

## Tests
- New real-app suite `native-page-1054` (23 checks) for everything above, including the Word round trip and the real Save as PDF path.

## Known, not changed here
- Library > Save… and Move out… write a video as it was recorded when WebM is chosen (and MP4 for some imported videos), without its edits. Save edited videos from the video editor until this is fixed.
- Deleting a step from a guide cannot be undone.
- A video added to another video "from your library" becomes offline if the original is deleted.
- Library backup is one large file and can fail for libraries with a lot of video.
- Decoded audio stays in memory until Saveit is restarted.
- Columns, header/footer and the contents list are not undone by Ctrl+Z (choose again to change them).
