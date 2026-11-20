// 10.4.2: the Grab Text window. It opens beside the editor after every Grab Text and keeps the grabs of this session
// (nothing is saved to the library until Save to library is pressed). Saved texts are library items of kind 'text'.
const fs = require('fs');
module.exports = function textWindow({ ipcMain, BrowserWindow, Menu, clipboard, dialog, screen, asset, editor, showEditor }) {
  let tw = null, seq = 0, current = null, saveSeq = 0, loaded = false, wanted = false;
  const grabs = [];               // this session's grabs, newest first: {key,name,text,html,src,libId,created,loading,empty}
  const pending = new Map();      // library saves waiting for the editor's answer
  const fromTw = e => tw && !tw.isDestroyed() && e.sender === tw.webContents;
  const fromEditor = e => { const w = editor(); return w && !w.isDestroyed() && e.sender === w.webContents; };
  const str = (v, max) => typeof v === 'string' ? v.slice(0, max) : '';
  const summary = () => grabs.map(g => ({ key: g.key, name: g.name, created: g.created, libId: g.libId || null, preview: (g.text || '').replace(/\s+/g, ' ').trim().slice(0, 60) }));
  function send() { if (!tw || tw.isDestroyed() || !current) return; tw.webContents.send('te-load', { entry: current, list: summary() }); }
  function make() {
    const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea, W = Math.min(980, d.width - 40), H = Math.min(700, d.height - 40);
    tw = new BrowserWindow({ x: Math.round(d.x + d.width - W - 24), y: Math.round(d.y + Math.max(20, (d.height - H) / 2)), width: W, height: H, minWidth: 560, minHeight: 380,
      title: 'Saveit Grab Text', backgroundColor: '#16181a', autoHideMenuBar: true, show: false, icon: asset('icon.png'),
      webPreferences: { preload: asset('textedit-preload.js'), contextIsolation: true, nodeIntegration: false, spellcheck: true } });
    tw.setMenu(null);
    tw.loadFile(asset('textedit.html'));
    loaded = false;
    tw.webContents.once('did-finish-load', () => { loaded = true; if (!current || !wanted) return; send(); if (tw && !tw.isDestroyed()) { tw.show(); tw.focus(); } });
    // Right-click: spelling suggestions, cut, copy, paste
    tw.webContents.on('context-menu', (e, p) => {
      const rows = [];
      for (const s of (p.dictionarySuggestions || []).slice(0, 6)) rows.push({ label: s, click: () => tw.webContents.replaceMisspelling(s) });
      if (p.misspelledWord) { if (!rows.length) rows.push({ label: 'No spelling suggestions', enabled: false }); rows.push({ label: 'Add to dictionary', click: () => tw.webContents.session.addWordToSpellCheckerDictionary(p.misspelledWord) }, { type: 'separator' }); }
      rows.push({ role: 'undo', enabled: p.editFlags.canUndo }, { role: 'redo', enabled: p.editFlags.canRedo }, { type: 'separator' },
        { role: 'cut', enabled: p.editFlags.canCut }, { role: 'copy', enabled: p.editFlags.canCopy }, { role: 'paste', enabled: p.editFlags.canPaste }, { label: 'Paste as plain text', role: 'pasteAndMatchStyle', enabled: p.editFlags.canPaste }, { type: 'separator' }, { role: 'selectAll' });
      Menu.buildFromTemplate(rows).popup({ window: tw });
    });
    // Closing only hides the window, so the next grab opens instantly; it is destroyed when Saveit quits.
    tw.on('close', e => { if (!quitting) { e.preventDefault(); wanted = false; tw.hide(); } });
    tw.on('closed', () => { tw = null; loaded = false; });
  }
  let quitting = false;
  require('electron').app.on('before-quit', () => { quitting = true; });
  // Prepared hidden a few seconds after start, like the widget
  require('electron').app.whenReady().then(() => setTimeout(() => { if (!tw || tw.isDestroyed()) { try { make(); } catch (_) {} } }, 4000));
  // Open (or update) a grab. A grab with the same key or library id is updated in place.
  function open(o) {
    o = o || {};
    let g = (o.key && grabs.find(x => x.key === o.key)) || (o.libId && grabs.find(x => x.libId === o.libId));
    if (!g) { g = { key: 'g' + Date.now() + '-' + (++seq), created: Date.now() }; grabs.unshift(g); if (grabs.length > 40) grabs.length = 40; }
    for (const k of ['name', 'text', 'html', 'src', 'libId']) if (o[k] !== undefined) g[k] = o[k];
    g.loading = !!o.loading; g.empty = !!o.empty; if (!g.name) g.name = 'Grabbed text';
    current = g; wanted = true;
    if (!tw || tw.isDestroyed()) make(); else if (loaded) { send(); if (tw.isMinimized()) tw.restore(); tw.show(); if (!o.loading) tw.focus(); }
    return g.key;
  }
  ipcMain.handle('te-open', (e, o) => { if (!fromEditor(e)) throw Error('Unsupported request source'); return open({ key: str(o?.key, 80) || undefined, name: str(o?.name, 200) || undefined, text: o?.text == null ? undefined : str(o.text, 2e6), html: o?.html == null ? undefined : str(o.html, 4e6), src: o?.src == null ? undefined : str(o.src, 4e7), libId: str(o?.libId, 80) || undefined, loading: !!o?.loading, empty: !!o?.empty }); });
  // The window keeps main's copy of the open grab current, so switching between grabs or closing the window loses nothing.
  ipcMain.on('te-update', (e, o) => { if (!fromTw(e)) return; const g = grabs.find(x => x.key === o?.key); if (!g) return; g.text = str(o.text, 2e6); g.html = str(o.html, 4e6); if (typeof o.name === 'string') g.name = str(o.name, 200) || 'Grabbed text'; });
  ipcMain.handle('te-pick', (e, key) => { if (!fromTw(e)) return null; const g = grabs.find(x => x.key === key); if (!g) return null; current = g; return { entry: g, list: summary() }; });
  ipcMain.handle('te-forget', (e, key) => { if (!fromTw(e)) return null; const i = grabs.findIndex(x => x.key === key); if (i >= 0) grabs.splice(i, 1); if (current && current.key === key) current = grabs[0] || null; return { entry: current, list: summary() }; });
  ipcMain.handle('te-copy', (e, text, html) => { if (!fromTw(e)) return false; const d = { text: str(text, 2e6) }; if (html) d.html = str(html, 4e6); clipboard.write(d); return true; });
  ipcMain.handle('te-save-lib', (e, o) => {
    if (!fromTw(e)) throw Error('Unsupported request source');
    const w = editor(); if (!w || w.isDestroyed()) throw Error('The Saveit editor is not running.');
    const g = grabs.find(x => x.key === o?.key);
    const req = { req: ++saveSeq, libId: (g && g.libId) || null, name: str(o?.name, 200) || 'Grabbed text', text: str(o?.text, 2e6), html: str(o?.html, 4e6), src: g && g.src || null };
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { pending.delete(req.req); reject(Error('The library did not answer. Try again.')); }, 20000);
      pending.set(req.req, r => { clearTimeout(t); if (r && r.id) { if (g) { g.libId = r.id; g.name = req.name; g.text = req.text; g.html = req.html; } resolve({ id: r.id, list: summary() }); } else reject(Error(r && r.error || 'Could not save to the library.')); });
      w.webContents.send('te-save', req);
    });
  });
  ipcMain.on('te-saved', (e, req, r) => { if (!fromEditor(e)) return; const f = pending.get(req); if (f) { pending.delete(req); f(r); } });
  ipcMain.handle('te-save-file', async (e, name, fmt, data) => {
    if (!fromTw(e)) throw Error('Unsupported request source');
    const ext = fmt === 'html' ? 'html' : 'txt', safe = (str(name, 120).replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Grabbed text');
    const r = await dialog.showSaveDialog(tw, { title: 'Save text', defaultPath: safe + '.' + ext, filters: ext === 'html' ? [{ name: 'Web page (opens in Word)', extensions: ['html'] }] : [{ name: 'Text file', extensions: ['txt'] }] });
    if (r.canceled || !r.filePath) return null;
    await fs.promises.writeFile(r.filePath, ext === 'txt' ? '﻿' + str(data, 4e6).replace(/\r?\n/g, '\r\n') : str(data, 8e6), 'utf8');
    return r.filePath;
  });
  ipcMain.on('te-print', e => { if (fromTw(e)) tw.webContents.print({ silent: false, printBackground: false }); });
  ipcMain.on('te-editor', e => { if (fromTw(e)) showEditor(); });
  ipcMain.on('te-grab', e => { if (!fromTw(e)) return; const w = editor(); if (w && !w.isDestroyed()) w.webContents.send('grab-text-now'); });
  return {
    open,
    // Captures leave Saveit's own windows out of the picture: hide this one too and bring it back afterwards.
    hideForCapture() { if (!tw || tw.isDestroyed() || !tw.isVisible() || tw.isMinimized()) return false; try { tw.setOpacity(0); } catch (_) {} tw.hide(); return true; },
    restore() { if (tw && !tw.isDestroyed()) { try { tw.setOpacity(1); } catch (_) {} tw.showInactive(); } },
    get window() { return tw; }
  };
};
