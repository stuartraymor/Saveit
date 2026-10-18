// 9.9: Saveit audio. Recording (up to two microphones plus computer sound, each on its own track), the Audio screen
// (one lane per track with its waveform, play, volume / mute / solo per track), and mixing down to a WAV file.
(function(root){
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const fmt=t=>{t=Math.max(0,t||0);const m=Math.floor(t/60),s=t-m*60;return m+':'+(s<10?'0':'')+s.toFixed(1)};
const esc=t=>String(t==null?'':t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let AC=null;const ac=()=>{if(!AC||AC.state==='closed')AC=new AudioContext();return AC};
const MIC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/></svg>';

// ---------- decoding, waveforms, mixing ----------
async function decode(blob){const b=await blob.arrayBuffer();return await ac().decodeAudioData(b)}
async function buffers(it){if(it._bufs&&it._bufs.length===it.tracks.length)return it._bufs;it._bufs=await Promise.all(it.tracks.map(t=>decode(t.blob)));return it._bufs}
const durOf=(bufs,tracks)=>AudioTimeline.duration(bufs,tracks);
// Min/max across channels: opposite-polarity stereo must not disappear.
function peaks(buf,n){const ch=[];for(let c=0;c<buf.numberOfChannels;c++)ch.push(buf.getChannelData(c));const len=buf.length,out=new Float32Array(n*2),step=len/n;
  for(let i=0;i<n;i++){let lo=1,hi=-1;const a=Math.floor(i*step),b=Math.min(len,Math.floor((i+1)*step)),inc=Math.max(1,Math.floor((b-a)/400));for(let j=a;j<b;j+=inc){for(const d of ch){const v=d[j];if(v<lo)lo=v;if(v>hi)hi=v}}if(hi<lo){lo=0;hi=0}out[i*2]=lo;out[i*2+1]=hi}return out}
function audible(tracks){const solo=tracks.some(t=>t.solo&&!t.mute);return tracks.map(t=>!t.mute&&(!solo||t.solo))}
const vol=t=>t.vol==null?1:t.vol;
// waveform drawing: every pixel shows the loudest and quietest point of the part of the recording it covers
function drawWave(g,pk,x,y,w,h,col,from,to){const n=pk.length/2,W=Math.max(1,Math.round(w)),X=Math.round(x),mid=y+h/2;g.fillStyle=col;
  for(let px=0;px<W;px++){let i0=Math.floor((from+(to-from)*px/W)*n),i1=Math.floor((from+(to-from)*(px+1)/W)*n);if(i1<=i0)i1=i0+1;if(i0>=n||i1<=0)continue;i0=Math.max(0,i0);i1=Math.min(n,i1);
    let lo=1,hi=-1;for(let i=i0;i<i1;i++){if(pk[i*2]<lo)lo=pk[i*2];if(pk[i*2+1]>hi)hi=pk[i*2+1]}if(hi<lo)continue;g.fillRect(X+px,mid-hi*h/2,1,Math.max(1,(hi-lo)*h/2))}}
const peaksFor=b=>peaks(b,Math.max(512,Math.min(400000,Math.ceil(b.duration*100))));

// ---------- 9.9.1: edits ----------
// The timeline is a list of pieces of the recording ({a,b} in recording seconds), shared by every track, plus fades.
// Nothing is cut out of the recording itself, so every edit can be undone and the original is always kept.
function editOf(it,S){const e=it.edit;if(e&&Array.isArray(e.clips)&&e.clips.length&&e.clips.every(c=>c&&isFinite(c.a)&&isFinite(c.b)&&c.b>c.a))return e;return it.edit={clips:[{a:0,b:S}],fi:0,fo:0}}
const lenOf=ed=>ed.clips.reduce((n,c)=>n+(c.b-c.a),0);
function pieces(ed){let p=0;return ed.clips.map(c=>{const o={a:c.a,b:c.b,start:p,end:p+(c.b-c.a)};p=o.end;return o})}
function cutRange(ed,s,e){const out=[];for(const c of pieces(ed)){if(c.end<=s||c.start>=e){out.push({a:c.a,b:c.b});continue}if(c.start<s)out.push({a:c.a,b:c.a+(s-c.start)});if(c.end>e)out.push({a:c.a+(e-c.start),b:c.b})}ed.clips=out.filter(c=>c.b-c.a>0.005);AudioTimeline.cutEffects(ed,s,e)}
function keepRange(ed,s,e){const out=[];for(const c of pieces(ed)){const s2=Math.max(s,c.start),e2=Math.min(e,c.end);if(e2-s2>0.005)out.push({a:c.a+(s2-c.start),b:c.a+(e2-c.start)})}ed.clips=out;AudioTimeline.trimEffects(ed,s,e)}
function splitAt(ed,t){const P=pieces(ed),i=P.findIndex(c=>t>c.start+0.02&&t<c.end-0.02);if(i<0)return false;const c=P[i],m=c.a+(t-c.start);ed.clips.splice(i,1,{a:c.a,b:m},{a:m,b:c.b});return true}
// plays the pieces from timeline time `from`, starting at context time `when`, into one gain per track
function schedule(ctx,bufs,ed,from,when,gains,tracks){const srcs=[];bufs.forEach((b,i)=>{for(const c of AudioTimeline.segments(tracks?.[i],b,ed)){if(c.end<=from)continue;const skip=Math.max(0,from-c.start),off=c.a+skip,dur=(c.b-c.a)-skip;if(off>=b.duration||dur<=0)continue;
    const s=ctx.createBufferSource();s.buffer=b;s.connect(gains[i]);s.start(when+Math.max(0,c.start-from),off,Math.min(dur,b.duration-off));srcs.push(s)}});return srcs}
// fade in at the start and fade out at the end of the whole timeline
function fadeAt(ed,T,t){const fi=Math.min(+ed.fi||0,T/2),fo=Math.min(+ed.fo||0,T/2);let k=1;if(fi>0&&t<fi)k=Math.min(k,t/fi);if(fo>0&&t>T-fo)k=Math.min(k,(T-t)/fo);return clamp(k,0,1)}
function fades(param,ed,T,from,when){const fi=Math.min(+ed.fi||0,T/2),fo=Math.min(+ed.fo||0,T/2);param.cancelScheduledValues(0);param.setValueAtTime(fadeAt(ed,T,from),when);
  if(fi>0&&from<fi)param.linearRampToValueAtTime(1,when+(fi-from));if(fo>0){const s=Math.max(from,T-fo);param.setValueAtTime(fadeAt(ed,T,s),when+(s-from));param.linearRampToValueAtTime(0,when+(T-from))}}
async function mix(it){const bufs=await buffers(it),ed=editOf(it,durOf(bufs,it.tracks)),T=Math.max(0.01,lenOf(ed)),sr=Math.max(...bufs.map(b=>b.sampleRate),44100),on=audible(it.tracks);
  const off=new OfflineAudioContext(2,Math.max(1,Math.ceil(T*sr)),sr),m=off.createGain();const graph=AudioTimeline.graph(off,off.destination,ed.effects,0,0,T);m.connect(graph.input);fades(m.gain,ed,T,0,0);
  const gains=bufs.map((b,i)=>{const g=off.createGain();g.gain.value=on[i]?vol(it.tracks[i]):0;g.connect(m);return g});schedule(off,bufs,ed,0,0,gains,it.tracks);const rendered=await off.startRendering();graph.dispose();return rendered}
function wav(buf,float=false){const ch=buf.numberOfChannels,n=buf.length,sr=buf.sampleRate,bytes=float?4:2,data=new DataView(new ArrayBuffer(44+n*ch*bytes)),w=(o,s)=>{for(let i=0;i<s.length;i++)data.setUint8(o+i,s.charCodeAt(i))};
  w(0,'RIFF');data.setUint32(4,36+n*ch*bytes,true);w(8,'WAVE');w(12,'fmt ');data.setUint32(16,16,true);data.setUint16(20,float?3:1,true);data.setUint16(22,ch,true);data.setUint32(24,sr,true);data.setUint32(28,sr*ch*bytes,true);data.setUint16(32,ch*bytes,true);data.setUint16(34,bytes*8,true);w(36,'data');data.setUint32(40,n*ch*bytes,true);
  const cd=[];for(let c=0;c<ch;c++)cd.push(buf.getChannelData(c));let o=44;for(let i=0;i<n;i++)for(let c=0;c<ch;c++){if(float)data.setFloat32(o,cd[c][i],true);else{const v=clamp(cd[c][i],-1,1);data.setInt16(o,v<0?v*0x8000:v*0x7fff,true)}o+=bytes}return new Blob([data],{type:'audio/wav'})}

async function renderWav(it){return wav(await mix(it))}
const COLS=['#2db3a0','#7aa7ff','#f5c400'];
async function thumbFor(it){const bufs=await buffers(it),ed=editOf(it,durOf(bufs,it.tracks)),T=lenOf(ed)||1,c=document.createElement('canvas');c.width=192;c.height=108;const g=c.getContext('2d');g.fillStyle='#1d2a2e';g.fillRect(0,0,192,108);
  const h=88/bufs.length;bufs.forEach((b,i)=>{const pk=peaks(b,2048);for(const p of AudioTimeline.segments(it.tracks[i],b,ed))drawWave(g,pk,p.start/T*192,10+i*h,(p.end-p.start)/T*192,h,COLS[i%3],p.a/b.duration,p.b/b.duration)});return c.toDataURL('image/png')}

// ---------- recording ----------
// o: {mics:[deviceId,...], sys, onLevel(levels), warn(msg)}. Resolves with a controller once every input is open.
async function record(o){const parts=[];
  try{for(let i=0;i<o.mics.length;i++){const {stream,fellBack}=await DEVICES.open('mic',o.mics[i]||'',{echoCancellation:o.mics.length<2,noiseSuppression:true,autoGainControl:o.mics.length<2});
      const lab=(stream.getAudioTracks()[0]||{}).label||('Microphone '+(i+1));parts.push({name:o.mics.length>1?'Mic '+(i+1):'Microphone',device:lab.replace(/^Default\s*-\s*/,''),stream});if(fellBack&&o.warn)o.warn('Microphone '+(i+1)+' was not found, so the Windows default microphone is used.')}
    if(o.sys){try{const ds=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});ds.getVideoTracks().forEach(t=>t.stop());const at=ds.getAudioTracks();if(at.length)parts.push({name:'Computer sound',stream:new MediaStream(at)});else if(o.warn)o.warn('Computer sound is not available here, so only the microphone is recorded.')}catch(_){if(o.warn)o.warn('Computer sound could not be started, so only the microphone is recorded.')}}
  }catch(e){parts.forEach(p=>p.stream.getTracks().forEach(t=>t.stop()));throw e}
  const ctx=new AudioContext(),mime=['audio/webm;codecs=opus','audio/webm'].find(m=>MediaRecorder.isTypeSupported(m))||'';
  for(const p of parts){p.chunks=[];p.rec=new MediaRecorder(p.stream,mime?{mimeType:mime,audioBitsPerSecond:192000}:{});p.rec.ondataavailable=e=>{if(e.data.size)p.chunks.push(e.data)};p.done=new Promise(r=>p.rec.onstop=r);
    p.an=ctx.createAnalyser();p.an.fftSize=1024;p.buf=new Float32Array(p.an.fftSize);p.src=ctx.createMediaStreamSource(p.stream);p.src.connect(p.an);p.lv=0}
  let tick=0,paused=false,t0=0,pausedAt=0,pausedFor=0,stopped=false;
  const ctl={parts:parts.map(p=>p.name),
    start(){parts.forEach(p=>p.rec.start(1000));t0=performance.now();tick=setInterval(()=>{const lv=parts.map(p=>{p.an.getFloatTimeDomainData(p.buf);let pk=0;for(const v of p.buf)pk=Math.max(pk,Math.abs(v));p.lv=Math.max(pk,p.lv*.8);return paused?0:+p.lv.toFixed(3)});o.onLevel&&o.onLevel(lv)},100)},
    get paused(){return paused},elapsed(){return((paused?pausedAt:performance.now())-t0-pausedFor)/1000},
    pause(){if(paused||stopped)return;paused=true;pausedAt=performance.now();parts.forEach(p=>{try{p.rec.pause()}catch(_){}})},
    resume(){if(!paused||stopped)return;paused=false;pausedFor+=performance.now()-pausedAt;parts.forEach(p=>{try{p.rec.resume()}catch(_){}})},
    cancel(){stopped=true;clearInterval(tick);parts.forEach(p=>{try{p.rec.state!=='inactive'&&p.rec.stop()}catch(_){}p.stream.getTracks().forEach(t=>t.stop())});ctx.close().catch(()=>{})},
    async stop(){if(stopped)return null;stopped=true;clearInterval(tick);parts.forEach(p=>{try{if(p.rec.state==='paused')p.rec.resume();if(p.rec.state!=='inactive'){p.rec.requestData();p.rec.stop()}}catch(_){}});
      await Promise.all(parts.map(p=>p.done));parts.forEach(p=>p.stream.getTracks().forEach(t=>t.stop()));ctx.close().catch(()=>{});
      return parts.map(p=>({name:p.name,blob:new Blob(p.chunks,{type:(mime||'audio/webm').split(';')[0]}),vol:1,mute:false,solo:false})).filter(t=>t.blob.size>0)}};
  return ctl}

// ---------- the Audio screen ----------
function css(){if(document.getElementById('aeditCss'))return;const s=document.createElement('style');s.id='aeditCss';s.textContent=`
.awrap{position:absolute;inset:0;display:flex;min-height:0;background:var(--bg,#16181a)}
.amain{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0}
.alanes{flex:1;overflow:auto;padding:14px 14px 6px;display:flex;flex-direction:column;gap:10px;min-height:0}
.alane{display:grid;grid-template-columns:190px 1fr;background:var(--panel,#26292d);border:1px solid var(--line,#3a3f45);border-radius:10px;overflow:hidden;min-height:96px;flex:1 1 96px;max-height:220px}
.alane.amuted canvas{opacity:.35}
.ahdr{padding:9px 10px;display:flex;flex-direction:column;gap:7px;border-right:1px solid var(--line,#3a3f45);background:var(--panel-2,#30343a);min-width:0}
.ahdr .anm{font-weight:700;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ahdr .arow{display:flex;align-items:center;gap:6px}.ahdr input[type=range]{flex:1;min-width:0}
.ahdr .av{font:11px var(--f-mono,Consolas,monospace);color:var(--muted,#9aa1a8);min-width:36px;text-align:right}
.ahdr .ams{width:26px;height:22px;padding:0;border-radius:6px;font-weight:800;font-size:11px}
.ahdr .ams[aria-pressed=true]{background:var(--accent,#2db3a0);border-color:var(--accent,#2db3a0);color:var(--accent-fg,#06211d)}
.ahdr .ams.am[aria-pressed=true]{background:#e5483b;border-color:#e5483b;color:#fff}
.alane canvas{width:100%;height:100%;display:block;cursor:text;touch-action:none}
.atrans{display:flex;align-items:center;gap:8px;padding:9px 14px;border-top:1px solid var(--line,#3a3f45);background:var(--panel,#26292d);flex-wrap:wrap}
.atime{font:13px var(--f-mono,Consolas,monospace);min-width:130px}
.aside{width:300px;flex:none;border-left:1px solid var(--line,#3a3f45);background:var(--panel,#26292d);padding:14px;display:flex;flex-direction:column;gap:12px;overflow:auto}
.aside h3{margin:0;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#9aa1a8)}
.aside .ainfo{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:12px}.aside .ainfo span:nth-child(odd){color:var(--muted,#9aa1a8)}
.aside .hint{font-size:12px;color:var(--muted,#9aa1a8);margin:0;line-height:1.45}
.ahome{position:absolute;inset:0;display:grid;place-items:center}
.ahome .acard{max-width:440px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:14px;padding:28px 30px;background:var(--panel,#26292d);border:1px solid var(--line,#3a3f45);border-radius:14px}
.ahome .aic{width:58px;height:58px;border-radius:16px;display:grid;place-items:center;background:linear-gradient(135deg,#0b7285,#2db3a0);color:#fff}.ahome .aic svg{width:30px;height:30px}
.ahome h2{margin:0;font-size:18px}.ahome p{margin:0;color:var(--muted,#9aa1a8);font-size:13px;line-height:1.5}
.ahome .arow{display:flex;gap:8px}
.arec{background:#e5483b!important;border-color:#e5483b!important;color:#fff!important}
.aload{position:absolute;inset:0;display:grid;place-items:center;color:var(--muted,#9aa1a8)}`;document.head.appendChild(s)}

function home(host,api){css();host.innerHTML=`<div class="awrap"><div class="ahome"><div class="acard"><div class="aic">${MIC}</div><h2>Audio</h2><p>Record a quick voice message or narration, or open an audio file to listen to it and save it.<br>Choose your microphone in the bar at the top (Audio).</p><div class="arow"><button class="btn arec" data-a="rec">● Record audio</button><button class="btn" data-a="open">Open audio file…</button></div></div></div></div>`;
  host.querySelector('[data-a="rec"]').onclick=()=>api.record();host.querySelector('[data-a="open"]').onclick=()=>api.openFile();return{destroy(){host.innerHTML=''},isHome:true}}

const CSS2=`
.atools{display:flex;align-items:center;gap:6px;padding:9px 14px 0;flex-wrap:wrap}
.atools .sep{width:1px;height:20px;background:var(--line,#3a3f45);margin:0 4px}
.atools .btn{display:inline-flex;align-items:center;gap:6px}.atools .btn svg{width:15px;height:15px}
.atools .asel{font:12px var(--f-mono,Consolas,monospace);color:var(--muted,#9aa1a8);margin-left:auto;white-space:nowrap}
.aruler{display:grid;grid-template-columns:190px 1fr;margin:8px 14px 0;height:24px}
.aruler canvas{width:100%;height:24px;display:block;cursor:pointer;touch-action:none}
.aruler .azoom{display:flex;align-items:center;gap:4px;padding-right:8px;justify-content:flex-end}
.aruler .azoom .btn{height:22px;min-height:0;padding:0 7px;font-size:12px}
.alanes{padding-top:6px!important}
.alane canvas{cursor:text}
.aside .arow2{display:flex;gap:6px;flex-wrap:wrap}.aside .arow2 .btn{flex:1 1 auto}
.aside label.afade{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted,#9aa1a8)}.aside label.afade input{width:64px}
.afxrow{display:grid;grid-template-columns:190px 1fr;margin:6px 14px 0;gap:0;flex:none}.afxtitle{font-size:11px;color:var(--muted);padding:8px}.afxscroll{max-height:120px;overflow:auto;background:var(--panel-2);border:1px solid var(--line);border-radius:5px}.afxscroll canvas{display:block;width:100%;height:44px;touch-action:none}.afxprops{margin:12px 0}.afxprops input[type=number]{width:76px}.afxprops label{font-size:12px}.afxprops .arow2{margin:7px 0}
.btn:disabled{opacity:.45;cursor:default}`;
const IC={split:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 3v18"/><path d="M8 7 5 12l3 5M16 7l3 5-3 5"/></svg>',
  del:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  trim:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4v16M17 4v16"/><path d="M3 12h4M17 12h4" stroke-dasharray="1.5 2"/><rect x="9.5" y="8" width="5" height="8" rx="1" fill="currentColor" stroke="none" opacity=".55"/></svg>',
  undo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
  redo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/></svg>'};

function mount(host,it,api){css();if(!document.getElementById('aeditCss2')){const s=document.createElement('style');s.id='aeditCss2';s.textContent=CSS2;document.head.appendChild(s)}
  let fxUI=null,pasteBusy=false;let dead=false,bufs=null,pks=[],S=0,T=0,t=0,playing=null,raf=0,loop=false,sel=null,v0=0,vd=1,hist=[],fut=[],thumbT=0,focusTrack=0;
  host.innerHTML=`<div class="awrap"><div class="amain">
    <div class="atools" role="toolbar" aria-label="Edit audio">
      <button class="btn" data-a="split" title="Split at the playhead (S)">${IC.split}Split</button>
      <button class="btn" data-a="del" title="Delete the selected part and close the gap (Delete)">${IC.del}Delete</button>
      <button class="btn" data-a="trim" title="Keep only the selected part">${IC.trim}Trim to selection</button>
      <span class="sep"></span><button class="btn" data-a="undo" title="Undo (Ctrl+Z)" aria-label="Undo">${IC.undo}</button><button class="btn" data-a="redo" title="Redo (Ctrl+Y)" aria-label="Redo">${IC.redo}</button>
      <span class="asel" data-r="sel">Drag across the waveform to select</span></div>
    <div class="aruler"><div class="azoom"><button class="btn" data-a="zout" title="Zoom out (Ctrl + mouse wheel)" aria-label="Zoom out">−</button><button class="btn" data-a="zfit" title="Show the whole recording">Fit</button><button class="btn" data-a="zin" title="Zoom in (Ctrl + mouse wheel)" aria-label="Zoom in">+</button></div><canvas data-r="ruler" aria-label="Time ruler: click to move the playhead"></canvas></div>
    <div class="alanes" data-r="lanes"><div class="aload">Opening audio…</div></div>
    <div class="atrans"><button class="btn pri" data-a="play" title="Play or pause (Space)">▶ Play</button><button class="btn" data-a="start" title="Back to the start (Home)">⏮ Start</button><label class="chk"><input type="checkbox" data-r="loop"> Loop</label><span class="atime" data-r="time">0:00.0 / 0:00.0</span><span style="flex:1"></span><button class="btn arec" data-a="rec" title="Record a new audio clip with the microphone settings in the top bar">● New recording</button></div></div>
   <div class="aside"><h3>Audio</h3><input type="text" data-r="name" aria-label="Name" value="${esc(it.name||'')}"><div class="ainfo" data-r="info"></div>
    <h3>Edit</h3><p class="hint" data-r="selinfo">Drag across a waveform to select part of the recording.</p>
    <div class="arow2"><button class="btn" data-a="playsel" title="Play only the selected part">▶ Play selection</button><button class="btn" data-a="del2">Delete selection</button><button class="btn" data-a="trim2">Trim to selection</button></div>
    <div class="arow2"><label class="afade">Fade in <input type="number" min="0" step="0.1" data-r="fi"> s</label><label class="afade">Fade out <input type="number" min="0" step="0.1" data-r="fo"> s</label></div>
    <button class="btn" data-a="reset" title="Undo every cut and fade and go back to the full recording">Reset edits</button>
    <h3>Save</h3><p class="hint">Saves what you hear: the edited timeline with every track mixed, using each track's volume, mute and solo.</p><button class="btn pri" data-a="save">Save audio (WAV)…</button>
    <h3>Tips</h3><p class="hint"><b>Space</b> play / pause · <b>S</b> split · <b>Delete</b> remove the selection · <b>I</b> / <b>O</b> start / end of the selection at the playhead · <b>Esc</b> clear the selection · <b>Ctrl+Z</b> undo · <b>Ctrl</b>+wheel zoom · double-click a piece to select it.</p></div></div>`;
  const q=s=>host.querySelector(s),R=n=>q(`[data-r="${n}"]`),A=n=>q(`[data-a="${n}"]`);
  const ed=()=>editOf(it,S);
  // ----- history -----
  const state=()=>({edit:JSON.parse(JSON.stringify(ed())),tracks:it.tracks.map(x=>({...x,regions:x.regions?JSON.parse(JSON.stringify(x.regions)):undefined})),bufs:bufs?.slice(),S});
  function snap(){hist.push(state());if(hist.length>100)hist.shift();fut=[]}
  function restore(o){it.edit=JSON.parse(JSON.stringify(o.edit));it.tracks=o.tracks.map(x=>({...x,regions:x.regions?JSON.parse(JSON.stringify(x.regions)):undefined}));bufs=o.bufs?.slice();it._bufs=bufs;S=o.S;pks=bufs.map(peaksFor);changed(true)}
  function undo(){if(!hist.length)return;fut.push(state());restore(hist.pop())}
  function redo(){if(!fut.length)return;hist.push(state());restore(fut.pop())}
  // ----- after any change -----
  function changed(rebuild){stopSrc();const wasFit=vd>=T-1e-6;T=Math.max(0.01,lenOf(ed()));t=clamp(t,0,T);if(sel&&(sel.e>T||sel.e-sel.s<0.01))sel=null;it.dur=T;if(wasFit||vd>T){v0=0;vd=T}else v0=clamp(v0,0,T-vd)
    if(rebuild)lanes();else draw();info();ui();api.persist(it);api.ready&&api.ready(it);clearTimeout(thumbT);thumbT=setTimeout(async()=>{if(dead)return;try{it.thumb=await thumbFor(it);api.persist(it);api.thumbChanged&&api.thumbChanged(it)}catch(_){}},700)}
  function ui(){const has=!!sel,P=pieces(ed());A('del').disabled=A('trim').disabled=A('del2').disabled=A('trim2').disabled=A('playsel').disabled=!has;A('undo').disabled=!hist.length;A('redo').disabled=!fut.length;
    A('split').disabled=!P.some(c=>t>c.start+0.02&&t<c.end-0.02);R('fi').value=+(ed().fi||0).toFixed(2);R('fo').value=+(ed().fo||0).toFixed(2);
    const txt=has?`Selection ${fmt(sel.s)} – ${fmt(sel.e)} (${(sel.e-sel.s).toFixed(1)} s)`:'Drag across the waveform to select';R('sel').textContent=txt;R('selinfo').textContent=has?txt+'.':'Drag across a waveform to select part of the recording.';
    fxUI?.refresh();A('zin').disabled=vd<=0.5;A('zout').disabled=A('zfit').disabled=vd>=T-1e-6}
  function info(){const size=it.tracks.reduce((n,x)=>n+(x.blob?.size||0),0),P=pieces(ed());R('info').innerHTML=`<span>Length</span><b>${fmt(T)}${Math.abs(T-S)>0.05?` <span style="color:var(--muted)">of ${fmt(S)}</span>`:''}</b><span>Pieces</span><b>${P.length}</b><span>Tracks</span><b>${it.tracks.length}</b><span>Size</span><b>${(size/1048576).toFixed(2)} MB</b><span>Made</span><b>${it.created?new Date(it.created).toLocaleString():'—'}</b>`}
  // ----- editing actions -----
  const edit=fn=>{snap();fn();changed()};
  function doDelete(){if(!sel){api.toast('Select part of the audio first: drag across the waveform.');return}const s=sel;edit(()=>{cutRange(ed(),s.s,s.e);t=s.s;sel=null});if(!ed().clips.length){restore(hist.pop());api.toast('That would delete everything. Use Delete on the item in Recent to remove the whole recording.',6000)}}
  function doTrim(){if(!sel){api.toast('Select the part to keep first: drag across the waveform.');return}const s=sel;edit(()=>{keepRange(ed(),s.s,s.e);t=0;sel=null;v0=0;vd=Infinity})}
  A('split').onclick=()=>{const before=state();if(!splitAt(ed(),t)){api.toast('Move the playhead inside a piece to split it.');return}hist.push(before);fut=[];changed()};
  A('del').onclick=A('del2').onclick=doDelete;A('trim').onclick=A('trim2').onclick=doTrim;A('undo').onclick=undo;A('redo').onclick=redo;
  A('reset').onclick=()=>{edit(()=>{it.edit={clips:[{a:0,b:S}],fi:0,fo:0};sel=null})};
  for(const k of ['fi','fo'])R(k).onchange=e=>{const v=clamp(+e.target.value||0,0,T/2);edit(()=>{ed()[k]=v})};
  A('playsel').onclick=()=>{if(sel){stopSrc();play(sel.s,sel.e)}};
  R('name').onchange=e=>{it.name=e.target.value.trim()||it.name;api.persist(it);api.renamed&&api.renamed(it)};
  A('save').onclick=()=>api.save();A('rec').onclick=()=>api.record();
  A('play').onclick=()=>playing?pause():play();A('start').onclick=()=>seek(0);R('loop').onchange=e=>{loop=e.target.checked};
  // ----- view (zoom and scroll) -----
  const tx=(x,w)=>v0+clamp(x/w,0,1)*vd;
  function zoom(k,at){const c=at==null?(playing||t>=v0&&t<=v0+vd?t:v0+vd/2):at,nd=clamp(vd/k,0.5,T);v0=clamp(c-(c-v0)*nd/vd,0,T-nd);vd=nd;draw();ui()}
  A('zin').onclick=()=>zoom(2);A('zout').onclick=()=>zoom(.5);A('zfit').onclick=()=>{v0=0;vd=T;draw();ui()};
  const wheel=(e,cv)=>{const r=cv.getBoundingClientRect();if(e.ctrlKey){e.preventDefault();zoom(e.deltaY<0?1.25:0.8,tx(e.clientX-r.left,r.width));return}
    if(vd<T-1e-6){const d=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:(e.shiftKey?e.deltaY:0);if(d){e.preventDefault();v0=clamp(v0+d/r.width*vd,0,T-vd);draw()}}};
  // ----- lanes -----
  function lanes(){const L=R('lanes');L.innerHTML='';it.tracks.forEach((tr,i)=>{const d=document.createElement('div');d.className='alane'+(audible(it.tracks)[i]?'':' amuted');d.innerHTML=`<div class="ahdr"><div class="anm" title="${esc(tr.name)}">${esc(tr.name||'Track '+(i+1))}</div><div class="arow"><input type="range" min="0" max="200" value="${Math.round(vol(tr)*100)}" aria-label="Volume of ${esc(tr.name)}"><span class="av">${Math.round(vol(tr)*100)}%</span></div><div class="arow"><button class="btn ams am" aria-pressed="${!!tr.mute}" title="Mute this track">M</button><button class="btn ams as" aria-pressed="${!!tr.solo}" title="Solo: hear only this track">S</button></div></div><canvas aria-label="Waveform of ${esc(tr.name)}" role="img"></canvas>`;
      const rg=d.querySelector('input'),av=d.querySelector('.av');let volBefore=null;rg.onpointerdown=rg.onkeydown=()=>{if(volBefore==null)volBefore=state()};rg.oninput=()=>{tr.vol=+rg.value/100;av.textContent=rg.value+'%';gains()};rg.onchange=()=>{if(volBefore){hist.push(volBefore);fut=[];volBefore=null}api.persist(it);ui()};
      d.querySelector('.am').onclick=()=>{snap();tr.mute=!tr.mute;changed(true);gains()};d.querySelector('.as').onclick=()=>{snap();tr.solo=!tr.solo;changed(true);gains()};
      const cv=d.querySelector('canvas');pointer(cv);cv.ondblclick=e=>{const r=cv.getBoundingClientRect(),tt=tx(e.clientX-r.left,r.width),p=pieces(ed()).find(c=>tt>=c.start&&tt<=c.end);if(p){sel={s:p.start,e:p.end};draw();ui()}};cv.onwheel=e=>wheel(e,cv);
      d.addEventListener('pointerdown',()=>{focusTrack=i});L.appendChild(d)});draw()}
  // click: move the playhead · drag: select · Shift+click: select from the playhead
  function pointer(cv){cv.onpointerdown=e=>{if(e.button!==0)return;fxUI?.clear();const r=cv.getBoundingClientRect(),x0=e.clientX,t0=tx(x0-r.left,r.width);let moved=false;cv.setPointerCapture(e.pointerId);
      if(e.shiftKey){sel={s:Math.min(t,t0),e:Math.max(t,t0)};moved=true;draw();ui()}
      cv.onpointermove=ev=>{if(!ev.buttons)return;if(!moved&&Math.abs(ev.clientX-x0)<4)return;moved=true;const t1=tx(ev.clientX-r.left,r.width);sel={s:Math.min(t0,t1),e:Math.max(t0,t1)};
        if(ev.clientX>r.right-8&&v0+vd<T){v0=Math.min(T-vd,v0+vd*.02)}else if(ev.clientX<r.left+8&&v0>0){v0=Math.max(0,v0-vd*.02)}draw();ui()};
      cv.onpointerup=()=>{cv.onpointermove=null;if(!moved){sel=null;seek(t0)}else if(sel&&sel.e-sel.s<0.02){sel=null}draw();ui()}}}
  const ruler=R('ruler');ruler.onpointerdown=e=>{if(e.button!==0)return;fxUI?.clear();const r=ruler.getBoundingClientRect();seek(tx(e.clientX-r.left,r.width));ruler.setPointerCapture(e.pointerId);ruler.onpointermove=ev=>{if(ev.buttons)seek(tx(ev.clientX-r.left,r.width))};ruler.onpointerup=()=>{ruler.onpointermove=null}};ruler.onwheel=e=>wheel(e,ruler);
  // ----- drawing -----
  function sizeCv(cv){const r=cv.getBoundingClientRect(),dpr=devicePixelRatio||1,w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}return{w,h,dpr}}
  function drawRuler(){const {w,h,dpr}=sizeCv(ruler),g=ruler.getContext('2d');g.clearRect(0,0,w,h);g.fillStyle='rgba(255,255,255,.04)';g.fillRect(0,0,w,h);
    const steps=[.1,.2,.5,1,2,5,10,15,30,60,120,300,600],px=w/vd,st=steps.find(s=>s*px>=70*dpr)||600;g.fillStyle='#9aa1a8';g.font=`${11*dpr}px Consolas,monospace`;g.textBaseline='middle';
    for(let k=Math.ceil(v0/st)*st;k<=v0+vd+1e-9;k+=st){const x=Math.round((k-v0)*px);g.fillRect(x,h*.55,Math.max(1,dpr),h*.45);g.fillText(fmt(k).replace(/\.0$/,''),x+3*dpr,h*.32)}
    for(const p of pieces(ed()).slice(1)){const x=Math.round((p.start-v0)*px);if(x>=0&&x<=w){g.fillStyle='#f5c400';g.beginPath();g.moveTo(x-4*dpr,0);g.lineTo(x+4*dpr,0);g.lineTo(x,6*dpr);g.fill()}}
    if(sel){g.fillStyle='rgba(45,179,160,.35)';g.fillRect((sel.s-v0)*px,0,(sel.e-sel.s)*px,h)}const x=Math.round((t-v0)*px);g.fillStyle='#fff';g.fillRect(x-dpr,0,2*dpr,h)}
  function draw(){if(!bufs)return;drawRuler();const E=ed(),P=pieces(E);host.querySelectorAll('.alane canvas').forEach((cv,i)=>{const {w,h,dpr}=sizeCv(cv),g=cv.getContext('2d'),px=w/vd,b=bufs[i];g.clearRect(0,0,w,h);g.fillStyle='rgba(255,255,255,.05)';g.fillRect(0,h/2,w,1);
      for(const p of AudioTimeline.segments(it.tracks[i],b,E)){const x0=(p.start-v0)*px,x1=(p.end-v0)*px;if(x1<0||x0>w)continue;const cx0=Math.max(0,x0),cx1=Math.min(w,x1),f=(cx0-x0)/(x1-x0||1),f2=(cx1-x0)/(x1-x0||1),a=p.a+(p.b-p.a)*f,bb=p.a+(p.b-p.a)*f2;
        if(b)drawWave(g,pks[i],cx0,h*.08,cx1-cx0,h*.84,COLS[i%3],a/b.duration,bb/b.duration)}
      for(const p of P.slice(1)){const x=Math.round((p.start-v0)*px);if(x>=0&&x<=w){g.fillStyle='#f5c400';g.fillRect(x-Math.round(dpr/2),0,Math.max(1,dpr),h)}}
      const fi=Math.min(+E.fi||0,T/2),fo=Math.min(+E.fo||0,T/2);g.fillStyle='rgba(0,0,0,.45)';
      if(fi>0){const x0=(0-v0)*px,x1=(fi-v0)*px;g.beginPath();g.moveTo(x0,0);g.lineTo(x1,0);g.lineTo(x0,h);g.closePath();g.fill()}
      if(fo>0){const x0=(T-fo-v0)*px,x1=(T-v0)*px;g.beginPath();g.moveTo(x0,0);g.lineTo(x1,0);g.lineTo(x1,h);g.closePath();g.fill()}
      if(sel){g.fillStyle='rgba(45,179,160,.22)';const sx=(sel.s-v0)*px,sw=(sel.e-sel.s)*px;g.fillRect(sx,0,sw,h);g.fillStyle='rgba(45,179,160,.9)';g.fillRect(sx,0,Math.max(1,dpr),h);g.fillRect(sx+sw-dpr,0,Math.max(1,dpr),h)}
      const x=Math.round((t-v0)*px);g.fillStyle='#ffffff';g.fillRect(x-Math.round(dpr/2),0,Math.max(1,Math.round(dpr*1.5)),h)});
    fxUI?.draw();R('time').textContent=`${fmt(t)} / ${fmt(T)}`;A('play').textContent=playing?'❚❚ Pause':'▶ Play'}
  // ----- playback -----
  function gains(){if(!playing)return;const on=audible(it.tracks);playing.gains.forEach((g,i)=>{g.gain.setTargetAtTime(on[i]?vol(it.tracks[i]):0,ac().currentTime,.02)})}
  async function play(from,until){if(!bufs||playing)return;const a=ac();if(a.state==='suspended')await a.resume();from=from==null?t:from;until=until==null?T:until;if(from>=until-.02)from=0;
    const when=a.currentTime+.05,master=a.createGain();const graph=AudioTimeline.graph(a,a.destination,ed().effects,from,when,T);master.connect(graph.input);fades(master.gain,ed(),T,from,when);
    const on=audible(it.tracks),gs=bufs.map((b,i)=>{const g=a.createGain();g.gain.value=on[i]?vol(it.tracks[i]):0;g.connect(master);return g});
    playing={srcs:schedule(a,bufs,ed(),from,when,gs,it.tracks),gains:gs,master,graph,when,from,until};
    const step=()=>{if(dead||!playing)return;t=Math.min(playing.until,playing.from+(ac().currentTime-playing.when));
      if(t>=playing.until-0.005){const pf=playing.from,pu=playing.until,again=loop;stopSrc();t=again?pf:pu;if(again){play(pf,pu);return}draw();ui();return}
      if(t>v0+vd||t<v0){v0=clamp(t-vd*.1,0,T-vd)}draw();raf=requestAnimationFrame(step)};step()}
  function stopSrc(){if(!playing)return;playing.srcs.forEach(s=>{try{s.stop()}catch(_){}});playing.gains.forEach(g=>g.disconnect());playing.master.disconnect();playing.graph.dispose();playing=null;cancelAnimationFrame(raf)}
  function pause(){if(!playing)return;t=Math.min(T,playing.from+(ac().currentTime-playing.when));stopSrc();draw();ui()}
  function seek(x){const was=!!playing;stopSrc();t=clamp(x,0,T);if(t<v0||t>v0+vd)v0=clamp(t-vd/2,0,T-vd);draw();ui();if(was)play()}
  // ----- keyboard -----
  const key=e=>{if(dead)return;const tg=e.target;if(tg&&(tg.isContentEditable||/INPUT|TEXTAREA|SELECT/.test(tg.tagName))&&!(tg.type==='range'||tg.type==='checkbox'))return;if(document.querySelector('.modal'))return;
    const k=e.key,mod=e.ctrlKey||e.metaKey,stop=()=>{e.preventDefault();e.stopPropagation()};
    if(mod&&(k==='z'||k==='Z')){stop();e.shiftKey?redo():undo();return}if(mod&&(k==='y'||k==='Y')){stop();redo();return}
    if(mod&&(k==='v'||k==='V')){stop();api.pasteMedia?.(e.shiftKey?'insert':'stack');return}
    if(mod&&(k==='a'||k==='A')){stop();sel={s:0,e:T};draw();ui();return}if(mod||e.altKey)return;
    if(e.code==='Space'||k===' '){stop();playing?pause():play()}else if(k==='Home'){stop();seek(0)}else if(k==='End'){stop();seek(T)}
    else if(k==='ArrowLeft'||k==='ArrowRight'){if(tg&&tg.type==='range')return;stop();seek(t+(k==='ArrowLeft'?-1:1)*(e.shiftKey?5:1))}
    else if(k==='s'||k==='S'){stop();A('split').click()}else if(k==='Delete'||k==='Backspace'){stop();if(!fxUI?.remove())doDelete()}
    else if(k==='i'||k==='I'){stop();sel={s:Math.min(t,sel?sel.e:T),e:sel?Math.max(t,sel.e):T};if(sel.e-sel.s<0.02)sel=null;draw();ui()}
    else if(k==='o'||k==='O'){stop();sel={s:sel?Math.min(sel.s,t):0,e:Math.max(t,sel?sel.s:0)};if(sel.e-sel.s<0.02)sel=null;draw();ui()}
    else if(k==='Escape'&&(sel||fxUI?.selected)){stop();sel=null;fxUI?.clear();draw();ui()}};
  document.addEventListener('keydown',key,true);
  async function insertClip(clip,mode='stack',at=t){if(pasteBusy||!bufs||dead)throw Error('Wait until the audio editor is ready.');pasteBusy=true;try{const buffer=await decode(clip.blob);if(dead)throw Error('The audio editor was closed.');at=clamp(at,0,T);const len=buffer.duration;if(!(len>0))throw Error('The copied audio is empty.');stopSrc();snap();const oldEdit=ed(),oldT=T;
    it.tracks=it.tracks.map((tr,i)=>({...tr,regions:AudioTimeline.segments(tr,bufs[i],oldEdit).flatMap(r=>mode==='insert'?AudioTimeline.insertGap([r],at,len):[r])}));
    it.tracks.push({name:clip.name||'Pasted audio',blob:clip.blob,vol:1,mute:false,solo:false,regions:[{a:0,b:len,start:at}]});bufs=[...bufs,buffer];it._bufs=bufs;pks=bufs.map(peaksFor);S=mode==='insert'?oldT+len:Math.max(oldT,at+len);
    it.edit={clips:[{a:0,b:S}],fi:oldEdit.fi||0,fo:oldEdit.fo||0,effects:mode==='insert'?AudioTimeline.insertEffects(oldEdit.effects||[],at,len):JSON.parse(JSON.stringify(oldEdit.effects||[]))};t=at;sel=null;vd=Infinity;changed(true)
   }finally{pasteBusy=false}}
  async function saveSound(){if(!sel)throw Error('Select an audio range first.');const range={...sel},mixed=await mix(it),a=Math.max(0,Math.floor(range.s*mixed.sampleRate)),b=Math.min(mixed.length,Math.ceil(range.e*mixed.sampleRate)),sound=ac().createBuffer(mixed.numberOfChannels,Math.max(1,b-a),mixed.sampleRate);for(let i=0;i<mixed.numberOfChannels;i++)sound.copyToChannel(mixed.getChannelData(i).subarray(a,b),i);return api.soundEffect?.(wav(sound),(it.name||'Audio')+' (sound effect)',sound.duration)}
  fxUI=AudioTimeline.mountEffects(host,{edit:ed,duration:()=>T,time:()=>t,view:()=>({v0,vd}),selection:()=>sel,snap,changed:()=>changed(),saveSound,mediaMenu:e=>api.mediaMenu?.(e),error:e=>api.toast(e.message||String(e))});
  host.querySelector('.alanes').oncontextmenu=e=>api.mediaMenu?.(e);ruler.oncontextmenu=e=>api.mediaMenu?.(e);
  const ro=new ResizeObserver(()=>draw());ro.observe(host);
  (async()=>{try{bufs=await buffers(it);if(dead)return;S=durOf(bufs,it.tracks)||0.1;ed();T=Math.max(0.01,lenOf(ed()));v0=0;vd=T;pks=bufs.map(peaksFor);it.dur=T;info();lanes();ui();api.ready&&api.ready(it);
      if(!it.thumb||it._thumbStale){it.thumb=await thumbFor(it);it._thumbStale=false;api.persist(it);api.thumbChanged&&api.thumbChanged(it)}}
    catch(e){if(!dead){R('lanes').innerHTML=`<div class="aload">This audio could not be opened. ${esc(e.message||'')}</div>`}}})();
  return{insertClip,destroy(){dead=true;stopSrc();fxUI?.destroy();clearTimeout(thumbT);ro.disconnect();document.removeEventListener('keydown',key,true);host.innerHTML=''},play,pause,seek,
    get time(){return t},get duration(){return T},get playing(){return !!playing},get selection(){return sel?{...sel}:null},set selection(v){sel=v?{s:v.s,e:v.e}:null;draw();ui()},
    split:()=>A('split').click(),del:doDelete,trim:doTrim,undo,redo,zoom,get view(){return{v0,vd}},isHome:false}}
root.AEdit={mount,home,record,renderWav,mix,wav,decode,buffers,peaks,thumbFor,fmt,MIC,edits:{editOf,lenOf,pieces,cutRange,keepRange,splitAt}};
})(window);
