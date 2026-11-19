// 10.3.12 Grab Text benchmark. Renders realistic screenshots with known text (Chromium inside Saveit's Electron, at 100%, 125%, 150% and 200% zoom; OCR_DPRS=1,2 picks some), then reads
// them through Saveit's real Grab Text path in a real Saveit (the same scaling as runOcr, then window.bench.ocr = Windows OCR via
// ocr.ps1 and main.js post-processing). Scores character error rate and exact lines per case.
// node tests/ocr-bench.cjs <runtime Saveit.exe> <evidence folder> [case filter]
'use strict';
const { _electron } = require('playwright'), fs = require('fs'), path = require('path');
const font = "font-family:'Segoe UI',sans-serif";
// Every case: html body + the expected text, one line per visual line (cells in a row separated by " | " = any whitespace)
const CASES = [
  ['paragraph', `<div style="${font};font-size:15px;width:620px;line-height:1.45">Saveit keeps every capture in your library until you delete it.<br>Press Print Screen to capture a region, or Shift + Print Screen<br>for a window. Recordings open in the video editor.</div>`,
    ['Saveit keeps every capture in your library until you delete it.', 'Press Print Screen to capture a region, or Shift + Print Screen', 'for a window. Recordings open in the video editor.']],
  ['small-ui', `<div style="${font};font-size:12px;color:#222;line-height:1.6">File  Edit  View  Insert  Format  Tools  Help<br>Last saved 3 minutes ago by Jordan<br>Settings &gt; Privacy &amp; security &gt; Camera</div>`,
    ['File Edit View Insert Format Tools Help', 'Last saved 3 minutes ago by Jordan', 'Settings > Privacy & security > Camera']],
  ['dark-mode', `<div style="background:#1e1f22;color:#dcdde0;${font};font-size:14px;padding:14px;line-height:1.6;width:560px">Build succeeded in 42.7 seconds<br>3 warnings, 0 errors<br>Output written to C:\\Projects\\Saveit\\dist\\Saveit-Setup.exe</div>`,
    ['Build succeeded in 42.7 seconds', '3 warnings, 0 errors', 'Output written to C:\\Projects\\Saveit\\dist\\Saveit-Setup.exe']],
  ['code', `<pre style="font-family:Consolas,monospace;font-size:13px;line-height:1.5;margin:0">const total = items.reduce((a, b) =&gt; a + b.price, 0);
if (total &gt; 100) { console.log("Free shipping"); }
fetch("https://api.example.com/v2/orders?id=1048");
// TODO: handle errors (#231)</pre>`,
    ['const total = items.reduce((a, b) => a + b.price, 0);', 'if (total > 100) { console.log("Free shipping"); }', 'fetch("https://api.example.com/v2/orders?id=1048");', '// TODO: handle errors (#231)']],
  ['table', `<table style="${font};font-size:13px;border-collapse:collapse" cellpadding="6"><tr style="background:#f2f4f7;font-weight:600"><td>Invoice</td><td>Customer</td><td>Date</td><td>Amount</td></tr><tr><td>INV-2041</td><td>Northwind Traders</td><td>2026-11-03</td><td>$1,284.50</td></tr><tr><td>INV-2042</td><td>Contoso Ltd</td><td>2026-11-07</td><td>$96.00</td></tr><tr><td>INV-2043</td><td>Fabrikam</td><td>2026-11-12</td><td>$12,005.75</td></tr></table>`,
    ['Invoice | Customer | Date | Amount', 'INV-2041 | Northwind Traders | 2026-11-03 | $1,284.50', 'INV-2042 | Contoso Ltd | 2026-11-07 | $96.00', 'INV-2043 | Fabrikam | 2026-11-12 | $12,005.75']],
  ['buttons', `<div style="${font};font-size:13px;display:flex;gap:10px;font-weight:600"><span style="background:#2563eb;color:#fff;padding:7px 14px;border-radius:6px">Save changes</span><span style="background:#dc2626;color:#fff;padding:7px 14px;border-radius:6px">Delete</span><span style="background:#e5e7eb;color:#111;padding:7px 14px;border-radius:6px">Cancel</span><span style="background:#16a34a;color:#fff;padding:7px 14px;border-radius:6px">Publish</span></div>`,
    ['Save changes | Delete | Cancel | Publish']],
  ['low-contrast', `<div style="${font};font-size:13px;color:#9aa0a6;line-height:1.6">Optional: add a description so people know what this is for.<br>Updated Nov 18, 2026 · 2.4 MB</div>`,
    ['Optional: add a description so people know what this is for.', 'Updated Nov 18, 2026 · 2.4 MB']],
  ['email-path', `<div style="${font};font-size:14px;line-height:1.7">Contact: support@northwind-traders.com<br>Ticket ID: 7F3A-91C2-0B8E<br>Path: %APPDATA%\\Saveit\\library\\2026-11<br>Phone: +1 (555) 013-2847</div>`,
    ['Contact: support@northwind-traders.com', 'Ticket ID: 7F3A-91C2-0B8E', 'Path: %APPDATA%\\Saveit\\library\\2026-11', 'Phone: +1 (555) 013-2847']],
  ['heading-mixed', `<div style="${font}"><div style="font-size:26px;font-weight:700">Quarterly Report</div><div style="font-size:13px;color:#555;margin-top:4px">Prepared for the operations team</div><div style="font-size:14px;margin-top:10px">Revenue grew 18% while costs fell 4%.</div></div>`,
    ['Quarterly Report', 'Prepared for the operations team', 'Revenue grew 18% while costs fell 4%.']],
  ['sidebar', `<div style="${font};font-size:13px;display:flex;gap:40px"><div style="background:#f3f4f6;padding:10px;line-height:2;width:120px">Dashboard<br>Projects<br>Reports</div><div style="line-height:2">Welcome back, Taylor<br>You have 4 tasks due today<br>Next meeting: 2:30 PM</div></div>`,
    ['Dashboard', 'Projects', 'Reports', 'Welcome back, Taylor', 'You have 4 tasks due today', 'Next meeting: 2:30 PM']],
  ['tiny', `<div style="${font};font-size:10px;color:#333;line-height:1.5">By continuing you agree to the Terms of Service and Privacy Policy.<br>Version 4.12.0 (build 8817)</div>`,
    ['By continuing you agree to the Terms of Service and Privacy Policy.', 'Version 4.12.0 (build 8817)']],
  ['colored-bg', `<div style="${font};font-size:14px;background:linear-gradient(90deg,#fde68a,#fca5a5);padding:12px;width:520px;line-height:1.6">Warning: your trial ends in 3 days.<br>Upgrade now to keep your 1,250 captures.</div>`,
    ['Warning: your trial ends in 3 days.', 'Upgrade now to keep your 1,250 captures.']],
];
const norm = s => s.replace(/\s*\|\s*/g, ' ').replace(/[\t ]+/g, ' ').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();
function lev(a, b) { const m = a.length, n = b.length; if (!m) return n; if (!n) return m; let p = Array.from({ length: n + 1 }, (_, j) => j); for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[n]; }
(async () => {
  const [exe, out, filter] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
  const app = await _electron.launch({ executablePath: exe, env: { ...process.env, SAVEIT_REVIEW_DATA: path.join(out, 'profile') } });
  const p = await app.firstWindow(); await p.waitForFunction(() => document.body.dataset.catalogCount);
  // screenshots are rendered by Chromium inside Saveit's own Electron, at 100% and 200% zoom (like 100% and 200% display scaling)
  const imgs = [];
  for (const dpr of (process.env.OCR_DPRS || '1,1.25,1.5,2').split(',').map(Number)) for (const [name, body, want] of CASES) { if (filter && !name.includes(filter)) continue;
    const html = `<html><body style="margin:0;padding:18px;background:#fff;display:inline-block">${body}</body></html>`;
    const png = await app.evaluate(async ({ BrowserWindow }, [html, dpr]) => { const w = new BrowserWindow({ show: false, width: 1000, height: 500, webPreferences: { zoomFactor: dpr, offscreen: false } });
      await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html)); await new Promise(r => setTimeout(r, 150));
      const r = await w.webContents.executeJavaScript('(()=>{const b=document.body.getBoundingClientRect();return {w:Math.ceil(b.width),h:Math.ceil(b.height)}})()');
      const img = await w.capturePage({ x: 0, y: 0, width: Math.ceil(r.w * dpr), height: Math.ceil(r.h * dpr) }); w.destroy(); return img.toPNG().toString('base64'); }, [html, dpr]);
    const file = path.join(out, `${name}@${dpr}x.png`); fs.writeFileSync(file, Buffer.from(png, 'base64')); imgs.push({ name, dpr, file, want }); }
  let totE = 0, totN = 0, lines = 0, okLines = 0; const report = [];
  for (const im of imgs) {
    const url = 'data:image/png;base64,' + fs.readFileSync(im.file).toString('base64'), t0 = Date.now();
    // what runOcr does before calling Windows OCR (10.3.12: no enlargement here; ocr.ps1 enlarges 2x). OCR_OLD_PRESCALE=1 measures 10.3.11 and older, which enlarged small pictures 2x here first
    const got = await p.evaluate(async ([url, oldPrescale]) => { const img = new Image(); img.src = url; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0);
      const k = oldPrescale ? (c.width < 1000 && c.height < 500 ? Math.min(2, 2000 / Math.max(c.width, c.height)) : 1) : 1, b = document.createElement('canvas'); b.width = Math.max(1, Math.round(c.width * k)); b.height = Math.max(1, Math.round(c.height * k));
      const g = b.getContext('2d'); g.fillStyle = 'white'; g.fillRect(0, 0, b.width, b.height); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, b.width, b.height); return window.bench.ocr(b.toDataURL()); }, [url, !!process.env.OCR_OLD_PRESCALE]).catch(e => 'ERROR ' + e.message);
    const ms = Date.now() - t0, gl = got.split('\n').map(norm).filter(Boolean), wl = im.want.map(norm), e = lev(gl.join('\n'), wl.join('\n'));
    totE += e; totN += wl.join('\n').length; lines += wl.length; const good = wl.filter((l, i) => gl[i] === l).length; okLines += good;
    const bad = wl.map((l, i) => gl[i] === l ? null : `    want: ${l}\n    got:  ${gl[i] ?? '(missing)'}`).filter(Boolean);
    if (gl.length > wl.length) bad.push('    extra: ' + gl.slice(wl.length).join(' / '));
    const line = `${(e === 0 ? 'OK  ' : 'MISS')} ${im.name}@${im.dpr}x  CER ${(100 * e / wl.join('\n').length).toFixed(1)}%  lines ${good}/${wl.length}  ${ms} ms` + (bad.length ? '\n' + bad.join('\n') : '');
    console.log(line); report.push(line);
  }
  const sum = `TOTAL  CER ${(100 * totE / totN).toFixed(2)}%  exact lines ${okLines}/${lines}  (${imgs.length} images)`; console.log(sum); report.push(sum);
  fs.writeFileSync(path.join(out, 'ocr-bench.txt'), report.join('\n'));
  const pid = app.process().pid; await Promise.race([app.close().catch(() => {}), new Promise(r => setTimeout(r, 6000))]); try { require('child_process').execSync('taskkill /PID ' + pid + ' /T /F', { stdio: 'ignore' }); } catch (_) {}
})().catch(e => { console.error(e); process.exitCode = 1; });
