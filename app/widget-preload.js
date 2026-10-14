const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('widget', {
  onInit: fn => ipcRenderer.on('init', (e, o) => fn(o)),
  opts: o => ipcRenderer.send('widget-opts', o),
  go: o => ipcRenderer.send('widget-go', o),
  editor: () => ipcRenderer.send('widget-editor'),
  size: (w, h) => ipcRenderer.send('widget-size', w, h)
});
