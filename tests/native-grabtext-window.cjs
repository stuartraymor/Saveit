// 10.4.2 Grab Text window, in the real app with a real mouse:
//  - capture widget, Selection > Grab text, Grab text: the region selector opens in Grab text mode (box can be adjusted), and
//    Grab text opens the Grab Text window with the text AND the editor with the picture
//  - the Grab Text window is not in the picture of the next capture
//  - editing tools: bold, find and replace, text tools, table, copy all (text and formatting)
//  - Save to library only when asked; saving again updates the same item; the Library shows it under Text and opens it again
//  - closing the window keeps Saveit running; Saveit still quits
// node tests/native-grabtext-window.cjs <runtime Saveit.exe> <evidence folder>
'use strict';
const { _electron } = require('playwright'), fs = require('fs'), path = require('path');
(async () => {
  const [exe, out] = process.argv.slice(2); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  if (/appdata\\local\\programs\\saveit\\/i.test(exe)) throw Error('Use a disposable runtime copy');
  const idx = path.join(path.dirname(exe), 'resources', 'app', 'index.html'); let html = fs.readFileSync(idx, 'utf8'); const end = '})();\n})();\n</script>', crlf = html.includes('\r\n');
  html = html.replace(/\r\n/g, '\n'); if (!html.includes('window.__wf=')) { const at = html.lastIndexOf(end); if (at < 0) throw Error('probe point not found'); html = html.slice(0, at) + 'window.__wf={get cur(){return S.cur},get items(){return S.items},get tool(){return S.tool}};\n' + html.slice(at); }
  if (!html.includes('window.__wfdb=')) { const at = html.lastIndexOf(end); html = html.slice(0, at) + 'window.__wfdb=id=>dbRead(id);\n' + html.slice(at); }
  fs.writeFileSync(idx, crlf ? html.replace(/\n/g, '\r\n') : html);
  const app = await _electron.launch({ executablePath: exe, env: { ...process.env, SAVEIT_REVIEW_DATA: path.join(out, 'profile') }, timeout: 30000 });
  let fails = 0; const lines = [], check = (name, ok, extra) => { const l = (ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : ''); console.log(l); lines.push(l); if (!ok) fails++; };
  const errors = [];
  const wins = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(w => ({ url: w.webContents.getURL().split('/').pop(), visible: w.isVisible() })));
  const find = async (name, visible) => { for (let i = 0; i < 150; i++) { for (const w of app.windows().filter(w => w.url().includes(name))) { if (!visible) return w; const v = await w.evaluate(() => document.visibilityState === 'visible').catch(() => false); if (v) return w; } await new Promise(r => setTimeout(r, 200)); } return null; };
  let lastKey = '';
  const grabbed = async () => { const w = await find('textedit.html'); if (!w) throw Error('no Grab Text window'); w.on('pageerror', e => errors.push('textedit: ' + e.message));
    await w.waitForFunction(k => typeof entry !== 'undefined' && entry && entry.key !== k && document.body.dataset.state === 'ready', lastKey, { timeout: 30000, polling: 250 }); lastKey = await w.evaluate(() => entry.key); return w; };
  try {
    const p = await app.firstWindow(); p.setDefaultTimeout(20000); p.on('pageerror', e => errors.push(e.message));
    await p.waitForFunction(() => document.body.dataset.catalogCount && window.__wf);
    // a window with text on the screen
    const target = await app.evaluate(async ({ BrowserWindow, screen }) => { const wa = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
      const w = new BrowserWindow({ x: wa.x + 100, y: wa.y + 120, width: 600, height: 190, frame: false, alwaysOnTop: true, show: false, backgroundColor: '#ffffff' });
      w.setAlwaysOnTop(true, 'screen-saver'); global.__ocrTarget = w;
      await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<body style="margin:0;padding:16px;font:15px 'Segoe UI',sans-serif"><table cellpadding="6" style="border-collapse:collapse"><tr style="font-weight:600"><td>Order</td><td>Item</td><td>Total</td></tr><tr><td>A-1007</td><td>Desk lamp</td><td>$84.00</td></tr><tr><td>A-1008</td><td>Monitor stand</td><td>$129.99</td></tr></table></body>`));
      w.showInactive(); await new Promise(r => setTimeout(r, 400)); return w.getBounds(); });

    // 1. widget > Grab text
    await p.evaluate(() => window.bench.widgetOpen({ mode: 'image', area: 'region' }, { x: 11, y: 11 }));
    const wg = await find('widget.html', true); check('widget opens', !!wg);
    await wg.waitForSelector('#area', { state: 'visible' });
    await wg.locator('#area').selectOption('text');
    check('widget: Selection > Grab text turns Capture into Grab text', /grab text/i.test(await wg.locator('#ok').innerText()), await wg.locator('#ok').innerText());
    await wg.screenshot({ path: path.join(out, 'widget.png') });
        await wg.locator('#ok').click();
    const ov = await find('overlay.html', true); if (!ov) throw Error('no region selector on the screen');
    await ov.waitForFunction(() => ready, null, { polling: 100 }); await ov.waitForTimeout(300);
    check('the region selector opens in Grab text mode', (await ov.locator('#area').inputValue()) === 'text' && /grab text/i.test(await ov.locator('#ok').innerText()), await ov.locator('#ok').innerText());
    const ob = await ov.evaluate(() => ({ x: screenX, y: screenY })), ox = target.x - ob.x, oy = target.y - ob.y;
    // draw a box that is too small, then adjust it by dragging its bottom-right corner
    await ov.mouse.move(ox + 4, oy + 4); await ov.mouse.down(); await ov.mouse.move(ox + 200, oy + 60, { steps: 6 }); await ov.mouse.up();
    await ov.waitForTimeout(150);
    await ov.mouse.move(ox + 200, oy + 60); await ov.mouse.down(); await ov.mouse.move(ox + target.width - 4, oy + target.height - 4, { steps: 8 }); await ov.mouse.up();
    const sel = await ov.evaluate(() => sel); check('the box can be adjusted before grabbing', sel && sel.w > 500 && sel.h > 150, JSON.stringify(sel));
    await ov.screenshot({ path: path.join(out, 'selector.png') }).catch(() => {});
    const nItems = await p.evaluate(() => window.__wf.items.length);
    const t0 = Date.now(); await ov.locator('#ok').click();
    const tw = await grabbed(); const ms = Date.now() - t0;
    const text = await tw.evaluate(() => plain()); fs.writeFileSync(path.join(out, 'grab.txt'), text);
    check('the Grab Text window shows the text', /A-1007\s+Desk lamp\s+\$84\.00/.test(text) && /Monitor stand/.test(text), JSON.stringify(text));
    check('the text is ready within 5 s of pressing Grab text', ms < 5000, ms + ' ms');
    const st = await wins();
    check('the Grab Text window and the editor are both open', st.some(s => s.url === 'textedit.html' && s.visible) && st.some(s => s.url === 'index.html' && s.visible), JSON.stringify(st));
    check('the editor has the grabbed picture open', (await p.evaluate(() => window.__wf.items.length)) === nItems + 1 && (await p.evaluate(() => window.__wf.cur?.kind)) === 'image');
    check('the picture is shown beside the text', await tw.evaluate(() => !document.getElementById('pic').hidden && document.getElementById('picImg').naturalWidth > 100));
    check('nothing is saved to the library as text yet', (await p.evaluate(() => window.__wf.items.filter(i => i.kind === 'text').length)) === 0);
    
    await tw.screenshot({ path: path.join(out, 'textwindow.png') });

    // 2. editing tools
    await tw.evaluate(() => { const d = document.getElementById('doc'), r = document.createRange(); const w = document.createTreeWalker(d, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const i = n.data.indexOf('Order'); if (i >= 0) { r.setStart(n, i); r.setEnd(n, i + 5); break; } } getSelection().removeAllRanges(); getSelection().addRange(r); });
    await tw.locator('[data-cmd=bold]').click();
    check('Bold makes the selected word bold', await tw.evaluate(() => /font-weight:\s*bold|<b>Order/.test(document.getElementById('doc').innerHTML)));
    await tw.keyboard.press('Control+h'); await tw.locator('#fq').fill('Desk lamp'); await tw.locator('#fr').fill('Table lamp');
    check('Find counts the matches', /1 found|1 of 1/.test(await tw.locator('#findCount').innerText()), await tw.locator('#findCount').innerText());
    await tw.locator('#frepAll').click();
    check('Replace all changes the text', await tw.evaluate(() => plain().includes('Table lamp') && !plain().includes('Desk lamp')));
    await tw.keyboard.press('Escape');
    check('Ctrl+Z undoes the replacement', await (async () => { await tw.locator('#doc').click(); await tw.keyboard.press('Control+z'); return tw.evaluate(() => plain().includes('Desk lamp')); })());
    await tw.keyboard.press('Control+y');
    await tw.evaluate(() => getSelection().removeAllRanges());
    await tw.locator('#table').click();
    check('Table turns the columns into a table', await tw.evaluate(() => document.querySelectorAll('#doc table tr').length >= 3 && document.querySelectorAll('#doc table tr')[1].children.length === 3), await tw.evaluate(() => document.getElementById('doc').innerHTML.slice(0, 200)));
    await tw.locator('#copyAll').click(); await tw.waitForTimeout(300);
    const clip = await app.evaluate(({ clipboard }) => ({ text: clipboard.readText(), html: clipboard.readHTML() }));
    check('Copy all puts the text on the clipboard', /A-1007\s+Table lamp\s+\$84\.00/.test(clip.text), JSON.stringify(clip.text.slice(0, 80)));
    check('Copy all also puts the formatting (a table) on the clipboard', /<table/i.test(clip.html));
    await tw.locator('#tools').click(); await tw.locator('.menu button', { hasText: 'UPPERCASE' }).click();
    check('Text tools > UPPERCASE works', await tw.evaluate(() => plain().includes('TABLE LAMP')));
    await tw.keyboard.press('Control+z');
    check('counts show words and lines', /\d+ words · \d+ characters · \d+ lines/.test(await tw.locator('#counts').innerText()), await tw.locator('#counts').innerText());

    // 3. Save to library
    check('the window says the text is not saved yet', /not saved/i.test(await tw.locator('#state').innerText()));
    await tw.locator('#name').fill('Orders from the screen');
    await tw.locator('#saveLib').click();
    await tw.waitForFunction(() => /saved in the library/i.test(document.getElementById('state').innerText), null, { polling: 200 });
    let saved = await p.evaluate(() => window.__wf.items.filter(i => i.kind === 'text').map(i => ({ id: i.id, name: i.name, text: i.text })));
    check('Save to library adds one text item', saved.length === 1 && saved[0].name === 'Orders from the screen' && saved[0].text.includes('Table lamp'), JSON.stringify(saved).slice(0, 200));
    const rec = await p.evaluate(id => window.__wfdb(id), saved[0].id);
    check('the text item is stored (survives a restart)', rec && rec.kind === 'text' && rec.text.includes('Table lamp') && /<table/i.test(rec.html) && !!rec.thumb);
    await tw.locator('#doc').click(); await tw.keyboard.press('Control+End'); await tw.keyboard.type(' Paid');
    check('after an edit the window says the changes are not saved', /not saved/i.test(await tw.locator('#state').innerText()) && /save changes/i.test(await tw.locator('#saveLib').innerText()));
    await tw.keyboard.press('Control+s');
    await tw.waitForFunction(() => /saved in the library/i.test(document.getElementById('state').innerText), null, { polling: 200 });
    saved = await p.evaluate(() => window.__wf.items.filter(i => i.kind === 'text').map(i => ({ id: i.id, text: i.text })));
    check('Ctrl+S saves the change into the same item', saved.length === 1 && saved[0].text.includes('Paid'));

    // 4. the Grab Text window stays out of the next capture
    await app.evaluate(() => { global.__ocrTarget.destroy(); });
    await p.evaluate(() => { window.__capP = window.bench.capture('region', 0, { confirm: true }); });
    const ov2 = await find('overlay.html', true); await ov2.waitForFunction(() => ready, null, { polling: 100 });
    const during = await wins();
    check('the Grab Text window is hidden while a capture is taken', !during.some(s => s.url === 'textedit.html' && s.visible), JSON.stringify(during));
    await ov2.keyboard.press('Escape').catch(() => {}); await p.evaluate(() => window.__capP);
    await p.waitForTimeout(500);
    check('it comes back when the capture is done', (await wins()).some(s => s.url === 'textedit.html' && s.visible));

    // 5. Library > Text, open the saved text again
    await tw.close().catch(() => {}); // the window's close button only hides it
    await p.waitForTimeout(400);
    check('closing the Grab Text window keeps Saveit running', !p.isClosed() && !(await wins()).some(s => s.url === 'textedit.html' && s.visible));
    await p.evaluate(() => { const b = document.querySelector('#libBtn'); b.click(); });
    await p.locator('#libModal').waitFor();
    const chip = await p.locator('#libChips [data-f=text]').innerText();
    check('Library has a Text filter with the saved text', /Text · 1/.test(chip), chip);
    await p.locator('#libChips [data-f=text]').click();
    const card = p.locator('#libGrid .card, #libGrid > div').filter({ hasText: 'Orders from the screen' }).first();
    await p.screenshot({ path: path.join(out, 'library-text.png') });
    await card.dblclick();
    const tw2 = await find("textedit.html", true); if (!tw2) throw Error("the Grab Text window did not come back"); await tw2.waitForFunction(id => entry && entry.libId === id && document.body.dataset.state === "ready", saved[0].id, { polling: 250 }); const t2 = await tw2.evaluate(() => ({ text: plain(), name: document.getElementById('name').value, state: document.getElementById('state').innerText, table: !!document.querySelector('#doc table') }));
    check('opening it from the Library shows it in the Grab Text window', t2.text.includes('Paid') && t2.name === 'Orders from the screen' && t2.table && /saved in the library/i.test(t2.state), JSON.stringify(t2).slice(0, 200));
    check('the editor still shows the picture (a text item does not replace it)', (await p.evaluate(() => window.__wf.cur?.kind)) === 'image');
    check('no page errors', errors.length === 0, errors.join(' | '));
    // 6. quit
    const pid = app.process().pid;
    await app.evaluate(({ app }) => { app.isQuitting = true; app.quit(); });
    let gone = false; for (let i = 0; i < 40 && !gone; i++) { await new Promise(r => setTimeout(r, 250)); try { process.kill(pid, 0); } catch (_) { gone = true; } }
    check('Saveit quits with the Grab Text window open', gone);
  } catch (e) { check('test ran to the end', false, e.stack); }
  fs.writeFileSync(path.join(out, 'results.txt'), lines.join('\n') + `\n${fails ? fails + ' FAILED' : 'ALL PASS'}\n`);
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  try { const pid = app.process().pid; require('child_process').execSync('taskkill /PID ' + pid + ' /T /F', { stdio: 'ignore' }); } catch (_) {}
  process.exitCode = fails ? 1 : 0;
})();
