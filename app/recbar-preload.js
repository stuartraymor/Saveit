const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('recbar', {
  cmd: c => ipcRenderer.send('rec-cmd', c),
  onState: fn => ipcRenderer.on('state', (e, st) => fn(st))
});
