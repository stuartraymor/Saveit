// 10.3.10 voice effects. Build and serve tests/build-harness.js first; no real media or profile is used.
// node tests/voice-effects-tests.cjs http://127.0.0.1:8944
// Input tones are played at -6 dBFS (a typical speech peak level) unless a check says otherwise.
// Every check renders real audio offline through the same graph used for playback and saving, then measures it.
const { chromium } = require('playwright'), assert = require('assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.SAVEIT_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), results = [], errors = []; page.on('pageerror', e => errors.push(e.stack)); page.setDefaultTimeout(90000);
  await page.goto(process.argv[2] || 'http://127.0.0.1:8944'); await page.waitForFunction(() => window.__T?.addAudio && document.body.dataset.catalogCount);
  const ev = (fn, a) => page.evaluate(fn, a), test = async (name, fn) => { try { await fn(); results.push(1); console.log('PASS', name); } catch (e) { results.push(0); console.log('FAIL', name, e.message); } };
  await ev(() => {
    // measurement helpers: pitch by autocorrelation, level, clicks
    window.VQ = {
      pitch(buf, t0, t1) { const d = buf.getChannelData(0), sr = buf.sampleRate, a = Math.floor(t0 * sr), n = Math.floor((t1 - t0) * sr); let best = 0, lag = 0; for (let L = Math.floor(sr / 1200); L < sr / 60; L++) { let s = 0, e1 = 0, e2 = 0; for (let i = 0; i < n - L; i += 2) { s += d[a + i] * d[a + i + L]; e1 += d[a + i] ** 2; e2 += d[a + i + L] ** 2; } const r = s / Math.sqrt(e1 * e2 + 1e-12); if (r > best + 1e-9) { best = r; lag = L; } if (best > 0.9 && r < best - 0.3) break; }
        // parabolic refinement
        const at = L => { let s = 0; for (let i = 0; i < n - L; i += 2) s += d[a + i] * d[a + i + L]; return s; }; const y0 = at(lag - 1), y1 = at(lag), y2 = at(lag + 1), off = (y0 - y2) / (2 * (y0 - 2 * y1 + y2) || 1); return sr / (lag + off); },
      rms(buf, t0 = 0, t1 = buf.duration) { let s = 0, n = 0; for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = Math.floor(t0 * buf.sampleRate); i < Math.min(d.length, t1 * buf.sampleRate); i++) { s += d[i] * d[i]; n++; } } return Math.sqrt(s / Math.max(1, n)); },
      peak(buf) { let p = 0; for (let ch = 0; ch < buf.numberOfChannels; ch++) for (const v of buf.getChannelData(ch)) { if (!Number.isFinite(v)) return Infinity; p = Math.max(p, Math.abs(v)); } return p; },
      jump(buf, t, w = 0.03) { const d = buf.getChannelData(0), sr = buf.sampleRate; let m = 0; for (let i = Math.floor((t - w) * sr); i < (t + w) * sr; i++) m = Math.max(m, Math.abs(d[i] - d[i - 1])); return m; },
      band(buf, hz, t0, t1) { const d = buf.getChannelData(0), sr = buf.sampleRate; let re = 0, im = 0; for (let i = Math.floor(t0 * sr); i < t1 * sr; i++) { re += d[i] * Math.cos(2 * Math.PI * hz * i / sr); im += d[i] * Math.sin(2 * Math.PI * hz * i / sr); } return Math.hypot(re, im) / ((t1 - t0) * sr); },
      async item(freqs, sec) { document.querySelectorAll('.modal').forEach(m => m.remove()); const it = __T.addAudio([{ name: 'Voice', blob: await QA.toneWav(freqs, sec), vol: 1, mute: false, solo: false }], 'Voice test'); await QA.until(() => __T.S.cur === it && __T.audio?.getProject?.()); await __T.audio.ready; return it; },
      async render(it, effects, opts = {}) { const p = AudioProject.ensure(it, await AEdit.buffers(it)), c = p.clips[0]; c.gain = opts.gain ?? 0.5; c.effects = effects.map(([type, s, a = 0, b = c.b - c.a]) => ({ ...AudioProject.effect(type, a, b), ...s })); p.tails = !!opts.tails; AudioProject.validate(p, await AEdit.buffers(it), it.tracks); return AudioEngine.mix(it); }
    };
  });
  const near = (v, w, t, m = '') => assert.ok(Math.abs(v - w) <= t, `${m} ${v} vs ${w}`);
  const ALL = ['voiceDeep', 'voiceHigh', 'voiceRobot', 'voiceRadio', 'voiceEcho', 'voiceReverb'];

  await test('Six voice effects are registered with names, defaults, ranges, Mix and the Audio editor', async () => {
    const r = await ev(() => VoiceFX.list().map(d => ({ id: d.id, name: d.name, params: d.params.map(p => p[0]), inDefs: !!AudioFX.defs[d.id], defaults: VoiceFX.defaults(d.id) })));
    assert.deepEqual(r.map(d => d.id), ALL);
    for (const d of r) { assert.ok(d.inDefs, d.id); assert.ok(d.params.includes('mix'), d.id); for (const v of Object.values(d.defaults)) assert.ok(Number.isFinite(v), d.id); }
    assert.deepEqual(r.map(d => d.name), ['Deep Voice', 'High Pitch', 'Robot', 'Radio / Telephone', 'Echo', 'Reverb']);
  });
  await test('Deep Voice lowers pitch by the chosen semitones without changing length', async () => {
    const r = await ev(async () => { const it = await VQ.item([440], 2), dry = await VQ.render(it, []), a = await VQ.render(it, [['voiceDeep', { semitones: -5, warmthDb: 0 }]]), b = await VQ.render(it, [['voiceDeep', { semitones: -12, warmthDb: 3 }]]); return { dry: VQ.pitch(dry, .5, 1.5), a: VQ.pitch(a, .5, 1.5), b: VQ.pitch(b, .5, 1.5), len: [dry.duration, a.duration, b.duration], peak: Math.max(VQ.peak(a), VQ.peak(b)) }; });
    near(r.dry, 440, 3, 'dry'); near(r.a, 440 * 2 ** (-5 / 12), 7, '-5 st'); near(r.b, 220, 5, '-12 st'); assert.ok(Math.abs(r.len[1] - r.len[0]) < 1e-3 && Math.abs(r.len[2] - r.len[0]) < 1e-3, JSON.stringify(r.len)); assert.ok(r.peak <= 1, 'peak ' + r.peak);
  });
  await test('High Pitch raises pitch without speeding up', async () => {
    const r = await ev(async () => { const it = await VQ.item([300], 2), dry = await VQ.render(it, []), a = await VQ.render(it, [['voiceHigh', { semitones: 7 }]]); return { p: VQ.pitch(a, .5, 1.5), len: [dry.duration, a.duration] }; });
    near(r.p, 300 * 2 ** (7 / 12), 8, '+7 st'); near(r.len[1], r.len[0], 1e-3, 'length');
  });
  await test('Every effect: same length, no clipping or invalid samples, sensible level', async () => {
    const r = await ev(async types => { const it = await VQ.item([220, 330, 440], 1), dry = await VQ.render(it, []), out = {}; for (const t of types) { const b = await VQ.render(it, [[t, {}]]); out[t] = { len: b.duration - dry.duration, peak: VQ.peak(b), level: VQ.rms(b, .2, 2.8) / VQ.rms(dry, .2, 2.8) }; } return out; }, ALL);
    for (const [t, v] of Object.entries(r)) { assert.ok(Math.abs(v.len) < 1e-3, t + ' length ' + v.len); assert.ok(v.peak <= 1, t + ' peak ' + v.peak); assert.ok(v.level > .3 && v.level < 2, t + ' level ' + v.level.toFixed(2)); }
  });
  await test('Robot and Radio really change the sound (not just volume)', async () => {
    const r = await ev(async () => { const it = await VQ.item([150, 1000], 1.5), dry = await VQ.render(it, []), radio = await VQ.render(it, [['voiceRadio', { drive: 0 }]]), robot = await VQ.render(it, [['voiceRobot', { intensity: 100, ringHz: 90, metallic: 0 }]]);
      return { lowDry: VQ.band(dry, 150, .3, 1.2), lowRadio: VQ.band(radio, 150, .3, 1.2), midDry: VQ.band(dry, 1000, 1.8, 2.7), midRadio: VQ.band(radio, 1000, 1.8, 2.7), robot1000: VQ.band(robot, 1000, 1.8, 2.7), robotSide: VQ.band(robot, 1090, 1.8, 2.7) }; });
    assert.ok(r.lowRadio < r.lowDry * 0.25, 'radio removes 150 Hz ' + JSON.stringify(r)); assert.ok(r.midRadio > r.midDry * 0.35, 'radio keeps 1 kHz ' + JSON.stringify(r));
    assert.ok(r.robot1000 < r.robotSide * 1.2 && r.robotSide > 0.05, 'robot makes side tones ' + JSON.stringify(r));
  });
  await test('Effect on part of a clip: outside unchanged, no clicks at the edges', async () => {
    const r = await ev(async () => { const it = await VQ.item([440], 3), dry = await VQ.render(it, []), b = await VQ.render(it, [['voiceDeep', { semitones: -5, warmthDb: 0 }, 1, 2]]);
      let diff = 0; const d0 = dry.getChannelData(0), d1 = b.getChannelData(0); for (let i = 0; i < .9 * dry.sampleRate; i++) diff = Math.max(diff, Math.abs(d0[i] - d1[i]));
      return { before: VQ.pitch(b, .3, .9), inside: VQ.pitch(b, 1.2, 1.8), after: VQ.pitch(b, 2.2, 2.9), diff, j1: VQ.jump(b, 1), j2: VQ.jump(b, 2), jd: VQ.jump(dry, 1.5) }; });
    near(r.before, 440, 3, 'before'); near(r.after, 440, 3, 'after'); near(r.inside, 329.6, 7, 'inside'); assert.ok(r.diff < 1e-4, 'untouched before the range ' + r.diff); assert.ok(r.j1 < r.jd * 2.5 && r.j2 < r.jd * 2.5, 'click ' + JSON.stringify(r));
  });
  await test('Echo and Reverb ring out after the voice stops when tails are included', async () => {
    const r = await ev(async () => { const it = await VQ.item([440], 1), e = await VQ.render(it, [['voiceEcho', { echoDelayMs: 250, echoFeedback: 50, mix: 50 }]], { tails: true }), v = await VQ.render(it, [['voiceReverb', { roomDecay: 2, mix: 50 }]], { tails: true }), dry = await VQ.render(it, [], { tails: true });
      return { echoLen: e.duration, echoTail: VQ.rms(e, 1.05, 1.6), revLen: v.duration, revTail: VQ.rms(v, 1.05, 1.6), dryLen: dry.duration, peaks: [VQ.peak(e), VQ.peak(v)] }; });
    assert.ok(r.echoLen > 1.5 && r.revLen > 2, JSON.stringify(r)); assert.ok(r.echoTail > 0.01 && r.revTail > 0.005, JSON.stringify(r)); assert.ok(r.peaks.every(p => p <= 1), JSON.stringify(r));
  });
  await test('Bypass restores the original voice; Mix 0 is the original; settings survive saving the project', async () => {
    const r = await ev(async () => { const it = await VQ.item([440], 1.5), dry = await VQ.render(it, []), off = await VQ.render(it, [['voiceRobot', { bypass: true }]]), m0 = await VQ.render(it, [['voiceHigh', { mix: 0 }]]);
      const cmp = (a, b) => { let m = 0; const x = a.getChannelData(0), y = b.getChannelData(0); for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i] - y[i])); return m; };
      const p = it.audioProject, saved = JSON.parse(JSON.stringify(p)); AudioProject.validate(saved, await AEdit.buffers(it), it.tracks);
      return { off: cmp(dry, off), m0: cmp(dry, m0), kept: saved.clips[0].effects[0].type, mix: saved.clips[0].effects[0].mix }; });
    assert.ok(r.off < 1e-4, 'bypass ' + r.off); assert.ok(r.m0 < 0.02, 'mix 0 ' + r.m0); assert.equal(r.kept, 'voiceHigh'); assert.equal(r.mix, 0);
  });
  await test('Different clips can have different voices; trimming a processed clip keeps the effect', async () => {
    const r = await ev(async () => { const it = await VQ.item([400], 3), bufs = await AEdit.buffers(it), p = AudioProject.ensure(it, bufs);
      AudioProject.split(p, new Set([p.clips[0].id]), 1.5); const [a, b] = p.clips.sort((x, y) => x.start - y.start);
      a.effects = [AudioProject.effect('voiceHigh', 0, a.b - a.a)]; Object.assign(a.effects[0], { semitones: 12 }); b.effects = [AudioProject.effect('voiceDeep', 0, b.b - b.a)]; Object.assign(b.effects[0], { semitones: -12, warmthDb: 0 });
      AudioProject.trim(b, b.a + .2, b.b); AudioProject.validate(p, bufs, it.tracks); const out = await AudioEngine.mix(it);
      return { first: VQ.pitch(out, .3, 1.2), second: VQ.pitch(out, 2, 2.8), fx: b.effects.length }; });
    near(r.first, 800, 12, 'first clip'); near(r.second, 200, 5, 'second clip'); assert.equal(r.fx, 1);
  });
  await test('Audio editor: Voice effects palette adds an effect, Preview plays it, sliders and Reset work', async () => {
    await ev(async () => { await VQ.item([440], 2); });
    await page.locator('.a94 [data-addfx114="voiceDeep"]').first().click();
    const r = await ev(async () => { await QA.until(() => __T.audio.playing, 5000).catch(() => {}); const playing = __T.audio.playing, p = __T.audio.getProject(), all = [p, ...p.tracks, ...p.clips].flatMap(o => o.effects); return { playing, types: all.map(f => f.type), preview: !!document.querySelector('.a94 [data-i="fxpreview"]'), sliders: document.querySelectorAll('.a94 [data-fxslide]').length }; });
    assert.ok(r.types.includes('voiceDeep'), JSON.stringify(r)); assert.ok(r.preview, 'Preview button'); assert.ok(r.playing, 'adding starts a preview'); assert.equal(r.sliders, 3);
    await page.locator('.a94 [data-i="fxpreview"]').first().click();
    const s = page.locator('.a94 .a94insp [data-fxnumber="semitones"], .a94 [data-fxnumber="semitones"]').first(); await s.fill('-9'); await s.dispatchEvent('input'); await s.dispatchEvent('change');
    const v1 = await ev(() => { const p = __T.audio.getProject(); return [p, ...p.tracks, ...p.clips].flatMap(o => o.effects).find(f => f.type === 'voiceDeep').semitones; });
    assert.equal(v1, -9);
    await page.locator('.a94 [data-i="fxreset"]').first().click();
    const v2 = await ev(() => { const p = __T.audio.getProject(); return [p, ...p.tracks, ...p.clips].flatMap(o => o.effects).find(f => f.type === 'voiceDeep').semitones; });
    assert.equal(v2, -5);
  });
  await test('Video: a voice effect on a clip changes its sound in the exported mix, not its length, and can be turned off', async () => {
    const r = await ev(async () => { await QA.openVideo(3); const ctl = __T.vid._ctl, e = ctl.getProject(), eng = ctl._dbg.eng, T = 3;
      const before = await eng.mixAudio(T, 48000); const c = e.clips[0]; c.fx = { ...VEditCore.defFx(), voice: { type: 'voiceHigh', on: true, semitones: 7, mix: 100 } };
      const after = await eng.mixAudio(T, 48000); c.fx.voice.on = false; const off = await eng.mixAudio(T, 48000);
      return { p0: VQ.pitch(before, .6, 2.2), p1: VQ.pitch(after, .6, 2.2), p2: VQ.pitch(off, .6, 2.2), len: [before.duration, after.duration], peak: VQ.peak(after), edited: ctl._dbg.eng && true }; });
    assert.ok(r.p0 > 100, 'video has a tone ' + r.p0); near(r.p1 / r.p0, 2 ** (7 / 12), .03, 'raised'); near(r.p2, r.p0, r.p0 * .01, 'off = original'); near(r.len[1], r.len[0], 1e-3, 'length'); assert.ok(r.peak <= 1);
  });
  await test('Video: Sound effects pane lists the six voice effects and shows their settings', async () => {
    const r = await ev(async () => { const ctl = __T.vid._ctl, host = document.querySelector('[data-r="vfx"]').closest('.vpane'), sel = document.querySelector('[data-r="vfx"]');
      const opts = [...sel.options].map(o => o.value); sel.value = 'voiceRobot'; sel.dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 200));
      const params = [...document.querySelectorAll('[data-r="vfxparams"] [data-vp]')].map(i => i.dataset.vp), e = ctl.getProject(); const pause = ctl._dbg.eng.playing; ctl._dbg.eng.pause?.();
      return { opts, params, stored: (e.master.voice || {}).type, on: document.querySelector('[data-r="vfxon"]').checked, pause }; });
    assert.deepEqual(r.opts, ['', ...ALL]); assert.deepEqual(r.params, ['intensity', 'ringHz', 'metallic', 'mix']); assert.equal(r.stored, 'voiceRobot'); assert.ok(r.on);
  });
  console.log(JSON.stringify({ passed: results.filter(Boolean).length, failed: results.filter(x => !x).length, errors }));
  await browser.close(); process.exit(results.includes(0) || errors.length ? 1 : 0);
})();
