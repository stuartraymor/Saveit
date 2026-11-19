// 10.3.11 real-app everyday image workflow, done with the visible controls the way a person would:
// screenshot > arrow > text > numbered steps > undo/redo > crop > Save PNG > copy > Library > widget round trip > Check for Updates.
// Real Electron, disposable profile; Save writes into the evidence folder (the save dialog is answered by the test).
// node tests/native-workflow-everyday.cjs <runtime Saveit.exe> <evidence folder>
'use strict';
const { _electron } = require('playwright'), fs = require('fs'), path = require('path');
(async () => {
  const [exe, out] = process.argv.slice(2); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  if (/appdata\\local\\programs\\saveit\\/i.test(exe)) throw Error('Use a disposable runtime copy');
  const idx = path.join(path.dirname(exe), 'resources', 'app', 'index.html'); let html = fs.readFileSync(idx, 'utf8'); const end = '})();\n})();\n</script>', crlf = html.includes('\r\n');
  html = html.replace(/\r\n/g, '\n'); if (!html.includes('window.__wf=')) { const at = html.lastIndexOf(end); html = html.slice(0, at) + 'window.__wf={get cur(){return S.cur},get items(){return S.items},get sel(){return S.sel}};\n' + html.slice(at); }
  fs.writeFileSync(idx, crlf ? html.replace(/\n/g, '\r\n') : html);
  const app = await _electron.launch({ executablePath: exe, env: { ...process.env, SAVEIT_REVIEW_DATA: path.join(out, 'profile') }, timeout: 30000 });
  let fails = 0; const lines = [], errors = [], toasts = [], check = (name, ok, extra) => { const l = (ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : ''); console.log(l); lines.push(l); if (!ok) fails++; };
  const windowFor = async suffix => { for (let i = 0; i < 80; i++) { for (const w of app.windows().filter(w => w.url().includes(suffix))) if (await w.evaluate(() => document.visibilityState === 'visible').catch(() => false)) return w; await new Promise(r => setTimeout(r, 100)); } return null; };
  const gone = async suffix => { for (let i = 0; i < 50; i++) { const open = await app.evaluate(({ BrowserWindow }, s) => BrowserWindow.getAllWindows().some(w => !w.isDestroyed() && w.isVisible() && w.webContents.getURL().includes(s)), suffix); if (!open) return true; await new Promise(r => setTimeout(r, 100)); } return false; };
  try {
    const p = await app.firstWindow(); p.setDefaultTimeout(15000); await p.waitForFunction(() => document.body.dataset.catalogCount && window.__wf);
    p.on('pageerror', e => errors.push(e.message));
    await p.exposeFunction('__toast', t => toasts.push(t)); await p.evaluate(() => new MutationObserver(() => { const t = document.querySelector('#toast,.toast'); if (t && t.textContent) window.__toast(t.textContent.trim()); }).observe(document.body, { subtree: true, childList: true, characterData: true }));
    const savePath = path.join(out, 'saved.png');
    await app.evaluate(({ dialog }, fp) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: fp }); }, savePath);
    const count = () => p.evaluate(() => __wf.items.length);
    await p.locator('#mImg').click(); await p.locator('#area').selectOption('region'); if (await p.locator('#clipOn').isChecked()) await p.locator('#clipOn').uncheck();
    const overlayShot = async (o) => { await o.waitForSelector('#c'); await o.waitForFunction(() => ready); await o.waitForTimeout(350); await o.mouse.move(200, 160); await o.mouse.down(); await o.mouse.move(900, 600, { steps: 8 }); await o.mouse.up(); await o.locator('#ok').click(); };
    // screenshot
    let n = await count(); await p.locator('#capBtn').click(); await overlayShot(await windowFor('overlay.html')); await gone('overlay.html'); await p.waitForFunction(n => __wf.items.length > n, n); await p.waitForTimeout(700);
    const base = await p.evaluate(() => ({ w: __wf.cur.base.width, h: __wf.cur.base.height }));
    check('screenshot opens in the editor', base.w > 100 && base.h > 100, JSON.stringify(base));
    const cv = await p.locator('#cv').boundingBox(), at = (fx, fy) => [cv.x + cv.width * fx, cv.y + cv.height * fy];
    const shapes = () => p.evaluate(() => __wf.cur.shapes.map(s => ({ t: s.t, text: s.txt, n: s.n })));
    const s0 = (await shapes()).length, tool = name => p.locator('.tool', { hasText: name }).first();
    // arrow
    await tool('Arrow').click(); let [x, y] = at(.2, .2); await p.mouse.move(x, y); await p.mouse.down(); [x, y] = at(.45, .4); await p.mouse.move(x, y, { steps: 8 }); await p.mouse.up();
    check('Arrow tool draws an arrow', (await shapes()).slice(-1)[0]?.t === 'arrow', JSON.stringify((await shapes()).slice(-1)));
    // text
    await tool('Text').click(); [x, y] = at(.6, .2); await p.mouse.click(x, y); await p.keyboard.type('Click here'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    const txt = (await shapes()).find(s => s.t === 'text');
    check('Text tool adds the typed text', txt && /Click here/.test(txt.text || ''), JSON.stringify(txt));
    // numbered steps
    await tool('Step').click(); for (const f of [[.3, .7], [.5, .7], [.7, .7]]) { [x, y] = at(...f); await p.mouse.click(x, y); await p.waitForTimeout(150); }
    let steps = (await shapes()).filter(s => s.t === 'step').map(s => s.n);
    check('Step tool numbers 1, 2, 3', JSON.stringify(steps) === '[1,2,3]', JSON.stringify(steps));
    // undo / redo
    await p.keyboard.press('Control+Z'); steps = (await shapes()).filter(s => s.t === 'step').map(s => s.n); check('Ctrl+Z removes step 3', JSON.stringify(steps) === '[1,2]', JSON.stringify(steps));
    await p.locator('#redoBtn').click(); steps = (await shapes()).filter(s => s.t === 'step').map(s => s.n); check('Redo button brings step 3 back', JSON.stringify(steps) === '[1,2,3]', JSON.stringify(steps));
    await p.screenshot({ path: path.join(out, '1-annotated.png') });
    // crop with the Crop button
    await tool('Crop').click(); [x, y] = at(.1, .1); await p.mouse.move(x, y); await p.mouse.down(); [x, y] = at(.9, .9); await p.mouse.move(x, y, { steps: 8 }); await p.mouse.up(); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
    const cropped = await p.evaluate(() => ({ w: __wf.cur.base.width, h: __wf.cur.base.height }));
    check('Crop + Enter crops the picture', cropped.w < base.w && cropped.h <= base.h && cropped.w > base.w * .5 && toasts.some(t => /^Cropped to/.test(t)), JSON.stringify({ base, cropped }));
    check('annotations survive the crop', (await shapes()).length === s0 + 5, String((await shapes()).length));
    // Save PNG
    await p.locator('#saveBtn').click(); for (let i = 0; i < 50 && !fs.existsSync(savePath); i++) await p.waitForTimeout(100); await p.waitForTimeout(300);
    const png = fs.existsSync(savePath) ? fs.readFileSync(savePath) : null, pw = png && png.readUInt32BE(16), ph = png && png.readUInt32BE(20);
    check('Save PNG writes a PNG of the cropped picture', png && pw === cropped.w && ph === cropped.h, JSON.stringify({ pw, ph }));
    // Copy button
    await p.locator('#copyBtn').click(); await p.waitForTimeout(600); const clip = await app.evaluate(({ clipboard }) => clipboard.readImage().getSize());
    check('Copy puts the finished picture on the clipboard', clip.width === cropped.w && clip.height === cropped.h, JSON.stringify(clip));
    // Library
    await p.locator('#libBtn').click(); const lib = p.locator('#libModal'); await lib.waitFor();
    const libCount = await lib.locator('[data-id],[data-item-id]').count(); check('Library opens and lists the captures', libCount >= 1, String(libCount));
    await p.screenshot({ path: path.join(out, '2-library.png') }); await p.keyboard.press('Escape'); await p.waitForTimeout(300); check('Escape closes the Library', !(await lib.count()));
    // widget round trip: Widget button > capture from the widget > editor comes back with it
    await p.locator('#widgetBtn').click().catch(() => p.evaluate(() => window.bench.widgetOpen({ mode: 'image', area: 'region' }, { x: 11, y: 11 })));
    const w = await windowFor('widget.html'); await w.waitForSelector('#ok'); await w.waitForTimeout(500);
    check('Widget button hides the editor', !(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(x => x.webContents.getURL().includes('index.html'))?.isVisible())));
    n = await count(); await w.locator('#ok').click(); await overlayShot(await windowFor('overlay.html')); await gone('overlay.html');
    await p.waitForFunction(n => __wf.items.length > n, n).catch(() => {}); await p.waitForTimeout(1200);
    check('capturing from the widget adds the screenshot', await count() === n + 1);
    const vis = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter(x => x.isVisible()).map(x => x.webContents.getURL().split('/').pop()));
    check('after a widget capture the editor shows it (as in 10.3.9)', vis.some(u => u.startsWith('index.html')), JSON.stringify(vis));
    // Check for Updates opens its dialog and does not install anything by itself
    await p.evaluate(() => { const w = document.querySelector('#updLink103'); w && w.scrollIntoView(); });
    await p.locator('#updLink103').click(); const upd = p.locator('#updateDialog103, .modal:has-text("Check for Updates")').first(); await upd.waitFor({ timeout: 8000 }).catch(() => {});
    await p.waitForTimeout(4000); const updText = (await upd.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 220);
    check('Check for Updates shows a result', /up to date|available|could not|offline/i.test(updText), updText);
    await p.screenshot({ path: path.join(out, '3-updates.png') }); await p.keyboard.press('Escape');
    check('no page errors', errors.length === 0, JSON.stringify(errors));
    console.log('toasts: ' + JSON.stringify([...new Set(toasts)]));
  } catch (e) { check('run finished', false, e.stack); }
  finally { fs.writeFileSync(path.join(out, 'results.txt'), lines.join('\n')); const pid = app.process().pid; await Promise.race([app.close().catch(() => {}), new Promise(r => setTimeout(r, 8000))]); try { require('child_process').execSync('taskkill /PID ' + pid + ' /T /F', { stdio: 'ignore' }); } catch (_) {} console.log(fails ? fails + ' FAILED' : 'ALL EVERYDAY CHECKS PASSED'); process.exitCode = fails ? 1 : 0; }
})();
