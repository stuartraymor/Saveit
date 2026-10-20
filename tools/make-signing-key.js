// Makes a new Ed25519 release-signing key pair (for a new publisher or a key change).
//   node tools/make-signing-key.js <folder>
// Writes release-ed25519-private.pem (KEEP SECRET, never commit it) and release-ed25519-public.pem, and prints the public key and its fingerprint.
// Put the public key into PUBLIC_KEY_PEM in app/updater.js. Installed copies only trust the key that was built into THEIR version, so a key change
// must be shipped in a release that is signed with the previous key.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const dir = process.argv[2];
if (!dir) { console.error('Give a folder, for example: node tools/make-signing-key.js %USERPROFILE%\\.saveit-release-signing'); process.exit(1); }
fs.mkdirSync(dir, { recursive: true });
if (fs.existsSync(path.join(dir, 'release-ed25519-private.pem'))) { console.error('A key already exists in that folder; refusing to overwrite it.'); process.exit(1); }
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
fs.writeFileSync(path.join(dir, 'release-ed25519-private.pem'), privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
const pub = publicKey.export({ type: 'spki', format: 'pem' });
fs.writeFileSync(path.join(dir, 'release-ed25519-public.pem'), pub);
console.log('fingerprint ' + crypto.createHash('sha256').update(publicKey.export({ type: 'spki', format: 'der' })).digest('hex') + '\n' + pub);
