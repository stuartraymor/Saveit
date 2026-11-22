// 10.3.10: live scrolling capture. The person scrolls the page themselves; Saveit keeps looking at the
// selected area and adds content that appears below, or (10.5.3) above, everything captured so far.
//
// How a frame is placed: every frame is matched against the whole picture assembled so far (not only the
// previous frame), so scrolling back through content already captured finds its place and adds nothing.
// Rows below the bottom of the picture are appended; rows above its top are put in front. (Until 10.5.3 only
// rows below were kept, so starting part-way down a page and scrolling up gave "Can't line this up".)
//
// Fixed parts: when the page first moves, rows that stayed in the same place at the top (a sticky header,
// browser toolbar) and at the bottom (a fixed footer, status bar) are kept apart. The header comes once at
// the top of the result, the footer once at the bottom, and only the moving band in between is stitched.
//
// Frames are {data: Buffer|Uint8Array (4 bytes per pixel, any channel order), w, h}.
'use strict';
const SAMPLES = 64, CHUNK = 512;
const MAX_HEIGHT = 32000; // canvas and PNG tools in Saveit work up to 32,767 pixels; stay below it

// Per-row fingerprints of rows y0..y1 of a frame. Columns at the far left and right are left out, so a
// moving scroll-bar thumb does not make otherwise identical rows look different.
function rowInfo(f, y0, y1) {
  const { data, w } = f, n = Math.max(0, y1 - y0);
  const xa = Math.min(w - 1, Math.floor(w * 0.02)), xb = Math.max(xa + 1, Math.ceil(w * 0.965));
  const hs = new Int32Array(n), ss = new Uint8Array(n * SAMPLES * 3), inf = new Uint8Array(n);
  for (let r = 0; r < n; r++) {
    const row = (y0 + r) * w * 4; let h = 2166136261 | 0;
    const b0 = data[row + xa * 4], b1 = data[row + xa * 4 + 1], b2 = data[row + xa * 4 + 2]; let busy = 0;
    for (let x = xa; x < xb; x++) {
      const i = row + x * 4, a = data[i], b = data[i + 1], c = data[i + 2];
      h = Math.imul(h ^ a, 16777619); h = Math.imul(h ^ b, 16777619); h = Math.imul(h ^ c, 16777619);
      if (Math.abs(a - b0) + Math.abs(b - b1) + Math.abs(c - b2) > 48) busy++;
    }
    hs[r] = h; inf[r] = busy >= 2 ? 1 : 0; // a row with some ink is "informative"; plain background rows match anywhere
    const o = r * SAMPLES * 3;
    for (let s = 0; s < SAMPLES; s++) { const i = row + Math.min(w - 1, xa + Math.floor((s + 0.5) * (xb - xa) / SAMPLES)) * 4; ss[o + s * 3] = data[i]; ss[o + s * 3 + 1] = data[i + 1]; ss[o + s * 3 + 2] = data[i + 2]; }
  }
  return { hs, ss, inf, n };
}
// Displays with colour management or dithering return identical content with +/-1 jitter on scattered pixels,
// so rows count as unchanged when their hashes match or their colour samples are almost the same.
const near = (a, ya, b, yb) => a.hs[ya] === b.hs[yb] || rowDiff(a.ss, ya, b.ss, yb) < 3;
function rowDiff(sa, ya, sb, yb) { let d = 0; const a = ya * SAMPLES * 3, b = yb * SAMPLES * 3; for (let k = 0; k < SAMPLES * 3; k++) { const v = sa[a + k] - sb[b + k]; d += v < 0 ? -v : v; } return d / (SAMPLES * 3); }

class LiveStitcher {
  constructor(opts = {}) {
    this.maxHeight = opts.maxHeight || MAX_HEIGHT;
    this.w = 0; this.h = 0; this.first = null; this.last = null;
    this.top = 0; this.bot = 0;          // fixed header / footer heights (rows)
    this.header = null; this.footer = null;
    this.N = 0;                          // rows in the stitched moving band
    this.cap = 0; this.hs = null; this.ss = null; this.inf = null; this.chunks = [];
    // Pixel rows are stored in the order they arrive; slot[r] says where band row r is kept, so putting rows in
    // front of the picture moves a few numbers instead of the whole picture.
    this.slot = null; this.slots = 0;
    this.pos = 0;                        // where the current frame's band top sits in the stitched band
    this.state = 'initial';              // initial | collecting | revisiting | lost | full
    this.frames = 0; this.accepted = 0;
    // Screen capture always draws the mouse pointer. Rows captured while the pointer was over them are
    // 'dirty' and are replaced from a later frame that shows the same content without the pointer.
    this.dirty = null; this.headerDirty = false; this.footerDirty = false;
  }
  get height() { return this.first ? (this.N ? this.top + this.N + this.bot : this.h) : 0; }
  // ---- storage of the stitched band ----
  grow(n) {
    if (this.N + n <= this.cap) return;
    let cap = Math.max(1024, this.cap * 2); while (cap < this.N + n) cap *= 2;
    const hs = new Int32Array(cap), ss = new Uint8Array(cap * SAMPLES * 3), inf = new Uint8Array(cap), dirty = new Uint8Array(cap), slot = new Int32Array(cap);
    if (this.hs) { hs.set(this.hs.subarray(0, this.N)); ss.set(this.ss.subarray(0, this.N * SAMPLES * 3)); inf.set(this.inf.subarray(0, this.N)); dirty.set(this.dirty.subarray(0, this.N)); slot.set(this.slot.subarray(0, this.N)); }
    this.hs = hs; this.ss = ss; this.inf = inf; this.dirty = dirty; this.slot = slot; this.cap = cap;
  }
  putRow(r, f, y, info, ir, dirty = 0) {
    this.dirty[r] = dirty ? 1 : 0;
    let at = this.slot[r]; if (at < 0) at = this.slot[r] = this.slots++;
    const stride = this.w * 4, c = at >> 9, k = at & (CHUNK - 1);
    while (this.chunks.length <= c) this.chunks.push(Buffer.alloc(CHUNK * stride));
    const src = f.data, off = y * stride;
    if (src.copy) src.copy(this.chunks[c], k * stride, off, off + stride); else this.chunks[c].set(src.subarray(off, off + stride), k * stride);
    this.hs[r] = info.hs[ir]; this.inf[r] = info.inf[ir]; this.ss.set(info.ss.subarray(ir * SAMPLES * 3, (ir + 1) * SAMPLES * 3), r * SAMPLES * 3);
  }
  append(f, info, from, av) { // band rows `from`..end of this frame go below the picture
    const add = Math.min(info.n - from, this.maxHeight - this.top - this.bot - this.N);
    if (add <= 0) return 0;
    this.grow(add);
    for (let i = 0; i < add; i++) { const y = this.top + from + i; this.slot[this.N + i] = -1; this.putRow(this.N + i, f, y, info, from + i, inAv(av, y)); }
    this.N += add; return add;
  }
  prepend(f, info, count, av) { // band rows 0..count of this frame go above the picture (the ones nearest to it first)
    const add = Math.min(count, this.maxHeight - this.top - this.bot - this.N);
    if (add <= 0) return 0;
    this.grow(add);
    const N = this.N, S3 = SAMPLES * 3, skip = count - add;
    this.hs.copyWithin(add, 0, N); this.ss.copyWithin(add * S3, 0, N * S3); this.inf.copyWithin(add, 0, N); this.dirty.copyWithin(add, 0, N); this.slot.copyWithin(add, 0, N);
    for (let i = 0; i < add; i++) { const y = this.top + skip + i; this.slot[i] = -1; this.putRow(i, f, y, info, skip + i, inAv(av, y)); }
    this.N += add; return add;
  }
  // ---- matching ----
  // Where does this band (n rows) sit in the stitched band? Returns {p, score} or null. p is negative when the
  // band reaches above the top of the picture (the page was scrolled up past where the capture began).
  // Only offsets with enough overlap and enough rows that carry content are considered; ties go to the
  // offset closest to the previous position (repeating content such as identical list rows).
  locate(info, near) {
    const n = info.n, N = this.N, minOv = Math.max(16, Math.floor(n * 0.04)), inf = info.inf;
    const rows = []; for (let r = 0; r < n; r++) if (inf[r]) rows.push(r);
    if (rows.length < 6) return { blank: true };
    const scan = (lo, hi) => {
      let best = null;
      for (let p = lo; p <= hi; p++) {
        const r0 = p < 0 ? -p : 0, ov = Math.min(n, N - p); if (ov - r0 < minOv) continue;
        let used = 0, miss = 0; const allow = Math.ceil(rows.length * 0.2);
        for (let j = 0; j < rows.length; j++) { const r = rows[j]; if (r < r0) continue; if (r >= ov) break; used++; if (this.hs[p + r] !== info.hs[r]) { if (++miss > allow && miss > used * 0.2) break; } }
        if (used < 6) continue;
        const score = (used - miss) / used;
        if (!best || score > best.score + 1e-9 || (score > best.score - 0.003 && Math.abs(p - near) < Math.abs(best.p - near))) best = { p, score, used };
      }
      return best;
    };
    const LO = minOv - n, lo = Math.max(LO, near - 2 * n), hi = Math.max(0, N - minOv);
    let best = scan(lo, Math.min(hi, near + 2 * n));
    if ((!best || best.score < 0.9) && (lo > LO || near + 2 * n < hi)) { const b2 = scan(LO, hi); if (b2 && (!best || b2.score > best.score)) best = b2; }
    if (best && best.score >= 0.9) {
      // one doubtful match far from where the page was must not move the picture
      if (Math.abs(best.p - near) > 1.5 * n && (best.score < 0.97 || best.used < 20)) return null;
      return best;
    }
    return this.locateFuzzy(info, near, rows);
  }
  // Re-drawn text (fractional display scaling, smooth scrolling, font smoothing) is not pixel identical.
  // Compare small colour samples instead and average the closest 85% of rows (moving bits are ignored).
  locateFuzzy(info, near, rows) {
    const n = info.n, N = this.N, minOv = Math.max(16, Math.floor(n * 0.04));
    const pick = (step) => rows.filter((_, i) => i % step === 0);
    const lo = Math.max(minOv - n, near - 2 * n), hi = Math.min(Math.max(0, N - minOv), near + 2 * n);
    const cost = (p, list) => { const ds = []; const r0 = p < 0 ? -p : 0, ov = Math.min(n, N - p); for (const r of list) { if (r < r0) continue; if (r >= ov) break; ds.push(rowDiff(this.ss, p + r, info.ss, r)); } if (ds.length < 6 && list !== rows) return cost(p, rows); if (ds.length < 6) return 1e9; /* short overlap: every row with ink is used */ ds.sort((a, b) => a - b); const k = Math.max(1, Math.floor(ds.length * 0.85)); let t = 0; for (let i = 0; i < k; i++) t += ds[i]; return t / k; };
    const coarse = pick(Math.max(1, Math.floor(rows.length / 60)));
    let best = lo, bd = 1e9;
    for (let p = lo; p <= hi; p++) { const ov = Math.min(n, N - p) - (p < 0 ? -p : 0); if (ov < minOv) continue; const d = cost(p, coarse); if (d < bd - 1e-9 || (d < bd + 0.05 && Math.abs(p - near) < Math.abs(best - near))) { bd = d; best = p; } }
    if (bd >= 1e9) return null;
    let fb = 1e9, fp = best;
    for (let p = Math.max(lo, best - 3); p <= Math.min(hi, best + 3); p++) { const d = cost(p, rows); if (d < fb) { fb = d; fp = p; } }
    if (fb >= 6) return null;
    // the match must clearly beat the frame's own neighbours, or a page of plain lines could match anywhere
    const other = Math.min(fp - 4 >= lo ? cost(fp - 4, rows) : 1e9, fp + 4 <= hi ? cost(fp + 4, rows) : 1e9);
    if (other < 1e9 && other < fb * 1.5 + 0.5) return null;
    return { p: fp, score: 1 - fb / 255, fuzzy: true };
  }
  // ---- frames ----
  // Returns {state, added, height}. state: initial | same | collecting | revisiting | lost | blank | full
  // opts.avoid = [y0, y1): rows of this frame covered by the mouse pointer (frame rows), or nothing.
  add(f, opts = {}) {
    this.frames++;
    const av = opts.avoid && opts.avoid[1] > opts.avoid[0] ? [Math.max(0, opts.avoid[0]), opts.avoid[1]] : null;
    if (!this.first) { this.w = f.w; this.h = f.h; this.first = { f: copyFrame(f), info: rowInfo(f, 0, f.h), av }; this.last = this.first.info; this.accepted++; return this.out('initial', 0); }
    if (f.w !== this.w || f.h !== this.h) return this.out('lost', 0);
    const full = rowInfo(f, 0, f.h); let same = 0; for (let y = 0; y < f.h; y++) if (near(full, y, this.last, y)) same++;
    if (same >= f.h * 0.998) return this.out('same', 0);
    if (this.seen) { let s2 = 0; for (let y = 0; y < f.h; y++) if (full.hs[y] === this.seen[y]) s2++; if (s2 >= f.h * 0.998) return this.out('waiting', 0); }
    this.seen = full.hs;
    if (!this.N) {
      // the page has not moved yet: a frame that differs only where the pointer is (or was) shows the same
      // view; keep a pointer-free one as the starting picture
      let moved = false;
      for (let y = 0; y < f.h; y++) if (!near(this.first.info, y, full, y) && !inAv(av, y) && !inAv(this.first.av, y)) { moved = true; break; }
      if (!moved) { if (!av || this.first.av) { this.first = { f: copyFrame(f), info: full, av }; this.last = full; } return this.out('same', 0); }
      return this.start(f, full, av);
    }
    const info = sliceInfo(full, this.top, f.h - this.bot);
    const m = this.locate(info, this.pos);
    if (!m) return this.out('lost', 0);
    if (m.blank) return this.out('blank', 0);
    this.last = full; this.accepted++;
    // rows of this view that lie above the top of the picture go in front of it
    let p = m.p, up = 0;
    if (p < 0) { up = this.prepend(f, info, -p, av); p += up; if (up) this.keepHeader(f, av); }
    this.pos = p;
    if (p < 0) return this.out('full', up);
    this.clean(f, info, p, av); this.fixHeader(f, av);
    const below = p + info.n - this.N;
    let added = 0;
    if (below > 0) {
      added = this.append(f, info, info.n - below, av);
      if (added < below) { this.keepFooter(f, av); return this.out('full', added + up); }
    }
    if (p + info.n >= this.N) { this.refresh(f, info, p, added, av); this.keepFooter(f, av); return this.out(added || up ? 'collecting' : 'revisiting', added + up); }
    return this.out(up ? 'collecting' : 'revisiting', up);
  }
  // First movement: find fixed rows, then stitch the moving band of the first two frames.
  start(f, full, av) {
    const h = f.h, a = this.first.info.hs, b = full.hs, fav = this.first.av;
    // rows under the pointer in either frame may differ although they are fixed; look past them, then back
    // off to the last row that really matched
    const A = this.first.info, same = y => near(A, y, full, y), eq = y => same(y) || inAv(av, y) || inAv(fav, y);
    // A window's 1-pixel border changes colour when it loses focus (for example when the Capture bar appears), so
    // up to EDGE changing rows at the very top or bottom still count as part of a fixed header or footer.
    const EDGE = 4;
    const fixedRun = (row, limit) => {
      let s = 0; while (s < EDGE && s < limit && !eq(row(s))) s++;
      if (s >= EDGE || s >= limit) return 0;
      let n = s; while (n < limit && eq(row(n))) n++;
      while (n > s && !same(row(n - 1))) n--;
      return n - s >= 2 || s === 0 ? n : 0;
    };
    const top = fixedRun(y => y, h), bot = fixedRun(y => h - 1 - y, h - top);
    // only the outermost rows changed (a window border changing colour): the page has not scrolled yet
    let inner = false; for (let y = EDGE; y < h - EDGE; y++) if (!eq(y)) { inner = true; break; }
    if (!inner) { if (!av || fav) { this.first = { f: copyFrame(f), info: full, av }; this.last = full; } return this.out('same', 0); }
    const tries = [];
    if ((top || bot) && top <= h * 0.4 && bot <= h * 0.3 && h - top - bot >= Math.max(40, h * 0.3)) tries.push([top, bot]);
    if (top && top <= h * 0.4 && h - top >= Math.max(40, h * 0.3)) tries.push([top, 0]);
    tries.push([0, 0]);
    // Rows that look unchanged may only be smooth content (a gradient, a plain area) that moved a little. A header or
    // footer is kept only if at least one of its rows with some ink is proven fixed: unchanged in place, and not
    // matching the content d rows further down (d = the scroll distance found for this layout). A bar with no ink at
    // all cannot be told apart from plain content in one movement and is treated as fixed.
    // (When the page moved up instead, d is negative: the content of row y came from row y + d of the first view, and where
    // that is off the top, the first view's row y is looked for at row y - d of this one.)
    const proven = (y0, y1, d) => { for (let y = y0; y < y1; y++) { if (!(A.inf[y] || full.inf[y]) || inAv(av, y) || inAv(fav, y) || !near(A, y, full, y)) continue;
      const a = y + d, b = y - d;
      if (a >= 0 && a < h) { if (!inAv(fav, a) && !near(A, a, full, y)) return true; }
      else if (d < 0 && b < h && !inAv(av, b) && !near(A, y, full, b)) return true; }
      return false; };
    for (let ti = 0; ti < tries.length; ti++) {
      const [t, bo] = tries[ti];
      const firstBand = sliceInfo(this.first.info, t, h - bo), band = sliceInfo(full, t, h - bo);
      const probe = new LiveStitcher({ maxHeight: this.maxHeight }); probe.w = this.w; probe.h = h; probe.top = t; probe.bot = bo;
      probe.N = 0; probe.append(this.first.f, firstBand, 0, fav);
      const m = probe.locate(band, 0);
      if (!m || m.blank || m.p === 0) continue;
      if (!tries[ti].refined) {
        const plain = (y0, y1) => { for (let y = y0; y < y1; y++) if ((A.inf[y] || full.inf[y]) && !inAv(av, y) && !inAv(fav, y)) return false; return true; }; // a plain bar stays fixed
        const t2 = t && !proven(0, t, m.p) && !plain(0, t) ? 0 : t, b2 = bo && !proven(h - bo, h, m.p) && !plain(h - bo, h) ? 0 : bo;
        if (t2 !== t || b2 !== bo) { const r = [t2, b2]; r.refined = true; tries.splice(ti + 1, 0, r); continue; }
      }
      // adopt this layout
      Object.assign(this, { top: t, bot: bo, N: probe.N, cap: probe.cap, hs: probe.hs, ss: probe.ss, inf: probe.inf, dirty: probe.dirty, chunks: probe.chunks, slot: probe.slot, slots: probe.slots });
      this.header = t ? copyRows(this.first.f, 0, t) : null; this.headerDirty = !!t && overlaps(fav, 0, t);
      if (bo && !overlaps(fav, h - bo, h)) this.footer = copyRows(this.first.f, h - bo, h);
      this.last = full; this.accepted++;
      // the page moved up first: the rows that came into view go above the first view, whose footer stays the footer
      let p = m.p, up = 0;
      if (p < 0) { up = this.prepend(f, band, -p, av); p += up; if (up) this.keepHeader(f, av); }
      this.pos = p;
      if (p < 0) { this.keepFooter(this.first.f, fav); return this.out('full', up); }
      this.clean(f, band, p, av); this.fixHeader(f, av);
      const below = p + band.n - this.N, added = below > 0 ? this.append(f, band, band.n - below, av) : 0;
      this.keepFooter(up ? this.first.f : f, up ? fav : av);
      return this.out(added < below ? 'full' : 'collecting', added + up);
    }
    // nothing moved in a way we can line up (an animation, a blinking caret, a page that jumped too far)
    return this.out('lost', 0);
  }
  // Rows already captured near the bottom may still have been loading (lazy images); keep the newest pixels
  // for the part of the picture that is on screen right now, but only rows that are not fresh appends.
  refresh(f, info, p, added, av) {
    const end = info.n - added;
    for (let r = Math.floor(info.n * 0.25); r < end; r++) { const R = p + r; if (R < 0) continue; if (R >= this.N - added) break; if (this.hs[R] !== info.hs[r] && !this.inf[R] && info.inf[r] && !inAv(av, this.top + r)) this.putRow(R, f, this.top + r, info, r); }
  }
  // replace rows captured under the pointer, now that this frame shows them without it
  clean(f, info, p, av) {
    for (let r = 0; r < info.n; r++) { const R = p + r; if (R < 0) continue; if (R >= this.N) break; if (this.dirty[R] && !inAv(av, this.top + r)) this.putRow(R, f, this.top + r, info, r); }
  }
  fixHeader(f, av) { if (this.headerDirty && !overlaps(av, 0, this.top) && (!this.grewUp || this.pos === 0)) { this.header = copyRows(f, 0, this.top); this.headerDirty = false; } }
  // The picture grew upward: the fixed rows at the top are taken from the view that is now the top of the picture (plain
  // rows just under a real header count as fixed, and they belong to the top of the page, not to where the capture began).
  keepHeader(f, av) {
    this.grewUp = true; if (!this.top) return;
    const d = overlaps(av, 0, this.top);
    if (!d || !this.header) { this.header = copyRows(f, 0, this.top); this.headerDirty = d; }
  }
  keepFooter(f, av) {
    if (!this.bot) { this.footer = null; return; }
    const d = overlaps(av, f.h - this.bot, f.h);
    if (!d || !this.footer) { this.footer = copyRows(f, f.h - this.bot, f.h); this.footerDirty = d; }
  }
  // rows of the result that still show the pointer (no pointer-free view of them was seen)
  get dirtyRows() {
    if (!this.N) return this.first && this.first.av ? this.first.av[1] - this.first.av[0] : 0;
    let n = (this.headerDirty ? this.top : 0) + (this.footerDirty ? this.bot : 0);
    for (let r = 0; r < this.N; r++) n += this.dirty[r];
    return n;
  }
  out(state, added) { if (this.state === 'full') return { state: 'full', added, height: this.height }; if (state === 'collecting' || state === 'revisiting' || state === 'full' || state === 'initial') this.state = state; else if (state === 'lost') this.state = 'lost'; return { state, added, height: this.height }; }
  result() {
    if (!this.first) return null;
    if (!this.N) return copyFrame(this.first.f);
    const stride = this.w * 4, H = this.top + this.N + this.bot, out = Buffer.alloc(stride * H);
    let o = 0;
    if (this.header) { this.header.copy(out, 0); o = this.header.length; }
    for (let r = 0; r < this.N; r++) { const at = this.slot[r], k = at & (CHUNK - 1); this.chunks[at >> 9].copy(out, o, k * stride, (k + 1) * stride); o += stride; }
    if (this.footer) this.footer.copy(out, o);
    return { data: out, w: this.w, h: H };
  }
}
const inAv = (av, y) => !!av && y >= av[0] && y < av[1];
const overlaps = (av, y0, y1) => !!av && av[0] < y1 && av[1] > y0;
function sliceInfo(info, y0, y1) { return { hs: info.hs.subarray(y0, y1), ss: info.ss.subarray(y0 * SAMPLES * 3, y1 * SAMPLES * 3), inf: info.inf.subarray(y0, y1), n: y1 - y0 }; }
function copyFrame(f) { return { data: Buffer.from(f.data), w: f.w, h: f.h }; }
function copyRows(f, y0, y1) { const s = f.w * 4; return Buffer.from(f.data.subarray ? f.data.subarray(y0 * s, y1 * s) : f.data.slice(y0 * s, y1 * s)); }

module.exports = { LiveStitcher, rowInfo, MAX_HEIGHT };
