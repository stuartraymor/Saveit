# Saveit 8.3.0 — revision changes

## Ticket 7 — Library Back button and folder navigation

- **Up button** at the top-left of the Library (‹ arrow, next to the title). It goes up one folder at a time. It's disabled at the Library root.
- **Nested folders.** Folders can now contain folders, up to any depth. A folder is stored by its full path, such as `Project/Subfolder`, in the same folder list as before. Existing folders and items work unchanged.
  - The Library root shows top-level folders. Opening a folder shows its subfolders first, then its items.
  - **+ New folder** inside a folder creates a subfolder there. (The Folders view and the Library root create top-level folders, as before.)
  - The location bar shows the full path, e.g. `Project / Subfolder`.
  - The Folders view lists every folder with its full path.
- **Rename** a folder: renaming a parent renames everything under it. Subfolders and their items keep their place.
- **Delete** a folder: its items and subfolders move up one level (to the parent folder, or to the Library root for a top-level folder). Items are never lost.
- Folder names can't contain `/`. A `/` typed into a name is replaced with `-`.
- The existing **‹ Library** button and the Folders button are kept.

**Files:** `app/index.html` (folder helpers `folderParent`, `folderLeaf`, `childFolders`, `remapFolder`, `moveFolderTree`, `libUp`; Library header, location bar, folder cards, rename and delete), `app/package.json`, `install.ps1`, `README.txt` (version 8.3.0).

**Tested** in the dev build, with real clicks on the Library's buttons:
- Created `Project`, then `Project / Sub` inside it. The Up button was disabled at the root and enabled inside folders.
- Up went `Project / Sub` → `Project` → Library root, one level at a time.
- Moved a capture into `Project / Sub` with Move to folder, then browsed down to it.
- Renamed `Project` to `Alpha`. The subfolder became `Alpha / Sub` and kept its item.
- Deleted `Alpha / Sub`. Its item moved up to `Alpha`.
- Folders view listed the folder; Up from there returned to the Library root.
- Folder list saved correctly (`saveit.folders`).
- No JavaScript errors.

**Not tested:** dragging captures onto folder cards and onto the "‹ Library" button; searching while inside nested folders; reopening the app after creating nested folders (the folder list is saved, but I didn't restart the app to confirm it reloads).
