// Window capture on Windows. 10.5.3: the picture is read by saveit-window-bounds.exe from the window itself, at the exact
// size of its visible frame. (Before, Electron's window thumbnail was asked for at that size; the thumbnail is the whole
// window rectangle, invisible resize borders included, scaled to fit, so it only ever matched for borderless windows
// and every other window failed with "The window changed size during capture".)
const { execFile, spawn } = require('child_process');
const path = require('path');
const helper = () => path.join(__dirname, 'saveit-window-bounds.exe');
const boundsError = () => new Error('That window could not be measured. Restore it and try capturing again.');
const handleOf = id => { const match = /^window:(\d+):\d+$/.exec(String(id)); return match && match[1] !== '0' ? match[1] : null; };
function windowBounds(id) {
  const hwnd = handleOf(id);
  if (!hwnd) return Promise.reject(boundsError());
  return new Promise((resolve, reject) => {
    execFile(helper(), [hwnd], { windowsHide: true, timeout: 5000, maxBuffer: 4096 }, (error, stdout) => {
      if (error) return reject(boundsError());
      try {
        const size = JSON.parse(stdout);
        if (![size.width, size.height].every(n => Number.isInteger(n) && n > 0 && n <= 32768)) throw boundsError();
        resolve(size);
      } catch (_) { reject(boundsError()); }
    });
  });
}
// Why a capture did not happen, in words that say what to do next (the helper's exit codes).
const WHY = {
  3: 'That window closed before it could be captured.',
  4: 'Windows would not give the size of that window. Capture it with Region instead.',
  5: 'That window has no visible area to capture.',
  6: 'That window does not let other programs read its picture, and Windows would not bring it to the front. Click the window, then capture it with Region.',
  7: 'That window is minimized and could not be restored. Restore it and capture again.'
};
const METHODS = { 1: 'window', 2: 'screen' };
// Runs the helper and returns { data (BGRA), width, height, method }.
function readWindow(hwnd, run = spawn) {
  return new Promise((resolve, reject) => {
    let child, parts = [], got = 0, done = false, timer = null;
    const fail = message => { if (done) return; done = true; clearTimeout(timer); try { child && child.kill(); } catch (_) {} reject(new Error(message)); };
    try { child = run(helper(), ['grab', hwnd], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { fail('The window capture helper could not start: ' + e.message); return; }
    timer = setTimeout(() => fail('That window did not answer in time. Try again, or capture it with Region.'), 15000);
    child.on('error', e => fail('The window capture helper could not start: ' + e.message));
    child.stdout.on('data', d => { parts.push(d); got += d.length; if (got > 16 + 32768 * 32768 * 4) fail('That window is too large to capture.'); });
    child.on('close', code => {
      if (done) return;
      if (code !== 0) return fail(WHY[code] || 'The window could not be captured (helper code ' + code + ').');
      const all = Buffer.concat(parts);
      if (all.length < 16 || all.toString('latin1', 0, 4) !== 'SVWC') return fail('The window capture helper sent no picture.');
      const width = all.readInt32LE(4), height = all.readInt32LE(8), method = METHODS[all.readInt32LE(12)] || 'window';
      if (!(width > 0 && height > 0 && width <= 32768 && height <= 32768) || all.length !== 16 + width * height * 4) return fail('The window capture helper sent an incomplete picture.');
      done = true; clearTimeout(timer); resolve({ data: all.subarray(16), width, height, method });
    });
  });
}
// Returns a nativeImage of the window's visible frame. `make` builds the image (nativeImage.createFromBitmap).
async function captureWindow(make, id, read = readWindow) {
  const hwnd = handleOf(id);
  if (!hwnd) throw new Error('That window is no longer available to capture.');
  const shot = await read(hwnd);
  const image = make(shot.data, { width: shot.width, height: shot.height });
  image.captureMethod = shot.method;
  return image;
}
module.exports = { windowBounds, captureWindow, readWindow, handleOf, WHY };
