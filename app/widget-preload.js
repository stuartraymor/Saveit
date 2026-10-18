const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('widget', {
  onInit: fn => ipcRenderer.on('init', (e, o) => fn(o)),
  opts: o => ipcRenderer.send('widget-opts', o),
  go: o => ipcRenderer.send('widget-go', o),
  editor: () => ipcRenderer.send('widget-editor'),
  camSettings: () => ipcRenderer.send('cam-settings'),
  appVersion: () => ipcRenderer.invoke('app-version'),
  size: (w, h, lx, ly) => ipcRenderer.send('widget-size', w, h, lx, ly)
});
