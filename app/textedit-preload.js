const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('te', {
  onLoad: fn => ipcRenderer.on('te-load', (e, d) => fn(d)),
  // 10.5.3: a Grab Text started from this window arrives beside the page instead of replacing it
  onSide: fn => ipcRenderer.on('te-side', (e, d) => fn(d)),
  onContext: fn => ipcRenderer.on('te-context', (e, d) => fn(d)),
  update: o => ipcRenderer.send('te-update', o),
  pick: key => ipcRenderer.invoke('te-pick', key),
  forget: key => ipcRenderer.invoke('te-forget', key),
  copy: (text, html) => ipcRenderer.invoke('te-copy', text, html),
  saveLib: o => ipcRenderer.invoke('te-save-lib', o),
  saveFile: (name, fmt, data, page) => ipcRenderer.invoke('te-save-file', name, fmt, data, page),
  newPage: o => ipcRenderer.invoke('te-new', o),
  openFile: () => ipcRenderer.invoke('te-open-file'),
  ctx: o => ipcRenderer.send('te-ctx', o),
  print: hf => ipcRenderer.send('te-print', hf),
  editor: () => ipcRenderer.send('te-editor'),
  grab: () => ipcRenderer.send('te-grab')
});
