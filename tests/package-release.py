"""Package the existing online installer without local inspection data or profiles."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import zipfile

root = Path(__file__).resolve().parents[1]
out = Path(sys.argv[1]).resolve()
out.mkdir(parents=True, exist_ok=True)
version = json.loads((root / 'app/package.json').read_text())['version']
files = sorted(p for p in (root / 'app').rglob('*') if p.is_file())
files += [root / p for p in ['Install.cmd', 'Reinstall.cmd', 'Uninstall.cmd',
                           'install.ps1', 'uninstall.ps1', 'README.txt',
                           f'CHANGES-{version}.md']]
archive = out / f'Saveit-{version}-Setup.zip'
if archive.exists():
    raise SystemExit(f'Refusing to overwrite {archive}')
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for p in files:
        z.write(p, f'Saveit-{version}/' + p.relative_to(root).as_posix())
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for p in files:
        assert z.read(f'Saveit-{version}/' + p.relative_to(root).as_posix()) == p.read_bytes()
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
archive.with_suffix('.zip.sha256.txt').write_text(f'{digest}  {archive.name}\n')
report = {'version': version, 'sourceCommit': subprocess.check_output(
    ['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(), 'archive': str(archive),
    'sha256': digest, 'filesVerified': len(files), 'bytes': archive.stat().st_size,
    'runtimeIncluded': False}
(out / f'package-{version}-results.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
