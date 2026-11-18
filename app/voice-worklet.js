// 10.3.10: pitch shifter for the Deep Voice and High Pitch voice effects.
// Two read heads move through a short delay line at the new speed and cross-fade with sin² windows that
// sum to exactly 1, so pitch changes while the length and timing of the audio stay the same (no speed-up,
// no slow-down, no clicks where a head jumps back). Latency is about half a window (≈22 ms).
class SaveitPitchShift extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const p = (options && options.processorOptions) || {};
    this.size = 1 << 15; this.mask = this.size - 1;
    this.buf = [new Float32Array(this.size), new Float32Array(this.size)];
    this.w = 0; this.phase = 0; this.win = Math.max(256, Math.round(sampleRate * 0.045)); this.alive = true;
    this.set(p);
    this.port.onmessage = e => { if (e.data && e.data.stop) this.alive = false; else this.set(e.data || {}); };
  }
  set(p) { const st = Number.isFinite(p.semitones) ? Math.max(-24, Math.min(24, p.semitones)) : 0; this.ratio = Math.pow(2, st / 12); }
  read(b, pos) { const i = Math.floor(pos), f = pos - i, m = this.mask; return b[i & m] * (1 - f) + b[(i + 1) & m] * f; }
  process(inputs, outputs) {
    if (!this.alive) return false;
    const inp = inputs[0] || [], out = outputs[0], n = out[0].length, W = this.win, dp = (1 - this.ratio) / W;
    const l = inp[0], r = inp[1] || inp[0], b0 = this.buf[0], b1 = this.buf[1];
    for (let i = 0; i < n; i++) {
      b0[this.w] = l ? l[i] : 0; b1[this.w] = r ? r[i] : 0;
      let p2 = this.phase + 0.5; if (p2 >= 1) p2 -= 1;
      const s = Math.sin(Math.PI * this.phase), g1 = s * s, g2 = 1 - g1;
      const r1 = this.w - (this.phase * W + 2), r2 = this.w - (p2 * W + 2);
      const L = this.read(b0, r1) * g1 + this.read(b0, r2) * g2;
      const R = this.read(b1, r1) * g1 + this.read(b1, r2) * g2;
      out[0][i] = L; if (out[1]) out[1][i] = R;
      this.w = (this.w + 1) & this.mask;
      this.phase += dp; if (this.phase >= 1) this.phase -= 1; else if (this.phase < 0) this.phase += 1;
    }
    return true;
  }
}
registerProcessor('saveit-pitch', SaveitPitchShift);
