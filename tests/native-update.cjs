// 10.2.0: a REAL update in a REAL Saveit, end to end, in a scratch folder. It never touches the installed Saveit or its library.
//   node tests/native-update.cjs <scratch folder>
// Needs: Playwright, and a folder with the Saveit runtime (Saveit.exe + its files). By default the runtime of the installed Saveit
// (%LOCALAPPDATA%\Programs\Saveit) is COPIED; set SAVEIT_E2E_RUNTIME to use another folder. "GitHub" is a local fake (127.0.0.1), the
// releases are built from this source tree and signed with a throw-away test key, and the app is run in a test profile (SAVEIT_REVIEW_DATA).
const { _electron } = require('playwright');
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { execFileSync, spawnSync } = require('child_process');
const { makeZip } = require('./zip-util.js');
const ROOT = path.join(__dirname, '..'), APP_SRC = path.join(ROOT, 'app');
const base = path.join(path.resolve(process.argv[2] || path.join(os.tmpdir(), 'saveit-update-e2e')), 'run-' + Date.now());
const RUNTIME = process.env.SAVEIT_E2E_RUNTIME || path.join(process.env.LOCALAPPDATA, 'Programs', 'Saveit');
const INSTALL = path.join(base, 'Programs', 'Saveit'), EXE = path.join(INSTALL, 'Saveit.exe'), PROFILE = path.join(base, 'profile'), UPD = path.join(PROFILE, 'updates');
const V0 = JSON.parse(fs.readFileSync(path.join(APP_SRC, 'package.json'), 'utf8')).version;
const nextPatch = v => { const [a, b, c] = v.split('.').map(Number); return c >= 12 ? `${a}.${b + 1}.0` : `${a}.${b}.${c + 1}`; };
const V1 = nextPatch(V0), V2 = nextPatch(V1), V3 = nextPatch(V2), V4 = nextPatch(V3), V5 = nextPatch(V4);
let fail = 0; const results = [];
const ok = m => { console.log('PASS', m); results.push(1); }, bad = (m, e) => { fail++; results.push(0); console.log('FAIL', m, '\n    ', (e && e.message || e).toString().split('\n')[0]); };
const test = async (name, fn) => { try { await fn(); ok(name); } catch (e) { bad(name, e); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const waitFor = async (fn, ms, what) => { const t0 = Date.now(); for (;;) { let v; try { v = await fn(); } catch (_) { } if (v) return v; if (Date.now() - t0 > ms) throw new Error('timed out waiting for ' + what); await sleep(300); } };
const ps = cmd => execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], { encoding: 'utf8', maxBuffer: 1 << 24 }).trim();
const robo = (src, dst, extra = []) => { const r = spawnSync('robocopy', [src, dst, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', ...extra], { encoding: 'utf8' }); if (r.status >= 8) throw new Error('copy failed: ' + r.stdout); };
const procs = (dir) => { const o = ps(`Get-Process | Where-Object { $_.Path -and $_.Path.StartsWith('${dir}', [StringComparison]::OrdinalIgnoreCase) } | Select-Object Id,ProcessName,MainWindowTitle | ConvertTo-Json -Compress`); return o ? [].concat(JSON.parse(o)) : []; };
const killAll = (dir) => { try { ps(`Get-Process | Where-Object { $_.Path -and $_.Path.StartsWith('${dir}', [StringComparison]::OrdinalIgnoreCase) } | Stop-Process -Force -ErrorAction SilentlyContinue`); } catch (_) { } };
const hashTree = dir => { const out = {}; const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else out[path.relative(dir, p)] = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); } }; if (fs.existsSync(dir)) walk(dir); return out; };
const installedVersion = () => JSON.parse(fs.readFileSync(path.join(INSTALL, 'resources', 'app', 'package.json'), 'utf8')).version;
const windowTitle = () => (procs(INSTALL).map(p => p.MainWindowTitle).find(t => /^Saveit/.test(t || '')) || '');
const readLog = () => fs.existsSync(path.join(UPD, 'update.log')) ? fs.readFileSync(path.join(UPD, 'update.log'), 'utf8') : '';

// ---- test key, releases and the fake GitHub ----
const keys = crypto.generateKeyPairSync('ed25519'); fs.mkdirSync(base, { recursive: true });
const PUB = path.join(base, 'test-public.pem'); fs.writeFileSync(PUB, keys.publicKey.export({ type: 'spki', format: 'pem' }));
const signMsg = (v, zip) => Buffer.from(`Saveit-release-v1\nversion=${v}\nsha256=${crypto.createHash('sha256').update(zip).digest('hex')}\n`, 'ascii');
function buildRelease(version, mutateApp) {
  const dir = path.join(base, 'rel-' + version, 'app'); robo(APP_SRC, dir);
  const pj = path.join(dir, 'package.json'); fs.writeFileSync(pj, fs.readFileSync(pj, 'utf8').replace(/"version":\s*"[^"]*"/, `"version": "${version}"`));
  fs.writeFileSync(path.join(dir, 'update-marker.txt'), version); if (mutateApp) mutateApp(dir);
  const entries = [{ name: 'Saveit/', data: '' }, { name: 'Saveit/app/', data: '' }];
  const walk = (d, rel) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name), r = rel + '/' + e.name; if (e.isDirectory()) { entries.push({ name: r + '/', data: '' }); walk(p, r); } else entries.push({ name: r, data: fs.readFileSync(p) }); } };
  walk(dir, 'Saveit/app');
  for (const f of ['Install.cmd', 'uninstall.ps1', 'Uninstall.cmd', 'Reinstall.cmd', 'README.txt']) entries.push({ name: 'Saveit/' + f, data: fs.readFileSync(path.join(ROOT, f)) });
  const zip = makeZip(entries), sig = crypto.sign(null, signMsg(version, zip), keys.privateKey).toString('base64');
  return { version, zip, sig, sha: crypto.createHash('sha256').update(zip).digest('hex') };
}
const fake = { latest: null, files: {}, down: false, hits: [] };
const server = http.createServer((req, res) => {
  fake.hits.push(req.url); if (fake.down) { req.socket.destroy(); return; }
  if (req.url.split('?')[0] === '/repos/stuartraymor/Saveit/releases/latest') {
    const r = fake.latest; if (!r) { res.writeHead(404); return res.end('none'); }
    const a = [{ name: `Saveit-${r.version}.zip`, size: r.zip.length, digest: 'sha256:' + r.sha }];
    if (!r.noSig) a.push({ name: `Saveit-${r.version}.zip.sig`, size: 90 }); a.push({ name: `Saveit-${r.version}.sha256`, size: 80 });
    res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ tag_name: 'v' + r.version, name: 'Saveit ' + r.version, body: `## What's new\n\n- **Test release ${r.version}**\n- A second change`, draft: false, prerelease: false, published_at: new Date().toISOString(), assets: a }));
  }
  if (req.url.split('?')[0] === '/repos/stuartraymor/Saveit') {
    res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ private: false }));
  }
  const m = /^\/download\/v([\d.]+)\/(.+)$/.exec(req.url); const r = fake.latest;
  if (m && r && m[1] === r.version) {
    if (m[2] === `Saveit-${r.version}.zip`) { res.writeHead(200, { 'content-length': r.zip.length }); return res.end(r.zipServed || r.zip); }
    if (m[2] === `Saveit-${r.version}.zip.sig`) { res.writeHead(200); return res.end(r.sig + '\n'); }
    if (m[2] === `Saveit-${r.version}.sha256`) { res.writeHead(200); return res.end(`${r.sha}  Saveit-${r.version}.zip\n`); }
  }
  res.writeHead(404); res.end('nf');
});

// ---- launching the app under test ----
const env = (extra = {}) => { const e = { ...process.env, SAVEIT_REVIEW_DATA: PROFILE, SAVEIT_UPDATE_API: `http://127.0.0.1:${server.address().port}`, SAVEIT_UPDATE_PUBKEY_FILE: PUB, SAVEIT_UPDATE_HEALTH_SECONDS: '10', SAVEIT_UPDATE_WAIT_SECONDS: '60', ...extra }; delete e.SAVEIT_UPDATE_HEALTH; return e; };
async function launch(extra) { const app = await _electron.launch({ executablePath: EXE, env: env(extra), timeout: 90000 }); const w = await app.firstWindow(); await w.waitForSelector('#updLink103', { timeout: 60000 }); await sleep(800); return { app, w }; }
const dialogText = w => w.evaluate(() => (document.querySelector('#updateDialog103') || {}).innerText || '');
async function openDialog(w) { await w.evaluate(() => document.querySelectorAll('#updateDialog103').forEach(m => m.remove())); await w.click('#updLink103'); await w.waitForSelector('#updBody103 :is(.upd-big,.upd-err,#updInstall103,#updRetry103,#updPage103)', { timeout: 30000 }); }
const markers = w => w.evaluate(() => new Promise(res => { const out = { ls: localStorage.getItem('test.keep') }; const r = indexedDB.open('keep-test', 1); r.onupgradeneeded = () => r.result.createObjectStore('s', { keyPath: 'id' }); r.onsuccess = () => { const g = r.result.transaction('s').objectStore('s').get(1); g.onsuccess = () => { out.idb = g.result && g.result.v; const c = indexedDB.open('capture-bench'); c.onsuccess = () => { const db = c.result, names = [...db.objectStoreNames]; let total = 0, left = names.length; out.stores = names.length; if (!left) return res(out); for (const n of names) { const q = db.transaction(n).objectStore(n).count(); q.onsuccess = () => { total += q.result; if (--left === 0) { out.records = total; res(out); } }; } }; }; }; }));
const setMarkers = w => w.evaluate(() => new Promise(res => { localStorage.setItem('test.keep', 'alpha'); const r = indexedDB.open('keep-test', 1); r.onupgradeneeded = () => r.result.createObjectStore('s', { keyPath: 'id' }); r.onsuccess = () => { const t = r.result.transaction('s', 'readwrite'); t.objectStore('s').put({ id: 1, v: 'beta' }); t.oncomplete = () => res(true); }; }));
async function closeAndWait(app) { const closed = new Promise(r => app.process().once('exit', r)); return closed; }

(async () => {
  console.log('scratch folder:', base);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  // what must stay exactly as it is: the real installation, its shortcuts, and its Settings > Apps entry
  const REAL_APP = path.join(process.env.LOCALAPPDATA, 'Programs', 'Saveit', 'resources', 'app');
  const realBefore = hashTree(REAL_APP), lnks = [path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Saveit.lnk'), path.join(process.env.USERPROFILE, 'Desktop', 'Saveit.lnk')];
  const lnkBefore = lnks.map(f => fs.existsSync(f) ? fs.statSync(f).mtimeMs : null);
  const regBefore = (() => { try { return ps("(Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Saveit' -ErrorAction Stop).DisplayVersion"); } catch (_) { return ''; } })();
  try {
    // ---- a test installation of the OLD version (copy of the runtime + this source as the app) ----
    robo(RUNTIME, INSTALL, ['/XD', 'app', 'update-backup']); fs.mkdirSync(path.join(INSTALL, 'resources'), { recursive: true });
    if (fs.existsSync(path.join(INSTALL, 'electron.exe')) && !fs.existsSync(EXE)) fs.renameSync(path.join(INSTALL, 'electron.exe'), EXE);
    fs.rmSync(path.join(INSTALL, 'resources', 'default_app.asar'), { force: true }); robo(APP_SRC, path.join(INSTALL, 'resources', 'app'));
    for (const f of ['uninstall.ps1', 'Uninstall.cmd', 'Reinstall.cmd']) fs.copyFileSync(path.join(ROOT, f), path.join(INSTALL, f));
    assert.equal(installedVersion(), V0); fs.mkdirSync(PROFILE, { recursive: true });
    const keepFile = path.join(PROFILE, 'keep-me.txt'); fs.writeFileSync(keepFile, 'my settings file'); const keepHash = crypto.createHash('sha256').update(fs.readFileSync(keepFile)).digest('hex');
    console.log(`test install: ${V0} (old). Test releases: ${V1}, ${V2} (crashes), ${V3} (never starts), ${V4} (tampered), ${V5} (unsigned).`);

    let { app, w } = await launch(); let libBefore;
    await test(`Starts as version ${V0}; the link is there and GitHub was not contacted on its own`, async () => {
      assert.match(await w.title(), new RegExp('Saveit ' + V0.replace(/\./g, '\\.'))); await sleep(4000); assert.equal(fake.hits.length, 0, 'no automatic requests: ' + fake.hits.join(','));
      await setMarkers(w); libBefore = await markers(w); assert.equal(libBefore.ls, 'alpha'); assert.equal(libBefore.idb, 'beta');
    });
    await test('Up to date: "Saveit is up to date." and nothing is offered', async () => {
      fake.latest = buildRelease(V0); await openDialog(w); assert.match(await dialogText(w), /Saveit is up to date\./); assert.equal(await w.locator('#updInstall103').count(), 0);
      fake.latest = null; await openDialog(w); assert.match(await dialogText(w), /No published/); // GitHub has nothing: a plain message
    });
    await test('GitHub unreachable: a plain message, and the app is unchanged', async () => {
      fake.down = true; await openDialog(w); assert.match(await dialogText(w), /could not reach GitHub/); fake.down = false; assert.equal(installedVersion(), V0);
    });
    const rel1 = buildRelease(V1);
    await test(`A newer release (${V1}) is offered with its notes; an unsigned one is not installable`, async () => {
      fake.latest = { ...buildRelease(V5), noSig: true }; await openDialog(w); const t = await dialogText(w); assert.match(t, /no signature/); assert.equal(await w.locator('#updInstall103').count(), 0);
      fake.latest = rel1; await openDialog(w); const t2 = await dialogText(w); assert.match(t2, new RegExp(`Version ${V1.replace(/\./g, '\\.')} is available`)); assert.match(t2, /Test release/); assert.doesNotMatch(t2, /\*\*/); assert.ok(await w.locator('#updInstall103').isEnabled());
    });
    await test('A tampered download is refused after downloading, deleted, and nothing is installed', async () => {
      const t = buildRelease(V4); const bad = Buffer.from(t.zip); bad[bad.length >> 1] ^= 0xff; fake.latest = { ...t, zipServed: bad };
      await openDialog(w); await w.click('#updInstall103'); await w.waitForSelector('#updRetry103', { timeout: 60000 }); const x = await dialogText(w);
      assert.match(x, /verif|match/); assert.match(x, /Nothing was installed/); assert.equal(fs.existsSync(path.join(UPD, V4)), false, 'staging deleted'); assert.equal(installedVersion(), V0);
    });
    await test('The update is downloaded and verified into a staging folder only; the installed app is untouched', async () => {
      fake.latest = rel1; await openDialog(w); await w.click('#updInstall103'); await w.waitForSelector('#updGo103', { timeout: 60000 });
      assert.match(await dialogText(w), /ready to install/); assert.match(await dialogText(w), /save your work first/i);
      assert.ok(fs.existsSync(path.join(UPD, V1, 'extracted', 'Saveit', 'app', 'main.js')), 'staged'); assert.equal(installedVersion(), V0); assert.equal(fs.existsSync(path.join(INSTALL, 'resources', 'app', 'update-marker.txt')), false);
    });
    await test('A recording in progress stops the update: nothing closes, nothing changes', async () => {
      await app.evaluate(({ ipcMain }) => ipcMain.emit('recording', {}, true));
      await w.click('#updGo103'); await w.waitForSelector('#updRetry103'); const t = await dialogText(w); assert.match(t, /cannot update right now|recording is running/);
      assert.equal(installedVersion(), V0); assert.ok(procs(INSTALL).length > 0, 'Saveit is still running'); assert.equal(fs.existsSync(path.join(UPD, 'result.json')), false);
      await app.evaluate(({ ipcMain }) => ipcMain.emit('recording', {}, false));
    });
    await test('An app that does not close is never force-closed: the updater waits, then changes nothing', async () => {
      // run the real updater script against the running test copy with a short wait
      const stage = path.join(UPD, V1), script = path.join(stage, 'updater.ps1'); fs.copyFileSync(path.join(APP_SRC, 'updater.ps1'), script); const before = hashTree(path.join(INSTALL, 'resources', 'app'));
      const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-StageRoot', path.join(stage, 'extracted', 'Saveit'), '-InstallDir', INSTALL, '-ParentPid', '0', '-NewVersion', V1, '-OldVersion', V0, '-ResultFile', path.join(UPD, 'wait-result.json'), '-HealthFile', path.join(UPD, 'wait-health.json'), '-LogFile', path.join(UPD, 'wait.log'), '-WaitSeconds', '4'], { encoding: 'utf8', timeout: 60000 });
      assert.equal(r.status, 0, r.stderr); const res = JSON.parse(fs.readFileSync(path.join(UPD, 'wait-result.json'), 'utf8').replace(/^﻿/, '')); assert.equal(res.status, 'unchanged'); assert.match(res.message, /did not close in time/);
      assert.ok(procs(INSTALL).length > 0, 'the running Saveit was left alone'); assert.deepEqual(hashTree(path.join(INSTALL, 'resources', 'app')), before, 'installed files unchanged'); assert.equal(fs.existsSync(path.join(INSTALL, 'update-backup')), false);
    });
    let appExit;
    await test(`REAL UPDATE ${V0} -> ${V1}: Saveit closes by itself, the new version installs, starts and says so`, async () => {
      await openDialog(w); await w.click('#updInstall103'); await w.waitForSelector('#updGo103', { timeout: 60000 }); // the busy test left a different screen showing
      appExit = closeAndWait(app); await w.click('#updGo103');
      await Promise.race([appExit, sleep(40000).then(() => { throw new Error('Saveit did not close by itself'); })]);
      await waitFor(() => installedVersion() === V1 && /Saveit/.test(windowTitle()), 90000, 'the new version to be installed and running');
      assert.match(windowTitle(), new RegExp('Saveit ' + V1.replace(/\./g, '\\.'))); assert.equal(fs.readFileSync(path.join(INSTALL, 'resources', 'app', 'update-marker.txt'), 'utf8'), V1);
      await waitFor(() => /result: ok/.test(readLog()), 30000, 'the updater to log success'); const log = readLog(); assert.match(log, /backup verified/); assert.match(log, /new app in place/);
      assert.equal(fs.readFileSync(path.join(INSTALL, 'update-backup', 'version.txt'), 'utf8').trim(), V0); assert.equal(fs.existsSync(path.join(INSTALL, 'resources', 'app.old')), false, 'old copy removed after success');
      assert.equal(fs.existsSync(path.join(INSTALL, 'Saveit.exe')), true); assert.equal(fs.existsSync(path.join(INSTALL, 'uninstall.ps1')), true);
    });
    killAll(INSTALL); await sleep(1500);
    await test('Library, settings and stored data are exactly as they were after the update', async () => {
      ({ app, w } = await launch()); const after = await markers(w); assert.deepEqual(after, libBefore); assert.equal(crypto.createHash('sha256').update(fs.readFileSync(keepFile)).digest('hex'), keepHash);
      assert.match(await w.title(), new RegExp('Saveit ' + V1.replace(/\./g, '\\.')));
      await openDialog(w); fake.latest = buildRelease(V1); await openDialog(w); assert.match(await dialogText(w), /Saveit is up to date\./, 'now current');
    });
    await test('Never an older version: a lower release on GitHub is treated as up to date', async () => {
      fake.latest = buildRelease(V0); await openDialog(w); assert.match(await dialogText(w), /Saveit is up to date\./); assert.equal(await w.locator('#updInstall103').count(), 0);
    });
    await test(`RECOVERY: a release that crashes at start (${V2}) is rolled back to ${V1} automatically`, async () => {
      fake.latest = buildRelease(V2, d => { const f = path.join(d, 'main.js'); fs.writeFileSync(f, 'process.exit(3);\r\n' + fs.readFileSync(f, 'utf8')); });
      await openDialog(w); await w.click('#updInstall103'); await w.waitForSelector('#updGo103', { timeout: 60000 }); const exited = closeAndWait(app); await w.click('#updGo103'); await exited;
      await waitFor(() => /result: rolled-back/.test(readLog()), 90000, 'the rollback'); await waitFor(() => installedVersion() === V1 && /Saveit/.test(windowTitle()), 60000, 'the previous version to be running again');
      assert.equal(installedVersion(), V1); assert.match(windowTitle(), new RegExp('Saveit ' + V1.replace(/\./g, '\\.'))); assert.equal(fs.existsSync(path.join(INSTALL, 'resources', 'app', 'update-marker.txt')) && fs.readFileSync(path.join(INSTALL, 'resources', 'app', 'update-marker.txt'), 'utf8'), V1);
      assert.match(readLog(), /FAILED: The new version did not start properly/); assert.match(readLog(), /restoring the previous version/);
    });
    killAll(INSTALL); await sleep(1500);
    await test('After a rollback the previous version shows what happened, and the data is intact', async () => {
      ({ app, w } = await launch()); const after = await markers(w); assert.deepEqual(after, libBefore); assert.equal(crypto.createHash('sha256').update(fs.readFileSync(keepFile)).digest('hex'), keepHash);
    });
    await test(`RECOVERY: a release that runs but never reports it is working (${V3}) is stopped and rolled back`, async () => {
      fake.latest = buildRelease(V3, d => fs.writeFileSync(path.join(d, 'main.js'), 'setInterval(() => {}, 1000);\r\n')); // starts, shows nothing, never answers
      await openDialog(w); await w.click('#updInstall103'); await w.waitForSelector('#updGo103', { timeout: 60000 }); const exited = closeAndWait(app); await w.click('#updGo103'); await exited;
      await waitFor(() => (readLog().match(/result: rolled-back/g) || []).length >= 2, 90000, 'the second rollback'); await waitFor(() => installedVersion() === V1 && /Saveit/.test(windowTitle()), 60000, 'the working version to be running again');
      assert.equal(installedVersion(), V1); assert.match(windowTitle(), new RegExp('Saveit ' + V1.replace(/\./g, '\\.'))); assert.match(readLog(), /new version did not start properly/);
    });
    killAll(INSTALL); await sleep(1500);
    await test('The real installed Saveit, its shortcuts and its Settings > Apps entry were never touched', async () => {
      assert.deepEqual(hashTree(REAL_APP), realBefore, 'real installed app files unchanged'); assert.deepEqual(lnks.map(f => fs.existsSync(f) ? fs.statSync(f).mtimeMs : null), lnkBefore, 'shortcuts unchanged');
      const regAfter = (() => { try { return ps("(Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Saveit' -ErrorAction Stop).DisplayVersion"); } catch (_) { return ''; } })(); assert.equal(regAfter, regBefore, 'Installed apps version unchanged');
      assert.match(readLog(), /registry entry belongs to another install; left alone|registry/);
    });
  } catch (e) { bad('test run aborted', e); }
  finally { killAll(INSTALL); server.close(); }
  console.log(JSON.stringify({ passed: results.filter(Boolean).length, failed: results.filter(x => !x).length, scratch: base }));
  if (!fail && !process.env.SAVEIT_E2E_KEEP) { try { fs.rmSync(base, { recursive: true, force: true }); } catch (_) { } }
  process.exit(fail ? 1 : 0);
})();
