const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlay', {
  onData: fn => ipcRenderer.on('data', (e, d) => fn(d)),
  done: result => ipcRenderer.send('overlay-done', result)
});
