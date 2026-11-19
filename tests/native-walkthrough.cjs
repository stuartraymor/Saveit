// Release walkthrough: screenshots of the editor with every tool's settings panel, the Image/Video/Audio bars, the library,
// Save as, a new step guide, Check for Updates, the widget and the region selector, for a person to look over before a release.
// Real Electron, disposable profile. Any page error is reported.
// node tests/native-walkthrough.cjs <runtime Saveit.exe> <evidence folder>
'use strict';
const { _electron } = require('playwright'), fs = require('fs'), path = require('path');
(async () => {
  const [exe, out] = process.argv.slice(2); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  const app = await _electron.launch({ executablePath: exe, env: { ...process.env, SAVEIT_REVIEW_DATA: path.join(out, 'profile') }, timeout: 30000 });
  const errors = [], shots = [];
  try {
    const p = await app.firstWindow(); p.setDefaultTimeout(15000); p.on('pageerror', e => errors.push('editor: ' + e.message));
    await p.waitForFunction(() => document.body.dataset.catalogCount);
    await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('index.html')); if (w.isMaximized()) w.unmaximize(); w.setContentSize(1440, 900); });
    await p.waitForTimeout(1200);
    let k = 0; const shot = async (name, page = p) => { const f = `${String(++k).padStart(2, '0')}-${name}.png`; await page.screenshot({ path: path.join(out, f) }); shots.push(f); };
    const esc = async () => { await p.keyboard.press('Escape'); await p.waitForTimeout(250); };
    await shot('start');
    const src = fs.readFileSync(path.join(path.dirname(exe), 'resources', 'app', 'index.html'), 'utf8'), tl = src.slice(src.indexOf('const TOOLS=['), src.indexOf('];', src.indexOf('const TOOLS=[')) + 1);
    const tools = [...tl.matchAll(/\['([a-z0-9]+)','[^']*','([^']*)'/g)].map(m => ({ id: m[1], key: m[2] }));
    await p.mouse.click(720, 500); await p.waitForTimeout(200);
    for (const t of tools) { if (!t.key || t.key.length !== 1) continue; await p.keyboard.press(t.key.toLowerCase()); await p.waitForTimeout(300); await shot('tool-' + t.id); }
    await p.keyboard.press('v'); await p.waitForTimeout(200);
    for (const m of ['Vid', 'Aud', 'Img']) { await p.locator('#m' + m).click(); await p.waitForTimeout(1200); await shot('mode-' + m); }
    await p.locator('#libBtn').click(); await p.waitForTimeout(800); await shot('library'); await esc(); await esc();
    await p.locator('#saveAsBtn').click(); await p.waitForTimeout(600); await shot('save-as'); await esc();
    await p.evaluate(() => document.getElementById('newGuideBtn').click()); await p.waitForTimeout(800); await shot('new-guide');
    await p.locator('#updLink103').click(); await p.waitForTimeout(4000); await shot('check-for-updates'); await esc(); await esc();
    // region selector
    await p.locator('#mImg').click(); await p.locator('#area').selectOption('region'); await p.locator('#capBtn').click();
    let ov = null; for (let i = 0; i < 200 && !ov; i++) { for (const w of app.windows().filter(w => w.url().includes('overlay.html'))) if (await w.evaluate(() => document.visibilityState === 'visible' && ready).catch(() => false)) ov = w; if (!ov) await new Promise(r => setTimeout(r, 25)); }
    if (ov) { await ov.mouse.move(300, 250); await ov.mouse.down(); await ov.mouse.move(800, 560, { steps: 8 }); await ov.mouse.up(); await ov.waitForTimeout(300); await shot('region-selector', ov); await ov.keyboard.press('Escape').catch(() => {}); }
    else errors.push('region selector did not open');
    await p.waitForTimeout(1200);
    // widget
    await p.locator('#widgetBtn').click();
    let ww = null; for (let i = 0; i < 100 && !ww; i++) { for (const w of app.windows().filter(w => w.url().includes('widget.html'))) if (await w.evaluate(() => document.visibilityState === 'visible').catch(() => false)) ww = w; if (!ww) await new Promise(r => setTimeout(r, 50)); }
    if (ww) { ww.on('pageerror', e => errors.push('widget: ' + e.message)); await ww.waitForTimeout(600); for (const m of ['Img', 'Vid', 'Aud']) { await ww.click('#m' + m); await ww.waitForTimeout(900); await shot('widget-' + m, ww); } await ww.click('#mImg'); }
    else errors.push('widget did not open');
  } catch (e) { errors.push('walkthrough stopped: ' + e.stack); }
  fs.writeFileSync(path.join(out, 'walkthrough.txt'), shots.join('\n') + '\n\nerrors:\n' + errors.join('\n'));
  console.log(shots.length + ' screenshots; ' + (errors.length ? errors.length + ' problems:\n' + errors.join('\n') : 'no page errors'));
  const pid = app.process().pid; await Promise.race([app.close().catch(() => {}), new Promise(r => setTimeout(r, 6000))]); try { require('child_process').execSync('taskkill /PID ' + pid + ' /T /F', { stdio: 'ignore' }); } catch (_) {}
})();
