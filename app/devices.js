// Camera and microphone discovery, shared by the editor and the capture widget.
const DEVICES = (() => {
  const KIND = { mic: 'audioinput', cam: 'videoinput' }, NAME = { mic: 'microphone', cam: 'camera' };
  const errCode = e => e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'blocked' : e && (e.name === 'NotFoundError' || e.name === 'OverconstrainedError') ? 'none' : 'failed';
  function message(type, code) {
    if (code === 'blocked') return `Access to the ${NAME[type]} is blocked. Turn it on in Windows Settings > Privacy & security > ${type === 'mic' ? 'Microphone' : 'Camera'}.`;
    if (code === 'none') return `No ${NAME[type]} is connected.`;
    return `The ${NAME[type]} could not be started. It may be in use by another app.`;
  }
  // Device names are only readable after access has been granted once, so `unlock` briefly opens the device.
  async function list(type, unlock) {
    const read = async () => (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === KIND[type]);
    let all = [], error = null;
    try {
      all = await read();
      if (unlock && all.length && all.every(d => !d.label)) {
        try { const s = await navigator.mediaDevices.getUserMedia(type === 'mic' ? { audio: true } : { video: true }); s.getTracks().forEach(t => t.stop()); all = await read(); }
        catch (e) { error = errCode(e); }
      }
    } catch (e) { error = 'failed'; }
    if (!all.length && !error) error = 'none';
    const def = all.find(d => d.deviceId === 'default');
    const devices = all.filter(d => d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications')
      .map((d, i) => ({ id: d.deviceId, label: d.label || `${type === 'mic' ? 'Microphone' : 'Camera'} ${i + 1}` }));
    return { devices, error, defaultLabel: def && def.label ? def.label.replace(/^Default\s*-\s*/, '') : '' };
  }
  function fill(sel, type, res, current) {
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    if (!res.devices.length) { sel.innerHTML = `<option value="">${res.error === 'blocked' ? 'Access blocked' : 'None found'}</option>`; sel.title = message(type, res.error || 'none'); return ''; }
    const dflt = type === 'mic' ? 'Default microphone' : 'Default camera';
    sel.innerHTML = `<option value="">${esc(res.defaultLabel ? dflt + ' (' + res.defaultLabel + ')' : dflt)}</option>` + res.devices.map(d => `<option value="${esc(d.id)}">${esc(d.label)}</option>`).join('');
    const keep = res.devices.some(d => d.id === current) ? current : '';
    sel.value = keep; sel.title = res.error ? message(type, res.error) : `Choose the ${NAME[type]} to record`;
    return keep;
  }
  // Opens the chosen device; if it was unplugged, falls back to the default one and says so.
  async function open(type, id, extra) {
    const media = id ? { deviceId: { exact: id }, ...(extra || {}) } : (extra || true);
    const want = c => type === 'mic' ? { audio: c, video: false } : { video: c, audio: false };
    try { return { stream: await navigator.mediaDevices.getUserMedia(want(media)), fellBack: false }; }
    catch (e) {
      if (id && errCode(e) === 'none') {
        try { return { stream: await navigator.mediaDevices.getUserMedia(want(extra || true)), fellBack: true }; } catch (e2) { e = e2; }
      }
      const err = new Error(message(type, errCode(e))); err.code = errCode(e); throw err;
    }
  }
  return { list, fill, open, message };
})();
