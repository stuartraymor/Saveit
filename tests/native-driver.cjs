// 10.5.3: shared driver for real-app tests that must not take over the screen the owner is working on.
// - copies this repository's app\ into the disposable runtime (never the installed Saveit) and adds a small probe
// - keeps every Saveit window on ONE display and makes Saveit believe the pointer is there, without moving the real mouse
//   (Saveit captures "the display the pointer is on"); pages are driven through Playwright, not the real mouse
// Display: SAVEIT_TEST_DISPLAY=small (default when there are several: the smallest one) | primary | <index>
'use strict';
const path = require('path'), fs = require('fs'), cp = require('child_process');
const { _electron } = require('playwright');
const REPO = path.resolve(__dirname, '..');
function syncApp(runtime, extraMain = '') {
  const dest = path.join(runtime, 'resources', 'app');
  fs.rmSync(dest, { recursive: true, force: true }); fs.cpSync(path.join(REPO, 'app'), dest, { recursive: true });
  let html = fs.readFileSync(path.join(dest, 'index.html'), 'utf8'); const end = '})();\n})();\n</script>', crlf = html.includes('\r\n'); html = html.replace(/\r\n/g, '\n');
  const at = html.lastIndexOf(end); if (at < 0) throw Error('probe point not found in index.html');
  html = html.slice(0, at) + 'window.__wf={get cur(){return S.cur},get items(){return S.items},get tool(){return S.tool}};\n' + html.slice(at);
  fs.writeFileSync(path.join(dest, 'index.html'), crlf ? html.replace(/\n/g, '\r\n') : html);
  if (extraMain) fs.appendFileSync(path.join(dest, 'main.js'), '\r\n' + extraMain + '\r\n');
}
async function launch({ exe, out, extraMain = '', env = {} }) {
  exe = path.resolve(exe); out = path.resolve(out);
  if (/appdata\\local\\programs\\saveit\\/i.test(exe)) throw Error('Use a disposable runtime copy, never the installed Saveit');
  syncApp(path.dirname(exe), extraMain);
  fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  const app = await _electron.launch({ executablePath: exe, args: ['--hidden'], env: { ...process.env, SAVEIT_REVIEW_DATA: path.join(out, 'profile'), ...env }, timeout: 30000, bypassCSP: true });
  const display = await app.evaluate(({ screen, BrowserWindow, app }, want) => {
    const ds = screen.getAllDisplays(), area = d => d.bounds.width * d.bounds.height;
    const d = want === 'primary' ? screen.getPrimaryDisplay() : /^\d+$/.test(want) ? ds[+want] || ds[0] : ds.slice().sort((a, b) => area(a) - area(b))[0];
    const wa = d.workArea, real = screen.getCursorScreenPoint.bind(screen);
    global.__fakeCursor = { x: wa.x + Math.round(wa.width / 2), y: wa.y + Math.round(wa.height / 2) };
    screen.getCursorScreenPoint = () => global.__fakeCursor || real();
    const inside = b => b.x >= d.bounds.x - 8 && b.x < d.bounds.x + d.bounds.width && b.y >= d.bounds.y - 8 && b.y < d.bounds.y + d.bounds.height;
    const fix = w => { try { if (w.isDestroyed()) return; const b = w.getBounds(); if (inside(b)) return; w.setBounds({ x: wa.x + 10, y: wa.y + 10, width: Math.min(b.width, wa.width - 20), height: Math.min(b.height, wa.height - 20) }); } catch (_) {} };
    const hook = w => { fix(w); w.on('show', () => fix(w)); };
    BrowserWindow.getAllWindows().forEach(hook); app.on('browser-window-created', (e, w) => { hook(w); setTimeout(() => fix(w), 0); });
    return { bounds: d.bounds, workArea: wa, sf: d.scaleFactor };
  }, process.env.SAVEIT_TEST_DISPLAY || 'small');
  const p = await app.firstWindow(); p.setDefaultTimeout(20000);
  const errors = []; p.on('pageerror', e => errors.push('editor: ' + e.message));
  await p.waitForFunction(() => document.body.dataset.catalogCount && window.__wf);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const open = nm => app.windows().filter(w => !w.isClosed() && w.url().includes(nm));
  // A window of ours showing page `nm`. (Hidden spare windows also say they are visible, because background throttling is
  // off; ask the main process which ones are really shown.)
  const find = async (nm, tries = 60) => { for (let i = 0; i < tries; i++) { const shown = await app.evaluate(({ BrowserWindow }, nm) => BrowserWindow.getAllWindows().filter(w => !w.isDestroyed() && w.isVisible() && w.webContents.getURL().includes(nm)).length, nm).catch(() => 0); /* Playwright can lose its hold for a moment while a window opens; ask again */ if (shown && open(nm).length) return open(nm)[open(nm).length - 1]; await sleep(150); } return null; };
  // the region selector that has its picture and is waiting for a selection
  const findOverlay = async () => { for (let i = 0; i < 100; i++) { for (const w of open('overlay.html')) if (await w.evaluate(() => typeof ready !== 'undefined' && ready && !sent).catch(() => false)) return w; await sleep(100); } return null; };
  const wins = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(w => ({ url: w.webContents.getURL().split('/').pop().slice(0, 40), title: w.getTitle(), visible: w.isVisible(), focused: w.isFocused(), b: w.getBounds() })));
  const quit = () => app.evaluate(({ app }) => { app.isQuitting = true; app.quit(); }).catch(() => {});
  let fails = 0; const lines = [];
  const check = (name, ok, extra) => { const l = (ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : ''); console.log(l); lines.push(l); if (!ok) fails++; };
  const finish = async () => { await quit(); fs.writeFileSync(path.join(out, 'results.txt'), lines.join('\n') + '\n'); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0); };
  return { app, p, out, display, small: display, errors, find, findOverlay, wins, sleep, quit, check, finish };
}
// An ordinary Windows program window (title bar, resize borders, another process) with four coloured quarters, built from
// tests/fixtures/fixwin.cs with Windows' own C# compiler.
function buildFixture(out) {
  const csc = path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'), exe = path.join(out, 'fixwin.exe');
  cp.execFileSync(csc, ['/nologo', '/optimize', '/target:winexe', '/r:System.Windows.Forms.dll', '/r:System.Drawing.dll', '/out:' + exe, path.join(__dirname, 'fixtures', 'fixwin.cs')], { stdio: 'pipe' });
  return exe;
}
module.exports = { launch, syncApp, buildFixture, REPO };
