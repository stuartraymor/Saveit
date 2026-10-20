// Signs a Saveit release package so the in-app "Check for Updates" will accept it.
//   node tools/sign-release.js path\to\Saveit-10.2.0.zip [--key path\to\private.pem]
// Writes Saveit-X.zip.sig (base64 Ed25519 signature of "version + SHA-256 of the zip") and Saveit-X.sha256 next to the zip,
// then verifies the signature with the public key that is built into the app (app/updater.js).
// Upload all three files (zip, .sig, .sha256) as assets of the GitHub release. The release MUST be a normal, published, non-pre-release,
// tagged vX.Y.Z, or the updater will ignore it.
// The private key is NOT in the repository. By default it is read from %USERPROFILE%\.saveit-release-signing\release-ed25519-private.pem.
// Back that file up somewhere safe (not in the repository). If it is lost, installed copies of Saveit cannot verify future releases.
// To make a new key pair: node tools/make-signing-key.js <folder>   (then put the printed public key in app/updater.js and publish a release signed with the OLD key first).
const fs = require('fs'), path = require('path'), crypto = require('crypto'), os = require('os');
const U = require('../app/updater.js');
const args = process.argv.slice(2), keyAt = args.indexOf('--key');
const keyArg = keyAt >= 0 ? args[keyAt + 1] : null;
const zipPath = args.find((a, i) => !a.startsWith('--') && i !== keyAt + 1 || (keyAt < 0 && !a.startsWith('--')));
const keyPath = keyArg || path.join(os.homedir(), '.saveit-release-signing', 'release-ed25519-private.pem');
if (!zipPath || !fs.existsSync(zipPath)) { console.error('Give the release zip, for example: node tools/sign-release.js Saveit-10.2.0.zip'); process.exit(1); }
const m = /^Saveit-(\d+\.\d+\.\d+)\.zip$/.exec(path.basename(zipPath));
if (!m) { console.error('The file must be named Saveit-X.Y.Z.zip'); process.exit(1); }
if (!fs.existsSync(keyPath)) { console.error('Signing key not found: ' + keyPath); process.exit(1); }
const version = m[1], zip = fs.readFileSync(zipPath), sha = crypto.createHash('sha256').update(zip).digest('hex');
const sig = crypto.sign(null, U.signedMessage(version, sha), crypto.createPrivateKey(fs.readFileSync(keyPath))).toString('base64');
if (!U.verifySignature(version, zip, sig).ok) { console.error('The signature does not verify against the public key built into app/updater.js. Wrong key?'); process.exit(1); }
fs.writeFileSync(zipPath + '.sig', sig + '\n');
fs.writeFileSync(path.join(path.dirname(zipPath), `Saveit-${version}.sha256`), `${sha}  ${path.basename(zipPath)}\n`);
console.log(`Signed ${path.basename(zipPath)}\n  sha256  ${sha}\n  wrote   ${path.basename(zipPath)}.sig and Saveit-${version}.sha256\n  verified against the public key in app/updater.js`);
