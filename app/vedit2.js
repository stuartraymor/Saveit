// Saveit video editor v3: multi-clip timeline, audio tracks + effects, transitions, overlays, captions, export.
(function(root){
const MIN=0.05;
const clone=o=>JSON.parse(JSON.stringify(o));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const fmt=t=>{t=Math.max(0,t||0);const m=Math.floor(t/60),s=t-m*60;return m+':'+(s<10?'0':'')+s.toFixed(1)};
const esc=t=>String(t==null?'':t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let HK={};
const NEEDS_BASE=['blur','spotlight','magnify'];

// ---------- media helpers ----------
const waitEv=(el,ev,ms)=>new Promise(res=>{let d=false;const f=()=>{if(d)return;d=true;el.removeEventListener(ev,f);res()};el.addEventListener(ev,f);setTimeout(f,ms||3000)});
function loadMeta(url,audioOnly){return new Promise((res,rej)=>{const v=document.createElement(audioOnly?'audio':'video');v.preload='auto';v.src=url;
  v.onerror=()=>rej(new Error('That file could not be opened.'));
  const done=()=>res({dur:isFinite(v.duration)?v.duration:0,w:v.videoWidth||0,h:v.videoHeight||0});
  v.onloadedmetadata=()=>{if(isFinite(v.duration)&&v.duration>0)return done();
    const f=()=>{v.removeEventListener('timeupdate',f);v.currentTime=0;setTimeout(done,60)};v.addEventListener('timeupdate',f);v.currentTime=1e101;setTimeout(done,4000)}})}
async function seekEl(el,t){t=Math.max(0,t);if(Math.abs(el.currentTime-t)<0.01&&el.readyState>=2)return;const w=waitEv(el,'seeked',2500);el.currentTime=t;await w;await new Promise(r=>setTimeout(r,16))}

// ---------- audio effects ----------
const EQ_F=[60,170,310,600,1000,3000,6000,12000],EQ_L=['60','170','310','600','1k','3k','6k','12k'];
const EQ_PRESETS={Flat:[0,0,0,0,0,0,0,0],'Voice boost':[-4,-2,0,2,4,5,2,-1],'Podcast':[-3,1,2,1,2,3,1,-2],'Bass boost':[7,5,3,0,0,0,0,0],'Treble boost':[0,0,0,0,0,2,5,7],'Reduce rumble':[-12,-6,0,0,0,0,0,0],'Phone / radio':[-12,-8,0,4,6,3,-8,-12],'Muffled':[0,0,0,-2,-5,-8,-10,-12],'Bright':[-2,-1,0,0,1,3,5,6]};
const defFx=()=>({eq:[0,0,0,0,0,0,0,0],lc:0,hc:0,comp:0,rev:0,echo:0,echoT:.3,gain:1});
function impulse(ac,sec){const n=Math.floor(ac.sampleRate*sec),b=ac.createBuffer(2,n,ac.sampleRate);for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,2.4)}return b}
function buildFx(ac){
  const inp=ac.createGain(),out=ac.createGain(),hp=ac.createBiquadFilter(),lp=ac.createBiquadFilter(),comp=ac.createDynamicsCompressor(),mk=ac.createGain();
  hp.type='highpass';hp.frequency.value=10;hp.Q.value=.7;lp.type='lowpass';lp.frequency.value=22000;lp.Q.value=.7;
  const eq=EQ_F.map((f,i)=>{const b=ac.createBiquadFilter();b.type=i===0?'lowshelf':i===EQ_F.length-1?'highshelf':'peaking';b.frequency.value=f;b.Q.value=1.0;b.gain.value=0;return b});
  inp.connect(hp);let n=hp;for(const b of eq){n.connect(b);n=b}n.connect(lp);lp.connect(comp);comp.connect(mk);
  const dry=ac.createGain(),rin=ac.createGain(),conv=ac.createConvolver(),rg=ac.createGain(),dl=ac.createDelay(1.5),fb=ac.createGain(),eg=ac.createGain();
  conv.buffer=impulse(ac,1.8);mk.connect(dry);dry.connect(out);mk.connect(rin);rin.connect(conv);conv.connect(rg);rg.connect(out);
  mk.connect(dl);dl.connect(fb);fb.connect(dl);dl.connect(eg);eg.connect(out);fb.gain.value=.35;rg.gain.value=0;eg.gain.value=0;
  const T=(p,v)=>{try{p.setTargetAtTime(v,ac.currentTime,.02)}catch(_){p.value=v}};
  return{input:inp,output:out,apply(fx){fx=Object.assign(defFx(),fx||{});eq.forEach((b,i)=>T(b.gain,+fx.eq[i]||0));
    T(hp.frequency,fx.lc>0?fx.lc:10);T(lp.frequency,fx.hc>0?fx.hc:22000);
    const a=(+fx.comp||0)/100;comp.threshold.value=-8-a*32;comp.ratio.value=1+a*11;comp.knee.value=12;comp.attack.value=.004;comp.release.value=.2;T(mk.gain,(fx.gain||1)*(1+a*.9));
    T(rg.gain,(+fx.rev||0)/100*1.1);dl.delayTime.value=clamp(+fx.echoT||.3,.05,1.4);T(eg.gain,(+fx.echo||0)/100*.9)}}}

// ---------- transitions ----------
const TRANS=[['none','Cut (no transition)'],['fade','Crossfade'],['dipblack','Dip to black'],['dipwhite','Dip to white'],['wiperight','Wipe → right'],['wipeleft','Wipe ← left'],['wipeup','Wipe ↑ up'],['wipedown','Wipe ↓ down'],['pushleft','Push ← left'],['pushright','Push → right'],['slideleft','Slide over ←'],['zoom','Zoom through'],['iris','Circle reveal'],['blur','Blur dissolve']];
function transition(g,A,B,p,type,W,H){const e=p*p*(3-2*p);p=e; // smooth
  const dA=(a=1)=>{g.globalAlpha=a;g.drawImage(A,0,0,W,H);g.globalAlpha=1},dB=(a=1)=>{g.globalAlpha=a;g.drawImage(B,0,0,W,H);g.globalAlpha=1};
  switch(type){
  case 'dipblack':case 'dipwhite':{g.fillStyle=type==='dipblack'?'#000':'#fff';g.fillRect(0,0,W,H);if(p<.5)dA(1-p*2);else dB((p-.5)*2);break}
  case 'wiperight':dA();g.save();g.beginPath();g.rect(0,0,W*p,H);g.clip();dB();g.restore();break;
  case 'wipeleft':dA();g.save();g.beginPath();g.rect(W*(1-p),0,W*p,H);g.clip();dB();g.restore();break;
  case 'wipedown':dA();g.save();g.beginPath();g.rect(0,0,W,H*p);g.clip();dB();g.restore();break;
  case 'wipeup':dA();g.save();g.beginPath();g.rect(0,H*(1-p),W,H*p);g.clip();dB();g.restore();break;
  case 'pushleft':g.drawImage(A,-W*p,0,W,H);g.drawImage(B,W-W*p,0,W,H);break;
  case 'pushright':g.drawImage(A,W*p,0,W,H);g.drawImage(B,-W+W*p,0,W,H);break;
  case 'slideleft':dA();g.drawImage(B,W-W*p,0,W,H);break;
  case 'zoom':{const s=1+p*.6;g.globalAlpha=1-p;g.drawImage(A,W/2-W*s/2,H/2-H*s/2,W*s,H*s);const s2=.7+p*.3;g.globalAlpha=p;g.drawImage(B,W/2-W*s2/2,H/2-H*s2/2,W*s2,H*s2);g.globalAlpha=1;break}
  case 'iris':dA();g.save();g.beginPath();g.arc(W/2,H/2,Math.hypot(W,H)/2*p,0,7);g.clip();dB();g.restore();break;
  case 'blur':{g.filter=`blur(${p*18}px)`;dA(1-p);g.filter=`blur(${(1-p)*18}px)`;dB(p);g.filter='none';break}
  default:dA();dB(p)}}

// ---------- captions ----------
function drawCaps(g,caps,t,w,h){for(const c of caps){if(!c.text||t<c.t0||t>c.t1)continue;const fs=Math.max(8,Math.round(h*(c.fs||6)/100)),lines=String(c.text).split('\n');g.save();g.font=`700 ${fs}px "Segoe UI",system-ui,sans-serif`;g.textBaseline='top';g.textAlign='center';
  const lw=Math.max(...lines.map(l=>g.measureText(l).width)),bh=lines.length*fs*1.25,pad=fs*.35,bx=w/2-lw/2-pad,m=h*.05;
  const by=c.pos==='t'?m:c.pos==='c'?(h-bh)/2:h-m-bh-pad*2;
  if(c.bg!==false){g.fillStyle='rgba(0,0,0,.62)';g.beginPath();(g.roundRect?g.roundRect(bx,by,lw+pad*2,bh+pad*2,fs*.25):g.rect(bx,by,lw+pad*2,bh+pad*2));g.fill()}
  g.fillStyle=c.c||'#fff';lines.forEach((l,i)=>g.fillText(l,w/2,by+pad+i*fs*1.25));g.restore()}}

// ---------- project model ----------
const clipLen=c=>(c.b-c.a)/(c.speed||1),clipEnd=c=>c.start+clipLen(c);
const vclips=e=>e.clips.slice().sort((a,b)=>a.start-b.start);
function total(e){let t=0;for(const c of e.clips)t=Math.max(t,clipEnd(c));for(const c of e.aud)t=Math.max(t,clipEnd(c));return t}
function newId(e,p){return p+(e.nextId++)}
function fillDefaults(e){e.srcs=e.srcs||[];e.clips=e.clips||[];e.aud=e.aud||[];e.caps=e.caps||[];e.ovs=e.ovs||[];e.master=Object.assign(defFx(),e.master||{});e.nextId=e.nextId||100;e.muteVideo=!!e.muteVideo;e.W=e.W||1280;e.H=e.H||720;
  for(const c of e.clips){c.speed=c.speed||1;c.vol=c.vol==null?1:c.vol;c.crop=c.crop||{l:0,t:0,r:0,b:0};c.trans=c.trans||{type:'none'};c.afi=c.afi||0;c.afo=c.afo||0}
  for(const c of e.aud){c.speed=c.speed||1;c.vol=c.vol==null?1:c.vol;c.afi=c.afi||0;c.afo=c.afo||0}return e}
function ensureProject(it,meta){let e=it.edit;
  if(e&&e.v===2)return fillDefaults(e);
  const old=e||{},D=meta.dur,sp=old.speed||1,segs=(old.segs&&old.segs.length)?old.segs:[{a:0,b:D}];
  const ne={v:2,srcs:[{id:'s0',self:true,name:it.name||'Video',kind:'video'}],clips:[],aud:[],caps:[],ovs:[],fadeIn:!!old.fadeIn,fadeOut:!!old.fadeOut,W:meta.w||1280,H:meta.h||720,master:defFx(),muteVideo:false,nextId:1};
  let pos=0;const map=[];
  segs.forEach(s=>{const c={id:'c'+(ne.nextId++),src:'s0',a:s.a,b:s.b,start:pos,speed:sp,vol:1,mute:!!old.mute,crop:Object.assign({l:0,t:0,r:0,b:0},old.crop||{}),trans:{type:'none'},afi:0,afo:0};ne.clips.push(c);map.push({a:s.a,b:s.b,pos,sp});pos+=(s.b-s.a)/sp});
  const t2=t=>{for(const m of map)if(t>=m.a&&t<=m.b)return m.pos+(t-m.a)/m.sp;for(const m of map)if(m.a>t)return m.pos;const l=map[map.length-1];return l.pos+(l.b-l.a)/l.sp};
  ne.caps=(old.caps||[]).map(c=>{const a=t2(c.t0);return{...c,t0:a,t1:Math.max(a+.1,t2(c.t1))}});
  ne.ovs=(old.ovs||[]).map(c=>{const a=t2(c.t0);return{...c,t0:a,t1:Math.max(a+.1,t2(c.t1))}});
  it.edit=ne;return fillDefaults(ne)}
// strip anything that can't be stored (kept simple: project is plain JSON already)
function pack(e){return e?JSON.parse(JSON.stringify(e)):null}
root.VEditCore={clipLen,clipEnd,total,transition,TRANS,EQ_PRESETS,defFx,ensureProject,fillDefaults};

// ---------- waveform peaks ----------
async function computePeaks(blob){try{if(!blob||blob.size>90*1048576)return null;const ac=new (window.AudioContext||window.webkitAudioContext)();const buf=await ac.decodeAudioData(await blob.arrayBuffer());ac.close&&ac.close();
  const per=40,n=Math.max(1,Math.ceil(buf.duration*per)),out=new Float32Array(n),ch=buf.getChannelData(0),step=Math.max(1,Math.floor(buf.sampleRate/per));
  for(let i=0;i<n;i++){let m=0;const s=i*step,eEnd=Math.min(ch.length,s+step);for(let j=s;j<eEnd;j+=Math.max(1,step>>6)){const a=Math.abs(ch[j]);if(a>m)m=a}out[i]=m}return out}catch(_){return null}}

// ---------- the playback / render engine ----------
function makeEngine(P){
  const e=P.e,rt=P.rt;
  const S={els:{},ac:null,master:null,mgain:null,out:null,t:0,playing:false,tok:0,last:0,raf:0,tmo:0,targets:[],mode:'preview',onEnd:null,onTick:null,offA:null,offB:null,seeking:0};
  const active=t=>e.clips.filter(c=>t>=c.start&&t<clipEnd(c)).sort((a,b)=>a.start-b.start);
  const wantTime=(c,t)=>c.a+(clamp(t,c.start,clipEnd(c))-c.start)*(c.speed||1);
  function connect(o,c){if(!S.ac||o.srcNode)return;const ac=S.ac;try{o.srcNode=ac.createMediaElementSource(o.el)}catch(_){return}o.fx=buildFx(ac);o.gain=ac.createGain();o.srcNode.connect(o.fx.input);o.fx.output.connect(o.gain);o.gain.connect(S.master.input);o.fx.apply(c.fx)}
  function ensureEl(c,isAud){const s=rt.src[c.src];const url=s&&s.url;let o=S.els[c.id];if(o&&o.url===url)return o;if(o)drop(c.id);
    const el=document.createElement(isAud?'audio':'video');el.preload='auto';el.playsInline=true;el.src=url||'';o={el,url,isAud,srcNode:null,fx:null,gain:null};S.els[c.id]=o;connect(o,c);return o}
  function drop(id){const o=S.els[id];if(!o)return;try{o.el.pause();o.srcNode&&o.srcNode.disconnect();o.gain&&o.gain.disconnect()}catch(_){}delete S.els[id]}
  function sync(){const ids=new Set([...e.clips,...e.aud].map(c=>c.id));for(const id of Object.keys(S.els))if(!ids.has(id))drop(id)}
  function unlock(){if(!S.ac){const AC=window.AudioContext||window.webkitAudioContext;S.ac=new AC();S.master=buildFx(S.ac);S.mgain=S.ac.createGain();S.out=S.ac.createGain();S.master.output.connect(S.mgain);S.mgain.connect(S.out);S.out.connect(S.ac.destination);S.master.apply(e.master);
      for(const c of e.clips){const o=S.els[c.id];if(o)connect(o,c)}for(const c of e.aud){const o=S.els[c.id];if(o)connect(o,c)}}
    if(S.ac.state==='suspended')S.ac.resume();return S.ac}
  function refreshFx(){if(!S.ac)return;S.master.apply(e.master);for(const c of [...e.clips,...e.aud]){const o=S.els[c.id];if(o&&o.fx)o.fx.apply(c.fx)}}
  function gainFor(c,t,isAud){let g=c.mute?0:(c.vol==null?1:c.vol);if(!isAud&&e.muteVideo)g=0;const len=clipLen(c),l=t-c.start;
    if(c.afi>0&&l<c.afi)g*=Math.max(0,l/c.afi);if(c.afo>0&&len-l<c.afo)g*=Math.max(0,(len-l)/c.afo);
    if(!isAud){const act=active(t),B=act[act.length-1],A=act.length>1?act[act.length-2]:null;
      if(B&&c!==B){if(c===A&&B.trans&&B.trans.type!=='none'){const T=Math.max(.05,Math.min(clipEnd(A),clipEnd(B))-B.start);g*=1-clamp((t-B.start)/T,0,1)}else g=0}
      else if(B&&c===B&&A&&B.trans&&B.trans.type!=='none'){const T=Math.max(.05,Math.min(clipEnd(A),clipEnd(B))-B.start);g*=clamp((t-B.start)/T,0,1)}}
    return clamp(g,0,4)}
  function tickAudio(t){if(!S.ac)return;for(const c of e.clips){const o=S.els[c.id];if(o&&o.gain)o.gain.gain.setTargetAtTime(gainFor(c,t,false),S.ac.currentTime,.02)}
    for(const c of e.aud){const o=S.els[c.id];if(o&&o.gain)o.gain.gain.setTargetAtTime(gainFor(c,t,true),S.ac.currentTime,.02)}
    const T=total(e);let m=1;if(e.fadeIn&&t<.6)m=Math.min(m,t/.6);if(e.fadeOut&&T-t<.6)m=Math.min(m,Math.max(0,(T-t)/.6));S.out.gain.setTargetAtTime(m,S.ac.currentTime,.02)}
  function syncPlay(t){for(const [c,isAud] of [...e.clips.map(c=>[c,false]),...e.aud.map(c=>[c,true])]){const o=ensureEl(c,isAud),el=o.el,act=t>=c.start&&t<clipEnd(c);
      if(act){const want=wantTime(c,t);if(el.playbackRate!==(c.speed||1))el.playbackRate=c.speed||1;if(el.paused){if(Math.abs(el.currentTime-want)>.04)el.currentTime=want;el.play().catch(()=>{})}else if(Math.abs(el.currentTime-want)>.35)el.currentTime=want}
      else{if(!el.paused)el.pause();const ds=c.start-t;if(!isAud&&ds>0&&ds<1.5&&Math.abs(el.currentTime-c.a)>.1)el.currentTime=c.a}}}
  async function prepare(t){await Promise.all(active(t).map(c=>seekEl(ensureEl(c,false).el,wantTime(c,t))))}
  // --- drawing (all in project space W x H, scaled onto each target) ---
  function offs(cw,ch){for(const k of ['offA','offB']){let c=S[k];if(!c){c=S[k]=document.createElement('canvas')}if(c.width!==cw||c.height!==ch){c.width=cw;c.height=ch}}return[S.offA,S.offB]}
  function drawClip(g,c){const o=S.els[c.id];if(!o)return;const el=o.el;if(el.readyState<2||!el.videoWidth)return;const W=e.W,H=e.H,cr=c.crop||{},l=Math.round(el.videoWidth*(cr.l||0)/100),tp=Math.round(el.videoHeight*(cr.t||0)/100),r=Math.round(el.videoWidth*(cr.r||0)/100),b=Math.round(el.videoHeight*(cr.b||0)/100),sw=Math.max(2,el.videoWidth-l-r),sh=Math.max(2,el.videoHeight-tp-b),k=Math.min(W/sw,H/sh),dw=sw*k,dh=sh*k;
    g.drawImage(el,l,tp,sw,sh,(W-dw)/2,(H-dh)/2,dw,dh)}
  function drawFrame(g,t,cw,ch){const W=e.W,H=e.H;g.save();g.setTransform(1,0,0,1,0,0);g.fillStyle='#000';g.fillRect(0,0,cw,ch);g.scale(cw/W,ch/H);
    const act=active(t);
    if(act.length){const B=act[act.length-1],A=act.length>1?act[act.length-2]:null;
      if(A&&B.trans&&B.trans.type!=='none'){const T=Math.max(.05,Math.min(clipEnd(A),clipEnd(B))-B.start),p=(t-B.start)/T;
        if(p<1){const [oa,ob]=offs(cw,ch),ga=oa.getContext('2d'),gb=ob.getContext('2d');for(const [gg,cc] of [[ga,A],[gb,B]]){gg.setTransform(1,0,0,1,0,0);gg.fillStyle='#000';gg.fillRect(0,0,cw,ch);gg.scale(cw/W,ch/H);drawClip(gg,cc)}
          g.save();g.setTransform(1,0,0,1,0,0);transition(g,oa,ob,clamp(p,0,1),B.trans.type,cw,ch);g.restore()}else drawClip(g,B)}
      else drawClip(g,B)}
    const ovs=e.ovs.filter(s=>t>=s.t0&&t<=s.t1);
    if(ovs.length&&HK.drawShape){let base={width:W,height:H};if(ovs.some(s=>NEEDS_BASE.includes(s.t))){base=document.createElement('canvas');base.width=W;base.height=H;base.getContext('2d').drawImage(g.canvas,0,0,W,H)}for(const s of ovs)HK.drawShape(g,s,base)}
    drawCaps(g,e.caps,t,W,H);
    const T=total(e);let a=0;if(e.fadeIn)a=Math.max(a,1-t/.6);if(e.fadeOut)a=Math.max(a,1-(T-t)/.6);if(a>0){g.fillStyle=`rgba(0,0,0,${clamp(a,0,1)})`;g.fillRect(0,0,W,H)}
    g.restore()}
  function render(){for(const tg of S.targets)drawFrame(tg.g,S.t,tg.cw,tg.ch)}
  async function seek(t){S.t=clamp(t,0,total(e));const tok=++S.tok;S.seeking++;try{await prepare(S.t)}finally{S.seeking--}if(tok===S.tok&&!S.playing)render();else if(S.playing)render()}
  function pauseEls(){for(const o of Object.values(S.els))try{o.el.pause()}catch(_){}}
  function stopPlay(){S.playing=false;cancelAnimationFrame(S.raf);clearTimeout(S.tmo);pauseEls()}
  function step(){if(!S.playing)return;const now=performance.now();S.t+=(now-S.last)/1000;S.last=now;const T=total(e);
    if(S.t>=T){S.t=T;stopPlay();render();S.onEnd&&S.onEnd();return}
    syncPlay(S.t);tickAudio(S.t);render();S.onTick&&S.onTick(S.t);if(!S.playing)return;if(S.mode==='export')S.tmo=setTimeout(step,33);else S.raf=requestAnimationFrame(step)}
  async function play(){unlock();if(S.playing)return;const T=total(e);if(S.t>=T-.02)S.t=0;S.playing=true;S.tok++;await prepare(S.t);if(!S.playing)return;S.last=performance.now();step()}
  function pause(){const was=S.playing;stopPlay();if(was)render()}
  async function exportRun(cw,ch,onProg,ctl){stopPlay();const ac=unlock(),T=total(e);if(T<=0)throw new Error('There is nothing on the timeline yet.');
    const cv=document.createElement('canvas');cv.width=cw;cv.height=ch;const g=cv.getContext('2d'),stream=cv.captureStream(30),dest=ac.createMediaStreamDestination();
    S.out.disconnect();S.out.connect(dest);dest.stream.getAudioTracks().forEach(t=>stream.addTrack(t));
    const want=[['webm',['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm']],['mp4',['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4']]],recs=[];
    for(const [k,l] of want){const m=l.find(x=>MediaRecorder.isTypeSupported(x));if(!m)continue;const chunks=[],r=new MediaRecorder(stream,{mimeType:m,videoBitsPerSecond:8e6,audioBitsPerSecond:192000});r.ondataavailable=ev=>{if(ev.data.size)chunks.push(ev.data)};recs.push({k,r,chunks,m,done:new Promise(res=>r.onstop=res)})}
    if(!recs.length){S.out.disconnect();S.out.connect(ac.destination);throw new Error('This computer cannot encode video here.')}
    const saved=S.targets,savedTick=S.onTick,savedEnd=S.onEnd;S.targets=[{g,cw,ch}];S.mode='export';
    try{S.t=0;await prepare(0);drawFrame(g,0,cw,ch);recs.forEach(x=>x.r.start(500));
      await new Promise(res=>{S.onEnd=res;S.onTick=t=>{onProg&&onProg(Math.min(1,t/T));if(ctl&&ctl.cancel){stopPlay();res()}};S.playing=true;S.tok++;S.last=performance.now();step()});
      await new Promise(r=>setTimeout(r,250));
    }finally{recs.forEach(x=>x.r.state!=='inactive'&&x.r.stop());await Promise.all(recs.map(x=>x.done));stopPlay();S.out.disconnect();S.out.connect(ac.destination);S.targets=saved;S.mode='preview';S.onTick=savedTick;S.onEnd=savedEnd;S.t=0;sync()}
    if(ctl&&ctl.cancel)return null;const o={};recs.forEach(x=>{o[x.k]=new Blob(x.chunks,{type:x.m.split(';')[0]})});return o}
  async function renderTimes(times,cw,ch,cb,ctl){stopPlay();const cv=document.createElement('canvas');cv.width=cw;cv.height=ch;const g=cv.getContext('2d',{willReadFrequently:true});
    for(let i=0;i<times.length;i++){if(ctl&&ctl.cancel)return false;S.t=times[i];await prepare(times[i]);drawFrame(g,times[i],cw,ch);await cb(g,i);if(i%3===2)await new Promise(r=>setTimeout(r,0))}return true}
  function snapshot(cw,ch){const c=document.createElement('canvas');c.width=cw||e.W;c.height=ch||e.H;drawFrame(c.getContext('2d'),S.t,c.width,c.height);return c}
  function destroy(){stopPlay();for(const id of Object.keys(S.els))drop(id);try{S.ac&&S.ac.close()}catch(_){}}
  return{S,e,unlock,play,pause,seek,render,sync,refreshFx,exportRun,renderTimes,snapshot,destroy,active,ensureEl,prepare,drawFrame,get t(){return S.t},set t(v){S.t=v},get playing(){return S.playing},setTargets(a){S.targets=a},onEnd(f){S.onEnd=f},onTick(f){S.onTick=f},gainFor}}

// ---------- styles ----------
function css(){if(document.getElementById('vedCss2'))return;const s=document.createElement('style');s.id='vedCss2';s.textContent=`
.vwrap{display:flex;flex-direction:row;min-height:0;min-width:0;height:100%;width:100%}
.vmain{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column}
.vwrap.vmin .vtlwrap,.vwrap.vmin .vz{display:none!important}.vwrap.vmin .vbox canvas.vprev{max-height:calc(100vh - 330px)}
.vside{width:350px;flex:none;background:var(--panel);border-left:1px solid var(--line);padding:10px 12px;display:flex;flex-direction:column;gap:9px;overflow-y:auto;min-height:0}
.vside>*{flex-shrink:0}.vinfo{border-top:1px solid var(--line);padding-top:8px;margin-top:auto}.vinfo-h{font-size:11px;color:var(--muted);margin-bottom:5px}
.vside .vrow input[type=number]{width:58px}
@media(max-width:900px){.vwrap{flex-direction:column}.vside{width:auto;border-left:0;border-top:1px solid var(--line);max-height:40vh}}
.vstage{flex:1;min-height:110px;display:grid;place-items:center;padding:8px;overflow:hidden}
.vbox{position:relative;display:inline-block;line-height:0;max-width:100%;max-height:100%}
.vbox canvas.vprev{display:block;background:#000;max-width:100%;max-height:calc(100vh - 400px);min-height:120px;width:auto;height:auto}
.vbox canvas.vov{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;touch-action:none}
.vpanel{background:var(--panel);border-top:1px solid var(--line);padding:8px 12px 10px;display:flex;flex-direction:column;gap:7px;overflow:visible}
.vpanel>*{flex-shrink:0}
.vtlwrap{overflow-x:auto;overflow-y:hidden;border-radius:6px;background:var(--check)}
.vpanel canvas.vtl{width:100%;height:140px;display:block;cursor:pointer;touch-action:none}
.vrow{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.vrow .btn{padding:4px 9px;font-size:12px}.vrow label{display:flex;gap:4px;align-items:center;color:var(--muted);font-size:12px}
.vrow input[type=number]{width:64px}.vrow .sp{flex:1}.vrow .btn[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:var(--accent-fg)}
.vtime{font-family:var(--f-mono);font-size:12px;min-width:150px}
.vcaps{display:flex;flex-direction:column;gap:5px}.vcaps .vrow{background:var(--panel-2);padding:5px;border-radius:7px}.vcaps input[type=text]{flex:1;min-width:120px}.vcaps .vrow.vsel{outline:2px solid #f5c400}
.vprog{height:6px;background:var(--check);border-radius:3px;overflow:hidden}.vprog i{display:block;height:100%;width:0;background:var(--accent)}
.vh{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:700}
.vtabs{display:flex;gap:4px;border-bottom:1px solid var(--line);padding-bottom:6px;flex-wrap:wrap}.vtabs button{border:1px solid var(--line);background:var(--panel-2);color:var(--fg);padding:5px 11px;border-radius:7px;cursor:pointer;font-weight:600;font-size:12px}.vtabs button[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:var(--accent-fg)}
.vsec{display:flex;flex-direction:column;gap:8px}.vtr{grid-template-columns:repeat(2,1fr)!important}.vsec[hidden]{display:none}.vnote{color:var(--muted);font-size:12px;margin:0}
.veq{display:flex;gap:6px;align-items:flex-end;background:var(--panel-2);padding:8px 10px;border-radius:8px}
.veq div{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;color:var(--muted);width:34px}
.veq input[type=range]{writing-mode:vertical-lr;direction:rtl;height:92px;width:22px;margin:0}
.vtr{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}.vtr .btn{justify-content:flex-start}
.vjoin .jr{display:flex;gap:6px;align-items:center;padding:5px 6px;background:var(--panel-2);border-radius:7px;margin-bottom:4px}.vjoin .jr b{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}`;document.head.appendChild(s)}

// ---------- the editor ----------
function mount(host,it,api){css();HK=api;
  it._edBlobs=it._edBlobs||{};
  host.innerHTML=`<div class="vmain"><div class="vstage"><div class="vbox"><canvas class="vprev"></canvas><canvas class="vov"></canvas></div></div>
  <div class="vpanel">
   <div class="vrow"><button class="btn" data-a="tog" title="Hide or show the timeline">▾ Hide timeline</button><button class="btn pri" data-a="play">Play</button><button class="btn" data-a="playall" title="Play everything from the start">Play all</button><button class="btn" data-a="mrestart" title="Back to the start and play">⏮ Restart</button><label><input type="checkbox" data-r="loop"> Loop</label><span class="vtime" data-r="time">Loading…</span><span class="sp"></span><span class="vz" style="display:contents"><button class="btn" data-a="zout" title="Zoom timeline out">−</button><span class="vh">Zoom</span><button class="btn" data-a="zin" title="Zoom timeline in">+</button></span></div>
   <div class="vtlwrap"><canvas class="vtl" aria-label="Timeline"></canvas></div>
  </div></div>
  <div class="vside">
   <div class="vrow"><span class="vnote" data-r="hint">Drag the circles on a bar to trim it. Drag the middle of a clip to move it, and slide it over another clip to overlap them.</span><span class="sp"></span>
     <label>In <input type="number" step="0.1" min="0" data-r="in"></label><button class="btn" data-a="setin" title="Mark In at playhead (I)">Set In</button><label>Out <input type="number" step="0.1" min="0" data-r="out"></label><button class="btn" data-a="setout" title="Mark Out at playhead (O)">Set Out</button></div>
   <div class="vrow"><button class="btn" data-a="split" title="Split at playhead (S)">Split</button><button class="btn" data-a="del" title="Delete the selected item (Del). Video clips close the gap.">Delete</button><button class="btn" data-a="delgap" title="Delete but leave a gap">Delete, keep gap</button>
     <button class="btn" data-a="cut" title="Remove the In–Out part from everything and close the gap">Cut out In–Out</button><button class="btn" data-a="trim" title="Keep only the In–Out part">Trim to In–Out</button>
     <button class="btn" data-a="addvid">Add videos…</button><span class="sp"></span><button class="btn" data-a="undo">Undo</button><button class="btn" data-a="reset">Reset</button></div>

   <div class="vtabs">${[['clip','Clip'],['audio','Audio'],['trans','Transitions'],['screen','On-screen'],['caps','Captions'],['export','Export']].map(([k,l])=>`<button data-tab="${k}" aria-pressed="${k==='clip'}">${l}</button>`).join('')}</div>
   <div class="vsec" data-sec="clip">
     <p class="vnote" data-r="clipnote">Click a clip on the timeline to edit it here.</p>
     <div class="vrow" data-r="cprops"><label>Start at <input type="number" step="0.1" min="0" data-c="start"> s</label><label>Source in <input type="number" step="0.1" min="0" data-c="a"></label><label>out <input type="number" step="0.1" min="0" data-c="b"></label>
       <label>Speed <select data-c="speed">${[.25,.5,.75,1,1.25,1.5,2,3,4].map(s=>`<option value="${s}">${s}×</option>`).join('')}</select></label>
       <span class="vh">Crop %</span><label>L <input type="number" min="0" max="90" data-cr="l"></label><label>T <input type="number" min="0" max="90" data-cr="t"></label><label>R <input type="number" min="0" max="90" data-cr="r"></label><label>B <input type="number" min="0" max="90" data-cr="b"></label></div>
     <div class="vrow"><span class="vh">Whole video</span><label>Size <select data-r="canvas"><option value="auto">Same as first clip</option><option value="1920x1080">1920 × 1080</option><option value="1280x720">1280 × 720</option><option value="854x480">854 × 480</option><option value="1080x1080">Square 1080</option><option value="1080x1920">Vertical 1080 × 1920</option></select></label>
       <label><input type="checkbox" data-r="fi"> Fade in from black</label><label><input type="checkbox" data-r="fo"> Fade out to black</label></div></div>
   <div class="vsec" data-sec="audio" hidden>
     <div class="vrow"><button class="btn pri" data-a="addaud">Add audio file…</button><button class="btn" data-a="rec">● Record voice-over</button><input type="file" accept="audio/*,video/*" data-r="audfile" hidden>
       <label><input type="checkbox" data-r="muteall"> Mute the video's own sound</label><span class="vnote" data-r="recnote">Voice-over starts at the playhead and plays the video as you talk. Use headphones to avoid echo.</span></div>
     <div class="vrow"><label>Selected clip volume <input type="range" min="0" max="300" data-c="vol" style="width:150px"></label><label><input type="checkbox" data-c="mute"> Mute this clip</label><label>Fade in <input type="number" min="0" step="0.1" data-c="afi"> s</label><label>Fade out <input type="number" min="0" step="0.1" data-c="afo"> s</label></div>
     <div class="vrow"><span class="vh">Sound effects for</span><label><select data-r="atarget"><option value="master">Everything (master)</option><option value="sel">Selected clip only</option></select></label>
       <label>Preset <select data-r="eqpre">${Object.keys(EQ_PRESETS).map(k=>`<option>${k}</option>`).join('')}</select></label><button class="btn" data-a="fxreset">Reset sound</button></div>
     <div class="veq" data-r="eq">${EQ_L.map((l,i)=>`<div><span data-r="eqv${i}">0</span><input type="range" min="-12" max="12" step="1" value="0" data-eq="${i}" aria-label="${l} Hz"><span>${l}</span></div>`).join('')}<span class="vnote" style="align-self:center;padding-left:8px">Equalizer: pull a band down to cut it, push up to boost.</span></div>
     <div class="vrow"><label>Low cut <input type="number" min="0" max="600" step="10" data-fx="lc"> Hz</label><label>High cut <input type="number" min="0" max="20000" step="500" data-fx="hc"> Hz</label>
       <label>Boost <input type="range" min="50" max="300" data-fx="gain" style="width:90px"></label><label>Level control <input type="range" min="0" max="100" data-fx="comp" style="width:90px"></label>
       <label>Reverb <input type="range" min="0" max="100" data-fx="rev" style="width:90px"></label><label>Echo <input type="range" min="0" max="100" data-fx="echo" style="width:90px"></label><label>Echo time <input type="range" min="5" max="140" data-fx="echoT" style="width:80px"></label></div></div>
   <div class="vsec" data-sec="trans" hidden>
     <p class="vnote" data-r="trnote">Click a video clip (not the first one), then choose how the picture changes into it. Slide a clip over the one before it to set how long the change takes.</p>
     <div class="vtr" data-r="trgrid">${TRANS.map(([k,l])=>`<button class="btn" data-tr="${k}" aria-pressed="false">${l}</button>`).join('')}</div>
     <div class="vrow"><label>Length <input type="number" min="0.1" max="10" step="0.1" data-r="trlen" value="1"> s</label><button class="btn" data-a="trlen">Set length</button><button class="btn" data-a="trall">Use this transition on every clip</button></div></div>
   <div class="vsec" data-sec="screen" hidden>
     <div class="vrow"><span class="vh">Draw on video</span>${[['select','Select'],['arrow','Arrow'],['rect','Box'],['ellipse','Circle'],['line','Line'],['highlight','Highlight'],['text','Text'],['step','Step #'],['stamp','Stamp'],['blur','Blur']].map(([k,l])=>`<button class="btn" data-ot="${k}" aria-pressed="false">${l}</button>`).join('')}
       <label>Colour <input type="color" data-r="ocol" value="#e5483b"></label><label>Width <input type="number" min="1" max="40" data-r="owid" value="6"></label></div>
     <div class="vrow" data-r="osel" hidden><b data-r="olbl">Selected</b><label>shows from <input type="number" step="0.1" min="0" data-r="of"></label><label>to <input type="number" step="0.1" min="0" data-r="ot2"></label><button class="btn" data-a="ostart">Start here</button><button class="btn" data-a="oend">End here</button><button class="btn" data-a="odup">Duplicate</button><button class="btn" data-a="odel">Remove</button></div>
     <p class="vnote">Pick a tool, drag on the picture. The red bars on the timeline show when each item appears. Drag the circles to change that.</p></div>
   <div class="vsec" data-sec="caps" hidden><div class="vrow"><button class="btn" data-a="addcap">Add caption at playhead</button></div><div class="vcaps" data-r="caps"></div></div>
   <div class="vsec" data-sec="export" hidden>
     <div class="vrow"><span class="vh">Video</span><label>Quality <select data-r="osize"><option value="project">Full size</option><option value="720">720p</option><option value="480">480p</option></select></label><button class="btn pri" data-a="apply">Save edited video</button></div>
     <div class="vrow"><span class="vh">GIF</span><label>frames/sec <input type="number" min="1" max="30" value="10" data-r="fps"></label><label>width <input type="number" min="64" max="1920" step="20" value="480" data-r="gw"></label><button class="btn pri" data-a="gif">Save GIF</button><button class="btn" data-a="stop" hidden>Cancel</button></div>
     <p class="vnote">Saving plays your edit once in real time (a 1-minute edit takes about a minute) and adds the result to your library.</p></div>
   <div class="vprog" data-r="prog" hidden><i></i></div><div class="vinfo"></div>
  </div>`;
  const q=s=>host.querySelector(s),qa=s=>[...host.querySelectorAll(s)],R=n=>q(`[data-r="${n}"]`),prev=q('.vprev'),ov=q('.vov'),tl=q('.vtl');
  const pg=prev.getContext('2d');
  let eng=null,e=null,rt={src:{}},sel=null,inT=0,outT=0,hist=[],zoom=1,L=[],tdrag=null,tsnap=false,otool=null,odrag=null,playRange=null,dead=false,raf=0,exp=null,tab='clip',rec=null,ready=false;
  const toast=api.toast;
  const D=()=>Math.max(total(e||{clips:[],aud:[]}),0.1);
  const selOv=()=>sel&&sel.type==='ov'?sel.ref:null,selCap=()=>sel&&sel.type==='cap'?sel.ref:null,selClip=()=>sel&&(sel.type==='clip'||sel.type==='aud')?sel.ref:null;
  const snap=()=>{hist.push(JSON.stringify(e));if(hist.length>60)hist.shift()};
  const changed=()=>{try{api.changed&&api.changed()}catch(_){}};
  const redraw=()=>{if(eng)eng.seek(eng.t)};
  function sizePrev(){const cw=Math.min(960,e.W),ch=Math.round(cw*e.H/e.W);prev.width=cw;prev.height=ch;ov.width=e.W;ov.height=e.H;prev.style.aspectRatio=cw+'/'+ch;eng.setTargets([{g:pg,cw,ch}]);redraw()}
  function select(type,ref){sel=type?{type,ref}:null;refreshProps();ovui()}

  // ----- timeline -----
  const PAD=11,LANE=18,CL=28;
  const xOf=t=>PAD+t/D()*(tl.clientWidth-2*PAD),tOf=x=>clamp((x-PAD)/Math.max(1,tl.clientWidth-2*PAD)*D(),0,D());
  function lanes(items,rng){const ends=[],out=[];for(const x of [...items].sort((a,b)=>rng(a)[0]-rng(b)[0])){let l=0;const [s,en]=rng(x);while(ends[l]!==undefined&&ends[l]>s+1e-6)l++;ends[l]=en;out.push([x,l])}return{out,n:Math.max(1,ends.length)}}
  const isSel=x=>sel&&sel.ref===x.ref;
  function layout(){const G=[];let y=20;L=[];
    const vs=[];e.clips.forEach(c=>{if(!vs.includes(c.src))vs.push(c.src)});const vl={out:e.clips.map(c=>[c,vs.indexOf(c.src)]),n:Math.max(1,vs.length)},al=lanes(e.aud,c=>[c.start,clipEnd(c)]),cl=lanes(e.caps,c=>[c.t0,c.t1]),ol=lanes(e.ovs,c=>[c.t0,c.t1]);
    const add=(name,g,type,h,rng)=>{G.push({name,y:y+10});y+=12;g.out.forEach(([c,l])=>{const [s,en]=rng(c);L.push({type,ref:c,t0:s,t1:en,y:y+l*(h+3),h})});y+=g.n*(h+3)+4};
    add('VIDEO',vl,'clip',CL,c=>[c.start,clipEnd(c)]);add('AUDIO · music and voice-over',al,'aud',22,c=>[c.start,clipEnd(c)]);add('CAPTIONS',cl,'cap',LANE-3,c=>[c.t0,c.t1]);add('ON-SCREEN ITEMS · arrows, text, stamps',ol,'ov',LANE-3,c=>[c.t0,c.t1]);
    return{H:y+4,G}}
  const srcName=id=>{const s=e.srcs.find(x=>x.id===id);return s?s.name:'Clip'};
  const srcIdx=id=>Math.max(0,e.srcs.findIndex(x=>x.id===id));
  const PALETTE=['#2db3a0','#5aa2ff','#b07cf5','#f08a3c','#4cc16b','#e65f8a'];
  const ovName=o=>({arrow:'Arrow',rect:'Box',ellipse:'Circle',line:'Line',highlight:'Highlight',text:'Text',step:'Step '+(o.n||''),stamp:'Stamp',blur:'Blur'})[o.t]||'Item';
  let lastD=0;
  function drawTl(){{const d=D();if(Math.abs(outT-lastD)<.02||outT>d)outT=d;if(inT>outT-.1)inT=0;lastD=d}const dpr=devicePixelRatio||1,lay=layout();tl.style.width=Math.max(1,zoom)*100+'%';tl.style.height=lay.H+'px';const W=tl.clientWidth,H=lay.H;if(!W)return;
    if(tl.width!==Math.round(W*dpr)||tl.height!==Math.round(H*dpr)){tl.width=Math.round(W*dpr);tl.height=Math.round(H*dpr)}
    const g=tl.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,W,H);
    const circ=(x,y,r,fill,stroke)=>{g.beginPath();g.arc(x,y,r,0,7);g.fillStyle=fill;g.fill();g.lineWidth=2;g.strokeStyle=stroke;g.stroke()};
    g.fillStyle='rgba(255,255,255,.55)';g.strokeStyle='rgba(255,255,255,.3)';g.lineWidth=1;g.font='10px monospace';
    const steps=[.1,.25,.5,1,2,5,10,15,30,60,120,300,600],stp=steps.find(s=>xOf(s)-xOf(0)>=64)||600,T=D();
    for(let t=0;t<=T+1e-6;t+=stp){const x=Math.round(xOf(t))+.5;g.beginPath();g.moveTo(x,10);g.lineTo(x,17);g.stroke();g.fillText(fmt(t),x+3,14)}
    g.fillStyle='rgba(255,255,255,.45)';g.font='10px sans-serif';for(const gr of lay.G)g.fillText(gr.name,4,gr.y);
    g.fillStyle='rgba(90,162,255,.16)';g.fillRect(xOf(inT),18,xOf(outT)-xOf(inT),H-18);
    for(const x of L){const x0=xOf(x.t0),x1=Math.max(x0+4,xOf(x.t1)),s=isSel(x),y=x.y,h=x.h,ym=y+h/2;
      let col=x.type==='clip'?PALETTE[srcIdx(x.ref.src)%PALETTE.length]:x.type==='aud'?'#8c6bd8':x.type==='cap'?'#f5c400':'#e5483b';
      g.globalAlpha=.9;g.fillStyle=col;g.beginPath();(g.roundRect?g.roundRect(x0,y,x1-x0,h,4):g.rect(x0,y,x1-x0,h));g.fill();g.globalAlpha=1;
      if(x.type==='clip'||x.type==='aud'){const pk=rt.src[x.ref.src]&&rt.src[x.ref.src].peaks;if(pk){g.save();g.beginPath();g.rect(x0,y,x1-x0,h);g.clip();g.strokeStyle='rgba(255,255,255,.55)';g.lineWidth=1;g.beginPath();const sp=x.ref.speed||1,pxPer=(x1-x0)/Math.max(.01,x.t1-x.t0);for(let px=Math.floor(x0);px<x1;px+=2){const t=x.ref.a+((px-x0)/pxPer)*sp,i=Math.floor(t*40),v=pk[i]||0;g.moveTo(px,ym-v*h*.45);g.lineTo(px,ym+v*h*.45)}g.stroke();g.restore()}}
      if(s){g.lineWidth=2.5;g.strokeStyle='#fff';g.beginPath();(g.roundRect?g.roundRect(x0,y,x1-x0,h,4):g.rect(x0,y,x1-x0,h));g.stroke()}
      const label=x.type==='clip'||x.type==='aud'?srcName(x.ref.src)+'  '+fmt(clipLen(x.ref))+(x.ref.speed&&x.ref.speed!==1?'  '+x.ref.speed+'×':'')+(x.ref.mute?'  (muted)':''):x.type==='cap'?(x.ref.text||'Caption'):ovName(x.ref)+(x.ref.txt?': '+x.ref.txt:'');
      g.save();g.beginPath();g.rect(x0+8,y,Math.max(0,x1-x0-16),h);g.clip();g.fillStyle=x.type==='cap'?'#111':'#fff';g.font='600 11px sans-serif';g.shadowColor='rgba(0,0,0,.6)';g.shadowBlur=x.type==='cap'?0:3;g.fillText(label,x0+10,ym+4);g.restore();
      const r=s?7:5.5;circ(x0,ym,r,'#fff',col);circ(x1,ym,r,'#fff',col)}
    // transition overlaps
    for(const B of e.clips){if(!B.trans||B.trans.type==='none')continue;const A=e.clips.filter(c=>c!==B&&c.start<B.start&&clipEnd(c)>B.start).sort((a,b)=>b.start-a.start)[0];if(!A)continue;
      const s=B.start,en=Math.min(clipEnd(A),clipEnd(B)),bx=L.find(z=>z.ref===B);if(!bx)continue;g.save();g.beginPath();g.rect(xOf(s),bx.y,xOf(en)-xOf(s),bx.h);g.clip();g.fillStyle='rgba(255,255,255,.28)';g.fill();g.strokeStyle='rgba(255,255,255,.7)';g.lineWidth=1;for(let px=xOf(s)-bx.h;px<xOf(en);px+=7){g.beginPath();g.moveTo(px,bx.y+bx.h);g.lineTo(px+bx.h,bx.y);g.stroke()}g.fillStyle='#fff';g.font='700 10px sans-serif';g.fillText('⇄ '+(TRANS.find(z=>z[0]===B.trans.type)||[0,''])[1],xOf(s)+3,bx.y+bx.h-4);g.restore()}
    g.strokeStyle='#5aa2ff';g.lineWidth=1.5;for(const t of [inT,outT]){const x=xOf(t);g.beginPath();g.moveTo(x,17);g.lineTo(x,H-2);g.stroke()}
    circ(xOf(inT),9,6,'#5aa2ff','#fff');circ(xOf(outT),9,6,'#5aa2ff','#fff');g.fillStyle='#fff';g.font='bold 8px sans-serif';g.fillText('I',xOf(inT)-2,12);g.fillText('O',xOf(outT)-3,12);
    const px=xOf(eng.t);g.fillStyle='#fff';g.fillRect(px-1,0,2,H);g.beginPath();g.moveTo(px-6,0);g.lineTo(px+6,0);g.lineTo(px,8);g.fill();
    if(zoom>1&&eng.playing){const w=tl.parentElement;if(px<w.scrollLeft+20||px>w.scrollLeft+w.clientWidth-20)w.scrollLeft=Math.max(0,px-w.clientWidth*.3)}}

  // ----- timeline interaction -----
  const HR=9,tget=x=>x.type==='clip'||x.type==='aud'?[x.ref.start,clipEnd(x.ref)]:[x.ref.t0,x.ref.t1];
  function hitTl(x,y){for(const t of [inT,outT])if(Math.hypot(xOf(t)-x,9-y)<=HR)return{kind:t===inT?'in':'out'};
    for(const it2 of [...L].sort((a,b)=>isSel(b)-isSel(a))){const ym=it2.y+it2.h/2;if(Math.hypot(xOf(it2.t0)-x,ym-y)<=HR)return{kind:'edge',it:it2,edge:0};if(Math.hypot(xOf(it2.t1)-x,ym-y)<=HR)return{kind:'edge',it:it2,edge:1}}
    for(const it2 of [...L].reverse())if(y>=it2.y-2&&y<=it2.y+it2.h+2&&x>=xOf(it2.t0)&&x<=Math.max(xOf(it2.t0)+4,xOf(it2.t1)))return{kind:'body',it:it2};
    if(Math.abs(xOf(eng.t)-x)<=6&&y<12)return{kind:'head'};return{kind:'seek'}}
  const snapT=(t,self)=>{if(tsnap)return t;const tol=7/Math.max(1,tl.clientWidth)*D(),c=[0,D(),eng.t];for(const x of L)if(x.ref!==self)c.push(x.t0,x.t1);let b=t,bd=tol;for(const v of c){const d=Math.abs(v-t);if(d<bd){bd=d;b=v}}return b};
  function dragEdge(d,t){const x=d.it,ref=x.ref;
    if(x.type==='clip'||x.type==='aud'){const sp=ref.speed||1,sd=(rt.src[ref.src]&&rt.src[ref.src].dur)||ref.b;
      if(d.edge===0){const ts=snapT(t,ref);let na=ref.a+(ts-ref.start)*sp;na=clamp(na,Math.max(0,ref.a-ref.start*sp),ref.b-MIN*sp);ref.start+=(na-ref.a)/sp;ref.a=na;eng.seek(ref.start)}
      else{const te=snapT(t,ref);ref.b=clamp(ref.a+(te-ref.start)*sp,ref.a+MIN*sp,sd);eng.seek(clipEnd(ref)-.02)}}
    else if(d.edge===0){ref.t0=clamp(snapT(t,ref),0,ref.t1-.1);eng.seek(ref.t0)}else{ref.t1=Math.max(ref.t0+.1,snapT(t,ref));eng.seek(Math.max(0,ref.t1-.02))}}
  function dragMove(d,t){const ref=d.it.ref,len=d.len;let na=Math.max(0,t-d.off);const s1=snapT(na,ref),s2=snapT(na+len,ref)-len;na=Math.abs(s1-na)<=Math.abs(s2-na)?s1:s2;na=Math.max(0,na);
    if(d.it.type==='clip'||d.it.type==='aud')ref.start=na;else{ref.t0=na;ref.t1=na+len}}
  tl.addEventListener('pointerdown',ev=>{if(!ready)return;tl.setPointerCapture(ev.pointerId);tsnap=ev.altKey;const x=ev.offsetX,y=ev.offsetY,h=hitTl(x,y);
    if(h.kind==='in'||h.kind==='out'){select(null);playRange=null;tdrag={k:h.kind};return}
    if(h.kind==='edge'){select(h.it.type,h.it.ref);tdrag={k:'edge',it:h.it,edge:h.edge,moved:false};return}
    if(h.kind==='body'){select(h.it.type,h.it.ref);const [a,b]=tget(h.it);tdrag={k:'move',it:h.it,off:tOf(x)-a,len:b-a,moved:false};playRange=null;return}
    if(h.kind==='head'){tdrag={k:'seek'};return}
    select(null);playRange=null;tdrag={k:'seek'};eng.pause();eng.seek(tOf(x))});
  tl.addEventListener('pointermove',ev=>{if(!ready)return;const x=ev.offsetX,y=ev.offsetY;
    if(!tdrag){const h=hitTl(x,y);tl.style.cursor=h.kind==='edge'||h.kind==='in'||h.kind==='out'||h.kind==='head'?'ew-resize':h.kind==='body'?'grab':'pointer';return}
    const t=tOf(x),d=tdrag;
    if(d.k==='seek'){eng.seek(t);return}
    if(d.k==='in'){inT=clamp(snapT(t),0,outT-.1);eng.seek(inT);return}
    if(d.k==='out'){outT=clamp(snapT(t),inT+.1,D());eng.seek(outT);return}
    if(!d.moved){snap();d.moved=true}
    if(d.k==='edge')dragEdge(d,t);else dragMove(d,t)});
  tl.addEventListener('pointerup',()=>{const d=tdrag;tdrag=null;if(d&&d.moved){changed();eng.seek(eng.t);refreshProps();if(d.it&&d.it.type==='cap')caplist();if(d.it&&d.it.type==='ov')ovui()}});

  // ----- editing actions -----
  function removeSpan(a,b){const gap=b-a;if(gap<=0)return;
    for(const key of ['clips','aud']){const out=[];for(const c of e[key]){const s=c.start,en=clipEnd(c),sp=c.speed||1;
      if(en<=a){out.push(c)}else if(s>=b){c.start-=gap;out.push(c)}
      else{const keepL=s<a,keepR=en>b;let right=null;
        if(keepR){right=clone(c);right.id=newId(e,key==='clips'?'c':'a');right.a=c.a+(b-s)*sp;right.start=a;right.afi=0;right.trans={type:'none'}}
        if(keepL){c.b=c.a+(a-s)*sp;c.afo=0;if(c.b-c.a>MIN*sp)out.push(c)}
        if(right&&right.b-right.a>MIN*sp)out.push(right)}}
      e[key]=out}
    for(const key of ['caps','ovs']){const out=[];for(const c of e[key]){if(c.t1<=a)out.push(c);else if(c.t0>=b){c.t0-=gap;c.t1-=gap;out.push(c)}
      else if(c.t0<a&&c.t1>b){c.t1-=gap;out.push(c)}else if(c.t0<a){c.t1=a;if(c.t1-c.t0>.1)out.push(c)}else if(c.t1>b){c.t0=a;c.t1-=gap;out.push(c)}}e[key]=out}}
  const act={
    tog(){host.classList.toggle('vmin');q('[data-a="tog"]').textContent=host.classList.contains('vmin')?'▴ Show timeline':'▾ Hide timeline';requestAnimationFrame(()=>{sizePrev&&sizePrev();drawTl()})},mplay(){if(eng.playing)eng.pause();else{playRange=null;eng.unlock();eng.play()}},mrestart(){eng.pause();playRange=null;eng.seek(0);eng.unlock();eng.play()},
    play(){togglePlay()},playall(){playAll()},zin(){zoom=Math.min(16,zoom*1.6);keepHead()},zout(){zoom=Math.max(1,zoom/1.6);if(zoom<1.05)zoom=1;keepHead()},
    setin(){select(null);inT=Math.min(eng.t,outT-.1)},setout(){select(null);outT=Math.max(eng.t,inT+.1)},
    split(){const t=eng.t,targets=selClip()?[sel]:[...e.clips.map(c=>({type:'clip',ref:c})),...e.aud.map(c=>({type:'aud',ref:c}))];let n=0;snap();
      for(const tg of targets){const c=tg.ref;if(t>c.start+MIN&&t<clipEnd(c)-MIN){const sp=c.speed||1,c2=clone(c);c2.id=newId(e,tg.type==='clip'?'c':'a');c2.a=c.a+(t-c.start)*sp;c2.start=t;c2.afi=0;c2.trans={type:'none'};c.b=c2.a;c.afo=0;(tg.type==='clip'?e.clips:e.aud).push(c2);n++}}
      if(!n){hist.pop();toast('Move the playhead inside a clip first.');return}eng.sync();redraw();changed()},
    del(){doDelete(false)},delgap(){doDelete(true)},
    cut(){if(outT-inT<.1){toast('Set In and Out first.');return}snap();removeSpan(inT,outT);inT=0;outT=D();sel=null;eng.sync();eng.t=Math.min(eng.t,D());redraw();refreshAll();changed();toast('Cut out. The gap closed up.')},
    trim(){if(outT-inT<.1){toast('Set In and Out first.');return}snap();removeSpan(outT,total(e)+1e5);removeSpan(0,inT);inT=0;outT=D();sel=null;eng.sync();eng.t=0;redraw();refreshAll();changed()},
    undo(){const h=hist.pop();if(!h){toast('Nothing to undo.');return}for(const k of Object.keys(e))delete e[k];Object.assign(e,JSON.parse(h));sel=null;eng.sync();eng.refreshFx();sizePrev();inT=Math.min(inT,D());outT=D();refreshAll();changed()},
    reset(){snap();const keep=e.clips.filter(c=>c.src===(e.srcs.find(s=>s.self)||{}).id);const s0=e.srcs.find(s=>s.self);const dur=rt.src[s0.id].dur;e.clips=[{id:newId(e,'c'),src:s0.id,a:0,b:dur,start:0,speed:1,vol:1,mute:false,crop:{l:0,t:0,r:0,b:0},trans:{type:'none'},afi:0,afo:0}];e.aud=[];e.caps=[];e.ovs=[];e.master=defFx();e.muteVideo=false;e.fadeIn=e.fadeOut=false;sel=null;eng.sync();eng.refreshFx();inT=0;outT=D();eng.t=0;redraw();refreshAll();changed()},
    addvid(){addVideosDialog()},addaud(){R('audfile').click()},rec(){toggleRec()},
    fxreset(){snap();const c=fxTarget();if(c)c.fx=defFx();else e.master=defFx();eng.refreshFx();showFx();changed()},
    trlen(){const c=selClip();if(!c||sel.type!=='clip'){toast('Click a video clip first.');return}snap();if(setOverlap(c,+R('trlen').value||1)){redraw();refreshProps();changed()}else hist.pop()},
    trall(){const c=selClip();if(!c||sel.type!=='clip'){toast('Click a video clip first.');return}snap();const type=c.trans.type,len=+R('trlen').value||1;const list=vclips(e);for(let i=1;i<list.length;i++){list[i].trans={type};if(type!=='none')setOverlap(list[i],len)}redraw();refreshProps();changed()},
    ostart(){const o=selOv();if(o){o.t0=Math.min(eng.t,o.t1-.1);ovui();changed()}},oend(){const o=selOv();if(o){o.t1=Math.max(eng.t,o.t0+.1);ovui();changed()}},
    odup(){const o=selOv();if(!o)return;snap();const c=clone(o);c.id=(c.id||0)+1000+e.ovs.length;HK.moveShape(c,30,30);e.ovs.push(c);select('ov',c);changed()},
    odel(){const o=selOv();if(!o)return;snap();e.ovs=e.ovs.filter(z=>z!==o);select(null);changed()},
    addcap(){snap();const t=eng.t,nc={t0:t,t1:t+3,text:'New caption',pos:'b',fs:6,c:'#ffffff',bg:true};e.caps.push(nc);select('cap',nc);caplist();changed()},
    apply(){run('video')},gif(){run('gif')},stop(){if(exp)exp.cancel=true}};
  function doDelete(keepGap){if(!sel){toast('Click something on the timeline first.');return}snap();const r=sel.ref,ty=sel.type;
    if(ty==='clip'){const end=clipEnd(r),len=clipLen(r);e.clips=e.clips.filter(c=>c!==r);if(!keepGap){for(const c of e.clips)if(c.start>=end-1e-6)c.start-=len;for(const c of e.aud)if(c.start>=end-1e-6)c.start-=len;for(const c of [...e.caps,...e.ovs])if(c.t0>=end-1e-6){c.t0-=len;c.t1-=len}}}
    else if(ty==='aud')e.aud=e.aud.filter(c=>c!==r);else if(ty==='cap')e.caps=e.caps.filter(c=>c!==r);else e.ovs=e.ovs.filter(c=>c!==r);
    sel=null;eng.sync();eng.t=Math.min(eng.t,D());refreshAll();redraw();changed()}
  const vclips=ee=>ee.clips.slice().sort((a,b)=>a.start-b.start);
  function prevOf(c){const l=vclips(e).filter(x=>x!==c&&x.start<c.start);return l[l.length-1]||null}
  function setOverlap(c,len){const p=prevOf(c);if(!p){toast('This is the first clip, so there is nothing to change from.');return false}
    len=clamp(len,.1,Math.max(.1,Math.min(clipLen(p),clipLen(c))));const delta=(clipEnd(p)-len)-c.start;for(const x of e.clips)if(x===c||x.start>=c.start)x.start=Math.max(0,x.start+delta);return true}
  const keepHead=()=>requestAnimationFrame(()=>{const w=tl.parentElement;w.scrollLeft=Math.max(0,xOf(eng.t)-w.clientWidth/2)});
  host.addEventListener('click',ev=>{const b=ev.target.closest('[data-a]');if(!b||!ready)return;const f=act[b.dataset.a];if(f)f()});

  // ----- playback -----
  function curRange(){if(sel){if(sel.type==='clip'||sel.type==='aud')return[sel.ref.start,clipEnd(sel.ref),sel.type==='aud'?'audio':'clip'];if(sel.type==='cap')return[sel.ref.t0,sel.ref.t1,'caption'];return[sel.ref.t0,sel.ref.t1,'item']}if(inT>.05||outT<D()-.05)return[inT,outT,'In–Out'];return null}
  async function togglePlay(){if(eng.playing){eng.pause();playRange=null;return}const r=curRange();if(r){playRange={a:r[0],b:r[1]};eng.t=r[0]}else playRange=null;eng.unlock();await eng.play()}
  async function playAll(){eng.pause();playRange=null;eng.t=0;await eng.play()}
  function onTick(t){if(playRange&&t>=playRange.b-.02){if(R('loop').checked){const a=playRange.a;eng.pause();eng.seek(a).then(()=>eng.play())}else{eng.pause();eng.t=playRange.b;eng.render();playRange=null}}}

  // ----- panels -----
  qa('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;qa('[data-tab]').forEach(x=>x.setAttribute('aria-pressed',x===b));qa('[data-sec]').forEach(s=>s.hidden=s.dataset.sec!==tab);if(tab==='audio')showFx();if(tab==='trans')refreshProps()});
  const setTab=k=>{const b=q(`[data-tab="${k}"]`);if(b)b.click()};
  function refreshProps(){const c=selClip(),isV=sel&&sel.type==='clip';
    R('clipnote').textContent=c?(srcName(c.src)+(isV?' — video clip':' — audio clip')):'Click a clip on the timeline to edit it here.';
    const row=R('cprops');row.style.opacity=c?1:.45;row.style.pointerEvents=c?'':'none';
    if(c){qa('[data-c]').forEach(i=>{const k=i.dataset.c;if(k==='vol')i.value=Math.round((c.vol==null?1:c.vol)*100);else if(i.type==='checkbox')i.checked=!!c[k];else if(k==='speed')i.value=String(c.speed||1);else i.value=(+c[k]||0).toFixed(k==='afi'||k==='afo'?1:2)});
      qa('[data-cr]').forEach(i=>{i.value=(c.crop&&c.crop[i.dataset.cr])||0;i.disabled=!isV})}
    // transitions
    const hasPrev=isV&&prevOf(c);R('trnote').textContent=isV?(hasPrev?'Transition into: '+srcName(c.src):'This is the first clip, so it has no transition into it. Click a later clip.'):'Click a video clip (not the first one), then choose how the picture changes into it. Slide a clip over the one before it to set how long the change takes.';
    qa('[data-tr]').forEach(b=>{b.setAttribute('aria-pressed',!!(isV&&c.trans&&c.trans.type===b.dataset.tr));b.disabled=!hasPrev});
    if(hasPrev){const p=prevOf(c);R('trlen').value=Math.max(.1,clipEnd(p)-c.start).toFixed(1)}
    if(tab==='audio')showFx()}
  qa('[data-c]').forEach(i=>i.addEventListener('change',()=>{const c=selClip();if(!c)return;snap();const k=i.dataset.c,v=i.type==='checkbox'?i.checked:+i.value;const sd=(rt.src[c.src]&&rt.src[c.src].dur)||c.b;
    if(k==='vol')c.vol=clamp(v/100,0,3);else if(k==='mute')c.mute=v;else if(k==='speed')c.speed=v||1;else if(k==='start')c.start=Math.max(0,v);else if(k==='a')c.a=clamp(v,0,c.b-MIN);else if(k==='b')c.b=clamp(v,c.a+MIN,sd);else c[k]=Math.max(0,v);
    redraw();refreshProps();changed()}));
  qa('[data-c="vol"]').forEach(i=>i.addEventListener('input',()=>{const c=selClip();if(c){c.vol=clamp(+i.value/100,0,3)}}));
  qa('[data-cr]').forEach(i=>i.addEventListener('change',()=>{const c=selClip();if(!c||sel.type!=='clip')return;snap();c.crop[i.dataset.cr]=clamp(+i.value||0,0,90);if(c.crop.l+c.crop.r>90)c.crop.r=90-c.crop.l;if(c.crop.t+c.crop.b>90)c.crop.b=90-c.crop.t;redraw();refreshProps();changed()}));
  qa('[data-tr]').forEach(b=>b.onclick=()=>{const c=selClip();if(!c||sel.type!=='clip')return;snap();c.trans={type:b.dataset.tr};const p=prevOf(c);if(p&&b.dataset.tr!=='none'&&clipEnd(p)-c.start<.1)setOverlap(c,Math.min(1,Math.min(clipLen(p),clipLen(c))/2));redraw();refreshProps();changed()});
  R('canvas').onchange=()=>{snap();const v=R('canvas').value;if(v==='auto'){const f=vclips(e)[0],s=f&&rt.src[f.src];if(s&&s.w){e.W=s.w;e.H=s.h}}else{const [w,h]=v.split('x').map(Number);e.W=w;e.H=h}sizePrev();changed()};
  R('fi').onchange=()=>{snap();e.fadeIn=R('fi').checked;redraw();changed()};R('fo').onchange=()=>{snap();e.fadeOut=R('fo').checked;redraw();changed()};
  R('muteall').onchange=()=>{snap();e.muteVideo=R('muteall').checked;changed()};
  // audio fx
  const fxTarget=()=>R('atarget').value==='sel'&&selClip()?selClip():null;
  const fxObj=create=>{const c=fxTarget();if(c){if(!c.fx&&create)c.fx=defFx();return c.fx||defFx()}return e.master};
  function showFx(){const f=Object.assign(defFx(),fxObj(false));qa('[data-eq]').forEach(i=>{const v=+f.eq[+i.dataset.eq]||0;i.value=v;R('eqv'+i.dataset.eq).textContent=v>0?'+'+v:v});
    qa('[data-fx]').forEach(i=>{const k=i.dataset.fx;i.value=k==='gain'?Math.round(f.gain*100):k==='echoT'?Math.round(f.echoT*100):f[k]});
    R('eqpre').value=Object.keys(EQ_PRESETS).find(k=>EQ_PRESETS[k].join()===f.eq.join())||'Flat'}
  R('atarget').onchange=showFx;
  qa('[data-eq]').forEach(i=>{i.addEventListener('pointerdown',snap);i.addEventListener('input',()=>{const f=fxObj(true);f.eq[+i.dataset.eq]=+i.value;R('eqv'+i.dataset.eq).textContent=+i.value>0?'+'+i.value:i.value;eng.refreshFx()});i.addEventListener('change',changed)});
  qa('[data-fx]').forEach(i=>{i.addEventListener('pointerdown',snap);i.addEventListener('focus',snap);i.addEventListener('input',()=>{const f=fxObj(true),k=i.dataset.fx,v=+i.value;f[k]=k==='gain'||k==='echoT'?v/100:v;eng.refreshFx()});i.addEventListener('change',changed)});
  R('eqpre').onchange=()=>{snap();const f=fxObj(true);f.eq=[...EQ_PRESETS[R('eqpre').value]];eng.refreshFx();showFx();changed()};
  R('audfile').onchange=async()=>{const f=R('audfile').files[0];R('audfile').value='';if(!f)return;try{snap();const c=await addAudioSrc(f,f.name.replace(/\.[^.]+$/,''),eng.t);select('aud',c);toast('Added. Drag it on the timeline, or use the Audio tab to change the volume and sound.');changed()}catch(err){hist.pop();toast(err.message)}};
  async function addAudioSrc(blob,name,start){const url=URL.createObjectURL(blob),meta=await loadMeta(url,true),id=newId(e,'s');e.srcs.push({id,name,kind:'audio'});it._edBlobs[id]=blob;rt.src[id]={url,blob,dur:meta.dur};
    const c={id:newId(e,'a'),src:id,a:0,b:meta.dur,start:Math.max(0,start||0),speed:1,vol:1,afi:0,afo:0};e.aud.push(c);computePeaks(blob).then(p=>{if(p)rt.src[id].peaks=p});return c}
  async function addVideoSrc(item){const id=newId(e,'s'),meta=await loadMeta(item.url);e.srcs.push({id,name:item.name,itemId:item.itemId||null,kind:'video'});if(!item.itemId&&item.blob)it._edBlobs[id]=item.blob;rt.src[id]={url:item.url,blob:item.blob,dur:meta.dur,w:meta.w,h:meta.h};
    const c={id:newId(e,'c'),src:id,a:0,b:meta.dur,start:total(e),speed:1,vol:1,mute:false,crop:{l:0,t:0,r:0,b:0},trans:{type:'fade'},afi:0,afo:0};e.clips.push(c);if(item.blob)computePeaks(item.blob).then(p=>{if(p)rt.src[id].peaks=p});return c}
  function updateRecBtn(){const b=q('[data-a="rec"]');b.textContent=rec?'■ Stop recording':'● Record voice-over';b.classList.toggle('pri',!!rec)}
  async function toggleRec(){if(rec){rec.mr.stop();return}let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}})}catch(_){toast('No microphone found, or microphone access is off. Check Windows Settings > Privacy & security > Microphone.',6000);return}
    const mr=new MediaRecorder(stream),ch=[],t0=eng.t;rec={mr,stream};mr.ondataavailable=ev=>ev.data.size&&ch.push(ev.data);
    mr.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());eng.pause();rec=null;updateRecBtn();const blob=new Blob(ch,{type:mr.mimeType||'audio/webm'});if(blob.size>800){try{snap();const c=await addAudioSrc(blob,'Voice-over',t0);select('aud',c);changed();toast('Voice-over added on the audio track.')}catch(err){toast(err.message)}}};
    mr.start();updateRecBtn();playRange=null;eng.unlock();eng.play()}
  function addVideosDialog(){const lib=api.videos?api.videos():[],rows=[];
    const m=document.createElement('div');m.className='modal vjoin';m.style.zIndex=90;document.body.appendChild(m);
    const draw=()=>{const free=lib.filter(x=>!rows.some(r=>r===x));
      m.innerHTML=`<div class="box" style="width:min(520px,100%)"><h2>Add videos to the timeline</h2><p class="vnote">Each video becomes its own clip at the end of the timeline. You can then trim it, drag it around, and overlap it with the next one.</p>
      ${rows.map((r,i)=>`<div class="jr"><b>${i+1}. ${esc(r.name||'Video')}</b><button class="btn" data-up="${i}">↑</button><button class="btn" data-dn="${i}">↓</button><button class="btn" data-rm="${i}">✕</button></div>`).join('')}
      <div class="vh" style="margin:10px 0 4px">From your library</div>${free.length?free.map(x=>`<div class="jr"><b>${esc(x.name||'Video')}</b><button class="btn" data-add="${lib.indexOf(x)}">Add</button></div>`).join(''):'<p class="vnote">No other videos in your library yet.</p>'}
      <div class="vrow" style="justify-content:space-between;margin-top:12px"><button class="btn" data-file>Add a video file…</button><span><button class="btn" data-x>Cancel</button> <button class="btn pri" data-go ${rows.length?'':'disabled'}>Add ${rows.length||''} to timeline</button></span></div><input type="file" accept="video/*" multiple hidden></div>`;
      const fi=m.querySelector('input[type=file]');fi.onchange=()=>{for(const f of fi.files)rows.push({name:f.name.replace(/\.[^.]+$/,''),url:URL.createObjectURL(f),blob:f});draw()}};
    m.onclick=async ev=>{const t=ev.target;if(t===m||t.closest('[data-x]')){m.remove();return}const g=a=>{const b=t.closest('['+a+']');return b?+b.getAttribute(a):null};let i;
      if(t.closest('[data-go]')){m.remove();snap();try{let last=null;for(const r of rows)last=await addVideoSrc({name:r.name,url:r.url,blob:r.blob,itemId:r.id||null});eng.sync();refreshAll();redraw();if(last)select('clip',last);changed();toast('Added. Drag the circles to trim each clip, and drag a clip over its neighbour to overlap them.',5000)}catch(err){toast(err.message)}return}
      if(t.closest('[data-file]')){m.querySelector('input[type=file]').click();return}
      if((i=g('data-add'))!==null){const x=lib[i];rows.push({name:x.name,url:x.url,blob:x.blob,id:x.id});draw()}else if((i=g('data-rm'))!==null){rows.splice(i,1);draw()}
      else if((i=g('data-up'))!==null&&i>0){[rows[i-1],rows[i]]=[rows[i],rows[i-1]];draw()}else if((i=g('data-dn'))!==null&&i<rows.length-1){[rows[i+1],rows[i]]=[rows[i],rows[i+1]];draw()}};
    draw()}
  // ----- captions -----
  function caplist(){const box=R('caps');box.innerHTML='';e.caps.forEach((c,i)=>{const r=document.createElement('div');r.className='vrow';
    r.innerHTML=`<input type="text" placeholder="Caption text"><label>from <input type="number" step="0.1" min="0"></label><label>to <input type="number" step="0.1" min="0"></label><select><option value="b">Bottom</option><option value="c">Middle</option><option value="t">Top</option></select><label>size <input type="number" min="2" max="20" step="0.5"></label><input type="color"><label><input type="checkbox"> box</label><button class="btn">✕</button>`;
    const ins=r.querySelectorAll('input,select'),[iT,iF,iTo,sP,iS,iC,iB]=ins;iT.value=c.text;iF.value=c.t0.toFixed(1);iTo.value=c.t1.toFixed(1);sP.value=c.pos||'b';iS.value=c.fs||6;iC.value=c.c||'#ffffff';iB.checked=c.bg!==false;
    const chg=()=>{snap();c.text=iT.value;c.t0=Math.max(0,+iF.value||0);c.t1=Math.max(c.t0+.1,+iTo.value||0);c.pos=sP.value;c.fs=+iS.value||6;c.c=iC.value;c.bg=iB.checked;redraw();changed()};
    ins.forEach(x=>x.addEventListener('change',chg));iT.addEventListener('input',()=>{c.text=iT.value;redraw()});
    r.querySelector('button').onclick=()=>{snap();e.caps.splice(i,1);if(selCap()===c)sel=null;caplist();redraw();changed()};r.addEventListener('focusin',()=>{if(selCap()!==c){sel={type:'cap',ref:c};qa('.vcaps .vrow').forEach((x,j)=>x.classList.toggle('vsel',e.caps[j]===c))}});r.classList.toggle('vsel',c===selCap());box.appendChild(r)})}
  // ----- on-screen items -----
  const ovPt=ev=>{const r=ov.getBoundingClientRect();return{x:(ev.clientX-r.left)/r.width*ov.width,y:(ev.clientY-r.top)/r.height*ov.height,k:ov.width/Math.max(1,r.width)}};
  const activeOvs=()=>e.ovs.filter(s=>eng.t>=s.t0&&eng.t<=s.t1);
  function ovDraw(){const g=ov.getContext('2d');g.clearRect(0,0,ov.width,ov.height);if(!HK.drawShape)return;
    if(odrag&&odrag.mode==='draw')HK.drawShape(g,odrag.s,{width:ov.width,height:ov.height});
    const o=selOv();if(o&&otool&&eng.t>=o.t0&&eng.t<=o.t1){const k=ov.width/Math.max(1,ov.getBoundingClientRect().width),b=HK.bbox(o);g.save();g.strokeStyle='#5aa2ff';g.lineWidth=1.5*k;g.setLineDash([5*k,4*k]);g.strokeRect(b.x-4*k,b.y-4*k,b.w+8*k,b.h+8*k);g.setLineDash([]);const hs=6*k;for(const [,hx,hy] of HK.handles(o)){g.fillStyle='#fff';g.fillRect(hx-hs,hy-hs,hs*2,hs*2);g.strokeRect(hx-hs,hy-hs,hs*2,hs*2)}g.restore()}}
  function ovui(){qa('[data-ot]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.ot===otool));ov.style.pointerEvents=otool?'auto':'none';ov.style.cursor=otool==='select'?'default':'crosshair';
    const o=selOv(),row=R('osel');row.hidden=!o;if(o){R('olbl').textContent=ovName(o);R('of').value=o.t0.toFixed(1);R('ot2').value=o.t1.toFixed(1)}}
  const hitOv=(x,y,k)=>{const tol=10*k;for(const s of activeOvs().reverse()){const b=HK.bbox(s);if(x>=b.x-tol&&x<=b.x+b.w+tol&&y>=b.y-tol&&y<=b.y+b.h+tol)return s}return null};
  const hitHandle=(s,x,y,k)=>{for(const [h,hx,hy] of HK.handles(s))if(Math.abs(x-hx)<9*k&&Math.abs(y-hy)<9*k)return h;return null};
  ov.addEventListener('pointerdown',ev=>{if(!otool||!ready)return;ev.preventDefault();ov.setPointerCapture(ev.pointerId);const {x,y,k}=ovPt(ev),t=eng.t;eng.pause();
    const cur=selOv();if(cur&&t>=cur.t0&&t<=cur.t1){const h=hitHandle(cur,x,y,k);if(h){snap();odrag={mode:'handle',k:h};return}}
    const hs=hitOv(x,y,k);
    if(otool==='select'||(hs&&hs===cur)){if(hs)select('ov',hs);else select(null);if(hs){snap();odrag={mode:'move',lx:x,ly:y}}return}
    snap();const s=HK.newShape(otool,x,y);s.t0=t;s.t1=t+3;const sc=Math.max(1,e.H/720);s.w=Math.round((+R('owid').value||6)*sc);s.fs=Math.round((s.fs||24)*sc*1.3);if(otool!=='highlight')s.c=R('ocol').value;
    if(otool==='step'||otool==='stamp'){if(otool==='step')s.n=e.ovs.filter(z=>z.t==='step').length+1;e.ovs.push(s);select('ov',s);return}
    if(otool==='text'){HK.askText('Text on the video','','Add').then(txt=>{if(txt){s.txt=txt;s._w=null;s.x2=s.x1+10;s.y2=s.y1+10;e.ovs.push(s);select('ov',s);changed()}else hist.pop()});return}
    select(null);odrag={mode:'draw',s}});
  ov.addEventListener('pointermove',ev=>{if(!odrag)return;const {x,y}=ovPt(ev),o=selOv();
    if(odrag.mode==='draw'){odrag.s.x2=x;odrag.s.y2=y}else if(odrag.mode==='move'&&o){HK.moveShape(o,x-odrag.lx,y-odrag.ly);odrag.lx=x;odrag.ly=y;eng.render()}
    else if(odrag.mode==='handle'&&o){const k=odrag.k;if(k==='p1'){o.x1=x;o.y1=y}else if(k==='p2'){o.x2=x;o.y2=y}else if(k==='c'){o.cx=x;o.cy=y}else if(k==='tail'){o.tx=x;o.ty=y}else{const r=HK.norm(o);let l=r.x,tp=r.y,rr=r.x+r.w,bb=r.y+r.h;if(k.includes('w'))l=x;if(k.includes('e'))rr=x;if(k.includes('n'))tp=y;if(k.includes('s'))bb=y;o.x1=l;o.y1=tp;o.x2=rr;o.y2=bb}o._w=null;eng.render()}});
  ov.addEventListener('pointerup',()=>{if(!odrag)return;const d=odrag;odrag=null;if(d.mode==='draw'){const s=d.s;if(Math.abs(s.x2-s.x1)<4&&Math.abs(s.y2-s.y1)<4){hist.pop();return}e.ovs.push(s);select('ov',s)}changed();eng.render()});
  qa('[data-ot]').forEach(b=>b.onclick=()=>{otool=otool===b.dataset.ot?null:b.dataset.ot;if(!otool&&sel&&sel.type==='ov')select(null);ovui()});
  R('ocol').oninput=()=>{HK.setStyle&&HK.setStyle('stroke',R('ocol').value);const o=selOv();if(o){o.c=R('ocol').value;eng.render()}};
  R('owid').onchange=()=>{const w=Math.max(1,+R('owid').value||6);HK.setStyle&&HK.setStyle('width',w);const o=selOv();if(o){snap();o.w=w*Math.max(1,e.H/720);o._w=null;eng.render()}};
  R('of').onchange=()=>{const o=selOv();if(o){o.t0=clamp(+R('of').value||0,0,o.t1-.1);changed()}};R('ot2').onchange=()=>{const o=selOv();if(o){o.t1=Math.max(o.t0+.1,+R('ot2').value||0);changed()}};
  R('in').onchange=()=>{inT=clamp(+R('in').value||0,0,outT-.1)};R('out').onchange=()=>{outT=clamp(+R('out').value||0,inT+.1,D())};
  host.addEventListener('keydown',x=>{if(x.target.matches('input,select,textarea'))x.stopPropagation()});
  // ----- export -----
  async function run(kind){if(exp||!ready)return;exp={cancel:false};eng.pause();const bar=R('prog'),fill=bar.firstElementChild,stopB=q('[data-a="stop"]');bar.hidden=false;stopB.hidden=false;fill.style.width='0';const prog=p=>{fill.style.width=Math.round(p*100)+'%'};
    try{
      if(kind==='video'){const sz=R('osize').value;let cw=e.W,ch=e.H;if(sz!=='project'){ch=+sz;cw=Math.round(ch*e.W/e.H)}cw&=~1;ch&=~1;toast('Saving edited video… keep this window open.',5000);
        const o=await eng.exportRun(cw,ch,prog,exp);if(!o)return;const n=api.addVideo(o.webm||o.mp4,(it.name||'Video')+' (edited)',it.thumb);n.webm=o.webm||null;n.mp4=o.mp4||null;api.persist(n);toast('Saved as a new video in your library.')}
      else{const fps=clamp(+R('fps').value||10,1,30),w=clamp(+R('gw').value||480,64,e.W)&~1,h=Math.round(w*e.H/e.W)&~1,T=D();let n=Math.max(1,Math.floor(T*fps)),times=Array.from({length:n},(_,i)=>i/fps),capped=false;if(n>900){times=Array.from({length:900},(_,i)=>i*T/900);capped=true}
        const gw=new GifWriter(w,h,true);toast('Making GIF…',3000);const ok=await eng.renderTimes(times,w,h,(g,i)=>{gw.addFrame(g.getImageData(0,0,w,h).data,Math.round(100/(capped?900/T:fps)));prog((i+1)/times.length)},exp);
        if(!ok)return;await api.saveBlob(gw.finish(),api.baseName(it)+'.gif');if(capped)toast('That was long, so frames were thinned to keep the GIF a sensible size.',5000)}
    }catch(err){toast('Export failed: '+(err.message||err),6000)}
    finally{exp=null;bar.hidden=true;stopB.hidden=true;try{eng.seek(0)}catch(_){}}}
  // ----- keys -----
  const key=ev=>{if(dead||!ready)return;if(ev.target.matches&&ev.target.matches('input,select,textarea'))return;const k=ev.key.toLowerCase();
    if(k==='delete'||k==='backspace'){if(sel){ev.preventDefault();doDelete(ev.shiftKey)}else return}
    else if(k==='escape'){select(null);playRange=null}else if(k===' '){ev.preventDefault();togglePlay()}else if(k==='i')act.setin();else if(k==='o')act.setout();else if(k==='s'&&!ev.ctrlKey&&!ev.metaKey)act.split();
    else if(k==='arrowleft'){ev.preventDefault();eng.pause();eng.seek(eng.t-(ev.shiftKey?1:.1))}else if(k==='arrowright'){ev.preventDefault();eng.pause();eng.seek(eng.t+(ev.shiftKey?1:.1))}else return;ev.stopPropagation()};
  document.addEventListener('keydown',key,true);
  function refreshAll(){refreshProps();caplist();ovui();R('canvas').value=['1920x1080','1280x720','854x480','1080x1080','1080x1920'].includes(e.W+'x'+e.H)?e.W+'x'+e.H:'auto';R('fi').checked=!!e.fadeIn;R('fo').checked=!!e.fadeOut;R('muteall').checked=!!e.muteVideo;showFx()}
  function ui(){if(!ready){return}const r=curRange();R('time').textContent=`${fmt(eng.t)} / ${fmt(D())}`;q('[data-a="play"]').textContent=eng.playing?'Pause':r?'Play '+r[2]:'Play';drawTl();ovDraw()}
  function tick(){if(dead)return;ui();raf=requestAnimationFrame(tick)}
  // ----- start up -----
  (async()=>{try{
    rt.src.s0={url:it.url,blob:it.blob};const meta=await loadMeta(it.url);Object.assign(rt.src.s0,{dur:meta.dur,w:meta.w,h:meta.h});
    e=ensureProject(it,meta);
    for(const s of e.srcs){let url=null,blob=null;
      if(s.self){url=it.url;blob=it.blob;rt.src[s.id]=Object.assign(rt.src[s.id]||{},{url,blob,dur:meta.dur,w:meta.w,h:meta.h})}
      else{if(s.itemId){const o=api.itemById&&api.itemById(s.itemId);if(o){url=o.url;blob=o.blob}}if(!url&&it._edBlobs[s.id]){blob=it._edBlobs[s.id];url=URL.createObjectURL(blob)}
        if(url){try{const m2=await loadMeta(url,s.kind==='audio');rt.src[s.id]={url,blob,dur:m2.dur,w:m2.w,h:m2.h}}catch(_){}}}}
    e.clips=e.clips.filter(c=>rt.src[c.src]);e.aud=e.aud.filter(c=>rt.src[c.src]);
    if(!e.clips.length){const s0=e.srcs.find(s=>s.self);e.clips.push({id:newId(e,'c'),src:s0.id,a:0,b:meta.dur,start:0,speed:1,vol:1,mute:false,crop:{l:0,t:0,r:0,b:0},trans:{type:'none'},afi:0,afo:0})}
    eng=makeEngine({e,rt});eng.onTick(onTick);eng.onEnd(()=>{playRange=null;if(rec)rec.mr.stop()});sizePrev();inT=0;outT=D();ready=true;refreshAll();
    for(const s of e.srcs){const r=rt.src[s.id];if(r&&r.blob&&!r.peaks)computePeaks(r.blob).then(p=>{if(p)r.peaks=p})}
    await eng.seek(0);
  }catch(err){toast(err.message||String(err))}})();
  raf=requestAnimationFrame(tick);
  return{info:q('.vinfo'),video:prev,destroy(){dead=true;cancelAnimationFrame(raf);document.removeEventListener('keydown',key,true);if(exp)exp.cancel=true;try{rec&&rec.mr.stop()}catch(_){}if(eng)eng.destroy()},saveGif:()=>run('gif'),grab:()=>eng?eng.snapshot(e.W,e.H):null,getProject:()=>e}}
root.VEdit={mount,pack,Core:{clipLen,clipEnd,total,ensureProject,makeEngine}};
})(window);
