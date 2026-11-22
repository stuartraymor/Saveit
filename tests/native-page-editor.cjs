// 10.4.10 page editor (textedit.html) in the real app: Page button, typing, Saveit's right-click menu with spelling
// suggestions, pictures (insert, resize, crop, rotate, wrap, undo), tables, lists, links, Word (.docx) and PDF saving,
// opening the saved .docx again, and pages kept after Saveit restarts.
// node tests/native-page-editor.cjs <disposable runtime Saveit.exe> <evidence folder>
'use strict';
const { _electron } = require('playwright'), fs = require('fs'), path = require('path');
(async () => {
  const [exe, out] = process.argv.slice(2); if (!exe || !out) throw Error('usage: native-page-editor.cjs <Saveit.exe> <out>');
  if (/appdata\\local\\programs\\saveit\\/i.test(exe)) throw Error('Use a disposable runtime copy');
  fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  const profile = path.join(out, 'profile');
  let fails = 0; const lines = [], errors = [];
  const check = (name, ok, extra) => { const l = (ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : ''); console.log(l); lines.push(l); if (!ok) fails++; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const launch = () => _electron.launch({ executablePath: exe, env: { ...process.env, SAVEIT_REVIEW_DATA: profile }, timeout: 30000, bypassCSP: true });
  let app = await launch();
  const quit = async () => { const pid = app.process().pid; await app.evaluate(({ app }) => { app.isQuitting = true; app.quit(); }).catch(() => {}); for (let i = 0; i < 60; i++) { await sleep(250); try { process.kill(pid, 0); } catch (_) { return true; } } return false; };
  const pageWin = async () => { for (let i = 0; i < 150; i++) { const w = app.windows().find(x => x.url().includes('textedit.html')); if (w) return w; await sleep(200); } throw Error('no page window'); };
  try {
    let p = await app.firstWindow(); p.setDefaultTimeout(20000); p.on('pageerror', e => errors.push('editor: ' + e.message));
    await p.waitForFunction(() => document.body.dataset.catalogCount);
    // 1. Page button
    await p.evaluate(() => document.getElementById('pageBtn49').click());
    let w = await pageWin(); w.on('pageerror', e => errors.push('page: ' + e.message)); w.on('console', m => { if (m.type() === 'error') errors.push('page console: ' + m.text()); });
    await w.waitForFunction(() => document.body.dataset.state === 'ready' && typeof entry !== 'undefined' && entry);
    await app.evaluate(({ BrowserWindow }) => { const t = BrowserWindow.getAllWindows().find(x => x.webContents.getURL().includes('textedit')); t.setBounds({ x: 60, y: 40, width: 1180, height: 820 }); t.show(); });
    check('Page opens the page editor with a blank page', await w.evaluate(() => document.getElementById('brandName').textContent === 'Page' && !document.getElementById('doc').innerText.trim()));
    // 2. typing and spelling menu
    await w.click('#doc'); await w.keyboard.type('Quarterly report', { delay: 5 });
    await w.selectOption('#block', 'h1'); await w.keyboard.press('End'); await w.keyboard.press('Enter'); await w.selectOption('#block', 'div');
    await w.keyboard.type('This page has a mispeled word and a list:', { delay: 5 }); await w.keyboard.press('Enter');
    await w.click('[data-cmd=insertUnorderedList]'); await w.keyboard.type('First point'); await w.keyboard.press('Enter'); await w.keyboard.press('Tab'); await w.keyboard.type('Nested point'); await w.keyboard.press('Enter'); await w.keyboard.press('Shift+Tab'); await w.keyboard.type('Third point'); await w.keyboard.press('Enter'); await w.keyboard.press('Enter');
    check('bullets with a nested level (Tab / Shift+Tab)', await w.evaluate(() => { const d = document.getElementById('doc'); return d.querySelectorAll('ul').length >= 2 && /Nested point/.test(d.querySelector('ul ul')?.innerText || ''); }));
    await sleep(1200);
    const box = await w.evaluate(() => { const d = document.getElementById('doc'), tw = document.createTreeWalker(d, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) { const i = n.data.indexOf('mispeled'); if (i >= 0) { const r = document.createRange(); r.setStart(n, i + 2); r.setEnd(n, i + 3); const b = r.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; } } return null; });
    await w.mouse.click(box.x, box.y, { button: 'right' }); await w.waitForSelector('.menu', { timeout: 5000 }).catch(() => {});
    const menu = await w.evaluate(() => [...document.querySelectorAll('.menu button.sugg')].map(b => b.textContent));
    check('right-click on a misspelled word shows suggestions in Saveit\'s menu', menu.includes('misspelled'), JSON.stringify(menu));
    await w.screenshot({ path: path.join(out, '1-spelling-menu.png') });
    await w.locator('.menu button.sugg', { hasText: 'misspelled' }).first().click(); await sleep(300);
    check('choosing a suggestion fixes the word', await w.evaluate(() => /misspelled word/.test(document.getElementById('doc').innerText)));
    // 3. formatting
    await w.keyboard.type('Bold, '); await w.evaluate(() => { const d = document.getElementById('doc'); const last = d.lastElementChild; const r = document.createRange(); r.selectNodeContents(last); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
    await w.keyboard.press('Control+b'); await w.keyboard.type('strong words'); await w.keyboard.press('Control+b'); await w.keyboard.type(' and a link.');
    // 4. picture: insert from file, select, resize, crop, rotate, wrap
    const pngPath = path.join(out, 'fixture.png');
    const dataUrl = await w.evaluate(() => { const c = document.createElement('canvas'); c.width = 800; c.height = 400; const g = c.getContext('2d'); g.fillStyle = '#1565c0'; g.fillRect(0, 0, 400, 400); g.fillStyle = '#f9a825'; g.fillRect(400, 0, 400, 400); g.fillStyle = '#fff'; g.font = 'bold 60px Segoe UI'; g.fillText('LEFT', 120, 220); g.fillText('RIGHT', 500, 220); return c.toDataURL('image/png'); });
    fs.writeFileSync(pngPath, Buffer.from(dataUrl.split(',')[1], 'base64'));
    await w.keyboard.press('Enter');
    await w.evaluate(() => saveSel()); await w.setInputFiles('#picFile', pngPath);
    await w.waitForFunction(() => document.querySelector('#doc img') && !document.getElementById('imgsel').hidden, null, { timeout: 8000 });
    const img0 = await w.evaluate(() => { const i = document.querySelector('#doc img'); return { w: i.getBoundingClientRect().width, nw: i.naturalWidth }; });
    check('Insert > Picture adds the picture, fitted to the page and selected', img0.nw === 800 && img0.w <= 625 && img0.w > 500, JSON.stringify(img0));
    const se = await w.locator('#imgsel .h[data-h=se]').boundingBox();
    await w.mouse.move(se.x + 5, se.y + 5); await w.mouse.down(); await w.mouse.move(se.x - 200, se.y - 40, { steps: 8 }); await w.mouse.up(); await sleep(200);
    const img1 = await w.evaluate(() => { const i = document.querySelector('#doc img'), r = i.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; });
    check('dragging a corner handle resizes and keeps the proportions', img1.w < img0.w - 150 && Math.abs(img1.w / img1.h - 2) < 0.05, JSON.stringify(img1));
    await w.screenshot({ path: path.join(out, '2-picture-selected.png') });
    await w.keyboard.press('Control+z'); await sleep(200);
    check('Undo puts the old size back', await w.evaluate(w0 => Math.abs(document.querySelector('#doc img').getBoundingClientRect().width - w0) < 3, img0.w));
    await w.keyboard.press('Control+y'); await sleep(200);
    await w.evaluate(() => selectImg(document.querySelector('#doc img')));
    await w.click('#imgbar [data-a=crop]'); const cw = await w.locator('#crop .h[data-c=e]').boundingBox(), cr = await w.locator('#crop').boundingBox();
    await w.mouse.move(cw.x + 7, cw.y + 7); await w.mouse.down(); await w.mouse.move(cw.x + 7 - cr.width / 2, cw.y + 7, { steps: 6 }); await w.mouse.up();
    await w.screenshot({ path: path.join(out, '3-cropping.png') });
    await w.click('#imgbar [data-a=cropOk]'); await sleep(300);
    const img2 = await w.evaluate(() => { const i = document.querySelector('#doc img'); return { nw: i.naturalWidth, nh: i.naturalHeight, w: Math.round(i.getBoundingClientRect().width) }; });
    check('crop keeps only the left half of the picture', Math.abs(img2.nw - 400) < 6 && img2.nh === 400, JSON.stringify(img2));
    await w.click('#imgbar [data-a=rot]'); await sleep(300);
    const img3 = await w.evaluate(() => { const i = document.querySelector('#doc img'); return { nw: i.naturalWidth, nh: i.naturalHeight }; });
    check('rotate turns the picture', img3.nw === img2.nh && img3.nh === img2.nw, JSON.stringify(img3));
    await w.click('#imgbar [data-a=w-right]'); await sleep(200);
    check('Wrap right floats the picture right', await w.evaluate(() => getComputedStyle(document.querySelector('#doc img')).float === 'right'));
    // right-click on a picture
    const ib = await w.locator('#doc img').boundingBox(); await w.mouse.click(ib.x + ib.width / 2, ib.y + ib.height / 2, { button: 'right' }); await sleep(400);
    check('right-click on a picture offers picture actions', await w.evaluate(() => [...document.querySelectorAll('.menu button')].some(b => b.textContent === 'Crop')));
    await w.keyboard.press('Escape'); await w.keyboard.press('Escape');
    // 5. table
    await w.evaluate(() => caretToEnd()); await w.keyboard.press('Enter');
    await w.click('[data-tab=insert]'); await w.click('#insTable'); await w.locator('.menu .tgrid i[data-r="1"][data-c="2"]').hover(); await w.locator('.menu .tgrid i[data-r="1"][data-c="2"]').click();
    await w.keyboard.type('Item'); await w.keyboard.press('Tab'); await w.keyboard.type('Qty'); await w.keyboard.press('Tab'); await w.keyboard.type('Price'); await w.keyboard.press('Tab'); await w.keyboard.type('Lamp'); await w.keyboard.press('Tab'); await w.keyboard.type('2'); await w.keyboard.press('Tab'); await w.keyboard.type('$84'); await w.keyboard.press('Tab'); await w.keyboard.type('Desk');
    check('Insert > Table, and Tab in the last cell adds a row', await w.evaluate(() => { const t = document.querySelector('#doc table'); return t && t.rows.length === 3 && t.rows[0].cells.length === 3 && t.rows[2].cells[0].innerText.trim() === 'Desk'; }));
    const cb = await w.locator('#doc table tr:nth-child(1) td:nth-child(1)').boundingBox(); await w.mouse.click(cb.x + 10, cb.y + cb.height / 2, { button: 'right' }); await sleep(300);
    await w.locator('.menu button', { hasText: 'Insert column right' }).click(); await sleep(200);
    check('table right-click: insert column', await w.evaluate(() => document.querySelector('#doc table').rows[0].cells.length === 4));
    await w.keyboard.press('Control+z'); await sleep(150);
    check('Undo removes the inserted column', await w.evaluate(() => document.querySelector('#doc table').rows[0].cells.length === 3));
    // 6. Save as Word and PDF
    await w.evaluate(() => { document.getElementById('name').value = 'Quarterly report'; document.getElementById('name').dispatchEvent(new Event('input')); });
    const docx = path.join(out, 'Quarterly report.docx'), pdf = path.join(out, 'Quarterly report.pdf');
    await app.evaluate(({ dialog }, f) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: f }); }, docx);
    await w.click('#saveAs'); await w.locator('.menu button', { hasText: 'Word document' }).click();
    for (let i = 0; i < 100 && !fs.existsSync(docx); i++) await sleep(100);
    const db = fs.existsSync(docx) ? fs.readFileSync(docx) : Buffer.alloc(0);
    check('Save as Word document writes a .docx', db.length > 2000 && db.slice(0, 2).toString() === 'PK', db.length + ' bytes');
    await app.evaluate(({ dialog }, f) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: f }); }, pdf);
    await w.click('#saveAs'); await w.locator('.menu button', { hasText: 'PDF' }).click();
    for (let i = 0; i < 100 && !fs.existsSync(pdf); i++) await sleep(100); await sleep(300);
    const pb = fs.existsSync(pdf) ? fs.readFileSync(pdf) : Buffer.alloc(0);
    check('Save as PDF writes a PDF', pb.slice(0, 5).toString() === '%PDF-' && pb.length > 5000, pb.length + ' bytes');
    await w.screenshot({ path: path.join(out, '4-page.png') });
    // 7. open the .docx again
    await app.evaluate(({ dialog }, f) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [f] }); }, docx);
    const before = await w.evaluate(() => entry.key);
    await w.click('#openFile'); await w.waitForFunction(k => entry && entry.key !== k && document.body.dataset.state === 'ready', before);
    const back = await w.evaluate(() => { const d = document.getElementById('doc'); return { h1: d.querySelector('h1')?.innerText, ul: d.querySelectorAll('ul li').length, nested: !!d.querySelector('ul ul, ul li ul'), img: d.querySelectorAll('img').length, imgFloat: d.querySelector('img') && getComputedStyle(d.querySelector('img')).float, table: d.querySelector('table') ? [d.querySelector('table').rows.length, d.querySelector('table').rows[0].cells.length] : null, bold: [...d.querySelectorAll('span,b,strong')].some(s => +getComputedStyle(s).fontWeight >= 600 && /strong words/.test(s.innerText)), text: d.innerText.slice(0, 200) }; });
    check('the saved Word document opens again with heading, list, picture, table and bold text', back.h1 === 'Quarterly report' && back.ul >= 3 && back.nested && back.img === 1 && back.imgFloat === 'right' && back.table && back.table[0] === 3 && back.table[1] === 3 && back.bold, JSON.stringify(back));
    await w.screenshot({ path: path.join(out, '5-reopened-docx.png') });
    // 8. pages survive a restart
    const keys = await w.evaluate(() => [...document.getElementById('hist').options].map(o => o.value));
    await sleep(1200); check('Saveit quits with the page window open', await quit()); app = await launch(); p = await app.firstWindow(); await p.waitForFunction(() => document.body.dataset.catalogCount);
    await p.evaluate(() => document.getElementById('pageBtn49').click()); w = await pageWin(); await w.waitForFunction(() => document.body.dataset.state === 'ready');
    const keys2 = await w.evaluate(() => [...document.getElementById('hist').options].map(o => o.value));
    check('pages are still in Recent pages after Saveit restarts', keys.every(k => keys2.includes(k)), JSON.stringify({ keys, keys2 }));
    check('no errors in the page editor', !errors.length, errors.join(' | '));
  } catch (e) { check('test ran to the end', false, e.stack); }
  finally { try { require('child_process').execSync('taskkill /PID ' + app.process().pid + ' /T /F', { stdio: 'ignore' }); } catch (_) {} fs.writeFileSync(path.join(out, 'results.txt'), lines.join('\n')); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0); }
})();
