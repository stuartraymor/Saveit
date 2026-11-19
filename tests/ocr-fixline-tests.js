// Grab Text text clean-up (main.js ocrFixLine / ocrFixCode / ocrColumns / ocrRows / ocrBlocks). Plain Node, no Electron.
// node tests/ocr-fixline-tests.js
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'main.js'), 'utf8');
const pick = n => { const i = src.indexOf('function ' + n + '('); assert.ok(i >= 0, n + ' not found'); let d = 0, j = src.indexOf('{', i); for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && !--d) break; } return src.slice(i, j + 1); };
const { ocrFixLine, ocrJoinRow35, ocrColumns, ocrRows, ocrBlocks } = new Function(['ocrFixMore', 'ocrFixCode', 'ocrFixLine', 'ocrJoinRow35', 'ocrColumns', 'ocrRows', 'ocrBlocks'].map(pick).join('\n') + '\nreturn{ocrFixLine,ocrJoinRow35,ocrColumns,ocrRows,ocrBlocks}')();
let n = 0; const eq = (input, want) => { assert.equal(ocrFixLine(input), want, JSON.stringify(input)); n++; };
// money
eq('INV-2041 Northwind Traders 2026-11-03 s 1,284.50', 'INV-2041 Northwind Traders 2026-11-03 $1,284.50');
eq('Total Sl,2S4.50', 'Total $1,254.50'); eq('s 12,005.75', '$12,005.75'); eq('S96.00', '$96.00');
eq('Sales 2026 rose', 'Sales 2026 rose'); eq('is 3.50 ok', 'is 3.50 ok'); eq('items 1,284.50', 'items 1,284.50');
// web addresses, ids, hex
eq('fetch(" https : / / api . example . com/v2/orders ? id=1048 ");', 'fetch("https://api.example.com/v2/orders?id=1048");');
eq('Read https://a.com and more. Done', 'Read https://a.com and more. Done');
eq('Ticket ID: 7F3A-91C2-OB8E', 'Ticket ID: 7F3A-91C2-0B8E'); eq('Ticket ID: 7F3A-91 C2-OB8E', 'Ticket ID: 7F3A-91C2-0B8E');
eq('Error 0x8O070005', 'Error 0x80070005'); eq('COFFEE-DEAD', 'COFFEE-DEAD');
eq('Call 555-0199 or 555-0100 now', 'Call 555-0199 or 555-0100 now'); eq('Rooms 12-14 B 22-24', 'Rooms 12-14 B 22-24');
eq('Dates 2026-11-03 to 2026-11-07', 'Dates 2026-11-03 to 2026-11-07');
eq('A- 1009\tUSB-C cable', 'A-1009\tUSB-C cable'); eq('INV- 2041 paid', 'INV-2041 paid'); eq('a well- 20 b', 'a well- 20 b');
// code
eq('if (total > 100) { console. log("x"); }', 'if (total > 100) { console.log("x"); }');
eq('const total = items. reduce( (a, b)\ta + b. price, 0);', 'const total = items.reduce((a, b) a + b.price, 0);');
eq('He said (see page 4) and left.', 'He said (see page 4) and left.');
eq('Version 4.12.0 (build 8817)', 'Version 4.12.0 (build 8817)');
// rows, columns and blocks
const W = (text, x, y, w, h = 10) => ({ text, rect: { x, y, w, h } });
const table = [[W('Invoice', 0, 0, 40), W('Customer', 60, 0, 50), W('Amount', 140, 0, 40)], [W('INV-1', 0, 20, 30), W('Northwind', 60, 20, 45), W('Traders', 108, 20, 24), W('$1.00', 140, 20, 30)],
  [W('INV-2', 0, 40, 30), W('Contoso', 60, 40, 40), W('$2.00', 140, 40, 30)], [W('INV-3', 0, 60, 30), W('Fabrikam', 60, 60, 44), W('$3.00', 140, 60, 30)]];
const rows = ocrRows(table.flat()), cols = ocrColumns(rows);
assert.deepEqual(rows.map(r => ocrJoinRow35([...r.words].sort((a, b) => a.rect.x - b.rect.x), cols)), ['Invoice\tCustomer\tAmount', 'INV-1\tNorthwind Traders\t$1.00', 'INV-2\tContoso\t$2.00', 'INV-3\tFabrikam\t$3.00']); n++;
// a quote mark above the middle of a line stays on that line
assert.equal(ocrRows([W('log(', 0, 10, 30, 14), W('"', 32, 9, 4, 5), W('Free', 40, 10, 30, 14)]).length, 1); n++;
// 10.4.1 rules from the 500-picture stress test
eq('-S966.85', '-$966.85'); eq('E70,441.53', '£70,441.53'); eq('El,596.78', '£1,596.78'); eq('-$999-39', '-$999.39'); eq('3:18-3', '3:18.3');
eq('6:41 .9', '6:41.9'); eq('9: 35.5', '9:35.5'); eq('Sep 3 , 2019', 'Sep 3, 2019'); eq('86.2 oc', '86.2 °C'); eq('56.8 OC', '56.8 °C');
eq('500/0 off!', '50% off!'); eq('Feb 19, 2ø27', 'Feb 19, 2027'); eq('INV-9S904', 'INV-95904'); eq('npm install —save-dev', 'npm install --save-dev');
eq('—/Downloads/invoice-2026.pdf', '~/Downloads/invoice-2026.pdf'); eq('—$ sudo apt update', '~$ sudo apt update'); eq('a.b—c@contoso.org', 'a.b_c@contoso.org');
eq('https://www.example.corn/help', 'https://www.example.com/help'); eq('OxlCA62704', '0x1CA62704');
// ...and ordinary text is left alone
eq('Note: 35 items', 'Note: 35 items'); eq('Score 3: 25 points', 'Score 3: 25 points'); eq('Pages 10-12', 'Pages 10-12'); eq('Elsewhere 1,000.00', 'Elsewhere 1,000.00');
eq('He said — sure', 'He said — sure'); eq('Ox 1234', 'Ox 1234'); eq('Sales -S team', 'Sales -S team'); eq('the corn field', 'the corn field'); eq('Model 3S', 'Model 3S');
// a sidebar beside a page whose lines do not line up is read column by column; a table is not split
const side = [W('Dashboard', 0, 10, 60), W('Projects', 0, 36, 50), W('Reports', 0, 62, 48), W('Welcome', 120, 0, 60), W('You', 120, 26, 20), W('Next', 120, 52, 30)];
assert.deepEqual(ocrBlocks(side).map(b => b.map(w => w.text)), [['Dashboard', 'Projects', 'Reports'], ['Welcome', 'You', 'Next']]); n++;
assert.equal(ocrBlocks(table.flat()).length, 1); n++;
console.log(`PASS ocr-fixline-tests (${n} checks)`);
