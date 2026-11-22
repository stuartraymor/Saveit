// 10.5.4 Page editor in the real app: header, footer and page numbers; Title, Subtitle, Heading 4; table of contents;
// footnotes; format painter; hanging indent; table header row, merge and shading; Word and PDF files.
// node tests/native-page-1054.cjs <disposable runtime Saveit.exe> <evidence folder>
// Runs on one display without moving the real mouse (see native-driver.cjs).
'use strict';
const { launch } = require('./native-driver.cjs'); const path = require('path'), fs = require('fs');
(async () => { const t = await launch({ exe: process.argv[2], out: process.argv[3] }); const { app, p, check } = t;
  try {
    await p.evaluate(() => window.bench.textWindow({ name: 'Report', text: '', html: '' }));
    const w = await t.find('textedit.html'); check('Page window opens', !!w); w.on('pageerror', e => t.errors.push('page: ' + e.message));
    await w.waitForFunction(() => document.body.dataset.state === 'ready');
    const para = n => w.evaluate(n => { const el = document.querySelectorAll('#doc > *:not(.pgset)')[n], r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); saveSel(); }, n);
    await w.evaluate(() => { const doc = document.getElementById('doc'); doc.focus(); document.execCommand('selectAll'); document.execCommand('insertHTML', false, ['Annual report', 'Prepared for the board', 'Introduction', 'First paragraph of the introduction with enough words to wrap around when it is indented.', 'Results', 'Sales', 'Detail', 'Closing paragraph.'].map(x => '<div>' + x + '</div>').join('')); flattenTop(); });
    const style = async (n, v) => { await para(n); await w.selectOption('#block', v); await t.sleep(80); };
    await style(0, 'title'); await style(1, 'subtitle'); await style(2, 'h1'); await style(4, 'h1'); await style(5, 'h2'); await style(6, 'h4');
    const st = await w.evaluate(() => [...document.querySelectorAll('#doc > *')].map(e => e.tagName + (e.className ? '.' + e.className : '')));
    check('Title, Subtitle, Heading 1, 2 and 4 styles', st.join(' ') === 'DIV.p-title DIV.p-subtitle H1 DIV H1 H2 H4 DIV', st.join(' '));
    check('Title is large', await w.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.p-title')).fontSize)) > 30);
    await para(6); check('the style box shows Heading 4 for that line', await w.evaluate(() => { refreshState(); return document.getElementById('block').value; }) === 'h4');
    await style(6, 'h3'); await style(6, 'h4');
    // contents
    await w.evaluate(() => { const el = document.querySelectorAll('#doc > *')[2], r = document.createRange(); r.setStartBefore(el); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); saveSel(); });
    await w.locator('[data-tab=insert]').click(); await w.locator('#insToc').click(); await t.sleep(150);
    let toc = await w.evaluate(() => [...document.querySelectorAll('#doc .toc > div')].map(e => e.className + ':' + e.textContent));
    check('Contents lists the headings with their levels', toc.join('|') === 'toc-t:Contents|toc-1:Introduction|toc-1:Results|toc-2:Sales|toc-4:Detail', toc.join('|'));
    await w.evaluate(() => { document.querySelector('#doc h2').textContent = 'Sales by region'; }); await w.locator('#insToc').click(); await t.sleep(150);
    toc = await w.evaluate(() => [...document.querySelectorAll('#doc .toc > div')].map(e => e.textContent)); check('clicking Contents again updates it (one list only)', toc.includes('Sales by region') && await w.evaluate(() => document.querySelectorAll('#doc .toc').length) === 1, toc.join('|'));
    // footnotes
    const caretIn = (sel, off) => w.evaluate(([sel, off]) => { const el = document.querySelector(sel), tn = [...el.childNodes].find(n => n.nodeType === 3) || el, r = document.createRange(); r.setStart(tn, Math.min(off, tn.length ?? 0)); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); saveSel(); }, [sel, off]);
    await caretIn('#doc > div:last-of-type', 7); await w.locator('#insNote').click(); await w.keyboard.type('Second note in order of the text'); await t.sleep(350);
    await caretIn('#doc > h1', 5); await w.locator('#insNote').click(); await w.keyboard.type('First note'); await t.sleep(350);
    let fn = await w.evaluate(() => ({ refs: [...document.querySelectorAll('#doc sup.fnref')].map(r => r.textContent).join(','), notes: [...document.querySelectorAll('#doc .fnotes .fn')].map(n => n.textContent.replace(/​/g, '')), last: document.getElementById('doc').lastElementChild.className }));
    check('a footnote number does not split its line or leave stray numbers', await w.evaluate(() => document.querySelectorAll('#doc h1').length === 2 && !document.querySelector('#doc sup:not(.fnref)') && document.querySelector('#doc h1').textContent === 'Intro1duction'), await w.evaluate(() => [...document.querySelectorAll('#doc h1')].map(h => h.textContent).join('|')));
    check('Footnotes are numbered in the order of the text, notes at the end', fn.refs === '1,2' && fn.notes[0] === '1. First note' && fn.notes[1] === '2. Second note in order of the text' && fn.last === 'fnotes', JSON.stringify(fn));
    await w.evaluate(() => { document.querySelector('#doc sup.fnref').remove(); document.getElementById('doc').dispatchEvent(new Event('input')); }); await t.sleep(500);
    fn = await w.evaluate(() => ({ refs: [...document.querySelectorAll('#doc sup.fnref')].map(r => r.textContent).join(','), notes: [...document.querySelectorAll('#doc .fnotes .fn')].map(n => n.textContent.replace(/​/g, '')) }));
    check('Deleting a note number removes its note and renumbers the rest', fn.refs === '1' && fn.notes.length === 1 && fn.notes[0].startsWith('1. Second note'), JSON.stringify(fn));
    // header, footer, page numbers
    await w.locator('[data-tab=layout]').click(); await w.locator('#hfBtn').click();
    await w.locator('.modal input[name=header]').fill('Annual report 2026 & plans'); await w.locator('.modal input[name=footer]').fill('Confidential'); await w.selectOption('.modal select[name=num]', 'br'); await w.selectOption('.modal select[name=fmt]', 'nofm'); await w.locator('.modal button.pri').click(); await t.sleep(150);
    const hf = await w.evaluate(() => ({ get: hfGet(), hdr: document.getElementById('doc').dataset.hdr, ftr: document.getElementById('doc').dataset.ftr, shown: getComputedStyle(document.getElementById('doc'), '::before').content, words: document.getElementById('counts').textContent }));
    check('Header, footer and page number are kept with the page and previewed', hf.get.header === 'Annual report 2026 & plans' && hf.get.footer === 'Confidential' && hf.get.num === 'br' && hf.get.fmt === 'nofm' && /Annual report 2026/.test(hf.shown) && /Confidential.*Page 1 of 1/.test(hf.ftr), JSON.stringify(hf));
    check('the header text is not counted as words of the page', !/Confidential/.test(await w.evaluate(() => plain())));
    await w.screenshot({ path: path.join(t.out, 'page-1054.png') });
    // format painter
    await w.evaluate(() => { const el = [...document.querySelectorAll('#doc > div')].find(e => e.textContent.startsWith('First paragraph')), tn = document.createTreeWalker(el, NodeFilter.SHOW_TEXT).nextNode(), r = document.createRange(); r.setStart(tn, 0); r.setEnd(tn, 5); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand('styleWithCSS', false, true); document.execCommand('bold'); document.execCommand('foreColor', false, '#c62828');
      const t2 = document.createTreeWalker(el, NodeFilter.SHOW_TEXT).nextNode(), r2 = document.createRange(); r2.setStart(t2, 2); r2.collapse(true); s.removeAllRanges(); s.addRange(r2); saveSel(); });
    await w.locator('[data-tab=home]').click(); await w.locator('#painter').click();
    check('Format painter is armed', await w.locator('#painter').getAttribute('aria-pressed') === 'true');
    const box = await w.evaluate(() => { const el = [...document.querySelectorAll('#doc > div')].find(e => e.textContent.startsWith('Closing')); const r = document.createRange(); r.selectNodeContents(el.firstChild); const b = r.getBoundingClientRect(); return { x0: b.left + 1, x1: b.right - 1, y: b.top + b.height / 2 }; });
    await w.mouse.move(box.x0, box.y); await w.mouse.down(); await w.mouse.move((box.x0 + box.x1) / 2, box.y, { steps: 3 }); await w.mouse.move(box.x1, box.y, { steps: 3 }); await w.mouse.up(); await t.sleep(250);
    const painted = await w.evaluate(() => { const el = [...document.querySelectorAll('#doc > div')].find(e => e.textContent.startsWith('Closing')), tn = document.createTreeWalker(el, NodeFilter.SHOW_TEXT).nextNode(), cs = getComputedStyle(tn.parentElement); return { weight: cs.fontWeight, color: cs.color, pressed: document.getElementById('painter').getAttribute('aria-pressed') }; });
    check('Format painter gives the dragged text the same look, once', +painted.weight >= 600 && painted.color === 'rgb(198, 40, 40)' && painted.pressed === 'false', JSON.stringify(painted));
    // hanging indent
    await w.evaluate(() => { const el = [...document.querySelectorAll('#doc > div')].find(e => e.textContent.startsWith('First paragraph')), r = document.createRange(); r.selectNodeContents(el); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); saveSel(); });
    await w.locator('#spacing').click(); await w.getByRole('menuitem', { name: 'Hanging indent', exact: true }).click(); await t.sleep(100);
    check('Hanging indent', await w.evaluate(() => { const el = [...document.querySelectorAll('#doc > div')].find(e => e.textContent.startsWith('First paragraph')); return el.style.textIndent + ' ' + el.style.marginLeft; }) === '-0.5in 0.5in');
    // tables
    await w.evaluate(() => { const el = [...document.querySelectorAll('#doc > div')].find(e => e.textContent.startsWith('Closing')), r = document.createRange(); r.setStartAfter(el); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); saveSel(); insertTable(3, 3); [...document.querySelectorAll('#doc td')].forEach((c, i) => { c.textContent = 'c' + i; }); });
    const tab = (label, ri, ci) => w.evaluate(([label, ri, ci]) => { const cell = document.querySelector('#doc table').rows[ri].cells[ci]; const row = tableMore(cell).find(r => Array.isArray(r) && r[0].startsWith(label)); if (!row || !row[1]) return false; row[1](); return true; }, [label, ri, ci]);
    await tab('Make the first row a header row', 1, 1); await tab('Merge with the cell on the right', 1, 0); await tab('Light blue', 2, 2); await t.sleep(100);
    const tb = await w.evaluate(() => { const tbl = document.querySelector('#doc table'); return { head: [...tbl.rows[0].cells].every(c => c.style.fontWeight === '600'), span: tbl.rows[1].cells[0].colSpan, merged: tbl.rows[1].cells[0].textContent, cells: tbl.rows[1].cells.length, shade: tbl.rows[2].cells[2].style.background, tables: document.querySelectorAll('#doc table').length }; });
    check('Table: header row, merged cell and shading', tb.head && tb.span === 2 && tb.merged === 'c3 c4' && tb.cells === 2 && /219, 234, 254|dbeafe/i.test(tb.shade) && tb.tables === 1, JSON.stringify(tb));
    await w.keyboard.press('Control+z'); await t.sleep(150); check('Ctrl+Z undoes the last table change', !/219, 234, 254|dbeafe/i.test(await w.evaluate(() => document.querySelector('#doc table').rows[2].cells[2].style.background)));
    // Word file
    const dx = await w.evaluate(async () => { const bytes = await docxBytes(), z = await window.SaveitDocx.unzip(bytes), xml = await z.text('word/document.xml'), h = await z.text('word/header1.xml'), f = await z.text('word/footer1.xml'), ct = await z.text('[Content_Types].xml'), back = await window.SaveitDocx.fromDocx(bytes);
      const ok = s => !!s && !new DOMParser().parseFromString(s, 'application/xml').querySelector('parsererror');
      return { bytes: Array.from(bytes), wellFormed: ok(xml) && ok(h) && ok(f) && ok(ct), title: /<w:pStyle w:val="Title"\/>/.test(xml), sub: /<w:pStyle w:val="Subtitle"\/>/.test(xml), h4: /<w:pStyle w:val="Heading4"\/>/.test(xml), hang: /<w:ind w:left="720" w:hanging="720"\/>/.test(xml), twoInd: /<w:ind [^>]*\/><w:ind /.test(xml), refs: /<w:headerReference [^>]*\/><w:footerReference /.test(xml), marker: /Annual report 2026/.test(xml), head: /Annual report 2026 &amp; plans/.test(h || ''), foot: /Confidential/.test(f || '') && / PAGE /.test(f || '') && / NUMPAGES /.test(f || ''), span: /<w:gridSpan w:val="2"\/>/.test(xml), sup: /<w:vertAlign w:val="superscript"\/>/.test(xml),
        back: { hf: back.page.hf, title: /class="p-title"[^>]*>(<[^>]+>)*Annual report/.test(back.html), h4: /<h4[^>]*>(<[^>]+>)*Detail/.test(back.html), hang: /text-indent:-48px/.test(back.html), note: /Second note in order of the text/.test(back.html) } }; });
    fs.writeFileSync(path.join(t.out, 'report.docx'), Buffer.from(dx.bytes));
    check('Word file: styles, hanging indent, merged cell, footnote mark, header and footer parts', dx.wellFormed && dx.title && dx.sub && dx.h4 && dx.hang && !dx.twoInd && dx.refs && !dx.marker && dx.head && dx.foot && dx.span && dx.sup, JSON.stringify({ ...dx, bytes: undefined, back: undefined }));
    check('Opening that Word file brings back the header, footer, page numbers and styles', !!dx.back.hf && dx.back.hf.header === 'Annual report 2026 & plans' && dx.back.hf.footer === 'Confidential' && dx.back.hf.num === 'br' && dx.back.hf.fmt === 'nofm' && dx.back.title && dx.back.h4 && dx.back.hang && dx.back.note, JSON.stringify(dx.back));
    // PDF through the real Save as path (the save window is answered for the test)
    const pdfPath = path.join(t.out, 'report.pdf');
    await app.evaluate(({ dialog }, f) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: f }); }, pdfPath);
    await w.evaluate(() => saveFile('pdf')); await t.sleep(800);
    check('Save as PDF writes the file', fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 5000, fs.existsSync(pdfPath) ? fs.statSync(pdfPath).size + ' bytes' : 'missing');
    // leaving the page and coming back keeps everything
    const key = await w.evaluate(() => { syncNow(); return entry.key; });
    await w.evaluate(() => window.te.newPage({ name: 'Other' })); await w.waitForFunction(k => entry && entry.key !== k && document.body.dataset.state === 'ready', key);
    check('a new page has no header or footer', await w.evaluate(() => !document.getElementById('doc').dataset.hdr && hfGet().num === 'none'));
    await w.evaluate(k => window.te.pick(k).then(load), key); await t.sleep(200);
    const again = await w.evaluate(() => ({ hf: hfGet(), toc: document.querySelectorAll('#doc .toc > div').length, fn: document.querySelectorAll('#doc .fnotes .fn').length, title: !!document.querySelector('#doc .p-title'), tocFixed: document.querySelector('#doc .toc').getAttribute('contenteditable'), hdr: document.getElementById('doc').dataset.hdr }));
    check('Header/footer, contents, footnote and styles survive leaving the page and coming back', again.hf.header === 'Annual report 2026 & plans' && again.hf.num === 'br' && again.toc === 5 && again.fn === 1 && again.title && again.tocFixed === 'false' && /Annual report 2026/.test(again.hdr), JSON.stringify(again));
    // remove header and footer
    await w.locator('[data-tab=layout]').click(); await w.locator('#hfBtn').click(); await w.locator('.modal [data-x=clear]').click(); await t.sleep(100);
    check('Remove takes the header and footer away', await w.evaluate(() => !document.querySelector('#doc .pgset') && !document.getElementById('doc').dataset.hdr));
    check('no page errors', !t.errors.length, t.errors.join(' | ').slice(0, 400));
  } catch (e) { check('test ran to the end', false, String(e && e.stack || e).slice(0, 500));
  } finally { await t.finish(); }
})().catch(e => { console.error(e); process.exit(1); });
