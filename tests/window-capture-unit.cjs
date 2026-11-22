// Window capture (app/window-capture.js). 10.5.3: the picture is read by saveit-window-bounds.exe from the window itself.
// Before, Electron's window thumbnail was asked for at the visible frame size; the thumbnail is the whole window rectangle
// (invisible resize borders included) scaled to fit, so it matched only for borderless windows and every other window
// failed with "The window changed size during capture".
const assert = require('assert/strict');
const { EventEmitter } = require('events');
const { captureWindow, readWindow, windowBounds, handleOf, WHY } = require('../app/window-capture.js');
const id = 'window:123:0';
// a stand-in for the helper process: sends `chunks`, then exits with `code`
function fakeHelper(chunks, code, seen) {
  return (exe, args) => { if (seen) seen.push(args); const child = new EventEmitter(); child.stdout = new EventEmitter(); child.kill = () => {};
    setImmediate(() => { for (const c of chunks) child.stdout.emit('data', c); child.emit('close', code); }); return child; };
}
function picture(width, height, method = 1) {
  const head = Buffer.alloc(16); head.write('SVWC', 0, 'latin1'); head.writeInt32LE(width, 4); head.writeInt32LE(height, 8); head.writeInt32LE(method, 12);
  const body = Buffer.alloc(width * height * 4); for (let i = 0; i < body.length; i++) body[i] = i % 251;
  return { head, body };
}
(async () => {
  // the picture comes back at exactly the size the helper reports (odd sizes too), in pieces of any size
  { const { head, body } = picture(285, 171), seen = [];
    const shot = await readWindow('123', fakeHelper([head.subarray(0, 7), Buffer.concat([head.subarray(7), body.subarray(0, 1000)]), body.subarray(1000)], 0, seen));
    assert.deepEqual([shot.width, shot.height, shot.method], [285, 171, 'window']); assert.equal(Buffer.compare(shot.data, body), 0); assert.deepEqual(seen[0], ['grab', '123']);
    console.log('PASS the window picture arrives whole at its exact odd size'); }
  // captureWindow hands the pixels to the image maker and says how the picture was read
  { const made = []; const image = await captureWindow((data, size) => { made.push(size); return { data }; }, id, async hwnd => ({ data: Buffer.alloc(8), width: 2, height: 1, method: 'screen', hwnd }));
    assert.deepEqual(made[0], { width: 2, height: 1 }); assert.equal(image.captureMethod, 'screen');
    console.log('PASS the image is built from the helper picture'); }
  // every way the helper can fail gives its own explanation, never a bare "Capture failed"
  for (const code of [3, 4, 5, 6, 7]) await assert.rejects(readWindow('123', fakeHelper([], code)), e => e.message === WHY[code] && e.message.length > 20);
  await assert.rejects(readWindow('123', fakeHelper([], 99)), /helper code 99/);
  console.log('PASS a closed, unreadable, empty or minimized window is explained');
  // a cut-off or damaged answer is refused
  { const { head, body } = picture(40, 30);
    await assert.rejects(readWindow('123', fakeHelper([head, body.subarray(0, 100)], 0)), /incomplete/);
    await assert.rejects(readWindow('123', fakeHelper([Buffer.from('nonsense that is long enough')], 0)), /no picture/);
    await assert.rejects(readWindow('123', fakeHelper([], 0)), /no picture/);
    await assert.rejects(readWindow('123', () => { throw new Error('ENOENT'); }), /could not start/);
    console.log('PASS damaged or missing helper answers are refused'); }
  // window ids
  assert.equal(handleOf('window:66834:0'), '66834'); assert.equal(handleOf('screen:1:0'), null); assert.equal(handleOf('window:0:0'), null); assert.equal(handleOf('window:1;bad:0'), null);
  await assert.rejects(captureWindow(() => ({}), 'screen:123:0'), /no longer available/);
  await assert.rejects(windowBounds('screen:123:0'), /measured/);
  await assert.rejects(windowBounds('window:1;bad:0'), /measured/);
  await assert.rejects(windowBounds('window:0:0'), /measured/);
  console.log('PASS invalid window ids fail safely');
  // the real helper: a handle that is not a window is reported as closed
  if (process.platform === 'win32') { await assert.rejects(readWindow('3'), e => e.message === WHY[3]); console.log('PASS the real helper reports a window that does not exist'); }
})().catch(error => { console.error(error); process.exitCode = 1; });
