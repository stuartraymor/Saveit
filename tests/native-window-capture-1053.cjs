// 10.5.3 Window capture in the real app: ordinary, borderless, covered, maximized, minimized and closed windows (issue A).
// node tests/native-window-capture-1053.cjs <disposable runtime Saveit.exe> <evidence folder>
// Runs on one display without moving the real mouse (see native-driver.cjs; SAVEIT_TEST_DISPLAY picks the display).
'use strict';
const { launch, buildFixture } = require('./native-driver.cjs'); const cp = require('child_process'), path = require('path'), fs = require('fs');
const PS_SHOW = (hwnd, cmd) => cp.execFileSync('powershell', ['-NoProfile', '-Command', `Add-Type -Namespace W -Name U -MemberDefinition '[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int c);'; [W.U]::ShowWindow([IntPtr]${hwnd},${cmd}) | Out-Null`]);
(async () => { const t = await launch({ exe: process.argv[2], out: process.argv[3], extraMain: 'globalThis.__rv={grabWindow,listWindowSources};' }); const { app, p, check } = t; const procs = [], fixExe = buildFixture(t.out);
  const phys = r => app.evaluate(({ screen }, r) => screen.dipToScreenRect(null, r), r);
  const fix = async (r, title, extra) => { const q = await phys(r); const c = cp.spawn(fixExe, [q.x, q.y, q.width, q.height, title, extra || ''].map(String), { stdio: ['ignore', 'pipe', 'ignore'] }); procs.push(c);
    const hwnd = await new Promise((res, rej) => { c.stdout.once('data', d => res(String(d).trim())); setTimeout(() => rej(Error('fixture did not start')), 8000); }); await t.sleep(500); return { hwnd, proc: c, phys: q }; };
  const colors = (url) => p.evaluate(u => new Promise(res => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); const px = (x, y) => [...g.getImageData(Math.round(x), Math.round(y), 1, 1).data].slice(0, 3).join(',');
    res({ w: i.width, h: i.height, bl: px(i.width * .25, i.height - 24), br: px(i.width * .75, i.height - 24), tl: px(i.width * .25, i.height * .3), tr: px(i.width * .75, i.height * .3) }); }; i.src = u; }), url);
  const good = c => c.bl === '0,0,255' && c.br === '255,255,0' && c.tl === '255,0,0' && c.tr === '0,255,0';
  const bounds = h => app.evaluate((_, h) => process.mainModule.require('./window-capture.js').windowBounds('window:' + h + ':0').catch(e => ({ err: e.message })), h);
  try {
    const wa = t.small.workArea;
    const A = await fix({ x: wa.x + 60, y: wa.y + 80, width: 620, height: 380 }, 'SvFix Normal');
    const B = await fix({ x: wa.x + 700, y: wa.y + 90, width: 401, height: 277 }, 'SvFix Flat', 'borderless');
    for (const [name, F] of [['SvFix Normal', A], ['SvFix Flat', B]]) {
      const cap = p.evaluate(() => window.bench.capture('window', 0, {}).then(r => ({ url: r && r.url, area: r && r.area }), e => ({ err: e.message })));
      const pk = await t.find('picker.html'); if (!pk) { check(name + ': picker opens', false); continue; }
      await pk.waitForFunction(() => document.querySelectorAll('.card').length > 0);
      const card = pk.locator('.card', { hasText: name }); check(name + ': listed in the picker', await card.count() === 1);
      const t0 = Date.now(); await card.click(); const r = await cap; const ms = Date.now() - t0;
      if (r.err || !r.url) { check(name + ': captured', false, r.err); continue; }
      const c = await colors(r.url), b = await bounds(F.hwnd);
      check(name + ': picture is exactly the visible frame', c.w === b.width && c.h === b.height, `${c.w}x${c.h} frame ${b.width}x${b.height} in ${ms} ms`);
      check(name + ': its own content', good(c), JSON.stringify(c));
      await t.sleep(500);
      check(name + ': editor shows the capture', await p.evaluate(() => !!window.__wf.cur && window.__wf.cur.kind === 'image'));
    }
    const grab = hwnd => app.evaluate(async (_, h) => { try { const i = await globalThis.__rv.grabWindow('window:' + h + ':0'); return { url: i.toDataURL(), method: i.captureMethod }; } catch (e) { return { err: e.message }; } }, hwnd);
    const C = await fix({ x: wa.x + 100, y: wa.y + 100, width: 600, height: 400 }, 'SvFix Cover', 'borderless');
    { const r = await grab(A.hwnd); const c = r.url ? await colors(r.url) : {}; check('covered window: its own content, not what is in front', !!r.url && good(c), r.err || r.method + ' ' + JSON.stringify(c)); }
    C.proc.kill(); await t.sleep(300);
    const M = await fix({ x: wa.x + 80, y: wa.y + 60, width: 500, height: 300 }, 'SvFix Max');
    PS_SHOW(M.hwnd, 3); await t.sleep(700);
    { const r = await grab(M.hwnd); const c = r.url ? await colors(r.url) : {}; const b = await bounds(M.hwnd);
      check('maximized window: exact frame and content', !!r.url && c.w === b.width && c.h === b.height && good(c), r.err || `${c.w}x${c.h} frame ${b.width}x${b.height} ` + JSON.stringify(c)); }
    PS_SHOW(M.hwnd, 6); await t.sleep(700);
    { const r = await grab(M.hwnd); const c = r.url ? await colors(r.url) : {}; check('minimized window: restored and captured', !!r.url && good(c), r.err || JSON.stringify(c)); }
    M.proc.kill();
    { let ok = 0; const t0 = Date.now(); for (let i = 0; i < 15; i++) { const r = await grab(A.hwnd); if (r.url) ok++; } check('15 captures in a row', ok === 15, Math.round((Date.now() - t0) / 15) + ' ms each'); }
    B.proc.kill(); await t.sleep(400);
    { const r = await grab(B.hwnd); check('closed window: says so', /closed/.test(r.err || ''), r.err || 'no error'); }
    { const cap = p.evaluate(() => window.bench.capture('window', 0, {}).then(r => ({ ok: !!r }), e => ({ err: e.message })));
      const pk = await t.find('picker.html'); await pk.waitForFunction(() => document.querySelectorAll('.card').length > 0); const card = pk.locator('.card', { hasText: 'SvFix Normal' });
      A.proc.kill(); await t.sleep(400); await card.click(); const r = await cap; check('closed after the picker opened: clear message', /closed/.test(r.err || ''), JSON.stringify(r));
      await t.sleep(600); const w = await t.wins(); check('editor is back after the failure', w.some(x => x.url === 'index.html' && x.visible)); }
    { const cap = p.evaluate(() => window.bench.capture('window', 0, {}).then(r => ({ r }), e => ({ err: e.message }))); const pk = await t.find('picker.html'); await t.sleep(500);
      // a second capture asked for while the picker is open (hotkey pressed twice) is ignored: no second screen on top
      const second = await p.evaluate(() => Promise.race([window.bench.capture('region', 0, {}).then(r => ({ r }), e => ({ err: e.message })), new Promise(res => setTimeout(() => res({ timeout: true }), 3000))]));
      const ovs = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter(w => w.isVisible() && w.webContents.getURL().includes('overlay.html')).length);
      check('a second capture while the picker is open is ignored', second.r === null && ovs === 0, JSON.stringify(second) + ' selection screens: ' + ovs);
      await pk.keyboard.press('Escape').catch(() => {}); const r = await cap; check('Esc in the picker cancels', r.r === null, JSON.stringify(r).slice(0, 80)); }
    check('no page errors', !t.errors.length, t.errors.join(' | ').slice(0, 300));
  } catch (e) { check('test ran to the end', false, String(e && e.stack || e).slice(0, 500));
  } finally { for (const c of procs) try { c.kill(); } catch (_) {} await t.finish(); }
})().catch(e => { console.error(e); process.exit(1); });
