// Saveit page editor (Grab Text window). 10.4.2 Grab Text; 10.4.10 a compact word processor: ribbon, pictures you can
// resize, crop, rotate and wrap, tables, lists, links, page setup, Word (.docx) and PDF saving, opening .docx files,
// and Saveit's own right-click menu with spelling suggestions.
'use strict';
const $ = id => document.getElementById(id), doc = $('doc'), wrapEl = $('docwrap');
let entry = null, dirty = false, syncT = 0, picWanted = true;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function textToHtml(t) { return String(t || '').split(/\r?\n/).map(l => '<div>' + (l ? esc(l) : '<br>') + '</div>').join(''); }
function plain() { return doc.innerText.replace(/ /g, ' ').replace(/\n$/, ''); }
function toast(m, ms = 2600) { document.querySelectorAll('.toast').forEach(e => e.remove()); const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = m; document.body.append(t); setTimeout(() => t.remove(), ms); }
const errMsg = e => (e && e.message || String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
const isGrab = () => !!(entry && entry.src);

// ---------- safety: only plain document content gets into the page ----------
const DROP = 'script,style,meta,link,iframe,frame,frameset,object,embed,applet,form,button,textarea,select,option,svg,math,base,template,video,audio,source,track,canvas,noscript,title,head';
// classes the page itself uses (page and column breaks, columns, header/footer marker, styles, contents, footnotes)
const KEEP_CLASS = new Set(['pgbreak', 'cols', 'colbreak', 'pgset', 'p-title', 'p-subtitle', 'toc', 'toc-t', 'toc-1', 'toc-2', 'toc-3', 'toc-4', 'fnref', 'fnotes', 'fn', 'fn-n']);
const FIXED_CLASS = new Set(['pgbreak', 'colbreak', 'pgset', 'toc', 'fnref', 'fn-n']); // parts that are not typed into
function sanitize(html, fromOutside) {
  const t = document.createElement('template'); t.innerHTML = String(html || '');
  t.content.querySelectorAll(DROP).forEach(x => x.remove());
  t.content.querySelectorAll('*').forEach(x => {
    for (const a of [...x.attributes]) {
      const n = a.name.toLowerCase(), v = a.value.trim();
      if (n.startsWith('on') || n === 'srcset' || n === 'formaction' || n === 'xmlns' || n.includes(':')) x.removeAttribute(a.name);
      else if ((n === 'href' || n === 'src') && /^\s*(javascript|vbscript|data:text)/i.test(v)) x.removeAttribute(a.name);
      else if (n === 'class') { const keep = v.split(/\s+/).filter(c => KEEP_CLASS.has(c)); keep.length ? x.setAttribute('class', keep.join(' ')) : x.removeAttribute('class'); }
      else if (n === 'id' || n === 'contenteditable' && ![...x.classList].some(c => FIXED_CLASS.has(c)) || n === 'data-pick' || n === 'tabindex') x.removeAttribute(a.name);
    }
    if (x.tagName === 'INPUT' && x.type !== 'checkbox') x.remove();
    if (x.style) { x.style.removeProperty('position'); x.style.removeProperty('z-index'); if (fromOutside) { x.style.removeProperty('color'); x.style.removeProperty('background'); x.style.removeProperty('background-color'); x.style.removeProperty('font-family'); x.style.removeProperty('white-space'); } }
    if (x.tagName === 'A' && x.getAttribute('href') && !/^(https?:|mailto:|#)/i.test(x.getAttribute('href'))) x.removeAttribute('href');
  });
  return t.innerHTML;
}

// ---------- state ----------
function counts() {
  const t = plain(), w = (t.match(/\S+/g) || []).length;
  const pg = pageSetup(), contentH = (pageDims(pg).h - pg.margin * 2) * 96, pages = Math.max(1, Math.ceil((doc.scrollHeight / zoomF() - pg.margin * 2 * 96 - 1) / contentH));
  $('counts').textContent = `${w} word${w === 1 ? '' : 's'} · ${t.length} character${t.length === 1 ? '' : 's'} · ${pages} page${pages === 1 ? '' : 's'}`;
  const has = !!t.trim() || !!doc.querySelector('img,table,hr');
  $('copyAll').disabled = !t.trim(); $('saveLib').disabled = !has || !!(entry && entry.loading);
}
function stateLabel() {
  const s = $('state'), b = $('saveLib'); if (!entry) { s.textContent = ''; return; }
  if (entry.libId && !dirty) { s.className = 'saved'; s.textContent = 'Saved in the library'; b.textContent = 'Saved ✓'; }
  else if (entry.libId) { s.className = 'unsaved'; s.textContent = 'Changes not saved to the library'; b.textContent = 'Save changes'; }
  else { s.className = ''; s.textContent = 'Not saved to the library · kept in Recent pages'; b.textContent = 'Save to library'; }
}
function sync() { clearTimeout(syncT); syncT = setTimeout(syncNow, 400); }
function syncNow() { clearTimeout(syncT); if (entry && !entry.loading) window.te.update({ key: entry.key, text: plain(), html: cleanHtml(), name: $('name').value, dirty }); }
function changed() { dirty = true; counts(); stateLabel(); sync(); }
function fillHist(list) {
  const h = $('hist'); h.innerHTML = list.map(g => `<option value="${esc(g.key)}">${esc(new Date(g.created).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))} · ${g.libId ? '★ ' : ''}${esc(g.name && g.name !== 'Grabbed text' && g.name !== 'New page' ? g.name : (g.preview || g.name || '(empty)'))}</option>`).join('');
  if (entry) h.value = entry.key; h.closest('label').hidden = list.length < 2;
}
// 10.5.3: Grab text is always there (it used to appear only on pages that began as a grab). A grab started from this window
// shows its picture, and the text read from it, beside the page; the page itself is left as it is.
const sideSrc = () => (entry && (entry.sideSrc || entry.src)) || '';
const sideText = () => !entry ? '' : entry.sideSrc || entry.sideLoading || entry.sideEmpty ? (entry.sideText || '') : (entry.src ? entry.grabText || '' : '');
function showPic() { const has = !!sideSrc(); $('picBtn').hidden = !has; $('pic').hidden = !has || !picWanted; $('picBtn').setAttribute('aria-pressed', has && picWanted); }
function fillSide() {
  const src = sideSrc(), t = sideText(), busy = !!(entry && entry.sideLoading), none = !!(entry && entry.sideEmpty);
  if (src) { if ($('picImg').src !== src) $('picImg').src = src; } else $('picImg').removeAttribute('src');
  $('gt').hidden = !src || !(t || busy || none); $('gtText').value = t; $('gtText').placeholder = busy ? '' : 'No text was found in that area.';
  $('gtState').textContent = busy ? 'Reading text…' : none ? 'No text found' : '';
  for (const id of ['gtCopy', 'gtInsert']) $(id).disabled = busy || !t.trim(); $('gtInsPic').disabled = !src;
}
window.te.onSide(d => {
  if (!entry || !d || d.key !== entry.key) return;
  Object.assign(entry, { sideSrc: d.src || entry.sideSrc || '', sideText: d.text || '', sideLoading: !!d.loading, sideEmpty: !!d.empty });
  picWanted = true; $('picImg').classList.remove('full'); fillSide(); showPic(); document.body.dataset.side = d.loading ? 'loading' : 'ready';
});
function sidePick() { const b = $('gtText'), a = b.selectionStart, z = b.selectionEnd; return z > a ? b.value.slice(a, z) : b.value; }
$('gtCopy').onclick = async () => { const t = sidePick(); if (!t.trim()) return; try { await window.te.copy(t, ''); toast('Grabbed text copied. Paste it anywhere.'); } catch (e) { toast('Copy failed: ' + errMsg(e)); } };
$('gtInsert').onclick = () => { const t = sidePick(); if (!t.trim()) return; if (!keptRange || !doc.contains(keptRange.startContainer)) { doc.focus(); caretToEnd(); saveSel(); } insertHtml(t.includes('\n') ? textToHtml(t) : esc(t)); toast('Text added to the page'); };
$('gtInsPic').onclick = async () => { const src = sideSrc(); if (!src) return; try { const blob = await (await fetch(src)).blob(); if (!keptRange || !doc.contains(keptRange.startContainer)) { doc.focus(); caretToEnd(); saveSel(); } await insertImageFiles([new File([blob], 'Grabbed picture.png', { type: blob.type || 'image/png' })]); } catch (e) { toast('Could not add the picture: ' + errMsg(e), 5000); } };
const PAGE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>';
function brand() { $('brandName').textContent = isGrab() ? 'Grab Text' : 'Page'; $('brandIcon').innerHTML = isGrab() ? 'T' : PAGE_ICON; document.title = ($('name').value || (isGrab() ? 'Grabbed text' : 'Page')) + ' · Saveit'; }
function load(d) {
  if (!d || !d.entry) return; hideImgSel(); entry = d.entry; dirty = !!entry.dirty; $('name').value = entry.name || 'Page';
  doc.innerHTML = entry.html ? sanitize(entry.html) : textToHtml(entry.text); $('loading').hidden = !entry.loading; doc.contentEditable = entry.loading ? 'false' : 'true';
  const b = $('banner'); b.hidden = !entry.empty; b.textContent = entry.empty ? 'No text was found in that area. Try Grab again with a tighter box around clear text, or type it in yourself.' : '';
  $('picImg').classList.remove('full'); fillSide(); if (typeof pageLoaded === 'function') pageLoaded();
  showPic(); brand(); fillHist(d.list || []); counts(); stateLabel(); closeFind(true);
  if (!entry.loading) { doc.focus(); if (isGrab() && !entry.libId) selectAll(); else caretToEnd(); }
  document.body.dataset.state = entry.loading ? 'loading' : 'ready';
}
window.te.onLoad(load);
function selectAll() { const r = document.createRange(); r.selectNodeContents(doc); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
function caretToEnd() { const r = document.createRange(); r.selectNodeContents(doc); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
doc.addEventListener('input', () => { changed(); if (selImg && !selImg.isConnected) hideImgSel(); });
$('name').addEventListener('input', () => { changed(); brand(); });

// ---------- ribbon tabs ----------
for (const t of document.querySelectorAll('[data-tab]')) t.onclick = () => showTab(t.dataset.tab);
function showTab(name) { for (const t of document.querySelectorAll('[data-tab]')) t.setAttribute('aria-selected', t.dataset.tab === name); for (const p of document.querySelectorAll('[data-panel]')) p.hidden = p.dataset.panel !== name; }

// ---------- selection helpers ----------
let keptRange = null;
function saveSel() { const s = getSelection(); if (s.rangeCount && doc.contains(s.anchorNode)) keptRange = s.getRangeAt(0).cloneRange(); }
function restoreSel() { doc.focus(); if (!keptRange || !doc.contains(keptRange.startContainer)) return; const s = getSelection(); s.removeAllRanges(); s.addRange(keptRange); }
document.addEventListener('selectionchange', () => { const s = getSelection(); if (s.rangeCount && doc.contains(s.anchorNode)) { saveSel(); refreshState(); } if (selImg && !imgIsSelected()) hideImgSel(); });
for (const el of document.querySelectorAll('.fmt button, .tabs button, #imgbar')) el.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
const ex = (c, v = null) => { restoreSel(); document.execCommand('styleWithCSS', false, true); document.execCommand(c, false, v); changed(); refreshState(); };
document.querySelectorAll('[data-cmd]').forEach(b => { b.onclick = () => ex(b.dataset.cmd); });
function insertHtml(html) { restoreSel(); document.execCommand('insertHTML', false, html); changed(); }
function blockOf(n) { while (n && n !== doc) { if (n.nodeType === 1 && /^(DIV|P|H[1-6]|LI|BLOCKQUOTE|PRE|TD|TH)$/.test(n.tagName)) return n; n = n.parentNode; } return null; }
function selectedBlocks() {
  restoreSel(); const s = getSelection(); if (!s.rangeCount) return [];
  let r = s.getRangeAt(0);
  if (!blockOf(r.startContainer)) { document.execCommand('formatBlock', false, 'div'); r = getSelection().getRangeAt(0); }
  const a = blockOf(r.startContainer), b = blockOf(r.endContainer); if (!a) return [];
  const all = [...doc.querySelectorAll('div,p,h1,h2,h3,h4,h5,h6,li,blockquote,pre')].filter(el => ![...el.children].some(c => /^(DIV|P|H[1-6]|LI|BLOCKQUOTE|PRE|UL|OL|TABLE)$/.test(c.tagName)) || el === a || el === b);
  const i = all.indexOf(a), j = all.indexOf(b || a); return i < 0 ? [a] : all.slice(i, Math.max(i, j) + 1);
}

// ---------- fonts, sizes, colours ----------
$('block').onchange = e => { ex('formatBlock', e.target.value); };
for (const id of ['block', 'font', 'size']) $(id).addEventListener('mousedown', saveSel);
$('font').onchange = e => { if (e.target.value) ex('fontName', e.target.value); };
const SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];
function setSize(pt) {
  restoreSel(); document.execCommand('styleWithCSS', false, true); document.execCommand('fontSize', false, '7');
  doc.querySelectorAll('[style*="xxx-large"]').forEach(el => { el.style.fontSize = pt + 'pt'; });
  doc.querySelectorAll('font[size="7"]').forEach(el => { const s = document.createElement('span'); s.style.fontSize = pt + 'pt'; s.append(...el.childNodes); el.replaceWith(s); });
  changed(); refreshState();
}
$('size').onchange = e => { const pt = e.target.value; if (pt) setSize(pt); };
function curPt() { const s = getSelection(); const n = s.rangeCount ? s.getRangeAt(0).startContainer : null, el = n && (n.nodeType === 1 ? n : n.parentElement); return el && doc.contains(el) ? Math.round(parseFloat(getComputedStyle(el).fontSize) * 0.75 * 2) / 2 : 11; }
$('grow').onclick = () => { const c = curPt(); setSize(SIZES.find(s => s > c) || 72); };
$('shrink').onclick = () => { const c = curPt(); setSize([...SIZES].reverse().find(s => s < c) || 8); };
const TEXT_COLS = ['#000000', '#404040', '#7f7f7f', '#bfbfbf', '#ffffff', '#c62828', '#e65100', '#f9a825', '#2e7d32', '#00838f', '#1565c0', '#283593', '#6a1b9a', '#ad1457', '#4e342e', '#ef9a9a', '#ffcc80', '#fff59d', '#a5d6a7', '#80deea', '#90caf9', '#9fa8da', '#ce93d8', '#f48fb1', '#bcaaa4'];
const HILI_COLS = ['#fff176', '#ffd54f', '#aed581', '#80deea', '#90caf9', '#f48fb1', '#ce93d8', '#ffab91', '#e0e0e0', '#bdbdbd'];
let foreCol = '#c62828', hiliCol = '#fff176';
function applyFore(c) { foreCol = c; $('foreBar').style.background = c; ex('foreColor', c); }
function applyHili(c) { if (c) { hiliCol = c; $('hiliBar').style.background = c; } ex('hiliteColor', c || 'transparent'); }
$('foreBtn').onclick = () => applyFore(foreCol);
$('hiliBtn').onclick = () => applyHili(hiliCol);
function palette(anchor, cols, pick, first, more) {
  const box = document.createElement('div');
  if (first) { const b = document.createElement('button'); b.textContent = first[0]; b.onclick = () => { closeMenus(); first[1](); }; box.append(b); }
  const g = document.createElement('div'); g.className = 'grid pal'; g.style.gridTemplateColumns = 'repeat(5,22px)';
  for (const c of cols) { const b = document.createElement('button'); b.style.background = c; b.title = c; b.setAttribute('aria-label', c); b.onmousedown = e => e.preventDefault(); b.onclick = () => { closeMenus(); pick(c); }; g.append(b); }
  box.append(g); if (more) { const hr = document.createElement('hr'), b = document.createElement('button'); b.textContent = 'More colours…'; b.onclick = () => { closeMenus(); more(); }; box.append(hr, b); }
  popup(anchor, box);
}
$('foreMore').onclick = () => palette($('foreMore'), TEXT_COLS, applyFore, ['Automatic (black)', () => applyFore('#111111')], () => $('fore').click());
$('hiliMore').onclick = () => palette($('hiliMore'), HILI_COLS, applyHili, ['No highlight', () => applyHili(null)], () => $('hili').click());
$('fore').onchange = () => applyFore($('fore').value);
$('hili').onchange = () => applyHili($('hili').value);
function refreshState() {
  for (const b of document.querySelectorAll('[data-cmd]')) { const c = b.dataset.cmd; if (['bold', 'italic', 'underline', 'strikeThrough', 'superscript', 'subscript', 'insertUnorderedList', 'insertOrderedList', 'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull'].includes(c)) { try { b.setAttribute('aria-pressed', document.queryCommandState(c)); } catch (_) {} } }
  try { const v = String(document.queryCommandValue('formatBlock') || 'div').toLowerCase(); $('block').value = ['h1', 'h2', 'h3', 'blockquote', 'pre'].includes(v) ? v : 'div'; } catch (_) {}
  const s = getSelection(), n = s.rangeCount ? s.getRangeAt(0).startContainer : null, el = n && (n.nodeType === 1 ? n : n.parentElement);
  if (el && doc.contains(el)) { const cs = getComputedStyle(el), f = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(); $('font').value = [...$('font').options].some(o => o.value === f) ? f : ''; const pt = String(Math.round(parseFloat(cs.fontSize) * 0.75 * 2) / 2); $('size').value = [...$('size').options].some(o => o.value === pt) ? pt : ''; }
}

// ---------- lists and spacing ----------
function listAtCaret() { const s = getSelection(); let n = s.rangeCount ? s.getRangeAt(0).startContainer : null; while (n && n !== doc) { if (n.nodeType === 1 && (n.tagName === 'UL' || n.tagName === 'OL')) return n; n = n.parentNode; } return null; }
function listStyle(ordered, type) {
  restoreSel(); let l = listAtCaret();
  if (!l || (l.tagName === 'OL') !== ordered) { document.execCommand(ordered ? 'insertOrderedList' : 'insertUnorderedList'); l = listAtCaret(); }
  if (l) l.style.listStyleType = type; changed(); refreshState();
}
$('bulletMore').onclick = () => menu($('bulletMore'), [['•  Filled circle', () => listStyle(false, 'disc')], ['◦  Hollow circle', () => listStyle(false, 'circle')], ['▪  Square', () => listStyle(false, 'square')]]);
$('numberMore').onclick = () => menu($('numberMore'), [['1.  2.  3.', () => listStyle(true, 'decimal')], ['a.  b.  c.', () => listStyle(true, 'lower-alpha')], ['A.  B.  C.', () => listStyle(true, 'upper-alpha')], ['i.  ii.  iii.', () => listStyle(true, 'lower-roman')], ['I.  II.  III.', () => listStyle(true, 'upper-roman')]]);
function setSpacing(fn) { const bl = selectedBlocks(); if (!bl.length) return; for (const b of bl) fn(b); changed(); }
$('spacing').onclick = () => {
  const lh = v => () => setSpacing(b => { b.style.lineHeight = v; });
  menu($('spacing'), [['Single (1.0)', lh('1.15')], ['1.15', lh('1.3')], ['Normal (1.45)', lh('')], ['1.5', lh('1.7')], ['Double (2.0)', lh('2.3')], ['2.5', lh('2.85')], ['Triple (3.0)', lh('3.4')], null,
    ['Add space before paragraph', () => setSpacing(b => { b.style.marginTop = '8pt'; })], ['Add space after paragraph', () => setSpacing(b => { b.style.marginBottom = '8pt'; })], ['Remove paragraph spacing', () => setSpacing(b => { b.style.marginTop = ''; b.style.marginBottom = ''; })], ...(typeof indentMenuRows === 'function' ? indentMenuRows() : [])]);
};

// ---------- Insert tab ----------
$('insPic').onclick = () => { saveSel(); $('picFile').click(); };
$('picFile').onchange = e => { const fs = [...e.target.files]; e.target.value = ''; restoreSel(); insertImageFiles(fs); };
$('insTable').onclick = () => {
  saveSel(); const box = document.createElement('div'), g = document.createElement('div'), lab = document.createElement('div'); g.className = 'grid tgrid'; lab.className = 'tlabel'; lab.textContent = 'Choose the size';
  const cells = []; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const i = document.createElement('i'); i.dataset.r = r; i.dataset.c = c; cells.push(i); g.append(i); }
  g.onmousemove = e => { const t = e.target.closest('i'); if (!t) return; const R = +t.dataset.r, C = +t.dataset.c; cells.forEach(i => i.classList.toggle('on', +i.dataset.r <= R && +i.dataset.c <= C)); lab.textContent = `${C + 1} × ${R + 1} table`; };
  g.onmousedown = e => e.preventDefault();
  g.onclick = e => { const t = e.target.closest('i'); if (!t) return; closeMenus(); insertTable(+t.dataset.r + 1, +t.dataset.c + 1); };
  const more = document.createElement('button'); more.textContent = 'Other size…'; more.onclick = async () => { closeMenus(); const v = await ask('Insert table', [{ id: 'c', label: 'Columns', value: '3' }, { id: 'r', label: 'Rows', value: '3' }], 'Insert'); if (v) insertTable(Math.max(1, Math.min(60, parseInt(v.r) || 1)), Math.max(1, Math.min(20, parseInt(v.c) || 1))); };
  box.append(lab, g, document.createElement('hr'), more); popup($('insTable'), box);
};
function insertTable(rows, cols) {
  const w = Math.round(100 / cols * 100) / 100; insertHtml('<table style="width:100%"><tbody>' + Array.from({ length: rows }, (_, r) => '<tr>' + Array.from({ length: cols }, (_, c) => `<td style="width:${w}%"${r + c === 0 ? ' data-pick="1"' : ''}><br></td>`).join('') + '</tr>').join('') + '</tbody></table><div><br></div>');
  const first = doc.querySelector('td[data-pick]'); if (first) { first.removeAttribute('data-pick'); const r = document.createRange(); r.selectNodeContents(first); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
}
$('insLink').onclick = () => editLink();
async function editLink(existing) {
  saveSel(); const s = getSelection(); const a = existing || (s.rangeCount && s.getRangeAt(0).startContainer.parentElement?.closest('a'));
  const txt = a ? a.textContent : (s.toString() || '');
  const v = await ask(a ? 'Edit link' : 'Insert link', [{ id: 'url', label: 'Web address', value: a ? a.getAttribute('href') || '' : '', placeholder: 'https://' }, { id: 'text', label: 'Text to show', value: txt }], a ? 'Save' : 'Insert');
  if (!v) return; let url = v.url.trim(); if (!url) return; if (!/^(https?:|mailto:)/i.test(url)) url = (/^[^\s@]+@[^\s@]+$/.test(url) ? 'mailto:' : 'https://') + url;
  const text = v.text.trim() || url;
  if (a) { const r = document.createRange(); r.selectNode(a); const ss = getSelection(); ss.removeAllRanges(); ss.addRange(r); keptRange = r; }
  insertHtml(`<a href="${esc(url)}">${esc(text)}</a>&nbsp;`);
}
$('insHr').onclick = () => insertHtml('<hr><div><br></div>');
$('insBreak').onclick = () => pageBreak();
function pageBreak() { insertHtml('<div class="pgbreak" contenteditable="false"></div><div><br></div>'); }
$('insColBreak').onclick = () => columnBreak();
$('insDate').onclick = () => { const d = new Date(); menu($('insDate'), [[d.toLocaleDateString(undefined, { dateStyle: 'long' })], [d.toLocaleDateString(undefined, { dateStyle: 'full' })], [d.toLocaleDateString()], [d.toISOString().slice(0, 10)], [d.toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })], [d.toLocaleTimeString(undefined, { timeStyle: 'short' })]].map(r => [r[0], () => { restoreSel(); document.execCommand('insertText', false, r[0]); changed(); }])); };
const SYMBOLS = '© ® ™ € £ ¥ ¢ ° ± × ÷ ≈ ≠ ≤ ≥ ∞ √ ½ ¼ ¾ → ← ↑ ↓ ↔ • … — – § ¶ † ✓ ✗ ★ ☆ ♥ ☐ ☑ µ Ω π Δ α β'.split(' ');
$('insSym').onclick = () => { saveSel(); const g = document.createElement('div'); g.className = 'grid sym'; g.style.gridTemplateColumns = 'repeat(8,30px)'; for (const c of SYMBOLS) { const b = document.createElement('button'); b.textContent = c; b.onmousedown = e => e.preventDefault(); b.onclick = () => { closeMenus(); restoreSel(); document.execCommand('insertText', false, c); changed(); }; g.append(b); } popup($('insSym'), g); };
$('insCheck').onclick = () => insertHtml('<input type="checkbox">&nbsp;');
doc.addEventListener('click', e => {
  if (e.target.tagName === 'INPUT' && e.target.type === 'checkbox') { if (e.target.checked) e.target.setAttribute('checked', ''); else e.target.removeAttribute('checked'); changed(); }
  const a = e.target.closest('a'); if (a && (e.ctrlKey || e.metaKey) && a.getAttribute('href')) { e.preventDefault(); window.te.ctx({ act: 'openLink', url: a.getAttribute('href') }); }
});

// ---------- page setup ----------
const PAGE_SIZES = { letter: [8.5, 11], a4: [8.27, 11.69], legal: [8.5, 14], executive: [7.25, 10.5], tabloid: [11, 17], a3: [11.69, 16.54], a5: [5.83, 8.27] };
const okMargin = m => Number.isFinite(m) && m >= 0.25 && m <= 3; // 10.5.3: any margin from 0.25 to 3 in (was three fixed choices)
function pageSetup() { let p = {}; try { p = JSON.parse(localStorage.getItem('saveit-page') || '{}'); } catch (_) {} return { size: PAGE_SIZES[p.size] ? p.size : 'letter', orientation: p.orientation === 'landscape' ? 'landscape' : 'portrait', margin: okMargin(+p.margin) ? Math.round(+p.margin * 100) / 100 : 1 }; }
function pageDims(p) { const [w, h] = PAGE_SIZES[p.size]; return p.orientation === 'landscape' ? { w: h, h: w } : { w, h }; }
function applyPage(p) {
  p = p || pageSetup(); const d = pageDims(p);
  doc.style.width = Math.round(d.w * 96) + 'px'; doc.style.padding = Math.round(p.margin * 96) + 'px'; doc.style.minHeight = Math.round(d.h * 96) + 'px';
  $('pagecss').textContent = `@page{size:${d.w}in ${d.h}in;margin:${p.margin}in}`;
  $('pgSize').value = p.size; $('pgOrient').value = p.orientation;
  { const sel = $('pgMargin'); sel.querySelectorAll('[data-own]').forEach(o => o.remove()); if (![...sel.options].some(o => +o.value === p.margin)) { const o = document.createElement('option'); o.value = String(p.margin); o.textContent = `Custom (${p.margin} in)`; o.dataset.own = '1'; sel.insertBefore(o, sel.querySelector('[value=custom]')); } sel.value = String(p.margin); }
  counts();
}
function setPage(ch) { const p = Object.assign(pageSetup(), ch); try { localStorage.setItem('saveit-page', JSON.stringify(p)); } catch (_) {} applyPage(p); }
$('pgSize').onchange = e => setPage({ size: e.target.value });
$('pgOrient').onchange = e => setPage({ orientation: e.target.value });
$('pgMargin').onchange = async e => {
  if (e.target.value !== 'custom') { setPage({ margin: +e.target.value }); return; }
  const cur = pageSetup(), v = await ask('Custom margins', [{ id: 'm', label: 'Margin on every side, in inches (0.25 to 3)', value: String(cur.margin) }], 'Apply');
  const m = v ? parseFloat(String(v.m).replace(',', '.')) : NaN;
  if (v && !okMargin(m)) toast('Type a margin between 0.25 and 3 inches.', 4000);
  setPage({ margin: okMargin(m) ? Math.round(m * 100) / 100 : cur.margin });
};

// ---------- columns (10.5.3) ----------
// Text is set in columns by a wrapper around the paragraphs it applies to: the whole page, or only the paragraphs that were
// selected (a section, like Word's). Columns fill from the left and balance, and save to Word, PDF and web pages.
const colsAt = n => { for (; n && n !== doc; n = n.parentNode) if (n.nodeType === 1 && n.classList.contains('cols')) return n; return null; };
const colInfo = el => ({ n: Math.max(1, parseInt(el.style.columnCount) || 1), gap: parseFloat(el.style.columnGap) || 0.5, line: !!el.style.columnRuleStyle && el.style.columnRuleStyle !== 'none' });
function colStyle(el, o) { el.style.columnCount = String(o.n); el.style.columnGap = o.gap + 'in'; el.style.columnRule = o.line ? '1px solid #8a9199' : ''; }
function topChild(n, off, end) { if (n === doc) return doc.childNodes[end ? Math.max(0, off - 1) : Math.min(off, doc.childNodes.length - 1)] || null; while (n && n.parentNode !== doc) n = n.parentNode; return n; }
// Pasted or inserted text can arrive as one plain box holding all the paragraphs; columns work on the paragraphs themselves.
function flattenTop() { for (let i = 0; i < 4; i++) { const only = doc.children.length === 1 && [...doc.childNodes].every(n => n.nodeType === 1 || !n.data.trim()) ? doc.firstElementChild : null; if (!only || only.tagName !== 'DIV' || only.className || only.getAttribute('style') || ![...only.children].some(k => /^(DIV|P|H[1-6]|UL|OL|TABLE|BLOCKQUOTE|PRE)$/.test(k.tagName))) return; only.replaceWith(...only.childNodes); } }
function setColumns(o, whole) {
  restoreSel(); flattenTop(); const s = getSelection(), r = s.rangeCount && doc.contains(s.anchorNode) ? s.getRangeAt(0) : null, cur = r && colsAt(r.startContainer);
  o = { n: Math.max(1, Math.min(8, Math.round(o.n) || 1)), gap: Math.max(0.1, Math.min(2, +o.gap || 0.5)), line: !!o.line };
  const unwrap = el => el.replaceWith(...el.childNodes), make = () => { const w = document.createElement('div'); w.className = 'cols'; colStyle(w, o); return w; };
  let a = r && !r.collapsed ? topChild(r.startContainer, r.startOffset, false) : null, b = a ? topChild(r.endContainer, r.endOffset, true) : null;
  if (a && b && a === doc.firstChild && b === doc.lastChild) { whole = true; }
  if (cur && !whole) { if (o.n <= 1) unwrap(cur); else colStyle(cur, o); }
  else if (a && b && !whole) {
    if (o.n <= 1) { for (let n = a; n; n = n === b ? null : n.nextSibling) if (n.nodeType === 1 && n.classList.contains('cols')) { const nx = n === b ? null : n.nextSibling; unwrap(n); if (!nx) break; } }
    else {
      const list = []; for (let n = a; n; n = n.nextSibling) { list.push(n); if (n === b) break; }
      const w = make(); a.before(w);
      for (const n of list) { if (n.nodeType === 1 && n.classList.contains('cols')) { w.append(...n.childNodes); n.remove(); } else if (n.nodeType === 3) { const d = document.createElement('div'); d.textContent = n.data; n.remove(); if (d.textContent.trim()) w.append(d); } else w.append(n); }
      if (!w.nextSibling) { const d = document.createElement('div'); d.innerHTML = '<br>'; w.after(d); } // room to type after the columns
    }
  } else {
    doc.querySelectorAll('.cols').forEach(unwrap);
    if (o.n > 1) { const w = make(); w.append(...doc.childNodes); if (!w.firstChild) w.innerHTML = '<div><br></div>'; doc.append(w); const rr = document.createRange(); rr.selectNodeContents(w); rr.collapse(false); s.removeAllRanges(); s.addRange(rr); saveSel(); }
  }
  if (o.n <= 1) doc.querySelectorAll('.colbreak').forEach(x => { if (!colsAt(x)) x.remove(); });
  changed(); posImgSel();
}
function columnBreak() {
  restoreSel(); const s = getSelection();
  if (!s.rangeCount || !colsAt(s.getRangeAt(0).startContainer)) { toast('A column break works in text set in columns. Choose Layout > Columns first.', 4500); return; }
  insertHtml('<div class="colbreak" contenteditable="false"></div><div><br></div>');
}
$('colsBtn').onclick = () => {
  saveSel(); const cur = keptRange && doc.contains(keptRange.startContainer) ? colsAt(keptRange.startContainer) : null, picked = !!keptRange && !keptRange.collapsed && doc.contains(keptRange.startContainer);
  const all = doc.children.length === 1 && doc.firstElementChild.classList.contains('cols'), i = cur ? colInfo(cur) : { n: 1, gap: 0.5, line: false };
  const where = cur ? (all ? 'the whole page' : 'this part of the page') : picked ? 'the selected text' : 'the whole page';
  const row = (label, n) => [(i.n === n ? '✓ ' : '') + label, () => setColumns({ ...i, n })];
  menu($('colsBtn'), [{ head: 'Columns for ' + where }, row('One', 1), row('Two', 2), row('Three', 3), row('Four', 4), null,
    [(i.line ? '✓ ' : '') + 'Line between columns', i.n > 1 ? () => setColumns({ ...i, line: !i.line }) : null],
    ['More columns…', async () => { const v = await ask('Columns', [{ id: 'n', label: 'Number of columns (1 to 8)', value: String(i.n > 1 ? i.n : 2) }, { id: 'gap', label: 'Space between columns, in inches', value: String(i.gap) }], 'Apply'); if (v) setColumns({ n: parseInt(v.n) || 1, gap: parseFloat(String(v.gap).replace(',', '.')) || 0.5, line: i.line }); }],
    null, ['Insert column break', () => columnBreak(), 'Ctrl+Shift+Enter'],
    ...(cur && !all ? [['Use these columns for the whole page', () => setColumns(i, true)]] : [])]);
};
$('wrap').onclick = () => { const on = $('wrap').getAttribute('aria-pressed') !== 'true'; $('wrap').setAttribute('aria-pressed', on); doc.classList.toggle('nowrap', !on); };
const zoomF = () => parseFloat(doc.style.zoom) || 1;
function setZoom(z) { z = Math.max(0.25, Math.min(3, z)); doc.style.zoom = z; const o = [...$('zoom').options]; let opt = o.find(x => Math.abs(+x.value - z) < 0.001); if (!opt) { opt = document.createElement('option'); opt.value = String(z); opt.textContent = Math.round(z * 100) + '%'; $('zoom').querySelectorAll('[data-fit]').forEach(x => x.remove()); opt.dataset.fit = '1'; $('zoom').append(opt); } $('zoom').value = opt.value; posImgSel(); }
$('zoom').onchange = e => setZoom(+e.target.value);
$('fitWidth').onclick = () => setZoom(Math.floor((wrapEl.clientWidth - 40) / (pageDims(pageSetup()).w * 96) * 100) / 100);
wrapEl.addEventListener('wheel', e => { if (!e.ctrlKey) return; e.preventDefault(); const o = [0.5, 0.75, 0.9, 1, 1.25, 1.5, 2], z = zoomF(); setZoom(e.deltaY < 0 ? (o.find(v => v > z + 0.001) || 2) : ([...o].reverse().find(v => v < z - 0.001) || 0.5)); }, { passive: false });

// ---------- text tools (work on the selection, or on everything when nothing is selected) ----------
function selText() { const s = getSelection(); return s.rangeCount && !s.isCollapsed && doc.contains(s.anchorNode) ? s.toString() : null; }
function replaceSelOrAll(fn) { let t = selText(); const all = t == null; if (all) { selectAll(); t = plain(); } const out = fn(t); if (out === t) { toast('Nothing to change.'); return; } doc.focus(); document.execCommand('insertHTML', false, all ? textToHtml(out) : out.split('\n').map(esc).join('<br>')); changed(); }
const titleCase = s => s.toLowerCase().replace(/(^|[\s\t"'(\[-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
const sentenceCase = s => s.toLowerCase().replace(/(^\s*|[.!?]\s+|\n\s*)(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
const TOOLS = [
  ['Join lines into one paragraph', t => t.split('\n').map(s => s.trim()).filter(Boolean).join(' ').replace(/(\w)- (\w)/g, '$1$2')],
  ['Join wrapped lines (keep paragraphs)', t => t.split(/\n\s*\n/).map(p => p.split('\n').map(s => s.trim()).filter(Boolean).join(' ')).join('\n\n')],
  ['Remove blank lines', t => t.split('\n').filter(s => s.trim()).join('\n')],
  ['Fix spacing (extra spaces, spaces at line ends)', t => t.split('\n').map(s => s.replace(/[  ]{2,}/g, ' ').replace(/ +([,.;:!?%)\]])/g, '$1').replace(/([(\[]) +/g, '$1').trim()).join('\n')],
  ['Columns: tabs to spaces', t => t.replace(/\t+/g, '  ')],
  null,
  ['UPPERCASE', t => t.toUpperCase()], ['lowercase', t => t.toLowerCase()], ['Title Case', titleCase], ['Sentence case', sentenceCase],
  null,
  ['Straight quotes and dashes', t => t.replace(/[‘’‚′]/g, "'").replace(/[“”„″]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...')],
  ['Keep only numbers and symbols', t => t.split('\n').map(s => (s.match(/[-+$£€¥]?\d[\d.,:/%-]*/g) || []).join('\t')).filter(Boolean).join('\n')],
  ['Sort lines A–Z', t => t.split('\n').sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })).join('\n')],
  ['Remove duplicate lines', t => [...new Set(t.split('\n'))].join('\n')]];

// ---------- menus and dialogs ----------
function closeMenus() { document.querySelectorAll('.menu').forEach(m => m.remove()); }
function placeMenu(m, x, y) { document.body.append(m); m.style.left = Math.max(4, Math.min(x, innerWidth - m.offsetWidth - 8)) + 'px'; m.style.top = Math.max(4, y + m.offsetHeight > innerHeight - 8 ? y - m.offsetHeight : y) + 'px'; setTimeout(() => addEventListener('mousedown', function off(e) { if (!m.contains(e.target)) { m.remove(); removeEventListener('mousedown', off); } }), 0); }
function buildMenu(rows) {
  const m = document.createElement('div'); m.className = 'menu'; m.setAttribute('role', 'menu');
  for (const r of rows) {
    if (!r) { m.append(document.createElement('hr')); continue; }
    if (r.head) { const h = document.createElement('div'); h.className = 'head'; h.textContent = r.head; m.append(h); continue; }
    const b = document.createElement('button'); b.setAttribute('role', 'menuitem'); b.innerHTML = `<span>${esc(r[0])}</span>${r[2] ? `<kbd>${esc(r[2])}</kbd>` : ''}`;
    if (r[3]?.cls) b.className = r[3].cls; if (r[3]?.disabled || !r[1]) b.disabled = true;
    b.onmousedown = e => e.preventDefault(); b.onclick = () => { m.remove(); r[1](); }; m.append(b);
  }
  return m;
}
function menu(anchor, rows) { closeMenus(); const a = anchor.getBoundingClientRect(); placeMenu(buildMenu(rows), a.left, a.bottom + 4); }
function popup(anchor, content) { closeMenus(); const m = document.createElement('div'); m.className = 'menu'; m.style.minWidth = '0'; m.append(content); m.addEventListener('mousedown', e => { if (e.target.closest('button,i')) e.preventDefault(); }); const a = anchor.getBoundingClientRect(); placeMenu(m, a.left, a.bottom + 4); }
function ask(title, fields, okLabel = 'OK', html) {
  return new Promise(res => {
    const m = document.createElement('div'); m.className = 'modal'; const f = document.createElement('form');
    f.innerHTML = `<h2>${esc(title)}</h2>${html || ''}${(fields || []).map(x => `<label>${esc(x.label)}<input type="text" name="${x.id}" value="${esc(x.value || '')}" placeholder="${esc(x.placeholder || '')}" spellcheck="false"></label>`).join('')}<div class="row">${okLabel ? '<button type="button" data-x="no">Cancel</button>' : ''}<button class="pri" type="submit">${esc(okLabel || 'Close')}</button></div>`;
    m.append(f); document.body.append(m); const first = f.querySelector('input') || f.querySelector('.pri'); first.focus(); if (first.select) first.select();
    const done = v => { m.remove(); res(v); };
    f.onsubmit = e => { e.preventDefault(); const v = {}; for (const x of fields || []) v[x.id] = f.elements[x.id].value; done(okLabel ? v : null); };
    f.querySelector('[data-x=no]')?.addEventListener('click', () => done(null));
    m.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } });
    m.addEventListener('mousedown', e => { if (e.target === m) done(null); });
  });
}
$('tools').onclick = () => menu($('tools'), TOOLS.map(r => r && [r[0], () => replaceSelOrAll(r[1])]));
// Lines with tab-separated columns become a table (copies into Word and Excel as a real table)
$('table').onclick = () => {
  let t = selText(); if (t == null) { selectAll(); t = plain(); } const lines = t.split('\n'); if (!lines.some(l => l.includes('\t'))) { toast('No columns found. Grab Text puts a tab between table columns.'); return; }
  let html = '', rows = []; const flush = () => { if (!rows.length) return; const n = Math.max(...rows.map(r => r.length)); html += '<table>' + rows.map(r => '<tr>' + Array.from({ length: n }, (_, i) => '<td>' + (r[i] ? esc(r[i]) : '<br>') + '</td>').join('') + '</tr>').join('') + '</table>'; rows = []; };
  for (const l of lines) { if (l.includes('\t')) rows.push(l.split('\t')); else { flush(); html += '<div>' + (l ? esc(l) : '<br>') + '</div>'; } } flush(); doc.focus(); document.execCommand('insertHTML', false, html); changed();
};
$('spellBtn').onclick = () => { const on = !doc.spellcheck; doc.spellcheck = on; $('spellBtn').setAttribute('aria-pressed', on); doc.blur(); doc.focus(); toast(on ? 'Spelling mistakes are underlined. Right-click one for suggestions.' : 'Spelling underlines are off.'); };
$('wcBtn').onclick = () => {
  const t = plain(), w = (t.match(/\S+/g) || []).length, paras = t.split(/\n/).filter(s => s.trim()).length, pg = $('counts').textContent.match(/(\d+) pages?$/);
  ask('Word count', null, null, `<table><tr><td>Pages (about)</td><td>${pg ? pg[1] : 1}</td></tr><tr><td>Words</td><td>${w}</td></tr><tr><td>Characters (no spaces)</td><td>${t.replace(/\s/g, '').length}</td></tr><tr><td>Characters (with spaces)</td><td>${t.length}</td></tr><tr><td>Paragraphs</td><td>${paras}</td></tr><tr><td>Pictures</td><td>${doc.querySelectorAll('img').length}</td></tr></table>`);
};

// ---------- find and replace ----------
let hits = [], hitI = -1;
function findAll() { hits = []; hitI = -1; const q = $('fq').value; if (!q) { $('findCount').textContent = ''; return; } const cs = $('fcase').checked, needle = cs ? q : q.toLowerCase(), w = document.createTreeWalker(doc, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const s = cs ? n.data : n.data.toLowerCase(); let i = 0; while ((i = s.indexOf(needle, i)) >= 0) { hits.push({ n, i, len: q.length }); i += q.length; } } $('findCount').textContent = hits.length ? `${hits.length} found` : 'Not found'; }
function goHit(dir) {
  findAll(); if (!hits.length) return; const s = getSelection(); let from = 0;
  if (s.rangeCount && doc.contains(s.anchorNode)) { const r = s.getRangeAt(0); from = hits.findIndex(h => { const c = document.createRange(); c.setStart(h.n, h.i); return r.compareBoundaryPoints(Range.START_TO_START, c) < (dir > 0 ? 0 : 1); }); if (dir > 0 && from < 0) from = 0; if (dir < 0) from = (from <= 0 ? hits.length : from) - 1; } else if (dir < 0) from = hits.length - 1;
  if (dir > 0 && s.rangeCount && !s.isCollapsed && from >= 0) { const h = hits[from], r = s.getRangeAt(0); if (r.startContainer === h.n && r.startOffset === h.i) from = (from + 1) % hits.length; }
  hitI = from; const h = hits[hitI], r = document.createRange(); r.setStart(h.n, h.i); r.setEnd(h.n, h.i + h.len); s.removeAllRanges(); s.addRange(r); (h.n.parentElement || doc).scrollIntoView({ block: 'nearest' }); $('findCount').textContent = `${hitI + 1} of ${hits.length}`;
}
function openFind(rep) { showTab('tools'); $('findBar').hidden = false; const t = selText(); if (t && !t.includes('\n')) $('fq').value = t; (rep && $('fq').value ? $('fr') : $('fq')).focus(); $('fq').select(); findAll(); }
function closeFind(silent) { $('findBar').hidden = true; if (!silent) doc.focus(); }
function selIsHit() { const s = getSelection(), q = $('fq').value; if (!q || !s.rangeCount || !doc.contains(s.anchorNode)) return false; const t = s.toString(); return $('fcase').checked ? t === q : t.toLowerCase() === q.toLowerCase(); }
$('findBtn').onclick = () => $('findBar').hidden ? openFind(false) : closeFind(); $('fclose').onclick = () => closeFind();
$('fq').oninput = findAll; $('fcase').onchange = findAll; $('fnext').onclick = () => goHit(1); $('fprev').onclick = () => goHit(-1);
$('fq').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); goHit(e.shiftKey ? -1 : 1); } }; $('fr').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('frep').click(); } };
$('frep').onclick = () => { if (!selIsHit()) { goHit(1); return; } doc.focus(); document.execCommand('insertText', false, $('fr').value); changed(); goHit(1); };
$('frepAll').onclick = () => { findAll(); const n = hits.length; if (!n) return; for (let k = hits.length - 1; k >= 0; k--) { const h = hits[k], r = document.createRange(); r.setStart(h.n, h.i); r.setEnd(h.n, h.i + h.len); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand('insertText', false, $('fr').value); } changed(); findAll(); toast(`Replaced ${n}`); };

// ---------- pictures: insert, drop, paste ----------
const contentW = () => doc.clientWidth - (parseFloat(getComputedStyle(doc).paddingLeft) || 0) - (parseFloat(getComputedStyle(doc).paddingRight) || 0);
function readImage(file) { return new Promise((res, rej) => { const u = URL.createObjectURL(file), img = new Image(); img.onload = () => res({ img, u }); img.onerror = () => { URL.revokeObjectURL(u); rej(Error(file.name + ' could not be opened as a picture.')); }; img.src = u; }); }
async function fileToDataUrl(file) {
  const { img, u } = await readImage(file);
  try {
    const max = 2000, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), keep = k === 1 && /^image\/(png|jpeg)$/.test(file.type) && file.size < 6e6;
    let url;
    if (keep) url = await new Promise((r, j) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = j; fr.readAsDataURL(file); });
    else { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k)); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); url = file.type === 'image/jpeg' ? c.toDataURL('image/jpeg', 0.92) : c.toDataURL('image/png'); if (url.length > 4e6) url = c.toDataURL('image/jpeg', 0.9); }
    return { url, w: Math.round(img.naturalWidth * k), h: Math.round(img.naturalHeight * k) };
  } finally { URL.revokeObjectURL(u); }
}
async function insertImageFiles(files) {
  const pics = files.filter(f => /^image\//.test(f.type)); if (!pics.length) return false;
  const parts = [];
  for (const f of pics) { try { const d = await fileToDataUrl(f); const w = Math.min(d.w, Math.round(contentW())); parts.push(`<img src="${d.url}" style="width:${w}px" alt="${esc(f.name.replace(/\.[^.]+$/, ''))}"`); } catch (e) { toast(errMsg(e), 5000); } }
  if (parts.length) { restoreSel(); document.execCommand('insertHTML', false, parts.map((h, i) => h + (i === parts.length - 1 ? ' data-pick="1">' : '>')).join('')); changed(); const last = doc.querySelector('img[data-pick]'); if (last) { last.removeAttribute('data-pick'); if (parts.length === 1) setTimeout(() => selectImg(last), 30); } }
  return true;
}
addEventListener('dragover', e => { const files = [...(e.dataTransfer?.items || [])].some(i => i.kind === 'file'); if (!files) { if (!doc.contains(e.target)) { e.preventDefault(); e.dataTransfer.dropEffect = 'none'; } return; } e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; doc.classList.toggle('dropping', doc.contains(e.target)); });
addEventListener('dragleave', e => { if (!e.relatedTarget) doc.classList.remove('dropping'); });
addEventListener('drop', async e => {
  doc.classList.remove('dropping'); const files = [...(e.dataTransfer?.files || [])];
  if (!files.length) { if (!doc.contains(e.target)) e.preventDefault(); return; } // text dragged inside the page moves as usual
  e.preventDefault();
  const imgs = files.filter(f => /^image\//.test(f.type)), docs = files.filter(f => /\.(docx|txt|md|html?|csv|log)$/i.test(f.name));
  if (imgs.length) { const r = document.caretRangeFromPoint(e.clientX, e.clientY); if (r && doc.contains(r.startContainer)) { const s = getSelection(); s.removeAllRanges(); s.addRange(r); keptRange = r.cloneRange(); } else saveSel(); await insertImageFiles(imgs); }
  for (const f of docs) await openFromFile({ name: f.name.replace(/\.[^.]+$/, ''), ext: f.name.split('.').pop().toLowerCase(), file: f });
  if (!imgs.length && !docs.length) toast('Only pictures and documents (.docx, .txt, .html) can be dropped here.', 4000);
});
// Pasting: pictures go in as pictures; formatted text keeps simple formatting but drops colours made for other pages
doc.addEventListener('paste', e => {
  const cd = e.clipboardData, files = [...(cd.files || [])].filter(f => /^image\//.test(f.type)), h = cd.getData('text/html');
  if (files.length && !/<img/i.test(h || '')) { e.preventDefault(); saveSel(); insertImageFiles(files); return; }
  if (!h) return; e.preventDefault(); document.execCommand('insertHTML', false, sanitize(h.replace(/^[\s\S]*<!--StartFragment-->|<!--EndFragment-->[\s\S]*$/g, ''), true)); changed();
});

// ---------- pictures: select, resize, crop, rotate, wrap ----------
let selImg = null, cropBox = null, rafId = 0;
const sel = $('imgsel');
function imgIsSelected() { const s = getSelection(); if (!s.rangeCount || !selImg) return false; const r = s.getRangeAt(0); return r.startContainer === selImg.parentNode && r.endOffset - r.startOffset === 1 && r.startContainer.childNodes[r.startOffset] === selImg; }
function selectImg(img) {
  if (!img || !doc.contains(img)) return; if (cropBox) endCrop(false);
  selImg = img; doc.focus(); const r = document.createRange(); r.selectNode(img); const s = getSelection(); s.removeAllRanges(); s.addRange(r); keptRange = r.cloneRange();
  sel.hidden = false; imgBar(); posImgSel(); cancelAnimationFrame(rafId); const loop = () => { if (!selImg) return; if (!selImg.isConnected) { hideImgSel(); return; } posImgSel(); rafId = requestAnimationFrame(loop); }; rafId = requestAnimationFrame(loop);
}
function hideImgSel() { if (cropBox) endCrop(false); selImg = null; sel.hidden = true; cancelAnimationFrame(rafId); $('imgsize').hidden = true; }
function posImgSel() {
  if (!selImg || sel.hidden) return; const r = selImg.getBoundingClientRect(), w = wrapEl.getBoundingClientRect();
  sel.style.left = (r.left - w.left + wrapEl.scrollLeft) + 'px'; sel.style.top = (r.top - w.top + wrapEl.scrollTop) + 'px'; sel.style.width = r.width + 'px'; sel.style.height = r.height + 'px';
  $('imgbar').classList.toggle('below', r.top - w.top < 48);
}
function wrapOf(img) { const s = img.style; return s.float === 'left' ? 'left' : s.float === 'right' ? 'right' : s.display === 'block' ? 'center' : 'inline'; }
const WRAP = { inline: '', left: 'float:left;margin:4px 14px 8px 0;', right: 'float:right;margin:4px 0 8px 14px;', center: 'display:block;margin:8px auto;' };
function imgHtml(img, o = {}) {
  const z = zoomF(), r = img.getBoundingClientRect(), w = o.w ?? (parseFloat(img.style.width) || r.width / z), h = o.h === undefined ? (img.style.height ? parseFloat(img.style.height) : null) : o.h;
  const wrap = o.wrap || wrapOf(img), src = o.src || img.getAttribute('src'), alt = img.getAttribute('alt') || '';
  return `<img data-pick="1" src="${src}" alt="${esc(alt)}" style="width:${Math.round(w)}px;${h ? `height:${Math.round(h)}px;` : ''}${WRAP[wrap]}">`;
}
// Replacing through the editor's own command keeps every picture change on the Undo list (Ctrl+Z)
function replaceImg(img, html) {
  const r = document.createRange(); r.selectNode(img); const s = getSelection(); s.removeAllRanges(); s.addRange(r); doc.focus();
  document.execCommand('insertHTML', false, html); const n = doc.querySelector('img[data-pick]'); if (n) { n.removeAttribute('data-pick'); changed(); selectImg(n); } else changed();
}
function imgBar() {
  const b = $('imgbar'), wrap = wrapOf(selImg);
  const btn = (label, title, fn, pressed) => `<button data-a="${fn}" title="${esc(title)}"${pressed != null ? ` aria-pressed="${pressed}"` : ''}>${label}</button>`;
  b.innerHTML = cropBox
    ? btn('Apply crop', 'Keep the area inside the box (Enter)', 'cropOk') + btn('Cancel', 'Leave the picture as it was (Esc)', 'cropNo')
    : btn('Crop', 'Crop the picture', 'crop') + btn('Rotate', 'Turn the picture a quarter turn to the right', 'rot') + '<span class="sep"></span>'
      + btn('In line', 'Sits in the line of text like a letter', 'w-inline', wrap === 'inline') + btn('Wrap left', 'Picture on the left, text flows around it', 'w-left', wrap === 'left') + btn('Wrap right', 'Picture on the right, text flows around it', 'w-right', wrap === 'right') + btn('Centre', 'On its own line, centred', 'w-center', wrap === 'center')
      + '<span class="sep"></span>' + btn('Reset size', 'Original size, up to the page width', 'orig') + btn('Delete', 'Remove the picture (Del)', 'del');
}
$('imgbar').addEventListener('click', e => {
  const a = e.target.closest('button')?.dataset.a; if (!a || !selImg) return;
  if (a === 'crop') startCrop(); else if (a === 'cropOk') endCrop(true); else if (a === 'cropNo') endCrop(false);
  else if (a === 'rot') rotateImg(); else if (a.startsWith('w-')) replaceImg(selImg, imgHtml(selImg, { wrap: a.slice(2) }));
  else if (a === 'orig') replaceImg(selImg, imgHtml(selImg, { w: Math.min(selImg.naturalWidth, contentW()), h: null }));
  else if (a === 'del') { const img = selImg; hideImgSel(); const r = document.createRange(); r.selectNode(img); const s = getSelection(); s.removeAllRanges(); s.addRange(r); doc.focus(); document.execCommand('delete'); changed(); }
});
doc.addEventListener('mousedown', e => { if (e.target.tagName === 'IMG') { e.preventDefault(); selectImg(e.target); } });
doc.addEventListener('dragstart', e => { if (e.target.tagName === 'IMG') e.preventDefault(); });
// resize by the handles; drag the picture itself to move it
sel.addEventListener('pointerdown', e => {
  if (!selImg || cropBox || e.button !== 0 || e.target.closest('#imgbar')) return;
  e.preventDefault(); const hnd = e.target.dataset.h, img = selImg, z = zoomF(), r0 = img.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY, ratio = r0.width / r0.height, style0 = img.getAttribute('style') || '', maxW = contentW() * z;
  sel.setPointerCapture(e.pointerId); let moved = false, w = r0.width, h = r0.height, stretched = !!img.style.height;
  const sizeTag = $('imgsize');
  const move = ev => {
    const dx = ev.clientX - x0, dy = ev.clientY - y0; if (Math.abs(dx) + Math.abs(dy) > 3) moved = true; if (!moved) return;
    if (!hnd) { sel.style.transform = `translate(${dx}px,${dy}px)`; sel.style.opacity = '.7'; return; }
    const sx = hnd.includes('e') ? 1 : hnd.includes('w') ? -1 : 0, sy = hnd.includes('s') ? 1 : hnd.includes('n') ? -1 : 0;
    if (sx && sy && !ev.shiftKey) { const a = r0.width + sx * dx, b = (r0.height + sy * dy) * ratio; w = Math.max(16, Math.min(maxW, Math.abs(a - r0.width) >= Math.abs(b - r0.width) ? a : b)); h = w / ratio; stretched = false; }
    else { if (sx) w = Math.max(16, Math.min(maxW, r0.width + sx * dx)); if (sy) h = Math.max(16, r0.height + sy * dy); stretched = true; }
    img.style.width = (w / z) + 'px'; img.style.height = stretched ? (h / z) + 'px' : ''; sizeTag.hidden = false; sizeTag.textContent = `${Math.round(w / z)} × ${Math.round((stretched ? h : w / ratio) / z)} px`; posImgSel();
  };
  const up = ev => {
    sel.removeEventListener('pointermove', move); sel.removeEventListener('pointerup', up); sel.removeEventListener('pointercancel', up); sizeTag.hidden = true; sel.style.transform = ''; sel.style.opacity = '';
    if (!moved) return;
    if (!hnd) { // move the picture to where it was dropped
      sel.hidden = true; const target = document.caretRangeFromPoint(ev.clientX, ev.clientY); sel.hidden = false;
      if (!target || !doc.contains(target.startContainer) || target.startContainer === img) return;
      const html = imgHtml(img); const marker = document.createElement('span'); marker.id = 'mv-mark'; target.insertNode(marker);
      const r = document.createRange(); r.selectNode(img); let s = getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand('delete');
      const m = $('mv-mark'); if (!m) return; const r2 = document.createRange(); r2.setStartBefore(m); r2.setEndAfter(m); s = getSelection(); s.removeAllRanges(); s.addRange(r2);
      document.execCommand('insertHTML', false, html); $('mv-mark')?.remove(); const n = doc.querySelector('img[data-pick]'); if (n) { n.removeAttribute('data-pick'); selectImg(n); } changed(); return;
    }
    const fw = w / z, fh = stretched ? h / z : null; img.setAttribute('style', style0); replaceImg(img, imgHtml(img, { w: fw, h: fh }));
  };
  sel.addEventListener('pointermove', move); sel.addEventListener('pointerup', up); sel.addEventListener('pointercancel', up);
});
function startCrop() { cropBox = { l: 0, t: 0, r: 1, b: 1 }; sel.classList.add('cropping'); $('crop').hidden = false; drawCrop(); imgBar(); }
function drawCrop() { const c = $('crop'); c.style.left = cropBox.l * 100 + '%'; c.style.top = cropBox.t * 100 + '%'; c.style.width = (cropBox.r - cropBox.l) * 100 + '%'; c.style.height = (cropBox.b - cropBox.t) * 100 + '%'; }
function endCrop(apply) {
  const img = selImg, box = cropBox; cropBox = null; sel.classList.remove('cropping'); $('crop').hidden = true; if (!img) return; imgBar();
  if (!apply || (box.l < 0.001 && box.t < 0.001 && box.r > 0.999 && box.b > 0.999)) return;
  const nw = img.naturalWidth, nh = img.naturalHeight, c = document.createElement('canvas'); c.width = Math.max(1, Math.round((box.r - box.l) * nw)); c.height = Math.max(1, Math.round((box.b - box.t) * nh));
  try { c.getContext('2d').drawImage(img, box.l * nw, box.t * nh, c.width, c.height, 0, 0, c.width, c.height); } catch (_) { toast('This picture cannot be cropped.'); return; }
  let src; try { src = /^data:image\/jpeg/i.test(img.src) ? c.toDataURL('image/jpeg', 0.92) : c.toDataURL('image/png'); } catch (_) { toast('This picture comes from a web page and cannot be cropped here.', 5000); return; }
  const z = zoomF(), r = img.getBoundingClientRect(), w = r.width / z * (box.r - box.l), h = img.style.height ? r.height / z * (box.b - box.t) : null;
  replaceImg(img, imgHtml(img, { src, w, h }));
}
$('crop').addEventListener('pointerdown', e => {
  e.preventDefault(); e.stopPropagation(); const c = e.target.dataset.c, el = $('crop'), R = sel.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY, b0 = { ...cropBox }; el.setPointerCapture(e.pointerId);
  const move = ev => { const dx = (ev.clientX - x0) / R.width, dy = (ev.clientY - y0) / R.height, b = { ...b0 }, min = 0.03;
    if (!c) { const w = b0.r - b0.l, h = b0.b - b0.t; b.l = Math.max(0, Math.min(1 - w, b0.l + dx)); b.t = Math.max(0, Math.min(1 - h, b0.t + dy)); b.r = b.l + w; b.b = b.t + h; }
    else { if (c.includes('w')) b.l = Math.max(0, Math.min(b0.r - min, b0.l + dx)); if (c.includes('e')) b.r = Math.min(1, Math.max(b0.l + min, b0.r + dx)); if (c.includes('n')) b.t = Math.max(0, Math.min(b0.b - min, b0.t + dy)); if (c.includes('s')) b.b = Math.min(1, Math.max(b0.t + min, b0.b + dy)); }
    cropBox = b; drawCrop(); };
  const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
  el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
});
function rotateImg() {
  const img = selImg, c = document.createElement('canvas'); c.width = img.naturalHeight; c.height = img.naturalWidth; const g = c.getContext('2d'); g.translate(c.width, 0); g.rotate(Math.PI / 2);
  try { g.drawImage(img, 0, 0); } catch (_) { toast('This picture cannot be rotated.'); return; }
  let src; try { src = /^data:image\/jpeg/i.test(img.src) ? c.toDataURL('image/jpeg', 0.92) : c.toDataURL('image/png'); } catch (_) { toast('This picture comes from a web page and cannot be rotated here.', 5000); return; }
  const z = zoomF(), r = img.getBoundingClientRect(); let w = r.height / z, h = img.style.height ? r.width / z : null; const mw = contentW(); if (w > mw) { if (h) h = h * mw / w; w = mw; }
  replaceImg(img, imgHtml(img, { src, w, h }));
}

// ---------- tables ----------
function tableOp(cell, op, toCol) {
  const tbl = cell.closest('table'), row = cell.parentElement, ri = row.rowIndex, ci = cell.cellIndex, clone = tbl.cloneNode(true), rows = [...clone.rows];
  const blank = () => { const td = document.createElement('td'); td.innerHTML = '<br>'; return td; };
  let pick = [ri, ci];
  if (op === 'rowAbove' || op === 'rowBelow') { const n = rows[ri].cloneNode(false); for (const c of rows[ri].cells) { const td = blank(); td.colSpan = c.colSpan; td.style.cssText = c.style.cssText; n.append(td); } rows[ri].parentElement.insertBefore(n, op === 'rowAbove' ? rows[ri] : rows[ri].nextSibling); pick = [op === 'rowAbove' ? ri : ri + 1, toCol ?? ci]; }
  else if (op === 'colLeft' || op === 'colRight') { for (const r of rows) { const ref = r.cells[Math.min(ci, r.cells.length - 1)]; const td = blank(); if (!ref) r.append(td); else r.insertBefore(td, op === 'colLeft' ? ref : ref.nextSibling); } clone.querySelectorAll('td,th').forEach(c => { c.style.width = ''; }); pick = [ri, op === 'colLeft' ? ci : ci + 1]; }
  else if (op === 'delRow') { if (rows.length < 2) return tableOp(cell, 'delTable'); rows[ri].remove(); pick = [Math.min(ri, rows.length - 2), ci]; }
  else if (op === 'delCol') { if (Math.max(...rows.map(r => r.cells.length)) < 2) return tableOp(cell, 'delTable'); for (const r of rows) r.cells[Math.min(ci, r.cells.length - 1)]?.remove(); clone.querySelectorAll('td,th').forEach(c => { c.style.width = ''; }); pick = [ri, Math.max(0, ci - 1)]; }
  else if (op === 'delTable') { const r = document.createRange(); r.selectNode(tbl); const s = getSelection(); s.removeAllRanges(); s.addRange(r); doc.focus(); document.execCommand('delete'); changed(); return; }
  const target = clone.rows[pick[0]]?.cells[pick[1]]; if (target) target.dataset.pick = '1';
  const r = document.createRange(); r.selectNode(tbl); const s = getSelection(); s.removeAllRanges(); s.addRange(r); doc.focus(); document.execCommand('insertHTML', false, clone.outerHTML);
  const n = doc.querySelector('[data-pick]'); if (n) { n.removeAttribute('data-pick'); const rr = document.createRange(); rr.selectNodeContents(n); rr.collapse(true); s.removeAllRanges(); s.addRange(rr); } changed();
}
function cellAtCaret() { const s = getSelection(); const n = s.rangeCount ? s.getRangeAt(0).startContainer : null, el = n && (n.nodeType === 1 ? n : n.parentElement); const c = el && el.closest('td,th'); return c && doc.contains(c) ? c : null; }

// ---------- right-click menu (spelling suggestions come from the Windows spell checker) ----------
window.te.onContext(d => {
  closeMenus(); const el = document.elementFromPoint(d.x, d.y) || doc, inDoc = doc.contains(el) || sel.contains(el), rows = [];
  if (d.word) { rows.push({ head: 'Spelling' }); if (d.sugg.length) for (const s of d.sugg) rows.push([s, () => { window.te.ctx({ act: 'replace', word: s }); setTimeout(changed, 50); }, '', { cls: 'sugg' }]); else rows.push(['No suggestions', null]); rows.push(['Add to dictionary', () => window.te.ctx({ act: 'addword', word: d.word })], null); }
  const img = sel.contains(el) ? selImg : el.tagName === 'IMG' && doc.contains(el) ? el : null;
  if (img) { if (img !== selImg) selectImg(img); rows.push({ head: 'Picture' }, ['Crop', startCrop], ['Rotate right', rotateImg], ['In line with text', () => replaceImg(selImg, imgHtml(selImg, { wrap: 'inline' }))], ['Wrap text, picture on the left', () => replaceImg(selImg, imgHtml(selImg, { wrap: 'left' }))], ['Wrap text, picture on the right', () => replaceImg(selImg, imgHtml(selImg, { wrap: 'right' }))], ['Centre on its own line', () => replaceImg(selImg, imgHtml(selImg, { wrap: 'center' }))], ['Reset size', () => replaceImg(selImg, imgHtml(selImg, { w: Math.min(selImg.naturalWidth, contentW()), h: null }))], ['Copy picture', () => { document.execCommand('copy'); toast('Picture copied'); }], ['Delete picture', () => $('imgbar').querySelector('[data-a=del]')?.click()], null); }
  const cell = inDoc && el.closest && el.closest('td,th');
  if (cell && doc.contains(cell)) rows.push({ head: 'Table' }, ['Insert row above', () => tableOp(cell, 'rowAbove')], ['Insert row below', () => tableOp(cell, 'rowBelow')], ['Insert column left', () => tableOp(cell, 'colLeft')], ['Insert column right', () => tableOp(cell, 'colRight')], ['Delete row', () => tableOp(cell, 'delRow')], ['Delete column', () => tableOp(cell, 'delCol')], ['Delete table', () => tableOp(cell, 'delTable')], null, ...(typeof tableMore === 'function' ? tableMore(cell) : []));
  const a = inDoc && el.closest && el.closest('a');
  if (a && doc.contains(a)) rows.push({ head: 'Link' }, ['Open link', () => window.te.ctx({ act: 'openLink', url: a.getAttribute('href') }), 'Ctrl+click'], ['Edit link…', () => editLink(a)], ['Remove link', () => { const r = document.createRange(); r.selectNodeContents(a); const s = getSelection(); s.removeAllRanges(); s.addRange(r); keptRange = r; ex('unlink'); }], null);
  if (!d.editable && !inDoc && !d.canCopy) return;
  rows.push(['Cut', d.canCut ? () => { document.execCommand('cut'); changed(); } : null, 'Ctrl+X'], ['Copy', d.canCopy ? () => document.execCommand('copy') : null, 'Ctrl+C'], ['Paste', d.canPaste ? () => window.te.ctx({ act: 'paste' }) : null, 'Ctrl+V'], ['Paste as plain text', d.canPaste ? () => window.te.ctx({ act: 'pastePlain' }) : null, 'Ctrl+Shift+V']);
  if (inDoc) { rows.push(null, ['Select all', () => { selectAll(); }, 'Ctrl+A']); if (!img && !cell) rows.push(['Insert link…', () => editLink(), 'Ctrl+K'], ['Insert picture…', () => $('insPic').click()]); }
  placeMenu(buildMenu(rows), d.x, d.y);
});

// ---------- keys ----------
doc.addEventListener('keydown', e => {
  if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
    e.preventDefault(); const cell = cellAtCaret();
    if (cell) { const all = [...cell.closest('table').querySelectorAll('td,th')], i = all.indexOf(cell), next = all[i + (e.shiftKey ? -1 : 1)]; if (next) { const r = document.createRange(); r.selectNodeContents(next); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } else if (!e.shiftKey) tableOp(cell, 'rowBelow', 0); return; }
    if (listAtCaret()) { document.execCommand(e.shiftKey ? 'outdent' : 'indent'); changed(); return; }
    if (!e.shiftKey) { document.execCommand('insertText', false, '\t'); changed(); }
    return;
  }
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveSel(); if (e.shiftKey) columnBreak(); else pageBreak(); return; }
  if (selImg && !cropBox && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) { const img = selImg; hideImgSel(); const r = document.createRange(); e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? r.setStartBefore(img) : r.setStartAfter(img); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); e.preventDefault(); }
});
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(), c = e.ctrlKey || e.metaKey;
  if (document.querySelector('.modal')) return;
  if (cropBox && e.key === 'Enter') { e.preventDefault(); endCrop(true); return; }
  if (cropBox && e.key === 'Escape') { e.preventDefault(); endCrop(false); return; }
  if (c && k === 's') { e.preventDefault(); e.shiftKey ? $('saveAs').click() : saveLib(); }
  else if (c && e.shiftKey && k === 'c') { e.preventDefault(); copyAll(); }
  else if (c && k === 'f') { e.preventDefault(); openFind(false); }
  else if (c && k === 'h') { e.preventDefault(); openFind(true); }
  else if (c && k === 'p') { e.preventDefault(); printPage(); }
  else if (c && k === 'n') { e.preventDefault(); newPage(); }
  else if (c && k === 'o') { e.preventDefault(); openFile(); }
  else if (c && k === 'k') { e.preventDefault(); editLink(); }
  else if (c && k === 'g') { e.preventDefault(); grabText(); }
  else if (c && !e.shiftKey && k === 'e') { e.preventDefault(); ex('justifyCenter'); }
  else if (c && !e.shiftKey && k === 'l') { e.preventDefault(); ex('justifyLeft'); }
  else if (c && !e.shiftKey && k === 'r') { e.preventDefault(); ex('justifyRight'); }
  else if (c && !e.shiftKey && k === 'j') { e.preventDefault(); ex('justifyFull'); }
  else if (c && e.shiftKey && k === 'l') { e.preventDefault(); ex('insertUnorderedList'); }
  else if (c && (e.key === ']' || e.key === '}')) { e.preventDefault(); $('grow').click(); }
  else if (c && (e.key === '[' || e.key === '{')) { e.preventDefault(); $('shrink').click(); }
  else if (c && e.shiftKey && (e.key === '+' || e.key === '=')) { e.preventDefault(); ex('superscript'); }
  else if (c && !e.shiftKey && e.key === '=') { e.preventDefault(); ex('subscript'); }
  else if (c && e.altKey && /^[0-3]$/.test(e.key)) { e.preventDefault(); ex('formatBlock', ['div', 'h1', 'h2', 'h3'][+e.key]); }
  else if (e.key === 'F3') { e.preventDefault(); if ($('findBar').hidden) openFind(false); else goHit(e.shiftKey ? -1 : 1); }
  else if (e.key === 'Escape') { if (document.querySelector('.menu')) closeMenus(); else if (selImg) hideImgSel(); else if (!$('findBar').hidden) closeFind(); }
});

// ---------- copy, save, open, print ----------
function cleanHtml() { const c = doc.cloneNode(true); c.querySelectorAll('mark.hit').forEach(m => m.replaceWith(...m.childNodes)); c.querySelectorAll('[data-pick]').forEach(m => m.removeAttribute('data-pick')); return c.innerHTML; }
async function copyAll() { const t = plain(); if (!t.trim()) return; try { await window.te.copy(t, `<div style="white-space:pre-wrap">${cleanHtml()}</div>`); toast('All the text is copied. Paste it anywhere.'); } catch (e) { toast('Copy failed: ' + errMsg(e)); } }
$('copyAll').onclick = copyAll;
async function saveLib() {
  const t = plain(); if ((!t.trim() && !doc.querySelector('img,table')) || !entry) return; $('saveLib').disabled = true;
  try { const r = await window.te.saveLib({ key: entry.key, name: $('name').value.trim() || (isGrab() ? 'Grabbed text' : 'Page'), text: t, html: cleanHtml() }); entry.libId = r.id; dirty = false; stateLabel(); fillHist(r.list || []); syncNow(); toast('Saved in the Saveit library'); }
  catch (e) { toast(errMsg(e), 6000); } finally { counts(); }
}
$('saveLib').onclick = saveLib;
$('saveAs').onclick = () => menu($('saveAs'), [['Word document (.docx)', () => saveFile('docx')], ['PDF (.pdf)', () => saveFile('pdf')], ['Web page (.html)', () => saveFile('html')], ['Text file (.txt)', () => saveFile('txt')]]);
async function docxBytes() {
  // Converted from a copy at 100% zoom, so sizes are the page's real sizes
  const p = pageSetup(), host = document.createElement('div'); host.className = 'page'; host.style.cssText = `position:fixed;left:-20000px;top:0;background:#fff;color:#111;white-space:pre-wrap;word-wrap:break-word;tab-size:6;font:11pt/1.45 "Segoe UI","Calibri",sans-serif;width:${doc.style.width};padding:${doc.style.padding}`;
  if (doc.classList.contains('nowrap')) host.style.whiteSpace = 'pre';
  host.innerHTML = cleanHtml(); host.querySelectorAll('.pgset').forEach(x => x.remove()); document.body.append(host);
  try { await Promise.all([...host.querySelectorAll('img')].map(i => i.decode().catch(() => {}))); return await window.SaveitDocx.toDocx(host, { ...p, title: $('name').value, hf: typeof hfGet === 'function' ? hfGet() : null }); } finally { host.remove(); }
}
async function saveFile(fmt) {
  const name = $('name').value.trim() || (isGrab() ? 'Grabbed text' : 'Page'); let data = null;
  try {
    if (fmt === 'docx') data = await docxBytes();
    else if (fmt === 'html') { const p = pageSetup(), d = pageDims(p); data = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(name)}</title><style>@page{size:${d.w}in ${d.h}in;margin:${p.margin}in}body{font:11pt/1.45 "Segoe UI",Calibri,sans-serif;white-space:pre-wrap;max-width:${Math.round((d.w - 2 * p.margin) * 96)}px;margin:30px auto;color:#111}table{border-collapse:collapse;white-space:normal}td,th{border:1px solid #b9c0c7;padding:3px 8px;vertical-align:top}img{max-width:100%}h1{font-size:20pt}h2{font-size:16pt}h3{font-size:13pt}blockquote{margin:.3em 0 .3em 1.2em;padding-left:10px;border-left:3px solid #c5cbd1;color:#444}pre{font:10pt/1.4 Consolas,monospace;background:#f3f4f6;padding:6px 8px}ul,ol{white-space:normal}li{white-space:pre-wrap}.pgbreak{break-after:page}.colbreak{break-after:column}.pgset{display:none}h4{font-size:11.5pt;font-style:italic}.p-title{font-size:26pt;font-weight:600;line-height:1.2}.p-subtitle{font-size:14pt;color:#5a6168}.toc{white-space:normal}.toc-t{font-weight:700;font-size:13pt}.toc-2{margin-left:.3in}.toc-3{margin-left:.6in}.toc-4{margin-left:.9in}.fnotes{border-top:1px solid #a0a6ad;margin-top:24px;padding-top:6px;font-size:9.5pt}</style></head><body>${cleanHtml()}</body></html>`; }
    else if (fmt === 'txt') data = plain();
    if (fmt === 'pdf') { hideImgSel(); closeFind(true); }
    const p = await window.te.saveFile(name, fmt, data, { ...pageSetup(), hf: typeof hfGet === 'function' ? hfGet() : null }); if (p) toast('Saved ' + p.split(/[\\/]/).pop(), 4000);
  } catch (e) { toast('Could not save: ' + errMsg(e), 6000); }
}
function printPage() { hideImgSel(); window.te.print(typeof hfGet === 'function' ? hfGet() : null); }
$('print').onclick = printPage;
async function newPage() { syncNow(); const fresh = entry && !entry.libId && !plain().trim() && !doc.querySelector('img,table'); if (fresh) { doc.focus(); return; } await window.te.newPage({ name: 'New page' }); }
$('newPage').onclick = newPage;
async function openFromFile(f) {
  try {
    let html, page = null;
    const bytes = f.bytes || (f.file && f.ext === 'docx' ? new Uint8Array(await f.file.arrayBuffer()) : null), text = f.text ?? (f.file && f.ext !== 'docx' ? await f.file.text() : null);
    if (f.ext === 'docx') { const r = await window.SaveitDocx.fromDocx(bytes); html = sanitize(r.html); page = r.page; if (page && page.hf) { if (typeof hfHtml === 'function') html = hfHtml(page.hf) + html; delete page.hf; } }
    else if (f.ext === 'html' || f.ext === 'htm') { const d = new DOMParser().parseFromString(text, 'text/html'); html = sanitize(d.body ? d.body.innerHTML : text); }
    else html = textToHtml(text);
    const empty = entry && !entry.libId && !plain().trim() && !doc.querySelector('img,table'), oldKey = entry && entry.key;
    syncNow(); await window.te.newPage({ name: f.name, html, text: '' });
    if (page && Object.keys(page).length) setPage(page);
    if (empty && oldKey) window.te.forget(oldKey).then(d => d && fillHist(d.list || [])).catch(() => {});
    toast('Opened ' + f.name, 3000);
  } catch (e) { toast('Could not open ' + f.name + ': ' + errMsg(e), 7000); }
}
async function openFile() { try { const f = await window.te.openFile(); if (f) await openFromFile(f); } catch (e) { toast(errMsg(e), 6000); } }
$('openFile').onclick = openFile;
$('closePage').onclick = async () => {
  if (!entry) return; const has = plain().trim() || doc.querySelector('img,table');
  if (has && (!entry.libId || dirty)) { const ok = await ask('Remove this page?', null, 'Remove', `<p>${entry.libId ? 'Your latest changes are not saved to the library.' : 'This page is not saved in the library.'} Remove it from Recent pages anyway?</p>`); if (!ok) return; }
  const d = await window.te.forget(entry.key); if (d && d.entry) load(d); else { entry = null; await window.te.newPage({ name: 'New page' }); }
};
$('editor').onclick = () => window.te.editor();
function grabText() { saveSel(); syncNow(); window.te.grab(); }
$('grab').onclick = grabText;
$('picBtn').onclick = () => { picWanted = !picWanted; showPic(); };
$('picImg').onclick = () => $('picImg').classList.toggle('full');
$('hist').onchange = async e => { syncNow(); const d = await window.te.pick(e.target.value); if (d) load(d); };
addEventListener('resize', posImgSel);
wrapEl.addEventListener('scroll', posImgSel);
addEventListener('beforeunload', syncNow);
applyPage(); counts(); stateLabel(); brand();
