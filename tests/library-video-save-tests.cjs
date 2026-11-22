// 10.5.5: Library > Save… / Move out… must write an edited video as it looks now, not the recording as it was made.
// Build and serve tests/build-harness.js first.  node tests/library-video-save-tests.cjs <URL> <evidence directory>
const { chromium } = require('playwright'), fs = require('fs'), path = require('path'), assert = require('assert/strict');
(async () => {
  const out = path.resolve(process.argv[3]); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ headless: true, executablePath: process.env.SAVEIT_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
  let fails = 0; const errors = [];
  const test = async (name, fn) => { try { const d = await fn(); console.log('PASS', name, JSON.stringify(d)); } catch (e) { fails++; console.log('FAIL', name, String(e.message).split('\n')[0]); } };
  try {
    const p = await b.newPage({ viewport: { width: 1366, height: 768 } }); p.on('pageerror', e => errors.push(e.message)); await p.goto(process.argv[2]); await p.waitForFunction(() => window.QA);
    const ev = (f, a) => p.evaluate(f, a);
    // a 3 s recording that has both files, like a real Saveit recording
    await ev(async () => { const v = await QA.video(3); window.fx = v.blob; window.mk = name => { const it = __T.addVideo(fx, name); it.mp4 = fx; if (/webm/i.test(fx.type)) it.webm = fx; return it; };
      window.openIt = async it => { document.querySelectorAll('.modal').forEach(m => m.remove()); __T.openItem(it); await QA.until(() => __T.vid?._ctl?._dbg?.ready); await QA.sleep(200); };
      window.info = async blob => ({ type: blob.type, size: blob.size, dur: Math.round(await QA.duration(blob) * 10) / 10 }); });
    const kinds = await ev(() => ({ type: fx.type })); const formats = /webm/i.test(kinds.type) ? ['webm', 'mp4'] : ['mp4'];
    await test('a recording that was never opened is saved as recorded, without re-making it', async () => { const r = await ev(async () => { const it = mk('Never opened'); const out = await __T.blobFor(it, 'mp4'); return { same: out === it.mp4, edit: !!it.edit }; }); assert.equal(r.same, true); return r; });
    await test('a recording that was opened but not changed is still saved as recorded', async () => { const r = await ev(async fmts => { const it = mk('Opened only'); await openIt(it); const res = {}; for (const f of fmts) { const o = await __T.blobFor(it, f); res[f] = (await info(o)).dur; } return { edit: !!it.edit, res }; }, formats);
      for (const f of formats) assert.ok(r.res[f] > 2.5 && r.res[f] < 3.6, f + ' ' + r.res[f]); return r; });
    for (const fmt of formats) await test('a trimmed video is saved trimmed from the Library as ' + fmt.toUpperCase() + ' (it was saved untrimmed)', async () => {
      const r = await ev(async fmt => { const it = mk('Trimmed ' + fmt); await openIt(it); const c = __T.vid._ctl, e = c.getProject(); e.clips[0].b = 1.2; c._dbg.eng.sync(); await QA.sleep(150); const edited = c.isEdited();
        const other = mk('Something else'); await openIt(other); await QA.sleep(150);            // the Library saves items that are not the open one
        const o = await __T.blobFor(it, fmt); return { edited, hasEdit: !!it.edit, clipEnd: it.edit && it.edit.clips[0].b, ...(await info(o)) }; }, fmt);
      assert.equal(r.edited, true); assert.ok(r.dur > 0.9 && r.dur < 1.6, 'duration ' + r.dur + ' (the recording is 3 s)'); assert.ok(new RegExp(fmt, 'i').test(r.type), r.type); return r; });
    // a WebM recording (the kind Saveit records), from the fixture file: saved as WebM it must be the edit, and still a WebM
    await test('a trimmed WebM recording is saved trimmed as WebM', async () => { const bytes = [...fs.readFileSync(path.join(__dirname, 'fixtures', 'continuous-audio-source.webm'))];
      const r = await ev(async bytes => { const wb = new Blob([new Uint8Array(bytes)], { type: 'video/webm' }), full = Math.round(await QA.duration(wb) * 10) / 10; const it = __T.addVideo(wb, 'Webm take'); it.webm = wb; await openIt(it); const c = __T.vid._ctl, e = c.getProject(); e.clips[0].b = Math.min(1, full / 2); c._dbg.eng.sync(); await QA.sleep(150);
        const other = mk('Yet another'); await openIt(other); const o = await __T.blobFor(it, 'webm'); return { full, want: Math.min(1, full / 2), same: o === it.webm, ...(await info(o)) }; }, bytes);
      assert.equal(r.same, false); assert.ok(/webm/i.test(r.type), r.type); assert.ok(Math.abs(r.dur - r.want) < 0.5 && r.dur < r.full - 0.3, JSON.stringify(r)); return r; });
    await test('a captioned video (same length) is also re-made, not copied', async () => { const r = await ev(async () => { const it = mk('Captioned'); await openIt(it); const c = __T.vid._ctl, e = c.getProject(); e.caps.push({ id: 'cap1', t0: 0, t1: 3, text: 'Hello', pos: 'b', fs: 6, c: '#fff' }); c._dbg.eng.sync(); await QA.sleep(150);
        const other = mk('Another'); await openIt(other); const o = await __T.blobFor(it, 'mp4'); return { same: o === it.mp4, ...(await info(o)) }; }); assert.equal(r.same, false); assert.ok(r.dur > 2.5 && r.dur < 3.6); return r; });
    await test('no page errors', async () => { assert.deepEqual(errors, []); return {}; });
  } finally { await b.close(); }
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
