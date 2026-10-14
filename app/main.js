// Saveit — desktop shell
const { app, BrowserWindow, ipcMain, desktopCapturer, screen, globalShortcut, Tray, Menu, dialog, clipboard, nativeImage, session, shell } = require('electron');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const fs = require('fs');

if (!app.requestSingleInstanceLock()) { app.quit(); }
app.setAppUserModelId('com.saveit.app');
// Keep the library from earlier versions (stored under the old app name)
try { const old = path.join(app.getPath('appData'), 'Capture Bench'); if (fs.existsSync(old)) app.setPath('userData', old); } catch (_) { }

let win = null, tray = null, recording = false, trayTipShown = false;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const asset = f => path.join(__dirname, f);

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
  win.on('close', e => {
    if (app.isQuitting) return;
    e.preventDefault(); win.hide();
    if (!trayTipShown && tray && process.platform === 'win32') {
      tray.displayBalloon({ iconType: 'info', title: 'Saveit is still running', content: 'Press Print Screen to capture. Right-click the tray icon to quit.' });
      trayTipShown = true;
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
}

// ---------- floating capture widget (editor hidden) ----------
let widgetWin = null, widgetOpts = null, reopenWidget = false;
function closeWidget() { if (widgetWin && !widgetWin.isDestroyed()) widgetWin.destroy(); widgetWin = null; }
function openWidget(opts) {
  if (opts) widgetOpts = opts;
  if (widgetWin && !widgetWin.isDestroyed()) { widgetWin.show(); return; }
  const d = activeDisplay(), W = Math.min(1240, d.bounds.width - 40), H = 84;
  widgetWin = new BrowserWindow({ x: Math.round(d.bounds.x + (d.bounds.width - W) / 2), y: d.bounds.y + 14, width: W, height: H, frame: false, resizable: false, maximizable: false, minimizable: false, skipTaskbar: false, alwaysOnTop: true, backgroundColor: '#16181a', hasShadow: true, show: false,
    webPreferences: { preload: asset('widget-preload.js'), contextIsolation: true } });
  widgetWin.setContentProtection(true);
  widgetWin.setAlwaysOnTop(true, 'floating');
  widgetWin.loadFile(asset('widget.html'));
  widgetWin.webContents.once('did-finish-load', () => { widgetWin.webContents.send('init', widgetOpts); widgetWin.show(); });
  widgetWin.on('closed', () => { widgetWin = null; });
  if (win) win.hide();
}
// Called at the start of a capture or recording: the widget steps aside, and comes back if the user cancels.
function beginCaptureUI() { if (widgetWin && !widgetWin.isDestroyed()) { reopenWidget = true; closeWidget(); } }
function restoreUI(wasVisible) { if (reopenWidget) { reopenWidget = false; openWidget(); } else if (wasVisible) showWindow(); }
function showWindow() { reopenWidget = false; closeWidget(); if (!win) return; if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
ipcMain.on('widget-open', (e, opts) => openWidget(opts));
ipcMain.on('widget-opts', (e, o) => { widgetOpts = o; if (win) win.webContents.send('widget-opts', o); });
ipcMain.on('widget-go', (e, o) => { widgetOpts = o; reopenWidget = true; closeWidget(); if (win) win.webContents.send('widget-go', o); });
ipcMain.on('widget-editor', () => showWindow());
ipcMain.on('widget-size', (e, w, h) => { if (widgetWin && !widgetWin.isDestroyed() && h > 30 && w > 200) { const d = screen.getDisplayNearestPoint({ x: widgetWin.getBounds().x, y: widgetWin.getBounds().y }), W = Math.min(Math.round(w) + 2, d.bounds.width - 20), H = Math.min(520, Math.round(h)), cx = widgetWin.getBounds().x + widgetWin.getBounds().width / 2; widgetWin.setBounds({ x: Math.max(d.bounds.x + 4, Math.round(cx - W / 2)), y: widgetWin.getBounds().y, width: W, height: H }); } });

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
function wheelDriver() {
  if (process.platform !== 'win32') throw new Error('Scrolling capture works on Windows.');
  const { spawn } = require('child_process');
  const ps = spawn('powershell.exe', ['-NoProfile', '-NoLogo', '-NonInteractive', '-Command', '-'], { windowsHide: true });
  ps.stdin.write(`Add-Type -Namespace W -Name M -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y); [DllImport("user32.dll")] public static extern void mouse_event(uint f,int x,int y,int d,int e);'\n`);
  return {
    move: (x, y) => ps.stdin.write(`[W.M]::SetCursorPos(${Math.round(x)},${Math.round(y)})\n`),
    wheel: n => ps.stdin.write(`[W.M]::mouse_event(0x0800,0,0,${-120 * n},0)\n`),
    close: () => { try { ps.stdin.end(); ps.kill(); } catch (_) {} }
  };
}
async function scrollCapture(d, r) {
  const k0 = d.scaleFactor || 1, drv = wheelDriver(), st = new Stitcher();
  try {
    const cx = d.bounds.x + r.x + r.w / 2, cy = d.bounds.y + r.y + r.h / 2;
    drv.move(cx, cy); await sleep(500);
    let notches = 3, ppn = 0;
    for (let i = 0; i < 80; i++) {
      const img = await grabDisplay(d), kk = img.getSize().width / d.bounds.width;
      const rect = { x: Math.round(r.x * kk), y: Math.round(r.y * kk), width: Math.max(1, Math.round(r.w * kk)), height: Math.max(1, Math.round(r.h * kk)) };
      const c = img.crop(rect), sz = c.getSize();
      const res = st.add({ data: c.toBitmap(), w: sz.width, h: sz.height });
      if (res.done) break;
      if (!res.first && res.added > 0) { ppn = res.added / notches; notches = Math.max(1, Math.min(30, Math.floor(sz.height * 0.6 / Math.max(1, ppn)))); }
      if (st.total > 32000) break;
      drv.wheel(notches); await sleep(450);
    }
  } finally { drv.close(); }
  const o = st.result(), { nativeImage } = require('electron');
  return nativeImage.createFromBitmap(o.data, { width: o.w, height: o.h });
}

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
        if (r.opts) settings = r.opts;
        if (!pre && settings.mode === 'video') return { redirect: 'video', rect: { x: r.x, y: r.y, w: r.w, h: r.h, did: d.id }, settings };
        if (settings.area === 'text') mode = 'text';
        if (settings.area === 'scroll' && !pre) mode = 'scroll'; else if (mode === 'scroll') mode = 'region';
        const k = img.getSize().width / d.bounds.width;
        const rect = { x: Math.round(r.x * k), y: Math.round(r.y * k), width: Math.max(1, Math.round(r.w * k)), height: Math.max(1, Math.round(r.h * k)) };
        if (mode === 'scroll') {
          if (win) win.hide(); await sleep(250);
          out = await scrollCapture(d, r); cursor = { x: -1, y: -1, k: kk };
        } else {
          out = img.crop(rect);
          cursor = { x: cursor.x - rect.x, y: cursor.y - rect.y, k: kk };
        }
      }
      break;
    }
    showWindow();
    return { url: out.toDataURL(), cursor, settings, area: mode };
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
  const region = info && info.w ? info : null;
  const area = region || { x: d.bounds.x, y: d.bounds.y, w: d.bounds.width, h: d.bounds.height };
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
  // Live webcam preview ("see yourself") where the webcam sits in the video
  const cam = extra && extra.cam;
  if (cam && cam.o) {
    const o = cam.o, m = Math.round(area.w * 0.025), sw = Math.max(120, Math.round(area.w * o.size / 100)), h = o.shape === 'rect' ? Math.round(sw * 9 / 16) : sw;
    const x = o.pos[1] === 'l' ? area.x + m : area.x + area.w - m - sw, y = o.pos[0] === 't' ? area.y + m : area.y + area.h - m - h;
    const cw = new BrowserWindow({ x: Math.round(x), y: Math.round(y), width: sw, height: h, frame: false, transparent: true, backgroundColor: '#00000000', alwaysOnTop: true, skipTaskbar: true, focusable: false, resizable: false, movable: false, hasShadow: false, show: false, thickFrame: false });
    cw.setIgnoreMouseEvents(true);
    cw.setContentProtection(true);
    cw.setAlwaysOnTop(true, 'screen-saver');
    cw.loadFile(asset('campreview.html'), { query: { shape: o.shape, corners: o.corners, border: o.border ? '1' : '0', dev: o.deviceId || '' } });
    cw.once('ready-to-show', () => cw.showInactive());
    recWins.push(cw);
  }
  // Floating recording controls
  const W = 400, H = 48;
  let x, y;
  if (region) { x = Math.round(region.x + region.w / 2 - W / 2); y = Math.round(region.y + region.h + 12); if (y + H > d.bounds.y + d.bounds.height) y = Math.max(d.bounds.y + 8, Math.round(region.y - H - 12)); if (y < d.bounds.y) y = d.bounds.y + 8; }
  else { const db = (info && info.display) || { x: d.bounds.x, y: d.bounds.y, w: d.bounds.width }; x = Math.round(db.x + db.w / 2 - W / 2); y = db.y + 12; }
  x = Math.min(Math.max(x, d.bounds.x + 4), d.bounds.x + d.bounds.width - W - 4);
  const rb = new BrowserWindow({ x, y, width: W, height: H, frame: false, backgroundColor: '#16181a', alwaysOnTop: true, skipTaskbar: true, resizable: false, hasShadow: false, show: false,
    webPreferences: { preload: asset('recbar-preload.js'), contextIsolation: true } });
  rb.setContentProtection(true);
  rb.setAlwaysOnTop(true, 'screen-saver');
  rb.loadFile(asset('recbar.html'), { query: { size: region ? `${Math.round(region.w)} × ${Math.round(region.h)}` : 'Full screen', cursor: extra && extra.cursor ? '1' : '0', cam: cam ? '1' : '0', mic: extra && extra.mic ? '1' : '0', sys: extra && extra.sys ? '1' : '0' } });
  rb.once('ready-to-show', () => rb.showInactive());
  recWins.push(rb);
});
ipcMain.on('rec-cmd', (e, c) => {
  if (win) win.webContents.send('rec-cmd', c);
  // Safety net: if the editor doesn't close the recording UI, close it ourselves
  if (c === 'stop') setTimeout(() => { if (recWins.length) { closeRecWins(); showWindow(); } }, 4000);
});
ipcMain.on('rec-state', (e, st) => { for (const w of recWins) if (!w.isDestroyed()) w.webContents.send('state', st); });

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
    const img = await grabDisplay(d);
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
      const h = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', CLICK_WATCHER], { windowsHide: true });
      steps.helper = h;
      let buf = '';
      h.stdout.on('data', ch => {
        buf += ch.toString(); let i;
        while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (line === 'READY' && steps) { steps.auto = true; stepsBarState(); }
          if (line.startsWith('CLICK')) takeStep(+line.split(' ')[1] || null);
          if (line.startsWith('INFO ')) { try { win.webContents.send('step-info', JSON.parse(line.slice(5))); } catch (_) { } } }
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
ipcMain.handle('print-pdf', async (e, html, name) => {
  const tmp = path.join(os.tmpdir(), 'saveit-' + Date.now() + '.html');
  fs.writeFileSync(tmp, html, 'utf8');
  const pw = new BrowserWindow({ show: false, webPreferences: { offscreen: false } });
  try {
    await pw.loadFile(tmp);
    await sleep(300);
    const pdf = await pw.webContents.printToPDF({ pageSize: 'Letter', printBackground: true, preferCSSPageSize: true });
    const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('documents'), name), filters: [{ name: 'PDF document', extensions: ['pdf'] }] });
    if (r.canceled || !r.filePath) return null;
    fs.writeFileSync(r.filePath, pdf);
    return r.filePath;
  } finally { pw.destroy(); try { fs.unlinkSync(tmp); } catch (_) { } }
});

const FILTERS = { png: 'PNG image', jpg: 'JPEG image', webm: 'WebM video', mp4: 'MP4 video', docx: 'Word document', pdf: 'PDF document', saveit: 'Saveit file', webp: 'WebP image', bmp: 'BMP image', ico: 'Icon', svg: 'SVG picture', html: 'Web page' };
ipcMain.handle('save', async (e, name, buf) => {
  const ext = (name.split('.').pop() || 'png').toLowerCase();
  const dir = ['webm', 'mp4'].includes(ext) ? app.getPath('videos') : ['docx', 'pdf', 'saveit'].includes(ext) ? app.getPath('documents') : app.getPath('pictures');
  const r = await dialog.showSaveDialog(win, { defaultPath: path.join(dir, name), filters: [{ name: FILTERS[ext] || ext.toUpperCase(), extensions: [ext] }] });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, Buffer.from(buf));
  return r.filePath;
});

ipcMain.handle('save-many', async (e, files) => {
  const r = await dialog.showOpenDialog(win, { title: 'Choose a folder', defaultPath: app.getPath('pictures'), properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths[0]) return null;
  for (const f of files) fs.writeFileSync(path.join(r.filePaths[0], path.basename(f.name)), Buffer.from(f.data));
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
ipcMain.handle('ocr', async (e, dataUrl) => {
  if (process.platform !== 'win32') throw new Error('Grab Text uses the text recognition built into Windows');
  const dir = path.join(os.tmpdir(), 'saveit'); fs.mkdirSync(dir, { recursive: true });
  const png = path.join(dir, 'ocr-' + Date.now() + '.png'), ps1 = path.join(dir, 'ocr.ps1');
  fs.writeFileSync(png, Buffer.from(dataUrl.split(',')[1], 'base64'));
  fs.writeFileSync(ps1, '﻿' + OCR_SCRIPT, 'utf8');
  try {
    return await new Promise((resolve, reject) => {
      const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ps1, '-Path', png], { windowsHide: true });
      let out = '', err = '';
      const timer = setTimeout(() => { try { p.kill(); } catch (_) { } reject(new Error('Text recognition took too long')); }, 45000);
      p.stdout.on('data', d => out += d.toString('utf8'));
      p.stderr.on('data', d => err += d.toString('utf8'));
      p.on('exit', code => { clearTimeout(timer); if (code === 0) resolve(out.replace(/\r/g, '').trim());
        else reject(new Error(/NO_ENGINE/.test(err) ? 'No text-recognition language is installed in Windows (Settings > Time & language > Language)' : 'Windows text recognition is not available on this computer')); });
      p.on('error', () => { clearTimeout(timer); reject(new Error('PowerShell could not start')); });
    });
  } finally { try { fs.unlinkSync(png); } catch (_) { } }
});

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
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
  ]));
}

app.on('second-instance', showWindow);

app.whenReady().then(() => {
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
  const failed = registerShortcuts();
  if (failed.length) win.webContents.once('did-finish-load', () => win.webContents.send('shortcut-failed', failed));
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', e => { /* keep running in the tray */ });
