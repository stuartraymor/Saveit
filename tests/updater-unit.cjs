// 10.1.13: unit tests for app/updater.js (no Electron needed): versions, allowed servers, signatures, the ZIP reader,
// and the whole check + download + verify path against a local fake of the GitHub API.
//   node tests/updater-unit.cjs
const assert = require('assert/strict'), fs = require('fs'), os = require('os'), path = require('path'), http = require('http'), crypto = require('crypto');
const { releaseZip, makeZip } = require('./zip-util.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'saveit-updater-unit-'));
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
fs.writeFileSync(path.join(tmp, 'test-public.pem'), publicKey.export({ type: 'spki', format: 'pem' }));
const other = crypto.generateKeyPairSync('ed25519');
const sign = (version, zip, key = privateKey) => crypto.sign(null, Buffer.from(`Saveit-release-v1\nversion=${version}\nsha256=${crypto.createHash('sha256').update(zip).digest('hex')}\n`, 'ascii'), key).toString('base64');
let fail = 0; const run = async (name, fn) => { try { await fn(); console.log('PASS', name); } catch (e) { fail++; console.log('FAIL', name, '\n    ', e.message); } };

// a fake GitHub: routes are changed per test through `routes`
let routes = {}, port = 0; const hits = [];
const server = http.createServer((req, res) => { hits.push(req.url); const r = routes[req.url.split('?')[0]]; if (!r) { res.writeHead(404); return res.end('nf'); } if (typeof r === 'function') return r(req, res); res.writeHead(r.status || 200, r.headers || {}); res.end(r.body); });

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r)); port = server.address().port;
  // the test mode of the updater needs a test profile and a local address; the real key is replaced by the test key
  process.env.SAVEIT_REVIEW_DATA = tmp; process.env.SAVEIT_UPDATE_API = `http://127.0.0.1:${port}`; process.env.SAVEIT_UPDATE_PUBKEY_FILE = path.join(tmp, 'test-public.pem');
  const U = require('../app/updater.js');
  const API = '/repos/stuartraymor/Saveit/releases/latest', rel = (over = {}) => ({ tag_name: 'v10.1.13', name: 'Saveit 10.1.13', body: '## Notes\n- one', draft: false, prerelease: false, published_at: '2026-10-19T00:00:00Z', assets: [{ name: 'Saveit-10.1.13.zip', size: 5000 }, { name: 'Saveit-10.1.13.zip.sig', size: 90 }, { name: 'Saveit-10.1.13.sha256', size: 80 }], ...over });
  const serve = (r) => { routes = { [API]: { body: JSON.stringify(r), headers: { 'content-type': 'application/json' } } }; };

  await run('Version rules: newer only; numbers compare as numbers; junk and pre-release tags are rejected', () => {
    for (const [a, b, want] of [['10.1.13', '10.1.12', true], ['10.1.10', '10.1.9', true], ['10.2.0', '10.1.12', true], ['11.0.0', '10.12.12', true], ['v10.1.13', '10.1.12', true], ['10.1.12', '10.1.12', false], ['10.1.11', '10.1.12', false], ['9.9.4', '10.0.0', false], ['10.1.13-beta', '10.1.12', false], ['10.1', '10.1.12', false], ['', '10.1.12', false], ['10.1.13', 'x', false], ['10.1.13.1', '10.1.12', false]])
      assert.equal(U.isNewer(a, b), want, `${a} vs ${b}`);
  });
  await run('Only GitHub over https (and the local fake in test mode) is allowed; look-alike addresses are refused', () => {
    for (const ok of ['https://api.github.com/repos/x', 'https://github.com/stuartraymor/Saveit/releases/download/v1.2.3/a.zip', 'https://objects.githubusercontent.com/x', `http://127.0.0.1:${port}/x`]) assert.equal(U.hostAllowed(ok), true, ok);
    for (const bad of ['http://github.com/x', 'https://github.com.evil.com/x', 'https://evilgithub.com/x', 'https://user:pw@github.com/x', 'https://github.com@evil.com/x', 'ftp://github.com/x', 'https://raw.githubusercontent.com/x', 'http://127.0.0.1:9/x', 'http://localhost/x', 'file:///c:/x', 'not a url'])
      assert.equal(U.hostAllowed(bad), false, bad);
  });
  await run('Signatures: valid ones pass; a changed file, another version, another key, or garbage fail', () => {
    const zip = Buffer.from('release bytes'), sig = sign('10.1.13', zip), key = publicKey.export({ type: 'spki', format: 'pem' });
    assert.equal(U.verifySignature('10.1.13', zip, sig, key).ok, true);
    assert.equal(U.verifySignature('10.1.13', zip, sig + '\r\n', key).ok, true, 'trailing newline');
    assert.equal(U.verifySignature('10.1.13', Buffer.from('release bytez'), sig, key).ok, false, 'changed file');
    assert.equal(U.verifySignature('10.1.14', zip, sig, key).ok, false, 'replayed as another version');
    assert.equal(U.verifySignature('10.1.13', zip, sign('10.1.13', zip, other.privateKey), key).ok, false, 'signed by another key');
    for (const g of ['', 'AAAA', 'not base64 !!', Buffer.alloc(64).toString('base64'), Buffer.alloc(63).toString('base64')]) assert.equal(U.verifySignature('10.1.13', zip, g, key).ok, false, 'garbage ' + g.slice(0, 8));
    assert.equal(U.verifySignature('10.1.13', zip, sig, U.PUBLIC_KEY_PEM).ok, false, 'the real built-in key refuses a test signature');
  });
  await run('The ZIP reader unpacks a real package and refuses unsafe names and lying sizes', () => {
    const d = fs.mkdtempSync(path.join(tmp, 'x-')); const files = U.extractZip(releaseZip('10.1.13'), d);
    assert.ok(files.includes('Saveit/app/main.js')); assert.equal(fs.readFileSync(path.join(d, 'Saveit/app/package.json'), 'utf8').includes('10.1.13'), true);
    for (const bad of ['../evil.txt', 'Saveit/../../evil.txt', '/abs.txt', 'C:/win.txt', 'Saveit\\..\\evil.txt', 'a/b/../../../c.txt', 'x\u0000y.txt']) {
      const dd = fs.mkdtempSync(path.join(tmp, 'y-')); assert.throws(() => U.extractZip(makeZip([{ name: bad, data: 'x' }]), dd), /unsafe file name/, bad);
      assert.equal(fs.existsSync(path.join(dd, '..', 'evil.txt')), false); assert.equal(fs.readdirSync(dd).length, 0, 'nothing written for ' + bad);
    }
    assert.throws(() => U.extractZip(makeZip([{ name: 'a.txt', data: 'hello', usizeOverride: 999999 }]), fs.mkdtempSync(path.join(tmp, 'z-'))), /damaged|unpacks/);
    assert.throws(() => U.extractZip(Buffer.from('this is not a zip file at all'), fs.mkdtempSync(path.join(tmp, 'q-'))), /not a valid ZIP/);
  });

  await run('Check: a newer stable release is offered, with notes and addresses built by Saveit (not taken from the answer)', async () => {
    serve(rel({ assets: [{ name: 'Saveit-10.1.13.zip', size: 5000, browser_download_url: 'https://evil.example/x.zip', digest: 'sha256:' + 'a'.repeat(64) }, { name: 'Saveit-10.1.13.zip.sig', size: 90, browser_download_url: 'https://evil.example/s' }, { name: 'Saveit-10.1.13.sha256', size: 80 }] }));
    const r = await U.check('10.1.12'); assert.equal(r.state, 'available'); assert.equal(r.latest, '10.1.13'); assert.match(r.notes, /Notes/);
    assert.ok(r.zipUrl.startsWith(`http://127.0.0.1:${port}/download/v10.1.13/`) && !r.zipUrl.includes('evil')); assert.equal(r.digest, 'sha256:' + 'a'.repeat(64));
  });
  await run('Check: current, older, draft, pre-release, odd tags and a missing package are never offered for install', async () => {
    serve(rel()); assert.equal((await U.check('10.1.13')).state, 'current'); assert.equal((await U.check('10.2.0')).state, 'current', 'never an older version');
    for (const over of [{ draft: true }, { prerelease: true }, { tag_name: 'v10.1.13-beta' }, { tag_name: '10.1.13' }, { tag_name: 'latest' }, { tag_name: 'v10.1' }]) { serve(rel(over)); await assert.rejects(U.check('10.1.12'), /No published stable release/, JSON.stringify(over)); }
    serve(rel({ assets: [{ name: 'Saveit-10.1.13.zip.sig', size: 90 }] })); assert.equal((await U.check('10.1.12')).state, 'unavailable');
    serve(rel({ assets: [{ name: 'Saveit-10.1.13.zip', size: 5000 }] })); const nos = await U.check('10.1.12'); assert.equal(nos.state, 'unavailable'); assert.match(nos.reason, /no signature/);
    serve(rel({ assets: [{ name: 'Saveit-10.1.13.zip', size: 999999999 }, { name: 'Saveit-10.1.13.zip.sig', size: 90 }] })); assert.equal((await U.check('10.1.12')).state, 'unavailable', 'an absurd size');
  });
  await run('Check: GitHub problems become plain messages', async () => {
    routes = {}; await assert.rejects(U.check('10.1.12'), e=>e.code==='access'&&/not allowing public access/.test(e.message));
    routes = { ['/repos/stuartraymor/Saveit']: {body:JSON.stringify({private:false})} }; await assert.rejects(U.check('10.1.12'), e=>e.code==='notfound'&&/No published release/.test(e.message));
    routes = { [API]: { status: 500, body: 'x' } }; await assert.rejects(U.check('10.1.12'), /could not answer right now/);
    routes = { [API]: { status: 403, body: 'rate' } }; await assert.rejects(U.check('10.1.12'), /limiting requests/);
    routes = { [API]: { body: '<html>not json' } }; await assert.rejects(U.check('10.1.12'), /could not read/);
    routes = { [API]: { body: JSON.stringify({ tag_name: 'v10.1.13', body: 'x'.repeat(3 * 1024 * 1024) }) } }; await assert.rejects(U.check('10.1.12'), /larger than expected/);
    routes = { [API]: (req, res) => { res.writeHead(302, { location: 'https://evil.example/api' }); res.end(); } }; await assert.rejects(U.check('10.1.12'), /not recognised/);
    routes = { [API]: (req, res) => { req.socket.destroy(); } }; await assert.rejects(U.check('10.1.12'), /could not reach GitHub|interrupted/);
  });

  const stageOf = (v) => path.join(tmp, 'ud', 'updates', v);
  const goodInfo = (zip, sig, over = {}) => { const dl = n => `http://127.0.0.1:${port}/download/v10.1.13/${n}`; routes['/download/v10.1.13/Saveit-10.1.13.zip'] = { body: zip }; routes['/download/v10.1.13/Saveit-10.1.13.zip.sig'] = { body: sig }; return { state: 'available', latest: '10.1.13', size: zip.length, digest: 'sha256:' + crypto.createHash('sha256').update(zip).digest('hex'), zipUrl: dl('Saveit-10.1.13.zip'), sigUrl: dl('Saveit-10.1.13.zip.sig'), shaUrl: '', ...over }; };
  await run('Download: a genuine release is verified and unpacked into a staging folder only', async () => {
    const zip = releaseZip('10.1.13'), progress = []; const info = goodInfo(zip, sign('10.1.13', zip));
    const s = await U.download(info, path.join(tmp, 'ud'), (g, t) => progress.push([g, t]));
    assert.equal(s.version, '10.1.13'); assert.ok(fs.existsSync(path.join(s.rootDir, 'app', 'main.js'))); assert.ok(fs.existsSync(path.join(stageOf('10.1.13'), 'Saveit-10.1.13.zip'))); assert.ok(progress.length >= 1);
  });
  await run('Download: a changed file, a wrong signature, another version\'s signature, or a wrong checksum is deleted and refused', async () => {
    const zip = releaseZip('10.1.13'), sig = sign('10.1.13', zip), bad = Buffer.from(zip); bad[bad.length >> 1] ^= 0xff;
    for (const [label, make] of [['changed file', () => goodInfo(bad, sig, { digest: '' })], ['signed by another key', () => goodInfo(zip, sign('10.1.13', zip, other.privateKey))], ['signature for another version', () => goodInfo(zip, sign('10.1.12', zip))], ['empty signature', () => goodInfo(zip, '')], ['GitHub digest differs', () => goodInfo(zip, sig, { digest: 'sha256:' + 'b'.repeat(64) })]]) {
      const info = make();
      await assert.rejects(U.download(info, path.join(tmp, 'ud')), /could not be verified|does not match|damaged|not a valid/, label); assert.equal(fs.existsSync(stageOf('10.1.13')), false, 'staging removed after: ' + label);
    }
    const info = goodInfo(zip, sig); routes['/download/v10.1.13/Saveit-10.1.13.sha256'] = { body: 'c'.repeat(64) + '  Saveit-10.1.13.zip\n' }; info.shaUrl = `http://127.0.0.1:${port}/download/v10.1.13/Saveit-10.1.13.sha256`;
    await assert.rejects(U.download(info, path.join(tmp, 'ud')), /published checksum/);
  });
  await run('Download: a genuinely signed package with the wrong version inside, missing files, or unsafe names is refused', async () => {
    for (const [label, zip, re] of [['version inside differs', releaseZip('10.1.13', [], { pkgVersion: '10.1.99' }), /does not match the release/], ['main.js missing', releaseZip('10.1.13', [], { omitMain: true }), /missing files/], ['path traversal', releaseZip('10.1.13', [{ name: 'Saveit/../../escape.txt', data: 'x' }]), /unsafe file name/], ['no app at all', makeZip([{ name: 'Saveit/readme.txt', data: 'x' }]), /does not contain a Saveit application/]]) {
      const info = goodInfo(zip, sign('10.1.13', zip)); await assert.rejects(U.download(info, path.join(tmp, 'ud')), re, label); assert.equal(fs.existsSync(stageOf('10.1.13')), false, label);
    }
    assert.equal(fs.existsSync(path.join(tmp, 'ud', 'escape.txt')) || fs.existsSync(path.join(tmp, 'escape.txt')), false);
  });
  await run('Download: network trouble (server error, cut-off, redirect elsewhere, too big) fails cleanly with nothing left behind', async () => {
    const zip = releaseZip('10.1.13'), info = goodInfo(zip, sign('10.1.13', zip));
    routes['/download/v10.1.13/Saveit-10.1.13.zip'] = { status: 500, body: 'x' }; await assert.rejects(U.download(info, path.join(tmp, 'ud')), /could not answer right now/);
    routes['/download/v10.1.13/Saveit-10.1.13.zip'] = (req, res) => { res.writeHead(200, { 'content-length': String(zip.length) }); res.write(zip.subarray(0, 100)); setTimeout(() => req.socket.destroy(), 50); }; await assert.rejects(U.download(info, path.join(tmp, 'ud')), /interrupted/);
    routes['/download/v10.1.13/Saveit-10.1.13.zip'] = (req, res) => { res.writeHead(302, { location: 'https://evil.example/x.zip' }); res.end(); }; await assert.rejects(U.download(info, path.join(tmp, 'ud')), /not recognised/);
    routes['/download/v10.1.13/Saveit-10.1.13.zip'] = (req, res) => { res.writeHead(200, { 'content-length': String(900 * 1024 * 1024) }); res.end(); }; await assert.rejects(U.download(info, path.join(tmp, 'ud')), /larger than expected/);
    assert.equal(fs.existsSync(stageOf('10.1.13')), false);
    await assert.rejects(U.download({ state: 'current' }, path.join(tmp, 'ud')), /no update to download/);
  });
  await run('Updates install only into a normal installation (Saveit.exe with resources\\app)', () => {
    assert.equal(U.installLayout('C:\\x\\Saveit\\resources\\app', 'C:\\x\\Saveit\\Saveit.exe') !== null, true);
    assert.equal(U.installLayout('C:\\x\\Saveit\\resources\\app', 'C:\\x\\electron\\electron.exe'), null);
    assert.equal(U.installLayout('C:\\dev\\Saveit\\app', 'C:\\x\\Saveit\\Saveit.exe'), null);
  });

  server.close(); fs.rmSync(tmp, { recursive: true, force: true });
  console.log(fail ? `\n${fail} FAILED` : '\nUPDATER UNIT TESTS PASSED'); process.exit(fail ? 1 : 0);
})();
