// 10.4.0: Capture waits less before reading the screen (200 ms after hiding the editor instead of always 350 ms). This checks
// that Saveit's own windows are never in the screenshot: the editor is painted bright magenta, Capture is clicked (editor
// showing, then from the widget), and the frozen screen in the region selector must contain no magenta where the editor was.
// node tests/native-capture-hides-saveit.cjs <runtime Saveit.exe> <evidence folder> [runs]
'use strict';
const { _electron } = require('playwright'), fs = require('fs'), path = require('path');
(async () => {
  const [exe, out, runsArg] = process.argv.slice(2), runs = +runsArg || 5; fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  const app = await _electron.launch({ executablePath: exe, env: { ...process.env, SAVEIT_REVIEW_DATA: path.join(out, 'profile') }, timeout: 30000 });
  let fails = 0; const check = (n, ok, x) => { console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!ok) fails++; };
  try {
    const p = await app.firstWindow(); p.setDefaultTimeout(30000); await p.waitForFunction(() => document.body.dataset.catalogCount);
    await p.locator('#mImg').click(); await p.locator('#area').selectOption('region');
    // the region selector opens on the screen under the mouse pointer: put the editor there
    await app.evaluate(({ BrowserWindow, screen }) => { const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea, w = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('index.html'));
      if (w.isMaximized()) w.unmaximize(); w.setBounds({ x: d.x + 40, y: d.y + 40, width: Math.min(1400, d.width - 80), height: Math.min(900, d.height - 80) }); });
    await p.waitForTimeout(500);
    const magentaIn = async (ov, rect) => ov.evaluate(r => { const k = (img.naturalWidth || img.width) / innerWidth, cv = document.createElement('canvas'); cv.width = Math.round(r.w * k); cv.height = Math.round(r.h * k);
      const g = cv.getContext('2d'); g.drawImage(img, r.x * k, r.y * k, r.w * k, r.h * k, 0, 0, cv.width, cv.height); const d = g.getImageData(0, 0, cv.width, cv.height).data; let m = 0, n = 0;
      for (let i = 0; i < d.length; i += 4 * 7) { n++; if (d[i] > 200 && d[i + 1] < 60 && d[i + 2] > 200) m++; } return m / n; }, rect);
    // the shown selector: the spare one prepared in advance has the same address but is hidden and has no picture
    const overlayFor = async b => { for (let i = 0; i < 200; i++) { for (const w of app.windows().filter(w => w.url().includes('overlay.html'))) { const st = await w.evaluate(() => ({ ready: typeof ready !== 'undefined' && ready, vis: document.visibilityState, x: screenX, y: screenY, w: outerWidth, h: outerHeight })).catch(() => null); if (st && st.ready && st.vis === 'visible') { const ob = { x: st.x, y: st.y, width: st.w, height: st.h }; if (b.x + b.width / 2 >= ob.x && b.x + b.width / 2 < ob.x + ob.width) return { w, ob }; } } await new Promise(r => setTimeout(r, 25)); } return null; };
    for (let i = 0; i < runs; i++) {
      await p.evaluate(() => { document.documentElement.style.background = '#ff00ff'; document.body.style.background = '#ff00ff'; for (const e of document.querySelectorAll('header,.top,.topbar,#stage,.stage,main,aside,footer')) e.style.background = '#ff00ff'; });
      await p.waitForTimeout(400);
      const b = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('index.html')).getContentBounds());
      await p.locator('#capBtn').click();
      const o = await overlayFor(b); if (!o) throw Error('no region selector');
      const rect = { x: b.x - o.ob.x + 10, y: b.y - o.ob.y + 10, w: Math.min(b.width, o.ob.width) - 20, h: Math.min(b.height, o.ob.height) - 20 };
      const share = await magentaIn(o.w, rect);
      if (i === 0) await o.w.screenshot({ path: path.join(out, 'frozen-screen.png') }).catch(() => {});
      check(`run ${i + 1}: the editor is not in the screenshot (editor showing when Capture was clicked)`, share < 0.01, (share * 100).toFixed(2) + '% magenta');
      await o.w.keyboard.press('Escape').catch(() => {});
      for (let k = 0; k < 50 && await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(w => !w.isDestroyed() && w.isVisible() && w.webContents.getURL().includes('overlay.html'))); k++) await new Promise(r => setTimeout(r, 100));
      await p.waitForFunction(() => !document.hidden); await p.waitForTimeout(800);
    }
    // from the widget: the widget must not be in the screenshot either
    await p.locator('#widgetBtn').click();
    const ww = await (async () => { for (let i = 0; i < 100; i++) { const w = app.windows().find(w => w.url().includes('widget.html')); if (w && await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(x => x.webContents.getURL().includes('widget.html') && x.isVisible()))) return w; await new Promise(r => setTimeout(r, 50)); } return null; })();
    await ww.waitForSelector('#ok'); await ww.evaluate(() => { document.documentElement.style.background = '#ff00ff'; document.body.style.background = '#ff00ff'; for (const e of document.querySelectorAll('*')) e.style.background = '#ff00ff'; }); await ww.waitForTimeout(300);
    for (let i = 0; i < runs; i++) {
      const b = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('widget.html')).getBounds());
      await ww.locator('#ok').click();
      const o = await overlayFor(b); if (!o) throw Error('no region selector from the widget');
      const share = await magentaIn(o.w, { x: b.x - o.ob.x + 4, y: b.y - o.ob.y + 4, w: b.width - 8, h: b.height - 8 });
      check(`widget run ${i + 1}: the widget is not in the screenshot`, share < 0.01, (share * 100).toFixed(2) + '% magenta');
      await o.w.keyboard.press('Escape').catch(() => {});
      for (let k = 0; k < 100; k++) { if (await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(x => x.webContents.getURL().includes('widget.html') && x.isVisible()))) break; await new Promise(r => setTimeout(r, 50)); }
      check(`widget run ${i + 1}: the widget comes back after Esc`, await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(x => x.webContents.getURL().includes('widget.html') && x.isVisible())));
      await new Promise(r => setTimeout(r, 600));
    }
  } catch (e) { check('test ran to the end', false, e.stack); }
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  const pid = app.process().pid; await Promise.race([app.close().catch(() => {}), new Promise(r => setTimeout(r, 6000))]); try { require('child_process').execSync('taskkill /PID ' + pid + ' /T /F', { stdio: 'ignore' }); } catch (_) {}
  process.exitCode = fails ? 1 : 0;
})();
