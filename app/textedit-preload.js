const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('te', {
  onLoad: fn => ipcRenderer.on('te-load', (e, d) => fn(d)),
  update: o => ipcRenderer.send('te-update', o),
  pick: key => ipcRenderer.invoke('te-pick', key),
  forget: key => ipcRenderer.invoke('te-forget', key),
  copy: (text, html) => ipcRenderer.invoke('te-copy', text, html),
  saveLib: o => ipcRenderer.invoke('te-save-lib', o),
  saveFile: (name, fmt, data) => ipcRenderer.invoke('te-save-file', name, fmt, data),
  print: () => ipcRenderer.send('te-print'),
  editor: () => ipcRenderer.send('te-editor'),
  grab: () => ipcRenderer.send('te-grab')
});
