// 10.5.3: run an older real-app test on one display without touching the screen the owner is working on:
//   set NODE_OPTIONS=--require=<repo>\tests\side-display-hook.cjs   (and optionally SAVEIT_TEST_DISPLAY, see native-driver.cjs)
// It wraps Playwright's Electron launch: every Saveit window is kept on the chosen display and Saveit is told the pointer
// is there. Tests that move the real mouse (native-steps-helper --live) are not helped by this.
'use strict';
const Module = require('module'), load = Module._load;
Module._load = function (request) {
  const m = load.apply(this, arguments);
  if (request === 'playwright' && m && m._electron && !m._electron.__side) {
    const launch = m._electron.launch.bind(m._electron);
    m._electron.launch = async opts => {
      const app = await launch(opts);
      try {
        await app.evaluate(({ screen, BrowserWindow, app }, want) => {
          const ds = screen.getAllDisplays(), area = d => d.bounds.width * d.bounds.height;
          const d = want === 'primary' ? screen.getPrimaryDisplay() : /^\d+$/.test(want) ? ds[+want] || ds[0] : ds.slice().sort((a, b) => area(a) - area(b))[0];
          const wa = d.workArea, real = screen.getCursorScreenPoint.bind(screen), realNear = screen.getDisplayNearestPoint.bind(screen);
          const inD = p => p.x >= d.bounds.x && p.x < d.bounds.x + d.bounds.width && p.y >= d.bounds.y && p.y < d.bounds.y + d.bounds.height;
          screen.getCursorScreenPoint = () => { const p = real(); return inD(p) ? p : { x: wa.x + Math.round(wa.width / 2), y: wa.y + Math.round(wa.height / 2) }; };
          const inside = b => b.x >= d.bounds.x - 8 && b.x < d.bounds.x + d.bounds.width && b.y >= d.bounds.y - 8 && b.y < d.bounds.y + d.bounds.height;
          const fix = w => { try { if (w.isDestroyed()) return; const b = w.getBounds(); if (inside(b)) return; w.setBounds({ x: wa.x + 10, y: wa.y + 10, width: Math.min(b.width, wa.width - 20), height: Math.min(b.height, wa.height - 20) }); } catch (_) {} };
          const hook = w => { fix(w); w.on('show', () => fix(w)); };
          BrowserWindow.getAllWindows().forEach(hook); app.on('browser-window-created', (e, w) => { hook(w); setTimeout(() => fix(w), 0); });
          void realNear;
        }, process.env.SAVEIT_TEST_DISPLAY || 'small');
      } catch (_) {}
      return app;
    };
    m._electron.__side = true;
  }
  return m;
};
