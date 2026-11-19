// 10.3.12 Grab Text in the real app, as a person would use it: paste a screenshot (Ctrl+V), press O for Grab Text, then
// (1) click "Read whole image" and (2) drag a box with the mouse. The grabbed text must keep table rows, read a sidebar column by
// column, show $ amounts and tidy code, and be copied to the clipboard when "Copy to clipboard" is on. Real Electron, real mouse and
// keyboard, disposable profile, runtime copy only.
// node tests/native-grabtext-10312.cjs <runtime Saveit.exe> <folder with ocr-bench pictures> <evidence folder>
'use strict';
const { _electron } = require('playwright'), fs = require('fs'), path = require('path');
(async () => {
  const [exe, pics, out] = process.argv.slice(2); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  if (/appdata\\local\\programs\\saveit\\/i.test(exe)) throw Error('Use a disposable runtime copy');
  const idx = path.join(path.dirname(exe), 'resources', 'app', 'index.html'); let html = fs.readFileSync(idx, 'utf8'); const end = '})();\n})();\n</script>', crlf = html.includes('\r\n');
  html = html.replace(/\r\n/g, '\n'); if (!html.includes('window.__wf=')) { const at = html.lastIndexOf(end); if (at < 0) throw Error('probe point not found'); html = html.slice(0, at) + 'window.__wf={get cur(){return S.cur},get items(){return S.items},get tool(){return S.tool}};\n' + html.slice(at); }
  fs.writeFileSync(idx, crlf ? html.replace(/\n/g, '\r\n') : html);
  const app = await _electron.launch({ executablePath: exe, env: { ...process.env, SAVEIT_REVIEW_DATA: path.join(out, 'profile') }, timeout: 30000 });
  let fails = 0; const lines = [], check = (name, ok, extra) => { const l = (ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : ''); console.log(l); lines.push(l); if (!ok) fails++; };
  const errors = [];
  try {
    const p = await app.firstWindow(); p.setDefaultTimeout(20000); p.on('pageerror', e => errors.push(e.message));
    await p.waitForFunction(() => document.body.dataset.catalogCount && window.__wf);
    const paste = async file => {
      const before = await p.evaluate(() => window.__wf.items.length);
      await app.evaluate(({ clipboard, nativeImage }, f) => clipboard.writeImage(nativeImage.createFromPath(f)), file);
      // with a picture open, Ctrl+V adds a layer to it (10.3.11); with the Library open it adds a new picture
      await p.locator('#libBtn').click(); await p.locator('#libModal').waitFor(); await p.evaluate(() => document.activeElement?.blur());
      // Ctrl+V while the Library window is open does not reach the page's paste handler here, so the same paste event is sent with the picture file
      const b64 = fs.readFileSync(file).toString('base64');
      await p.evaluate(async b64 => { const blob = await (await fetch('data:image/png;base64,' + b64)).blob(), dt = new DataTransfer(); dt.items.add(new File([blob], 'screenshot.png', { type: 'image/png' }));
        document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, b64);
      try { await p.waitForFunction(n => window.__wf.items.length > n && window.__wf.cur?.kind === 'image', before);
        if (await p.locator('#libModal').count()) { await p.keyboard.press('Escape'); await p.locator('#libModal').waitFor({ state: 'detached' }); } }
      catch (e) { await p.screenshot({ path: path.join(out, 'paste-failed.png') }); throw Error('paste did not add the picture: ' + JSON.stringify(await p.evaluate(() => ({ active: document.activeElement?.id || document.activeElement?.tagName, visible: document.visibilityState, toasts: [...document.querySelectorAll('.toast')].map(t => t.innerText), modal: [...document.querySelectorAll('.modal')].map(m => m.id || m.innerText.slice(0, 80)), items: window.__wf.items.length, formats: 0 })))); }
      await p.waitForTimeout(400);
    };
    const grabbed = async () => { await p.locator('#grabbedText35 #ocrText').waitFor({ timeout: 30000 }); const t = await p.locator('#ocrText').inputValue(); return t; };
    const closeText = async () => { await p.keyboard.press('Escape'); await p.locator('#grabbedText35').waitFor({ state: 'detached' }); };
    // turn on "Copy to clipboard" (Image mode), as many people have it
    if (!(await p.locator('#clipOn').isChecked())) await p.locator('#clipWrap').click();
    check('Copy to clipboard is on in Image mode', await p.locator('#clipOn').isChecked());

    // 1. a table, Read whole image
    await paste(path.join(pics, 'table@1x.png'));
    await p.locator('#cv').click({ position: { x: 5, y: 5 } }).catch(() => {}); await p.keyboard.press('o');
    check('O picks the Grab Text tool', (await p.evaluate(() => window.__wf.tool)) === 'ocr');
    await p.locator('#readWhole35').click(); let t0 = Date.now(); let text = await grabbed(); const ms = Date.now() - t0;
    fs.writeFileSync(path.join(out, 'table.txt'), text); await p.screenshot({ path: path.join(out, 'table-result.png') });
    const rows = text.split('\n').filter(Boolean);
    check('table: one line per table row', rows.length === 4, JSON.stringify(rows));
    check('table: cells of a row stay on that row, apart', /INV-2041\s+Northwind Traders\s+2026-11-03\s+\$1,284\.50/.test(text), rows[1]);
    check('table: $ amounts read with the $ sign', /\$1,284\.50/.test(text) && /\$12,005\.75/.test(text));
    check('table: result appears within 5 s', ms < 5000, ms + ' ms');
    const clip = await app.evaluate(({ clipboard }) => clipboard.readText());
    // Windows keeps clipboard text with CRLF line ends
    check('the text is on the clipboard', clip.replace(/\r\n/g, '\n').trim() === text.trim(), JSON.stringify(clip.slice(0, 80)));
    await closeText();

    // 2. a sidebar beside a page, by dragging a box with the mouse over the whole picture
    await paste(path.join(pics, 'sidebar@1x.png'));
    await p.locator('#cv').click({ position: { x: 5, y: 5 } }).catch(() => {}); await p.keyboard.press('o');
    const box = await p.locator('#cv').boundingBox();
    await p.mouse.move(box.x + 2, box.y + 2); await p.mouse.down(); await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 }); await p.mouse.move(box.x + box.width - 2, box.y + box.height - 2, { steps: 6 }); await p.mouse.up();
    text = await grabbed(); fs.writeFileSync(path.join(out, 'sidebar.txt'), text); await p.screenshot({ path: path.join(out, 'sidebar-result.png') });
    const sl = text.split('\n').map(s => s.trim()).filter(Boolean);
    check('sidebar (box dragged with the mouse): the side column is read first, then the page, not mixed line by line',
      sl.join('|') === 'Dashboard|Projects|Reports|Welcome back, Taylor|You have 4 tasks due today|Next meeting: 2:30 PM', JSON.stringify(sl));
    // Join lines button
    await p.locator('#grabbedText35 [data-a=one]').click();
    check('Join lines makes one line', !(await p.locator('#ocrText').inputValue()).includes('\n'));
    await closeText();

    // 3. code at 200% display scaling: punctuation is not spaced out, web address is whole
    await paste(path.join(pics, 'code@2x.png'));
    await p.locator('#cv').click({ position: { x: 5, y: 5 } }).catch(() => {}); await p.keyboard.press('o');
    await p.locator('#readWhole35').click(); text = await grabbed(); fs.writeFileSync(path.join(out, 'code.txt'), text);
    check('code: the web address comes out whole', text.includes('fetch("https://api.example.com/v2/orders?id=1048");'), text.split('\n')[2]);
    check('code: comment line is read', text.includes('// TODO: handle errors (#231)'));
    await closeText();

    // 4. a part of a picture: drag a box around only the second line of the paragraph
    await paste(path.join(pics, 'paragraph@1x.png'));
    await p.locator('#cv').click({ position: { x: 5, y: 5 } }).catch(() => {}); await p.keyboard.press('o');
    const b2 = await p.locator('#cv').boundingBox(), img = await p.evaluate(() => ({ w: window.__wf.cur.base.width, h: window.__wf.cur.base.height }));
    const sx = b2.width / img.w, sy = b2.height / img.h; // paragraph text: 3 lines, about 22 px apart starting near y=18
    await p.mouse.move(b2.x + 8 * sx, b2.y + 40 * sy); await p.mouse.down(); await p.mouse.move(b2.x + (img.w - 4) * sx, b2.y + 61 * sy, { steps: 8 }); await p.mouse.up();
    text = await grabbed(); fs.writeFileSync(path.join(out, 'paragraph-line2.txt'), text);
    check('a box around one line reads just that line', text.trim() === 'Press Print Screen to capture a region, or Shift + Print Screen', JSON.stringify(text));
    await closeText();

    check('no page errors', errors.length === 0, errors.join(' | '));
  } catch (e) { check('test ran to the end', false, e.stack); }
  fs.writeFileSync(path.join(out, 'results.txt'), lines.join('\n') + `\n${fails ? fails + ' FAILED' : 'ALL PASS'}\n`);
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  const pid = app.process().pid; await Promise.race([app.close().catch(() => {}), new Promise(r => setTimeout(r, 8000))]); try { require('child_process').execSync('taskkill /PID ' + pid + ' /T /F', { stdio: 'ignore' }); } catch (_) {}
  process.exitCode = fails ? 1 : 0;
})();
