// 10.3.11 real-app workflow, as a person would do it: take two screenshots, right-click the first one in the bottom
// strip and choose Copy, then paste it on top of the second one in the editor (right-click > Paste, and Ctrl+V), move
// it, undo/redo, and copy the finished picture. Real Electron, disposable profile, runtime copy only.
// node tests/native-workflow-paste-layer.cjs <runtime Saveit.exe> <evidence folder>
'use strict';
const { _electron } = require('playwright'), fs = require('fs'), path = require('path');
(async () => {
  const [exe, out] = process.argv.slice(2); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  if (/appdata\\local\\programs\\saveit\\/i.test(exe)) throw Error('Use a disposable runtime copy');
  // read-only probe so the test can see the editor state; the copy under test is patched, never the source
  const idx = path.join(path.dirname(exe), 'resources', 'app', 'index.html'); let html = fs.readFileSync(idx, 'utf8'); const end = '})();\n})();\n</script>', crlf = html.includes('\r\n');
  html = html.replace(/\r\n/g, '\n'); if (!html.includes('window.__wf=')) { const at = html.lastIndexOf(end); if (at < 0) throw Error('probe point not found'); html = html.slice(0, at) + 'window.__wf={get cur(){return S.cur},get items(){return S.items},get sel(){return S.sel}};\n' + html.slice(at); }
  fs.writeFileSync(idx, crlf ? html.replace(/\n/g, '\r\n') : html);
  const app = await _electron.launch({ executablePath: exe, env: { ...process.env, SAVEIT_REVIEW_DATA: path.join(out, 'profile') }, timeout: 30000 });
  let fails = 0; const lines = [], check = (name, ok, extra) => { const l = (ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : ''); console.log(l); lines.push(l); if (!ok) fails++; };
  const windowFor = async suffix => { for (let i = 0; i < 80; i++) { for (const w of app.windows().filter(w => w.url().includes(suffix))) if (await w.evaluate(() => document.visibilityState === 'visible').catch(() => false)) return w; await new Promise(r => setTimeout(r, 100)); } return null; };
  const gone = async suffix => { for (let i = 0; i < 50; i++) { const open = await app.evaluate(({ BrowserWindow }, s) => BrowserWindow.getAllWindows().some(w => !w.isDestroyed() && w.isVisible() && w.webContents.getURL().includes(s)), suffix); if (!open) return true; await new Promise(r => setTimeout(r, 100)); } return false; };
  const toasts = [];
  try {
    const p = await app.firstWindow(); p.setDefaultTimeout(15000); await p.waitForFunction(() => document.body.dataset.catalogCount && window.__wf);
    await p.exposeFunction('__toast', t => toasts.push(t)).catch(() => {});
    await p.evaluate(() => { new MutationObserver(() => { const t = document.querySelector('#toast,.toast'); if (t && t.textContent) window.__toast(t.textContent.trim()); }).observe(document.body, { subtree: true, childList: true, characterData: true }); });
    const count = () => p.evaluate(() => document.querySelectorAll('#thumbs [data-item-id]').length);
    await p.locator('#mImg').click(); await p.locator('#area').selectOption('region'); if (await p.locator('#clipOn').isChecked()) await p.locator('#clipOn').uncheck();
    const shoot = async (x0, y0, x1, y1) => { const n = await count(); await p.locator('#capBtn').click(); const o = await windowFor('overlay.html'); await o.waitForSelector('#c'); await o.waitForFunction(() => ready); await o.waitForTimeout(350);
      await o.mouse.move(x0, y0); await o.mouse.down(); await o.mouse.move(x1, y1, { steps: 8 }); await o.mouse.up(); await o.locator('#ok').click(); await gone('overlay.html');
      await p.waitForFunction(n => document.querySelectorAll('#thumbs [data-item-id]').length > n, n); await p.waitForTimeout(700); return p.evaluate(() => ({ id: __wf.cur.id, w: __wf.cur.base.width, h: __wf.cur.base.height })); };
    // 1. two screenshots
    const A = await shoot(150, 150, 400, 330), B = await shoot(300, 200, 900, 650);
    const n2 = await count(); console.log('strip count after two shots', n2);
    check('two screenshots taken, the second is open', A.id !== B.id && await p.evaluate(() => __wf.cur.id) === B.id, JSON.stringify({ A, B }));
    const aBefore = await p.evaluate(id => JSON.stringify(__wf.items.find(i => i.id === id).shapes.map(s => [s.t, s.x1, s.y1, s.x2, s.y2])), A.id);
    // 2. right-click the first one in the bottom strip > Copy
    const thumbA = p.locator(`#thumbs [data-item-id="${A.id}"]`); await thumbA.scrollIntoViewIfNeeded(); await thumbA.click({ button: 'right' });
    const menu = p.locator('.capture-menu'); await menu.waitFor(); const rows = await menu.locator('button').allInnerTexts();
    check('thumbnail menu offers a Copy', rows.some(r => /^Copy( image)?\b/.test(r)), JSON.stringify(rows.map(r => r.split('\n')[0])));
    await menu.locator('button', { hasText: /^Copy/ }).first().click(); await p.waitForTimeout(600);
    check('copying from the strip does not switch the open picture', await p.evaluate(() => __wf.cur.id) === B.id);
    const clip = await app.evaluate(({ clipboard }) => { const i = clipboard.readImage(); return i.isEmpty() ? null : i.getSize(); });
    check('the clipboard holds the first screenshot at full size', clip && clip.width === A.w && clip.height === A.h, JSON.stringify(clip));
    // 3. right-click the open picture > Paste
    const box = await p.locator('#cv').boundingBox(); const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    const shapes = () => p.evaluate(() => __wf.cur.shapes.map(s => ({ t: s.t, x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2 })));
    const s0 = (await shapes()).length;
    await p.mouse.click(cx, cy, { button: 'right' }); await menu.waitFor(); const rows2 = (await menu.locator('button').allInnerTexts()).map(r => r.split('\n')[0]);
    check('picture menu offers Paste', rows2.includes('Paste'), JSON.stringify(rows2));
    await menu.locator('button[aria-label="Paste"]').click(); await p.waitForFunction(n => __wf.cur.shapes.length > n, s0).catch(() => {});
    let sh = await shapes(); const L = sh[sh.length - 1];
    check('pasted as a picture layer on top of the open screenshot', sh.length === s0 + 1 && L.t === 'img' && await p.evaluate(() => __wf.cur.id) === B.id, JSON.stringify(L));
    check('pasted layer keeps its real size and sits inside the picture', L && L.x2 - L.x1 === A.w && L.y2 - L.y1 === A.h && L.x1 >= 0 && L.y1 >= 0 && L.x2 <= B.w && L.y2 <= B.h, JSON.stringify({ L, A, B }));
    check('pasted layer is selected, ready to move', await p.evaluate(() => __wf.sel && __wf.sel.t === 'img'));
    await p.screenshot({ path: path.join(out, '1-pasted.png') });
    // 4. drag it somewhere else
    const z = await p.evaluate(() => { const c = document.getElementById('cv'), r = c.getBoundingClientRect(); return r.width / __wf.cur.base.width; });
    const lx = box.x + (L.x1 + L.x2) / 2 * z, ly = box.y + (L.y1 + L.y2) / 2 * z;
    await p.mouse.move(lx, ly); await p.mouse.down(); await p.mouse.move(lx - 60 * z, ly - 40 * z, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(300);
    sh = await shapes(); const M = sh[sh.length - 1];
    check('dragging moves the pasted layer', M && Math.abs((M.x1 - L.x1) + 60) <= 8 && Math.abs((M.y1 - L.y1) + 40) <= 8, JSON.stringify({ before: L, after: M }));
    // 5. Ctrl+V pastes another copy, which should not hide exactly on top of the first
    await p.mouse.click(box.x + 5, box.y + 5); await p.keyboard.press('Control+V'); await p.waitForFunction(n => __wf.cur.shapes.length > n, s0 + 1).catch(() => {});
    sh = await shapes(); const N = sh[sh.length - 1];
    check('Ctrl+V pastes a second layer onto the same open picture', sh.length === s0 + 2 && N.t === 'img' && await p.evaluate(id => __wf.cur.id === id, B.id), JSON.stringify(N));
    check('Ctrl+V adds nothing to the library', await count() === n2, String(await count()));
    check('the second paste is visibly offset from layers already there', sh.slice(0, -1).filter(s => s.t === 'img').every(s => Math.abs(s.x1 - N.x1) > 8 || Math.abs(s.y1 - N.y1) > 8), JSON.stringify(sh));
    // 6. undo/redo
    await p.keyboard.press('Control+Z'); await p.waitForTimeout(300); check('Ctrl+Z removes the last paste', (await shapes()).length === s0 + 1);
    await p.keyboard.press('Control+Y'); await p.waitForTimeout(300); check('Ctrl+Y brings it back', (await shapes()).length === s0 + 2);
    // 7. copy the finished picture; the first screenshot is untouched
    await p.keyboard.press('Control+Shift+C'); await p.waitForTimeout(800);
    const out2 = await app.evaluate(({ clipboard }) => clipboard.readImage().getSize());
    check('the combined picture copies at the second screenshot size', out2.width === B.w && out2.height === B.h, JSON.stringify(out2));
    const aAfter = await p.evaluate(id => JSON.stringify(__wf.items.find(i => i.id === id).shapes.map(s => [s.t, s.x1, s.y1, s.x2, s.y2])), A.id);
    check('the first screenshot is unchanged', aAfter === aBefore, aAfter);
    await p.screenshot({ path: path.join(out, '2-final.png') });
    console.log('toasts: ' + JSON.stringify([...new Set(toasts)]));
  } catch (e) { check('run finished', false, e.stack); }
  finally { fs.writeFileSync(path.join(out, 'results.txt'), lines.join('\n')); const pid = app.process().pid; await Promise.race([app.close().catch(() => {}), new Promise(r => setTimeout(r, 8000))]); try { require('child_process').execSync('taskkill /PID ' + pid + ' /T /F', { stdio: 'ignore' }); } catch (_) {} console.log(fails ? fails + ' FAILED' : 'ALL WORKFLOW CHECKS PASSED'); process.exitCode = fails ? 1 : 0; }
})();
