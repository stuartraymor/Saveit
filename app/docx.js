// 10.4.10: Word (.docx) saving and opening for the page editor (textedit.html). No libraries: a small zip writer/reader
// and a converter between the editor's HTML and WordprocessingML. Exposed as window.SaveitDocx.
(function () {
  'use strict';
  // ---------- zip ----------
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  const enc = new TextEncoder();
  // Stored (uncompressed) entries: Word reads these fine and it keeps the writer tiny.
  function zip(files) {
    const parts = [], central = []; let off = 0;
    for (const f of files) {
      const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true);
      c.setUint32(42, off, true); central.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + data.length;
    }
    const csize = central.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
    const all = [...parts, ...central, new Uint8Array(e.buffer)], out = new Uint8Array(all.reduce((a, b) => a + b.length, 0)); let p = 0;
    for (const a of all) { out.set(a, p); p += a.length; } return out;
  }
  async function inflateRaw(d) { const s = new Blob([d]).stream().pipeThrough(new DecompressionStream('deflate-raw')); return new Uint8Array(await new Response(s).arrayBuffer()); }
  async function unzip(buf) {
    const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf), v = new DataView(b.buffer, b.byteOffset, b.byteLength), out = {};
    let e = -1; for (let i = b.length - 22; i >= Math.max(0, b.length - 65600); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw Error('This is not a Word document (.docx).');
    const n = v.getUint16(e + 10, true); let p = v.getUint32(e + 16, true); const dec = new TextDecoder();
    for (let k = 0; k < n; k++) {
      if (v.getUint32(p, true) !== 0x02014b50) throw Error('The Word document is damaged.');
      const method = v.getUint16(p + 10, true), csz = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), lo = v.getUint32(p + 42, true);
      const name = dec.decode(b.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
      const start = lo + 30 + v.getUint16(lo + 26, true) + v.getUint16(lo + 28, true), raw = b.subarray(start, start + csz);
      out[name] = { method, raw };
    }
    return { has: n => !!out[n], names: () => Object.keys(out), async bytes(n) { const f = out[n]; if (!f) return null; return f.method === 0 ? f.raw : f.method === 8 ? inflateRaw(f.raw) : null; },
      async text(n) { const d = await this.bytes(n); return d ? dec.decode(d) : null; } };
  }

  // ---------- HTML -> docx ----------
  const x = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const hex = c => { const m = String(c || '').match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/); if (!m) return null; if (m[4] !== undefined && +m[4] === 0) return null; return [m[1], m[2], m[3]].map(n => (+n).toString(16).padStart(2, '0')).join('').toUpperCase(); };
  const TW = px => Math.round(px * 15), EMU = px => Math.round(px * 9525);
  const BLOCK = new Set(['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'UL', 'OL', 'LI', 'TABLE', 'HR', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'FIGURE', 'CENTER']);
  const PAGES = { letter: [8.5, 11], a4: [8.27, 11.69], legal: [8.5, 14] };
  const BULLETS = ['•', '◦', '▪'];
  const ORDERED = { decimal: 'decimal', 'lower-alpha': 'lowerLetter', 'lower-latin': 'lowerLetter', 'upper-alpha': 'upperLetter', 'upper-latin': 'upperLetter', 'lower-roman': 'lowerRoman', 'upper-roman': 'upperRoman' };
  const BULLET_TYPE = { disc: 0, circle: 1, square: 2 };

  async function imageBytes(img) {
    const src = img.getAttribute('src') || '';
    let m = src.match(/^data:image\/(png|jpeg|jpg|gif);base64,(.*)$/i);
    if (m && m[1].toLowerCase() !== 'gif') { const bin = atob(m[2]), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return { ext: m[1].toLowerCase() === 'png' ? 'png' : 'jpeg', data: u }; }
    try { // anything else (webp, gif, a picture from a web page): redraw as PNG
      if (!img.complete || !img.naturalWidth) await new Promise(r => { img.onload = img.onerror = r; setTimeout(r, 3000); });
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0);
      const blob = await new Promise(r => c.toBlob(r, 'image/png')); return { ext: 'png', data: new Uint8Array(await blob.arrayBuffer()) };
    } catch (_) { return null; }
  }

  async function toDocx(root, opts = {}) {
    // root must be in the document (computed styles are used) and at zoom 1
    const rels = [], media = [], nums = []; let relN = 10, docPr = 1, out = [];
    const rel = (type, target, ext) => { const id = 'rId' + (++relN); rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${x(target)}"${ext ? ' TargetMode="External"' : ''}/>`); return id; };
    const rootFs = parseFloat(getComputedStyle(root).fontSize) || 14.67;
    function runProps(el, textNode) {
      const cs = getComputedStyle(el), p = [];
      const ff = (cs.fontFamily.split(',')[0] || '').replace(/["']/g, '').trim();
      if (ff) p.push(`<w:rFonts w:ascii="${x(ff)}" w:hAnsi="${x(ff)}" w:cs="${x(ff)}" w:eastAsia="${x(ff)}"/>`);
      if (+cs.fontWeight >= 600 || cs.fontWeight === 'bold') p.push('<w:b/><w:bCs/>');
      if (cs.fontStyle === 'italic' || cs.fontStyle === 'oblique') p.push('<w:i/><w:iCs/>');
      let u = false, s = false, sup = false, sub = false, bg = null;
      for (let a = el; a && a !== root; a = a.parentElement) {
        const ac = getComputedStyle(a), d = ac.textDecorationLine || '';
        if (d.includes('underline') || a.tagName === 'U' || a.tagName === 'INS') u = true;
        if (d.includes('line-through') || a.tagName === 'S' || a.tagName === 'STRIKE' || a.tagName === 'DEL') s = true;
        if (a.tagName === 'SUP' || ac.verticalAlign === 'super') sup = true;
        if (a.tagName === 'SUB' || ac.verticalAlign === 'sub') sub = true;
        if (!bg && !BLOCK.has(a.tagName) && a.tagName !== 'TD' && a.tagName !== 'TH') bg = hex(ac.backgroundColor);
        if (BLOCK.has(a.tagName) || a.tagName === 'TD' || a.tagName === 'TH') break;
      }
      if (s) p.push('<w:strike/>');
      const col = hex(cs.color); if (col) p.push(`<w:color w:val="${col}"/>`);
      const fs = parseFloat(cs.fontSize); if (fs) { const hp = Math.max(2, Math.round(fs * 0.75 * 2 * (sup || sub ? 1 / 0.83 : 1))); p.push(`<w:sz w:val="${hp}"/><w:szCs w:val="${hp}"/>`); }
      if (bg) p.push(`<w:shd w:val="clear" w:color="auto" w:fill="${bg}"/>`);
      if (u) p.push('<w:u w:val="single"/>');
      if (sup) p.push('<w:vertAlign w:val="superscript"/>'); else if (sub) p.push('<w:vertAlign w:val="subscript"/>');
      return p.length ? `<w:rPr>${p.join('')}</w:rPr>` : '';
    }
    function textRuns(t, rp, pre) {
      // tabs and line breaks become Word tabs and breaks; in normal text, runs of spaces/newlines collapse like the page shows them
      if (!pre) t = t.replace(/[\r\n]+/g, ' ');
      const bits = t.split(/(\t|\n)/), o = [];
      for (const b of bits) { if (b === '\t') o.push('<w:tab/>'); else if (b === '\n') o.push('<w:br/>'); else if (b) o.push(`<w:t xml:space="preserve">${x(b.replace(/ /g, ' '))}</w:t>`); }
      return o.length ? `<w:r>${rp}${o.join('')}</w:r>` : '';
    }
    async function drawing(img) {
      const got = await imageBytes(img); if (!got) return '';
      const name = `image${media.length + 1}.${got.ext === 'jpeg' ? 'jpeg' : 'png'}`; media.push({ name, data: got.data });
      const id = rel('image', 'media/' + name), r = img.getBoundingClientRect(), w = EMU(r.width || img.width || 100), h = EMU(r.height || img.height || 100), n = docPr++;
      const graphic = `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${n}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic>`;
      const fl = getComputedStyle(img).float;
      if (fl === 'left' || fl === 'right') return `<w:r><w:drawing><wp:anchor distT="0" distB="114300" distL="114300" distR="114300" simplePos="0" relativeHeight="${n}" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:align>${fl}</wp:align></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="${w}" cy="${h}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapSquare wrapText="bothSides"/><wp:docPr id="${n}" name="Picture ${n}"/><wp:cNvGraphicFramePr/>${graphic}</wp:anchor></w:drawing></w:r>`;
      return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${w}" cy="${h}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${n}" name="Picture ${n}"/><wp:cNvGraphicFramePr/>${graphic}</wp:inline></w:drawing></w:r>`;
    }
    // Inline content of a block -> runs. Returns {runs, pageBreak}
    async function inlines(node, pre, acc) {
      for (const c of node.childNodes) {
        if (c.nodeType === 3) { acc.runs.push(textRuns(c.data, runProps(c.parentElement, c), pre)); continue; }
        if (c.nodeType !== 1) continue;
        const t = c.tagName;
        if (BLOCK.has(t)) continue; // handled by the block walker
        if (t === 'BR') { acc.runs.push('<w:r><w:br/></w:r>'); continue; }
        if (t === 'IMG') { acc.runs.push(await drawing(c)); continue; }
        if (t === 'SCRIPT' || t === 'STYLE') continue;
        if (c.classList.contains('pgbreak')) { acc.runs.push('<w:r><w:br w:type="page"/></w:r>'); continue; }
        if (t === 'A' && /^(https?:|mailto:)/i.test(c.getAttribute('href') || '')) {
          const id = rel('hyperlink', c.getAttribute('href'), true), sub = { runs: [] }; await inlines(c, pre, sub);
          acc.runs.push(`<w:hyperlink r:id="${id}">${sub.runs.join('')}</w:hyperlink>`); continue;
        }
        if (t === 'INPUT' && c.type === 'checkbox') { acc.runs.push(textRuns(c.checked ? '☒ ' : '☐ ', runProps(c.parentElement), pre)); continue; }
        await inlines(c, pre, acc);
      }
    }
    function paraProps(el, extra = '') {
      const cs = getComputedStyle(el), p = [];
      const tag = el.tagName, style = { H1: 'Heading1', H2: 'Heading2', H3: 'Heading3', H4: 'Heading3', H5: 'Heading3', H6: 'Heading3', BLOCKQUOTE: 'Quote', PRE: 'Code' }[tag];
      if (style) p.push(`<w:pStyle w:val="${style}"/>`);
      p.push(extra);
      if (cs.pageBreakBefore === 'always' || cs.breakBefore === 'page') p.push('<w:pageBreakBefore/>');
      const own = el !== root && tag !== 'TD' && tag !== 'TH'; // the page and table cells: their padding is not paragraph indent
      const mt = own ? parseFloat(cs.marginTop) || 0 : 0, mb = own ? parseFloat(cs.marginBottom) || 0 : 0, fs = parseFloat(cs.fontSize) || rootFs, lh = parseFloat(cs.lineHeight);
      const line = lh ? Math.round(240 * (lh / fs) / 1.17) : 0;
      p.push(`<w:spacing w:before="${TW(mt)}" w:after="${TW(mb)}"${line ? ` w:line="${Math.max(120, line)}" w:lineRule="auto"` : ''}/>`);
      const ml = own ? (parseFloat(cs.marginLeft) || 0) + (tag === 'BLOCKQUOTE' ? parseFloat(cs.paddingLeft) || 0 : 0) : 0;
      if (ml > 0.5 && !extra.includes('numPr')) p.push(`<w:ind w:left="${TW(ml)}"/>`);
      const ti = own ? parseFloat(cs.textIndent) || 0 : 0; if (ti && !extra.includes('numPr')) p.push(`<w:ind w:firstLine="${TW(ti)}"/>`);
      const al = { center: 'center', right: 'right', end: 'right', justify: 'both' }[cs.textAlign]; if (al) p.push(`<w:jc w:val="${al}"/>`);
      return `<w:pPr>${p.join('')}</w:pPr>`;
    }
    async function para(el, extra, pre, contentNode) {
      const acc = { runs: [] }; await inlines(contentNode || el, pre, acc);
      return `<w:p>${paraProps(el, extra)}${acc.runs.join('')}</w:p>`;
    }
    function listNum(list) {
      const cs = getComputedStyle(list), type = cs.listStyleType, ordered = list.tagName === 'OL' && type !== 'disc' && type !== 'circle' && type !== 'square' && type !== 'none';
      const id = nums.length + 1; nums.push({ id, ordered, fmt: ORDERED[type] || 'decimal', bullet: BULLET_TYPE[type] ?? 0, start: +list.getAttribute('start') || 1 }); return id;
    }
    async function blocks(node, outArr, ctx) {
      // Walk children; consecutive inline content becomes one paragraph.
      let pending = [];
      const flush = async () => { if (!pending.length) return; if (pending.every(n => n.nodeType === 3 && !n.data.trim())) { pending = []; return; } // loose inline content becomes a paragraph with the parent's styles
        const acc = { runs: [] }; for (const n of pending) { if (n.nodeType === 3) acc.runs.push(textRuns(n.data, runProps(n.parentElement), ctx.pre)); else { const sub = { runs: [] }; const wrap = { childNodes: [n] }; await inlines(wrap, ctx.pre, sub); acc.runs.push(...sub.runs); } }
        pending = []; if (acc.runs.join('').trim() || ctx.keepEmpty) outArr.push(`<w:p>${paraProps(node, ctx.numPr || '')}${acc.runs.join('')}</w:p>`); };
      for (const c of node.childNodes) {
        if (c.nodeType === 1 && (BLOCK.has(c.tagName) || c.classList.contains('pgbreak'))) {
          await flush(); const t = c.tagName;
          if (c.classList.contains('pgbreak')) { outArr.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>'); continue; }
          if (t === 'HR') { outArr.push('<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="1" w:color="A0A6AD"/></w:pBdr><w:spacing w:before="120" w:after="120"/></w:pPr></w:p>'); continue; }
          if (t === 'TABLE') { outArr.push(await table(c)); continue; }
          if (t === 'UL' || t === 'OL') { const id = ctx.listId && ctx.depth >= 0 ? ctx.listId : listNum(c); const depth = (ctx.depth ?? -1) + 1;
            for (const li of c.children) { if (li.tagName === 'LI') await listItem(li, outArr, id, Math.min(8, depth)); else if (li.tagName === 'UL' || li.tagName === 'OL') await blocks({ childNodes: [li], tagName: 'DIV' }, outArr, { ...ctx, listId: id, depth }); }
            continue; }
          const hasBlockKids = [...c.children].some(k => BLOCK.has(k.tagName) || k.classList.contains('pgbreak'));
          if (hasBlockKids) await blocks(c, outArr, { ...ctx, pre: ctx.pre || t === 'PRE' });
          else outArr.push(await para(c, ctx.numPr || '', ctx.pre || t === 'PRE'));
        } else pending.push(c);
      }
      await flush();
    }
    async function listItem(li, outArr, id, lvl) {
      const numPr = `<w:numPr><w:ilvl w:val="${lvl}"/><w:numId w:val="${id}"/></w:numPr>`;
      // the item's own text is one numbered paragraph; nested lists follow at the next level
      const own = [...li.childNodes].filter(n => !(n.nodeType === 1 && (n.tagName === 'UL' || n.tagName === 'OL')));
      const tmp = { childNodes: own, tagName: 'LI' };
      const acc = { runs: [] }; for (const n of own) { if (n.nodeType === 3) acc.runs.push(textRuns(n.data, runProps(n.parentElement), false)); else if (n.nodeType === 1 && BLOCK.has(n.tagName)) { const sub = { runs: [] }; await inlines(n, false, sub); acc.runs.push(...sub.runs); } else if (n.nodeType === 1) { const sub = { runs: [] }; await inlines({ childNodes: [n] }, false, sub); acc.runs.push(...sub.runs); } }
      void tmp; outArr.push(`<w:p>${paraProps(li, numPr)}${acc.runs.join('')}</w:p>`);
      for (const n of li.children) if (n.tagName === 'UL' || n.tagName === 'OL') { const childId = n.tagName === li.parentElement.tagName ? id : listNum(n); for (const k of n.children) if (k.tagName === 'LI') await listItem(k, outArr, childId, Math.min(8, lvl + 1)); }
    }
    async function table(t) {
      const rows = [...t.rows], width = t.getBoundingClientRect().width || 600, ncol = Math.max(1, ...rows.map(r => [...r.cells].reduce((a, c) => a + (c.colSpan || 1), 0)));
      const first = rows.find(r => [...r.cells].reduce((a, c) => a + (c.colSpan || 1), 0) === ncol);
      const cw = first ? [...first.cells].map(c => TW(c.getBoundingClientRect().width)) : Array(ncol).fill(TW(width / ncol));
      const o = [`<w:tbl><w:tblPr><w:tblW w:w="${TW(width)}" w:type="dxa"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="B9C0C7"/>`).join('')}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${cw.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`];
      for (const r of rows) {
        o.push('<w:tr>');
        for (const c of r.cells) {
          const inner = []; await blocks(c, inner, { keepEmpty: true });
          if (!inner.length) inner.push('<w:p/>');
          const bg = hex(getComputedStyle(c).backgroundColor);
          o.push(`<w:tc><w:tcPr><w:tcW w:w="${TW(c.getBoundingClientRect().width)}" w:type="dxa"/>${c.colSpan > 1 ? `<w:gridSpan w:val="${c.colSpan}"/>` : ''}${bg ? `<w:shd w:val="clear" w:color="auto" w:fill="${bg}"/>` : ''}</w:tcPr>${inner.join('')}</w:tc>`);
        }
        o.push('</w:tr>');
      }
      o.push('</w:tbl><w:p/>'); return o.join('');
    }
    await blocks(root, out, {});
    if (!out.length) out.push('<w:p/>');
    const [pw, ph] = PAGES[opts.size] || PAGES.letter, land = opts.orientation === 'landscape', m = TW((opts.margin ?? 1) * 96);
    const W = Math.round((land ? ph : pw) * 1440), H = Math.round((land ? pw : ph) * 1440);
    const sect = `<w:sectPr><w:pgSz w:w="${W}" w:h="${H}"${land ? ' w:orient="landscape"' : ''}/><w:pgMar w:top="${m}" w:right="${m}" w:bottom="${m}" w:left="${m}" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>`;
    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
    const document_ = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${NS}><w:body>${out.join('')}${sect}</w:body></w:document>`;
    const lvl = (i, n) => n.ordered
      ? `<w:lvl w:ilvl="${i}"><w:start w:val="${i ? 1 : n.start}"/><w:numFmt w:val="${i ? ['decimal', 'lowerLetter', 'lowerRoman'][i % 3] : n.fmt}"/><w:lvlText w:val="%${i + 1}."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 * (i + 1)}" w:hanging="360"/></w:pPr></w:lvl>`
      : `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="${BULLETS[(n.bullet + i) % 3]}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 * (i + 1)}" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Segoe UI Symbol" w:hAnsi="Segoe UI Symbol"/></w:rPr></w:lvl>`;
    const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${nums.map(n => `<w:abstractNum w:abstractNumId="${n.id}"><w:multiLevelType w:val="hybridMultilevel"/>${Array.from({ length: 9 }, (_, i) => lvl(i, n)).join('')}</w:abstractNum>`).join('')}${nums.map(n => `<w:num w:numId="${n.id}"><w:abstractNumId w:val="${n.id}"/></w:num>`).join('')}</w:numbering>`;
    const font = opts.font || 'Segoe UI';
    const hs = (id, name, sz, extra = '') => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>${extra}<w:rPr><w:b/><w:sz w:val="${sz}"/></w:rPr></w:style>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${x(font)}" w:hAnsi="${x(font)}" w:cs="${x(font)}" w:eastAsia="${x(font)}"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>`
      + `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>`
      + hs('Heading1', 'heading 1', 40, '<w:pPr><w:keepNext/><w:outlineLvl w:val="0"/></w:pPr>') + hs('Heading2', 'heading 2', 32, '<w:pPr><w:keepNext/><w:outlineLvl w:val="1"/></w:pPr>') + hs('Heading3', 'heading 3', 26, '<w:pPr><w:keepNext/><w:outlineLvl w:val="2"/></w:pPr>')
      + `<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="C5CBD1"/></w:pBdr></w:pPr><w:rPr><w:color w:val="444444"/></w:rPr></w:style>`
      + `<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F3F4F6"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="20"/></w:rPr></w:style>`
      + `<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style></w:styles>`;
    const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
    const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
    const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>${rels.join('')}</Relationships>`;
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(opts.title || '')}</dc:title><dc:creator>Saveit</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
    const appx = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Saveit</Application></Properties>`;
    return zip([{ name: '[Content_Types].xml', data: ct }, { name: '_rels/.rels', data: rootRels }, { name: 'docProps/core.xml', data: core }, { name: 'docProps/app.xml', data: appx },
      { name: 'word/document.xml', data: document_ }, { name: 'word/styles.xml', data: styles }, { name: 'word/numbering.xml', data: numbering }, { name: 'word/_rels/document.xml.rels', data: docRels },
      ...media.map(m => ({ name: 'word/media/' + m.name, data: m.data }))]);
  }

  // ---------- docx -> HTML ----------
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const kids = (el, name) => el ? [...el.children].filter(c => c.localName === name) : [];
  const kid = (el, name) => kids(el, name)[0] || null;
  const att = (el, name) => el ? (el.getAttributeNS(W, name) ?? el.getAttribute('w:' + name)) : null;
  const on = el => { if (!el) return false; const v = att(el, 'val'); return v == null || !/^(0|false|off|none)$/i.test(v); };
  const HL = { yellow: 'ffff00', green: '00ff00', cyan: '00ffff', magenta: 'ff00ff', blue: '0000ff', red: 'ff0000', darkBlue: '000080', darkCyan: '008080', darkGreen: '008000', darkMagenta: '800080', darkRed: '800000', darkYellow: '808000', darkGray: '808080', lightGray: 'c0c0c0', black: '000000', white: 'ffffff' };
  async function fromDocx(buf) {
    const z = await unzip(buf), docXml = await z.text('word/document.xml');
    if (!docXml) throw Error('This is not a Word document (.docx).');
    const P = s => new DOMParser().parseFromString(s, 'application/xml');
    const doc = P(docXml), relsXml = await z.text('word/_rels/document.xml.rels'), rels = {};
    if (relsXml) for (const r of P(relsXml).getElementsByTagName('Relationship')) rels[r.getAttribute('Id')] = { target: r.getAttribute('Target'), ext: r.getAttribute('TargetMode') === 'External' };
    const numFmt = {}; const numXml = await z.text('word/numbering.xml');
    if (numXml) { const n = P(numXml), abs = {}; for (const a of n.getElementsByTagNameNS(W, 'abstractNum')) { abs[att(a, 'abstractNumId')] = kids(a, 'lvl').map(l => att(kid(l, 'numFmt'), 'val') || 'decimal'); }
      for (const m of n.getElementsByTagNameNS(W, 'num')) numFmt[att(m, 'numId')] = abs[att(kid(m, 'abstractNumId'), 'val')] || []; }
    const styleName = {}; const stXml = await z.text('word/styles.xml');
    if (stXml) for (const s of P(stXml).getElementsByTagNameNS(W, 'style')) { const nm = att(kid(s, 'name'), 'val'); if (nm) styleName[att(s, 'styleId')] = nm.toLowerCase(); }
    const mediaCache = {};
    async function imgSrc(id) { const r = rels[id]; if (!r || r.ext) return null; if (mediaCache[id]) return mediaCache[id]; const path = 'word/' + r.target.replace(/^\/?word\//, '').replace(/^\//, ''); const b = await z.bytes(path.replace(/[^/]+\/\.\.\//g, '')); if (!b) return null;
      const ext = (path.split('.').pop() || '').toLowerCase(), mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' }[ext]; if (!mime) return null;
      let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return (mediaCache[id] = `data:${mime};base64,${btoa(s)}`); }
    const e = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    async function runsHtml(p) {
      let h = '';
      for (const c of p.children) {
        if (c.localName === 'r') h += await runHtml(c);
        else if (c.localName === 'hyperlink') { const r = rels[c.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')]; const inner = await runsHtml(c); h += r && r.ext && /^(https?:|mailto:)/i.test(r.target) ? `<a href="${e(r.target)}">${inner}</a>` : inner; }
        else if (c.localName === 'ins' || c.localName === 'smartTag' || c.localName === 'sdt' || c.localName === 'sdtContent' || c.localName === 'fldSimple') h += await runsHtml(c);
      }
      return h;
    }
    async function runHtml(r) {
      const pr = kid(r, 'rPr'), st = []; let t = '';
      for (const c of r.children) {
        if (c.localName === 't') t += e(c.textContent);
        else if (c.localName === 'tab') t += '\t';
        else if (c.localName === 'br') t += att(c, 'type') === 'page' ? '<span class="pgbreak" contenteditable="false"></span>' : '<br>';
        else if (c.localName === 'drawing' || c.localName === 'pict') {
          const blip = c.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'blip')[0]; if (!blip) continue;
          const src = await imgSrc(blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed')); if (!src) continue;
          const ext = c.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', 'extent')[0];
          const w = ext ? Math.round(+ext.getAttribute('cx') / 9525) : 0, anchor = c.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', 'anchor')[0];
          const al = anchor && anchor.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', 'align')[0]?.textContent;
          const fl = al === 'right' ? 'float:right;margin:0 0 8px 12px;' : anchor ? 'float:left;margin:0 12px 8px 0;' : '';
          t += `<img src="${src}" style="${fl}${w ? `width:${w}px;` : ''}max-width:100%">`;
        }
      }
      if (!t) return '';
      if (pr) {
        if (on(kid(pr, 'b'))) st.push('font-weight:bold'); if (on(kid(pr, 'i'))) st.push('font-style:italic');
        const dec = []; if (kid(pr, 'u') && att(kid(pr, 'u'), 'val') !== 'none') dec.push('underline'); if (on(kid(pr, 'strike')) || on(kid(pr, 'dstrike'))) dec.push('line-through'); if (dec.length) st.push('text-decoration:' + dec.join(' '));
        const col = att(kid(pr, 'color'), 'val'); if (col && /^[0-9a-f]{6}$/i.test(col)) st.push('color:#' + col);
        const sz = att(kid(pr, 'sz'), 'val'); if (sz) st.push(`font-size:${+sz / 2}pt`);
        const f = att(kid(pr, 'rFonts'), 'ascii') || att(kid(pr, 'rFonts'), 'hAnsi'); if (f) st.push(`font-family:'${f.replace(/['";]/g, '')}'`);
        const hl = att(kid(pr, 'highlight'), 'val'), shd = att(kid(pr, 'shd'), 'fill'); if (hl && HL[hl]) st.push('background-color:#' + HL[hl]); else if (shd && /^[0-9a-f]{6}$/i.test(shd)) st.push('background-color:#' + shd);
        const va = att(kid(pr, 'vertAlign'), 'val'); if (va === 'superscript') t = `<sup>${t}</sup>`; else if (va === 'subscript') t = `<sub>${t}</sub>`;
      }
      return st.length ? `<span style="${st.join(';')}">${t}</span>` : t;
    }
    function pStyle(p) { const pr = kid(p, 'pPr'), id = att(kid(pr, 'pStyle'), 'val') || '', nm = styleName[id] || id.toLowerCase(); return nm; }
    async function paraHtml(p) {
      const pr = kid(p, 'pPr'), st = [], nm = pStyle(p);
      const jc = att(kid(pr, 'jc'), 'val'); if (jc === 'center') st.push('text-align:center'); else if (jc === 'right' || jc === 'end') st.push('text-align:right'); else if (jc === 'both' || jc === 'distribute') st.push('text-align:justify');
      const ind = kid(pr, 'ind'); const left = att(ind, 'left') || att(ind, 'start'); if (left && +left > 0 && !kid(pr, 'numPr')) st.push(`margin-left:${Math.round(+left / 15)}px`);
      const sp = kid(pr, 'spacing'); if (sp) { const b = att(sp, 'before'), a = att(sp, 'after'), l = att(sp, 'line'), lr = att(sp, 'lineRule'); if (b && +b) st.push(`margin-top:${Math.round(+b / 15)}px`); if (a && +a) st.push(`margin-bottom:${Math.round(+a / 15)}px`); if (l && (!lr || lr === 'auto')) st.push(`line-height:${Math.max(1, +l / 240 * 1.17).toFixed(2)}`); }
      if (on(kid(pr, 'pageBreakBefore'))) st.push('break-before:page');
      let inner = await runsHtml(p); if (!inner) inner = '<br>';
      const tag = /^(heading 1|title)$/.test(nm) ? 'h1' : nm === 'heading 2' || nm === 'subtitle' ? 'h2' : /^heading [3-9]$/.test(nm) ? 'h3' : /quote/.test(nm) ? 'blockquote' : 'div';
      return `<${tag}${st.length ? ` style="${st.join(';')}"` : ''}>${inner}</${tag}>`;
    }
    async function tableHtml(tbl) {
      let h = '<table>';
      for (const tr of kids(tbl, 'tr')) { h += '<tr>'; for (const tc of kids(tr, 'tc')) { const span = +att(kid(kid(tc, 'tcPr'), 'gridSpan'), 'val') || 1; const vm = kid(kid(tc, 'tcPr'), 'vMerge'); if (vm && att(vm, 'val') !== 'restart') continue; h += `<td${span > 1 ? ` colspan="${span}"` : ''}>${await bodyHtml(tc) || '<br>'}</td>`; } h += '</tr>'; }
      return h + '</table>';
    }
    async function bodyHtml(body) {
      let h = '', stack = []; // open lists: {tag, lvl}
      const close = to => { while (stack.length > to) h += `</li></${stack.pop().tag}>`; };
      for (const c of body.children) {
        if (c.localName === 'p') {
          const np = kid(kid(c, 'pPr'), 'numPr');
          if (np && att(kid(np, 'numId'), 'val') !== '0') {
            const id = att(kid(np, 'numId'), 'val'), lvl = Math.min(8, +att(kid(np, 'ilvl'), 'val') || 0), fmt = (numFmt[id] || [])[lvl] || 'bullet';
            const tag = fmt === 'bullet' || fmt === 'none' ? 'ul' : 'ol', type = { lowerLetter: 'lower-alpha', upperLetter: 'upper-alpha', lowerRoman: 'lower-roman', upperRoman: 'upper-roman' }[fmt];
            if (stack.length > lvl + 1) close(lvl + 1);
            if (stack.length === lvl + 1 && stack[lvl].tag !== tag) close(lvl);
            if (stack.length === lvl + 1) h += '</li>';
            while (stack.length < lvl + 1) { h += `<${tag}${type ? ` style="list-style-type:${type}"` : ''}>`; stack.push({ tag }); }
            const inner = (await paraHtml(c)).replace(/^<div[^>]*>|<\/div>$/g, '');
            h += '<li>' + inner; continue;
          }
          close(0); h += await paraHtml(c);
        } else if (c.localName === 'tbl') { close(0); h += await tableHtml(c); }
        else if (c.localName === 'sdt') { close(0); h += await bodyHtml(kid(c, 'sdtContent') || c); }
      }
      close(0); return h;
    }
    const body = doc.getElementsByTagNameNS(W, 'body')[0]; if (!body) throw Error('The Word document is empty or damaged.');
    const sect = kid(body, 'sectPr'), pg = kid(sect, 'pgSz'), mar = kid(sect, 'pgMar'), page = {};
    if (pg) { const w = +att(pg, 'w'), hgt = +att(pg, 'h'); page.orientation = w > hgt ? 'landscape' : 'portrait'; const s = Math.min(w, hgt) / 1440, l = Math.max(w, hgt) / 1440; page.size = Math.abs(s - 8.27) < .1 ? 'a4' : Math.abs(l - 14) < .1 ? 'legal' : 'letter'; }
    if (mar) { const m = +att(mar, 'left') / 1440; page.margin = m < .75 ? 0.5 : m > 1.25 ? 1.5 : 1; }
    return { html: await bodyHtml(body), page };
  }
  window.SaveitDocx = { toDocx, fromDocx, zip, unzip, crc32 };
})();
