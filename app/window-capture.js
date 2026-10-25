const { execFile } = require('child_process');
const path = require('path');
const boundsError = () => new Error('That window could not be measured. Restore it and try capturing again.');
function windowBounds(id) {
  const match = /^window:(\d+):\d+$/.exec(id);
  if (!match) return Promise.reject(boundsError());
  return new Promise((resolve, reject) => {
    execFile(path.join(__dirname, 'saveit-window-bounds.exe'), [match[1]], { windowsHide: true, timeout: 5000, maxBuffer: 4096 }, (error, stdout) => {
      if (error) return reject(boundsError());
      try {
        const size = JSON.parse(stdout);
        if (![size.width, size.height].every(n => Number.isInteger(n) && n > 0 && n <= 32768)) throw boundsError();
        resolve(size);
      } catch (_) { reject(boundsError()); }
    });
  });
}
async function captureWindow(desktopCapturer, id, measure = windowBounds) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = await measure(id);
    const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: before });
    const source = sources.find(s => s.id === id);
    if (!source || source.thumbnail.isEmpty()) throw new Error('That window closed or is no longer available to capture.');
    const after = await measure(id), size = source.thumbnail.getSize();
    if (before.width === after.width && before.height === after.height && size.width === after.width && size.height === after.height) return source.thumbnail;
  }
  throw new Error('The window changed size during capture. Stop resizing it and try again.');
}
module.exports = { windowBounds, captureWindow };
