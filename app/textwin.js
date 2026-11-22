// 10.4.2: the Grab Text window. It opens beside the editor after every Grab Text and keeps the grabs of this session
// (nothing is saved to the library until Save to library is pressed). Saved texts are library items of kind 'text'.
const fs = require('fs');
module.exports = function textWindow({ ipcMain, BrowserWindow, Menu, clipboard, dialog, screen, asset, editor, showEditor }) {
  let tw = null, seq = 0, current = null, saveSeq = 0, loaded = false, wanted = false;
  const grabs = [];               // recent pages and grabs, newest first: {key,name,text,html,src,libId,created,loading,empty,dirty}
  // 10.4.10: pages are kept on disk, so nothing typed is lost when Saveit closes or the computer restarts
  const draftsFile = () => require('path').join(require('electron').app.getPath('userData'), 'text-pages.json');
  let draftT = null;
  function keepDrafts() { clearTimeout(draftT); draftT = setTimeout(writeDrafts, 800); }
  function writeDrafts() {
    clearTimeout(draftT); draftT = null;
    try {
      const list = grabs.filter(g => !g.loading && ((g.text || '').trim() || /<img/i.test(g.html || ''))).slice(0, 40)
        .map(g => ({ key: g.key, name: g.name, text: g.text, html: g.html, src: g.src && g.src.length < 8e6 ? g.src : null, libId: g.libId || null, created: g.created, dirty: !!g.dirty,
          grabText: g.grabText || undefined, sideSrc: g.sideSrc && g.sideSrc.length < 8e6 ? g.sideSrc : undefined, sideText: g.sideSrc && g.sideSrc.length < 8e6 ? g.sideText || '' : undefined }));
      const f = draftsFile(), tmp = f + '.tmp'; fs.writeFileSync(tmp, JSON.stringify({ v: 1, pages: list })); fs.renameSync(tmp, f);
    } catch (_) {}
  }
  function readDrafts() {
    try { const d = JSON.parse(fs.readFileSync(draftsFile(), 'utf8')); for (const g of (d.pages || []).slice(0, 40)) if (g && typeof g.key === 'string' && typeof g.html === 'string' && !grabs.some(x => x.key === g.key)) grabs.push({ key: g.key, name: String(g.name || 'Page'), text: String(g.text || ''), html: g.html, src: typeof g.src === 'string' ? g.src : null, libId: g.libId || null, created: +g.created || Date.now(), dirty: !!g.dirty,
      grabText: typeof g.grabText === 'string' ? g.grabText : undefined, sideSrc: typeof g.sideSrc === 'string' ? g.sideSrc : undefined, sideText: typeof g.sideText === 'string' ? g.sideText : undefined }); } catch (_) {}
  }
  const pending = new Map();      // library saves waiting for the editor's answer
  const fromTw = e => tw && !tw.isDestroyed() && e.sender === tw.webContents;
  const fromEditor = e => { const w = editor(); return w && !w.isDestroyed() && e.sender === w.webContents; };
  const str = (v, max) => typeof v === 'string' ? v.slice(0, max) : '';
  const summary = () => grabs.map(g => ({ key: g.key, name: g.name, created: g.created, libId: g.libId || null, dirty: !!g.dirty, preview: (g.text || '').replace(/\s+/g, ' ').trim().slice(0, 60) }));
  function send() { if (!tw || tw.isDestroyed() || !current) return; tw.webContents.send('te-load', { entry: current, list: summary() }); }
  function make() {
    const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea, W = Math.min(980, d.width - 40), H = Math.min(700, d.height - 40);
    tw = new BrowserWindow({ x: Math.round(d.x + d.width - W - 24), y: Math.round(d.y + Math.max(20, (d.height - H) / 2)), width: W, height: H, minWidth: 560, minHeight: 380,
      title: 'Saveit Page', backgroundColor: '#16181a', autoHideMenuBar: true, show: false, icon: asset('icon.png'),
      webPreferences: { preload: asset('textedit-preload.js'), contextIsolation: true, nodeIntegration: false, spellcheck: true } });
    tw.setMenu(null);
    tw.loadFile(asset('textedit.html'));
    loaded = false;
    tw.webContents.once('did-finish-load', () => { loaded = true; if (!current || !wanted) return; send(); if (tw && !tw.isDestroyed()) { tw.show(); tw.focus(); } });
    // 10.4.10: right-click shows Saveit's own menu inside the page (spelling suggestions, picture, table and link actions)
    tw.webContents.on('context-menu', (e, p) => {
      tw.webContents.send('te-context', { x: p.x, y: p.y, word: p.misspelledWord || '', sugg: (p.dictionarySuggestions || []).slice(0, 6), link: p.linkURL || '',
        canUndo: p.editFlags.canUndo, canRedo: p.editFlags.canRedo, canCut: p.editFlags.canCut, canCopy: p.editFlags.canCopy, canPaste: p.editFlags.canPaste, editable: p.isEditable });
    });
    // Links never open inside the editor window
    tw.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    tw.webContents.on('will-navigate', e => e.preventDefault());
    // Closing only hides the window, so the next grab opens instantly; it is destroyed when Saveit quits.
    tw.on('close', e => { if (!quitting) { e.preventDefault(); wanted = false; tw.hide(); } });
    tw.on('closed', () => { tw = null; loaded = false; });
  }
  let quitting = false;
  require('electron').app.on('before-quit', () => { quitting = true; if (draftT) writeDrafts(); });
  require('electron').app.whenReady().then(readDrafts);
  // Prepared hidden a few seconds after start, like the widget
  require('electron').app.whenReady().then(() => setTimeout(() => { if (!tw || tw.isDestroyed()) { try { make(); } catch (_) {} } }, 4000));
  // Open (or update) a grab. A grab with the same key or library id is updated in place.
  // 10.5.3: a Grab Text started from the page window (its Grab text button) arrives beside the page that is open: the
  // picture and the text read from it go into the side panel, and the page itself is not replaced or changed.
  let sideFor = null, sideAt = 0;
  function side(o) {
    const g = grabs.find(x => x.key === (o.key || sideFor)) || null;
    if (!g || !tw || tw.isDestroyed() || !loaded) return null;
    if (o.src) g.sideSrc = o.src;
    g.sideText = o.text || ''; g.sideLoading = !!o.loading; g.sideEmpty = !!o.empty;
    if (!o.loading) { sideFor = null; keepDrafts(); }
    wanted = true;
    if (current !== g) { current = g; send(); }
    tw.webContents.send('te-side', { key: g.key, src: g.sideSrc || '', text: g.sideText, loading: g.sideLoading, empty: g.sideEmpty });
    if (tw.isMinimized()) tw.restore(); tw.show(); if (!o.loading) tw.focus();
    return g.key;
  }
  function open(o) {
    o = o || {};
    if (o.side) { const k = side(o); if (k) return k; }
    let g = (o.key && grabs.find(x => x.key === o.key)) || (o.libId && grabs.find(x => x.libId === o.libId));
    if (!g) { g = { key: 'g' + Date.now() + '-' + (++seq), created: Date.now() }; grabs.unshift(g); if (grabs.length > 40) grabs.length = 40; }
    for (const k of ['name', 'text', 'html', 'src', 'libId']) if (o[k] !== undefined) g[k] = o[k];
    if (g.src && !g.libId && !o.loading && typeof o.text === 'string' && o.text && g.grabText === undefined) g.grabText = o.text; // what was read, kept beside the page while the page is edited
    g.loading = !!o.loading; g.empty = !!o.empty; if (!g.name) g.name = 'Grabbed text'; if (o.dirty !== undefined) g.dirty = !!o.dirty; if (o.libId) g.dirty = false;
    keepDrafts();
    current = g; wanted = true;
    if (!tw || tw.isDestroyed()) make(); else if (loaded) { send(); if (tw.isMinimized()) tw.restore(); tw.show(); if (!o.loading) tw.focus(); }
    return g.key;
  }
  ipcMain.handle('te-open', (e, o) => { if (!fromEditor(e)) throw Error('Unsupported request source'); return open({ key: str(o?.key, 80) || undefined, name: str(o?.name, 200) || undefined, text: o?.text == null ? undefined : str(o.text, 2e6), html: o?.html == null ? undefined : str(o.html, 6e7), src: o?.src == null ? undefined : str(o.src, 4e7), libId: str(o?.libId, 80) || undefined, loading: !!o?.loading, empty: !!o?.empty, side: !!o?.side }); });
  // 10.4.10: New page and Open file from the page window itself
  ipcMain.handle('te-new', (e, o) => { if (!fromTw(e)) throw Error('Unsupported request source'); return open({ name: str(o?.name, 200) || 'New page', text: str(o?.text, 2e6), html: str(o?.html, 6e7), dirty: !!o?.dirty }); });
  ipcMain.handle('te-open-file', async e => {
    if (!fromTw(e)) throw Error('Unsupported request source');
    const r = await dialog.showOpenDialog(tw, { title: 'Open a document', properties: ['openFile'], filters: [{ name: 'Documents', extensions: ['docx', 'txt', 'md', 'html', 'htm', 'csv', 'log'] }, { name: 'All files', extensions: ['*'] }] });
    if (r.canceled || !r.filePaths[0]) return null;
    const f = r.filePaths[0], st = await fs.promises.stat(f); if (st.size > 60e6) throw Error('That file is too large to open here (over 60 MB).');
    const ext = (f.split('.').pop() || '').toLowerCase(), name = require('path').basename(f).replace(/\.[^.]+$/, '');
    const buf = await fs.promises.readFile(f);
    return ext === 'docx' ? { name, ext, bytes: new Uint8Array(buf) } : { name, ext, text: buf.toString('utf8').replace(/^﻿/, '') };
  });
  ipcMain.on('te-ctx', (e, o) => {
    if (!fromTw(e)) return; const wc = tw.webContents;
    if (o?.act === 'replace' && typeof o.word === 'string') wc.replaceMisspelling(o.word.slice(0, 200));
    else if (o?.act === 'addword' && typeof o.word === 'string') wc.session.addWordToSpellCheckerDictionary(o.word.slice(0, 200));
    else if (o?.act === 'paste') wc.paste();
    else if (o?.act === 'pastePlain') wc.pasteAndMatchStyle();
    else if (o?.act === 'openLink' && /^(https?:|mailto:)/i.test(String(o.url || ''))) require('electron').shell.openExternal(String(o.url));
  });
  // The window keeps main's copy of the open grab current, so switching between grabs or closing the window loses nothing.
  ipcMain.on('te-update', (e, o) => { if (!fromTw(e)) return; const g = grabs.find(x => x.key === o?.key); if (!g) return; g.text = str(o.text, 2e6); g.html = str(o.html, 6e7); if (typeof o.name === 'string') g.name = str(o.name, 200) || 'Grabbed text'; g.dirty = !!o.dirty; keepDrafts(); });
  ipcMain.handle('te-pick', (e, key) => { if (!fromTw(e)) return null; const g = grabs.find(x => x.key === key); if (!g) return null; current = g; return { entry: g, list: summary() }; });
  ipcMain.handle('te-forget', (e, key) => { if (!fromTw(e)) return null; const i = grabs.findIndex(x => x.key === key); if (i >= 0) grabs.splice(i, 1); if (current && current.key === key) current = grabs[0] || null; keepDrafts(); return { entry: current, list: summary() }; });
  ipcMain.handle('te-copy', (e, text, html) => { if (!fromTw(e)) return false; const d = { text: str(text, 2e6) }; if (html) d.html = str(html, 4e6); clipboard.write(d); return true; });
  ipcMain.handle('te-save-lib', (e, o) => {
    if (!fromTw(e)) throw Error('Unsupported request source');
    const w = editor(); if (!w || w.isDestroyed()) throw Error('The Saveit editor is not running.');
    const g = grabs.find(x => x.key === o?.key);
    const req = { req: ++saveSeq, libId: (g && g.libId) || null, name: str(o?.name, 200) || 'Grabbed text', text: str(o?.text, 2e6), html: str(o?.html, 6e7), src: g && g.src || null };
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { pending.delete(req.req); reject(Error('The library did not answer. Try again.')); }, 20000);
      pending.set(req.req, r => { clearTimeout(t); if (r && r.id) { if (g) { g.libId = r.id; g.name = req.name; g.text = req.text; g.html = req.html; g.dirty = false; keepDrafts(); } resolve({ id: r.id, list: summary() }); } else reject(Error(r && r.error || 'Could not save to the library.')); });
      w.webContents.send('te-save', req);
    });
  });
  ipcMain.on('te-saved', (e, req, r) => { if (!fromEditor(e)) return; const f = pending.get(req); if (f) { pending.delete(req); f(r); } });
  // 10.4.10: Word document, PDF, web page or text file. PDF is printed from this window (its print styles show only the page).
  const SAVE_TYPES = { txt: ['Text file', 'txt'], html: ['Web page', 'html'], docx: ['Word document', 'docx'], pdf: ['PDF document', 'pdf'], md: ['Markdown', 'md'] };
  ipcMain.handle('te-save-file', async (e, name, fmt, data, page) => {
    if (!fromTw(e)) throw Error('Unsupported request source');
    const t = SAVE_TYPES[fmt] || SAVE_TYPES.txt, ext = t[1], safe = (str(name, 120).replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Page');
    const r = await dialog.showSaveDialog(tw, { title: 'Save as ' + t[0], defaultPath: safe + '.' + ext, filters: [{ name: t[0], extensions: [ext] }] });
    if (r.canceled || !r.filePath) return null;
    let out;
    if (ext === 'pdf') {
      const p = page || {}, size = { letter: 'Letter', a4: 'A4', legal: 'Legal', tabloid: 'Tabloid', a3: 'A3', a5: 'A5', executive: p.orientation === 'landscape' ? { width: 10.5, height: 7.25 } : { width: 7.25, height: 10.5 } }[p.size] || 'Letter', m = Math.max(0, Math.min(3, +p.margin || 1));
      // 10.5.4: header, footer and page numbers on every page
      const hf = p.hf && typeof p.hf === 'object' ? p.hf : {}, he = v => str(v, 300).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const numHtml = hf.fmt === 'nofm' ? 'Page <span class="pageNumber"></span> of <span class="totalPages"></span>' : '<span class="pageNumber"></span>';
      const bar = (left, mid, right) => `<div style="font-size:9pt;font-family:'Segoe UI',sans-serif;color:#555;width:100%;padding:0 ${m}in;display:flex;justify-content:space-between;-webkit-print-color-adjust:exact"><span style="flex:1;text-align:left">${left}</span><span style="flex:1;text-align:center">${mid}</span><span style="flex:1;text-align:right">${right}</span></div>`;
      const any = !!(str(hf.header, 300) || str(hf.footer, 300) || ['bc', 'br', 'tr'].includes(hf.num));
      // 10.5.4: the window's dark colour was painted into the margins of every PDF page; it is white while the PDF is made
      try { tw.setBackgroundColor('#ffffff'); } catch (_) {}
      try { out = await tw.webContents.printToPDF({ pageSize: size, landscape: p.orientation === 'landscape', printBackground: true, margins: { top: m, bottom: m, left: m, right: m },
        ...(any ? { displayHeaderFooter: true, headerTemplate: bar(he(hf.header), '', hf.num === 'tr' ? numHtml : ''), footerTemplate: bar(he(hf.footer), hf.num === 'bc' ? numHtml : '', hf.num === 'br' ? numHtml : '') } : {}) }); }
      finally { try { tw.setBackgroundColor('#16181a'); } catch (_) {} }
    } else if (ext === 'docx') { if (!(data instanceof Uint8Array)) throw Error('Nothing to save.'); out = Buffer.from(data); }
    else if (ext === 'txt' || ext === 'md') out = '﻿' + str(data, 4e6).replace(/\r?\n/g, '\r\n');
    else out = str(data, 8e7);
    await fs.promises.writeFile(r.filePath, out, typeof out === 'string' ? 'utf8' : undefined);
    return r.filePath;
  });
  ipcMain.on('te-print', (e, hf) => { if (!fromTw(e)) return; const o = { silent: false, printBackground: false }, h = str(hf && hf.header, 300), f = str(hf && hf.footer, 300); if (h) o.header = h; if (f) o.footer = f; tw.webContents.print(o); });
  ipcMain.on('te-editor', e => { if (fromTw(e)) showEditor(); });
  ipcMain.on('te-grab', e => { if (!fromTw(e)) return; const w = editor(); if (!w || w.isDestroyed()) return; sideFor = current ? current.key : null; sideAt = Date.now(); w.webContents.send('grab-text-now', { side: !!sideFor }); });
  return {
    open,
    // Captures leave Saveit's own windows out of the picture: hide this one too and bring it back afterwards.
    hideForCapture() { if (!tw || tw.isDestroyed() || !tw.isVisible() || tw.isMinimized()) return false; try { tw.setOpacity(0); } catch (_) {} tw.hide(); return true; },
    restore() { if (tw && !tw.isDestroyed()) { try { tw.setOpacity(1); } catch (_) {} tw.showInactive(); } },
    get window() { return tw; }
  };
};
