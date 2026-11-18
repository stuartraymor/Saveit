// 10.3.11 real-app check: the floating widget is a copy of the editor's capture bar. For Image, Video and Audio it
// compares every shared control: shown or hidden, its size, and its position relative to the Capture button.
// Screenshots of both bars per mode go to the evidence folder.
// node tests/native-bar-parity.cjs <Saveit.exe of a disposable runtime copy> <evidence folder>
'use strict';
const { _electron } = require('playwright'), fs = require('fs'), path = require('path');
(async () => {
  const [exe, out] = process.argv.slice(2); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  if (/appdata\\local\\programs\\saveit\\/i.test(exe)) throw Error('Use a disposable runtime copy');
  const app = await _electron.launch({ executablePath: exe, env: { ...process.env, SAVEIT_REVIEW_DATA: path.join(out, 'profile') }, timeout: 30000 });
  let fails = 0; const lines = [], check = (name, ok, extra) => { const l = (ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : ''); console.log(l); lines.push(l); if (!ok) fails++; };
  const windowFor = async suffix => { for (let i = 0; i < 80; i++) { const w = app.windows().find(w => w.url().includes(suffix)); if (w) return w; await new Promise(r => setTimeout(r, 100)); } return null; };
  // shared controls: [name, editor selector, widget selector]
  const CTRL = [['Capture button', '#capBtn', '#ok'], ['Image', '#mImg', '#mImg'], ['Video', '#mVid', '#mVid'], ['Audio', '#mAud', '#mAud'],
    ['Selection', '#area', '#area'], ['Cursor', '#cursorOn', '#oCur'], ['Copy to clipboard', '#clipOn', '#oClip'], ['Delay', '#delay', '#delay'],
    ['Effect', '#fxSel', '#fxSel'], ['Effect settings', '#fxGear', '#fxGear'], ['System audio', '#sysAudio', '#oSys'], ['Microphone', '#mic', '#oMic'],
    ['Microphone device', '#micPick', '#micDev'], ['Webcam', '#camOn', '#oCam'], ['Webcam device', '#camPick', '#camDev'], ['Webcam settings', '#camGear', '#camGear']];
  const measure = (page, sels, anchor) => page.evaluate(([sels, anchor]) => { const a = document.querySelector(anchor).getBoundingClientRect(), o = {};
    for (const [n, s] of sels) { const e = document.querySelector(s); if (!e) { o[n] = null; continue; } const t = e, r = t.getBoundingClientRect(), shown = !!t.offsetParent && r.width > 0;
      o[n] = shown ? { x: Math.round(r.left - a.left), y: Math.round(r.top - a.top), w: Math.round(r.width), h: Math.round(r.height), text: (t.innerText || '').trim().slice(0, 30) } : 'hidden'; }
    // audio-mode controls are built by the same shared script in both bars
    for (const [i, e] of [...document.querySelectorAll('.abar98 button, .abar98 select, .abar98 label, [class*=amic] select, [class*=amic] button')].entries()) { const r = e.getBoundingClientRect(); if (!e.offsetParent || !r.width) continue; o['audio#' + i + ' ' + (e.innerText || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 24)] = { x: Math.round(r.left - a.left), y: Math.round(r.top - a.top), w: Math.round(r.width), h: Math.round(r.height) }; }
    return o; }, [sels, anchor]);
  try {
    const p = await app.firstWindow(); p.setDefaultTimeout(15000); await p.waitForFunction(() => document.body.dataset.catalogCount);
    const report = {}, MODES = ['Img', 'Vid', 'Aud'];
    for (const mode of MODES) { await p.locator('#m' + mode).click(); await p.waitForTimeout(2500);
      report[mode] = { editor: await measure(p, CTRL.map(c => [c[0], c[1]]), '#capBtn') };
      const bar = await p.evaluate(() => { const r = document.querySelector('.tleft').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
      await p.screenshot({ path: path.join(out, `editor-${mode}.png`), clip: bar }); }
    await p.locator('#mImg').click();
    await p.evaluate(() => window.bench.widgetOpen({ mode: 'image', area: 'region' }, { x: 11, y: 11 }));
    const w = await windowFor('widget.html'); await w.waitForSelector('#mImg'); await w.waitForTimeout(600);
    for (const mode of MODES) { await w.click('#m' + mode); await w.waitForTimeout(2500);
      const E = report[mode].editor, W = report[mode].widget = await measure(w, CTRL.map(c => [c[0], c[2]]), '#ok');
      await w.screenshot({ path: path.join(out, `widget-${mode}.png`) });
      for (const k of new Set([...Object.keys(E), ...Object.keys(W)])) {
        const e = E[k], v = W[k];
        if (e === 'hidden' || v === 'hidden' || !e || !v) { check(`${mode}: ${k} shown/hidden the same`, (e === 'hidden' || !e) === (v === 'hidden' || !v), `editor ${JSON.stringify(e)} widget ${JSON.stringify(v)}`); continue; }
        check(`${mode}: ${k} same size and place`, Math.abs(e.x - v.x) <= 2 && Math.abs(e.y - v.y) <= 2 && Math.abs(e.w - v.w) <= 2 && Math.abs(e.h - v.h) <= 2, `editor ${JSON.stringify(e)} widget ${JSON.stringify(v)}`);
      }
    }
    fs.writeFileSync(path.join(out, 'bar-parity.json'), JSON.stringify(report, null, 1));
  } catch (e) { check('run finished', false, e.stack); }
  finally { fs.writeFileSync(path.join(out, 'results.txt'), lines.join('\n')); const pid = app.process().pid; await Promise.race([app.close().catch(() => {}), new Promise(r => setTimeout(r, 8000))]); try { require('child_process').execSync('taskkill /PID ' + pid + ' /T /F', { stdio: 'ignore' }); } catch (_) {} console.log(fails ? fails + ' FAILED' : 'ALL BAR PARITY CHECKS PASSED'); process.exitCode = fails ? 1 : 0; }
})();
