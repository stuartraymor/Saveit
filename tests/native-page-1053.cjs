// 10.5.3 Page window in the real app: Grab text beside the page (issue E), columns, column breaks, page sizes, margins, Word round trip.
// node tests/native-page-1053.cjs <disposable runtime Saveit.exe> <evidence folder>
// Runs on one display without moving the real mouse (see native-driver.cjs; SAVEIT_TEST_DISPLAY picks the display).
'use strict';
// Page window in the real app: Grab text beside the page (issue E), columns, column breaks, page sizes, margins, Word round trip.
const { launch } = require('./native-driver.cjs'); const path = require('path'), fs = require('fs');
(async () => { const t = await launch({ exe: process.argv[2], out: process.argv[3] }); const { app, p, check } = t;
  try {
    const wa = t.small.workArea, d = t.small.bounds, FX = { x: wa.x + 30, y: wa.y + 420, width: 520, height: 170 };
    await app.evaluate(async ({ BrowserWindow }, b) => { const w = new BrowserWindow({ ...b, frame: false, show: false, backgroundColor: '#ffffff' }); global.__fx = w; w.setAlwaysOnTop(true, 'screen-saver');
      await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<body style="margin:0;padding:16px;font:17px Segoe UI,sans-serif"><table cellpadding="6" style="border-collapse:collapse"><tr style="font-weight:600"><td>Order</td><td>Item</td><td>Total</td></tr><tr><td>A-1007</td><td>Desk lamp</td><td>$84.00</td></tr><tr><td>A-1008</td><td>Monitor stand</td><td>$129.99</td></tr></table></body>')); w.setBounds(b); w.showInactive(); }, FX);
    const twState = () => app.evaluate(({ BrowserWindow }) => { const f = n => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes(n)); const tw = f('textedit.html'), ed = f('index.html'); return { tw: tw && { visible: tw.isVisible(), focused: tw.isFocused() }, ed: ed && { visible: ed.isVisible(), focused: ed.isFocused() } }; });
    // ---- a plain page with something typed in it
    await p.evaluate(() => window.bench.textWindow({ name: 'New page', text: '', html: '' }));
    const w = await t.find('textedit.html'); check('Page window opens', !!w); w.on('pageerror', e => t.errors.push('page: ' + e.message));
    await w.waitForFunction(() => document.body.dataset.state === 'ready');
    await w.locator('#doc').click(); await w.keyboard.type('My report, first line'); await w.keyboard.press('Enter'); await w.keyboard.type('Second line stays here');
    check('Grab text button is on an ordinary page (it was hidden)', await w.locator('#grab').isVisible(), await w.locator('#grab').innerText());
    const key0 = await w.evaluate(() => entry.key), items0 = await p.evaluate(() => window.__wf.items.length), hist0 = await w.evaluate(() => document.getElementById('hist').options.length);
    const drag = async ov => { const x0 = FX.x - d.x + 6, y0 = FX.y - d.y + 6, x1 = FX.x - d.x + FX.width - 6, y1 = FX.y - d.y + FX.height - 6; await ov.mouse.move(x0, y0); await ov.mouse.down(); await ov.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 3 }); await ov.mouse.move(x1, y1, { steps: 3 }); await ov.mouse.up(); await t.sleep(200); };
    // ---- Grab text from the Page window (issue E)
    await w.locator('#grab').click();
    let ov = await t.findOverlay(); check('E: selection screen opens for Grab text', !!ov && await ov.evaluate(() => document.getElementById('area').value) === 'text');
    await drag(ov); check('E: button says Grab text, no effects row', (await ov.locator('#ok').innerText()) === 'Grab text' && !(await ov.evaluate(() => document.getElementById('fxRow').getClientRects().length > 0)));
    await ov.locator('#ok').click();
    await w.waitForFunction(() => document.body.dataset.side === 'ready', null, { timeout: 40000 });
    await t.sleep(400);
    const s1 = await w.evaluate(() => ({ key: entry.key, doc: document.getElementById('doc').innerText, pic: !document.getElementById('pic').hidden, img: document.getElementById('picImg').naturalWidth, gt: !document.getElementById('gt').hidden && document.getElementById('gt').getClientRects().length > 0, text: document.getElementById('gtText').value, hist: document.getElementById('hist').options.length,
      picBelow: document.getElementById('gt').getBoundingClientRect().top >= document.getElementById('picImg').getBoundingClientRect().bottom - 1, right: document.getElementById('pic').getBoundingClientRect().left > document.getElementById('doc').getBoundingClientRect().left }));
    check('E: the page is still the same page with its text', s1.key === key0 && /My report, first line/.test(s1.doc) && /Second line stays here/.test(s1.doc) && !/Desk lamp/.test(s1.doc), JSON.stringify(s1.doc.slice(0, 60)));
    check('E: the picture of the grabbed area is shown on the right', s1.pic && s1.img > 100 && s1.right, 'picture width ' + s1.img);
    check('E: the grabbed text is in a box under the picture', s1.gt && s1.picBelow && /Desk lamp/.test(s1.text) && /129\.99/.test(s1.text), JSON.stringify(s1.text.slice(0, 80)));
    check('E: no new page was made and nothing was added to the editor', s1.hist === hist0 && await p.evaluate(() => window.__wf.items.length) === items0);
    const st1 = await twState(); check('E: the Page window is in front, not the editor with a screenshot', st1.tw.visible && st1.tw.focused && !st1.ed.focused, JSON.stringify(st1));
    await w.screenshot({ path: path.join(t.out, 'page-side-grab.png') });
    await w.locator('#gtCopy').click(); await t.sleep(200); check('E: Copy text puts the grabbed text on the clipboard', /Desk lamp/.test(await app.evaluate(({ clipboard }) => clipboard.readText())));
    await w.locator('#gtInsert').click(); await t.sleep(200); const docAfter = await w.evaluate(() => document.getElementById('doc').innerText);
    check('E: Insert into page adds it to the document, keeping what was there', /My report, first line/.test(docAfter) && /Desk lamp/.test(docAfter));
    await w.locator('#gtInsPic').click(); await t.sleep(700); check('E: Insert picture adds the picture', await w.evaluate(() => document.querySelectorAll('#doc img').length) === 1);
    // a second grab from the page replaces the side picture and text, still the same page
    await w.locator('#grab').click(); ov = await t.findOverlay(); await drag(ov); await ov.locator('#ok').click();
    await w.waitForFunction(() => document.body.dataset.side === 'loading' || document.body.dataset.side === 'ready'); await w.waitForFunction(() => document.body.dataset.side === 'ready', null, { timeout: 40000 });
    check('E: grabbing again keeps the page', await w.evaluate(() => entry.key) === key0 && /Desk lamp/.test(await w.evaluate(() => document.getElementById('gtText').value)));
    // cancelling a grab from the page leaves everything as it was
    await w.locator('#grab').click(); ov = await t.findOverlay(); await ov.keyboard.press('Escape').catch(() => {}); await t.sleep(900);
    const st2 = await twState(); check('E: Esc during the grab brings the Page window back', st2.tw.visible, JSON.stringify(st2));
    // ---- Grab text from the editor's own Capture button
    await app.evaluate(({ BrowserWindow }) => { const ed = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('index.html')); ed.show(); ed.focus(); }); await t.sleep(500);
    await p.selectOption('#area', 'text'); await p.locator('#capBtn').click();
    ov = await t.findOverlay(); await drag(ov); await ov.locator('#ok').click();
    await w.waitForFunction(k => typeof entry !== 'undefined' && entry && entry.key !== k && document.body.dataset.state === 'ready', key0, { timeout: 40000 }); await t.sleep(500);
    const s3 = await w.evaluate(() => ({ doc: document.getElementById('doc').innerText, pic: !document.getElementById('pic').hidden, gt: !document.getElementById('gt').hidden, text: document.getElementById('gtText').value, brand: document.getElementById('brandName').textContent }));
    const st3 = await twState();
    check('E: Grab text from the editor opens the Grab Text page with the text, the picture and the text box', /Desk lamp/.test(s3.doc) && s3.pic && s3.gt && /Desk lamp/.test(s3.text) && s3.brand === 'Grab Text', JSON.stringify(s3).slice(0, 160));
    check('E: and that window is in front (the editor no longer takes the front with the screenshot)', st3.tw.visible && st3.tw.focused && !st3.ed.focused, JSON.stringify(st3));
    check('E: the picture is also kept in the editor', await p.evaluate(() => window.__wf.items.length) === items0 + 1);
    await app.evaluate(() => { global.__fx.destroy(); });

    // ---- columns
    await w.evaluate(() => window.te.newPage({ name: 'Columns test' })); await w.waitForFunction(() => entry && entry.name === 'Columns test' && document.body.dataset.state === 'ready');
    await w.evaluate(() => { const doc = document.getElementById('doc'); doc.focus(); document.execCommand('insertHTML', false, Array.from({ length: 14 }, (_, i) => '<div>Paragraph ' + (i + 1) + ' ' + 'lorem ipsum dolor sit amet '.repeat(6) + '</div>').join('')); });
    await w.locator('[data-tab=layout]').click();
    const pickMenu = async label => { await w.locator('#colsBtn').click(); await w.locator('.menu button', { hasText: label }).first().click(); await t.sleep(150); };
    const colState = () => w.evaluate(() => { const doc = document.getElementById('doc'), c = doc.querySelector('.cols'); const lefts = [...new Set([...doc.querySelectorAll('.cols > div:not(.colbreak)')].map(e => Math.round(e.getBoundingClientRect().left)))]; return { has: !!c, n: c ? getComputedStyle(c).columnCount : '1', lefts: lefts.length, wholeDoc: !!c && doc.children.length === 1, inCols: c ? c.children.length : 0, rule: c ? getComputedStyle(c).columnRuleStyle : '', paras: doc.querySelectorAll('div').length }; });
    await pickMenu('Two'); let c = await colState(); check('Columns > Two sets the whole page in two columns', c.has && c.n === '2' && c.lefts === 2 && c.wholeDoc, JSON.stringify(c));
    await w.screenshot({ path: path.join(t.out, 'page-two-columns.png') });
    await pickMenu('Three'); c = await colState(); check('Three columns', c.n === '3' && c.lefts === 3, JSON.stringify(c));
    await pickMenu('Line between columns'); c = await colState(); check('Line between columns', c.rule === 'solid', c.rule);
    await w.locator('#colsBtn').click(); await w.locator('.menu button', { hasText: 'More columns' }).click(); await w.locator('.modal input[name=n]').fill('4'); await w.locator('.modal input[name=gap]').fill('0.3'); await w.locator('.modal button.pri').click(); await t.sleep(150);
    c = await colState(); check('More columns: four columns with a chosen gap', c.n === '4' && c.lefts === 4 && await w.evaluate(() => document.querySelector('#doc .cols').style.columnGap) === '0.3in', JSON.stringify(c));
    await pickMenu('One'); c = await colState(); check('One column removes the columns and keeps the text', !c.has && c.paras >= 14, JSON.stringify(c));
    // only the selected paragraphs
    await w.evaluate(() => { const ds = document.querySelectorAll('#doc > div'), r = document.createRange(); r.setStart(ds[3].firstChild, 2); r.setEnd(ds[8].firstChild, 5); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
    await pickMenu('Two'); c = await colState(); const part = await w.evaluate(() => { const doc = document.getElementById('doc'), k = [...doc.children], i = k.findIndex(e => e.classList.contains('cols')); return { before: i, inside: k[i] ? k[i].children.length : 0, after: k.length - i - 1, first: k[i] && k[i].firstElementChild.textContent.slice(0, 12), last: k[i] && k[i].lastElementChild.textContent.slice(0, 12) }; });
    check('Columns for selected text only wraps those paragraphs', c.has && !c.wholeDoc && part.before === 3 && part.inside === 6 && part.after === 5 && part.first === 'Paragraph 4 ' && part.last === 'Paragraph 9 ', JSON.stringify(part));
    // column break inside the columns; refused outside
    await w.evaluate(() => { const el = document.querySelectorAll('#doc .cols > div')[1], r = document.createRange(); r.setStart(el.firstChild, 0); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
    await w.locator('[data-tab=insert]').click(); await w.locator('#insColBreak').click(); await t.sleep(200);
    const cb = await w.evaluate(() => { const b = document.querySelector('#doc .cols .colbreak'); if (!b) return null; const prev = b.previousElementSibling, next = b.nextElementSibling; return { prevLeft: Math.round(prev.getBoundingClientRect().left), nextLeft: Math.round(next.getBoundingClientRect().left) }; });
    check('Column break moves what follows to the next column', !!cb && cb.nextLeft > cb.prevLeft + 50, JSON.stringify(cb));
    await w.evaluate(() => { const el = document.querySelector('#doc > div'), r = document.createRange(); r.setStart(el.firstChild, 0); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
    await w.locator('#insColBreak').click(); await t.sleep(150); check('Column break outside columns explains itself', /Layout > Columns/.test(await w.evaluate(() => (document.querySelector('.toast') || {}).textContent || '')) && await w.evaluate(() => document.querySelectorAll('#doc .colbreak').length) === 1);
    // ---- Word round trip
    const dx = await w.evaluate(async () => { const bytes = await docxBytes(); const z = await window.SaveitDocx.unzip(bytes), xml = await z.text('word/document.xml'); const back = await window.SaveitDocx.fromDocx(bytes); const ok = !new DOMParser().parseFromString(xml, 'application/xml').querySelector('parsererror');
      return { ok, bytes: Array.from(bytes), cols: (xml.match(/<w:cols [^>]*>/g) || []), cont: (xml.match(/<w:type w:val="continuous"\/>/g) || []).length, sect: (xml.match(/<w:sectPr>/g) || []).length, brk: /<w:br w:type="column"\/>/.test(xml), backCols: /<div class="cols" style="column-count:2;column-gap:0\.50in">/.test(back.html), backBreak: /colbreak/.test(back.html), backParas: (back.html.match(/Paragraph \d+ /g) || []).length }; });
    fs.writeFileSync(path.join(t.out, 'columns.docx'), Buffer.from(dx.bytes));
    check('Word file: three sections, the middle one with two columns, and the column break', dx.ok && dx.sect === 3 && dx.cont === 2 && dx.cols.filter(x => /w:num="2"/.test(x)).length === 1 && dx.brk, JSON.stringify({ ...dx, bytes: undefined }));
    check('Opening that Word file brings the columns, the break and every paragraph back', dx.backCols && dx.backBreak && dx.backParas === 14, JSON.stringify({ backCols: dx.backCols, backBreak: dx.backBreak, backParas: dx.backParas }));
    // ---- page sizes and custom margins
    await w.locator('[data-tab=layout]').click();
    await w.selectOption('#pgSize', 'a5'); check('Page size A5', await w.evaluate(() => document.getElementById('doc').style.width) === '560px');
    await w.selectOption('#pgSize', 'tabloid'); await w.selectOption('#pgOrient', 'landscape'); check('Tabloid landscape', await w.evaluate(() => document.getElementById('doc').style.width) === '1632px' && /17in 11in/.test(await w.evaluate(() => document.getElementById('pagecss').textContent)));
    await w.selectOption('#pgMargin', 'custom'); await w.locator('.modal input[name=m]').fill('0.8'); await w.locator('.modal button.pri').click(); await t.sleep(150);
    check('Custom margin 0.8 in', await w.evaluate(() => document.getElementById('doc').style.padding) === '77px' && await w.evaluate(() => document.getElementById('pgMargin').selectedOptions[0].textContent) === 'Custom (0.8 in)');
    const pdf = await app.evaluate(async ({ BrowserWindow }) => { const tw = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('textedit.html')); const b = await tw.webContents.printToPDF({ pageSize: 'Letter', printBackground: true }); return b.length; });
    check('PDF of the page with columns is produced', pdf > 3000, pdf + ' bytes');
    await w.selectOption('#pgSize', 'letter'); await w.selectOption('#pgOrient', 'portrait'); await w.selectOption('#pgMargin', '1');
    // ---- the page comes back with its columns after switching pages (saved, cleaned and loaded again)
    const keyC = await w.evaluate(() => { syncNow(); return entry.key; });
    await w.evaluate(k => window.te.pick(k).then(load), key0); await w.evaluate(k => window.te.pick(k).then(load), keyC);
    c = await colState(); check('Columns and the column break survive leaving the page and coming back', c.has && c.n === '2' && await w.evaluate(() => document.querySelectorAll('#doc .colbreak').length) === 1, JSON.stringify(c));
    const side0 = await w.evaluate(k => window.te.pick(k).then(d => { load(d); return { pic: !document.getElementById('pic').hidden, text: document.getElementById('gtText').value }; }), key0);
    check('The first page still has its grabbed picture and text beside it', side0.pic && /Desk lamp/.test(side0.text));
    check('no page errors', !t.errors.length, t.errors.join(' | ').slice(0, 400));
  } catch (e) { check('test ran to the end', false, String(e && e.stack || e).slice(0, 500));
  } finally { await t.finish(); }
})().catch(e => { console.error(e); process.exit(1); });
