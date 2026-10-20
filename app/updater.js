// Saveit 10.2.0: "Check for Updates" (main process).
// Nothing here runs by itself: every step starts from the person clicking the link in the editor.
//   check()      asks the official GitHub Releases API for the latest published stable release
//   download()   downloads the release ZIP into a staging folder and verifies it BEFORE anything is installed
//   apply()      starts a separate updater process (updater.ps1, from the installed app, never from the download), then Saveit closes by itself
// Verification: every release ZIP has a detached Ed25519 signature (Saveit-X.zip.sig) made with a private key that only the
// publisher holds. The matching public key is built into this file. The signature covers the version and the ZIP's SHA-256,
// so a file that was changed, swapped, or replayed as another version is refused. GitHub's own SHA-256 for the file is
// checked as well. See HANDOFF.md ("Releases and updates") for how a release is signed.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');
const { spawn } = require('child_process');

const REPO = 'stuartraymor/Saveit';
// Public half of the release signing key (Ed25519). Its fingerprint (SHA-256 of the DER) is
// 0dfac780ce80cadf0c340f1990cfd8155c00023cefa984c2c753029e18975983
const PUBLIC_KEY_PEM = '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAuW+eyuwrZsGwIZ2oXmqzx7J+RhqiGpaSvU3zRGV/Kac=\n-----END PUBLIC KEY-----\n';
const SIGN_CONTEXT = 'Saveit-release-v1';
const GITHUB_HOSTS = ['api.github.com', 'github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com', 'github-releases.githubusercontent.com'];
const MAX_JSON = 2 * 1024 * 1024, MAX_ZIP = 400 * 1024 * 1024, MAX_SIG = 4096, MAX_UNPACKED = 1200 * 1024 * 1024, MAX_FILES = 6000;

// The automated tests may point the updater at a local fake of the GitHub API, but only in a test profile
// (SAVEIT_REVIEW_DATA is set) and only at 127.0.0.1. In a normal run these are ignored. The signature is still required.
const TEST_MODE = !!process.env.SAVEIT_REVIEW_DATA;
const TEST_ORIGIN = TEST_MODE && /^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(process.env.SAVEIT_UPDATE_API || '') ? process.env.SAVEIT_UPDATE_API : null;
const API_ORIGIN = TEST_ORIGIN || 'https://api.github.com';
const TEST_PUBLIC_KEY = TEST_MODE && process.env.SAVEIT_UPDATE_PUBKEY_FILE && fs.existsSync(process.env.SAVEIT_UPDATE_PUBKEY_FILE) ? fs.readFileSync(process.env.SAVEIT_UPDATE_PUBKEY_FILE, 'utf8') : null;

class UpdateError extends Error { constructor(code, message) { super(message); this.code = code; } }

// ---------- versions ----------
function parseVersion(s) { const m = /^v?(\d{1,4})\.(\d{1,4})\.(\d{1,4})$/.exec(String(s || '').trim()); return m ? [+m[1], +m[2], +m[3]] : null; }
function compareVersions(a, b) { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1; return 0; }
const isNewer = (candidate, current) => { const a = parseVersion(candidate), b = parseVersion(current); return !!a && !!b && compareVersions(a, b) > 0; };

// ---------- web access (only GitHub, only https, redirects checked one by one) ----------
function hostAllowed(u) {
  let x; try { x = new URL(u); } catch (_) { return false; }
  if (TEST_ORIGIN && x.origin === TEST_ORIGIN) return true;
  return x.protocol === 'https:' && !x.username && !x.password && GITHUB_HOSTS.includes(x.hostname);
}
async function request(url, { maxBytes, timeoutMs = 30000, accept, onProgress } = {}) {
  let current = url;
  for (let hop = 0; hop < 6; hop++) {
    if (!hostAllowed(current)) throw new UpdateError('blocked', 'The update server address was not recognised, so nothing was downloaded.');
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs);
    let res;
    try { res = await fetch(current, { redirect: 'manual', signal: ctl.signal, headers: { 'User-Agent': 'Saveit-updater', 'Accept': accept || '*/*', 'X-GitHub-Api-Version': '2022-11-28' } }); }
    catch (e) { clearTimeout(timer); throw new UpdateError('network', 'Saveit could not reach GitHub. Check your internet connection and try again.'); }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { clearTimeout(timer); current = new URL(res.headers.get('location'), current).toString(); continue; }
    if (res.status === 403 || res.status === 429) { clearTimeout(timer); throw new UpdateError('limit', 'GitHub is limiting requests right now. Please try again in a little while.'); }
    if (res.status === 404) { clearTimeout(timer); throw new UpdateError('notfound', 'No published release was found.'); }
    if (!res.ok) { clearTimeout(timer); throw new UpdateError('server', 'GitHub could not answer right now (error ' + res.status + '). Please try again later.'); }
    try {
      const declared = +res.headers.get('content-length') || 0;
      if (declared && declared > maxBytes) throw new UpdateError('size', 'The update file is larger than expected, so it was not downloaded.');
      const chunks = []; let got = 0; const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        got += value.length; if (got > maxBytes) { try { await reader.cancel(); } catch (_) { } throw new UpdateError('size', 'The update file is larger than expected, so it was stopped.'); }
        chunks.push(Buffer.from(value)); if (onProgress) onProgress(got, declared);
        // a stalled connection restarts the clock only while data keeps arriving
        timer.refresh && timer.refresh();
      }
      return Buffer.concat(chunks, got);
    } catch (e) { if (e instanceof UpdateError) throw e; throw new UpdateError('network', 'The download was interrupted. Check your internet connection and try again.'); }
    finally { clearTimeout(timer); }
  }
  throw new UpdateError('blocked', 'The update server redirected too many times, so nothing was downloaded.');
}

// ---------- check ----------
async function check(currentVersion) {
  if (!parseVersion(currentVersion)) throw new UpdateError('state', 'Saveit could not read its own version number.');
  const body = await request(`${API_ORIGIN}/repos/${REPO}/releases/latest`, { maxBytes: MAX_JSON, accept: 'application/vnd.github+json' });
  let rel; try { rel = JSON.parse(body.toString('utf8')); } catch (_) { throw new UpdateError('server', 'GitHub sent an answer Saveit could not read. Please try again later.'); }
  const version = parseVersion(rel && rel.tag_name);
  // only a published, stable release (the "latest" endpoint already leaves out drafts and pre-releases; this is a second check)
  if (!rel || rel.draft === true || rel.prerelease === true || !version || !/^v\d+\.\d+\.\d+$/.test(rel.tag_name)) throw new UpdateError('notfound', 'No published stable release was found.');
  const latest = version.join('.');
  const out = { current: currentVersion, latest, tag: rel.tag_name, notes: String(rel.body || '').slice(0, 20000), publishedAt: rel.published_at || '' };
  if (!isNewer(latest, currentVersion)) return { state: 'current', ...out };
  const assets = Array.isArray(rel.assets) ? rel.assets : [], find = n => assets.find(a => a && a.name === n);
  const zip = find(`Saveit-${latest}.zip`), sig = find(`Saveit-${latest}.zip.sig`), sha = find(`Saveit-${latest}.sha256`);
  // Official downloads must come from this repository's release path; the address is built here, not taken from the answer.
  const dl = n => TEST_ORIGIN ? `${TEST_ORIGIN}/download/${rel.tag_name}/${n}` : `https://github.com/${REPO}/releases/download/${rel.tag_name}/${n}`;
  if (!zip) return { state: 'unavailable', reason: 'This release has no downloadable package, so Saveit cannot install it automatically. You can download it from GitHub.', ...out };
  if (!sig) return { state: 'unavailable', reason: 'This release has no signature, so Saveit cannot verify it and will not install it automatically. You can download it from GitHub.', ...out };
  if (!(zip.size > 1000 && zip.size <= MAX_ZIP)) return { state: 'unavailable', reason: 'This release package is not the expected size, so Saveit will not install it automatically.', ...out };
  return { state: 'available', ...out, size: zip.size, digest: typeof zip.digest === 'string' ? zip.digest : '', zipUrl: dl(zip.name), sigUrl: dl(sig.name), shaUrl: sha ? dl(sha.name) : '' };
}

// ---------- verification ----------
function signedMessage(version, sha256Hex) { return Buffer.from(`${SIGN_CONTEXT}\nversion=${version}\nsha256=${sha256Hex}\n`, 'ascii'); }
function verifySignature(version, zipBytes, sigText, publicKeyPem) {
  const sha = crypto.createHash('sha256').update(zipBytes).digest('hex');
  let ok = false;
  try {
    const sig = Buffer.from(String(sigText).trim(), 'base64');
    if (sig.length !== 64) return { ok: false, sha };
    ok = crypto.verify(null, signedMessage(version, sha), crypto.createPublicKey(publicKeyPem || TEST_PUBLIC_KEY || PUBLIC_KEY_PEM), sig);
  } catch (_) { ok = false; }
  return { ok, sha };
}

// ---------- unpacking a ZIP (written here so that every file name can be checked before anything is written) ----------
function extractZip(buf, destDir) {
  const eocd = (() => { for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) return i; return -1; })();
  if (eocd < 0) throw new UpdateError('zip', 'The update package is not a valid ZIP file.');
  const total = buf.readUInt16LE(eocd + 10); let p = buf.readUInt32LE(eocd + 16);
  if (total > MAX_FILES) throw new UpdateError('zip', 'The update package has too many files.');
  let unpacked = 0; const files = [];
  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new UpdateError('zip', 'The update package is damaged.');
    const flags = buf.readUInt16LE(p + 8), method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24), nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen); p += 46 + nlen + elen + clen;
    if (flags & 1) throw new UpdateError('zip', 'The update package is encrypted.');
    // reject anything that could land outside the staging folder: control characters, backslashes, drive letters, absolute paths, ".." parts
    if (!name || name.split('').some(ch => ch.charCodeAt(0) < 32 || ch === String.fromCharCode(92) || ':*?"<>|'.includes(ch)) || name.startsWith('/') || name.split('/').some(part => part === '..')) throw new UpdateError('zip', 'The update package contains an unsafe file name.');
    const target = path.resolve(destDir, name), rel = path.relative(destDir, target);
    if (rel.startsWith('..') || path.isAbsolute(rel)) throw new UpdateError('zip', 'The update package contains an unsafe file name.');
    if (name.endsWith('/')) { fs.mkdirSync(target, { recursive: true }); continue; }
    unpacked += usize; if (unpacked > MAX_UNPACKED) throw new UpdateError('zip', 'The update package unpacks to more than expected.');
    if (buf.readUInt32LE(lho) !== 0x04034b50) throw new UpdateError('zip', 'The update package is damaged.');
    const start = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28), raw = buf.subarray(start, start + csize);
    let data; if (method === 0) data = raw; else if (method === 8) data = zlib.inflateRawSync(raw, { maxOutputLength: usize + 1 }); else throw new UpdateError('zip', 'The update package uses a method Saveit does not support.');
    if (data.length !== usize) throw new UpdateError('zip', 'The update package is damaged.');
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, data); files.push(name);
  }
  return files;
}

// ---------- download + verify + unpack ----------
async function download(info, userDataDir, onProgress) {
  if (!info || info.state !== 'available' || !parseVersion(info.latest)) throw new UpdateError('state', 'There is no update to download.');
  const stage = path.join(userDataDir, 'updates', info.latest);
  fs.rmSync(stage, { recursive: true, force: true }); fs.mkdirSync(stage, { recursive: true });
  try {
    const free = fs.statfsSync ? (() => { try { const s = fs.statfsSync(stage); return s.bavail * s.bsize; } catch (_) { return Infinity; } })() : Infinity;
    if (free < Math.max(info.size, 1) * 6 + 50 * 1024 * 1024) throw new UpdateError('space', 'There is not enough free disk space to download and unpack the update.');
    const zip = await request(info.zipUrl, { maxBytes: MAX_ZIP, timeoutMs: 120000, onProgress: (got, total) => onProgress && onProgress(got, total || info.size) });
    const sigText = (await request(info.sigUrl, { maxBytes: MAX_SIG })).toString('utf8');
    // 1. authenticity: the signature must verify against the public key built into this app
    const v = verifySignature(info.latest, zip, sigText);
    if (!v.ok) throw new UpdateError('verify', 'The downloaded update could not be verified as genuine, so it was deleted and nothing was installed.');
    // 2. integrity: it must also match GitHub's own record of the file
    if (info.digest && /^sha256:[0-9a-f]{64}$/i.test(info.digest) && info.digest.slice(7).toLowerCase() !== v.sha) throw new UpdateError('verify', 'The downloaded update does not match what GitHub published, so it was deleted and nothing was installed.');
    if (info.shaUrl) { const line = (await request(info.shaUrl, { maxBytes: 1024 })).toString('utf8').trim().split(/\s+/)[0].toLowerCase(); if (/^[0-9a-f]{64}$/.test(line) && line !== v.sha) throw new UpdateError('verify', 'The downloaded update does not match its published checksum, so it was deleted and nothing was installed.'); }
    fs.writeFileSync(path.join(stage, `Saveit-${info.latest}.zip`), zip);
    // 3. only now is it unpacked (to a staging folder, never into the installed app)
    const extracted = path.join(stage, 'extracted'); extractZip(zip, extracted);
    const rootDir = path.join(extracted, 'Saveit'), appDir = path.join(rootDir, 'app');
    let pkg; try { pkg = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8')); } catch (_) { throw new UpdateError('verify', 'The update package does not contain a Saveit application, so nothing was installed.'); }
    if (pkg.version !== info.latest) throw new UpdateError('verify', 'The package version does not match the release, so nothing was installed.');
    for (const f of ['main.js', 'preload.js', 'index.html']) if (!fs.existsSync(path.join(appDir, f))) throw new UpdateError('verify', 'The update package is missing files, so nothing was installed.');
    return { stage, rootDir, version: info.latest };
  } catch (e) { fs.rmSync(stage, { recursive: true, force: true }); throw e; }
}

// ---------- install layout ----------
// Updates install only into a normal per-user installation: <install>\Saveit.exe with the app in <install>\resources\app.
function installLayout(appDir = __dirname, exe = process.execPath) {
  const dir = path.dirname(exe);
  if (path.basename(exe).toLowerCase() !== 'saveit.exe') return null;
  if (path.resolve(path.join(dir, 'resources', 'app')).toLowerCase() !== path.resolve(appDir).toLowerCase()) return null;
  return { dir, exe };
}

// ---------- hand over to the separate updater ----------
function startUpdater(staged, userDataDir, currentVersion) {
  const lay = installLayout(); if (!lay) throw new UpdateError('layout', 'Updates can be installed only in the installed version of Saveit.');
  if (!staged || !staged.rootDir || !fs.existsSync(path.join(staged.rootDir, 'app', 'main.js'))) throw new UpdateError('state', 'The update is not ready to install.');
  const dir = path.join(userDataDir, 'updates'); fs.mkdirSync(dir, { recursive: true });
  const script = path.join(staged.stage, 'updater.ps1'); fs.copyFileSync(path.join(__dirname, 'updater.ps1'), script);   // the script that runs is Saveit's own, never one from the download
  const result = path.join(dir, 'result.json'), health = path.join(dir, 'health.json'), log = path.join(dir, 'update.log');
  const cancel = path.join(dir, 'cancel-update.flag'); fs.rmSync(result, { force: true }); fs.rmSync(health, { force: true }); fs.rmSync(cancel, { force: true });
  const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-StageRoot', staged.rootDir, '-InstallDir', lay.dir, '-ParentPid', String(process.pid), '-NewVersion', staged.version, '-OldVersion', currentVersion, '-ResultFile', result, '-HealthFile', health, '-LogFile', log, '-CancelFile', cancel];
  // test profiles only: shorter waits so the automated tests do not take minutes
  if (TEST_MODE) { const n = v => /^\d{1,3}$/.test(v || '') ? v : null; if (n(process.env.SAVEIT_UPDATE_HEALTH_SECONDS)) args.push('-HealthSeconds', n(process.env.SAVEIT_UPDATE_HEALTH_SECONDS)); if (n(process.env.SAVEIT_UPDATE_WAIT_SECONDS)) args.push('-WaitSeconds', n(process.env.SAVEIT_UPDATE_WAIT_SECONDS)); }
  const env = { ...process.env }; delete env.SAVEIT_UPDATE_HEALTH;
  // The "Updating Saveit" window (a copy runs from the staging folder, because the install folder is being swapped). It runs the updater itself, hidden, and shows progress.
  // If it is not there (a development copy), the updater is started directly as before.
  let ui = null; try { const src = path.join(__dirname, 'saveit-updating.exe'); if (fs.existsSync(src)) { ui = path.join(staged.stage, 'saveit-updating.exe'); fs.copyFileSync(src, ui); } } catch (_) { ui = null; }
  // Started through cmd's "start" so the updater is NOT a child of Saveit: it must outlive Saveit, and it is not taken down with it.
  const quote = a => '"' + String(a).replace(/"/g, '') + '"';
  const launch = ui ? 'start "" /b ' + quote(ui) + ' ' + args.slice(5).map(quote).join(' ') : 'start "" /b powershell.exe ' + args.map(quote).join(' ');
  const child = spawn('cmd.exe', ['/d', '/s', '/c', '"' + launch + '"'], { detached: true, stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: true, env });
  child.unref();
  return { child, cancel };
}

// ---------- results the next start shows ----------
function takeResult(userDataDir) {
  const f = path.join(userDataDir, 'updates', 'result.json');
  try { const r = JSON.parse(fs.readFileSync(f, 'utf8')); fs.rmSync(f, { force: true }); return r && typeof r === 'object' ? r : null; } catch (_) { return null; }
}
// When the updater starts the new version it sets SAVEIT_UPDATE_HEALTH; the new version answers once its window is up.
function markHealthy(version) {
  const f = process.env.SAVEIT_UPDATE_HEALTH; if (!f) return;
  try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify({ version, pid: process.pid, at: Date.now() })); } catch (_) { }
  delete process.env.SAVEIT_UPDATE_HEALTH;
}

// ---------- wiring ----------
// deps: { app, ipcMain, mainSender(e), getWin(), requestQuit(), busyReason() -> string|'' }
function register(deps) {
  const { app, ipcMain, mainSender, getWin, requestQuit, busyReason } = deps, userData = () => app.getPath('userData');
  let info = null, staged = null, working = false, applying = false;
  const send = (ch, d) => { const w = getWin(); if (w && !w.isDestroyed()) w.webContents.send(ch, d); };
  const fail = e => ({ ok: false, code: e && e.code || 'error', message: e instanceof UpdateError ? e.message : 'Something went wrong while updating. Saveit was not changed.' });
  ipcMain.handle('update-check', async e => {
    mainSender(e); if (working || applying) return { ok: false, code: 'busy', message: 'An update step is already running.' };
    working = true; try { info = await check(app.getVersion()); staged = null; return { ok: true, canInstall: !!installLayout(), ...info, zipUrl: undefined, sigUrl: undefined, shaUrl: undefined }; }
    catch (err) { info = null; return fail(err); } finally { working = false; }
  });
  ipcMain.handle('update-download', async e => {
    mainSender(e); if (working || applying) return { ok: false, code: 'busy', message: 'An update step is already running.' };
    if (!info || info.state !== 'available') return { ok: false, code: 'state', message: 'Check for updates first.' };
    if (!installLayout()) return { ok: false, code: 'layout', message: 'Updates can be installed only in the installed version of Saveit.' };
    working = true;
    try { staged = await download(info, userData(), (got, total) => send('update-progress', { got, total })); return { ok: true, version: staged.version }; }
    catch (err) { staged = null; return fail(err); } finally { working = false; }
  });
  ipcMain.handle('update-apply', async e => {
    mainSender(e); if (applying) return { ok: false, code: 'busy', message: 'The update is already starting.' };
    if (!staged) return { ok: false, code: 'state', message: 'The update is not ready to install.' };
    const why = busyReason(); if (why) return { ok: false, code: 'busy', message: why };
    let started; try { started = startUpdater(staged, userData(), app.getVersion()); } catch (err) { return fail(err); }
    applying = true; requestQuit();
    // If Saveit does not close (for example the person cancels), the updater has changed nothing yet: stop it and say so. Saveit itself is never force-closed.
    setTimeout(() => { if (applying) { try { fs.writeFileSync(started.cancel, 'cancel'); } catch (_) { } applying = false; send('update-cancelled', {}); } }, 20000);
    return { ok: true };
  });
  ipcMain.handle('update-startup-result', e => { mainSender(e); return takeResult(userData()); });
  // When the updater itself started this copy it writes the result after the window is up, so wait for it (up to 90 s) and pass it on.
  if (process.env.SAVEIT_UPDATE_HEALTH) { let n = 0; const t = setInterval(() => { const r = takeResult(userData()); if (r) { clearInterval(t); send('update-result', r); } else if (++n > 180) clearInterval(t); }, 500); }
}

module.exports = { register, check, download, verifySignature, signedMessage, extractZip, parseVersion, compareVersions, isNewer, hostAllowed, installLayout, takeResult, markHealthy, UpdateError, PUBLIC_KEY_PEM, SIGN_CONTEXT };
