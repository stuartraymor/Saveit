// 10.2.2: the small red button at the bottom right of the capture widget puts the widget away without opening the editor or quitting Saveit.
// Real Electron 33, disposable profile. node tests/native-widget-hide1022.cjs <Saveit.exe of a runtime copy whose resources/app is the app under test> <evidence folder>
const { _electron } = require('playwright'), fs = require('fs'), path = require('path');
(async () => {
  const [exe, out] = process.argv.slice(2); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  const app = await _electron.launch({ executablePath: exe, env: { ...process.env, SAVEIT_REVIEW_DATA: path.join(out, 'profile') }, timeout: 30000 });
  let fails = 0; const check = (name, ok, extra) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails++; };
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(15000); await page.waitForFunction(() => document.body.dataset.catalogCount);
    const widgetPage = async () => { for (let i = 0; i < 40; i++) { const w = app.windows().find(x => x.url().includes('widget.html')); if (w) return w; await new Promise(r => setTimeout(r, 250)); } return null; };
    const state = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(w => ({ url: w.webContents.getURL().split('/').pop(), visible: w.isVisible(), destroyed: w.isDestroyed() })));
    for (let round = 1; round <= 2; round++) {
      await page.evaluate(() => window.bench.widgetOpen({ mode: 'image', area: 'region' }, { x: 11, y: 11 }));
      const w = await widgetPage(); check(`round ${round}: widget opens`, !!w); if (!w) break;
      await w.waitForSelector('#hide', { state: 'visible' }); await w.waitForTimeout(600);
      const g = await w.evaluate(() => {
        const r = e => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom } }, h = r(document.getElementById('hide')), bar = r(document.getElementById('bar')), cs = getComputedStyle(document.getElementById('hide'));
        const overlaps = [...document.querySelectorAll('#bar button, #bar select, #bar label, #bar input')].filter(e => e.id !== 'hide' && e.offsetParent && (() => { const b = r(e); return b.l < h.r && b.r > h.l && b.t < h.b && b.b > h.t })()).map(e => e.id || e.tagName);
        return { h, bar, bg: cs.backgroundColor, w: h.r - h.l, hh: h.b - h.t, label: document.getElementById('hide').textContent, overlaps, vw: innerWidth, vh: innerHeight };
      });
      check(`round ${round}: button is red and small`, g.bg === 'rgb(229, 72, 59)' && g.w >= 40 && g.w <= 80 && g.hh >= 22, `${g.bg} ${g.w}x${g.hh}`);
      check(`round ${round}: button says Close`, g.label === 'Close', g.label);
      check(`round ${round}: button is in the bottom right corner`, g.h.r > g.vw - 16 && g.h.b > g.vh - 16, JSON.stringify(g.h) + ' view ' + g.vw + 'x' + g.vh);
      check(`round ${round}: button covers no other control`, g.overlaps.length === 0, g.overlaps.join(','));
      await w.screenshot({ path: path.join(out, `widget-${round}.png`) });
      const before = await state(), editorBefore = before.find(s => s.url.includes('index.html'));
      await w.click('#hide');
      await new Promise(r => setTimeout(r, 600));
      const after = await state(), editorAfter = after.find(s => s.url.includes('index.html'));
      check(`round ${round}: widget is gone after the click`, !after.some(s => s.url.includes('widget.html') && !s.destroyed));
      check(`round ${round}: editor was not opened by it`, !!editorAfter && editorAfter.visible === editorBefore.visible && !editorAfter.visible, JSON.stringify({ before: editorBefore.visible, after: editorAfter && editorAfter.visible }));
      check(`round ${round}: Saveit is still running`, (await app.evaluate(({ app }) => !app.isQuitting)) === true && !page.isClosed());
    }
    // Escape still goes to the editor (unchanged behaviour)
    await page.evaluate(() => window.bench.widgetOpen({ mode: 'image', area: 'region' }, { x: 11, y: 11 }));
    const w2 = await widgetPage(); await w2.waitForSelector('#bar'); await w2.keyboard.press('Escape'); await new Promise(r => setTimeout(r, 600));
    const st = await state(); check('Escape still brings the editor back', st.find(s => s.url.includes('index.html')).visible === true);
  } catch (e) { console.log('ERROR', e.message); fails++; } finally { try { app.process().kill(); } catch (_) { } }
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
