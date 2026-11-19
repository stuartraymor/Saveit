// Time from clicking Capture (Image > Region) until the region selector is on screen and ready, and from clicking the
// tray/hotkey widget until it is visible. Also times the parts (screen grab, picture encoding). Real Electron, disposable profile.
// node tests/native-capture-timing.cjs <runtime Saveit.exe> <evidence folder> [runs]
'use strict';
const { _electron } = require('playwright'), fs = require('fs'), path = require('path');
(async () => {
  const [exe, out, runsArg] = process.argv.slice(2), runs = +runsArg || 3; fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  // TIMING_PROFILE=<folder>: start from a copy of a real profile (for example a library backup), never the folder itself
  if (process.env.TIMING_PROFILE) fs.cpSync(process.env.TIMING_PROFILE, path.join(out, 'profile'), { recursive: true });
  const app = await _electron.launch({ executablePath: exe, env: { ...process.env, SAVEIT_REVIEW_DATA: path.join(out, 'profile') }, timeout: 30000 });
  const report = [], log = s => { console.log(s); report.push(s); };
  try {
    const p = await app.firstWindow(); p.setDefaultTimeout(30000); await p.waitForFunction(() => document.body.dataset.catalogCount);
    await p.waitForTimeout(1500);
    // parts, measured inside the main process on the display under the cursor
    const parts = await app.evaluate(async ({ desktopCapturer, screen }) => {
      const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()), sf = d.scaleFactor || 1, size = { width: Math.round(d.size.width * sf), height: Math.round(d.size.height * sf) };
      let t = Date.now(); const s = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: size }); const grab = Date.now() - t;
      const img = (s.find(x => String(x.display_id) === String(d.id)) || s[0]).thumbnail;
      t = Date.now(); const url = img.toDataURL(); const png = Date.now() - t;
      t = Date.now(); img.toBitmap(); const raw = Date.now() - t;
      return { display: size, screens: s.length, grabMs: grab, pngMs: png, pngMB: +(url.length / 1e6).toFixed(1), rawMs: raw };
    });
    log('parts ' + JSON.stringify(parts));
    await p.locator('#mImg').click(); await p.locator('#area').selectOption('region');
    for (let i = 0; i < runs; i++) {
      const t0 = Date.now(); await p.locator('#capBtn').click();
      let ov = null; while (!ov && Date.now() - t0 < 20000) { for (const w of app.windows().filter(w => w.url().includes('overlay.html'))) if (!ov && await w.evaluate(() => document.visibilityState === 'visible' && ready).catch(() => false)) ov = w; if (!ov) await new Promise(r => setTimeout(r, 20)); }
      const tWin = Date.now() - t0;
      await ov.waitForFunction(() => typeof ready !== 'undefined' && ready, null, { timeout: 20000 });
      // visible = the BrowserWindow is shown
      let tVis = 0; for (; Date.now() - t0 < 20000;) { const v = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(w => !w.isDestroyed() && w.webContents.getURL().includes('overlay.html') && w.isVisible())); if (v) { tVis = Date.now() - t0; break; } await new Promise(r => setTimeout(r, 15)); }
      log(`capture click -> overlay window exists ${tWin} ms, ready+visible ${tVis} ms`);
      await ov.keyboard.press('Escape').catch(() => {}); await new Promise(r => setTimeout(r, 300));
      for (let k = 0; k < 50 && await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(w => !w.isDestroyed() && w.isVisible() && w.webContents.getURL().includes('overlay.html'))); k++) await new Promise(r => setTimeout(r, 100));
      await p.waitForFunction(() => !document.hidden).catch(() => {}); await new Promise(r => setTimeout(r, 1200));
    }
    // widget: click the editor's Widget button, time until the widget window is visible
    for (let i = 0; i < runs; i++) {
      const vis = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(w => !w.isDestroyed() && w.webContents.getURL().includes('widget.html') && w.isVisible()));
      const t0 = Date.now(); await p.locator('#widgetBtn, button:has-text("Widget")').first().click();
      let t = 0; for (; Date.now() - t0 < 20000;) { if (await vis()) { t = Date.now() - t0; break; } await new Promise(r => setTimeout(r, 15)); }
      log(`widget button -> widget visible ${t} ms`);
      // back to the editor
      await app.evaluate(({ BrowserWindow }) => { for (const w of BrowserWindow.getAllWindows()) { if (w.webContents.getURL().includes('widget.html')) w.hide(); else if (w.webContents.getURL().includes('index.html')) w.show(); } });
      await new Promise(r => setTimeout(r, 1500));
    }
  } catch (e) { log('ERROR ' + e.stack); }
  fs.writeFileSync(path.join(out, 'timing.txt'), report.join('\n'));
  const pid = app.process().pid; await Promise.race([app.close().catch(() => {}), new Promise(r => setTimeout(r, 6000))]); try { require('child_process').execSync('taskkill /PID ' + pid + ' /T /F', { stdio: 'ignore' }); } catch (_) {}
})();
