// 10.3.10 native scrolling capture: real Electron, real screen capture, real control bar.
// node tests/native-live-scroll.cjs <disposable-runtime\Saveit.exe> <evidence-dir>
// An owned fixture window shows a long page (text, pictures, a sticky header). Saveit's live scrolling session
// watches it while the test scrolls the page (down, up, down again, small/large/smooth steps), then the test
// clicks Capture on the bar. A marker column at the far right edge (which the matcher deliberately ignores)
// encodes each page row's number, so the result can be checked row by row: no repeats, no gaps, header once.
// It moves nothing but its own windows; it never touches the installed Saveit or its library.
'use strict';
const { _electron } = require('playwright'), fs = require('fs'), path = require('path'), assert = require('assert/strict');
const HEADER = 56, W = 760, VH = 620;
function pageHtml(H) {
  return `<!doctype html><html><head><style>html,body{margin:0;background:#fff;font:15px/1.5 Georgia,serif;color:#222}::-webkit-scrollbar{display:none}html{scrollbar-width:none}
  header{position:sticky;top:0;height:${HEADER}px;background:#1d3557;color:#fff;font:600 18px Segoe UI;display:flex;align-items:center;padding:0 24px;z-index:2}
  main{padding:10px 40px 0 28px;width:${W - 80}px}p{margin:0 0 16px}.pic{height:140px;margin:0 0 16px;background:linear-gradient(120deg,#e76f51,#2a9d8f,#e9c46a)}
  canvas#m{position:absolute;right:0;top:0;width:26px;image-rendering:pixelated;z-index:1}</style></head><body><header>Fixture page · sticky header</header><main id="main"></main><canvas id="m"></canvas>
  <script>const words='lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur'.split(' ');
  let s=7;const r=()=>(s=(s*1103515245+12345)%2147483648)/2147483648;const m=document.getElementById('main');let n=0;
  while(document.body.scrollHeight<${H}-200){n++;if(n%5===0){const d=document.createElement('div');d.className='pic';d.style.filter='hue-rotate('+(n*37%360)+'deg)';m.append(d)}else{const p=document.createElement('p');let t='§'+n+' ';const k=25+Math.floor(r()*60);for(let i=0;i<k;i++)t+=words[Math.floor(r()*words.length)]+' ';p.textContent=t;m.append(p)}}
  const H=document.documentElement.scrollHeight,c=document.getElementById('m');c.height=H;c.width=26;c.style.height=H+'px';const g=c.getContext('2d');for(let y=0;y<H;y++){g.fillStyle='#f00';g.fillRect(0,y,2,1);for(let i=0;i<12;i++){g.fillStyle=(y>>(11-i))&1?'#fff':'#000';g.fillRect(2+2*i,y,2,1)}}
  window.pageH=H;</script></body></html>`;
}
(async () => {
  const exe = path.resolve(process.argv[2]), out = path.resolve(process.argv[3]), source = path.resolve(__dirname, '../app'), runtime = path.dirname(exe), dest = path.join(runtime, 'resources/app');
  assert.ok(!exe.toLowerCase().includes('appdata\\local\\programs\\saveit\\'), 'Use a disposable runtime');
  fs.mkdirSync(path.join(out, 'tap'), { recursive: true }); fs.rmSync(dest, { recursive: true, force: true }); fs.cpSync(source, dest, { recursive: true });
  fs.appendFileSync(path.join(dest, 'main.js'), '\r\nglobalThis.__scrollReview={liveScroll104};\r\n');
  const fixtureRoot = path.join(out, 'fixture-runtime'); fs.rmSync(fixtureRoot, { recursive: true, force: true });
  fs.cpSync(runtime, fixtureRoot, { recursive: true, filter: p => p !== path.join(runtime, 'resources') }); fs.mkdirSync(path.join(fixtureRoot, 'resources/app'), { recursive: true });
  fs.writeFileSync(path.join(fixtureRoot, 'resources/app/package.json'), JSON.stringify({ name: 'native-scroll-fixture', version: '1.0.0', main: 'main.js' }));
  fs.writeFileSync(path.join(fixtureRoot, 'resources/app/main.js'), `const {app,BrowserWindow,screen}=require('electron');app.setPath('userData',process.env.SAVEIT_REVIEW_DATA);app.whenReady().then(()=>{const d=screen.getPrimaryDisplay().workArea;const w=new BrowserWindow({x:d.x+120,y:d.y+80,width:${W},height:${VH},frame:false,resizable:false,alwaysOnTop:true,title:'Native scroll fixture',backgroundColor:'#ffffff'});w.setAlwaysOnTop(true,'floating');w.loadFile(require('path').join(__dirname,'page.html'));global.fixtureWin=w})`);
  fs.writeFileSync(path.join(fixtureRoot, 'resources/app/page.html'), pageHtml(3000));
  const results = [], log = m => { console.log(m); results.push(m); };
  let fixture, app;
  const check = (name, png, size, k, expectTop, expectBottom) => {
    // decode the marker column at the right edge of the result (BGRA bitmap from nativeImage)
    fs.writeFileSync(path.join(out, name.replace(/[^a-z0-9]+/gi, '-') + '.png'), Buffer.from(png, 'base64'));
    return { size };
  };
  try {
    fixture = await _electron.launch({ executablePath: path.join(fixtureRoot, path.basename(exe)), env: { ...process.env, SAVEIT_REVIEW_DATA: path.join(out, 'fixture-profile') } });
    console.log('fixture started');
    app = await _electron.launch({ executablePath: exe, env: { ...process.env, SAVEIT_TAP_DIR: path.join(out, 'tap'), SAVEIT_REVIEW_DATA: path.join(out, 'capture-profile') }, timeout: 30000 });
    await app.firstWindow(); console.log('saveit started');
    // The display's colour profile changes the marker colours on screen, so learn them first: show the page at
    // known scroll positions and read the marker column exactly as Saveit reads the screen (GDI helper).
    // the fixture is this test's own window; keep it above whatever else is open on the desktop while the test runs
    await fixture.evaluate(() => { global.fixtureWin.setAlwaysOnTop(true, 'screen-saver'); global.fixtureWin.moveTop(); });
    // Marker: per page row, a red guard then the row number (mod 4096) as 12 black/white cells, 2 CSS px each.
    // Black and white survive the display's colour management, so the result can be decoded row by row.
    const MOD = 4096;
    const decodeRow = (bmp, w, y, k) => { const red = x => { const i = (y * w + x) * 4; return bmp[i + 2] > 150 && bmp[i + 1] < 110 && bmp[i] < 110; };
      let x0 = -1; for (let x = Math.max(0, w - Math.ceil(40 * k)); x < w; x++) if (red(x)) { x0 = x; break; } if (x0 < 0) return -1; // the red guard starts the code
      const px = c => { const x = Math.min(w - 1, Math.floor(x0 + (c + 0.5) * k)), i = (y * w + x) * 4; return [bmp[i + 2], bmp[i + 1], bmp[i]]; };
      let v = 0; for (let n = 0; n < 12; n++) { const [r, g2, b] = px(2 + 2 * n); const l = (r + g2 + b) / 3; if (l > 90 && l < 165) return -1; v = v * 2 + (l >= 128 ? 1 : 0); } return v; };
    await app.evaluate(({ BrowserWindow }) => { for (const w of BrowserWindow.getAllWindows()) w.hide(); });
    const scenarios = [
      ['A steady scrolling', 9000, [...Array(14)].map(() => 300)],
      ['B down then back up', 9000, [320, 320, 320, 320, 320, -400, -400, -400]],
      ['C down, up, down past the old end', 9000, [300, 300, 300, 300, -500, -500, 300, 300, 300, 300, 300, 300, 300]],
      ['D small, medium and large steps', 9000, [20, 60, 450, 12, 380, 140, 8, 520, 90, 300, 500]],
      ['E smooth scrolling', 9000, ['s', 's', 's', 's', 's', 's', 's', 's']],
      ['F long document', 24000, [...Array(60)].map((_, i) => i % 7 === 6 ? -250 : 420)],
    ];
    const run = async (name, H, steps, cancelFirst) => {
      fs.writeFileSync(path.join(fixtureRoot, 'resources/app/page.html'), pageHtml(H));
      const f = await fixture.firstWindow(); await fixture.evaluate(() => global.fixtureWin.moveTop()); await f.reload(); await f.waitForFunction(() => window.pageH > 0); await f.evaluate(() => scrollTo(0, 0)); await f.waitForTimeout(400);
      const fx = await fixture.evaluate(({ screen }) => { const b = global.fixtureWin.getContentBounds(), d = screen.getDisplayMatching(b); return { b, d: { id: d.id, x: d.bounds.x, y: d.bounds.y, sf: d.scaleFactor } }; });
      const start = () => app.evaluate(({ screen }, fx) => { const d = screen.getAllDisplays().find(x => x.id === fx.d.id); // like a person selecting the page: inside the window's rounded corners and border
        const rect = { x: fx.b.x - d.bounds.x + 8, y: fx.b.y - d.bounds.y, w: fx.b.width - 9, h: fx.b.height - 10 };
        globalThis.__done = globalThis.__scrollReview.liveScroll104(d, rect, false).then(img => img ? { png: img.toPNG().toString('base64'), size: img.getSize(), bmp: img.toBitmap().toString('base64') } : null); return d.scaleFactor; }, fx);
      const bar = cmd => app.evaluate(async ({ BrowserWindow }, cmd) => { const w = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Saveit Scrolling Capture' && !w.isDestroyed()); if (!w) return false; await w.webContents.executeJavaScript(`window.manual.send(${JSON.stringify(cmd)})`); return true; }, cmd);
      if (cancelFirst) { await start(); await f.waitForTimeout(600); await f.evaluate(() => scrollBy(0, 500)); await f.waitForTimeout(500); assert.ok(await bar('cancel'), 'bar shown'); const r0 = await app.evaluate(() => globalThis.__done); assert.equal(r0, null, 'cancel returns nothing'); await f.evaluate(() => scrollTo(0, 0)); await f.waitForTimeout(400); }
      const k = await start();
      // like a person: start scrolling once the bar shows the capture is ready
      for (let i = 0; i < 100; i++) { const st0 = await app.evaluate(async ({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Saveit Scrolling Capture' && !w.isDestroyed()); return w ? w.webContents.executeJavaScript("document.getElementById('size').textContent") : ''; }); if (st0) break; await f.waitForTimeout(50); }
      await f.waitForTimeout(200);
      let maxY = 0;
      for (const s of steps) { if (s === 's') await f.evaluate(() => scrollBy({ top: 650, behavior: 'smooth' })); else await f.evaluate(d => scrollBy(0, d), s); await f.waitForTimeout(s === 's' ? 900 : 420); maxY = Math.max(maxY, await f.evaluate(() => scrollY)); }
      const barState = await app.evaluate(async ({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Saveit Scrolling Capture'); return w ? w.webContents.executeJavaScript("document.getElementById('state').textContent+' | '+document.getElementById('size').textContent") : ''; });
      assert.ok(await bar('finish'), 'Capture button');
      const r = await app.evaluate(() => globalThis.__done); assert.ok(r, 'a picture came back');
      fs.writeFileSync(path.join(out, name.replace(/[^a-z0-9]+/gi, '-') + '.png'), Buffer.from(r.png, 'base64'));
      const bmp = Buffer.from(r.bmp, 'base64'), w = r.size.width, h = r.size.height, x = w - Math.max(2, Math.round(k * 4));
      // rows: header colour, then markers y (each repeated k times at scale k) strictly continuous
      let hdr = 0; const vals = [];
      const raw = []; for (let y = 0; y < h; y++) { const i = (y * w + x) * 4, v = decodeRow(bmp, w, y, k); if (v >= 0) raw.push(v); else if (!raw.length) hdr++; else raw.push(-1); }
      // marker values repeat every MOD rows; unwrap them into absolute page rows by continuity
      for (let i = 0, a = 0; i < raw.length; i++) { if (raw[i] < 0) { vals.push(-1); continue; } if (!vals.length || vals[vals.length - 1] < 0 && i === 0) a = raw[i]; else { let prev = -1; for (let q = vals.length - 1; q >= 0; q--) if (vals[q] >= 0) { prev = vals[q]; break; } if (prev < 0) a = raw[i]; else { let d = ((raw[i] - prev) % MOD + MOD) % MOD; if (d > MOD / 2) d -= MOD; a = prev + d; } } vals.push(a); }
      const bad = []; for (let i = 1; i < vals.length; i++) { const d = vals[i] - vals[i - 1]; if (vals[i] < 0 || vals[i - 1] < 0) { bad.push([i, 'not a page row']); continue; } if (d < 0 || d > 1) bad.push([i, vals[i - 1] + '->' + vals[i]]); }
      const counts = {}; for (const v of vals) counts[v] = (counts[v] || 0) + 1; const rep = Object.values(counts).filter(c => c > Math.ceil(k) + 1).length;
      const last = vals[vals.length - 1], expectedLast = maxY + VH - 11; // the selection stops 10 px above the window bottom
      log(`${name}: ${w}x${h}, header ${hdr} rows, page rows ${vals[0]}..${last} (deepest visible ${expectedLast}), discontinuities ${bad.length}, repeated rows ${rep}, bar "${barState}"`);
      assert.ok(Math.abs(hdr - HEADER * k) <= 2, `${name}: header ${hdr} rows`);
      assert.equal(bad.length, 0, `${name}: ${JSON.stringify(bad.slice(0, 5))}`);
      assert.equal(rep, 0, `${name}: repeated rows`);
      assert.ok(vals[0] <= HEADER + 1, `${name}: starts at the top (${vals[0]})`);
      assert.ok(Math.abs(last - expectedLast) <= 2, `${name}: ends at ${last}, expected ${expectedLast}`);
    };
    let failed = 0;
    for (const [name, H, steps] of scenarios.filter(s => !process.env.SCROLL_ONLY || s[0].startsWith(process.env.SCROLL_ONLY))) { try { await run(name, H, steps); console.log('PASS', name); } catch (e) { failed++; console.log('FAIL', name, e.message); } }
    if (!process.env.SCROLL_ONLY) try { await run('G cancel then restart', 9000, [300, 300, 300], true); console.log('PASS G cancel and restart'); } catch (e) { failed++; console.log('FAIL G cancel and restart', e.message); }
    process.exitCode = failed ? 1 : 0;
  } finally {
    fs.writeFileSync(path.join(out, 'live-scroll-results.txt'), results.join('\n'));
    if (app) { try { await app.evaluate(({ app }) => { app.isQuitting = true; }); } catch (_) {} await Promise.race([app.close().catch(() => {}), new Promise(r => setTimeout(r, 5000))]); }
    if (fixture) await Promise.race([fixture.close().catch(() => {}), new Promise(r => setTimeout(r, 5000))]);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
