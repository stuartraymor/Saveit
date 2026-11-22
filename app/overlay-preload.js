const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlay', {
  onData: fn => ipcRenderer.on('data', (e, d) => fn(d)),
  done: result => ipcRenderer.send('overlay-done', result),
  shown: () => ipcRenderer.send('overlay-shown'),
  // 10.5.2: Saveit says when the window is on screen, so the dimming fades in from then
  onVisible: fn => ipcRenderer.on('visible', () => fn()),
  onFull: fn => ipcRenderer.on('full', (e, d) => fn(d))
});
