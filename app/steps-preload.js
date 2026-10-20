const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('steps', {
  cmd: c => ipcRenderer.send('steps-cmd', c),
  onState: fn => ipcRenderer.on('state', (e, st) => fn(st))
});
