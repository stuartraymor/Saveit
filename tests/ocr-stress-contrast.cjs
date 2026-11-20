// 10.4.2 Grab Text stress test for bright, dark and mixed areas and stretched lettering (the cases users still found poor after 10.4.1).
// Generated pictures with known text: near-white and very dark backgrounds, low contrast light-on-light and dark-on-dark, pictures split
// into a dark and a light part (a dark toolbar above a white page, a dark panel beside a light one), gradients, glare spots, photo-like
// noise, and text stretched 1.3x-3x wide, 1.3x-2.5x tall or squeezed. Each picture is read through Saveit's real Grab Text path
// (window.bench.ocr = ocr.ps1 + main.js clean-up) in a real Saveit, and scored by character error rate and exact pictures.
// node tests/ocr-stress-contrast.cjs <runtime Saveit.exe> <evidence folder> [count=240] [seed=7]
'use strict';
const { _electron } = require('playwright'), fs = require('fs'), path = require('path');
const [exe, out, countArg, seedArg] = process.argv.slice(2), COUNT = +countArg || 240;
let seed = +seedArg || 7; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pad = (n, w) => String(n).padStart(w, '0');
const FONTS = ['Segoe UI', 'Arial', 'Calibri', 'Times New Roman', 'Georgia', 'Verdana', 'Tahoma', 'Consolas', 'Cambria', 'Trebuchet MS', 'Bahnschrift', 'Impact', 'Franklin Gothic Medium', 'Corbel'];
const SENT = ['Saveit keeps every capture until you delete it.', 'Press Print Screen to capture a region.', 'Your changes were saved automatically.', 'Click Next to continue with the setup.', 'The quick brown fox jumps over the lazy dog.', 'Meeting moved to Thursday afternoon.', 'No results match your search.', 'Battery saver is on', 'Signed in as Jordan Lee', 'Upload complete', 'Choose a folder for your exports', 'Unsaved changes will be lost.', 'Remember me on this device', 'Last edited by Morgan yesterday', 'Download the latest version', 'Settings and privacy', 'Share this document', 'Open recent files'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const GEN = {
  sentence: () => pick(SENT),
  money: () => pick([() => '$' + int(1, 99999).toLocaleString('en-US') + '.' + pad(int(0, 99), 2), () => 'Total: $' + int(1, 999) + '.' + pad(int(0, 99), 2), () => 'Balance ' + '$' + int(10, 9999) + '.' + pad(int(0, 99), 2)])(),
  date: () => pick([() => `${int(2019, 2027)}-${pad(int(1, 12), 2)}-${pad(int(1, 28), 2)}`, () => `${int(1, 12)}/${int(1, 28)}/${int(2019, 2027)}`, () => `${pick(MONTHS)} ${int(1, 28)}, ${int(2019, 2027)}`])(),
  number: () => pick([() => int(1000, 9999999).toLocaleString('en-US'), () => (rnd() * 100).toFixed(int(1, 3)), () => `${int(1, 99)}%`, () => `v${int(1, 12)}.${int(0, 20)}.${int(0, 99)}`, () => `${int(1, 999)} x ${int(1, 999)} px`])(),
  id: () => pick([() => `INV-${int(10000, 99999)}`, () => `Order #${int(100000, 999999)}`, () => `Code ${int(100, 999)}-${int(100, 999)}`, () => `SN ${Array.from({ length: 6 }, () => pick('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split(''))).join('')}`])(),
  phone: () => pick([() => `${int(200, 999)}-${int(200, 999)}-${pad(int(0, 9999), 4)}`, () => `(${int(200, 999)}) ${int(200, 999)}-${pad(int(0, 9999), 4)}`])(),
  caps: () => pick(['SAVE CHANGES', 'ACCOUNT LOCKED', 'NEW MESSAGE', 'CHECKOUT', 'FREE SHIPPING', 'SIGN IN', 'LIMITED OFFER 50% OFF']),
  mixed: () => pick(['Windows 11 Pro 24H2', 'USB-C to HDMI adapter', 'Room 4B, Floor 12', 'Flight UA 2847 at Gate C17', 'Model X7-200 rev. B', 'support@example.com', 'www.example.com/help']),
};
const KINDS = Object.keys(GEN);
// [name, background, text colour]; "bright" and "dark" are where users saw most mistakes
const BRIGHT = [['white-grey', '#ffffff', '#9ca3af'], ['white-lightgrey', '#ffffff', '#c4c8cc'], ['offwhite-pale', '#f3f4f6', '#b8bcc2'], ['cream-yellow', '#fffbea', '#c79a12'], ['white-pale-blue', '#ffffff', '#93b4e6'], ['white-black', '#ffffff', '#111111'], ['yellow-white', '#fde047', '#ffffff'], ['lightblue-white', '#7dd3fc', '#ffffff']];
const DARK = [['black-grey', '#000000', '#5c5c5c'], ['black-dimgrey', '#0b0b0b', '#3f3f3f'], ['charcoal-grey', '#1e1e1e', '#6e6e6e'], ['github-dark', '#0d1117', '#8b949e'], ['navy-blue', '#0f172a', '#3b82f6'], ['black-white', '#000000', '#ffffff'], ['dark-red', '#1a0505', '#b91c1c'], ['dark-green', '#03140a', '#16a34a']];
const LAYOUTS = ['solid-bright', 'solid-dark', 'stack', 'side', 'gradient', 'glare', 'noise-dark', 'noise-bright', 'photo'];
function makeCase(i) {
  const layout = LAYOUTS[i % LAYOUTS.length], n = layout === 'stack' || layout === 'side' ? int(2, 3) : rnd() < .6 ? 1 : 2, kind = KINDS[Math.floor(i / LAYOUTS.length) % KINDS.length];
  const lines = Array.from({ length: n }, (_, k) => GEN[k ? pick(KINDS) : kind]()), font = pick(FONTS), size = pick([11, 12, 13, 14, 15, 16, 18, 20, 24, 28]), bold = rnd() < .25;
  // about a third of the pictures are stretched: wide, tall or squeezed; the rest are normal so contrast is measured on its own too
  const st = pick(['none', 'none', 'none', 'wide', 'tall', 'squeeze', 'squash']), sx = st === 'wide' ? pick([1.3, 1.6, 2, 2.5, 3]) : st === 'squeeze' ? pick([.6, .75]) : 1, sy = st === 'tall' ? pick([1.3, 1.6, 2, 2.5]) : st === 'squash' ? pick([.6, .75]) : 1;
  const bright = pick(BRIGHT), dark = pick(DARK), dpr = pick([1, 1, 1.25, 1.5, 2]), blur = pick([0, 0, 0, .5]), jpeg = pick([0, 0, 0, 70]);
  return { i, layout, kind, lines, font, size, bold, st, sx, sy, bright, dark, dpr, blur, jpeg, seed: int(1, 1e9) };
}
const norm = s => s.replace(/[\t ]+/g, ' ').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").split('\n').map(l => l.trim()).filter(Boolean).join('\n');
function lev(a, b) { const m = a.length, n = b.length; if (!m) return n; if (!n) return m; let p = Array.from({ length: n + 1 }, (_, j) => j); for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[n]; }
(async () => {
  fs.mkdirSync(path.join(out, 'pics'), { recursive: true });
  const app = await _electron.launch({ executablePath: exe, env: { ...process.env, SAVEIT_REVIEW_DATA: path.join(out, 'profile') }, timeout: 30000 });
  // the editor window (Saveit also keeps a hidden region selector and widget ready, which can open first)
  await app.firstWindow(); let p = null; for (let k = 0; k < 300 && !p; k++) { p = app.windows().find(w => w.url().includes('index.html')); if (!p) await new Promise(r => setTimeout(r, 100)); }
  await p.waitForFunction(() => document.body.dataset.catalogCount, null, { timeout: 90000 });
  const cases = Array.from({ length: COUNT }, (_, i) => makeCase(i)), results = [];
  for (const c of cases) {
    c.png = await p.evaluate(async c => {
      let sd = c.seed; const r = () => { sd = (sd * 1103515245 + 12345) % 2147483648; return sd / 2147483648; };
      const s = c.dpr, font = `${c.bold ? 700 : 400} ${c.size * s}px '${c.font}'`; await document.fonts.load(font).catch(() => {});
      const m = document.createElement('canvas').getContext('2d'); m.font = font;
      const lineH = Math.round(c.size * 1.6 * s * c.sy), padX = Math.round((c.size + 10) * s), padY = Math.round((c.size * .6 + 8) * s), gap = c.layout === 'stack' ? Math.round(14 * s) : 0;
      const widths = c.lines.map(l => m.measureText(l).width * c.sx), side = c.layout === 'side';
      // side: line 0 in a dark panel on the left; the others in the light area on the right, each on its own row
      const leftW = side ? Math.ceil(widths[0] + 2 * padX) : 0, W = side ? leftW + Math.ceil(Math.max(...widths.slice(1)) + 2 * padX) : Math.ceil(Math.max(...widths) + 2 * padX), H = Math.ceil(lineH * c.lines.length + 2 * padY + gap);
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
      const [, bB, bF] = c.bright, [, dB, dF] = c.dark, rows = c.lines.map((l, k) => ({ l, x: side && k ? leftW + padX : padX, y: padY + lineH * (k + .5) + (c.layout === 'stack' && k ? gap : 0), fg: bF }));
      const fillNoise = (x0, y0, w, h, amp) => { const d = g.getImageData(x0, y0, w, h); for (let q = 0; q < d.data.length; q += 4) { const v = (r() - .5) * amp; d.data[q] += v; d.data[q + 1] += v; d.data[q + 2] += v; } g.putImageData(d, x0, y0); };
      if (c.layout === 'solid-bright') { g.fillStyle = bB; g.fillRect(0, 0, W, H); }
      else if (c.layout === 'solid-dark') { g.fillStyle = dB; g.fillRect(0, 0, W, H); rows.forEach(o => o.fg = dF); }
      else if (c.layout === 'stack') { const cut = Math.round(padY + lineH + gap / 2); g.fillStyle = dB; g.fillRect(0, 0, W, cut); g.fillStyle = bB; g.fillRect(0, cut, W, H - cut); rows[0].fg = dF; }
      else if (c.layout === 'side') { g.fillStyle = dB; g.fillRect(0, 0, leftW, H); g.fillStyle = bB; g.fillRect(leftW, 0, W - leftW, H); rows[0].fg = dF; }
      else if (c.layout === 'gradient') { const gr = g.createLinearGradient(0, 0, W, 0); const darkFirst = r() < .5; gr.addColorStop(0, darkFirst ? '#202020' : '#ffffff'); gr.addColorStop(1, darkFirst ? '#9a9a9a' : '#a8a8a8'); g.fillStyle = gr; g.fillRect(0, 0, W, H); rows.forEach(o => o.fg = darkFirst ? '#f5f5f5' : '#202020'); }
      else if (c.layout === 'glare') { g.fillStyle = '#c9ced6'; g.fillRect(0, 0, W, H); const gr = g.createRadialGradient(W * (.2 + .6 * r()), H / 2, 0, W * .5, H / 2, W * .45); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); rows.forEach(o => o.fg = '#5b6370'); }
      else if (c.layout === 'noise-dark') { g.fillStyle = dB; g.fillRect(0, 0, W, H); fillNoise(0, 0, W, H, 50); rows.forEach(o => o.fg = dF); }
      else if (c.layout === 'noise-bright') { g.fillStyle = bB; g.fillRect(0, 0, W, H); fillNoise(0, 0, W, H, 40); }
      else { const gr = g.createRadialGradient(W * .3, H * .3, 0, W * .5, H * .5, Math.max(W, H)); gr.addColorStop(0, '#8a7a66'); gr.addColorStop(.5, '#3a3f2c'); gr.addColorStop(1, '#0d0f12'); g.fillStyle = gr; g.fillRect(0, 0, W, H); for (let k = 0; k < 30; k++) { g.fillStyle = `rgba(${200 * r() | 0},${180 * r() | 0},${140 * r() | 0},.25)`; g.beginPath(); g.arc(W * r(), H * r(), 10 * s + 40 * s * r(), 0, 7); g.fill(); } fillNoise(0, 0, W, H, 30); rows.forEach(o => o.fg = '#ffffff'); }
      if (c.blur) g.filter = `blur(${c.blur * s}px)`;
      g.textBaseline = 'middle';
      for (const o of rows) { g.save(); g.translate(o.x, o.y); g.scale(c.sx, c.sy); g.font = font; g.fillStyle = o.fg; g.fillText(o.l, 0, 0); g.restore(); }
      let url = cv.toDataURL();
      if (c.jpeg) { const im = new Image(); im.src = cv.toDataURL('image/jpeg', c.jpeg / 100); await im.decode(); const g2 = cv.getContext('2d'); g2.filter = 'none'; g2.drawImage(im, 0, 0); url = cv.toDataURL(); }
      return url.split(',')[1];
    }, c);
    fs.writeFileSync(path.join(out, 'pics', `${String(c.i).padStart(3, '0')}.png`), Buffer.from(c.png, 'base64'));
  }
  let next = 0; const t0 = Date.now();
  await Promise.all([0, 1, 2, 3].map(async () => { while (next < cases.length) { const c = cases[next++]; const s = Date.now();
    const got = await p.evaluate(async url => { const img = new Image(); img.src = url; await img.decode(); const b = document.createElement('canvas'); b.width = img.width; b.height = img.height; const g = b.getContext('2d'); g.fillStyle = 'white'; g.fillRect(0, 0, b.width, b.height); g.drawImage(img, 0, 0); return window.bench.ocr(b.toDataURL()); }, 'data:image/png;base64,' + c.png).catch(e => 'ERROR ' + e.message);
    const want = norm(c.lines.join('\n')), have = norm(got), e = lev(have, want); delete c.png;
    results.push({ ...c, bright: c.bright[0], dark: c.dark[0], want, got: have, err: e, len: want.length, ms: Date.now() - s }); } }));
  results.sort((a, b) => a.i - b.i);
  const sum = rs => { const E = rs.reduce((n, r) => n + r.err, 0), N = rs.reduce((n, r) => n + r.len, 0); return { n: rs.length, cer: +(100 * E / N).toFixed(2), exact: rs.filter(r => !r.err).length, ms: Math.round(rs.reduce((n, r) => n + r.ms, 0) / rs.length) }; };
  const rep = [], total = sum(results); rep.push(`TOTAL ${total.n} pictures  CER ${total.cer}%  exact ${total.exact}/${total.n}  avg ${total.ms} ms per picture (4 at a time)  (${((Date.now() - t0) / 1000).toFixed(0)} s reading)`);
  const factor = (name, f) => { const g = {}; for (const r of results) (g[f(r)] ??= []).push(r); rep.push(`\n-- by ${name}`); for (const [k, rs] of Object.entries(g).sort((a, b) => sum(b[1]).cer - sum(a[1]).cer)) { const s = sum(rs); rep.push(`  ${String(k).padEnd(24)} n=${String(s.n).padStart(3)}  CER ${String(s.cer).padStart(6)}%  exact ${s.exact}/${s.n}  ${s.ms} ms`); } };
  factor('layout', r => r.layout); factor('stretch', r => r.st === 'none' ? 'none' : `${r.st} ${r.st === 'wide' || r.st === 'squeeze' ? r.sx : r.sy}`); factor('stretch kind', r => r.st);
  factor('bright theme (bright layouts)', r => /bright|stack|side/.test(r.layout) ? r.bright : '(n/a)'); factor('dark theme (dark layouts)', r => /dark|stack|side/.test(r.layout) ? r.dark : '(n/a)');
  factor('kind', r => r.kind); factor('font', r => r.font); factor('size px', r => r.size <= 13 ? '11-13' : r.size <= 18 ? '14-18' : '20-28'); factor('display scale', r => r.dpr); factor('blur', r => r.blur); factor('jpeg', r => r.jpeg || 'none');
  rep.push('\n-- worst 40'); for (const r of [...results].sort((a, b) => b.err / b.len - a.err / a.len).slice(0, 40)) rep.push(`  #${r.i} ${r.layout} ${r.kind} ${r.font} ${r.size}px b${+r.bold} ${r.st} x${r.sx} y${r.sy} ${r.bright}/${r.dark} @${r.dpr}x blur${r.blur} jpg${r.jpeg}\n     want: ${JSON.stringify(r.want)}\n     got:  ${JSON.stringify(r.got)}`);
  console.log(rep.join('\n')); fs.writeFileSync(path.join(out, 'ocr-stress-contrast.txt'), rep.join('\n')); fs.writeFileSync(path.join(out, 'ocr-stress-contrast.json'), JSON.stringify(results, null, 1));
  const pid = app.process().pid; await Promise.race([app.close().catch(() => {}), new Promise(r => setTimeout(r, 6000))]); try { require('child_process').execSync('taskkill /PID ' + pid + ' /T /F', { stdio: 'ignore' }); } catch (_) {}
})().catch(e => { console.error(e); process.exitCode = 1; });
