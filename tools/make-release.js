// Build the release commit's content in the release worktree (made from origin/main) from the tested v10-dev files.
// main holds a mix of CRLF and LF blobs, so every file is written in the line-ending style of ITS OWN blob on main (new
// files: CRLF, like the app files there), and only files whose content really differs are written and staged.
const cp = require('child_process'), fs = require('fs'), path = require('path');
const REPO = path.resolve(__dirname, '..'), WT = process.argv[2], VER = process.argv[3], SRC = 'v10-dev';
const git = (args, o = {}) => cp.execFileSync('git', ['-c', 'core.autocrlf=false', ...args], { cwd: o.cwd || REPO, maxBuffer: 1 << 30, encoding: o.text ? 'utf8' : 'buffer' });
const list = ref => git(['ls-tree', '-r', '--name-only', ref], { text: true }).split('\n').filter(Boolean);
const blob = (ref, f) => git(['cat-file', 'blob', ref + ':' + f]);
const isText = b => !b.subarray(0, 8000).includes(0);
const L = b => b.toString('latin1').replace(/\r\n/g, '\n');
const styled = (text, like) => Buffer.from(like && !/\r\n/.test(like.toString('latin1')) ? text : text.replace(/\n/g, '\r\n'), 'latin1');
const src = list(SRC), main = new Set(list('origin/main')), touched = [], report = { changed: [], added: [], removed: [] };
const put = (f, buf) => { const dst = path.join(WT, f); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.writeFileSync(dst, buf); touched.push(f); };
const wanted = f => f.startsWith('app/') || f.startsWith('native/') || ['Install.cmd', 'Reinstall.cmd', 'Uninstall.cmd', 'install.ps1', 'uninstall.ps1', 'README.txt'].includes(f) || (f.startsWith('tools/') && main.has(f));
for (const f of src.filter(wanted)) {
  const b = blob(SRC, f), old = main.has(f) ? blob('origin/main', f) : null, text = isText(b);
  if (old && (text ? L(old) === L(b) : old.equals(b))) continue;
  put(f, text ? styled(L(b), old) : b); (old ? report.changed : report.added).push(f);
}
const srcSet = new Set(src);
for (const f of [...main].filter(f => (f.startsWith('app/') || f.startsWith('native/')) && !srcSet.has(f))) { fs.rmSync(path.join(WT, f)); touched.push(f); report.removed.push(f); }
put('SETUP.txt', styled(L(blob(SRC, 'README.txt')), blob('origin/main', 'SETUP.txt'))); // SETUP.txt is README.txt
for (const f of src.filter(f => /^CHANGES-\d+\.\d+\.\d+\.md$/.test(f) && !main.has('docs/changes/' + f))) { put('docs/changes/' + f, styled(L(blob(SRC, f)), blob('origin/main', 'docs/changes/CHANGES-10.4.8.md'))); report.added.push('docs/changes/' + f); }
const vers = src.map(f => /^CHANGES-(\d+)\.(\d+)\.(\d+)\.md$/.exec(f)).filter(Boolean).map(m => [+m[1], +m[2], +m[3]]).sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2]).slice(0, 5).map(v => v.join('.'));
if (vers[0] !== VER) throw Error('newest notes are for ' + vers[0] + ', not ' + VER);
{ const old = blob('origin/main', 'README.md'); let r = old.toString('utf8'); const line = /What's new: .*\[all versions\]\(docs\/changes\)/; if (!line.test(r)) throw Error("README What's new line not found");
  r = r.replace(line, "What's new: " + vers.map(v => `[${v}](docs/changes/CHANGES-${v}.md)`).join(' \u00b7 ') + ' \u00b7 [all versions](docs/changes)'); put('README.md', Buffer.from(r, 'utf8')); }
for (let i = 0; i < touched.length; i += 40) git(['add', '-A', '--', ...touched.slice(i, i + 40)], { cwd: WT });
console.log(JSON.stringify({ ...report, whatsNew: vers, staged: touched.length }));
