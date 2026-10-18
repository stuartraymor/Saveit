// Saveit — desktop shell
const { app, BrowserWindow, ipcMain, desktopCapturer, screen, globalShortcut, Tray, Menu, dialog, clipboard, nativeImage, session, shell } = require('electron');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const fs = require('fs');

// SAVEIT_REVIEW_DATA points the regression suites at an isolated test profile; normal runs use the real library.
if (process.env.SAVEIT_REVIEW_DATA) app.setPath('userData', process.env.SAVEIT_REVIEW_DATA);
if (!app.requestSingleInstanceLock()) { app.quit(); }
app.setAppUserModelId('com.saveit.app');
// 10.0.12: right-click menu for text everywhere (Grabbed text box, step titles, names, search): Cut, Copy, Paste, Select all.
// Pages that draw their own right-click menu (canvas, thumbnails, timelines) call preventDefault, so Electron skips this for them.
app.on('web-contents-created', (_e, wc) => {
  wc.on('context-menu', (_ev, p) => {
    if (wc.isDestroyed()) return;
    const items = [];
    if (p.isEditable) items.push({ role: 'cut', enabled: p.editFlags.canCut }, { role: 'copy', enabled: p.editFlags.canCopy }, { role: 'paste', enabled: p.editFlags.canPaste }, { type: 'separator' }, { role: 'selectAll' });
    else if (p.selectionText && p.selectionText.trim()) items.push({ role: 'copy' });
    if (items.length) Menu.buildFromTemplate(items).popup({ window: BrowserWindow.fromWebContents(wc) || undefined });
  });
});
// Keep the library from earlier versions (stored under the old app name)
try { const old = path.join(app.getPath('appData'), 'Capture Bench'); if (!process.env.SAVEIT_REVIEW_DATA && fs.existsSync(old)) app.setPath('userData', old); } catch (_) { }

let win = null, tray = null, recording = false, trayTipShown = false;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const asset = f => path.join(__dirname, f);
// Local-only workflow settings, explicitly chosen folders and reviewed output.
const workflowPath=path.join(app.getPath('userData'),'workflows.json');let workflowConfig={presets:[],folders:[],lastRegion:null},lastRegion=null,workflowKeys=[];
try{workflowConfig={...workflowConfig,...JSON.parse(fs.readFileSync(workflowPath,'utf8'))};lastRegion=workflowConfig.lastRegion}catch(_){}
let configWrite=Promise.resolve();function saveWorkflowConfig(){workflowConfig.lastRegion=lastRegion;const data=JSON.stringify(workflowConfig,null,2);configWrite=configWrite.catch(()=>{}).then(async()=>{await fs.promises.mkdir(path.dirname(workflowPath),{recursive:true});const tmp=workflowPath+'.tmp';await fs.promises.writeFile(tmp,data);await fs.promises.rename(tmp,workflowPath)});return configWrite}
function mainSender33(e){if(!win||e.sender!==win.webContents)throw Error('Unsupported request source')}
function restoreWorkflowKeys(){for(const key of workflowKeys)globalShortcut.unregister(key);workflowKeys=[];return workflowConfig.presets.filter(p=>p.hotkey).map(p=>{let ok=false;try{ok=globalShortcut.register(p.hotkey,()=>{if(win&&!win.isDestroyed())win.webContents.send('hotkey','preset:'+p.id)})}catch(_){}if(ok)workflowKeys.push(p.hotkey);return{id:p.id,hotkey:p.hotkey,ok}})}
ipcMain.handle('workflow-config',e=>{mainSender33(e);return{presets:workflowConfig.presets,lastRegion}});
ipcMain.handle('workflow-save',async(e,list)=>{mainSender33(e);if(!Array.isArray(list)||list.length>100||!list.every(p=>typeof p.id==='string'&&typeof p.name==='string'&&p.name.length<=150&&['region','window','screen'].includes(p.area)&&(!p.hotkey||typeof p.hotkey==='string'&&p.hotkey.length<=100)&&(!p.folder||workflowConfig.folders.includes(p.folder))))throw Error('Invalid preset settings');workflowConfig.presets=list;await saveWorkflowConfig();return restoreWorkflowKeys()});
ipcMain.handle('workflow-folder',async e=>{mainSender33(e);const r=await dialog.showOpenDialog(win,{title:'Choose automatic capture save folder',properties:['openDirectory','createDirectory']});if(r.canceled||!r.filePaths[0])return null;const folder=path.resolve(r.filePaths[0]);if(!workflowConfig.folders.includes(folder))workflowConfig.folders.push(folder);await saveWorkflowConfig();return folder});
ipcMain.handle('workflow-file',async(e,folder,name,data)=>{mainSender33(e);if(!workflowConfig.folders.includes(folder))throw Error('Choose this save folder in Workflows first.');const safe=path.basename(String(name)).replace(/[<>:"/\\|?*\x00-\x1f]/g,'-');if(!safe||!safe.endsWith('.png'))throw Error('Expected a PNG filename');const parsed=path.parse(safe);let out=path.join(folder,safe),i=2;while(fs.existsSync(out))out=path.join(folder,parsed.name+'-'+i+++parsed.ext);await fs.promises.writeFile(out,Buffer.from(data),{flag:'wx'});return out});
ipcMain.handle('ocr-layout',async(e,url)=>{mainSender33(e);return recognize35(url)});
ipcMain.handle('print-image',async(e,url)=>{mainSender33(e);if(typeof url!=='string'||!url.startsWith('data:image/png;base64,'))throw Error('Expected a PNG image');const w=new BrowserWindow({show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});try{await w.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<html><head><style>@page{margin:12mm}body{margin:0}img{max-width:100%;height:auto}</style></head><body><img src="'+url+'"></body></html>'));await w.webContents.executeJavaScript('Promise.all([...document.images].map(i=>i.decode()))');return await new Promise(resolve=>w.webContents.print({silent:false,printBackground:true},(ok,reason)=>resolve({ok,reason})))}finally{w.destroy()}});
function transposeFrame(f){const data=Buffer.alloc(f.w*f.h*4);for(let y=0;y<f.h;y++)for(let x=0;x<f.w;x++){const a=(y*f.w+x)*4,b=(x*f.h+y)*4;data[b]=f.data[a];data[b+1]=f.data[a+1];data[b+2]=f.data[a+2];data[b+3]=f.data[a+3]}return{data,w:f.h,h:f.w}}
// Closing the window flushes pending library saves first, then hides to the tray (or quits when Quit was chosen).
let quitPending=null;
function requestQuit(){if(!win||win.isDestroyed()||quitPending){app.isQuitting=true;app.quit();return}quitPending=setTimeout(()=>{quitPending=null;showWindow()},5000);win.webContents.send('review-before-close')}
ipcMain.on('review-close-ready',e=>{if(!win||e.sender!==win.webContents)return;if(quitPending){clearTimeout(quitPending);quitPending=null;app.isQuitting=true;app.quit();return}
  win.hide();
  if (!trayTipShown && tray && process.platform === 'win32') {
    tray.displayBalloon({ iconType: 'info', title: 'Saveit is still running', content: 'Press Print Screen to capture. Right-click the tray icon to quit.' });
    trayTipShown = true;
  }
});
ipcMain.handle('quick-markup',async(e,url)=>{mainSender33(e);if(typeof url!=='string'||!url.startsWith('data:image/png;base64,'))throw Error('Expected a PNG capture');const q=new BrowserWindow({width:940,height:640,minWidth:640,minHeight:440,title:'Saveit Quick Markup',backgroundColor:'#1e2124',autoHideMenuBar:true,webPreferences:{preload:asset('quick-preload.js'),contextIsolation:true,nodeIntegration:false}});q.setMenu(null);await q.loadFile(asset('quick.html'));q.webContents.send('quick-image',url);return await new Promise(resolve=>{const done=(event,result)=>{if(event.sender!==q.webContents)return;if(result&&(!['copy','edit'].includes(result.action)||typeof result.url!=='string'||!result.url.startsWith('data:image/png;base64,')))return;ipcMain.removeListener('quick-result',done);if(result?.action==='edit')showWindow();resolve(result);q.destroy()};ipcMain.on('quick-result',done);q.on('closed',()=>{ipcMain.removeListener('quick-result',done);resolve(null)})})});
async function manualScroll33(display,rect,horizontal){const bar=new BrowserWindow({width:620,height:170,resizable:false,alwaysOnTop:true,title:'Saveit Manual Scroll',autoHideMenuBar:true,backgroundColor:'#20262a',webPreferences:{preload:asset('manual-preload.js'),contextIsolation:true,nodeIntegration:false}});bar.setMenu(null);const st=new Stitcher();let busy=false,done=false,frames=0;await bar.loadFile(asset('manual.html'));const status=message=>{if(!bar.isDestroyed())bar.webContents.send('manual-status',message)};
 return new Promise(resolve=>{const cleanup=()=>{ipcMain.removeListener('manual-command',command);if(!bar.isDestroyed())bar.destroy()};const take=async()=>{if(busy||done)return;busy=true;try{bar.hide();await sleep(160);const img=await grabDisplay(display),k=img.getSize().width/display.bounds.width,c=img.crop({x:Math.round(rect.x*k),y:Math.round(rect.y*k),width:Math.round(rect.w*k),height:Math.round(rect.h*k)}),size=c.getSize(),f={data:c.toBitmap(),w:size.width,h:size.height},r=st.add(horizontal?transposeFrame(f):f);frames++;status(r.lost?'No overlapping content found. Undo is unavailable; finish and retry with smaller scrolls.':`${frames} frame(s). Scroll a little, then add the next frame.`)}catch(e){status(e.message)}finally{busy=false;if(!bar.isDestroyed())bar.show()}};const command=async(e,cmd)=>{if(e.sender!==bar.webContents||busy||done)return;if(cmd==='add'){await take();return}if(cmd==='finish'&&frames){done=true;const result=st.result(),o=horizontal?transposeFrame(result):result;cleanup();resolve(nativeImage.createFromBitmap(o.data,{width:o.w,height:o.h}));return}if(cmd==='cancel'){done=true;cleanup();resolve(null)}};ipcMain.on('manual-command',command);bar.on('closed',()=>{if(!done){done=true;ipcMain.removeListener('manual-command',command);resolve(null)}});take()})
}


function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 960, minHeight: 620,
    backgroundColor: '#1e2124', title: 'Saveit', icon: asset('icon.png'),
    show: false, autoHideMenuBar: true,
    webPreferences: { preload: asset('preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false }
  });
  win.setMenu(null);
  win.loadFile(asset('index.html'));
  win.once('ready-to-show', () => { if (!process.argv.includes('--hidden')) win.show(); });
  win.on('close', e => { if(app.isQuitting)return;e.preventDefault();win.webContents.send('review-before-close'); });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
}

// ---------- floating capture widget (editor hidden) ----------
let widgetWin = null, widgetOpts = null, reopenWidget = false;
function closeWidget() { if (widgetWin && !widgetWin.isDestroyed()) widgetWin.destroy(); widgetWin = null; }
// The widget and the editor share one anchor: the Saveit logo. Opening the widget puts its logo where the editor's was,
// size changes keep the left edge still, and returning to the editor lines its logo up with the widget's.
let widgetAnchor = null, editorLogo = null, widgetLogo = { x: 11, y: 11 };
function openWidget(opts) {
  if (opts) widgetOpts = opts;
  if (widgetWin && !widgetWin.isDestroyed()) { widgetWin.show(); return; }
  const saved = workflowConfig.widgetPos, sx = saved ? (saved.x ?? saved.cx - 620) : 0;
  const onScreen = !widgetAnchor && saved && screen.getAllDisplays().some(s => sx + 40 >= s.bounds.x && sx < s.bounds.x + s.bounds.width - 40 && saved.y >= s.bounds.y && saved.y < s.bounds.y + s.bounds.height - 40);
  const d = widgetAnchor ? screen.getDisplayNearestPoint({ x: Math.round(widgetAnchor.x), y: Math.round(widgetAnchor.y) }) : onScreen ? screen.getDisplayNearestPoint({ x: Math.round(sx), y: Math.round(saved.y) }) : activeDisplay(), W = Math.min(1240, d.bounds.width - 40), H = 84;
  const x = widgetAnchor ? widgetAnchor.x - widgetLogo.x : onScreen ? sx : d.bounds.x + (d.bounds.width - W) / 2, y = widgetAnchor ? widgetAnchor.y - widgetLogo.y : onScreen ? saved.y : d.bounds.y + 14;
  widgetWin = new BrowserWindow({ x: Math.round(x), y: Math.round(y), width: W, height: H, frame: false, resizable: false, maximizable: false, minimizable: false, skipTaskbar: false, alwaysOnTop: true, backgroundColor: '#16181a', hasShadow: true, show: false,
    webPreferences: { preload: asset('widget-preload.js'), contextIsolation: true } });
  widgetWin.setContentProtection(true);
  widgetWin.setAlwaysOnTop(true, 'floating');
  widgetWin.loadFile(asset('widget.html'));
  // Shown once it has sized itself (so it never appears in the wrong place first), with a fallback.
  widgetWin.webContents.once('did-finish-load', () => { widgetWin.webContents.send('init', widgetOpts); setTimeout(() => { if (widgetWin && !widgetWin.isDestroyed() && !widgetWin.isVisible()) widgetWin.show(); }, 800); });
  widgetWin.on('moved', () => { if (!widgetWin || widgetWin.isDestroyed()) return; const b = widgetWin.getBounds(); workflowConfig.widgetPos = { x: b.x, y: b.y }; saveWorkflowConfig().catch(() => {}); });
  widgetWin.on('closed', () => { widgetWin = null; });
  if (win) win.hide();
}
// Called at the start of a capture or recording: the widget steps aside, and comes back if the user cancels.
function beginCaptureUI() { if (widgetWin && !widgetWin.isDestroyed()) { reopenWidget = true; closeWidget(); } }
function restoreUI(wasVisible) { if (reopenWidget) { reopenWidget = false; openWidget(); } else if (wasVisible) showWindow(); }
function showWindow() { reopenWidget = false; closeWidget(); if (!win) return; if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
ipcMain.on('widget-open', (e, opts, logo) => {
  if (logo && Number.isFinite(logo.x) && Number.isFinite(logo.y)) editorLogo = { x: logo.x, y: logo.y };
  widgetAnchor = null;
  if (win && win.isVisible() && editorLogo) { const c = win.getContentBounds(); widgetAnchor = { x: c.x + editorLogo.x, y: c.y + editorLogo.y }; }
  openWidget(opts);
});
ipcMain.on('widget-opts', (e, o) => { widgetOpts = o; if (win) win.webContents.send('widget-opts', o); });
ipcMain.on('widget-go', (e, o) => { widgetOpts = o; reopenWidget = true; closeWidget(); if (win) win.webContents.send('widget-go', o); });
ipcMain.on('widget-editor', () => {
  // Bring the editor back with its logo where the widget's logo is (a maximized editor stays put).
  if (win && editorLogo && widgetWin && !widgetWin.isDestroyed() && !win.isMaximized() && !win.isFullScreen()) {
    const wb = widgetWin.getContentBounds(), cb = win.getContentBounds(), d = screen.getDisplayNearestPoint({ x: wb.x, y: wb.y }).workArea;
    const x = Math.round(wb.x + widgetLogo.x - editorLogo.x), y = Math.round(wb.y + widgetLogo.y - editorLogo.y);
    win.setContentBounds({ x: Math.max(d.x - cb.width + 120, Math.min(d.x + d.width - 120, x)), y: Math.max(d.y, Math.min(d.y + d.height - 80, y)), width: cb.width, height: cb.height });
  }
  showWindow();
});
// Webcam settings: one window for both the editor and the widget, kept above the widget.
let camWin = null;
ipcMain.on('cam-settings', () => {
  if (camWin && !camWin.isDestroyed()) { camWin.show(); camWin.focus(); return; }
  const d = activeDisplay(), W = Math.min(940, d.bounds.width - 40), H = Math.min(600, d.bounds.height - 40);
  camWin = new BrowserWindow({ x: Math.round(d.bounds.x + (d.bounds.width - W) / 2), y: Math.round(d.bounds.y + (d.bounds.height - H) / 2), width: W, height: H, minWidth: 760, minHeight: 520,
    title: 'Webcam settings', backgroundColor: '#16181a', autoHideMenuBar: true, minimizable: false, maximizable: false, icon: asset('icon.png'), webPreferences: { contextIsolation: true, nodeIntegration: false } });
  camWin.setMenu(null); camWin.setAlwaysOnTop(true, 'pop-up-menu'); camWin.loadFile(asset('camsettings.html'));
  camWin.on('closed', () => { camWin = null; });
});
ipcMain.on('widget-size', (e, w, h, lx, ly) => {
  if (!widgetWin || widgetWin.isDestroyed() || !(h > 30 && w > 200)) return;
  if (Number.isFinite(lx) && Number.isFinite(ly)) widgetLogo = { x: lx, y: ly };
  // First placement lines the logo up with the editor's; after that the left edge stays where it is.
  const b = widgetWin.getBounds(), x = widgetAnchor ? Math.round(widgetAnchor.x - widgetLogo.x) : b.x, y = widgetAnchor ? Math.round(widgetAnchor.y - widgetLogo.y) : b.y;
  const d = screen.getDisplayNearestPoint({ x, y }), W = Math.min(Math.round(w) + 2, d.bounds.width - 20), H = Math.min(520, Math.round(h));
  widgetWin.setBounds({ x, y, width: W, height: H }); widgetAnchor = null;
  if (!widgetWin.isVisible()) widgetWin.show();
});

function activeDisplay() { return screen.getDisplayNearestPoint(screen.getCursorScreenPoint()); }

async function grabDisplay(d) {
  const sf = d.scaleFactor || 1;
  const size = { width: Math.round(d.size.width * sf), height: Math.round(d.size.height * sf) };
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: size });
  const src = sources.find(s => String(s.display_id) === String(d.id)) || sources[0];
  if (!src) throw new Error('No screen available');
  return src.thumbnail;
}

// Full-screen overlay on one display (region selector or window picker). Resolves with whatever the page sends back.
function overlayWindow(d, file, payload) {
  return new Promise(resolve => {
    let settled = false;
    const ov = new BrowserWindow({
      x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height,
      frame: false, resizable: false, movable: false, minimizable: false, maximizable: false,
      skipTaskbar: true, alwaysOnTop: true, show: false, backgroundColor: '#000000', enableLargerThanScreen: true, hasShadow: false,
      webPreferences: { preload: asset('overlay-preload.js'), contextIsolation: true }
    });
    const finish = r => { if (settled) return; settled = true; ipcMain.removeAllListeners('overlay-done'); if (!ov.isDestroyed()) ov.destroy(); resolve(r); };
    ov.setAlwaysOnTop(true, 'screen-saver');
    ov.setBounds(d.bounds);
    ov.loadFile(asset(file));
    ipcMain.on('overlay-done', (e, r) => finish(r));
    ov.on('closed', () => finish(null));
    ov.webContents.once('did-finish-load', () => { ov.webContents.send('data', payload); ov.show(); ov.focus(); });
  });
}
const selectRegion = (d, img, opts, init) => overlayWindow(d, 'overlay.html', { shot: img.toDataURL(), opts: opts || {}, init: init || '' });
const displayById = id => screen.getAllDisplays().find(x => x.id === id) || activeDisplay();

async function listWindowSources(size) {
  const own = new Set(BrowserWindow.getAllWindows().map(w => { try { return w.getMediaSourceId(); } catch (_) { return ''; } }));
  const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: size, fetchWindowIcons: true });
  return sources.filter(s => !own.has(s.id) && s.name && !/^Saveit/.test(s.name) && !s.thumbnail.isEmpty());
}
async function pickWindow(d) {
  const sources = await listWindowSources({ width: 720, height: 450 });
  if (!sources.length) throw new Error('No open windows were found to capture');
  const bg = await grabDisplay(d);
  const list = sources.map(s => ({ id: s.id, name: s.name, thumb: s.thumbnail.toDataURL(), icon: s.appIcon && !s.appIcon.isEmpty() ? s.appIcon.toDataURL() : '' }));
  return overlayWindow(d, 'picker.html', { bg: bg.resize({ width: Math.round(d.bounds.width / 2) }).toDataURL(), list });
}

// ---------- scrolling capture ----------
const { Stitcher } = require('./stitch.js');
function wheelDriver(horizontal=false) {
  if (process.platform !== 'win32') throw new Error('Scrolling capture works on Windows.');
  const { spawn } = require('child_process');
  const ps = spawn('powershell.exe', ['-NoProfile', '-NoLogo', '-NonInteractive', '-Command', '-'], { windowsHide: true });
  ps.stdin.write(`Add-Type -Namespace W -Name M -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y); [DllImport("user32.dll")] public static extern void mouse_event(uint f,int x,int y,int d,int e);'\n`);
  return {
    move: (x, y) => ps.stdin.write(`[W.M]::SetCursorPos(${Math.round(x)},${Math.round(y)})\n`),
    wheel: n => ps.stdin.write(`[W.M]::mouse_event(${horizontal?0x1000:0x0800},0,0,${(horizontal?120:-120) * n},0)\n`),
    close: () => { try { ps.stdin.end(); ps.kill(); } catch (_) {} }
  };
}
async function scrollCapture(d, r, horizontal=false) {
  const k0 = d.scaleFactor || 1, drv = wheelDriver(horizontal), st = new Stitcher();
  try {
    const cx = d.bounds.x + r.x + r.w / 2, cy = d.bounds.y + r.y + r.h / 2;
    drv.move(cx, cy); await sleep(500);
    // 9.8: a frame that has not moved yet (smooth scrolling still running) or does not line up is re-checked
    // before giving up, and a capture that stops early says so instead of quietly returning the first screen.
    let notches = 3, ppn = 0, still = 0, lost = 0, frames = 0, why = '';
    for (let i = 0; i < 120; i++) {
      const img = await grabDisplay(d), kk = img.getSize().width / d.bounds.width;
      const rect = { x: Math.round(r.x * kk), y: Math.round(r.y * kk), width: Math.max(1, Math.round(r.w * kk)), height: Math.max(1, Math.round(r.h * kk)) };
      const c = img.crop(rect), sz = c.getSize();
      const res = st.add({ ...(horizontal?transposeFrame({data:c.toBitmap(),w:sz.width,h:sz.height}):{data:c.toBitmap(),w:sz.width,h:sz.height}) });
      if (res.done && res.lost) { if (++lost <= 3) { await sleep(350); continue; } why = 'lost'; break; }
      if (res.done) { if (++still <= 2) { if (still === 2) drv.wheel(notches); await sleep(still === 1 ? 500 : 650); continue; } break; }
      still = 0; lost = 0; frames++;
      if (!res.first && res.added > 0) { ppn = res.added / notches; notches = Math.max(1, Math.min(30, Math.floor(sz.height * 0.6 / Math.max(1, ppn)))); }
      if (st.total > 32000) { why = 'long'; break; }
      drv.wheel(notches); await sleep(450);
    }
    if (!why && frames <= 1) why = 'noscroll';
    st.why = why;
  } finally { drv.close(); }
  const result = st.result(), o=horizontal?transposeFrame(result):result, { nativeImage } = require('electron');
  const img = nativeImage.createFromBitmap(o.data, { width: o.w, height: o.h });
  lastScrollNote = st.why === 'lost' ? 'Scrolling capture stopped early: the page changed in a way that could not be lined up (moving content or a video). The part captured so far is shown. Try again, or turn on Manual scroll.'
    : st.why === 'long' ? 'Scrolling capture stopped at the maximum length. The part captured so far is shown.'
    : st.why === 'noscroll' ? 'The page did not scroll, so only the visible part was captured. Click inside the page first, or use Manual scroll.' : '';
  return img;
}
let lastScrollNote = '';

async function doCapture(mode, delay = 0, opts = {}, pre = null) {
  const wasVisible = win && win.isVisible() && !win.isMinimized();
  beginCaptureUI();
  if (win) win.hide();
  await sleep(350 + delay * 1000);
  try {
    const d = pre ? displayById(pre.did) : activeDisplay();
    const cur = screen.getCursorScreenPoint();
    const img = await grabDisplay(d);
    const kk = img.getSize().width / d.bounds.width;
    let cursor = { x: Math.round((cur.x - d.bounds.x) * kk), y: Math.round((cur.y - d.bounds.y) * kk), k: kk };
    let out = img, settings = opts, init = '';
    if (mode === 'screen' && opts.confirm && !pre) { mode = 'region'; init = 'full'; }
    for (let guard = 0; guard < 4; guard++) {
      if (mode === 'window') {
        cursor = null;
        const id = await pickWindow(d);
        if (!id) { restoreUI(wasVisible); return null; }
        await sleep(150);
        const sf = d.scaleFactor || 1;
        const full = await listWindowSources({ width: Math.round(d.size.width * sf), height: Math.round(d.size.height * sf) });
        const src = full.find(s => s.id === id);
        if (!src) throw new Error('That window closed before it could be captured');
        out = src.thumbnail;
      } else if (mode === 'region' || mode === 'text' || mode === 'scroll') {
        const r = pre || await selectRegion(d, img, { ...opts, mode: 'image', area: mode === 'text' ? 'text' : mode === 'scroll' ? 'scroll' : (init ? 'screen' : 'region') }, init);
        if (!r) { restoreUI(wasVisible); return null; }
        if (r.redirect === 'window') { mode = 'window'; settings = r.opts; continue; }
        if (r.redirect === 'steps') return { redirect: 'steps', settings: r.opts };
        if (r.opts) settings = {...opts,...r.opts};
        if (!pre && settings.mode === 'video') return { redirect: 'video', rect: { x: r.x, y: r.y, w: r.w, h: r.h, did: d.id }, settings };
        if (settings.area === 'text') mode = 'text';
        if (settings.area === 'scroll' && !pre) mode = 'scroll'; else if (mode === 'scroll' && !opts.manualScroll) mode = 'region';
        const k = img.getSize().width / d.bounds.width;
        lastRegion={did:d.id,x:r.x,y:r.y,w:r.w,h:r.h};saveWorkflowConfig();
        const rect = { x: Math.round(r.x * k), y: Math.round(r.y * k), width: Math.max(1, Math.round(r.w * k)), height: Math.max(1, Math.round(r.h * k)) };
        if (mode === 'scroll') {
          if (win) win.hide(); await sleep(250);
          out = settings.manualScroll?await manualScroll33(d,r,settings.scrollDirection==='horizontal'):await scrollCapture(d,r,settings.scrollDirection==='horizontal');if(!out){restoreUI(wasVisible);return null;} cursor = { x: -1, y: -1, k: kk };
        } else {
          out = img.crop(rect);
          cursor = { x: cursor.x - rect.x, y: cursor.y - rect.y, k: kk };
        }
      }
      break;
    }
    if(!opts.quiet)showWindow();
    const note = mode === 'scroll' ? lastScrollNote : ''; lastScrollNote = '';
    return { region:lastRegion, url: out.toDataURL(), cursor, settings, area: mode, note };
  } catch (err) {
    showWindow();
    throw err;
  }
}

ipcMain.handle('capture', (e, mode, delay, opts, pre) => doCapture(mode, delay, opts || {}, pre || null));

// ---------- recording ----------
let pendingSource = null, recWins = [];
ipcMain.handle('prepare-record', async (e, area, delay = 0, opts = {}, pre = null) => {
  const wasVisible = win && win.isVisible() && !win.isMinimized();
  beginCaptureUI();
  if (win) win.hide();
  await sleep(350);
  const d = pre ? displayById(pre.did) : activeDisplay();
  let rect = null, settings = opts;
  try {
    const screens = await desktopCapturer.getSources({ types: ['screen'] });
    const scr = screens.find(s => String(s.display_id) === String(d.id)) || screens[0];
    let img = null;
    for (let guard = 0; guard < 3; guard++) {
      if (area === 'window') {
        const id = await pickWindow(d);
        if (!id) { pendingSource = null; restoreUI(wasVisible); return null; }
        pendingSource = { type: 'window', id, audio: settings.sysAudio !== false };
        rect = null;
      } else {
        if (!img) img = await grabDisplay(d);
        let r = pre;
        if (!r) r = await selectRegion(d, img, { ...opts, mode: 'video', area: area === 'screen' ? 'screen' : 'region' }, area === 'screen' ? 'full' : '');
        if (!r) { pendingSource = null; restoreUI(wasVisible); return null; }
        if (r.redirect === 'window') { area = 'window'; settings = { ...opts, ...(r.opts || {}), sysAudio: r.opts ? r.opts.sys : opts.sysAudio }; continue; }
        if (r.redirect === 'steps') return { redirect: 'steps', settings: r.opts };
        if (r.opts) settings = { ...opts, ...r.opts, sysAudio: r.opts.sys };
        if (!pre && r.opts && r.opts.mode === 'image') return { redirect: 'image', rect: { x: r.x, y: r.y, w: r.w, h: r.h, did: d.id }, settings };
        rect = { x: r.x, y: r.y, w: r.w, h: r.h };
        if (rect.w >= d.bounds.width - 1 && rect.h >= d.bounds.height - 1) rect = null;
        pendingSource = { type: 'screen', id: scr.id, audio: settings.sysAudio !== false };
      }
      break;
    }
  } catch (err) { pendingSource = null; showWindow(); throw err; }
  if (delay > 0) await countdownWindow(d, rect, delay);
  return { rect, display: { x: d.bounds.x, y: d.bounds.y, w: d.bounds.width, h: d.bounds.height }, settings };
});

function countdownWindow(d, rect, secs) {
  return new Promise(resolve => {
    const b = rect ? { x: d.bounds.x + rect.x, y: d.bounds.y + rect.y, width: Math.max(160, rect.w), height: Math.max(160, rect.h) } : d.bounds;
    const cw = new BrowserWindow({ ...b, frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true, focusable: false, resizable: false, hasShadow: false, show: false });
    cw.setIgnoreMouseEvents(true);
    cw.loadURL('data:text/html,' + encodeURIComponent(`<body style="margin:0;height:100vh;display:grid;place-items:center;font:800 140px 'Segoe UI',sans-serif;color:#2db3a0;text-shadow:0 4px 24px #000;background:transparent"><div id=n>${secs}</div><script>let k=${secs};setInterval(()=>{k--;if(k>0)n.textContent=k},1000)</script></body>`));
    cw.once('ready-to-show', () => cw.showInactive());
    setTimeout(() => { if (!cw.isDestroyed()) cw.destroy(); setTimeout(resolve, 120); }, secs * 1000);
  });
}

function closeRecWins() { for (const w of recWins) if (!w.isDestroyed()) w.destroy(); recWins = []; }

ipcMain.on('rec-ui', (e, on, info, extra) => {
  closeRecWins();
  if (!on) { showWindow(); return; }
  const d = activeDisplay();
  // 9.9: audio recording: only the small recording bar (timer, a live bar per track, Pause, Stop), centred at the top.
  if (extra && extra.audio) {
    if (win) win.hide();
    const names = Array.isArray(extra.tracks) ? extra.tracks.slice(0, 3).map(s => String(s).slice(0, 60)) : [];
    const W = 300 + names.length * 64, H = 48, x = Math.round(d.bounds.x + d.bounds.width / 2 - W / 2), y = d.bounds.y + 12;
    const rb = new BrowserWindow({ x, y, width: W, height: H, frame: false, backgroundColor: '#16181a', alwaysOnTop: true, skipTaskbar: true, resizable: false, hasShadow: false, show: false,
      webPreferences: { preload: asset('recbar-preload.js'), contextIsolation: true } });
    rb.setAlwaysOnTop(true, 'screen-saver');
    rb.loadFile(asset('recbar.html'), { query: { audio: '1', tracks: JSON.stringify(names), countdown: String(Math.max(0, Math.min(10, +extra.countdown || 0))) } });
    rb.once('ready-to-show', () => rb.showInactive());
    recWins.push(rb);
    return;
  }
  const region = info && info.w ? info : null;
  // Full-screen recordings say which display they record; use it rather than the display the pointer is on.
  const area = region || (info && info.display && info.display.w ? info.display : { x: d.bounds.x, y: d.bounds.y, w: d.bounds.width, h: d.bounds.height });
  // One thin (1px) red outline: a single transparent, click-through window just outside the recorded area.
  // It is excluded from screen capture, so it never shows in the video.
  if (region) {
    const gap = 4, X = Math.round(region.x - gap), Y = Math.round(region.y - gap), W2 = Math.round(region.w + gap * 2), H2 = Math.round(region.h + gap * 2);
    const bw = new BrowserWindow({ x: X, y: Y, width: W2, height: H2, frame: false, transparent: true, backgroundColor: '#00000000', alwaysOnTop: true, skipTaskbar: true, focusable: false, resizable: false, movable: false, hasShadow: false, show: false, thickFrame: false });
    bw.setIgnoreMouseEvents(true);
    bw.setContentProtection(true);
    bw.setAlwaysOnTop(true, 'screen-saver');
    bw.loadURL('data:text/html,' + encodeURIComponent('<style>html,body{margin:0;height:100%;background:transparent;overflow:hidden}div{position:fixed;inset:1px;border:1px solid #e5483b;box-sizing:border-box}</style><div></div>'));
    bw.once('ready-to-show', () => { bw.setBounds({ x: X, y: Y, width: W2, height: H2 }); bw.showInactive(); });
    recWins.push(bw);
  }
  // Live webcam preview ("see yourself") exactly where, and as big as, the webcam sits in the video.
  // Same maths as CAMDRAW.rect / CAMDRAW.draw in camdraw.js, in screen points instead of video pixels.
  const cam = extra && extra.cam;
  if (cam && cam.o) {
    const o = cam.o, m = Math.round(area.w * 0.025), sw = Math.max(16, Math.round(area.w * o.size / 100)), h = o.shape === 'rect' ? Math.round(sw * 9 / 16) : sw;
    const radius = o.shape === 'circle' ? 'circle' : o.corners === 'rounded' ? (Math.min(sw, h) * .14).toFixed(1) : '0', bw = o.border ? Math.max(1, (+o.borderWidth || 3) * area.w / 1280).toFixed(1) : '0';
    const x = o.pos[1] === 'l' ? area.x + m : area.x + area.w - m - sw, y = o.pos[0] === 't' ? area.y + m : area.y + area.h - m - h;
    const cw = new BrowserWindow({ x: Math.round(x), y: Math.round(y), width: sw, height: h, frame: false, transparent: true, backgroundColor: '#00000000', alwaysOnTop: true, skipTaskbar: true, focusable: false, resizable: false, movable: false, hasShadow: false, show: false, thickFrame: false });
    cw.setIgnoreMouseEvents(true);
    cw.setContentProtection(true);
    cw.setAlwaysOnTop(true, 'screen-saver');
    cw.loadFile(asset('campreview.html'), { query: { radius, bw, bc: o.borderColor || '#ffffff', mirror: o.mirror !== false ? '1' : '0', dev: o.deviceId || '' } });
    cw.once('ready-to-show', () => cw.showInactive());
    recWins.push(cw);
  }
  // Floating recording controls
  const W = 460, H = 48;
  let x, y;
  if (region) { x = Math.round(region.x + region.w / 2 - W / 2); y = Math.round(region.y + region.h + 12); if (y + H > d.bounds.y + d.bounds.height) y = Math.max(d.bounds.y + 8, Math.round(region.y - H - 12)); if (y < d.bounds.y) y = d.bounds.y + 8; }
  else { const db = (info && info.display) || { x: d.bounds.x, y: d.bounds.y, w: d.bounds.width }; x = Math.round(db.x + db.w / 2 - W / 2); y = db.y + 12; }
  x = Math.min(Math.max(x, d.bounds.x + 4), d.bounds.x + d.bounds.width - W - 4);
  const rb = new BrowserWindow({ x, y, width: W, height: H, frame: false, backgroundColor: '#16181a', alwaysOnTop: true, skipTaskbar: true, resizable: false, hasShadow: false, show: false,
    webPreferences: { preload: asset('recbar-preload.js'), contextIsolation: true } });
  rb.setContentProtection(true);
  rb.setAlwaysOnTop(true, 'screen-saver');
  rb.loadFile(asset('recbar.html'), { query: { size: (extra && typeof extra.size === 'string' && extra.size.slice(0, 60)) || (region ? `Region · ${Math.round(region.w * (d.scaleFactor || 1))} × ${Math.round(region.h * (d.scaleFactor || 1))} px` : 'Full screen'), cursor: extra && extra.cursor ? '1' : '0', cam: cam ? '1' : '0', mic: extra && extra.mic ? '1' : '0', sys: extra && extra.sys ? '1' : '0' } });
  rb.once('ready-to-show', () => rb.showInactive());
  recWins.push(rb);
});
ipcMain.on('rec-cmd', (e, c) => {
  if (win) win.webContents.send('rec-cmd', c);
  // Safety net: if the editor doesn't close the recording UI, close it ourselves
  if (c === 'stop') setTimeout(() => { if (recWins.length) { closeRecWins(); showWindow(); } }, 4000);
});
ipcMain.on('rec-state', (e, st) => { for (const w of recWins) if (!w.isDestroyed()) w.webContents.send('state', st); });
ipcMain.on('rec-level', (e, lv) => { if (!Array.isArray(lv)) return; const v = lv.slice(0, 3).map(x => Math.max(0, Math.min(1, +x || 0))); for (const w of recWins) if (!w.isDestroyed()) w.webContents.send('level', v); });

// ---------- step capture: a screenshot on every click ----------
let steps = null; // { bar, helper, count, paused, busy, display }
const CLICK_WATCHER = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class CBMouse { [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vKey); [DllImport("user32.dll")] public static extern int GetSystemMetrics(int i); [StructLayout(LayoutKind.Sequential)] public struct P { public int X; public int Y; } [DllImport("user32.dll")] public static extern bool GetCursorPos(out P p); }'
$uia = $true
try { Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; Add-Type -AssemblyName WindowsBase } catch { $uia = $false }
$down = $false; $n = 0
$btn = 1; if ([CBMouse]::GetSystemMetrics(23) -ne 0) { $btn = 2 }
[Console]::Out.WriteLine('READY'); [Console]::Out.Flush()
while ($true) {
  $s = ([CBMouse]::GetAsyncKeyState($btn) -band 0x8000) -ne 0
  if ($s -and -not $down) {
    $n++
    [Console]::Out.WriteLine("CLICK $n"); [Console]::Out.Flush()
    if ($uia) {
      try {
        $p = New-Object CBMouse+P; [void][CBMouse]::GetCursorPos([ref]$p)
        $el = [System.Windows.Automation.AutomationElement]::FromPoint((New-Object System.Windows.Point($p.X, $p.Y)))
        $name = $el.Current.Name; $type = $el.Current.ControlType.ProgrammaticName; $help = $el.Current.HelpText
        $w = [System.Windows.Automation.TreeWalker]::ControlViewWalker; $e = $el; $win = ''; $i = 0; $pname = ''
        while ($e -ne $null -and $i -lt 30) {
          if (-not $name -and $i -gt 0 -and $i -lt 4 -and $e.Current.Name) { $pname = $e.Current.Name; if (-not $name) { $name = $pname } }
          if ($e.Current.ControlType -eq [System.Windows.Automation.ControlType]::Window -and $e.Current.Name) { $win = $e.Current.Name }
          $par = $w.GetParent($e); if ($par -eq $null -or $par -eq [System.Windows.Automation.AutomationElement]::RootElement) { break }
          $e = $par; $i++
        }
        $o = @{ n = $n; name = "$name"; type = "$type"; help = "$help"; window = "$win" } | ConvertTo-Json -Compress
        [Console]::Out.WriteLine("INFO $o"); [Console]::Out.Flush()
      } catch { }
    }
  }
  $down = $s
  Start-Sleep -Milliseconds 10
}`;

function stepsBarState() { if (steps && steps.bar && !steps.bar.isDestroyed()) steps.bar.webContents.send('state', { count: steps.count, paused: steps.paused, auto: steps.auto }); }

async function takeStep(seq) {
  if (!steps || steps.paused || steps.busy) return;
  const pt = screen.getCursorScreenPoint();
  const b = steps.bar && !steps.bar.isDestroyed() ? steps.bar.getBounds() : null;
  if (b && pt.x >= b.x && pt.x <= b.x + b.width && pt.y >= b.y && pt.y <= b.y + b.height) return; // clicks on the toolbar itself
  steps.busy = true;
  try {
    const d = screen.getDisplayNearestPoint(pt);
    await sleep(140); // let the click land so the screenshot shows its result (menus, highlights)
    // 10.0.9: the step bar must never appear in a step image. Content protection alone is not honoured by desktopCapturer thumbnails.
    const stepBar = steps.bar && !steps.bar.isDestroyed() ? steps.bar : null;
    if (stepBar) { stepBar.setOpacity(0); await sleep(40); }
    let img;
    try { img = await grabDisplay(d); }
    finally { if (stepBar && !stepBar.isDestroyed()) stepBar.setOpacity(1); }
    const k = img.getSize().width / d.bounds.width;
    steps.count++;
    win.webContents.send('step-shot', { seq: seq || null, url: img.toDataURL(), click: { x: Math.round((pt.x - d.bounds.x) * k), y: Math.round((pt.y - d.bounds.y) * k) }, k });
    stepsBarState();
  } catch (_) { }
  steps.busy = false;
}

function stopSteps() {
  if (!steps) return;
  try { if (steps.helper) steps.helper.kill(); } catch (_) { }
  try { globalShortcut.unregister('F9'); } catch (_) { }
  if (steps.bar && !steps.bar.isDestroyed()) steps.bar.destroy();
  steps = null;
  showWindow();
  win.webContents.send('steps-done');
}

ipcMain.handle('steps-start', async (e, delay = 0) => {
  if (steps) return true;
  win.hide();
  await sleep(300 + delay * 1000);
  const d = activeDisplay();
  steps = { count: 0, paused: false, busy: false, auto: false, helper: null, bar: null };
  const bar = new BrowserWindow({ x: d.workArea.x + 16, y: d.workArea.y + d.workArea.height - 72, width: 430, height: 56, frame: false, alwaysOnTop: true, skipTaskbar: true, resizable: false, hasShadow: true, show: false, backgroundColor: '#16181a',
    webPreferences: { preload: asset('steps-preload.js'), contextIsolation: true } });
  bar.setContentProtection(true);
  bar.setAlwaysOnTop(true, 'screen-saver');
  bar.loadFile(asset('steps.html'));
  bar.once('ready-to-show', () => { bar.showInactive(); stepsBarState(); });
  steps.bar = bar;
  try { globalShortcut.register('F9', () => takeStep()); } catch (_) { }
  if (process.platform === 'win32') {
    try {
      // 10.0.10: native hook + UI Automation helper (saveit-steps.exe in the app folder); the old PowerShell watcher if it is missing
      const helperExe = path.join(__dirname, 'saveit-steps.exe');
      const h = fs.existsSync(helperExe)
        ? spawn(helperExe, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] })
        : spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', CLICK_WATCHER], { windowsHide: true });
      steps.helper = h;
      let buf = '';
      h.stdout.on('data', ch => {
        buf += ch.toString(); let i;
        while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (line === 'READY' && steps) { steps.auto = true; stepsBarState(); }
          if (line.startsWith('CLICK')) takeStep(+line.split(' ')[1] || null);
          if (line.startsWith('INFO ')) { try { win.webContents.send('step-info', JSON.parse(line.slice(5))); } catch (_) { } }
          // 10.0.10: typed text, one line per field (the helper never sends what is typed into password fields)
          if (line.startsWith('TYPE ')) { try { const m = /^TYPE \d+ (.*)$/.exec(line); const t = m && JSON.parse(m[1]); if (t && !t.isPassword && typeof t.text === 'string' && t.text) win.webContents.send('step-type', { field: String(t.field || '').slice(0, 80), text: t.text.slice(0, 200) }); } catch (_) { } } }
      });
      h.on('exit', () => { if (steps && steps.helper === h) { steps.auto = false; steps.helper = null; stepsBarState(); } });
    } catch (_) { }
  }
  return true;
});
ipcMain.on('steps-cmd', (e, c) => {
  if (!steps) return;
  if (c === 'stop') stopSteps();
  else if (c === 'pause') { steps.paused = !steps.paused; stepsBarState(); }
  else if (c === 'shot') takeStep();
});

// ---------- PDF export ----------
ipcMain.handle('print-pdf', async (e, html, name, asBuffer) => {
  const tmp = path.join(os.tmpdir(), 'saveit-' + Date.now() + '.html');
  fs.writeFileSync(tmp, html, 'utf8');
  const pw = new BrowserWindow({ show: false, webPreferences: { offscreen: false } });
  try {
    await pw.loadFile(tmp);
    await sleep(300);
    const pdf = await pw.webContents.printToPDF({ pageSize: 'Letter', printBackground: true, preferCSSPageSize: true });
    if (asBuffer) return pdf; // 10.0.9: Library Save builds the file itself
    const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('documents'), name), filters: [{ name: 'PDF document', extensions: ['pdf'] }] });
    if (r.canceled || !r.filePath) return null;
    fs.writeFileSync(r.filePath, pdf);
    return r.filePath;
  } finally { pw.destroy(); try { fs.unlinkSync(tmp); } catch (_) { } }
});

const FILTERS = { pptx:'PowerPoint presentation',saveitbackup:'Saveit library backup',png: 'PNG image', jpg: 'JPEG image', webm: 'WebM video', mp4: 'MP4 video', docx: 'Word document', pdf: 'PDF document', saveit: 'Saveit file', webp: 'WebP image', bmp: 'BMP image', ico: 'Icon', svg: 'SVG picture', html: 'Web page', gif: 'Animated GIF', wav: 'WAV audio', mp3: 'MP3 audio', m4a: 'M4A audio' };
// 9.01: pick a file path with every file type offered (first one is the default)
ipcMain.handle('save-pick', async (e, name, exts) => {
  const ext = (exts && exts[0]) || 'png';
  const dir = ['wav', 'mp3', 'm4a'].includes(ext) ? app.getPath('music') : ['webm', 'mp4', 'gif'].includes(ext) ? app.getPath('videos') : ['docx', 'pdf', 'saveit','pptx','saveitbackup'].includes(ext) ? app.getPath('documents') : app.getPath('pictures');
  // 10.0.9: name may be the full previous path (without extension) so the dialog opens where the user last saved
  const r = await dialog.showSaveDialog(win, { defaultPath: path.isAbsolute(name) ? name + '.' + ext : path.join(dir, name + '.' + ext), filters: exts.map(x => ({ name: FILTERS[x] || x.toUpperCase(), extensions: [x] })) });
  if (r.canceled || !r.filePath) return null;
  let fp = r.filePath; const got = path.extname(fp).slice(1).toLowerCase();
  if (!exts.includes(got)) fp += '.' + ext;
  return fp;
});
ipcMain.handle('save', async (e, name, buf, target) => {
  if (target) { await fs.promises.writeFile(target, Buffer.from(buf)); return target; }
  const ext = (name.split('.').pop() || 'png').toLowerCase();
  const dir = ['wav', 'mp3', 'm4a'].includes(ext) ? app.getPath('music') : ['webm', 'mp4'].includes(ext) ? app.getPath('videos') : ['docx', 'pdf', 'saveit','pptx','saveitbackup'].includes(ext) ? app.getPath('documents') : app.getPath('pictures');
  const r = await dialog.showSaveDialog(win, { defaultPath: path.join(dir, name), filters: [{ name: FILTERS[ext] || ext.toUpperCase(), extensions: [ext] }] });
  if (r.canceled || !r.filePath) return null;
  await fs.promises.writeFile(r.filePath, Buffer.from(buf));
  return r.filePath;
});

// 10.0.9: "Open folder" button on the Saved to message
ipcMain.handle('reveal-file', (e, p) => { mainSender33(e); if (typeof p === 'string' && path.isAbsolute(p) && fs.existsSync(p)) shell.showItemInFolder(p); });

ipcMain.handle('save-many', async (e, files) => {
  // 10.0.9: guides and documents start in Documents, pictures in Pictures
  const docsOnly = files.length && files.every(f => /\.(docx|pdf|pptx|saveit)$/i.test(f.name));
  const r = await dialog.showOpenDialog(win, { title: 'Choose a folder', defaultPath: app.getPath(docsOnly ? 'documents' : 'pictures'), properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths[0]) return null;
  for (const f of files) await fs.promises.writeFile(path.join(r.filePaths[0], path.basename(f.name)), Buffer.from(f.data));
  return r.filePaths[0];
});

// ---------- Grab Text (Windows built-in OCR) ----------
const OCR_SCRIPT = `
param([string]$Path)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
function Await($op, [Type]$type) { $t = $asTaskGeneric.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }
[void][Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
[void][Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
[void][Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($Path)) ([Windows.Storage.StorageFile])
$stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if ($engine -eq $null) { [Console]::Error.WriteLine('NO_ENGINE'); exit 2 }
$result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
foreach ($line in $result.Lines) { [Console]::Out.WriteLine($line.Text) }
`;
ipcMain.handle('ocr',async(e,url)=>{mainSender33(e);const result=await recognize35(url);return result.lines.map(l=>l.text).join('\n')});

// Put a saved recording on the clipboard as a file, ready to paste into email, Teams or a folder
ipcMain.handle('copy-file', async (e, name, buf) => {
  const dir = path.join(os.tmpdir(), 'saveit', 'clipboard'); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name.replace(/[\\/:*?"<>|]+/g, '-'));
  fs.writeFileSync(file, Buffer.from(buf));
  if (process.platform !== 'win32') return false;
  return new Promise(resolve => {
    const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Set-Clipboard -LiteralPath $args[0]', file], { windowsHide: true });
    p.on('exit', code => resolve(code === 0)); p.on('error', () => resolve(false));
  });
});

ipcMain.handle('app-version', () => app.getVersion());
ipcMain.handle('clipboard-read', e => {
  if (!win || e.sender !== win.webContents) throw new Error('Invalid clipboard sender');
  const image = clipboard.readImage();
  return { image: image.isEmpty() ? null : image.toDataURL(), text: clipboard.readText().slice(0, 16000000) };
});
ipcMain.handle('clipboard-editable', (e, url, text) => {
  if (!win || e.sender !== win.webContents || typeof text !== 'string' || text.length > 16000000 || !/^data:image\/png;base64,/.test(url)) throw new Error('Invalid clipboard data');
  const image = nativeImage.createFromDataURL(url);
  if (image.isEmpty()) throw new Error('Empty image');
  clipboard.write({ image, text });
  return true;
});
ipcMain.handle('copy-image', (e, dataUrl) => { clipboard.writeImage(nativeImage.createFromDataURL(dataUrl)); return true; });
ipcMain.on('recording', (e, on) => { recording = !!on; buildTrayMenu(); });

function send(mode) {
  if (!win) return;
  if (mode === 'window' || mode === 'video') showWindow();
  win.webContents.send('hotkey', mode);
}

function registerShortcuts() {
  const keys = [
    ['PrintScreen', 'region'], ['CommandOrControl+Shift+X', 'region'],
    ['Shift+PrintScreen', 'window'], ['CommandOrControl+PrintScreen', 'screen'],
    ['CommandOrControl+Shift+R', 'video'], ['CommandOrControl+Alt+S', 'steps']
  ];
  const failed = [];
  for (const [k, m] of keys) { try { if (!globalShortcut.register(k, () => send(m))) failed.push(k); } catch (_) { failed.push(k); } }
  return failed;
}

function startAtLogin() { try { return app.getLoginItemSettings({ name: 'Saveit' }).openAtLogin; } catch (_) { return false; } }

function buildTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Capture region\tPrint Screen', click: () => send('region') },
    { label: 'Capture window\tShift+Print Screen', click: () => send('window') },
    { label: 'Capture full screen\tCtrl+Print Screen', click: () => send('screen') },
    { label: 'Step capture (click to capture)\tCtrl+Alt+S', click: () => send('steps') },
    { label: recording ? 'Stop recording\tCtrl+Shift+R' : 'Record screen\tCtrl+Shift+R', click: () => send('video') },
    { type: 'separator' },
    { label: 'Open Saveit', click: showWindow },
    { label: 'Start with Windows', type: 'checkbox', checked: startAtLogin(), click: i => app.setLoginItemSettings({ openAtLogin: i.checked, name: 'Saveit', args: ['--hidden'] }) },
    { type: 'separator' },
    { label: 'Quit', click: requestQuit }
  ]));
}

app.on('second-instance', showWindow);

app.whenReady().then(() => {
  // 9.8: always build the accessibility tree, so Narrator, UI Automation and other assistive tools see named controls
  try { app.setAccessibilitySupportEnabled(true); } catch (_) {}
  // Screen recording: hand the display under the cursor to getDisplayMedia (with system audio on Windows)
  session.defaultSession.setDisplayMediaRequestHandler(async (req, cb) => {
    try {
      const want = pendingSource; pendingSource = null;
      const sources = await desktopCapturer.getSources({ types: want && want.type === 'window' ? ['window'] : ['screen'] });
      const d = activeDisplay();
      const src = (want && sources.find(s => s.id === want.id)) || sources.find(s => String(s.display_id) === String(d.id)) || sources[0];
      const audio = process.platform === 'win32' && req.audioRequested && (!want || want.audio !== false);
      cb(audio ? { video: src, audio: 'loopback' } : { video: src });
    } catch (_) { cb({}); }
  });
  createWindow();
  tray = new Tray(nativeImage.createFromPath(asset('tray.png')));
  tray.setToolTip('Saveit');
  tray.on('click', showWindow);
  buildTrayMenu();
  // Test profiles skip the built-in hotkeys so a running installed copy keeps them.
  const failed = process.env.SAVEIT_REVIEW_DATA ? [] : registerShortcuts();
  restoreWorkflowKeys(); // preset hotkeys after the built-ins, so conflicts are reported on the preset
  if (failed.length) win.webContents.once('did-finish-load', () => win.webContents.send('shortcut-failed', failed));
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', e => { /* keep running in the tray */ });
// The text and positioned-text paths use the same local Windows OCR service.
async function recognize35(url){
 if(process.platform!=='win32')throw Error('Grab Text requires Windows OCR.');
 if(typeof url!=='string'||!/^data:image\/png;base64,/.test(url)||url.length>180000000)throw Error('Choose a PNG image up to 64 million pixels.');
 const img=nativeImage.createFromDataURL(url),size=img.getSize();if(img.isEmpty()||size.width*size.height>64000000)throw Error('Choose an image up to 64 million pixels.');
 const dir=await fs.promises.mkdtemp(path.join(os.tmpdir(),'saveit-ocr35-')),png=path.join(dir,'image.png');
 try{await fs.promises.writeFile(png,Buffer.from(url.split(',')[1],'base64'));const data=await new Promise((resolve,reject)=>{
 const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',asset('ocr.ps1'),'-Path',png],{windowsHide:true});let out='',err='',timedOut=false;
 const timer=setTimeout(()=>{timedOut=true;child.kill()},90000);child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);
 child.on('error',e=>{clearTimeout(timer);reject(Error('Windows text recognition could not start: '+e.message))});
 child.on('close',code=>{clearTimeout(timer);if(timedOut){reject(Error('Text recognition took too long. Select a smaller area.'));return}if(code!==0){reject(Error(/NO_ENGINE/.test(err)?'No Windows OCR language is installed. Add a language with text recognition in Windows Settings.':'Windows text recognition failed. Try a smaller area.'));return}try{resolve(JSON.parse(out.trim().replace(/^\uFEFF/,'')))}catch(e){reject(Error('Windows returned unreadable text-recognition results.'))}})
 });
 // Merge repeated words in tile overlaps, preserving two identical lines at different positions.
 const words=[];const overlap=(a,b)=>{const w=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)),h=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));return w*h/Math.max(1,Math.min(a.w*a.h,b.w*b.h))};
 for(const line of data.lines||[])for(const word of line.words||[]){const duplicate=words.find(w=>overlap(w.rect,word.rect)>.65);if(!duplicate)words.push(word);else if(word.text.length>duplicate.text.length)Object.assign(duplicate,word)}
 words.sort((a,b)=>a.rect.y-b.rect.y||a.rect.x-b.rect.x);const rows=[];
 for(const word of words){let row=rows.find(r=>Math.abs(r.y-(word.rect.y+word.rect.h/2))<Math.min(r.h,word.rect.h)*.45);if(!row){row={y:word.rect.y+word.rect.h/2,h:word.rect.h,words:[]};rows.push(row)}row.words.push(word)}
 const lines=rows.sort((a,b)=>a.y-b.y).map(row=>{const w=row.words.sort((a,b)=>a.rect.x-b.rect.x),x=Math.min(...w.map(a=>a.rect.x)),y=Math.min(...w.map(a=>a.rect.y)),right=Math.max(...w.map(a=>a.rect.x+a.rect.w)),bottom=Math.max(...w.map(a=>a.rect.y+a.rect.h));return{text:w.map(a=>a.text).join(' '),words:w,rect:{x,y,w:right-x,h:bottom-y}}});
 return{lines,width:size.width,height:size.height};
 }finally{await fs.promises.rm(dir,{recursive:true,force:true}).catch(()=>{})}
}
