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
const durOf=bufs=>bufs.reduce((m,b)=>Math.max(m,b.duration),0);
// min/max per bucket of the channels mixed together
function peaks(buf,n){const ch=[];for(let c=0;c<buf.numberOfChannels;c++)ch.push(buf.getChannelData(c));const len=buf.length,out=new Float32Array(n*2),step=len/n;
  for(let i=0;i<n;i++){let lo=1,hi=-1;const a=Math.floor(i*step),b=Math.min(len,Math.floor((i+1)*step)),inc=Math.max(1,Math.floor((b-a)/400));for(let j=a;j<b;j+=inc){let v=0;for(const d of ch)v+=d[j];v/=ch.length;if(v<lo)lo=v;if(v>hi)hi=v}if(hi<lo){lo=0;hi=0}out[i*2]=lo;out[i*2+1]=hi}return out}
function drawWave(g,pk,x,y,w,h,col,from,to){const n=pk.length/2;g.fillStyle=col;const mid=y+h/2;for(let px=0;px<w;px++){const f=from+(to-from)*px/w,i=Math.floor(f*n);if(i<0||i>=n)continue;const lo=pk[i*2],hi=pk[i*2+1];const top=mid-hi*h/2,bot=mid-lo*h/2;g.fillRect(x+px,top,1,Math.max(1,bot-top))}}
function audible(tracks){const solo=tracks.some(t=>t.solo&&!t.mute);return tracks.map(t=>!t.mute&&(!solo||t.solo))}
async function mix(it){const bufs=await buffers(it),T=durOf(bufs),sr=Math.max(...bufs.map(b=>b.sampleRate),44100),on=audible(it.tracks);
  const off=new OfflineAudioContext(2,Math.max(1,Math.ceil(T*sr)),sr);bufs.forEach((b,i)=>{if(!on[i])return;const s=off.createBufferSource(),g=off.createGain();s.buffer=b;g.gain.value=it.tracks[i].vol==null?1:it.tracks[i].vol;s.connect(g);g.connect(off.destination);s.start(0)});return off.startRendering()}
function wav(buf){const ch=buf.numberOfChannels,n=buf.length,sr=buf.sampleRate,data=new DataView(new ArrayBuffer(44+n*ch*2)),w=(o,s)=>{for(let i=0;i<s.length;i++)data.setUint8(o+i,s.charCodeAt(i))};
  w(0,'RIFF');data.setUint32(4,36+n*ch*2,true);w(8,'WAVE');w(12,'fmt ');data.setUint32(16,16,true);data.setUint16(20,1,true);data.setUint16(22,ch,true);data.setUint32(24,sr,true);data.setUint32(28,sr*ch*2,true);data.setUint16(32,ch*2,true);data.setUint16(34,16,true);w(36,'data');data.setUint32(40,n*ch*2,true);
  const cd=[];for(let c=0;c<ch;c++)cd.push(buf.getChannelData(c));let o=44;for(let i=0;i<n;i++)for(let c=0;c<ch;c++){const v=clamp(cd[c][i],-1,1);data.setInt16(o,v<0?v*0x8000:v*0x7fff,true);o+=2}return new Blob([data],{type:'audio/wav'})}
async function renderWav(it){return wav(await mix(it))}
async function thumbFor(it){const bufs=await buffers(it),T=durOf(bufs)||1,c=document.createElement('canvas');c.width=192;c.height=108;const g=c.getContext('2d');g.fillStyle='#1d2a2e';g.fillRect(0,0,192,108);
  const lanes=bufs.length,h=88/lanes;bufs.forEach((b,i)=>drawWave(g,peaks(b,192),0,10+i*h,192,h,i===0?'#2db3a0':i===1?'#7aa7ff':'#f5c400',0,b.duration/T));return c.toDataURL('image/png')}

// ---------- recording ----------
// o: {mics:[deviceId,...], sys, onLevel(levels), warn(msg)}. Resolves with a controller once every input is open.
async function record(o){const parts=[];
  try{for(let i=0;i<o.mics.length;i++){const {stream,fellBack}=await DEVICES.open('mic',o.mics[i]||'',{echoCancellation:o.mics.length<2,noiseSuppression:true,autoGainControl:o.mics.length<2});
      const lab=(stream.getAudioTracks()[0]||{}).label||('Microphone '+(i+1));parts.push({name:(o.mics.length>1?'Mic '+(i+1)+' · ':'')+lab.replace(/^Default\s*-\s*/,''),stream});if(fellBack&&o.warn)o.warn('Microphone '+(i+1)+' was not found, so the Windows default microphone is used.')}
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

function mount(host,it,api){css();let dead=false,bufs=null,pks=[],T=0,t=0,playing=null,raf=0,loop=false;
  host.innerHTML=`<div class="awrap"><div class="amain"><div class="alanes" data-r="lanes"><div class="aload">Opening audio…</div></div>
    <div class="atrans"><button class="btn pri" data-a="play" title="Play or pause (Space)">▶ Play</button><button class="btn" data-a="start" title="Back to the start (Home)">⏮ Start</button><label class="chk"><input type="checkbox" data-r="loop"> Loop</label><span class="atime" data-r="time">0:00.0 / 0:00.0</span><span style="flex:1"></span><button class="btn arec" data-a="rec" title="Record a new audio clip with the microphone settings in the top bar">● New recording</button></div></div>
   <div class="aside"><h3>Audio</h3><input type="text" data-r="name" aria-label="Name" value="${esc(it.name||'')}"><div class="ainfo" data-r="info"></div>
    <h3>Save</h3><p class="hint">Saves every track mixed together, as you hear it, with each track's volume, mute and solo.</p><button class="btn pri" data-a="save">Save audio (WAV)…</button>
    <h3>Tips</h3><p class="hint"><b>Space</b> plays and pauses. Click a waveform to move the playhead. <b>M</b> mutes and <b>S</b> solos a track.</p></div></div>`;
  const q=s=>host.querySelector(s),R=n=>q(`[data-r="${n}"]`);
  R('name').onchange=e=>{it.name=e.target.value.trim()||it.name;api.persist(it);api.renamed&&api.renamed(it)};
  q('[data-a="save"]').onclick=()=>api.save();q('[data-a="rec"]').onclick=()=>api.record();
  q('[data-a="play"]').onclick=()=>playing?pause():play();q('[data-a="start"]').onclick=()=>seek(0);R('loop').onchange=e=>{loop=e.target.checked};
  function info(){const size=it.tracks.reduce((n,x)=>n+(x.blob?.size||0),0);R('info').innerHTML=`<span>Length</span><b>${fmt(T)}</b><span>Tracks</span><b>${it.tracks.length}</b><span>Size</span><b>${(size/1048576).toFixed(2)} MB</b><span>Made</span><b>${it.created?new Date(it.created).toLocaleString():'—'}</b>`}
  function lanes(){const L=R('lanes');L.innerHTML='';it.tracks.forEach((tr,i)=>{const d=document.createElement('div');d.className='alane'+(audible(it.tracks)[i]?'':' amuted');d.innerHTML=`<div class="ahdr"><div class="anm" title="${esc(tr.name)}">${esc(tr.name||'Track '+(i+1))}</div><div class="arow"><input type="range" min="0" max="200" value="${Math.round((tr.vol==null?1:tr.vol)*100)}" aria-label="Volume of ${esc(tr.name)}"><span class="av">${Math.round((tr.vol==null?1:tr.vol)*100)}%</span></div><div class="arow"><button class="btn ams am" aria-pressed="${!!tr.mute}" title="Mute this track (M)">M</button><button class="btn ams as" aria-pressed="${!!tr.solo}" title="Solo: hear only this track (S)">S</button></div></div><canvas aria-label="Waveform of ${esc(tr.name)}" role="img"></canvas>`;
      const rg=d.querySelector('input'),av=d.querySelector('.av');rg.oninput=()=>{tr.vol=+rg.value/100;av.textContent=rg.value+'%';gains();};rg.onchange=()=>api.persist(it);
      d.querySelector('.am').onclick=()=>{tr.mute=!tr.mute;api.persist(it);lanes();gains()};d.querySelector('.as').onclick=()=>{tr.solo=!tr.solo;api.persist(it);lanes();gains()};
      const cv=d.querySelector('canvas');cv.onpointerdown=e=>{const r=cv.getBoundingClientRect(),to=x=>seek(clamp((x-r.left)/r.width,0,1)*T);to(e.clientX);cv.setPointerCapture(e.pointerId);cv.onpointermove=ev=>{if(ev.buttons)to(ev.clientX)};cv.onpointerup=()=>{cv.onpointermove=null}};
      d.onfocusin=d.onpointerdown=()=>{focusTrack=i};L.appendChild(d)});draw()}
  let focusTrack=0;
  function draw(){if(!bufs)return;q('.alanes')&&host.querySelectorAll('.alane canvas').forEach((cv,i)=>{const r=cv.getBoundingClientRect(),dpr=devicePixelRatio||1,w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}
      const g=cv.getContext('2d');g.clearRect(0,0,w,h);g.fillStyle='rgba(255,255,255,.05)';g.fillRect(0,h/2,w,1);const b=bufs[i];if(b)drawWave(g,pks[i],0,h*.08,Math.round(w*b.duration/T),h*.84,i===0?'#2db3a0':i===1?'#7aa7ff':'#f5c400',0,1);
      const x=Math.round(t/T*w);g.fillStyle='#ffffff';g.fillRect(x-Math.round(dpr/2),0,Math.max(1,Math.round(dpr*1.5)),h)});
    R('time').textContent=`${fmt(t)} / ${fmt(T)}`;q('[data-a="play"]').textContent=playing?'❚❚ Pause':'▶ Play'}
  function gains(){if(!playing)return;const on=audible(it.tracks);playing.g.forEach((g,i)=>{g.gain.setTargetAtTime(on[i]?(it.tracks[i].vol==null?1:it.tracks[i].vol):0,ac().currentTime,.02)})}
  async function play(){if(!bufs||playing)return;const a=ac();if(a.state==='suspended')await a.resume();if(t>=T-.02)t=0;const on=audible(it.tracks),start=a.currentTime+.05,from=t;
    const g=bufs.map((b,i)=>{const s=a.createBufferSource(),gn=a.createGain();s.buffer=b;gn.gain.value=on[i]?(it.tracks[i].vol==null?1:it.tracks[i].vol):0;s.connect(gn);gn.connect(a.destination);if(from<b.duration)s.start(start,from);return Object.assign(gn,{src:s})});
    playing={g,start,from};const step=()=>{if(dead||!playing)return;t=Math.min(T,playing.from+(ac().currentTime-playing.start));if(t>=T){stopSrc();t=loop?0:T;if(loop){draw();play();return}}draw();raf=requestAnimationFrame(step)};step()}
  function stopSrc(){if(!playing)return;playing.g.forEach(g=>{try{g.src.stop()}catch(_){}g.disconnect()});playing=null;cancelAnimationFrame(raf)}
  function pause(){if(!playing)return;t=Math.min(T,playing.from+(ac().currentTime-playing.start));stopSrc();draw()}
  function seek(x){const was=!!playing;stopSrc();t=clamp(x,0,T);draw();if(was)play()}
  const key=e=>{if(dead||e.ctrlKey||e.metaKey||e.altKey)return;const tg=e.target;if(tg&&(tg.isContentEditable||/INPUT|TEXTAREA|SELECT/.test(tg.tagName))&&!(tg.type==='range'||tg.type==='checkbox'))return;if(document.querySelector('.modal'))return;
    if(e.code==='Space'||e.key===' '){e.preventDefault();e.stopPropagation();playing?pause():play()}else if(e.key==='Home'){e.preventDefault();seek(0)}else if(e.key==='End'){e.preventDefault();seek(T)}
    else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){if(tg&&tg.type==='range')return;e.preventDefault();seek(t+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?5:1))}
    else if((e.key==='m'||e.key==='M')&&it.tracks[focusTrack]){e.preventDefault();e.stopPropagation();it.tracks[focusTrack].mute=!it.tracks[focusTrack].mute;api.persist(it);lanes();gains()}
    else if((e.key==='s'||e.key==='S')&&it.tracks[focusTrack]){e.preventDefault();e.stopPropagation();it.tracks[focusTrack].solo=!it.tracks[focusTrack].solo;api.persist(it);lanes();gains()}};
  document.addEventListener('keydown',key,true);
  const ro=new ResizeObserver(()=>draw());ro.observe(host);
  (async()=>{try{bufs=await buffers(it);if(dead)return;T=durOf(bufs)||0.1;pks=bufs.map(b=>peaks(b,4096));it.dur=T;info();lanes();api.ready&&api.ready(it);
      if(!it.thumb||it._thumbStale){it.thumb=await thumbFor(it);it._thumbStale=false;api.persist(it);api.thumbChanged&&api.thumbChanged(it)}}
    catch(e){if(!dead){R('lanes').innerHTML=`<div class="aload">This audio could not be opened. ${esc(e.message||'')}</div>`}}})();
  return{destroy(){dead=true;stopSrc();ro.disconnect();document.removeEventListener('keydown',key,true);host.innerHTML=''},play,pause,seek,get time(){return t},get duration(){return T},get playing(){return !!playing},isHome:false}}

root.AEdit={mount,home,record,renderWav,mix,wav,decode,buffers,peaks,thumbFor,fmt,MIC};
})(window);
