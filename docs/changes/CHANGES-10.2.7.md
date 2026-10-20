# Saveit 10.2.7

- The "Updating Saveit" window now comes to the front. Windows keeps programs that start in the background behind the one you are using, so on 10.2.5/10.2.6 the window could open behind other windows and be missed. It now asks for the front when it opens and keeps asking for the first few seconds, stays on top, and stays on screen for at least about 5 seconds after a successful update so it is not missed.
- Test: tests/updating-ui-test.ps1 now starts the window the way Saveit does, with another program (Notepad) in front, and checks it takes the foreground and is topmost.
- Note: the window shown during an update is the one from the version doing the update, so this fix is visible from the update made by 10.2.7 onward.
