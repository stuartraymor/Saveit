// 10.3.10 voice effects on real speech (Windows text-to-speech, not a tone). Build and serve the harness first.
// node tests/voice-speech-check.cjs http://127.0.0.1:8944 <speech.wav> <evidence-dir>
// Each effect is rendered offline through the same graph used for playback and saving. Checks: same length as the
// original (no speed change), no clipping, no NaN, no new clicks, and for Deep / High the measured voice pitch moves
// by about the chosen semitones. The rendered WAVs are written to the evidence folder for listening.
const { chromium } = require('playwright'), assert = require('assert/strict'), fs = require('fs'), path = require('path');
(async () => {
  const [url, wav, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.SAVEIT_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const page = await browser.newPage(); page.setDefaultTimeout(120000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(url); await page.waitForFunction(() => window.__T?.addAudio && document.body.dataset.catalogCount);
  const b64 = fs.readFileSync(wav).toString('base64');
  const r = await page.evaluate(async b64 => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)), blob = new Blob([bytes], { type: 'audio/wav' });
    document.querySelectorAll('.modal').forEach(m => m.remove());
    const it = __T.addAudio([{ name: 'Speech', blob, vol: 1, mute: false, solo: false }], 'Speech test'); await QA.until(() => __T.S.cur === it && __T.audio?.getProject?.()); await __T.audio.ready;
    const bufs = await AEdit.buffers(it), src = bufs[0], d0 = src.getChannelData(0); let pk = 0; for (const v of d0) pk = Math.max(pk, Math.abs(v));
    const gain = 0.89 / pk; // speech peaks at -1 dBFS, as a loud real recording would
    const render = async (type, s) => { const p = AudioProject.ensure(it, bufs), c = p.clips[0]; c.gain = gain; c.effects = type ? [{ ...AudioProject.effect(type, 0, c.b - c.a), ...s }] : []; p.tails = false; AudioProject.validate(p, bufs, it.tracks); return AudioEngine.mix(it); };
    // voice pitch: median autocorrelation pitch over voiced 40 ms windows (38-420 Hz)
    const pitch = buf => { const d = buf.getChannelData(0), sr = buf.sampleRate, W = Math.floor(sr * 0.04), out = [];
      for (let a = 0; a + W + sr / 60 < d.length; a += W) { let e = 0; for (let i = 0; i < W; i++) e += d[a + i] ** 2; if (Math.sqrt(e / W) < 0.05) continue;
        const rs = []; let best = 0; for (let L = Math.floor(sr / 420); L < sr / 38; L++) { let s = 0, e1 = 0, e2 = 0; for (let i = 0; i < W; i += 2) { s += d[a + i] * d[a + i + L]; e1 += d[a + i] ** 2; e2 += d[a + i + L] ** 2; } const r = s / Math.sqrt(e1 * e2 + 1e-12); rs.push([L, r]); best = Math.max(best, r); }
        // the shortest lag that is nearly as good as the best one is the period (longer lags are whole multiples of it)
        let lag = 0; for (let j = 1; j < rs.length - 1; j++) if (rs[j][1] >= 0.92 * best && rs[j][1] >= rs[j - 1][1] && rs[j][1] >= rs[j + 1][1]) { lag = rs[j][0]; break; }
        if (best > 0.75 && lag) out.push(sr / lag); }
      out.sort((x, y) => x - y); return { hz: out[Math.floor(out.length / 2)] || 0, n: out.length }; };
    const stats = buf => { let p = 0, nan = 0, jump = 0; for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i++) { const v = d[i]; if (!Number.isFinite(v)) nan++; else { p = Math.max(p, Math.abs(v)); if (i) jump = Math.max(jump, Math.abs(v - d[i - 1])); } } } return { peak: p, nan, jump, sec: buf.duration }; };
    const res = {}, wavs = {};
    const cases = [['dry', null, {}], ['voiceDeep', 'voiceDeep', {}], ['voiceDeep-12', 'voiceDeep', { semitones: -12 }], ['voiceHigh', 'voiceHigh', {}], ['voiceHigh+12', 'voiceHigh', { semitones: 12 }], ['voiceRobot', 'voiceRobot', {}], ['voiceRadio', 'voiceRadio', {}], ['voiceEcho', 'voiceEcho', {}], ['voiceReverb', 'voiceReverb', {}]];
    for (const [name, type, s] of cases) { const b = await render(type, s); res[name] = { ...stats(b), pitch: /dry|Deep|High/.test(name) ? pitch(b) : null, settings: type ? { ...VoiceFX.defaults(type), ...s } : null };
      const w = await A_wav(b); wavs[name] = w; }
    async function A_wav(b) { const blob = (window.AEdit?.wav || window.AudioExport?.wav || ((x) => null))(b); if (!blob) return null; const ab = await blob.arrayBuffer(); let s = ''; const u = new Uint8Array(ab); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
    return { res, wavs, gain };
  }, b64);
  for (const [k, w] of Object.entries(r.wavs)) if (w) fs.writeFileSync(path.join(out, k + '.wav'), Buffer.from(w, 'base64'));
  const dry = r.res.dry; let fail = 0; const lines = [];
  const check = (name, ok, msg) => { lines.push((ok ? 'PASS ' : 'FAIL ') + name + ' — ' + msg); if (!ok) fail++; };
  for (const [k, v] of Object.entries(r.res)) {
    if (k === 'dry') continue;
    check(k + ' length', Math.abs(v.sec - dry.sec) < 0.002, `${v.sec.toFixed(4)} s vs original ${dry.sec.toFixed(4)} s`);
    check(k + ' level', v.peak <= 1.0 && v.nan === 0, `peak ${(20 * Math.log10(v.peak)).toFixed(2)} dBFS, NaN ${v.nan}`);
    check(k + ' clicks', v.jump <= Math.max(0.6, dry.jump * 1.6), `largest sample step ${v.jump.toFixed(3)} (original ${dry.jump.toFixed(3)})`);
    if (v.pitch) { const st = v.settings.semitones, want = dry.pitch.hz * Math.pow(2, st / 12), got = v.pitch.hz, cents = 1200 * Math.log2(got / want);
      check(k + ' pitch', Math.abs(cents) < 120 && v.pitch.n > 10, `${got.toFixed(1)} Hz, expected ${want.toFixed(1)} Hz (${st} semitones from ${dry.pitch.hz.toFixed(1)} Hz), off by ${cents.toFixed(0)} cents`); }
  }
  lines.push(`original speech ${dry.sec.toFixed(2)} s, voice pitch ${dry.pitch.hz.toFixed(1)} Hz, played at peak -1 dBFS (gain ${r.gain.toFixed(2)})`);
  if (errors.length) { lines.push('page errors: ' + errors.join(' | ')); fail++; }
  console.log(lines.join('\n')); fs.writeFileSync(path.join(out, 'voice-speech-results.txt'), lines.join('\n'));
  console.log(fail ? fail + ' FAILED' : 'ALL VOICE SPEECH CHECKS PASSED'); await browser.close(); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
