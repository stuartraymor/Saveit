// 10.5.3 Scrolling capture in the real app: no effects controls (issue B), scrolling up adds content (issue C), the outline stays (issue D).
// node tests/native-scroll-1053.cjs <disposable runtime Saveit.exe> <evidence folder>
// Runs on one display without moving the real mouse (see native-driver.cjs; SAVEIT_TEST_DISPLAY picks the display).
'use strict';
// Scrolling capture in the real app: no effects controls, the outline stays, scrolling up and down both add content.
const { launch } = require('./native-driver.cjs'); const path = require('path'), fs = require('fs');
(async () => { const t = await launch({ exe: process.argv[2], out: process.argv[3] }); const { app, p, check } = t;
  try {
    const wa = t.small.workArea, d = t.small.bounds, FX = { x: wa.x + 80, y: wa.y + 110, width: 640, height: 420 };
    await app.evaluate(async ({ BrowserWindow }, b) => { const w = new BrowserWindow({ ...b, frame: false, show: false, backgroundColor: '#ffffff', webPreferences: { backgroundThrottling: false } }); global.__fx = w; w.setAlwaysOnTop(true, 'floating');
      const html = '<body style="margin:0;font:16px/26px Segoe UI"><style>::-webkit-scrollbar{display:none}</style>' + Array.from({ length: 200 }, (_, i) => '<div style="height:26px;padding-left:12px;background:hsl(' + (i * 37 % 360) + ',70%,' + (88 - i % 3 * 6) + '%)">Row number ' + i + ' of the long test page ' + '#'.repeat(i % 23) + '</div>').join('') + '</body>';
      await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html)); w.setBounds(b); w.showInactive(); await w.webContents.executeJavaScript('scrollTo(0,1560);new Promise(r=>setTimeout(r,300))'); }, FX);
    const scrollTo = y => app.evaluate(({}, y) => global.__fx.webContents.executeJavaScript('scrollTo(0,' + y + ');new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(scrollY))))'), y);
    await p.evaluate(() => { window.__cap = window.bench.capture('scroll', 0, { area: 'scroll', mode: 'image' }).then(r => ({ url: r && r.url, area: r && r.area, note: r && r.note, fx: r && r.settings && r.settings.fx }), e => ({ err: e.message })); });
    const ov = await t.findOverlay(); check('selection screen opens', !!ov);
    const vis = sel => ov.evaluate(s => { const e = document.querySelector(s); return !!e && e.getClientRects().length > 0 && !e.hidden; }, sel);
    check('Selection shows Scrolling', await ov.evaluate(() => document.getElementById('area').value) === 'scroll');
    const x0 = FX.x - d.x + 12, y0 = FX.y - d.y + 10, x1 = FX.x - d.x + FX.width - 12, y1 = FX.y - d.y + FX.height - 10;
    await ov.mouse.move(x0, y0); await ov.mouse.down(); await ov.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 4 }); await ov.mouse.move(x1, y1, { steps: 4 }); await ov.mouse.up(); await t.sleep(250);
    check('no effects controls for Scrolling (issue B)', !(await vis('#fxRow')) && !(await vis('.fxadd')), 'fxRow visible: ' + await vis('#fxRow'));
    check('button says Start scrolling', (await ov.locator('#ok').innerText()) === 'Start scrolling', await ov.locator('#ok').innerText());
    check('still Scrolling after selecting', await ov.evaluate(() => document.getElementById('area').value) === 'scroll');
    await ov.screenshot({ path: path.join(t.out, 'overlay-scroll.png') });
    // effects are still there for an ordinary region
    const setArea = v => ov.evaluate(v => { const a = document.getElementById('area'); a.value = v; a.onchange(); }, v); await setArea('region'); await t.sleep(150); check('effects controls still shown for Region', await vis('#fxRow'));
    await setArea('scroll'); await t.sleep(150); check('and hidden again for Scrolling', !(await vis('#fxRow')));
    await ov.locator('#ok').click();
    const bar = await t.find('manual.html'); check('scrolling bar opens', !!bar);
    const frame = () => app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Saveit Scrolling Area' || /Scrolling Area/.test(w.getTitle())) || BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && w.webContents.getURL().startsWith('data:text/html') && w.webContents.getURL().includes('dashed')); return w ? { visible: w.isVisible(), b: w.getBounds(), top: w.isAlwaysOnTop() } : null; });
    await t.sleep(700); const f0 = await frame();
    const want = { x: Math.round(x0) + d.x - 3, y: Math.round(y0) + d.y - 3, width: Math.round(x1 - x0) + 6, height: Math.round(y1 - y0) + 6 };
    check('dashed outline is shown around the selected area (issue D)', !!f0 && f0.visible && f0.top && Math.abs(f0.b.x - want.x) <= 2 && Math.abs(f0.b.y - want.y) <= 2 && Math.abs(f0.b.width - want.width) <= 3 && Math.abs(f0.b.height - want.height) <= 3, JSON.stringify(f0) + ' want ' + JSON.stringify(want));
    await bar.screenshot({ path: path.join(t.out, 'bar-start.png') });
    const states = []; let gone = 0; const st = async () => { states.push(await bar.locator('#state').innerText()); const f = await frame(); if (!f || !f.visible) gone++; };
    await t.sleep(600);
    // up first (issue C), in uneven steps; then the fixture takes the keyboard (focus change); then down past the start
    for (const y of [1500, 1380, 1200, 1190, 900, 640, 610, 300, 120, 0]) { await scrollTo(y); await t.sleep(230); await st(); }
    const upStates = states.slice(); const hUp = await bar.locator('#size').innerText();
    await app.evaluate(() => { global.__fx.focus(); }); await t.sleep(900); await st();
    for (const y of [300, 700, 1100, 1500, 1800, 2050, 2300, 2420, 2700, 2800]) { await scrollTo(y); await t.sleep(230); await st(); }
    for (const y of [2000, 2800, 1000, 0]) { await scrollTo(y); await t.sleep(230); await st(); } // back through what is already there
    check('scrolling up adds content from the first movement (issue C)', upStates.every(s => /Adding new content/.test(s)), [...new Set(upStates)].join(' | ') + '  height after going up: ' + hUp);
    check('never "Can\'t line this up"', !states.some(s => /line this up|problem/i.test(s)), states.map((x,i)=>i+':'+x.slice(0,9)).join(' '));
    check('outline stayed visible the whole time, through a focus change (issue D)', gone === 0, gone + ' checks without it');
    await bar.screenshot({ path: path.join(t.out, 'bar-end.png') });
    await bar.locator('#finish').click();
    const r = await p.evaluate(() => window.__cap);
    check('capture finishes', !!r.url && !r.err, r.err || '');
    if (r.url) {
      fs.writeFileSync(path.join(t.out, 'result.png'), Buffer.from(r.url.split(',')[1], 'base64'));
      const info = await p.evaluate(u => new Promise(res => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0);
        const rowHue = y => { const q = g.getImageData(Math.round(i.width * .97), y, 1, 1).data; return q[0] + ',' + q[1] + ',' + q[2]; };
        let teal = 0; for (const x of [0, 1, i.width - 1, i.width - 2]) for (let y = 0; y < i.height; y += 7) { const q = g.getImageData(x, y, 1, 1).data; if (Math.abs(q[0] - 45) < 12 && Math.abs(q[1] - 179) < 12 && Math.abs(q[2] - 160) < 12) teal++; }
        // every 26-px page row has its own colour: count colour changes down the picture
        let bands = 1, prev = rowHue(0); for (let y = 1; y < i.height; y++) { const h = rowHue(y); if (h !== prev) { bands++; prev = h; } }
        res({ w: i.width, h: i.height, teal, bands }); }; i.src = u; }), r.url);
      const sf = t.small.sf, expH = Math.round((y1 - y0) * sf) + 2800 * sf;
      check('picture has everything from the top of the page to the lowest point reached', Math.abs(info.h - expH) <= 6, `${info.w}x${info.h}, expected height about ${expH}`);
      const expBands = Math.round((2800 + (y1 - y0)) / 26);
      check('no repeated or missing rows', Math.abs(info.bands - expBands) <= 2, info.bands + ' colour bands, expected about ' + expBands);
      check('outline is not in the picture', info.teal === 0, info.teal + ' outline-coloured edge pixels');
      check('no effects applied to the scrolling capture', !r.fx || !r.fx.length);
      console.log('     note: ' + (r.note || '(none)'));
    }
    await t.sleep(500);
    check('outline and bar are gone afterwards', !(await frame()) && !(await t.find('manual.html', 3)));
    check('result opens in the editor', await p.evaluate(() => !!window.__wf.cur && window.__wf.cur.kind === 'image'));
    check('no page errors', !t.errors.length, t.errors.join(' | ').slice(0, 300));
  } finally { await t.finish(); }
})().catch(e => { console.error(e); process.exit(1); });
