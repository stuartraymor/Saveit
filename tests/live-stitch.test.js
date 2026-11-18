// Unit tests for the 10.3.10 live scrolling stitcher (app/live-stitch.js). Run: node tests/live-stitch.test.js
// A synthetic long "web page" is viewed through a window; frames are what the screen shows at each scroll
// position, including an optional sticky header, fixed footer, moving scroll-bar thumb and re-draw noise.
'use strict';
const assert = require('assert');
const { LiveStitcher } = require('../app/live-stitch.js');

const W = 420;
// Text-like page: paragraphs of "words" with blank gaps, plus a few large picture blocks.
function makePage(H, seed = 1) {
  const d = new Uint8Array(W * H * 4).fill(255);
  let s = seed >>> 0; const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  let y = 10;
  while (y < H - 40) {
    if (rnd() < 0.12) { // picture
      const h = 60 + Math.floor(rnd() * 120), c = [rnd() * 255, rnd() * 255, rnd() * 255];
      for (let yy = y; yy < Math.min(H, y + h); yy++) for (let x = 30; x < W - 60; x++) { const i = (yy * W + x) * 4; d[i] = (c[0] + yy * 3 + x) & 255; d[i + 1] = (c[1] + x * 2) & 255; d[i + 2] = (c[2] + yy) & 255; }
      y += h + 14; continue;
    }
    const lines = 1 + Math.floor(rnd() * 5);
    for (let l = 0; l < lines; l++) {
      let x = 20;
      while (x < W - 80) { const ww = 8 + Math.floor(rnd() * 40); for (let yy = y; yy < y + 12; yy++) for (let xx = x; xx < x + ww; xx++) if (((xx * 7 + yy * 3) ^ Math.floor(rnd() * 3)) % 4) { const i = (yy * W + xx) * 4; d[i] = d[i + 1] = d[i + 2] = 30 + ((xx + yy) & 31); } x += ww + 6; }
      y += 18;
    }
    y += 16 + Math.floor(rnd() * 20);
  }
  for (let i = 3; i < d.length; i += 4) d[i] = 255;
  return d;
}
const HEADER = 50, FOOTER = 30;
function frame(P, PH, y, VH, o = {}) {
  const d = new Uint8Array(W * VH * 4);
  for (let r = 0; r < VH; r++) {
    for (let x = 0; x < W; x++) {
      const i = (r * W + x) * 4; let v;
      if (o.header && r < HEADER) v = [20, 60 + (x % 50), 140];
      else if (o.footer && r >= VH - FOOTER) v = [200, 40 + (x % 30), 40];
      else { const j = ((y + r) * W + x) * 4; v = [P[j], P[j + 1], P[j + 2]]; }
      if (x >= W - 12) { const t = Math.floor(y / (PH - VH) * (VH - 60)); v = r >= t && r < t + 60 ? [120, 120, 120] : [235, 235, 235]; }
      if (o.noise) for (let k = 0; k < 3; k++) { const q = Math.imul((x + 1) * 73856093 ^ (y + r + 1) * 19349663 ^ (y + 7) * 83492791 ^ k, 2654435761) >>> 0; v[k] = Math.max(0, Math.min(255, v[k] + (q % (2 * o.noise + 1)) - o.noise)); }
      d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; d[i + 3] = 255;
    }
  }
  return { data: Buffer.from(d), w: W, h: VH };
}
// Expected picture for a capture whose deepest frame started at yMax (scroll bar columns are ignored).
function expected(P, y0, yMax, VH, o = {}) {
  const top = o.header ? HEADER : 0, bot = o.footer ? FOOTER : 0, rows = [];
  for (let r = 0; r < top; r++) rows.push({ kind: 'h', r });
  for (let py = y0 + top; py < yMax + VH - bot; py++) rows.push({ kind: 'p', py });
  for (let r = 0; r < bot; r++) rows.push({ kind: 'f', r: VH - bot + r });
  return rows;
}
function check(name, P, PH, res, y0, yMax, VH, o = {}) {
  const exp = expected(P, y0, yMax, VH, o);
  assert.strictEqual(res.h, exp.length, `${name}: height ${res.h} != expected ${exp.length}`);
  const tol = o.noise ? o.noise * 2 + 1 : 0;
  let bad = 0;
  for (let r = 0; r < exp.length; r++) {
    const e = exp[r];
    for (let x = 0; x < W - 20; x += 3) {
      let v;
      if (e.kind === 'h') v = [20, 60 + (x % 50), 140]; else if (e.kind === 'f') v = [200, 40 + (x % 30), 40]; else { const j = (e.py * W + x) * 4; v = [P[j], P[j + 1], P[j + 2]]; }
      const i = (r * W + x) * 4;
      if (Math.abs(res.data[i] - v[0]) > tol || Math.abs(res.data[i + 1] - v[1]) > tol || Math.abs(res.data[i + 2] - v[2]) > tol) { bad++; break; }
    }
  }
  assert(bad === 0, `${name}: ${bad} rows differ from the page`);
  console.log('pass', name, res.h + 'px');
}
function run(name, path, o = {}, PH = 5200, VH = 600) {
  const P = makePage(PH, name.length * 977), st = new LiveStitcher(); let yMax = 0;
  const t0 = Date.now();
  for (const y of path) { const f = frame(P, PH, y, VH, o); st.add(f); yMax = Math.max(yMax, y); }
  const ms = (Date.now() - t0) / path.length;
  check(name, P, PH, st.result(), path[0], yMax, VH, o);
  return { st, ms };
}
const ramp = (from, to, step) => { const a = []; for (let y = from; step > 0 ? y <= to : y >= to; y += step) a.push(y); if (a[a.length - 1] !== to) a.push(to); return a; };

// Test A: standard page, scrolled down in steady steps
run('A standard page, steady scrolling', ramp(0, 2400, 120));
// Test B: down, then back up; result only has what was reached going down
run('B down then back up', [...ramp(0, 1800, 150), ...ramp(1800, 300, -170)]);
// Test C: down, up, then further down than before; nothing duplicated, new content appended
run('C down, up, down past the old end', [...ramp(0, 1500, 140), ...ramp(1500, 200, -200), ...ramp(200, 3000, 160)]);
// Test D: small, medium and large scroll movements
{ const p = [0]; let y = 0; const steps = [7, 40, 300, 13, 420, 90, 3, 250, 480, 61]; for (let i = 0; y < 3600; i++) { y = Math.min(3600, y + steps[i % steps.length]); p.push(y); } run('D variable scroll distances', p); }
// Test E: sticky header and fixed footer are kept once
run('E sticky header + footer', ramp(0, 2600, 130), { header: true, footer: true });
run('E2 sticky header, re-drawn text (scaling noise)', ramp(0, 2000, 110), { header: true, noise: 2 });
// Test F: long document, many frames, smooth scrolling (small repeated steps and pauses)
{ const p = []; for (let y = 0; y <= 14000; y += 37) { p.push(y); if (y % 370 === 0) p.push(y); } const { ms } = run('F long document (smooth scrolling)', p, {}, 15000, 700); console.log(`  average ${ms.toFixed(1)} ms per frame`); }
// Test G: cancel and restart: a fresh stitcher has no stale data
{ const P = makePage(3000, 5), a = new LiveStitcher(); a.add(frame(P, 3000, 0, 500)); a.add(frame(P, 3000, 200, 500));
  const b = new LiveStitcher(); assert.strictEqual(b.height, 0); assert.strictEqual(b.result(), null); b.add(frame(P, 3000, 1000, 500)); const r = b.result(); assert.strictEqual(r.h, 500); console.log('pass G cancel and restart starts clean'); }
// A frame that cannot be lined up (another page) is ignored, and the picture is not corrupted
{ const P = makePage(4000, 9), Q = makePage(4000, 12345), st = new LiveStitcher();
  for (const y of ramp(0, 900, 150)) st.add(frame(P, 4000, y, 500));
  const r = st.add(frame(Q, 4000, 700, 500)); assert.strictEqual(r.state, 'lost', 'unrelated frame should be lost, got ' + r.state);
  for (const y of ramp(900, 1500, 150)) st.add(frame(P, 4000, y, 500));
  check('unrelated frame in the middle is ignored', P, 4000, st.result(), 0, 1500, 500); }
// Scrolling up past the starting point adds nothing above it
run('scrolled above the start point', [800, 600, 300, 0, 400, 900, 1300]);
// No movement at all: the first frame is returned unchanged
{ const P = makePage(2000, 3), st = new LiveStitcher(); for (let i = 0; i < 4; i++) st.add(frame(P, 2000, 0, 400)); assert.strictEqual(st.result().h, 400); console.log('pass no scrolling returns the visible area'); }
// Height limit: stops growing at the limit and says so
{ const P = makePage(9000, 4), st = new LiveStitcher({ maxHeight: 2000 }); let last; for (const y of ramp(0, 8000, 200)) last = st.add(frame(P, 9000, y, 500)); assert.strictEqual(st.result().h, 2000); assert.strictEqual(st.state, 'full'); console.log('pass height limit is respected'); }
// Mouse pointer: screen capture draws it into every frame. Rows under it are marked and must be replaced
// from a later pointer-free view (the app takes one last frame after Capture is clicked, pointer on the bar).
function withPointer(f, cy, cx = 200) {
  const d = Buffer.from(f.data);
  for (let r = 0; r < 20; r++) for (let x = 0; x <= r * 0.6; x++) { const y = cy + r; if (y < 0 || y >= f.h) continue; const i = (y * f.w + cx + x) * 4; const edge = x === 0 || x >= Math.floor(r * 0.6) || r === 19; d[i] = d[i + 1] = d[i + 2] = edge ? 0 : 255; }
  return { data: d, w: f.w, h: f.h };
}
const avoidAt = cy => ({ avoid: [cy - 4, cy + 36] });
function runPtr(name, path, cys, o = {}, PH = 5200, VH = 600, finalClean = true) {
  const P = makePage(PH, name.length * 131), st = new LiveStitcher(); let yMax = 0;
  path.forEach((y, k) => { const cy = cys(k); const f = frame(P, PH, y, VH, o); st.add(cy == null ? f : withPointer(f, cy), cy == null ? {} : avoidAt(cy)); yMax = Math.max(yMax, y); });
  if (finalClean) st.add(frame(P, PH, path[path.length - 1], VH, o));
  if (finalClean) { if (!o.allowDirty) assert.strictEqual(st.dirtyRows, 0, name + ': rows still show the pointer: ' + st.dirtyRows); check(name, P, PH, st.result(), path[0], yMax, VH, o); }
  return st;
}
runPtr('P1 pointer resting over the page while scrolling', ramp(0, 2400, 120), () => 300, { header: true, footer: true });
runPtr('P2 pointer over the sticky header at the start', ramp(0, 2000, 140), k => k < 3 ? 20 : 260, { header: true, allowDirty: true }); // the avoid band reaches 6 rows below the header; those rows scroll under the header and are never seen again (pixels are still right)
runPtr('P3 pointer over the footer, then moved', ramp(0, 1800, 110), k => k < 6 ? 575 : 330, { footer: true });
runPtr('P4 pointer moving around before the page moves', [0, 0, 0, 0, ...ramp(0, 1500, 150)], k => [100, 250, 400, 520][k] ?? 300);
runPtr('P5 pointer near the bottom where new rows arrive', ramp(0, 2200, 100), () => 560);
runPtr('P6 down, up and down with the pointer moving', [...ramp(0, 1500, 140), ...ramp(1500, 200, -200), ...ramp(200, 2600, 160)], k => 200 + (k * 47) % 380, { header: true });
{ const P = makePage(2000, 3), st = new LiveStitcher(); for (const cy of [50, 200, 350]) st.add(withPointer(frame(P, 2000, 0, 400), cy), avoidAt(cy)); assert(st.dirtyRows > 0); st.add(frame(P, 2000, 0, 400)); assert.strictEqual(st.dirtyRows, 0); check('P7 no scrolling, pointer moved, clean last frame', P, 2000, st.result(), 0, 0, 400); }
// A picture that only changes from left to right sits at the bottom of the first view. After a tiny first scroll
// it looks unchanged, but it is page content, not a fixed footer; a later large jump must still line up.
{ const PH = 5200, VH = 600, name = 'D2 tiny first step over a picture, then large jumps', P = makePage(PH, 4242);
  for (let y = VH - 140; y < VH + 220; y++) for (let x = 30; x < W - 60; x++) { const i = (y * W + x) * 4; P[i] = (x * 0.6) & 255; P[i + 1] = 255 - ((x * 0.4) & 255); P[i + 2] = 120; }
  const st = new LiveStitcher(), path = [0, 20, 80, 530, 542, 1000, 1480, 1490, 1950]; for (const y of path) { const r = st.add(frame(P, PH, y, VH, { header: true })); if (process.env.DBG) console.log(y, r.state, st.top, st.bot, st.N, st.pos); }
  assert.strictEqual(st.bot, 0, 'picture rows were taken for a fixed footer'); check(name, P, PH, st.result(), 0, 1950, VH, { header: true }); }
console.log('live stitch tests OK');
