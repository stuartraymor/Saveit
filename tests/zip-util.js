// Tiny ZIP writer for the updater tests (stored or deflated entries). entries: [{name, data(Buffer|string), method?: 0|8, usizeOverride?}]
const zlib = require('zlib');
const TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = buf => { let c = 0xFFFFFFFF; for (const b of buf) c = TABLE[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function makeZip(entries) {
  const parts = [], central = []; let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8'), data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data || '', 'utf8'), method = e.name.endsWith('/') ? 0 : (e.method ?? 8);
    const body = method === 8 ? zlib.deflateRawSync(data) : data, crc = crc32(data), usize = e.usizeOverride ?? data.length;
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(method, 8); lh.writeUInt32LE(0, 10); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(usize, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    parts.push(lh, name, body);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0, 8); ch.writeUInt16LE(method, 10); ch.writeUInt32LE(0, 12); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(usize, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(offset, 42);
    central.push(ch, name); offset += lh.length + name.length + body.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}
// A release package shaped like the real one: Saveit/app/... plus the installer files
function releaseZip(version, extra = [], opts = {}) {
  const base = [
    { name: 'Saveit/', data: '' }, { name: 'Saveit/app/', data: '' },
    { name: 'Saveit/app/package.json', data: JSON.stringify({ name: 'saveit', productName: 'Saveit', version: opts.pkgVersion || version, main: 'main.js' }) },
    { name: 'Saveit/app/main.js', data: opts.mainJs || '// test main\n' }, { name: 'Saveit/app/preload.js', data: '// test\n' }, { name: 'Saveit/app/index.html', data: '<html></html>\n' },
    { name: 'Saveit/Install.cmd', data: '@echo off\n' }, { name: 'Saveit/uninstall.ps1', data: '# test\n' },
  ];
  return makeZip(opts.omitMain ? base.filter(e => e.name !== 'Saveit/app/main.js').concat(extra) : base.concat(extra));
}
module.exports = { makeZip, releaseZip, crc32 };
