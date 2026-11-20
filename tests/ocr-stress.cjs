// 10.4.0 Grab Text stress test: hundreds of generated pictures with known text, varied in font, size, weight, stretching,
// letter spacing, blur, JPEG compression, slight rotation, colours and backgrounds, display scaling and kind of text
// (sentences, money, dates, times, phone numbers, percentages, IDs, hex, e-mail, web addresses, file paths, symbols, code,
// capitals). Each picture is read through Saveit's real Grab Text path (window.bench.ocr = ocr.ps1 + main.js clean-up) in a
// real Saveit. Reports character error rate and exact cases overall and per factor, and the worst cases.
// node tests/ocr-stress.cjs <runtime Saveit.exe> <evidence folder> [count=500] [seed=1]
'use strict';
const { _electron } = require('playwright'), fs = require('fs'), path = require('path');
const [exe, out, countArg, seedArg] = process.argv.slice(2), COUNT = +countArg || 500;
let seed = +seedArg || 1; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pad = (n, w) => String(n).padStart(w, '0');
const FONTS = ['Segoe UI', 'Arial', 'Calibri', 'Times New Roman', 'Georgia', 'Verdana', 'Tahoma', 'Consolas', 'Courier New', 'Cambria', 'Trebuchet MS', 'Comic Sans MS', 'Lucida Console', 'Candara', 'Corbel', 'Bahnschrift', 'Franklin Gothic Medium', 'Constantia', 'Segoe Print', 'Impact'];
const SENT = ['Saveit keeps every capture until you delete it.', 'Press Print Screen to capture a region.', 'Your changes were saved automatically.', 'Click Next to continue with the setup.', 'The quick brown fox jumps over the lazy dog.', 'Meeting moved to Thursday afternoon.', 'Please restart the application to finish updating.', 'No results match your search.', 'Battery saver is on', 'Signed in as Jordan Lee', 'Upload complete', 'Connection lost. Trying again in 5 seconds.', 'Choose a folder for your exports', 'Dark mode follows your system setting', 'Unsaved changes will be lost.', 'Two-factor authentication is enabled', 'Shipping is free on orders over fifty dollars', 'Remember me on this device', 'Terms of Service and Privacy Policy', 'Last edited by Morgan yesterday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const thousands = n => n.toLocaleString('en-US');
const GEN = {
  sentence: () => pick(SENT),
  money: () => pick([() => '$' + thousands(int(1, 99999)) + '.' + pad(int(0, 99), 2), () => 'Total: $' + int(1, 999) + '.' + pad(int(0, 99), 2), () => '€' + int(1, 9999) + ',' + pad(int(0, 99), 2), () => '£' + thousands(int(1, 99999)) + '.' + pad(int(0, 99), 2), () => '-$' + int(1, 999) + '.' + pad(int(0, 99), 2)])(),
  date: () => pick([() => `${int(2019, 2027)}-${pad(int(1, 12), 2)}-${pad(int(1, 28), 2)}`, () => `${int(1, 12)}/${int(1, 28)}/${int(2019, 2027)}`, () => `${int(1, 28)} ${pick(MONTHS)} ${int(2019, 2027)}`, () => `${pick(MONTHS)} ${int(1, 28)}, ${int(2019, 2027)}`])(),
  time: () => pick([() => `${pad(int(0, 23), 2)}:${pad(int(0, 59), 2)}:${pad(int(0, 59), 2)}`, () => `${int(1, 12)}:${pad(int(0, 59), 2)} ${pick(['AM', 'PM'])}`, () => `${int(0, 9)}:${pad(int(0, 59), 2)}.${int(0, 9)}`])(),
  phone: () => pick([() => `+1 (${int(200, 999)}) ${int(200, 999)}-${pad(int(0, 9999), 4)}`, () => `${int(200, 999)}-${int(200, 999)}-${pad(int(0, 9999), 4)}`, () => `+44 20 ${int(1000, 9999)} ${int(1000, 9999)}`])(),
  number: () => pick([() => thousands(int(1000, 9999999)), () => (rnd() * 100).toFixed(int(1, 4)), () => (rnd() < .5 ? '-' : '+') + (rnd() * 10).toFixed(2) + '%', () => `${int(1, 99)}%`, () => `v${int(1, 12)}.${int(0, 20)}.${int(0, 99)}`, () => `${int(1, 999)} x ${int(1, 999)} px`, () => `${int(10, 99)}.${int(0, 9)} °C`, () => `${(rnd() * 999).toFixed(1)} MB`])(),
  id: () => pick([() => `INV-${int(10000, 99999)}`, () => [0, 0, 0].map(() => Array.from({ length: 4 }, () => pick('0123456789ABCDEF'.split(''))).join('')).join('-'), () => `SN: ${Array.from({ length: 4 }, () => pick('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split(''))).join('')}-${int(1000, 9999)}`, () => `0x${int(0x10000000, 0x7fffffff).toString(16).toUpperCase()}`, () => `#${int(0, 0xffffff).toString(16).toUpperCase().padStart(6, '0')}`, () => `Order #${int(100000, 999999)}`])(),
  email: () => pick(['jordan.lee', 'support', 'm.garcia', 'team-ops', 'noreply', 'a.b_c']) + '@' + pick(['example.com', 'northwind-traders.com', 'mail.co.uk', 'contoso.org']),
  url: () => pick(['https://www.example.com/help', 'https://github.com/owner/repo/issues/42', 'http://localhost:8080/api/v1', 'https://shop.example.com/cart?id=1048&qty=2', 'www.contoso.org/about-us']),
  path: () => pick(['C:\\Users\\Public\\Documents\\report.docx', 'C:\\Program Files\\App\\app.exe', 'D:\\Photos\\2026\\IMG_4821.JPG', '/usr/local/bin/node', '~/Downloads/invoice-2026.pdf', '\\\\server\\share\\notes.txt']),
  symbols: () => pick(['a + b = c', '(x * y) / 2', '[OK] {done}', '<div class="box">', '50% off!', 'Q&A', 'Ctrl + Shift + S', '#hashtag @mention', '"quoted" and \'single\'', 'Error: 404 - Not Found', '5 < 7 > 3', 'A/B test #2', 'x^2 + y^2', 'key=value; path=/', 'Item 1 | Item 2 | Item 3', '~$ sudo apt update', '© 2026 Saveit', 'Price: $5 * 3 = $15', 'Yes/No?', '100% done!']),
  code: () => pick(['const total = items.length;', 'if (x > 0) { return x; }', 'print("Hello, world!")', 'for i in range(10):', 'SELECT * FROM users;', 'git commit -m "fix"', 'npm install --save-dev', 'let s = a[0] + b[1];', 'def add(a, b): return a + b', 'x == y && z != 0']),
  caps: () => pick(['WARNING: DISK SPACE LOW', 'SAVE CHANGES', 'ACCOUNT LOCKED', 'NEW MESSAGE', 'CHECKOUT', 'FREE SHIPPING ON ORDERS OVER $50', 'TOP SECRET', 'BETA']),
  mixed: () => pick(['iPhone 15 Pro Max (256 GB)', 'Windows 11 Pro 24H2', 'USB-C to HDMI adapter', 'Room 4B, Floor 12', 'Flight UA 2847 at Gate C17', 'MacBook Air M3 13"', 'Model X7-200 rev. B', 'eBay order 12-34567-89012']),
};
const KINDS = Object.keys(GEN);
const THEMES = [['light', '#111111', '#ffffff'], ['dark', '#e8e8e8', '#1e1f22'], ['grey-text', '#8a8f98', '#ffffff'], ['low-contrast', '#6b7280', '#e5e7eb'], ['blue-button', '#ffffff', '#2563eb'], ['red-alert', '#7f1d1d', '#fee2e2'], ['green', '#ffffff', '#16a34a'], ['yellow', '#1f2937', '#fde68a'], ['gradient', '#111111', 'grad:#fde68a,#fca5a5,#93c5fd'], ['pattern', '#111111', 'stripes:#ffffff,#eef2f7'], ['photo-like', '#ffffff', 'radial:#475569,#0f172a']];
function makeCase(i) {
  const kind = KINDS[i % KINDS.length], lines = Array.from({ length: rnd() < .7 ? 1 : int(2, 3) }, () => GEN[kind]());
  const font = pick(FONTS), size = pick([8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 24, 28, 32, 40]), bold = rnd() < .25, italic = rnd() < .12;
  const stretch = pick([1, 1, 1, 1, .7, .8, .9, 1.15, 1.3, 1.6]), spacing = pick([0, 0, 0, 0, -.5, 1, 2, 4]), blur = pick([0, 0, 0, 0, .4, .7, 1, 1.4]);
  const jpeg = pick([0, 0, 0, 0, 0, 80, 60, 35]), rotate = pick([0, 0, 0, 0, 0, 0, 1, -1, 2, -2]), theme = pick(THEMES), dpr = pick([1, 1, 1, 1.25, 1.5, 2]);
  return { i, kind, lines, font, size, bold, italic, stretch, spacing, blur, jpeg, rotate, theme: theme[0], fg: theme[1], bg: theme[2], dpr };
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
  // draw each picture on a canvas in Saveit's own page (exact size, nothing clipped); the display scale multiplies everything
  for (const c of cases) {
    c.png = await p.evaluate(async c => {
      const s = c.dpr, font = `${c.italic ? 'italic ' : ''}${c.bold ? 700 : 400} ${c.size * s}px '${c.font}'`; await document.fonts.load(font).catch(() => {});
      const m = document.createElement('canvas').getContext('2d'); m.font = font; m.letterSpacing = c.spacing * s + 'px';
      const lineH = Math.round(c.size * 1.5 * s), pad = Math.round((c.size * .8 + 6) * s), tw = Math.max(...c.lines.map(l => m.measureText(l).width)) * c.stretch, th = lineH * c.lines.length;
      const rad = Math.abs(c.rotate) * Math.PI / 180, W = Math.ceil(tw * Math.cos(rad) + th * Math.sin(rad) + 2 * pad), H = Math.ceil(tw * Math.sin(rad) + th * Math.cos(rad) + 2 * pad);
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'), [kind, cols] = c.bg.includes(':') ? c.bg.split(':') : ['solid', c.bg], cs = cols.split(',');
      if (kind === 'solid') { g.fillStyle = cs[0]; g.fillRect(0, 0, W, H); }
      else if (kind === 'grad') { const gr = g.createLinearGradient(0, 0, W, 0); cs.forEach((x, k) => gr.addColorStop(k / (cs.length - 1), x)); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
      else if (kind === 'radial') { const gr = g.createRadialGradient(W * .3, H * .4, 0, W * .3, H * .4, Math.max(W, H)); gr.addColorStop(0, cs[0]); gr.addColorStop(1, cs[1]); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
      else { g.fillStyle = cs[0]; g.fillRect(0, 0, W, H); g.strokeStyle = cs[1]; g.lineWidth = 6 * s; for (let x = -H; x < W + H; x += 17 * s) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + H, 0); g.stroke(); } }
      g.translate(W / 2, H / 2); g.rotate(c.rotate * Math.PI / 180); g.scale(c.stretch, 1); g.font = font; g.letterSpacing = c.spacing * s + 'px'; g.fillStyle = c.fg; g.textBaseline = 'middle';
      if (c.blur) g.filter = `blur(${c.blur * s}px)`;
      c.lines.forEach((l, k) => g.fillText(l, -tw / c.stretch / 2, -th / 2 + lineH * (k + .5)));
      let url = cv.toDataURL();
      if (c.jpeg) { const im = new Image(); im.src = cv.toDataURL('image/jpeg', c.jpeg / 100); await im.decode(); const g2 = cv.getContext('2d'); g2.setTransform(1, 0, 0, 1, 0, 0); g2.filter = 'none'; g2.drawImage(im, 0, 0); url = cv.toDataURL(); }
      return url.split(',')[1];
    }, c);
    fs.writeFileSync(path.join(out, 'pics', `${String(c.i).padStart(3, '0')}.png`), Buffer.from(c.png, 'base64'));
  }
  // read them through Saveit's real Grab Text path, four at a time
  let next = 0; const t0 = Date.now();
  await Promise.all([0, 1, 2, 3].map(async () => { while (next < cases.length) { const c = cases[next++]; const s = Date.now();
    const got = await p.evaluate(async url => { const img = new Image(); img.src = url; await img.decode(); const b = document.createElement('canvas'); b.width = img.width; b.height = img.height; const g = b.getContext('2d'); g.fillStyle = 'white'; g.fillRect(0, 0, b.width, b.height); g.drawImage(img, 0, 0); return window.bench.ocr(b.toDataURL()); }, 'data:image/png;base64,' + c.png).catch(e => 'ERROR ' + e.message);
    const want = norm(c.lines.join('\n')), have = norm(got), e = lev(have, want); delete c.png;
    results.push({ ...c, want, got: have, err: e, len: want.length, ms: Date.now() - s }); } }));
  results.sort((a, b) => a.i - b.i);
  const sum = rs => { const E = rs.reduce((n, r) => n + r.err, 0), N = rs.reduce((n, r) => n + r.len, 0); return { n: rs.length, cer: +(100 * E / N).toFixed(2), exact: rs.filter(r => !r.err).length }; };
  const rep = [], total = sum(results); rep.push(`TOTAL ${total.n} pictures  CER ${total.cer}%  exact ${total.exact}/${total.n}  (${((Date.now() - t0) / 1000).toFixed(0)} s reading)`);
  const factor = (name, f) => { const g = {}; for (const r of results) (g[f(r)] ??= []).push(r); rep.push(`\n-- by ${name}`); for (const [k, rs] of Object.entries(g).sort((a, b) => sum(b[1]).cer - sum(a[1]).cer)) { const s = sum(rs); rep.push(`  ${String(k).padEnd(24)} n=${String(s.n).padStart(3)}  CER ${String(s.cer).padStart(6)}%  exact ${s.exact}/${s.n}`); } };
  factor('kind', r => r.kind); factor('font', r => r.font); factor('size px', r => r.size <= 10 ? '8-10' : r.size <= 13 ? '11-13' : r.size <= 18 ? '14-18' : '20-40');
  factor('blur px', r => r.blur); factor('stretch', r => r.stretch); factor('letter spacing', r => r.spacing); factor('jpeg quality', r => r.jpeg || 'none'); factor('rotation', r => r.rotate);
  factor('theme', r => r.theme); factor('display scale', r => r.dpr); factor('bold', r => r.bold); factor('italic', r => r.italic);
  rep.push('\n-- worst 40'); for (const r of [...results].sort((a, b) => b.err / b.len - a.err / a.len).slice(0, 40)) rep.push(`  #${r.i} ${r.kind} ${r.font} ${r.size}px b${+r.bold} i${+r.italic} x${r.stretch} ls${r.spacing} blur${r.blur} jpg${r.jpeg} rot${r.rotate} ${r.theme} @${r.dpr}x\n     want: ${JSON.stringify(r.want)}\n     got:  ${JSON.stringify(r.got)}`);
  console.log(rep.join('\n')); fs.writeFileSync(path.join(out, 'ocr-stress.txt'), rep.join('\n')); fs.writeFileSync(path.join(out, 'ocr-stress.json'), JSON.stringify(results, null, 1));
  const pid = app.process().pid; await Promise.race([app.close().catch(() => {}), new Promise(r => setTimeout(r, 6000))]); try { require('child_process').execSync('taskkill /PID ' + pid + ' /T /F', { stdio: 'ignore' }); } catch (_) {}
})().catch(e => { console.error(e); process.exitCode = 1; });
