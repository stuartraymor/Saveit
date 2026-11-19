// 10.3.10 real-app checks: right-click capture in the region selector, the widget's Copy to clipboard option by
// mode, and the taskbar identity of the installed shortcuts (read only). Real Electron, disposable profile.
// node tests/native-gui-10310.cjs <Saveit.exe of a runtime copy whose resources/app is the app under test> <evidence folder>
'use strict';
const { _electron } = require('playwright'), fs = require('fs'), path = require('path');
(async () => {
  const [exe, out] = process.argv.slice(2); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  if (/appdata\\local\\programs\\saveit\\/i.test(exe)) throw Error('Use a disposable runtime copy');
  const app = await _electron.launch({ executablePath: exe, env: { ...process.env, SAVEIT_REVIEW_DATA: path.join(out, 'profile') }, timeout: 30000 });
  let fails = 0; const lines = [], check = (name, ok, extra) => { const l = (ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : ''); console.log(l); lines.push(l); if (!ok) fails++; };
  const windowFor = async suffix => { for (let i = 0; i < 80; i++) { for (const w of app.windows().filter(w => w.url().includes(suffix))) if (await w.evaluate(() => document.visibilityState === 'visible').catch(() => false)) return w; await new Promise(r => setTimeout(r, 100)); } return null; };
  const gone = async suffix => { for (let i = 0; i < 50; i++) { const open = await app.evaluate(({ BrowserWindow }, s) => BrowserWindow.getAllWindows().some(w => !w.isDestroyed() && w.isVisible() && w.webContents.getURL().includes(s)), suffix); if (!open) return true; await new Promise(r => setTimeout(r, 100)); } return false; };
  try {
    const p = await app.firstWindow(); p.setDefaultTimeout(15000); await p.waitForFunction(() => document.body.dataset.catalogCount);
    const count = () => p.evaluate(() => document.querySelectorAll('#thumbs [data-item-id]').length);
    await p.locator('#mImg').click(); await p.locator('#area').selectOption('region'); if (await p.locator('#clipOn').isChecked()) await p.locator('#clipOn').uncheck();
    const open = async () => { await p.locator('#capBtn').click(); const o = await windowFor('overlay.html'); await o.waitForSelector('#c'); await o.waitForFunction(() => ready); await o.waitForTimeout(350); return o; };

    // 1. right-click before any selection: nothing is captured, no empty screenshot
    let n0 = await count(), o = await open();
    await o.mouse.click(300, 300, { button: 'right' });
    check('right-click before selecting closes the selector', await gone('overlay.html'));
    await p.waitForTimeout(800); check('right-click before selecting adds no screenshot', await count() === n0, `${n0} -> ${await count()}`);

    // 2. right-click inside a finished selection captures it once, at the selected size
    n0 = await count(); o = await open();
    await o.mouse.move(200, 200); await o.mouse.down(); await o.mouse.move(520, 380, { steps: 10 }); await o.mouse.up();
    const sel = await o.evaluate(() => ({ ...sel })); await o.screenshot({ path: path.join(out, 'selection.png') });
    await o.mouse.click(360, 290, { button: 'right' }); await o.mouse.click(360, 290, { button: 'right' }).catch(() => {}); // a double right-click must not capture twice
    check('right-click on a selection captures and closes the selector', await gone('overlay.html'));
    await p.waitForFunction(n => document.querySelectorAll('#thumbs [data-item-id]').length > n, n0).catch(() => {});
    await p.waitForTimeout(800); const n1 = await count();
    check('exactly one screenshot is added', n1 === n0 + 1, `${n0} -> ${n1}`);
    const imgSize = () => p.evaluate(() => { const m = /Image\s+(\d+)\s*[×x]\s*(\d+)/.exec(document.body.innerText); return m ? { w: +m[1], h: +m[2] } : null; });
    const rc = await imgSize(), overlayScale = null;
    // the same selection taken with the Capture button: right-click must give the identical result
    o = await open(); await o.mouse.move(200, 200); await o.mouse.down(); await o.mouse.move(520, 380, { steps: 10 }); await o.mouse.up();
    const K = await o.evaluate(() => K()); await o.locator('#ok').click(); await gone('overlay.html'); await p.waitForTimeout(1000);
    const ok = await imgSize();
    check('right-click gives the same picture size as the Capture button', rc && ok && rc.w === ok.w && rc.h === ok.h, JSON.stringify({ sel, rightClick: rc, captureButton: ok }));
    check('picture size = selection x screen pixel ratio', rc && Math.abs(rc.w - Math.round(sel.w * K)) <= 2 && Math.abs(rc.h - Math.round(sel.h * K)) <= 2, JSON.stringify({ K, sel, rc }));
    await p.screenshot({ path: path.join(out, 'editor-after-right-click.png') });

    // 3. the widget shows Copy to clipboard only for screenshots; the editor's Clipboard option is unchanged
    await p.evaluate(() => window.bench.widgetOpen({ mode: 'image', area: 'region' }, { x: 11, y: 11 }));
    const w = await windowFor('widget.html'); await w.waitForSelector('#mImg'); await w.waitForTimeout(500);
    const vis = () => w.evaluate(() => { const l = document.getElementById('oClip').closest('label'); return !l.hidden && !!l.offsetParent; });
    check('widget Image mode shows Copy to clipboard', await vis());
    await w.click('#mVid'); await w.waitForTimeout(200); check('widget Video mode hides Copy to clipboard', !(await vis()));
    await w.click('#mAud'); await w.waitForTimeout(200); check('widget Audio mode hides Copy to clipboard', !(await vis()));
    await w.click('#mImg'); await w.waitForTimeout(200); check('widget back to Image shows it again', await vis());
    await w.screenshot({ path: path.join(out, 'widget-image.png') });
    await w.click('#hide').catch(() => {});
    // 10.3.11: the editor's bar matches the widget: Copy to clipboard is for screenshots only
    for (const [m, shown] of [['#mImg', true], ['#mVid', false], ['#mAud', false]]) { await p.locator(m).click(); check('editor top bar Copy to clipboard matches the widget in ' + m.slice(2), await p.locator('#clipOn').count() === 1 && await p.locator('#clipOn').isVisible() === shown); }
    await p.locator('#mImg').click();

    // 4. taskbar identity: installed shortcuts that start Saveit carry the same AppUserModelID as the app (read only)
    const ids = await app.evaluate(({ shell }) => { const rq = process.mainModule.require, fs = rq('fs'), path = rq('path'), os = rq('os'), found = [];
      const roots = [path.join(process.env.APPDATA, 'Microsoft/Windows/Start Menu/Programs'), path.join(os.homedir(), 'Desktop'), path.join(process.env.APPDATA, 'Microsoft/Internet Explorer/Quick Launch/User Pinned/TaskBar')];
      const walk = d => { let es = []; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return; } for (const e of es) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (/\.lnk$/i.test(e.name)) { try { const l = shell.readShortcutLink(f); if (/\\saveit\.exe$/i.test(l.target || '')) found.push({ file: path.basename(f), id: l.appUserModelId || '' }); } catch (_) {} } } };
      roots.forEach(walk); return found; });
    const mainId = /const SAVEIT_AUMID = '([^']+)'/.exec(fs.readFileSync(path.join(path.dirname(exe), 'resources/app/main.js'), 'utf8'))?.[1];
    const setId = /setAppUserModelId\(['"]([^'"]+)/.exec(fs.readFileSync(path.join(path.dirname(exe), 'resources/app/main.js'), 'utf8'))?.[1];
    check('the app and its shortcut repair use the same AppUserModelID', mainId && mainId === setId, `${setId} / ${mainId}`);
    lines.push('installed Saveit shortcuts: ' + JSON.stringify(ids));
    console.log('installed Saveit shortcuts:', JSON.stringify(ids));
  } catch (e) { check('run', false, e.stack); }
  finally { fs.writeFileSync(path.join(out, 'results.txt'), lines.join('\n')); try { await app.evaluate(({ app }) => { app.isQuitting = true; }); } catch (_) {} await Promise.race([app.close().catch(() => {}), new Promise(r => setTimeout(r, 5000))]); }
  console.log(fails ? fails + ' FAILED' : 'ALL GUI CHECKS PASSED'); process.exitCode = fails ? 1 : 0;
})();
