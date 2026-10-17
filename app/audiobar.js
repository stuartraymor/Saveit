// 9.9: the audio settings shown in the capture bar when Audio is chosen. Shared by the editor's top bar and the
// capture widget, so both look and behave the same: Mic 1 with a live level bar, an optional Mic 2, and
// Computer sound. The choice is kept in localStorage ('saveit.audio') and both windows follow each other's changes.
const AUDIOBAR = (() => {
  const KEY = 'saveit.audio';
  const load = () => { try { const o = JSON.parse(localStorage.getItem(KEY) || '{}'); return { mics: Array.isArray(o.mics) && o.mics.length ? o.mics.slice(0, 2).map(String) : [''], two: !!o.two, sys: !!o.sys }; } catch (_) { return { mics: [''], two: false, sys: false }; } };
  const MIC_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/></svg>';
  function mount(onChange) {
    let st = load(), active = false, devs = null;
    const el = (h) => { const t = document.createElement('template'); t.innerHTML = h.trim(); return t.content.firstChild; };
    const row = n => el(`<span class="amic" role="group" aria-label="Microphone ${n}" data-n="${n}" title="Microphone ${n}: the bar moves when it hears you"><span class="amic-l">${n === 1 ? 'Mic' : 'Mic 2'}</span><select class="dev amic-s" aria-label="Microphone ${n}"></select><canvas class="ameter" width="48" height="10" role="meter" aria-label="Microphone ${n} level" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></canvas>${n === 2 ? '<button type="button" class="amic-x" title="Remove the second microphone" aria-label="Remove the second microphone">✕</button>' : ''}</span>`);
    const m1 = row(1), m2 = row(2);
    const add = el('<button type="button" class="aadd" title="Record a second microphone on its own track (up to two)">+ Mic 2</button>');
    const sys = el('<label class="ck asys" title="Also record the sound your computer plays, on its own track"><input type="checkbox" class="asys-c"> Computer sound</label>');
    const sel = n => (n === 1 ? m1 : m2).querySelector('select'), meter = n => (n === 1 ? m1 : m2).querySelector('canvas');
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (_) {} };
    const emit = () => { save(); onChange && onChange(get()); };
    function get() { return { mics: st.two ? [st.mics[0] || '', st.mics[1] || ''] : [st.mics[0] || ''], sys: st.sys }; }
    // "" means the Windows default microphone: find which real device that is
    const real = v => v ? v : ((devs && devs.devices.find(d => d.label === devs.defaultLabel)) || {}).id || '';
    function ui() {
      m2.hidden = !st.two; add.hidden = st.two; sys.querySelector('input').checked = st.sys;
      // the same microphone can't be picked twice ("Default" counts as the mic it stands for)
      const one = real(st.mics[0]);
      [...sel(2).options].forEach(o => { o.disabled = st.two && real(o.value) === one; });
      if (st.two && real(st.mics[1]) === one && devs && devs.devices.length) { const alt = devs.devices.find(d => d.id !== one); st.mics[1] = alt ? alt.id : ''; sel(2).value = st.mics[1]; if (!alt) { st.two = false; m2.hidden = true; add.hidden = false; } }
      add.disabled = !!devs && devs.devices.length < 2; add.title = add.disabled ? 'Connect a second microphone to record two at once' : 'Record a second microphone on its own track (up to two)';
    }
    async function refresh(unlock) {
      if (typeof DEVICES === 'undefined') return;
      devs = await DEVICES.list('mic', unlock !== false);
      for (const n of [1, 2]) { const v = DEVICES.fill(sel(n), 'mic', devs, st.mics[n - 1] || ''); if (n === 1 || st.two) st.mics[n - 1] = v; }
      if (st.two && !st.mics[1] && devs.devices.length > 1) { const alt = devs.devices.find(d => d.id !== real(st.mics[0])); if (alt) { st.mics[1] = alt.id; sel(2).value = alt.id; } }
      ui(); save(); restartMeters();
    }
    // ---- live level bars (only while Audio is chosen and the window is visible) ----
    let meters = [], tick = 0, ctx = null;
    function stopMeters() { clearInterval(tick); tick = 0; for (const m of meters) { try { m.stream.getTracks().forEach(t => t.stop()); m.src.disconnect(); } catch (_) {} } meters = []; [1, 2].forEach(n => draw(n, 0)); }
    async function restartMeters() {
      stopMeters(); if (!active || document.visibilityState !== 'visible' || typeof DEVICES === 'undefined') return;
      const want = get().mics, gen = (restartMeters.gen = (restartMeters.gen || 0) + 1);
      try { ctx = ctx || new AudioContext(); if (ctx.state === 'suspended') await ctx.resume().catch(() => {}); } catch (_) { return; }
      for (let i = 0; i < want.length; i++) {
        try {
          const { stream } = await DEVICES.open('mic', want[i]);
          if (gen !== restartMeters.gen || !active) { stream.getTracks().forEach(t => t.stop()); return; }
          const src = ctx.createMediaStreamSource(stream), an = ctx.createAnalyser(); an.fftSize = 1024; src.connect(an);
          meters.push({ n: i + 1, stream, src, an, buf: new Float32Array(an.fftSize), lv: 0 });
        } catch (e) { draw(i + 1, -1); (i === 0 ? m1 : m2).title = e.message || 'This microphone could not be started.'; }
      }
      tick = setInterval(() => { for (const m of meters) { m.an.getFloatTimeDomainData(m.buf); let pk = 0; for (const v of m.buf) pk = Math.max(pk, Math.abs(v)); m.lv = Math.max(pk, m.lv * 0.82); draw(m.n, m.lv); } }, 60);
    }
    // 8 segments: green, then amber near the top, red when it would clip
    function draw(n, lv) {
      const c = meter(n), g = c.getContext('2d'), seg = 8, w = c.width, h = c.height, sw = (w - (seg - 1) * 2) / seg;
      const db = lv > 0 ? 20 * Math.log10(lv) : -99, lit = lv < 0 ? 0 : Math.max(0, Math.min(seg, Math.round((db + 48) / 48 * seg)));
      g.clearRect(0, 0, w, h);
      for (let i = 0; i < seg; i++) { g.fillStyle = i < lit ? (i >= 7 ? '#e5483b' : i >= 5 ? '#f5c400' : '#2db3a0') : (lv < 0 ? '#5a2a26' : '#3a3f45'); g.fillRect(i * (sw + 2), 0, sw, h); }
      c.setAttribute('aria-valuenow', String(Math.round(lit / seg * 100)));
    }
    // ---- events ----
    sel(1).onchange = () => { st.mics[0] = sel(1).value; ui(); emit(); restartMeters(); };
    sel(2).onchange = () => { st.mics[1] = sel(2).value; ui(); emit(); restartMeters(); };
    add.onclick = () => { st.two = true; ui(); emit(); refresh(); };
    m2.querySelector('.amic-x').onclick = e => { e.preventDefault(); st.two = false; ui(); emit(); restartMeters(); };
    sys.querySelector('input').onchange = e => { st.sys = e.target.checked; emit(); };
    document.addEventListener('visibilitychange', () => restartMeters());
    addEventListener('storage', e => { if (e.key !== KEY) return; st = load(); [1, 2].forEach(n => { if (st.mics[n - 1] != null) sel(n).value = st.mics[n - 1]; }); ui(); restartMeters(); onChange && onChange(get(), true); });
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener('devicechange', () => { if (active) refresh(); });
    [1, 2].forEach(n => draw(n, 0)); ui();
    return {
      els: { mic1: m1, mic2: m2, add, sys },
      get, set(o) { if (!o) return; if (Array.isArray(o.mics)) { st.mics = o.mics.slice(0, 2).map(x => x || ''); st.two = o.mics.length > 1; } if (o.sys != null) st.sys = !!o.sys; [1, 2].forEach(n => { sel(n).value = st.mics[n - 1] || ''; }); ui(); save(); if (active) restartMeters(); },
      setActive(on) { if (active === !!on) return; active = !!on; if (active) refresh(); else stopMeters(); },
      refresh, stop: stopMeters, MIC_SVG
    };
  }
  return { mount, MIC_SVG };
})();
