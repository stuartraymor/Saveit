// Saveit page editor, 10.5.4: more of a word processor. Headers, footers and page numbers; Title, Subtitle and Heading 4
// styles; a table of contents; footnotes; the format painter; first-line and hanging indents; table shading, header rows,
// merging and even columns. Loaded after textedit.js and uses its helpers ($, doc, ex, insertHtml, menu, ask, toast…).
'use strict';

// ---------- header, footer and page numbers ----------
// Kept with the page itself, in a hidden marker inside it, so they travel with the page into the library and web pages.
const HF_NONE = { header: '', footer: '', num: 'none', fmt: 'n' };
function hfGet() { const m = doc.querySelector('.pgset'); if (!m) return { ...HF_NONE }; return { header: m.dataset.header || '', footer: m.dataset.footer || '', num: ['bc', 'br', 'tr'].includes(m.dataset.num) ? m.dataset.num : 'none', fmt: m.dataset.fmt === 'nofm' ? 'nofm' : 'n' }; }
function hfHtml(v) { return `<div class="pgset" contenteditable="false" data-header="${esc(v.header || '')}" data-footer="${esc(v.footer || '')}" data-num="${esc(v.num || 'none')}" data-fmt="${esc(v.fmt || 'n')}"></div>`; }
function hfSet(v) {
  doc.querySelectorAll('.pgset').forEach(m => m.remove());
  if ((v.header || '').trim() || (v.footer || '').trim() || (v.num && v.num !== 'none')) { const t = document.createElement('template'); t.innerHTML = hfHtml(v); doc.prepend(t.content.firstChild); }
  hfShow(); changed();
}
// what the top and bottom of the sheet show while editing (the real thing is made when printing or saving)
function hfShow() {
  const v = hfGet(), n = v.fmt === 'nofm' ? 'Page 1 of 1' : '1', gap = '   ';
  doc.dataset.hdr = [v.header, v.num === 'tr' ? n : ''].filter(Boolean).join(gap); doc.dataset.ftr = [v.footer, v.num === 'bc' || v.num === 'br' ? n : ''].filter(Boolean).join(gap);
  doc.style.setProperty('--pm', doc.style.padding || '96px'); doc.classList.toggle('numright', v.num === 'br' && !v.footer); doc.classList.toggle('numcentre', v.num === 'bc' && !v.footer);
}
function pageLoaded() { hfShow(); noteNumbers(); }
{ const before = applyPage; applyPage = function (p) { before(p); hfShow(); }; }
$('hfBtn').onclick = () => {
  saveSel(); const v = hfGet(), m = document.createElement('div'); m.className = 'modal'; const f = document.createElement('form');
  const opt = (val, label, cur) => `<option value="${val}"${val === cur ? ' selected' : ''}>${label}</option>`;
  f.innerHTML = `<h2>Header, footer and page numbers</h2>
    <label>Header (top of every page)<input type="text" name="header" value="${esc(v.header)}" placeholder="For example the title of the document"></label>
    <label>Footer (bottom of every page)<input type="text" name="footer" value="${esc(v.footer)}" placeholder="For example your name or the date"></label>
    <label>Page numbers<select name="num">${opt('none', 'None', v.num)}${opt('bc', 'Bottom, centre', v.num)}${opt('br', 'Bottom, right', v.num)}${opt('tr', 'Top, right', v.num)}</select></label>
    <label>Number style<select name="fmt">${opt('n', '1, 2, 3', v.fmt)}${opt('nofm', 'Page 1 of 3', v.fmt)}</select></label>
    <p style="color:var(--dim);font-size:12px">They appear on every page of PDF and Word files. Printing shows the header and footer text; Windows does not print the page numbers.</p>
    <div class="row"><button type="button" data-x="clear">Remove</button><button type="button" data-x="no">Cancel</button><button class="pri" type="submit">Apply</button></div>`;
  m.append(f); document.body.append(m); f.elements.header.focus();
  const done = () => m.remove();
  f.onsubmit = e => { e.preventDefault(); hfSet({ header: f.elements.header.value.trim(), footer: f.elements.footer.value.trim(), num: f.elements.num.value, fmt: f.elements.fmt.value }); done(); };
  f.querySelector('[data-x=no]').onclick = done; f.querySelector('[data-x=clear]').onclick = () => { hfSet({ ...HF_NONE }); done(); };
  m.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); done(); } }); m.addEventListener('mousedown', e => { if (e.target === m) done(); });
};

// ---------- paragraph styles: Title, Subtitle, Heading 4 ----------
const P_CLASSES = { title: 'p-title', subtitle: 'p-subtitle' };
$('block').onchange = e => {
  const v = e.target.value, cls = P_CLASSES[v];
  ex('formatBlock', cls ? 'div' : v);
  for (const b of selectedBlocks()) { b.classList.remove('p-title', 'p-subtitle'); if (cls) b.classList.add(cls); if (!b.className) b.removeAttribute('class'); }
  changed(); refreshState();
};
{ const before = refreshState; refreshState = function () {
  before();
  try { const s = getSelection(), n = s.rangeCount ? s.getRangeAt(0).startContainer : null, b = n && doc.contains(n) ? blockOf(n) : null, v = String(document.queryCommandValue('formatBlock') || '').toLowerCase();
    if (b && b.classList.contains('p-title')) $('block').value = 'title'; else if (b && b.classList.contains('p-subtitle')) $('block').value = 'subtitle'; else if (v === 'h4') $('block').value = 'h4'; } catch (_) {}
}; }

// ---------- table of contents ----------
function tocInsert() {
  saveSel(); const hs = [...doc.querySelectorAll('h1,h2,h3,h4')].filter(h => h.textContent.trim() && !h.closest('.toc'));
  if (!hs.length) { toast('Give some lines a heading style first (Home > Paragraph style > Heading 1, 2 or 3), then insert the contents.', 6000); return; }
  const html = '<div class="toc" contenteditable="false"><div class="toc-t">Contents</div>' + hs.map(h => `<div class="toc-${h.tagName[1]}">${esc(h.textContent.trim())}</div>`).join('') + '</div>';
  const old = doc.querySelector('.toc');
  if (old) { doc.querySelectorAll('.toc').forEach((x, i) => { if (i) x.remove(); }); old.outerHTML = html; changed(); toast('Contents updated'); } // replaced in place (the old list is not typed text, so an insert over it left both)
  else insertHtml(html + '<div><br></div>');
}
$('insToc').onclick = tocInsert;
// clicking a line of the contents goes to its heading
doc.addEventListener('click', e => {
  const l = e.target.closest && e.target.closest('.toc > div:not(.toc-t)'); if (!l) return;
  const lines = [...l.parentElement.querySelectorAll(':scope > div:not(.toc-t)')], hs = [...doc.querySelectorAll('h1,h2,h3,h4')].filter(h => h.textContent.trim() && !h.closest('.toc'));
  const h = hs[lines.indexOf(l)] && hs[lines.indexOf(l)].textContent.trim() === l.textContent ? hs[lines.indexOf(l)] : hs.find(x => x.textContent.trim() === l.textContent);
  if (h) h.scrollIntoView({ block: 'start', behavior: 'smooth' });
});

// ---------- footnotes ----------
// A small raised number in the text and the note in a list at the end of the page. Numbers follow the order in the text;
// deleting a number removes its note.
function noteNumbers() {
  const refs = [...doc.querySelectorAll('sup.fnref')], box = doc.querySelector('.fnotes'); if (!box && !refs.length) return;
  if (box) {
    refs.forEach((r, i) => { const want = String(i + 1); if (r.textContent !== want) r.textContent = want; const n = [...box.children].find(x => x.dataset.fn === r.dataset.fn); if (n) { const lab = n.querySelector('.fn-n'); if (lab && lab.textContent !== want + '. ') lab.textContent = want + '. '; if (box.children[i] !== n) box.insertBefore(n, box.children[i] || null); } });
    for (const n of [...box.children]) if (!refs.some(r => r.dataset.fn === n.dataset.fn)) n.remove();
    if (!box.children.length) box.remove(); else if (doc.lastElementChild !== box && !box.closest('.cols')) doc.append(box);
  } else refs.forEach((r, i) => { r.textContent = String(i + 1); });
}
function noteInsert() {
  restoreSel(); const s0 = getSelection(); if (!s0.rangeCount || !doc.contains(s0.anchorNode)) { doc.focus(); caretToEnd(); saveSel(); }
  if (s0.rangeCount && s0.getRangeAt(0).startContainer.parentElement && s0.getRangeAt(0).startContainer.parentElement.closest('.fnotes,.toc')) { toast('Put the cursor in the text the note belongs to.'); return; }
  const id = 'f' + Date.now().toString(36) + Math.floor(Math.random() * 1e3).toString(36);
  // put in as an element (typed in as HTML, Chromium split the line in two around it and left a stray number behind)
  { const s = getSelection(), r = s.getRangeAt(0); r.collapse(false); const sup = document.createElement('sup'); sup.className = 'fnref'; sup.dataset.fn = id; sup.contentEditable = 'false'; sup.textContent = '0'; r.insertNode(sup); }
  let box = doc.querySelector('.fnotes'); if (!box) { box = document.createElement('div'); box.className = 'fnotes'; doc.append(box); }
  const n = document.createElement('div'); n.className = 'fn'; n.dataset.fn = id; n.innerHTML = '<span class="fn-n" contenteditable="false">0. </span>​'; box.append(n);
  noteNumbers();
  const r = document.createRange(); r.selectNodeContents(n); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); n.scrollIntoView({ block: 'nearest' }); saveSel(); changed();
}
$('insNote').onclick = noteInsert;
{ let t = 0; doc.addEventListener('input', () => { if (!doc.querySelector('.fnref,.fnotes')) return; clearTimeout(t); t = setTimeout(noteNumbers, 250); }); }
// double-click a note number in the text to go to its note
doc.addEventListener('dblclick', e => { const r = e.target.closest && e.target.closest('sup.fnref'); if (!r) return; const n = [...doc.querySelectorAll('.fnotes .fn')].find(x => x.dataset.fn === r.dataset.fn); if (n) { n.scrollIntoView({ block: 'center' }); const g = document.createRange(); g.selectNodeContents(n); g.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(g); } });

// ---------- format painter ----------
let painter = null;
const painterOff = () => { painter = null; $('painter').setAttribute('aria-pressed', 'false'); doc.classList.remove('painting'); };
$('painter').onclick = () => {
  if (painter) { painterOff(); return; }
  restoreSel(); const s = getSelection(), n = s.rangeCount ? s.getRangeAt(0).startContainer : null, el = n && (n.nodeType === 1 ? n : n.parentElement);
  if (!el || !doc.contains(el)) { toast('Click in the text whose look you want to copy, then choose Format painter.'); return; }
  const cs = getComputedStyle(el), st = c => { try { return document.queryCommandState(c); } catch (_) { return false; } };
  let bg = ''; for (let x = el; x && x !== doc; x = x.parentElement) { const b = getComputedStyle(x).backgroundColor; if (b && b !== 'rgba(0, 0, 0, 0)' && b !== 'transparent' && !/^(TD|TH|PRE)$/.test(x.tagName)) { bg = b; break; } }
  painter = { font: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(), pt: Math.round(parseFloat(cs.fontSize) * 0.75 * 2) / 2, color: cs.color, bg, bold: st('bold'), italic: st('italic'), underline: st('underline'), strikeThrough: st('strikeThrough') };
  $('painter').setAttribute('aria-pressed', 'true'); doc.classList.add('painting'); toast('Now drag over the text that should look the same. Esc cancels.', 4000);
};
doc.addEventListener('mouseup', () => {
  if (!painter) return;
  setTimeout(() => {
    const s = getSelection(); if (!painter || !s.rangeCount || s.isCollapsed || !doc.contains(s.anchorNode)) return;
    const p = painter; painterOff(); saveSel(); document.execCommand('styleWithCSS', false, true);
    for (const c of ['bold', 'italic', 'underline', 'strikeThrough']) { try { if (document.queryCommandState(c) !== p[c]) document.execCommand(c); if (document.queryCommandState(c) !== p[c]) document.execCommand(c); } catch (_) {} }
    if (p.font) document.execCommand('fontName', false, p.font);
    document.execCommand('foreColor', false, p.color); document.execCommand('hiliteColor', false, p.bg || 'transparent');
    saveSel(); setSize(p.pt);
  }, 0);
});
addEventListener('keydown', e => { if (e.key === 'Escape' && painter) painterOff(); }, true);

// ---------- first-line and hanging indents (added to the spacing menu) ----------
function indentMenuRows() {
  return [null, ['Indent the first line', () => setSpacing(b => { b.style.textIndent = '0.5in'; b.style.marginLeft = ''; })],
    ['Hanging indent', () => setSpacing(b => { b.style.marginLeft = '0.5in'; b.style.textIndent = '-0.5in'; })],
    ['No first-line or hanging indent', () => setSpacing(b => { if (b.style.textIndent.startsWith('-')) b.style.marginLeft = ''; b.style.textIndent = ''; })]];
}

// ---------- more for tables ----------
function tableEdit(cell, change) {
  const tbl = cell.closest('table'), ri = cell.parentElement.rowIndex, ci = cell.cellIndex, clone = tbl.cloneNode(true), c2 = clone.rows[ri] && clone.rows[ri].cells[ci]; if (!c2) return;
  if (change(clone, c2) === false) return;
  const target = clone.rows[Math.min(ri, clone.rows.length - 1)]; const pick = target && target.cells[Math.min(ci, target.cells.length - 1)]; if (pick) pick.dataset.pick = '1';
  const r = document.createRange(); r.selectNode(tbl); const s = getSelection(); s.removeAllRanges(); s.addRange(r); doc.focus(); document.execCommand('insertHTML', false, clone.outerHTML);
  const n = doc.querySelector('[data-pick]'); if (n) { n.removeAttribute('data-pick'); const rr = document.createRange(); rr.selectNodeContents(n); rr.collapse(true); s.removeAllRanges(); s.addRange(rr); } changed();
}
const SHADES = [['No shading', ''], ['Light grey', '#eef1f4'], ['Light blue', '#dbeafe'], ['Light green', '#dcfce7'], ['Light yellow', '#fef9c3'], ['Light red', '#fee2e2']];
function tableMore(cell) {
  const row = cell.parentElement, tbl = cell.closest('table'), isHead = [...tbl.rows[0].cells].every(c => c.dataset.head === '1');
  return [
    [isHead ? 'Remove the header row look' : 'Make the first row a header row', () => tableEdit(cell, t => { for (const c of t.rows[0].cells) { if (isHead) { delete c.dataset.head; c.style.fontWeight = ''; c.style.background = ''; } else { c.dataset.head = '1'; c.style.fontWeight = '600'; c.style.background = '#eef1f4'; } } })],
    ['Merge with the cell on the right', cell.nextElementSibling ? () => tableEdit(cell, (t, c) => { const nx = c.nextElementSibling; if (!nx) return false; if (nx.textContent.trim() || nx.querySelector('img')) { if (c.innerHTML === '<br>') c.innerHTML = ''; c.insertAdjacentHTML('beforeend', (c.textContent.trim() ? ' ' : '') + nx.innerHTML); } c.colSpan = (c.colSpan || 1) + (nx.colSpan || 1); c.style.width = ''; nx.remove(); }) : null],
    ['Split this merged cell', cell.colSpan > 1 ? () => tableEdit(cell, (t, c) => { const n = c.colSpan; c.colSpan = 1; c.removeAttribute('colspan'); for (let i = 1; i < n; i++) { const td = document.createElement('td'); td.innerHTML = '<br>'; c.after(td); } }) : null],
    ['Make the columns the same width', () => tableEdit(cell, t => { const n = Math.max(...[...t.rows].map(r => [...r.cells].reduce((a, c) => a + (c.colSpan || 1), 0))); for (const r of t.rows) for (const c of r.cells) c.style.width = (Math.round(10000 / n * (c.colSpan || 1)) / 100) + '%'; t.style.width = '100%'; })],
    { head: 'Shade ' + (row.cells.length > 1 ? 'this cell' : 'cell') },
    ...SHADES.map(([label, col]) => [label, () => tableEdit(cell, (t, c) => { c.style.background = col; })]),
    ['Shade the whole row light grey', () => tableEdit(cell, (t, c) => { for (const k of c.parentElement.cells) k.style.background = '#eef1f4'; })],
    null];
}
