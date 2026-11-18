// 10.3.10: Voice effects. One registry used by the Audio editor (clip, track and master effect racks) and
// the Video editor (a clip's sound or the whole video), for both live preview and file export, so what
// you hear while editing is what gets saved. Effects never change the original recording: they are
// settings stored in the project and applied while playing or exporting.
//
// Adding an effect: call VoiceFX.register({id, name, short, color, hint, params, build, tail?, worklet?}).
//   params: [key, label, min, max, step, default, unit]. Every effect has 'mix' (wet/dry, percent).
//   build(ctx, settings) returns {input, output, update(settings), dispose()} producing the WET signal only;
//   the caller blends it with the dry signal using mix, so a range can fade in and out without clicks.
//   tail(settings) = seconds the effect keeps sounding after its input stops (echo, reverb).
//   worklet: true when build needs voice-worklet.js loaded in that context first (VoiceFX.prepare).
(function (root) {
  'use strict';
  const reg = new Map(), order = [];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v, d) => Number.isFinite(+v) ? +v : d;
  const smooth = (ctx, param, v) => { const off = typeof ctx.startRendering === 'function'; if (off) { param.value = v; return; } try { param.setTargetAtTime(v, ctx.currentTime, 0.015); } catch (_) { param.value = v; } };
  const MIX = ['mix', 'Wet / dry mix', 0, 100, 1, 100, '%'];

  function register(def) {
    if (!def || !def.id || reg.has(def.id) || typeof def.build !== 'function') throw Error('Invalid voice effect definition.');
    if (!def.params.some(p => p[0] === 'mix')) def.params.push(MIX.slice());
    reg.set(def.id, def); order.push(def.id);
    // The Audio editor's effect rack, validation and project files use AudioFX.defs.
    if (root.AudioFX && root.AudioFX.defs) root.AudioFX.defs[def.id] = { name: def.name, short: def.short, color: def.color, hint: def.hint, params: def.params, voice: true };
  }
  const has = type => reg.has(type);
  const list = () => order.map(id => reg.get(id));
  function defaults(type) { const d = reg.get(type); return d ? Object.fromEntries(d.params.map(p => [p[0], p[5]])) : {}; }
  function settings(f) { const d = reg.get(f.type), out = {}; for (const [k, , min, max, , def] of d.params) out[k] = clamp(num(f[k], def), min, max); return out; }
  const mixOf = f => clamp(num(f.mix, 100), 0, 100) / 100;
  function tail(f) { const d = reg.get(f.type); return d && d.tail ? d.tail(settings(f)) : 0; }
  const ringsOut = type => !!(reg.get(type) && reg.get(type).tail);
  const needsWorklet = type => !!(reg.get(type) && reg.get(type).worklet);
  const loaded = new WeakMap();
  // Load the pitch worklet into this audio context once. Safe to call repeatedly.
  function prepare(ctx) {
    if (!ctx.audioWorklet) return Promise.reject(Error('Pitch effects need a newer audio engine than this one.'));
    if (!loaded.has(ctx)) loaded.set(ctx, ctx.audioWorklet.addModule(new URL('voice-worklet.js', document.baseURI).href).catch(e => { loaded.delete(ctx); throw e; }));
    return loaded.get(ctx);
  }
  const isReady = ctx => { const p = loaded.get(ctx); return !!(p && p.done); };
  function build(ctx, f) {
    const d = reg.get(f.type); if (!d) throw Error('Unknown voice effect.');
    const s = settings(f), unit = d.build(ctx, s);
    const update = unit.update; unit.update = n => update(settings({ ...n, type: f.type }));
    unit.mix = n => mixOf(n || f);
    return unit;
  }
  // Mark the worklet promise as finished so synchronous code can check it.
  const prepareTracked = ctx => { const p = prepare(ctx); p.then(() => { p.done = true; }, () => {}); return p; };

  // ---------- helpers ----------
  function chain(nodes) { for (let i = 1; i < nodes.length; i++) nodes[i - 1].connect(nodes[i]); return nodes; }
  function disposer(nodes, extra) { return () => { if (extra) try { extra(); } catch (_) {} for (const n of nodes) try { n.port && n.port.postMessage({ stop: true }); n.disconnect(); } catch (_) {} }; }
  function biquad(ctx, type, hz, q = 0.707, gain = 0) { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = Math.min(ctx.sampleRate * 0.45, hz); n.Q.value = q; n.gain.value = gain; return n; }
  function pitchNode(ctx, semitones) {
    if (typeof AudioWorkletNode === 'undefined' || !isReady(ctx)) throw Error('Pitch processing is still loading. Try again in a moment.');
    return new AudioWorkletNode(ctx, 'saveit-pitch', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: { semitones } });
  }
  // deterministic noise, so preview and export use the identical reverb
  function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2147483648) - 1; }
  function impulse(ctx, decay) {
    const sr = ctx.sampleRate, n = Math.max(1, Math.ceil(sr * decay)), b = ctx.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch), r = rng(0x5a7e1 + ch * 7919);
      for (let i = 0; i < n; i++) d[i] = r() * Math.exp(-6.9 * i / n);
      // a few early reflections give the room a shape
      for (const [ms, g] of [[11, .5], [19, .38], [29, .3], [41, .22]]) { const k = Math.floor(sr * (ms + ch * 3) / 1000); if (k < n) d[k] += g * (ch ? -1 : 1); }
      for (let i = 0; i < Math.min(n, Math.floor(sr * 0.004)); i++) d[i] *= i / (sr * 0.004); // no click at the start
    }
    return b;
  }

  // ---------- the six effects ----------
  register({ id: 'voiceDeep', name: 'Deep Voice', short: 'Lower pitch', color: '#7f9cf5', worklet: true,
    hint: 'Lowers the voice without slowing it down. Pitch sets how many semitones lower; Warmth adds body.',
    params: [['semitones', 'Pitch', -12, -1, 0.5, -5, 'semitones'], ['warmthDb', 'Warmth', 0, 9, 0.5, 3, 'dB'], ['mix', 'Wet / dry mix', 0, 100, 1, 100, '%']],
    build(ctx, s) {
      const ps = pitchNode(ctx, s.semitones), shelf = biquad(ctx, 'lowshelf', 220, 0.707, s.warmthDb), trim = ctx.createGain();
      trim.gain.value = Math.pow(10, -s.warmthDb / 40); chain([ps, shelf, trim]);
      return { input: ps, output: trim, update(n) { ps.port.postMessage({ semitones: n.semitones }); smooth(ctx, shelf.gain, n.warmthDb); smooth(ctx, trim.gain, Math.pow(10, -n.warmthDb / 40)); }, dispose: disposer([ps, shelf, trim]) };
    } });
  register({ id: 'voiceHigh', name: 'High Pitch', short: 'Chipmunk', color: '#f5c46b', worklet: true,
    hint: 'Raises the voice for a playful, chipmunk sound. The length and timing stay the same.',
    params: [['semitones', 'Pitch', 1, 12, 0.5, 7, 'semitones'], ['mix', 'Wet / dry mix', 0, 100, 1, 100, '%']],
    build(ctx, s) {
      const ps = pitchNode(ctx, s.semitones), tone = biquad(ctx, 'highshelf', 7000, 0.707, -3);
      chain([ps, tone]);
      return { input: ps, output: tone, update(n) { ps.port.postMessage({ semitones: n.semitones }); }, dispose: disposer([ps, tone]) };
    } });
  register({ id: 'voiceRobot', name: 'Robot', short: 'Synthetic', color: '#8fd0e8',
    hint: 'A metallic, synthetic voice: the voice is modulated by a steady tone and passed through a short metallic resonance.',
    params: [['intensity', 'Intensity', 0, 100, 1, 80, '%'], ['ringHz', 'Robot tone', 30, 300, 1, 90, 'Hz'], ['metallic', 'Metallic ring', 0, 85, 1, 40, '%'], ['mix', 'Wet / dry mix', 0, 100, 1, 100, '%']],
    build(ctx, s) {
      const input = ctx.createGain(), ring = ctx.createGain(), osc = ctx.createOscillator(), depth = ctx.createGain();
      const comb = ctx.createDelay(0.05), fb = ctx.createGain(), sum = ctx.createGain(), out = ctx.createGain(), hp = biquad(ctx, 'highpass', 90);
      osc.type = 'sine'; osc.frequency.value = s.ringHz; osc.connect(depth); depth.connect(ring.gain); osc.start();
      const set = n => { const i = n.intensity / 100; smooth(ctx, ring.gain, 1 - i); smooth(ctx, depth.gain, i); smooth(ctx, osc.frequency, n.ringHz); smooth(ctx, fb.gain, n.metallic / 100 * 0.8); smooth(ctx, out.gain, (1 + i * 0.35) / (1 + n.metallic / 100 * 0.9)); };
      comb.delayTime.value = 0.0062; input.connect(hp); hp.connect(ring); ring.connect(sum); ring.connect(comb); comb.connect(fb); fb.connect(comb); comb.connect(sum); sum.connect(out);
      ring.gain.value = 1 - s.intensity / 100; depth.gain.value = s.intensity / 100; fb.gain.value = s.metallic / 100 * 0.8; out.gain.value = (1 + s.intensity / 100 * 0.35) / (1 + s.metallic / 100 * 0.9);
      return { input, output: out, update: set, dispose: disposer([input, ring, osc, depth, comb, fb, sum, out, hp], () => osc.stop()) };
    } });
  register({ id: 'voiceRadio', name: 'Radio / Telephone', short: 'Narrow band', color: '#e89b7f',
    hint: 'Keeps only the middle of the voice, like a phone call or a walkie-talkie. Add Distortion for a rougher radio.',
    params: [['lowCutHz', 'Low cut', 150, 1000, 10, 400, 'Hz'], ['highCutHz', 'High cut', 1500, 6000, 50, 3200, 'Hz'], ['drive', 'Distortion', 0, 100, 1, 25, '%'], ['mix', 'Wet / dry mix', 0, 100, 1, 100, '%']],
    build(ctx, s) {
      const h1 = biquad(ctx, 'highpass', s.lowCutHz, 0.9), h2 = biquad(ctx, 'highpass', s.lowCutHz, 0.9), l1 = biquad(ctx, 'lowpass', s.highCutHz, 0.9), l2 = biquad(ctx, 'lowpass', s.highCutHz, 0.9);
      const honk = biquad(ctx, 'peaking', 1500, 1.2, 4), shaper = ctx.createWaveShaper(), out = ctx.createGain();
      const curve = drive => { const k = 1 + drive / 100 * 14, n = 2048, c = new Float32Array(n), t = Math.tanh(k); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / t; } return c; };
      shaper.curve = curve(s.drive); shaper.oversample = '2x'; out.gain.value = 0.8 / (1 + s.drive / 100 * 0.5);
      // Filtering a distorted voice rings above the peak it had (+1.4 dBFS on loud real speech in testing). A soft
      // safety stage passes everything below -3 dBFS unchanged and never lets the Radio sound exceed -0.2 dBFS.
      const half = ctx.createGain(), safe = ctx.createWaveShaper(); half.gain.value = 0.5;
      { const n = 4096, c = new Float32Array(n), knee = 0.7, room = 0.277; for (let i = 0; i < n; i++) { const x = (i / (n - 1) * 2 - 1) * 2, a = Math.abs(x); c[i] = Math.sign(x) * (a <= knee ? a : knee + room * Math.tanh((a - knee) / room)); } safe.curve = c; safe.oversample = '2x'; }
      chain([h1, h2, honk, shaper, l1, l2, out, half, safe]);
      return { input: h1, output: safe, update(n) { for (const f of [h1, h2]) smooth(ctx, f.frequency, n.lowCutHz); for (const f of [l1, l2]) smooth(ctx, f.frequency, Math.min(ctx.sampleRate * 0.45, n.highCutHz)); shaper.curve = curve(n.drive); smooth(ctx, out.gain, 0.8 / (1 + n.drive / 100 * 0.5)); }, dispose: disposer([h1, h2, honk, shaper, l1, l2, out, half, safe]) };
    } });
  register({ id: 'voiceEcho', name: 'Echo', short: 'Repeats', color: '#9ad49a',
    hint: 'Adds repeats of the voice. Delay sets the time between repeats, Feedback how many you hear, Tone how bright they are.',
    params: [['echoDelayMs', 'Delay', 60, 1200, 10, 300, 'ms'], ['echoFeedback', 'Feedback', 0, 85, 1, 40, '%'], ['toneHz', 'Tone', 1000, 12000, 100, 4500, 'Hz'], ['mix', 'Wet / dry mix', 0, 100, 1, 40, '%']],
    tail: s => { const fb = s.echoFeedback / 100; return Math.min(8, s.echoDelayMs / 1000 * (fb > 0 ? Math.ceil(Math.log(0.001) / Math.log(fb)) + 1 : 1)); },
    build(ctx, s) {
      const input = ctx.createGain(), d = ctx.createDelay(1.5), tone = biquad(ctx, 'lowpass', s.toneHz), fb = ctx.createGain(), out = ctx.createGain();
      d.delayTime.value = s.echoDelayMs / 1000; fb.gain.value = s.echoFeedback / 100; out.gain.value = 1;
      input.connect(d); d.connect(tone); tone.connect(fb); fb.connect(d); tone.connect(out);
      return { input, output: out, update(n) { smooth(ctx, d.delayTime, n.echoDelayMs / 1000); smooth(ctx, fb.gain, n.echoFeedback / 100); smooth(ctx, tone.frequency, Math.min(ctx.sampleRate * 0.45, n.toneHz)); }, dispose: disposer([input, d, tone, fb, out]) };
    } });
  register({ id: 'voiceReverb', name: 'Reverb', short: 'Room / hall', color: '#c3a1f0',
    hint: 'Places the voice in a room or hall. Room size sets how long the sound lingers; Pre-delay separates the voice from the room.',
    params: [['roomDecay', 'Room size', 0.2, 6, 0.1, 1.8, 's'], ['preDelayMs', 'Pre-delay', 0, 150, 1, 20, 'ms'], ['toneHz', 'Damping', 1500, 12000, 100, 6000, 'Hz'], ['mix', 'Wet / dry mix', 0, 100, 1, 30, '%']],
    tail: s => s.roomDecay + s.preDelayMs / 1000,
    build(ctx, s) {
      const input = ctx.createGain(), pre = ctx.createDelay(0.2), lp = biquad(ctx, 'lowpass', s.toneHz), out = ctx.createGain();
      let conv = ctx.createConvolver(), decay = s.roomDecay; conv.buffer = impulse(ctx, decay);
      pre.delayTime.value = s.preDelayMs / 1000; out.gain.value = 0.9;
      input.connect(pre); pre.connect(conv); conv.connect(lp); lp.connect(out);
      return { input, output: out, update(n) {
        smooth(ctx, pre.delayTime, n.preDelayMs / 1000); smooth(ctx, lp.frequency, Math.min(ctx.sampleRate * 0.45, n.toneHz));
        if (Math.abs(n.roomDecay - decay) > 1e-6) { decay = n.roomDecay; const c = ctx.createConvolver(); c.buffer = impulse(ctx, decay); pre.connect(c); c.connect(lp); try { pre.disconnect(conv); conv.disconnect(); } catch (_) {} conv = c; }
      }, dispose: () => { for (const n of [input, pre, conv, lp, out]) try { n.disconnect(); } catch (_) {} } };
    } });

  // ---------- one stage that blends dry and wet (used by the Video editor) ----------
  // stage(ctx) gives {input, output, set(voice)} where voice is {type, on, ...settings} or null.
  // Changing the effect type rebuilds the processor; changing settings updates it smoothly.
  function stage(ctx) {
    const input = ctx.createGain(), output = ctx.createGain(), dry = ctx.createGain(), wet = ctx.createGain();
    input.connect(dry); dry.connect(output); wet.connect(output);
    let unit = null, key = '', want = null;
    const apply = () => {
      const v = want, on = !!(v && v.on !== false && has(v.type)), k = on ? v.type : '';
      if (k !== key) {
        if (unit) { try { input.disconnect(unit.input); } catch (_) {} unit.dispose(); unit = null; }
        key = '';
        if (on) {
          if (needsWorklet(v.type) && !isReady(ctx)) { prepareTracked(ctx).then(() => { if (want === v) apply(); }, () => {}); }
          else { try { unit = build(ctx, v); input.connect(unit.input); unit.output.connect(wet); key = k; } catch (_) { unit = null; } }
        }
      } else if (unit) unit.update(v);
      const m = unit ? mixOf(v) : 0; smooth(ctx, dry.gain, 1 - m); smooth(ctx, wet.gain, m);
    };
    return { input, output, set(v) { want = v ? { ...v } : null; apply(); }, ready: () => !want || want.on === false || !has(want.type) || !!unit };
  }

  const ICONS = { voiceDeep: 'M12 4v12m-5-5 5 5 5-5M5 20h14', voiceHigh: 'M12 20V8m-5 5 5-5 5 5M5 4h14', voiceRobot: 'M6 8h12v10H6zM10 12v1M14 12v1M12 4v4M9 18v2M15 18v2', voiceRadio: 'M4 10h16v9H4zM8 14.5h1M13 13h4M13 16h4M7 10l9-5', voiceEcho: 'M4 12h2M9 7v10M14 5v14M19 8v8', voiceReverb: 'M4 7v10M8 5v14M12 8v8M16 10v4M20 11v2' };
  const icon = type => (reg.get(type) && reg.get(type).icon) || ICONS[type] || '';
  root.VoiceFX = { icon, ringsOut, register, has, list, defaults, settings, build, tail, mix: mixOf, needsWorklet, prepare: prepareTracked, isReady, stage };
})(window);
