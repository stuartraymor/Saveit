// Webcam overlay settings and drawing, shared by the recorder, the webcam dialog and the webcam settings window,
// so the preview always matches what is recorded.
const CAMDRAW = {
  DEF: { pos: 'br', shape: 'circle', corners: 'rounded', size: 22, border: true, borderColor: '#ffffff', borderWidth: 3, mirror: true, deviceId: '' },
  load() { try { return { ...this.DEF, ...JSON.parse(localStorage.getItem('saveit.cam') || '{}') }; } catch (e) { return { ...this.DEF }; } },
  save(o) { try { localStorage.setItem('saveit.cam', JSON.stringify(o)); } catch (e) {} },
  // Where the webcam sits on a W×H frame: a 2.5% margin from the chosen corner; size is a percentage of the frame width.
  rect(W, H, o) {
    const m = Math.round(W * .025), w = Math.round(W * o.size / 100), h = o.shape === 'rect' ? Math.round(w * 9 / 16) : w;
    return { x: o.pos[1] === 'l' ? m : W - m - w, y: o.pos[0] === 't' ? m : H - m - h, w, h };
  },
  path(g, r, o) {
    g.beginPath();
    if (o.shape === 'circle') g.arc(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, 0, Math.PI * 2);
    else if (o.corners === 'rounded') g.roundRect(r.x, r.y, r.w, r.h, Math.min(r.w, r.h) * .14);
    else g.rect(r.x, r.y, r.w, r.h);
  },
  draw(g, v, W, H, o) {
    if (!v || !v.videoWidth) return;
    const r = this.rect(W, H, o), vr = v.videoWidth / v.videoHeight, br = r.w / r.h;
    let sx = 0, sy = 0, sW = v.videoWidth, sH = v.videoHeight;
    if (vr > br) { sW = sH * br; sx = (v.videoWidth - sW) / 2; } else { sH = sW / br; sy = (v.videoHeight - sH) / 2; }
    g.save(); this.path(g, r, o);
    g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = W / 90; g.fillStyle = '#000'; g.fill(); g.shadowColor = 'transparent'; g.clip();
    if (o.mirror !== false) { g.translate(r.x + r.w, r.y); g.scale(-1, 1); g.drawImage(v, sx, sy, sW, sH, 0, 0, r.w, r.h); }
    else g.drawImage(v, sx, sy, sW, sH, r.x, r.y, r.w, r.h);
    g.restore();
    if (o.border) { g.save(); this.path(g, r, o); g.lineWidth = Math.max(1, (+o.borderWidth || 3) * W / 1280); g.strokeStyle = o.borderColor || '#ffffff'; g.stroke(); g.restore(); }
  }
};
