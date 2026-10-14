const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bench', {
  capture: (mode, delay, opts, pre) => ipcRenderer.invoke('capture', mode, delay, opts, pre),
  prepareRecord: (area, delay, opts, pre) => ipcRenderer.invoke('prepare-record', area, delay, opts, pre),
  ocr: dataUrl => ipcRenderer.invoke('ocr', dataUrl),
  copyFile: (name, data) => ipcRenderer.invoke('copy-file', name, data),
  recUI: (on, info, extra) => ipcRenderer.send('rec-ui', on, info, extra),
  recState: st => ipcRenderer.send('rec-state', st),
  startSteps: delay => ipcRenderer.invoke('steps-start', delay),
  onStepShot: fn => ipcRenderer.on('step-shot', (e, d) => fn(d)),
  onStepInfo: fn => ipcRenderer.on('step-info', (e, d) => fn(d)),
  onStepsDone: fn => ipcRenderer.on('steps-done', () => fn()),
  printPdf: (html, name) => ipcRenderer.invoke('print-pdf', html, name),
  saveMany: files => ipcRenderer.invoke('save-many', files),
  save: (name, data) => ipcRenderer.invoke('save', name, data),
  copyImage: dataUrl => ipcRenderer.invoke('copy-image', dataUrl),
  setRecording: on => ipcRenderer.send('recording', on),
  onHotkey: fn => ipcRenderer.on('hotkey', (e, mode) => fn(mode)),
  onRecCmd: fn => ipcRenderer.on('rec-cmd', (e, c) => fn(c)),
  widgetOpen: opts => ipcRenderer.send('widget-open', opts),
  onWidgetOpts: fn => ipcRenderer.on('widget-opts', (e, o) => fn(o)),
  onWidgetGo: fn => ipcRenderer.on('widget-go', (e, o) => fn(o)),
  onShortcutFailed: fn => ipcRenderer.on('shortcut-failed', (e, keys) => fn(keys))
});
