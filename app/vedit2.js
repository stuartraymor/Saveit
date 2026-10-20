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
  const offline=typeof OfflineAudioContext!=='undefined'&&ac instanceof OfflineAudioContext,T=(p,v)=>{if(offline){p.value=v;return}try{p.setTargetAtTime(v,ac.currentTime,.02)}catch(_){p.value=v}};
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
  case 'blur':{const f0=g.filter&&g.filter!=='none'?g.filter+' ':'';g.filter=f0+`blur(${p*18}px)`;dA(1-p);g.filter=f0+`blur(${(1-p)*18}px)`;dB(p);g.filter=f0||'none';break}
  default:dA();dB(p)}}

// ---------- 9.6: visual effects (adjustment-layer style: each effect is a bar on its own timeline row) ----------
// [key, label, min, max, default amount, unit]. "Neutral" (no change) is 0 for every effect.
const VFX=[['bright','Brightness',-100,100,30,'%'],['contrast','Contrast',-100,100,30,'%'],['exposure','Exposure',-100,100,40,'%'],['sat','Saturation',-100,100,50,'%'],
  ['bw','Black & white',0,100,100,'%'],['sepia','Sepia',0,100,80,'%'],['invert','Invert',0,100,100,'%'],['hue','Hue shift',-180,180,90,'°'],
  ['blur','Blur',0,100,30,'%'],['warm','Warm',0,100,50,'%'],['cool','Cool',0,100,50,'%'],['vignette','Vignette',0,100,60,'%']];
const VFX_BY=Object.fromEntries(VFX.map(v=>[v[0],v]));
// how strongly an effect is on at time t (fades in and out at its edges)
function vfxK(v,t){if(t<v.t0||t>v.t1)return 0;let k=1;const fi=Math.min(+v.fi||0,(v.t1-v.t0)/2),fo=Math.min(+v.fo||0,(v.t1-v.t0)/2);if(fi>0&&t<v.t0+fi)k=Math.min(k,(t-v.t0)/fi);if(fo>0&&t>v.t1-fo)k=Math.min(k,(v.t1-t)/fo);return clamp(k,0,1)}
// CSS filter for the picture plus the colour washes drawn on top
function vfxState(list,t,W){const f=[],wash=[];let vig=0;
  for(const v of list||[]){if(v.off)continue;const k=vfxK(v,t);if(!k)continue;const a=(+v.amt||0)*k;
    switch(v.kind){case 'bright':f.push(`brightness(${(1+a/100).toFixed(3)})`);break;case 'contrast':f.push(`contrast(${(1+a/100).toFixed(3)})`);break;
    case 'exposure':f.push(`brightness(${Math.pow(2,a/100).toFixed(3)})`);break;case 'sat':f.push(`saturate(${(1+a/100).toFixed(3)})`);break;
    case 'bw':f.push(`grayscale(${(a/100).toFixed(3)})`);break;case 'sepia':f.push(`sepia(${(a/100).toFixed(3)})`);break;case 'invert':f.push(`invert(${(a/100).toFixed(3)})`);break;
    case 'hue':f.push(`hue-rotate(${a.toFixed(1)}deg)`);break;case 'blur':f.push(`blur(${(a/100*12*W/1280).toFixed(2)}px)`);break;
    case 'warm':f.push(`sepia(${(a/100*.25).toFixed(3)})`);wash.push(['rgba(255,150,40,',a/100*.7]);break;case 'cool':wash.push(['rgba(40,130,255,',a/100*.7]);f.push(`hue-rotate(${(-a/100*8).toFixed(1)}deg)`);break;case 'vignette':vig=Math.max(vig,a/100);break}}
  return{f:f.join(' '),wash,vig}}
function vfxSwatch(kind){const v=VFX_BY[kind],s=vfxState([{kind,amt:v[4],t0:0,t1:1}],.5,1280);return s.f||'none'}
const vfxIcon=(k,sm)=>root.SaveitIcons&&root.SaveitIcons.has(k)?root.SaveitIcons.tile(k,sm?'sm':''):`<i style="filter:${vfxSwatch(k)}" class="vfxsw vfx-${k}"></i>`;

// ---------- 9.7: layouts and backgrounds (like Camtasia Rev): where the screen and the webcam sit, and what is behind them ----------
const BGS=[['black','Black',null,'#000000'],['white','White',null,'#ffffff'],
  ['g1','Aurora',135,['#3a1c9c','#1f6f8b','#2aa876']],['g2','Night sky',135,['#2b2f8f','#6ea2e8','#1d2f5c']],['g3','Lavender',135,['#eae4f7','#7a74c9','#3b2d8f']],
  ['g4','Steel',135,['#5b7fd6','#c9ccd8']],['g5','Mist',135,['#7d9ad6','#d8c2dc']],['g6','Pearl',160,['#ffffff','#b9a7c4','#5a5a72']],
  ['g7','Morning',135,['#b9c3f2','#f8e7d8']],['g8','Peach',135,['#fde3cf','#f1c2b5']],['g9','Dawn',160,['#fde8d7','#e7a4b0','#3a67b8']],
  ['g10','Ocean',135,['#2380a8','#6cc2d6']],['g11','Pastel',135,['#f0a4f8','#a7f0f2','#fff3a8']],['g12','Orchid',135,['#c35cf0','#f8d39a']],
  ['g13','Berry',135,['#e0306f','#6b2bb3']],['g14','Wine',135,['#6e1a2c','#e0706a']],['g15','Ember',135,['#f0702a','#c42a2a']],
  ['g16','Citrus',135,['#d9505e','#e8d55a']],['g17','Dusk',135,['#c27a2a','#5a3d6b']],['g18','Slate',135,['#0f2027','#2c5364']]];
const BG_BY=Object.fromEntries(BGS.map(b=>[b[0],b]));
const LAYOUTS=[['full','Screen only (full)'],['pip','Webcam in corner'],['inset','Screen on background + webcam'],['screen','Screen on background'],
  ['side-r','Side by side (webcam right)'],['side-l','Side by side (webcam left)'],['split','Half and half'],['cam-big','Presenter (webcam large)'],['cam-only','Webcam only']];
const LOOKS=[['Classic',{layout:'pip',bg:'black',shape:'rounded',pos:'br'}],['Clean inset',{layout:'inset',bg:'g7',shape:'circle',pos:'br'}],['Purple stage',{layout:'inset',bg:'g1',shape:'rounded',pos:'tr'}],
  ['Side by side',{layout:'side-r',bg:'white'}],['Presenter',{layout:'cam-big',bg:'black',pos:'br'}],['Berry',{layout:'inset',bg:'g13',shape:'circle',pos:'br'}],
  ['Split',{layout:'split',bg:'g18'}],['Ocean',{layout:'side-l',bg:'g10'}],['Minimal white',{layout:'inset',bg:'white',shape:'circle',pos:'bl'}],
  ['Midnight',{layout:'inset',bg:'black',shape:'rounded',pos:'br'}],['Peach',{layout:'side-r',bg:'g8'}],['Steel screen',{layout:'screen',bg:'g4'}]];
const LOOK_DEF={layout:'full',bg:'black',pos:'br',shape:'circle',camSize:22,round:true,shadow:true,border:true,color:'#20262c'};
function lookOf(e){return Object.assign({},LOOK_DEF,e.look||{})}
function paintBg(g,cw,ch,L){const b=L.bg==='custom'?null:BG_BY[L.bg]||BG_BY.black;if(!b){g.fillStyle=L.color||'#20262c';g.fillRect(0,0,cw,ch);return}
  if(b[2]==null){g.fillStyle=b[3];g.fillRect(0,0,cw,ch);return}const a=b[2]*Math.PI/180,dx=Math.cos(a),dy=Math.sin(a),r=(Math.abs(cw*dx)+Math.abs(ch*dy))/2,gr=g.createLinearGradient(cw/2-dx*r,ch/2-dy*r,cw/2+dx*r,ch/2+dy*r);
  b[3].forEach((c,i)=>gr.addColorStop(i/(b[3].length-1),c));g.fillStyle=gr;g.fillRect(0,0,cw,ch)}
// Screen box S (same shape as the project) and webcam box C, in project pixels.
function lookRects(L,W,H,hasCam){const m=Math.round(Math.min(W,H)*.04),fit=(w,x,y)=>({x,y,w,h:w*H/W}),cw=Math.round(W*(L.camSize||22)/100);
  const corner=(w,h)=>({x:L.pos[1]==='l'?m:W-m-w,y:L.pos[0]==='t'?m:H-m-h,w,h});let S=null,C=null,full=false;const lay=hasCam?L.layout:(['cam-only','cam-big'].includes(L.layout)?'full':['inset','side-r','side-l','split'].includes(L.layout)?'screen':L.layout==='pip'?'full':L.layout);
  switch(lay){case 'pip':S=fit(W,0,0);full=true;C=corner(cw,L.shape==='wide'?cw*9/16:cw);break;
    case 'inset':{const w=W*.84;S=fit(w,(W-w)/2,(H-w*H/W)/2);C=corner(cw,L.shape==='wide'?cw*9/16:cw);break}
    case 'screen':{const w=W*.86;S=fit(w,(W-w)/2,(H-w*H/W)/2);break}
    case 'side-r':case 'side-l':{const w=W*.66,h=w*H/W,cx=W-w-3*m,ch=Math.min(H-2*m,cx*1.3);S=fit(w,lay==='side-r'?m:W-m-w,(H-h)/2);C={x:lay==='side-r'?S.x+w+m:m,y:(H-ch)/2,w:cx,h:ch};break}
    case 'split':{const w=(W-3*m)/2;S=fit(w,m,(H-w*H/W)/2);C={x:2*m+w,y:S.y,w,h:S.h};break}
    case 'cam-big':{C={x:0,y:0,w:W,h:H,full:true};const w=W*.34,h=w*H/W;S={x:L.pos[1]==='l'?m:W-m-w,y:L.pos[0]==='t'?m:H-m-h,w,h};break}
    case 'cam-only':C={x:0,y:0,w:W,h:H,full:true};break;
    default:S=fit(W,0,0);full=true}
  return{S,C,full,lay}}
function rrect(g,x,y,w,h,r){g.beginPath();if(r>0&&g.roundRect)g.roundRect(x,y,w,h,r);else g.rect(x,y,w,h)}

// ---------- captions ----------
// 9.8: long captions wrap inside a safe area (90% of the width) and shrink until they fit, in the preview, MP4/WebM and GIF alike.
function wrapCap(g,text,maxW){const out=[];for(const para of String(text).split('\n')){const words=para.split(/\s+/).filter(Boolean);if(!words.length){out.push('');continue}let line='';
    for(let wd of words){while(g.measureText(wd).width>maxW&&wd.length>1){let n=wd.length-1;while(n>1&&g.measureText(wd.slice(0,n)).width>maxW)n--;if(line){out.push(line);line=''}out.push(wd.slice(0,n));wd=wd.slice(n)}
      const tryL=line?line+' '+wd:wd;if(line&&g.measureText(tryL).width>maxW){out.push(line);line=wd}else line=tryL}out.push(line)}return out}
function capLayout(g,c,w,h){const base=Math.max(8,Math.round(h*(c.fs||6)/100)),maxW=w*.9,maxH=h*.42;let fs=base,lines=[];
  for(;;){g.font=`700 ${fs}px "Segoe UI",system-ui,sans-serif`;lines=wrapCap(g,c.text,maxW-fs*.7);if(lines.length*fs*1.25+fs*.7<=maxH||fs<=Math.max(8,base*.5))break;fs=Math.max(8,Math.floor(fs*.9))}
  return{fs,lines,fits:lines.length*fs*1.25+fs*.7<=maxH}}
function drawCaps(g,caps,t,w,h){for(const c of caps){if(!c.text||t<c.t0||t>c.t1)continue;g.save();const L=capLayout(g,c,w,h),fs=L.fs,lines=L.lines;g.textBaseline='top';g.textAlign='center';
  const lw=Math.max(...lines.map(l=>g.measureText(l).width)),bh=lines.length*fs*1.25,pad=fs*.35,bx=w/2-lw/2-pad,m=h*.05;
  const by=c.pos==='t'?m:c.pos==='c'?(h-bh)/2:h-m-bh-pad*2;
  if(c.bg!==false){g.fillStyle='rgba(0,0,0,.62)';g.beginPath();(g.roundRect?g.roundRect(bx,by,lw+pad*2,bh+pad*2,fs*.25):g.rect(bx,by,lw+pad*2,bh+pad*2));g.fill()}
  g.fillStyle=c.c||'#fff';lines.forEach((l,i)=>g.fillText(l,w/2,by+pad+i*fs*1.25));g.restore()}}

// ---------- project model ----------
const clipLen=c=>(c.b-c.a)/(c.speed||1),clipEnd=c=>c.start+clipLen(c);
const vclips=e=>e.clips.slice().sort((a,b)=>a.start-b.start);
function total(e){let t=0;for(const c of e.clips)t=Math.max(t,clipEnd(c));for(const c of e.aud)t=Math.max(t,clipEnd(c));return t}
function newId(e,p){return p+(e.nextId++)}
function fillDefaults(e){e.srcs=e.srcs||[];e.clips=e.clips||[];e.aud=e.aud||[];e.caps=e.caps||[];e.ovs=e.ovs||[];e.zooms=e.zooms||[];e.vfx=e.vfx||[];e.offline=e.offline||[];e.look=e.look||null;e.cam=e.cam||null;e.master=Object.assign(defFx(),e.master||{});e.nextId=e.nextId||100;e.muteVideo=!!e.muteVideo;e.W=e.W||1280;e.H=e.H||720;
  for(const c of e.clips){c.speed=c.speed||1;c.vol=c.vol==null?1:c.vol;c.crop=c.crop||{l:0,t:0,r:0,b:0};c.trans=c.trans||{type:'none'};c.afi=c.afi||0;c.afo=c.afo||0}
  for(const c of e.aud){c.speed=c.speed||1;c.vol=c.vol==null?1:c.vol;c.afi=c.afi||0;c.afo=c.afo||0}return e}
function ensureProject(it,meta){let e=it.edit;
  if(e&&e.v===2)return fillDefaults(e);
  const old=e||{},D=meta.dur,sp=old.speed||1,segs=(old.segs&&old.segs.length)?old.segs:[{a:0,b:D}];
  const ne={v:2,srcs:[{id:'s0',self:true,name:it.name||'Video',kind:'video'}],clips:[],aud:[],caps:[],ovs:[],zooms:[],vfx:[],fadeIn:!!old.fadeIn,fadeOut:!!old.fadeOut,W:meta.w||1280,H:meta.h||720,master:defFx(),muteVideo:false,nextId:1};
  let pos=0;const map=[];
  segs.forEach(s=>{const c={id:'c'+(ne.nextId++),src:'s0',a:s.a,b:s.b,start:pos,speed:sp,vol:1,mute:!!old.mute,crop:Object.assign({l:0,t:0,r:0,b:0},old.crop||{}),trans:{type:'none'},afi:0,afo:0};ne.clips.push(c);map.push({a:s.a,b:s.b,pos,sp});pos+=(s.b-s.a)/sp});
  const t2=t=>{for(const m of map)if(t>=m.a&&t<=m.b)return m.pos+(t-m.a)/m.sp;for(const m of map)if(m.a>t)return m.pos;const l=map[map.length-1];return l.pos+(l.b-l.a)/l.sp};
  ne.caps=(old.caps||[]).map(c=>{const a=t2(c.t0);return{...c,t0:a,t1:Math.max(a+.1,t2(c.t1))}});
  ne.ovs=(old.ovs||[]).map(c=>{const a=t2(c.t0);return{...c,t0:a,t1:Math.max(a+.1,t2(c.t1))}});
  if(old.cam){ne.cam=old.cam;ne.srcs.push({id:old.cam.src,kind:'cam',name:'Webcam'})}if(old.look)ne.look=old.look;
  it.edit=ne;return fillDefaults(ne)}
// strip anything that can't be stored (kept simple: project is plain JSON already)
function pack(e){return e?JSON.parse(JSON.stringify(e)):null}
root.VEditCore={clipLen,clipEnd,total,transition,TRANS,VFX,vfxState,BGS,LAYOUTS,LOOKS,lookRects,EQ_PRESETS,defFx,ensureProject,fillDefaults};

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
  const CAMC={id:'__cam',get src(){return e.cam&&e.cam.src}},hasCam=()=>!!(e.cam&&rt.src[e.cam.src]);
  function camAt(t){if(!hasCam())return null;const s0=e.srcs.find(s=>s.self),act=active(t).filter(c=>s0&&c.src===s0.id),c=act[act.length-1];return c?{t:wantTime(c,t)+(+e.cam.off||0),rate:c.speed||1}:null}
  // 10.1.8: media elements are pooled per source instead of one per clip (S.pool[srcId]). S.els maps a clip id to the element it is using now.
  // A clip that carries straight on from the clip before it (a split) takes over that clip's element while it is still playing, so the cut needs no seek.
  S.pool={};
  const clipById=id=>e.clips.find(c=>c.id===id)||e.aud.find(c=>c.id===id);
  function camEl(){let o=S.els.__cam;const s=rt.src[CAMC.src],url=s&&s.url;if(o&&o.url!==url){killEl(o);o=null}
    if(!o){const el=document.createElement('video');el.preload='auto';el.playsInline=true;el.muted=true;el.src=url||'';o=S.els.__cam={el,url,isAud:false,cam:true}}return o.el}
  function newEl(srcId,isAud){const s=rt.src[srcId],url=s&&s.url,el=document.createElement(isAud?'audio':'video');el.preload='auto';el.playsInline=true;el.src=url||'';
    const o={el,url,isAud,srcId,srcNode:null,fx:null,gain:null,clip:null,last:null,fxOf:undefined};(S.pool[srcId]=S.pool[srcId]||[]).push(o);connect(o);return o}
  function connect(o){if(!S.ac||o.srcNode||o.cam)return;const ac=S.ac;try{o.srcNode=ac.createMediaElementSource(o.el)}catch(_){return}o.fx=buildFx(ac);o.gain=ac.createGain();o.gain.gain.value=0;o.srcNode.connect(o.fx.input);o.fx.output.connect(o.gain);o.gain.connect(S.master.input);o.fxOf=undefined;applyFx(o)}
  function applyFx(o){if(!o.fx)return;const c=o.clip&&clipById(o.clip),fx=(c&&c.fx)||null,k=JSON.stringify(fx);if(o.fxOf===k)return;o.fxOf=k;o.fx.apply(fx)}
  function killEl(o){try{o.el.pause();o.srcNode&&o.srcNode.disconnect();o.gain&&o.gain.disconnect();o.el.removeAttribute('src');o.el.load()}catch(_){}}
  const pred=(c,list)=>list.find(p=>p!==c&&p.src===c.src&&Math.abs(clipEnd(p)-c.start)<1e-3&&Math.abs(p.b-c.a)<1e-3&&(p.speed||1)===(c.speed||1));
  // give every clip that is playing at t, or starts within 1.5 s, an element (clips that carry on from a playing clip wait for its element)
  function assign(t){const need=[];
    for(const [list,isAud] of [[e.clips,false],[e.aud,true]])for(const c of list){if(!rt.src[c.src])continue;const act=t>=c.start&&t<clipEnd(c),p=act?null:pred(c,list);
      if(act||(c.start>t&&c.start-t<1.5&&!(p&&t>=p.start)))need.push({c,isAud})}
    const want=new Set(need.map(n=>n.c.id));
    for(const id of Object.keys(S.els)){if(id==='__cam'||want.has(id))continue;const o=S.els[id];o.last=id;o.clip=null;delete S.els[id]}
    for(const {c,isAud} of need){if(S.els[c.id])continue;const url=rt.src[c.src].url,free=(S.pool[c.src]||[]).filter(o=>!o.clip&&o.isAud===isAud&&o.url===url),p=pred(c,isAud?e.aud:e.clips);
      let o=p&&free.find(x=>x.last===p.id);if(!o){const w=wantTime(c,Math.max(t,c.start));o=free.sort((x,y)=>Math.abs(x.el.currentTime-w)-Math.abs(y.el.currentTime-w))[0]}
      if(!o)o=newEl(c.src,isAud);o.clip=c.id;S.els[c.id]=o;applyFx(o)}
    // keep at most one spare element per source
    for(const sid of Object.keys(S.pool)){let spare=0;S.pool[sid]=S.pool[sid].filter(o=>{if(o.clip)return true;if(++spare<=1)return true;killEl(o);return false})}}
  function sync(){for(const id of Object.keys(S.els)){if(id==='__cam'){if(!hasCam()){killEl(S.els.__cam);delete S.els.__cam}continue}const c=clipById(id),o=S.els[id];if(!c||!rt.src[c.src]||o.url!==rt.src[c.src].url||o.srcId!==c.src){o.clip=null;delete S.els[id]}}
    const used=new Set([...e.clips,...e.aud].map(c=>c.src));
    for(const sid of Object.keys(S.pool)){const s=rt.src[sid];S.pool[sid]=S.pool[sid].filter(o=>{if(s&&used.has(sid)&&o.url===s.url)return true;if(o.clip)delete S.els[o.clip];killEl(o);return false});if(!S.pool[sid].length)delete S.pool[sid]}}
  const poolEls=()=>Object.values(S.pool).flat();
  function unlock(){if(!S.ac){const AC=window.AudioContext||window.webkitAudioContext;S.ac=new AC();S.master=buildFx(S.ac);S.mgain=S.ac.createGain();S.out=S.ac.createGain();S.master.output.connect(S.mgain);S.mgain.connect(S.out);S.out.connect(S.ac.destination);S.master.apply(e.master);
      for(const o of poolEls())connect(o)}
    if(S.ac.state==='suspended')S.ac.resume();return S.ac}
  function refreshFx(){if(!S.ac)return;S.master.apply(e.master);for(const o of poolEls()){o.fxOf=undefined;applyFx(o)}}
  function gainFor(c,t,isAud){let g=c.mute?0:(c.vol==null?1:c.vol);if(!isAud&&e.muteVideo)g=0;const len=clipLen(c),l=t-c.start;
    if(c.afi>0&&l<c.afi)g*=Math.max(0,l/c.afi);if(c.afo>0&&len-l<c.afo)g*=Math.max(0,(len-l)/c.afo);
    if(!isAud){const act=active(t),B=act[act.length-1],A=act.length>1?act[act.length-2]:null;
      if(B&&c!==B){if(c===A&&B.trans&&B.trans.type!=='none'){const T=Math.max(.05,Math.min(clipEnd(A),clipEnd(B))-B.start);g*=1-clamp((t-B.start)/T,0,1)}else g=0}
      else if(B&&c===B&&A&&B.trans&&B.trans.type!=='none'){const T=Math.max(.05,Math.min(clipEnd(A),clipEnd(B))-B.start);g*=clamp((t-B.start)/T,0,1)}}
    return clamp(g,0,4)}
  function tickAudio(t){if(!S.ac)return;const now=S.ac.currentTime;for(const o of poolEls()){if(!o.gain)continue;const c=o.clip&&clipById(o.clip),on=c&&t>=c.start&&t<clipEnd(c);o.gain.gain.setTargetAtTime(on?gainFor(c,t,o.isAud):0,now,.02)}
    const T=total(e);let m=1;if(e.fadeIn&&t<.6)m=Math.min(m,t/.6);if(e.fadeOut&&T-t<.6)m=Math.min(m,Math.max(0,(T-t)/.6));S.out.gain.setTargetAtTime(m,now,.02)}
  // 10.1.8: keep an element on time. Small drift is corrected by nudging its speed (up to 8%); only drift over 0.25 s jumps.
  function drive(el,want,rate){if(el.paused){if(Math.abs(el.currentTime-want)>.04)el.currentTime=want;el.playbackRate=rate;el.play().catch(()=>{});return}
    if(el.seeking)return;const d=el.currentTime-want;if(Math.abs(d)>.25){el.currentTime=want;el.playbackRate=rate;return}
    const r=Math.abs(d)>.015?rate*clamp(1-d*1.5,.92,1.08):rate;if(Math.abs(el.playbackRate-r)>.002)el.playbackRate=r}
  function syncPlay(t){assign(t);
    for(const [id,o] of Object.entries(S.els)){if(id==='__cam')continue;const c=clipById(id);if(!c)continue;
      if(t>=c.start&&t<clipEnd(c))drive(o.el,wantTime(c,t),c.speed||1);else{if(!o.el.paused)o.el.pause();if(!o.el.seeking&&Math.abs(o.el.currentTime-c.a)>.1)o.el.currentTime=c.a}}
    for(const o of poolEls())if(!o.clip&&!o.el.paused)o.el.pause();
    const ca=camAt(t);if(ca)drive(camEl(),ca.t,ca.rate);else if(hasCam()){const el=camEl();if(!el.paused)el.pause()}}
  async function prepare(t){assign(t);const ca=camAt(t),jobs=ca?[seekEl(camEl(),ca.t)]:[];
    for(const [id,o] of Object.entries(S.els)){if(id==='__cam')continue;const c=clipById(id);if(c)jobs.push(seekEl(o.el,t>=c.start&&t<clipEnd(c)?wantTime(c,t):c.a))}await Promise.all(jobs)}
  // start the elements that should be playing at t and wait (up to 1.5 s) until they really play, so the clock starts with the picture and sound
  async function startEls(t){const ps=[];for(const [id,o] of Object.entries(S.els)){if(id==='__cam')continue;const c=clipById(id);if(c&&t>=c.start&&t<clipEnd(c)){o.el.playbackRate=c.speed||1;ps.push(o.el.play().catch(()=>{}))}}
    const ca=camAt(t);if(ca){const el=camEl();el.playbackRate=ca.rate;ps.push(el.play().catch(()=>{}))}await Promise.race([Promise.all(ps),new Promise(r=>setTimeout(r,1500))])}
  // the clock follows the audio hardware when it is running, so the picture keeps time with the sound
  const clockNow=()=>S.ac&&S.ac.state==='running'?['a',S.ac.currentTime]:['p',performance.now()/1000];
  // --- drawing (all in project space W x H, scaled onto each target) ---
  function offs(cw,ch){for(const k of ['offA','offB']){let c=S[k];if(!c){c=S[k]=document.createElement('canvas')}if(c.width!==cw||c.height!==ch){c.width=cw;c.height=ch}}return[S.offA,S.offB]}
  // 10.1.8: if the clip's picture isn't decoded yet, hold the last picture drawn instead of flashing black
  // 10.1.9: a picture is {img,w,h}: a playing element in the preview, or a decoded frame (S.xf) while saving
  const picOf=o=>{const el=o&&o.el;return el&&el.readyState>=2&&el.videoWidth?{img:el,w:el.videoWidth,h:el.videoHeight}:null};
  function clipPic(c){if(S.mode==='export'&&S.xf)return S.xf[c.id]||null;const p=picOf(S.els[c.id]);if(p){S.held=p;return p}return S.held&&S.held.img.readyState>=2?S.held:null}
  function drawClip(g,c){const p=clipPic(c);if(!p)return;const el=p.img,vw=p.w,vh=p.h,W=e.W,H=e.H,cr=(S.cropEdit===c&&S.mode!=='export'?null:c.crop)||{},l=Math.round(vw*(cr.l||0)/100),tp=Math.round(vh*(cr.t||0)/100),r=Math.round(vw*(cr.r||0)/100),b=Math.round(vh*(cr.b||0)/100),sw=Math.max(2,vw-l-r),sh=Math.max(2,vh-tp-b),k=Math.min(W/sw,H/sh),dw=sw*k,dh=sh*k;
    g.drawImage(el,l,tp,sw,sh,(W-dw)/2,(H-dh)/2,dw,dh)}
  // 9.5: Zoom & pan - the picture (video and on-screen items) eases into the chosen box and back out again
  function zoomAt(t){if(S.noZoom&&!S.playing&&S.mode!=='export')return null;const z=(e.zooms||[]).find(z=>t>=z.t0&&t<=z.t1);if(!z)return null;const W=e.W,H=e.H,ea=Math.max(0,Math.min(+z.ease||0,(z.t1-z.t0)/2));let p=1;
    if(ea>0){if(t<z.t0+ea)p=(t-z.t0)/ea;else if(t>z.t1-ea)p=(z.t1-t)/ea}p=clamp(p,0,1);p=p*p*(3-2*p);const w=W+(clamp(z.w,W/8,W)-W)*p;return{k:W/w,x:z.x*p,y:z.y*p}}
  function drawFrame(g,t,cw,ch){const W=e.W,H=e.H,LK=lookOf(e),LR=lookRects(LK,W,H,hasCam()&&!!camAt(Math.min(t,Math.max(0,total(e)-1e-3)))),SB=LR.S;g.save();g.setTransform(1,0,0,1,0,0);paintBg(g,cw,ch,LK);g.scale(cw/W,ch/H);
    // the screen recording (with zooms, effects, transitions and on-screen items) is drawn into its box S
    const sx=SB?SB.x*cw/W:0,sy=SB?SB.y*ch/H:0,sk=SB?SB.w/W:1,devS=gg=>gg.setTransform(sk,0,0,sk,sx,sy);
    if(SB){g.save();const rr=LR.full||!LK.round?0:Math.min(SB.w,SB.h)*.025;if(!LR.full&&LK.shadow){g.save();g.shadowColor='rgba(0,0,0,.45)';g.shadowBlur=W/45;g.shadowOffsetY=W/200;rrect(g,SB.x,SB.y,SB.w,SB.h,rr);g.fillStyle='#000';g.fill();g.restore()}
      rrect(g,SB.x,SB.y,SB.w,SB.h,rr);g.clip();if(!LR.full){g.fillStyle='#000';g.fill()}g.translate(SB.x,SB.y);g.scale(SB.w/W,SB.h/H)}
    {const T0=total(e);if(T0>0&&t>=T0)t=T0-1e-3}if(SB){const act=active(t),zt=zoomAt(t),zap=gg=>{if(zt){gg.scale(zt.k,zt.k);gg.translate(-zt.x,-zt.y)}},vs=vfxState(e.vfx,t,W);g.save();zap(g);if(vs.f)g.filter=vs.f;
    if(act.length){const B=act[act.length-1],A=act.length>1?act[act.length-2]:null;
      if(A&&B.trans&&B.trans.type!=='none'){const T=Math.max(.05,Math.min(clipEnd(A),clipEnd(B))-B.start),p=(t-B.start)/T;
        if(p<1){const [oa,ob]=offs(cw,ch),ga=oa.getContext('2d'),gb=ob.getContext('2d');for(const [gg,cc] of [[ga,A],[gb,B]]){gg.setTransform(1,0,0,1,0,0);gg.fillStyle='#000';gg.fillRect(0,0,cw,ch);gg.scale(cw/W,ch/H);zap(gg);drawClip(gg,cc)}
          g.save();devS(g);transition(g,oa,ob,clamp(p,0,1),B.trans.type,cw,ch);g.restore()}else drawClip(g,B)}
      else drawClip(g,B)}
    g.filter='none';
    if(vs.wash.length||vs.vig){g.save();devS(g);for(const [c,a] of vs.wash){g.globalCompositeOperation='soft-light';g.fillStyle=c+a.toFixed(3)+')';g.fillRect(0,0,cw,ch)}g.globalCompositeOperation='source-over';
      if(vs.vig){const gr=g.createRadialGradient(cw/2,ch/2,Math.min(cw,ch)*.3,cw/2,ch/2,Math.hypot(cw,ch)/2);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,`rgba(0,0,0,${(vs.vig*.85).toFixed(3)})`);g.fillStyle=gr;g.fillRect(0,0,cw,ch)}g.restore()}
    const ovs=e.ovs.filter(s=>t>=s.t0&&t<=s.t1);
    if(ovs.length&&HK.drawShape){let base={width:W,height:H};if(ovs.some(s=>NEEDS_BASE.includes(s.t))){base=document.createElement('canvas');base.width=W;base.height=H;base.getContext('2d').drawImage(g.canvas,0,0,W,H)}for(const s of ovs)HK.drawShape(g,s,base)}
    g.restore();g.restore()}
    if(LR.C)drawCam(g,LR.C,LK);
    drawCaps(g,e.caps,t,W,H);
    const T=total(e);let a=0;if(e.fadeIn)a=Math.max(a,1-t/.6);if(e.fadeOut)a=Math.max(a,1-(T-t)/.6);if(a>0){g.fillStyle=`rgba(0,0,0,${clamp(a,0,1)})`;g.fillRect(0,0,W,H)}
    g.restore()}
  function render(){for(const tg of S.targets)drawFrame(tg.g,S.t,tg.cw,tg.ch)}
  // 10.1.8: seeks never pile up. While one is being prepared, later ones only move the target; the loop then prepares the newest one.
  function seek(t){S.t=clamp(t,0,total(e));S.tok++;if(!S.seekP)S.seekP=(async()=>{try{let done=-1;while(done!==S.tok){done=S.tok;S.seeking++;try{await prepare(S.t)}finally{S.seeking--}render()}}finally{S.seekP=null}})();return S.seekP}
  function pauseEls(){for(const o of [...poolEls(),...(S.els.__cam?[S.els.__cam]:[])])try{o.el.pause()}catch(_){}}
  function drawCam(g,C,L){const p=S.mode==='export'&&S.xf?S.xf.__cam:picOf(S.els.__cam);if(!p)return;const el=p.img,co=(e.cam&&e.cam.o)||{},vr=p.w/p.h,br=C.w/C.h;let sx=0,sy=0,sW=p.w,sH=p.h;
    if(vr>br){sW=sH*br;sx=(p.w-sW)/2}else{sH=sW/br;sy=(p.h-sH)/2}const circ=!C.full&&L.shape==='circle'&&!['side-r','side-l','split'].includes(L.layout),r=C.full?0:circ?0:Math.min(C.w,C.h)*(L.shape==='square'?0:.08);
    const path=()=>{if(circ){g.beginPath();g.ellipse(C.x+C.w/2,C.y+C.h/2,C.w/2,C.h/2,0,0,Math.PI*2)}else rrect(g,C.x,C.y,C.w,C.h,r)};
    g.save();if(!C.full&&L.shadow){g.shadowColor='rgba(0,0,0,.45)';g.shadowBlur=e.W/60;g.shadowOffsetY=e.W/320}path();g.fillStyle='#000';g.fill();g.shadowColor='transparent';g.clip();
    if(co.mirror!==false){g.translate(C.x+C.w,C.y);g.scale(-1,1);g.drawImage(el,sx,sy,sW,sH,0,0,C.w,C.h)}else g.drawImage(el,sx,sy,sW,sH,C.x,C.y,C.w,C.h);g.restore();
    if(!C.full&&L.border){g.save();path();g.lineWidth=Math.max(1,3*e.W/1280);g.strokeStyle='#ffffff';g.stroke();g.restore()}}
  function stopPlay(){S.playing=false;cancelAnimationFrame(S.raf);clearTimeout(S.tmo);pauseEls()}
  function step(){if(!S.playing)return;const [k,now]=clockNow();if(k===S.lastK){const dt=now-S.last;if(dt>0&&dt<1)S.t+=dt}S.last=now;S.lastK=k;const T=total(e);
    if(S.t>=T){S.t=T;stopPlay();render();S.onEnd&&S.onEnd();return}
    syncPlay(S.t);tickAudio(S.t);render();S.onTick&&S.onTick(S.t);if(!S.playing)return;if(S.mode==='export')S.tmo=setTimeout(step,33);else S.raf=requestAnimationFrame(step)}
  async function play(){unlock();if(S.playing)return;const T=total(e);if(S.t>=T-.02)S.t=0;S.playing=true;S.tok++;await prepare(S.t);if(!S.playing)return;tickAudio(S.t);await startEls(S.t);if(!S.playing)return;[S.lastK,S.last]=clockNow();step()}
  function pause(){const was=S.playing;stopPlay();if(was)render()}
  async function exportRealtime(cw,ch,onProg,ctl){stopPlay();const ac=unlock(),T=total(e);if(T<=0)throw new Error('There is nothing on the timeline yet.');
    const cv=document.createElement('canvas');cv.width=cw;cv.height=ch;const g=cv.getContext('2d'),stream=cv.captureStream(30),dest=ac.createMediaStreamDestination();
    S.out.disconnect();S.out.connect(dest);dest.stream.getAudioTracks().forEach(t=>stream.addTrack(t));
    const want=[['webm',['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm']],['mp4',['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4']]],recs=[];
    for(const [k,l] of want){const m=l.find(x=>MediaRecorder.isTypeSupported(x));if(!m)continue;const chunks=[],r=new MediaRecorder(stream,{mimeType:m,videoBitsPerSecond:8e6,audioBitsPerSecond:192000});r.ondataavailable=ev=>{if(ev.data.size)chunks.push(ev.data)};recs.push({k,r,chunks,m,done:new Promise(res=>r.onstop=res)})}
    if(!recs.length){S.out.disconnect();S.out.connect(ac.destination);throw new Error('This computer cannot encode video here.')}
    const saved=S.targets,savedTick=S.onTick,savedEnd=S.onEnd;S.targets=[{g,cw,ch}];S.mode='export';
    try{S.t=0;await prepare(0);S.playing=true;tickAudio(0);await startEls(0);drawFrame(g,0,cw,ch);recs.forEach(x=>x.r.start(500));
      await new Promise(res=>{S.onEnd=res;S.onTick=t=>{onProg&&onProg(Math.min(1,t/T));if(ctl&&ctl.cancel){stopPlay();res()}};S.tok++;[S.lastK,S.last]=clockNow();step()});
      await new Promise(r=>setTimeout(r,40));
    }finally{recs.forEach(x=>x.r.state!=='inactive'&&x.r.stop());await Promise.all(recs.map(x=>x.done));stopPlay();S.out.disconnect();S.out.connect(ac.destination);S.targets=saved;S.mode='preview';S.onTick=savedTick;S.onEnd=savedEnd;S.t=0;sync()}
    if(ctl&&ctl.cancel)return null;const o={};for(const x of recs){let b=new Blob(x.chunks,{type:x.m.split(';')[0]});if(x.k==='webm'&&window.WebmFix)b=await WebmFix.fix(b,T*1000); // 10.1.1: write the length into the WebM
      o[x.k]=b}return o}
  // ---------- 10.1.9: saving frame by frame ----------
  // Every output frame is drawn at its exact time from decoded source frames, and the sound is mixed offline, so a busy computer can make
  // saving slower but can't drop frames or sound. If this can't run (no WebCodecs, an unreadable file), saving falls back to exportRealtime.
  const bytesOf=x=>x instanceof Uint8Array?x:ArrayBuffer.isView(x)?new Uint8Array(x.buffer,x.byteOffset,x.byteLength):new Uint8Array(x);
  const pause0=()=>new Promise(r=>setTimeout(r,0));
  async function blobOf(id){const s=rt.src[id];if(!s)return null;if(s.blob)return s.blob;if(s.url){try{return await (await fetch(s.url)).blob()}catch(_){}}return null}
  function trackOf(id,cache){if(!(id in cache))cache[id]=(async()=>{const b=await blobOf(id);try{return b&&root.VExport?await VExport.demux(b):null}catch(_){return null}})();return cache[id]}
  // files the frame reader can't read are read by seeking an element to every frame (slower, still exact)
  function seekReader(id){const el=document.createElement('video');el.muted=true;el.preload='auto';el.src=rt.src[id].url;return{async at(us){await seekEl(el,us/1e6);return el.readyState>=2&&el.videoWidth?{img:el,w:el.videoWidth,h:el.videoHeight}:null},close(){try{el.removeAttribute('src');el.load()}catch(_){}}}}
  // one reader per clip, so two clips from the same recording (for example during a transition) each keep their own place
  async function readerFor(key,id,cache,readers,stats){if(readers[key])return readers[key];const tr=await trackOf(id,cache);if(!tr)stats.seek.add(id);const r=tr?VExport.frames(tr):seekReader(id);r.src=id;return readers[key]=r}
  async function mixAudio(T,rate){const oac=new OfflineAudioContext(2,Math.max(1,Math.ceil(T*rate)),rate),bufs={};
    const dec=id=>{if(!(id in bufs))bufs[id]=(async()=>{const b=await blobOf(id);if(!b)return null;try{return await oac.decodeAudioData(await b.arrayBuffer())}catch(_){return null}})();return bufs[id]};
    const master=buildFx(oac);master.apply(e.master);const mg=oac.createGain(),out=oac.createGain();master.output.connect(mg);mg.connect(out);out.connect(oac.destination);
    const curve=(node,t0,len,f)=>{const n=Math.max(2,Math.ceil(len*100)+1),cv=new Float32Array(n);for(let i=0;i<n;i++)cv[i]=f(Math.min(t0+i/100,t0+len-1e-4));node.setValueCurveAtTime(cv,t0,(n-1)/100)};
    curve(out.gain,0,T,t=>{let m=1;if(e.fadeIn&&t<.6)m=Math.min(m,t/.6);if(e.fadeOut&&T-t<.6)m=Math.min(m,Math.max(0,(T-t)/.6));return m});
    for(const [list,isAud] of [[e.clips,false],[e.aud,true]])for(const c of list){const buf=await dec(c.src);if(!buf)continue;const sp=c.speed||1,len=clipLen(c),a0=Math.max(0,c.a),a1=Math.min(buf.duration,c.b);if(len<=0||a1<=a0)continue;
      let src=buf,off=a0,dur=a1-a0;
      if(Math.abs(sp-1)>1e-3){const i0=Math.floor(a0*buf.sampleRate),i1=Math.floor(a1*buf.sampleRate),chs=[];for(let k=0;k<buf.numberOfChannels;k++)chs.push(buf.getChannelData(k).slice(i0,i1));const st=VExport.stretch(chs,sp);
        src=oac.createBuffer(st.length,st[0].length,buf.sampleRate);st.forEach((d,k)=>src.copyToChannel(d,k));off=0;dur=Math.min(src.duration,len);await pause0()}
      const bs=oac.createBufferSource(),g=oac.createGain();bs.buffer=src;let node=bs;
      if(c.fx&&JSON.stringify(Object.assign(defFx(),c.fx))!==JSON.stringify(defFx())){const fx=buildFx(oac);fx.apply(c.fx);bs.connect(fx.input);node=fx.output}
      node.connect(g);g.connect(master.input);curve(g.gain,c.start,len,t=>gainFor(c,t,isAud));bs.start(c.start,off,dur)}
    return oac.startRendering()}
  async function exportFrames(cw,ch,onProg,ctl,opts){if(!root.VExport||!VExport.ok)throw Error('This computer has no frame-by-frame encoder.');stopPlay();const T=total(e);if(T<=0)throw new Error('There is nothing on the timeline yet.');
    const fmt=opts.fmt==='webm'?'webm':'mp4',cache={},readers={},stats={seek:new Set()},prog=p=>{try{onProg&&onProg(p)}catch(_){}};
    let fps=+opts.fps||+e.fps||0;if(!fps){const s0=e.srcs.find(s=>s.self),tr=s0?await trackOf(s0.id,cache):null,f=(tr&&tr.fps)||30;fps=[24,25,30,50,60].reduce((a,b)=>Math.abs(b-f)<Math.abs(a-f)?b:a,30)}
    const N=Math.max(1,Math.round(T*fps)),fdur=1e6/fps,bitrate=Math.round(clamp(cw*ch*fps*.14,1.5e6,40e6));
    const vchunks=[];let vmeta=null,verr=null;const venc=new VideoEncoder({output:(c,m)=>{const d=new Uint8Array(c.byteLength);c.copyTo(d);vchunks.push({ts:c.timestamp,dur:c.duration||fdur,key:c.type==='key',data:d});if(m&&m.decoderConfig&&!vmeta)vmeta=m.decoderConfig},error:x=>{verr=x}});
    try{let vcfg=null;const cands=fmt==='mp4'?VExport.avcCodec(cw,ch,fps).map(codec=>({codec,avc:{format:'avc'}})):[{codec:'vp09.00.40.08'},{codec:'vp09.00.10.08'},{codec:'vp8'}];
      for(const c of cands){const cfg={...c,width:cw,height:ch,bitrate,framerate:fps,latencyMode:'quality'};try{if((await VideoEncoder.isConfigSupported(cfg)).supported){vcfg=cfg;break}}catch(_){}}
      if(!vcfg)throw Error('No '+fmt.toUpperCase()+' video encoder for '+cw+'×'+ch+'.');venc.configure(vcfg);prog(0);
      const rate=48000,pcm=await mixAudio(T,rate);if(ctl&&ctl.cancel)return null;prog(.05);
      const cv=document.createElement('canvas');cv.width=cw;cv.height=ch;const g=cv.getContext('2d'),saved=S.targets;S.mode='export';S.xf={};
      try{for(let i=0;i<N;i++){if(ctl&&ctl.cancel)return null;if(verr)throw verr;const t=Math.min(i/fps,T-1e-4);S.t=t;
          const act=active(t),xf={},idle=Object.keys(readers).filter(k=>k!=='__cam'&&!act.some(c=>c.id===k));
          // a clip that starts after another clip of the same recording ends takes over its reader, so it doesn't decode the file again from the start
          for(const c of act)if(!readers[c.id]){const k=idle.find(k=>readers[k]&&readers[k].src===c.src);if(k){readers[c.id]=readers[k];delete readers[k]}}
          for(const k of idle)if(readers[k]){readers[k].close();delete readers[k]}
          for(const c of act){const r=await readerFor(c.id,c.src,cache,readers,stats);xf[c.id]=await r.at(wantTime(c,t)*1e6)}
          const ca=camAt(t);if(ca){const r=await readerFor('__cam',e.cam.src,cache,readers,stats);xf.__cam=await r.at(Math.max(0,ca.t)*1e6)}
          S.xf=xf;drawFrame(g,t,cw,ch);
          const vf=new VideoFrame(cv,{timestamp:Math.round(i*fdur),duration:Math.round(fdur)});while(venc.encodeQueueSize>4)await new Promise(r=>setTimeout(r,2));venc.encode(vf,{keyFrame:i%Math.round(fps*2)===0});vf.close();
          if(i%4===3){prog(.05+.88*i/N);await pause0()}}
        await venc.flush();if(verr)throw verr}
      finally{for(const r of Object.values(readers))r.close();S.mode='preview';S.xf=null;S.targets=saved}
      // sound
      const achunks=[];let ameta=null,aerr=null,acodec=null;const aenc=new AudioEncoder({output:(c,m)=>{const d=new Uint8Array(c.byteLength);c.copyTo(d);achunks.push({ts:c.timestamp,dur:c.duration||0,data:d});if(m&&m.decoderConfig&&!ameta)ameta=m.decoderConfig},error:x=>{aerr=x}});
      try{for(const [codec,br] of (fmt==='mp4'?[['mp4a.40.2',192000],['opus',160000]]:[['opus',160000]])){const cfg={codec,sampleRate:rate,numberOfChannels:2,bitrate:br};try{if((await AudioEncoder.isConfigSupported(cfg)).supported){aenc.configure(cfg);acodec=codec;break}}catch(_){}}
        if(acodec){const F=4800,L=pcm.getChannelData(0),R=pcm.getChannelData(1);for(let p=0;p<pcm.length;p+=F){if(aerr)throw aerr;const n=Math.min(F,pcm.length-p),data=new Float32Array(n*2);data.set(L.subarray(p,p+n),0);data.set(R.subarray(p,p+n),n);
            const ad=new AudioData({format:'f32-planar',sampleRate:rate,numberOfFrames:n,numberOfChannels:2,timestamp:Math.round(p*1e6/rate),data});while(aenc.encodeQueueSize>8)await new Promise(r=>setTimeout(r,1));aenc.encode(ad);ad.close()}
          await aenc.flush();if(aerr)throw aerr}}finally{try{aenc.state!=='closed'&&aenc.close()}catch(_){}}
      prog(.97);const ms=T*1000,head=ameta&&ameta.description?bytesOf(ameta.description):null;let blob;
      if(fmt==='mp4'){if(!vmeta||!vmeta.description)throw Error('The video encoder gave no H.264 header.');
        blob=VExport.mp4({video:{chunks:vchunks,w:cw,h:ch,avcC:bytesOf(vmeta.description)},audio:acodec?{chunks:achunks,rate,channels:2,codec:acodec==='opus'?'opus':'aac',asc:head||new Uint8Array([0x11,0x90]),bitrate:192000,preskip:312}:null,durationMs:ms})}
      else blob=VExport.webm({video:{chunks:vchunks,w:cw,h:ch,codecId:vcfg.codec.startsWith('vp8')?'V_VP8':'V_VP9'},audio:acodec?{chunks:achunks,rate,channels:2,head:head&&head.length>=19?head:null,preskip:head&&head.length>=12?new DataView(head.buffer,head.byteOffset).getUint16(10,true):312}:null,durationMs:ms});
      S.lastExport={mode:'frames',fmt,fps,frames:N,codec:vcfg.codec,audio:acodec,seekSources:stats.seek.size};prog(1);return{[fmt]:blob}}
    finally{try{venc.state!=='closed'&&venc.close()}catch(_){}sync()}}
  // opts: {fmt:'mp4'|'webm', fps}. Returns {mp4} or {webm} (the real-time fallback may return both), or null when cancelled.
  async function exportRun(cw,ch,onProg,ctl,opts={}){try{return await exportFrames(cw&~1,ch&~1,onProg,ctl,opts)}catch(err){if(ctl&&ctl.cancel)return null;console.warn('Saving frame by frame failed, so the edit is recorded in real time instead:',err);
      S.lastExport={mode:'realtime',reason:String(err&&err.message||err)};return exportRealtime(cw,ch,onProg,ctl)}}
  async function renderTimes(times,cw,ch,cb,ctl){stopPlay();const cv=document.createElement('canvas');cv.width=cw;cv.height=ch;const g=cv.getContext('2d',{willReadFrequently:true});
    for(let i=0;i<times.length;i++){if(ctl&&ctl.cancel)return false;S.t=times[i];await prepare(times[i]);drawFrame(g,times[i],cw,ch);await cb(g,i);if(i%3===2)await new Promise(r=>setTimeout(r,0))}return true}
  function snapshot(cw,ch){const c=document.createElement('canvas');c.width=cw||e.W;c.height=ch||e.H;drawFrame(c.getContext('2d'),S.t,c.width,c.height);return c}
  function destroy(){stopPlay();for(const o of poolEls())killEl(o);if(S.els.__cam)killEl(S.els.__cam);S.pool={};S.els={};try{S.ac&&S.ac.close()}catch(_){}}
  const elFor=c=>{const o=S.els[c.id]||(S.pool[c.src]||[]).find(x=>x.el.videoWidth);return o?o.el:null};
  return{S,e,zoomAt,hasCam,unlock,play,pause,seek,render,sync,refreshFx,exportRun,renderTimes,snapshot,destroy,active,elFor,prepare,drawFrame,get t(){return S.t},set t(v){S.t=v},get playing(){return S.playing},setTargets(a){S.targets=a},onEnd(f){S.onEnd=f},onTick(f){S.onTick=f},gainFor}}

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
.vtabs{display:flex;gap:4px;border-bottom:1px solid var(--line);padding-bottom:6px;flex-wrap:wrap;position:sticky;top:-10px;z-index:4;background:var(--panel);padding-top:8px;margin-top:-8px}.vtabs.lktabs{position:static;margin-top:0;padding-top:0;z-index:auto}
.vtabs button{border:1px solid var(--line);background:var(--panel-2);color:var(--fg);padding:5px 11px;border-radius:7px;cursor:pointer;font-weight:600;font-size:12px}.vtabs button[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:var(--accent-fg)}
.vsec{display:flex;flex-direction:column;gap:8px}.vpane{display:flex;flex-direction:column;gap:9px}.vpane>*{flex-shrink:0}.vpane[hidden]{display:none}.vtr{grid-template-columns:repeat(2,1fr)!important}.vsec[hidden]{display:none}.vnote{color:var(--muted);font-size:12px;margin:0}
.veq{display:flex;flex-wrap:wrap;gap:4px;align-items:flex-end;background:var(--panel-2);padding:8px 10px;border-radius:8px}
.veq div{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;color:var(--muted);width:30px}
.veq input[type=range]{writing-mode:vertical-lr;direction:rtl;height:92px;width:22px;min-width:0;flex:none;margin:0}.veq>.vnote{flex-basis:100%;padding-left:0!important}
.vtr{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}.vtr .btn{justify-content:flex-start}
.lkg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:8px;background:var(--panel-2);border-radius:10px;max-height:52vh;overflow:auto}
.lkg button{background:#2b3036;border:2px solid transparent;border-radius:8px;padding:4px;cursor:pointer;display:flex;flex-direction:column;gap:4px;color:var(--fg);font:600 11px var(--f-ui,sans-serif);text-align:center}
.lkg button canvas{width:100%;height:auto;display:block;border-radius:5px;aspect-ratio:16/9}.lkg button:hover{border-color:#5a6470}.lkg button[aria-pressed=true]{border-color:#f5c400;box-shadow:0 0 0 1px #f5c400}
.lktabs button{border-radius:999px!important}.lktabs button[aria-pressed=true]{background:#8fd14f!important;border-color:#8fd14f!important;color:#14200a!important}
.vfxg{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:6px}.vfxg .btn{justify-content:flex-start;gap:7px;padding:5px 7px;font-size:12px}
.vfxsw{display:inline-block;width:26px;height:18px;border-radius:4px;flex:none;background:linear-gradient(135deg,#e5483b 0 25%,#f5c400 25% 50%,#2db3a0 50% 75%,#5aa2ff 75%)}
.vfxsw.vfx-warm{box-shadow:inset 0 0 0 20px rgba(255,140,40,.35)}.vfxsw.vfx-cool{box-shadow:inset 0 0 0 20px rgba(40,120,255,.35)}.vfxsw.vfx-vignette{box-shadow:inset 0 0 7px 3px rgba(0,0,0,.85)}
.vfxlist{display:flex;flex-direction:column;gap:4px}.vfxlist .vrow{background:var(--panel-2);padding:4px 7px;border-radius:7px;cursor:pointer;font-size:12px}.vfxlist .vrow.vsel{outline:2px solid #b07cf5}.vfxlist .vrow.voff{opacity:.5}
.vjoin .jr{display:flex;gap:6px;align-items:center;padding:5px 6px;background:var(--panel-2);border-radius:7px;margin-bottom:4px}.vjoin .jr b{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}`;document.head.appendChild(s)}

// ---------- the editor ----------
function mount(host,it,api){css();HK=api;
  it._edBlobs=it._edBlobs||{};
  host.innerHTML=`<div class="vmain"><div class="vstage"><div class="vbox"><canvas class="vprev" role="img" aria-label="Video preview"></canvas><canvas class="vov" aria-hidden="true"></canvas></div></div>
  <div class="vpanel">
   <div class="vrow"><button class="btn" data-a="tog" title="Hide or show the timeline">▾ Hide timeline</button><button class="btn pri" data-a="play" title="Play from the playhead (Space)">Play</button><button class="btn" data-a="playsel" title="Play only the selected item or the In–Out range (Shift+Space)">Play selection</button><button class="btn" data-a="playall" title="Play everything from the start">Play all</button><button class="btn" data-a="mrestart" title="Back to the start and play">⏮ Restart</button><label><input type="checkbox" data-r="loop"> Loop</label><span class="vtime" data-r="time">Loading…</span><span class="sp"></span><span class="vz" style="display:contents"><button class="btn" data-a="zout" title="Zoom timeline out">−</button><span class="vh">Zoom</span><button class="btn" data-a="zin" title="Zoom timeline in">+</button></span></div>
   <div class="vtlwrap"><canvas class="vtl" aria-label="Timeline"></canvas></div>
  </div></div>
  <div class="vside">
  <div class="vpane" data-pane="video">
   <div class="vrow"><span class="vnote" data-r="hint">Drag the circles on a bar to trim it. Drag the middle of a clip to move it, and slide it over another clip to overlap them.</span><span class="sp"></span>
     <label>In <input type="number" step="0.1" min="0" data-r="in" aria-label="In point (seconds)"></label><button class="btn" data-a="setin" title="Mark In at playhead (I)">Set In</button><label>Out <input type="number" step="0.1" min="0" data-r="out" aria-label="Out point (seconds)"></label><button class="btn" data-a="setout" title="Mark Out at playhead (O)">Set Out</button></div>
   <div class="vrow"><button class="btn" data-a="split" title="Split at playhead (S)">Split</button><button class="btn" data-a="del" title="Delete the selected item (Del). Video clips close the gap.">Delete</button><button class="btn" data-a="delgap" title="Delete but leave a gap">Delete, keep gap</button>
     <button class="btn" data-a="cut" title="Remove the In–Out part from everything and close the gap">Cut out In–Out</button><button class="btn" data-a="trim" title="Keep only the In–Out part">Trim to In–Out</button>
     <button class="btn" data-a="addvid" title="Add other videos from your library or a file to the end of the timeline">Add videos…</button><button class="btn" data-a="dupclip" title="Copy the selected clip and put the copy right after it">Duplicate</button><span class="sp"></span><button class="btn" data-a="undo" title="Undo (Ctrl+Z)">Undo</button><button class="btn" data-a="redo" title="Redo (Ctrl+Y)">Redo</button><button class="btn" data-a="reset" title="Go back to the original recording (you can Undo this)">Reset</button></div>

   <div class="vtabs">${[['clip','Clip'],['trans','Transitions'],['zoom','Zoom & pan'],['vfx','Visual effects'],['look','Layout'],['audio','Audio'],['caps','Captions'],['export','Export']].map(([k,l])=>`<button data-tab="${k}" title="${({clip:"Trim, speed and crop the selected clip, and set the whole video size and fades",trans:"Choose how one clip changes into the next",zoom:"Zoom in on part of the picture for a while",vfx:"Colour and look effects that you can time and stack",look:"Where the screen and webcam sit, and the background",audio:"Add music or a voice-over, and change clip volume and fades",caps:"Add text captions at set times",export:"Save the edit as a new video or as a GIF"})[k]}" aria-pressed="${k==='clip'}">${l}</button>`).join('')}</div>
   <div class="vsec" data-sec="clip">
     <div class="vrow" data-r="offrow" hidden></div><input type="file" data-r="relinkfile" hidden>
     <p class="vnote" data-r="clipnote">Click a clip on the timeline to edit it here.</p>
     <div class="vrow" data-r="cprops"><label>Start at <input type="number" step="0.1" min="0" data-c="start"> s</label><label>Source in <input type="number" step="0.1" min="0" data-c="a"></label><label>out <input type="number" step="0.1" min="0" data-c="b"></label>
       <label>Speed <select data-c="speed">${[.25,.5,.75,1,1.25,1.5,2,3,4].map(s=>`<option value="${s}">${s}×</option>`).join('')}</select></label>
       <span class="vh">Crop %</span><label>L <input type="number" min="0" max="90" data-cr="l" aria-label="Crop left (%)"></label><label>T <input type="number" min="0" max="90" data-cr="t" aria-label="Crop top (%)"></label><label>R <input type="number" min="0" max="90" data-cr="r" aria-label="Crop right (%)"></label><label>B <input type="number" min="0" max="90" data-cr="b" aria-label="Crop bottom (%)"></label></div>
     <div class="vrow" data-r="croprow"><span class="vh">Crop</span><button class="btn pri" data-a="cropstart" title="Show the whole frame and drag a box to choose the part to keep">Start crop</button><button class="btn pri" data-a="cropstop" title="Keep this crop (Enter)" hidden>Stop crop</button><button class="btn" data-a="cropcancel" title="Go back to the crop you had (Esc)" hidden>Cancel</button><button class="btn" data-a="cropreset" title="Show the whole frame of this clip">Reset crop</button></div>
     <p class="vnote" data-r="cropnote" hidden>Drag the box on the picture, or its handles, to choose what to keep. Stop crop keeps it.</p>
     <div class="vrow"><span class="vh">Whole video</span><label>Size <select data-r="canvas"><option value="auto">Same as first clip</option><option value="1920x1080">1920 × 1080</option><option value="1280x720">1280 × 720</option><option value="854x480">854 × 480</option><option value="1080x1080">Square 1080</option><option value="1080x1920">Vertical 1080 × 1920</option></select></label>
       <label><input type="checkbox" data-r="fi"> Fade in from black</label><label><input type="checkbox" data-r="fo"> Fade out to black</label></div></div>
   <div class="vsec" data-sec="audio" hidden>
     <div class="vrow"><button class="btn pri" data-a="addaud">Add audio file…</button><button class="btn" data-a="rec">● Record voice-over</button><input type="file" accept="audio/*,video/*" data-r="audfile" hidden>
       <label><input type="checkbox" data-r="muteall"> Mute the video's own sound</label><span class="vnote" data-r="recnote">Voice-over starts at the playhead and plays the video as you talk. Use headphones to avoid echo.</span></div>
     <div class="vrow"><label>Selected clip volume <input type="range" min="0" max="300" data-c="vol" style="width:150px"></label><label><input type="checkbox" data-c="mute"> Mute this clip</label><label>Fade in <input type="number" min="0" step="0.1" data-c="afi"> s</label><label>Fade out <input type="number" min="0" step="0.1" data-c="afo"> s</label></div>
</div>
   <div class="vsec" data-sec="trans" hidden>
     <p class="vnote" data-r="trnote">Click a video clip (not the first one), then choose how the picture changes into it. Slide a clip over the one before it to set how long the change takes.</p>
     <div class="vtr" data-r="trgrid">${TRANS.map(([k,l])=>`<button class="btn" data-tr="${k}" aria-pressed="false">${l}</button>`).join('')}</div>
     <div class="vrow"><label>Length <input type="number" min="0.1" max="10" step="0.1" data-r="trlen" value="1"> s</label><button class="btn" data-a="trlen">Set length</button><button class="btn" data-a="trall">Use this transition on every clip</button></div></div>
   <div class="vsec" data-sec="zoom" hidden><div class="vrow"><button class="btn pri" data-a="addzoom">Add zoom at playhead</button></div>
     <p class="vnote" data-r="znote">Zoom in on part of the picture for a few seconds, then back out. Add a zoom, then drag a box on the picture to choose where it zooms.</p>
     <div class="vrow" data-r="zrow" hidden><label>Zoom <input type="number" min="110" max="800" step="10" data-r="zpct"> %</label><label>Ease <input type="number" min="0" max="3" step="0.1" data-r="zease"> s</label><label>from <input type="number" step="0.1" min="0" data-r="zf" aria-label="Zoom from (seconds)"></label><label>to <input type="number" step="0.1" min="0" data-r="zt" aria-label="Zoom to (seconds)"></label><button class="btn" data-a="zdel">Remove</button></div></div>
   <div class="vsec" data-sec="vfx" hidden><p class="vnote">Click an effect to add it at the playhead. Drag its ends on the timeline to change how long it lasts, or use Whole video. Effects can overlap, so you can stack them (for example Brightness and Contrast).</p>
     <div class="vfxg">${VFX.map(([k,l])=>`<button class="btn" data-vfx="${k}" title="Add ${l} at the playhead" aria-label="Add ${l} at the playhead">${vfxIcon(k)}${l}</button>`).join('')}</div>
     <div data-r="vfxsel" hidden><div class="vrow"><b data-r="vfxlbl">Effect</b><label class="vfxamt">Amount <input type="range" data-r="vfxamt" style="width:150px"> <span data-r="vfxval" class="vh"></span></label></div>
       <div class="vrow"><label>from <input type="number" step="0.1" min="0" data-r="vfxf" aria-label="Effect from (seconds)"></label><label>to <input type="number" step="0.1" min="0" data-r="vfxt" aria-label="Effect to (seconds)"></label><label>Fade in <input type="number" step="0.1" min="0" data-r="vfxfi"> s</label><label>Fade out <input type="number" step="0.1" min="0" data-r="vfxfo"> s</label></div>
       <div class="vrow"><button class="btn" data-a="vfxall" title="Stretch this effect over the whole video">Whole video</button><button class="btn" data-a="vfxhere" title="Start this effect at the playhead">Start here</button><button class="btn" data-a="vfxend" title="End this effect at the playhead">End here</button><label><input type="checkbox" data-r="vfxoff"> Turn off</label><button class="btn" data-a="vfxdup">Duplicate</button><button class="btn" data-a="vfxdel">Remove</button></div></div>
     <div class="vfxlist" data-r="vfxlist"></div></div>
   <div class="vsec" data-sec="look" hidden>
     <div class="vrow"><span class="vnote" data-r="lknote"></span><span class="sp"></span><button class="btn" data-a="lkcam" title="Use another video (for example a separate webcam recording) as the webcam">Choose webcam video…</button><input type="file" accept="video/*" data-r="camfile" hidden></div>
     <div class="vtabs lktabs">${[['looks','Looks'],['layout','Layout'],['bg','Background'],['style','Style']].map(([k,l],i)=>`<button data-lk="${k}" title="Show ${l.toLowerCase()} choices" aria-pressed="${!i}">${l}</button>`).join('')}</div>
     <div class="lkg" data-r="lkgrid"></div>
     <div data-r="lkstyle" hidden><div class="vrow"><span class="vh">Webcam corner</span>${[['tl','↖ Top left'],['tr','↗ Top right'],['bl','↙ Bottom left'],['br','↘ Bottom right']].map(([k,l])=>`<button class="btn" data-lkpos="${k}">${l}</button>`).join('')}</div>
       <div class="vrow"><span class="vh">Webcam shape</span>${[['circle','Circle'],['rounded','Rounded'],['square','Square'],['wide','Wide']].map(([k,l])=>`<button class="btn" data-lkshape="${k}">${l}</button>`).join('')}</div>
       <div class="vrow"><label>Webcam size <input type="range" min="10" max="45" data-r="lksize" style="width:140px"></label><label><input type="checkbox" data-r="lkround"> Rounded screen corners</label><label><input type="checkbox" data-r="lkshadow"> Shadow</label><label><input type="checkbox" data-r="lkborder"> Webcam border</label><label>Custom background <input type="color" data-r="lkcolor"></label></div></div>
     <button class="btn" data-a="lkreset" title="Back to the plain recording: screen filling the frame on black">Reset layout</button></div>
   <div class="vsec" data-sec="caps" hidden><div class="vrow"><button class="btn" data-a="addcap" title="Add a caption that starts at the playhead">Add caption at playhead</button></div><div class="vcaps" data-r="caps"></div></div>
   <div class="vsec" data-sec="export" hidden>
     <div class="vrow"><span class="vh">Video</span><label>Quality <select data-r="osize"><option value="project">Full size</option><option value="720">720p</option><option value="480">480p</option></select></label><label title="Frames per second for every save of this video, including the top-bar Save">Frame rate <select data-r="ofps"><option value="">Same as recording</option><option value="24">24</option><option value="25">25</option><option value="30">30</option><option value="60">60</option></select></label><button class="btn pri" data-a="apply" title="Save the edit as a new video in your library">Save edited video</button></div>
     <div class="vrow"><span class="vh">GIF</span><label>frames/sec <input type="number" min="1" max="30" value="10" data-r="fps"></label><label>width <input type="number" min="64" max="1920" step="20" value="480" data-r="gw"></label><button class="btn pri" data-a="gif">Save GIF</button><button class="btn" data-a="stop" hidden>Cancel</button></div>
     <p class="vnote">Saving draws every frame of your edit and mixes the sound separately, so no frames or sound are lost. On most computers it takes less time than the video lasts.</p></div>
  </div>
  <div class="vpane" data-pane="effects" hidden>
   <div class="vsec">
     <div class="vrow"><span class="vh">Sound effects for</span><label><select data-r="atarget"><option value="master">Everything (master)</option><option value="sel">Selected clip only</option></select></label>
       <label>Preset <select data-r="eqpre">${Object.keys(EQ_PRESETS).map(k=>`<option>${k}</option>`).join('')}</select></label><button class="btn" data-a="fxreset">Reset sound</button></div>
     <div class="veq" data-r="eq">${EQ_L.map((l,i)=>`<div><span data-r="eqv${i}">0</span><input type="range" min="-12" max="12" step="1" value="0" data-eq="${i}" aria-label="${l} Hz"><span>${l}</span></div>`).join('')}<span class="vnote" style="align-self:center;padding-left:8px">Equalizer: pull a band down to cut it, push up to boost.</span></div>
     <div class="vrow"><label>Low cut <input type="number" min="0" max="600" step="10" data-fx="lc"> Hz</label><label>High cut <input type="number" min="0" max="20000" step="500" data-fx="hc"> Hz</label>
       <label>Boost <input type="range" min="50" max="300" data-fx="gain" style="width:90px"></label><label>Level control <input type="range" min="0" max="100" data-fx="comp" style="width:90px"></label>
       <label>Reverb <input type="range" min="0" max="100" data-fx="rev" style="width:90px"></label><label>Echo <input type="range" min="0" max="100" data-fx="echo" style="width:90px"></label><label>Echo time <input type="range" min="5" max="140" data-fx="echoT" style="width:80px"></label></div></div>
  </div>
  <div class="vpane" data-pane="tools" hidden>
   <div class="vsec">
     <div class="vrow"><span class="vh">Draw on video</span>${[['select','Select'],['arrow','Arrow'],['rect','Box'],['ellipse','Circle'],['line','Line'],['highlight','Highlight'],['text','Text'],['step','Step #'],['stamp','Stamp'],['blur','Blur']].map(([k,l])=>`<button class="btn" data-ot="${k}" aria-pressed="false">${l}</button>`).join('')}
       <label>Colour <input type="color" data-r="ocol" value="#e5483b"></label><label>Width <input type="number" min="1" max="40" data-r="owid" value="6"></label></div>
     <div class="vrow" data-r="osel" hidden><b data-r="olbl">Selected</b><label>shows from <input type="number" step="0.1" min="0" data-r="of" aria-label="Item shows from (seconds)"></label><label>to <input type="number" step="0.1" min="0" data-r="ot2" aria-label="Item shows until (seconds)"></label><button class="btn" data-a="ostart">Start here</button><button class="btn" data-a="oend">End here</button><button class="btn" data-a="odup">Duplicate</button><button class="btn" data-a="odel">Remove</button></div>
     <p class="vnote">Pick a tool, drag on the picture. The red bars on the timeline show when each item appears. Drag the circles to change that.</p></div>
  </div>
   <div class="vprog" data-r="prog" hidden><i></i></div><div class="vinfo"></div>
  </div>`;
  const q=s=>host.querySelector(s),qa=s=>[...host.querySelectorAll(s)],R=n=>q(`[data-r="${n}"]`),prev=q('.vprev'),ov=q('.vov'),tl=q('.vtl');
  const pg=prev.getContext('2d');
  let eng=null,e=null,rt={src:{}},sel=null,inT=0,outT=0,hist=[],fut=[],zdrag=null,zoom=1,L=[],tdrag=null,tsnap=false,otool=null,crop=null,pane='video',odrag=null,playRange=null,dead=false,raf=0,exp=null,tab='clip',rec=null,ready=false;
  const toast=api.toast,pasteUrls=new Set();let pasteBusy=false;
  const D=()=>Math.max(total(e||{clips:[],aud:[]}),0.1);
  const selVfx=()=>sel&&sel.type==='vfx'?sel.ref:null,selZoom=()=>sel&&sel.type==='zoom'?sel.ref:null,zedit=()=>!!(selZoom()&&tab==='zoom'&&!crop),selOv=()=>sel&&sel.type==='ov'?sel.ref:null,selCap=()=>sel&&sel.type==='cap'?sel.ref:null,selClip=()=>sel&&(sel.type==='clip'||sel.type==='aud')?sel.ref:null;
  const snap=()=>{hist.push(JSON.stringify(e));if(hist.length>100)hist.shift();fut=[]};
  // 8.07: a click fires pointerdown and focus; save one undo step, not two.
  const snapOnce=()=>{if(hist[hist.length-1]!==JSON.stringify(e))snap()};
  const changed=()=>{vDirty=true;try{api.changed&&api.changed()}catch(_){}};
  const redraw=()=>{if(eng)eng.seek(eng.t)};
  // 8.04: keep the whole preview inside its area (the CSS cap alone let the timeline cover the bottom on smaller windows).
  const stageEl=q('.vstage'),fitPrev=()=>{const h=stageEl.clientHeight-16;if(h>0)prev.style.maxHeight=Math.max(120,h)+'px'};
  const fitObs=new ResizeObserver(()=>{fitPrev();vDirty=true});fitObs.observe(stageEl);
  function sizePrev(){const cw=Math.min(960,e.W),ch=Math.round(cw*e.H/e.W);prev.width=cw;prev.height=ch;ov.width=e.W;ov.height=e.H;prev.style.aspectRatio=cw+'/'+ch;eng.setTargets([{g:pg,cw,ch}]);redraw()}
  function select(type,ref){if(crop&&ref!==crop.c)cropStop(true);sel=type?{type,ref}:null;if(type==='zoom'&&tab!=='zoom')setTab('zoom');if(type==='vfx'&&tab!=='vfx')setTab('vfx');refreshProps();ovui()}

  // ----- timeline -----
  const PAD=11,LANE=18,CL=28;
  const xOf=t=>PAD+t/D()*(tl.clientWidth-2*PAD),tOf=x=>clamp((x-PAD)/Math.max(1,tl.clientWidth-2*PAD)*D(),0,D());
  function lanes(items,rng){const ends=[],out=[];for(const x of [...items].sort((a,b)=>rng(a)[0]-rng(b)[0])){let l=0;const [s,en]=rng(x);while(ends[l]!==undefined&&ends[l]>s+1e-6)l++;ends[l]=en;out.push([x,l])}return{out,n:Math.max(1,ends.length)}}
  const isSel=x=>sel&&sel.ref===x.ref;
  function layout(){const G=[];let y=20;L=[];
    const vs=[];e.clips.forEach(c=>{if(!vs.includes(c.src))vs.push(c.src)});const vl={out:e.clips.map(c=>[c,vs.indexOf(c.src)]),n:Math.max(1,vs.length)},al=lanes(e.aud,c=>[c.start,clipEnd(c)]),cl=lanes(e.caps,c=>[c.t0,c.t1]),ol=lanes(e.ovs,c=>[c.t0,c.t1]),zl=lanes(e.zooms,c=>[c.t0,c.t1]),fl=lanes(e.vfx,c=>[c.t0,c.t1]);
    const add=(name,g,type,h,rng)=>{G.push({name,y:y+10});y+=12;g.out.forEach(([c,l])=>{const [s,en]=rng(c);L.push({type,ref:c,t0:s,t1:en,y:y+l*(h+3),h})});y+=g.n*(h+3)+4};
    add('VIDEO',vl,'clip',CL,c=>[c.start,clipEnd(c)]);if(e.zooms.length)add('ZOOM & PAN',zl,'zoom',LANE-3,c=>[c.t0,c.t1]);if(e.vfx.length)add('VISUAL EFFECTS',fl,'vfx',LANE-3,c=>[c.t0,c.t1]);add('AUDIO · music and voice-over',al,'aud',22,c=>[c.start,clipEnd(c)]);add('CAPTIONS',cl,'cap',LANE-3,c=>[c.t0,c.t1]);add('ON-SCREEN ITEMS · arrows, text, stamps',ol,'ov',LANE-3,c=>[c.t0,c.t1]);
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
        g.fillStyle='rgba(90,162,255,.16)';g.fillRect(xOf(inT),18,xOf(outT)-xOf(inT),H-18);
    for(const x of L){const x0=xOf(x.t0),x1=Math.max(x0+4,xOf(x.t1)),s=isSel(x),y=x.y,h=x.h,ym=y+h/2;
      let col=x.type==='clip'?PALETTE[srcIdx(x.ref.src)%PALETTE.length]:x.type==='aud'?'#8c6bd8':x.type==='cap'?'#f5c400':x.type==='zoom'?'#4cc16b':x.type==='vfx'?(x.ref.off?'#6a5a86':'#b07cf5'):'#e5483b';
      g.globalAlpha=.9;g.fillStyle=col;g.beginPath();(g.roundRect?g.roundRect(x0,y,x1-x0,h,4):g.rect(x0,y,x1-x0,h));g.fill();g.globalAlpha=1;
      if(x.type==='clip'||x.type==='aud'){const pk=rt.src[x.ref.src]&&rt.src[x.ref.src].peaks;if(pk){g.save();g.beginPath();g.rect(x0,y,x1-x0,h);g.clip();g.strokeStyle='rgba(255,255,255,.55)';g.lineWidth=1;g.beginPath();const sp=x.ref.speed||1,pxPer=(x1-x0)/Math.max(.01,x.t1-x.t0);for(let px=Math.floor(x0);px<x1;px+=2){const t=x.ref.a+((px-x0)/pxPer)*sp,i=Math.floor(t*40),v=pk[i]||0;g.moveTo(px,ym-v*h*.45);g.lineTo(px,ym+v*h*.45)}g.stroke();g.restore()}}
      if(s){g.lineWidth=2.5;g.strokeStyle='#fff';g.beginPath();(g.roundRect?g.roundRect(x0,y,x1-x0,h,4):g.rect(x0,y,x1-x0,h));g.stroke()}
      const label=x.type==='clip'||x.type==='aud'?srcName(x.ref.src)+'  '+fmt(clipLen(x.ref))+(x.ref.speed&&x.ref.speed!==1?'  '+x.ref.speed+'×':'')+(x.ref.mute?'  (muted)':''):x.type==='cap'?(x.ref.text||'Caption'):x.type==='zoom'?'Zoom '+Math.round(e.W/x.ref.w*100)+'%':x.type==='vfx'?vfxLabel(x.ref):ovName(x.ref)+(x.ref.txt?': '+x.ref.txt:'');
      g.save();g.beginPath();g.rect(x0+8,y,Math.max(0,x1-x0-16),h);g.clip();g.fillStyle=x.type==='cap'?'#111':'#fff';g.font='600 11px sans-serif';g.shadowColor='rgba(0,0,0,.6)';g.shadowBlur=x.type==='cap'?0:3;g.fillText(label,x0+10,ym+4);g.restore();
      const r=s?7:5.5;circ(x0,ym,r,'#fff',col);circ(x1,ym,r,'#fff',col)}
    // transition overlaps
    for(const B of e.clips){if(!B.trans||B.trans.type==='none')continue;const A=e.clips.filter(c=>c!==B&&c.start<B.start&&clipEnd(c)>B.start).sort((a,b)=>b.start-a.start)[0];if(!A)continue;
      const s=B.start,en=Math.min(clipEnd(A),clipEnd(B)),bx=L.find(z=>z.ref===B);if(!bx)continue;g.save();g.beginPath();g.rect(xOf(s),bx.y,xOf(en)-xOf(s),bx.h);g.clip();g.fillStyle='rgba(255,255,255,.28)';g.fill();g.strokeStyle='rgba(255,255,255,.7)';g.lineWidth=1;for(let px=xOf(s)-bx.h;px<xOf(en);px+=7){g.beginPath();g.moveTo(px,bx.y+bx.h);g.lineTo(px+bx.h,bx.y);g.stroke()}g.fillStyle='#fff';g.font='700 10px sans-serif';g.fillText('⇄ '+(TRANS.find(z=>z[0]===B.trans.type)||[0,''])[1],xOf(s)+3,bx.y+bx.h-4);g.restore()}
    g.strokeStyle='#5aa2ff';g.lineWidth=1.5;for(const t of [inT,outT]){const x=xOf(t);g.beginPath();g.moveTo(x,17);g.lineTo(x,H-2);g.stroke()}
    circ(xOf(inT),9,6,'#5aa2ff','#fff');circ(xOf(outT),9,6,'#5aa2ff','#fff');g.fillStyle='#fff';g.font='bold 8px sans-serif';g.fillText('I',xOf(inT)-2,12);g.fillText('O',xOf(outT)-3,12);
    const px=xOf(eng.t);g.fillStyle='#fff';g.fillRect(px-1,0,2,H);g.beginPath();g.moveTo(px-6,0);g.lineTo(px+6,0);g.lineTo(px,8);g.fill();
    g.font='10px sans-serif';for(const gr of lay.G){const tw=g.measureText(gr.name).width;g.fillStyle='rgba(22,24,26,.85)';g.fillRect(2,gr.y-10,tw+8,13);g.fillStyle='rgba(255,255,255,.8)';g.fillText(gr.name,6,gr.y)}
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
  tl.addEventListener('pointerdown',ev=>{if(!ready||ev.button!==0)return;tl.setPointerCapture(ev.pointerId);tsnap=ev.altKey;const x=ev.offsetX,y=ev.offsetY,h=hitTl(x,y);
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
  tl.addEventListener('pointerup',()=>{const d=tdrag;tdrag=null;if(d&&d.moved){changed();eng.seek(eng.t);refreshProps();if(d.it&&d.it.type==='cap')caplist();if(d.it&&d.it.type==='ov')ovui();if(d.it&&d.it.type==='vfx')vfxui()}});
  tl.parentElement.addEventListener('wheel',ev=>{if(!ev.ctrlKey||!ready)return;ev.preventDefault();zoom=ev.deltaY<0?Math.min(16,zoom*1.25):Math.max(1,zoom/1.25);if(zoom<1.05)zoom=1;keepHead()},{passive:false});

  tl.oncontextmenu=ev=>api.mediaMenu?.(ev);
  function insertGap(at,len){for(const key of ['clips','aud']){const right=[];for(const c of e[key]){const end=clipEnd(c);if(c.start>=at)c.start+=len;else if(end>at+.000001){const b=clone(c);b.id=newId(e,key==='clips'?'c':'a');b.a=c.a+(at-c.start)*(c.speed||1);b.start=at+len;b.afi=0;if(b.trans)b.trans={type:'none'};c.b=b.a;c.afo=0;right.push(b)}}e[key].push(...right)}
    for(const key of ['caps','ovs','zooms','vfx']){const right=[];for(const f of e[key]){if(f.t0>=at){f.t0+=len;f.t1+=len}else if(f.t1>at){const b=clone(f);b.id=newId(e,'i');b.t0=at+len;b.t1+=len;f.t1=at;right.push(b)}}e[key].push(...right)}}
  async function insertClip(media,mode='stack',at=eng?.t||0){if(!ready||dead||exp||pasteBusy)throw Error('Wait until the video editor is ready.');pasteBusy=true;const url=URL.createObjectURL(media.blob);let committed=false;try{const meta=await loadMeta(url);if(dead)throw Error('The video editor was closed.');eng.pause();at=clamp(at,0,D());snap();if(mode==='insert')insertGap(at,meta.dur);const id=newId(e,'s');e.srcs.push({id,name:media.name||'Pasted video',kind:'video'});it._edBlobs[id]=media.blob;rt.src[id]={url,blob:media.blob,dur:meta.dur,w:meta.w,h:meta.h};pasteUrls.add(url);committed=true;
    const c={id:newId(e,'c'),src:id,a:0,b:meta.dur,start:at,speed:1,vol:1,mute:false,crop:{l:0,t:0,r:0,b:0},trans:{type:'none'},afi:0,afo:0};e.clips.push(c);eng.sync();outT=D();refreshAll();select('clip',c);changed();eng.seek(at).catch(err=>{if(!dead)toast(err.message)});return c
   }finally{pasteBusy=false;if(!committed)URL.revokeObjectURL(url)}}
  // ----- editing actions -----
  function removeSpan(a,b){const gap=b-a;if(gap<=0)return;
    for(const key of ['clips','aud']){const out=[];for(const c of e[key]){const s=c.start,en=clipEnd(c),sp=c.speed||1;
      if(en<=a){out.push(c)}else if(s>=b){c.start-=gap;out.push(c)}
      else{const keepL=s<a,keepR=en>b;let right=null;
        if(keepR){right=clone(c);right.id=newId(e,key==='clips'?'c':'a');right.a=c.a+(b-s)*sp;right.start=a;right.afi=0;right.trans={type:'none'}}
        if(keepL){c.b=c.a+(a-s)*sp;c.afo=0;if(c.b-c.a>MIN*sp)out.push(c)}
        if(right&&right.b-right.a>MIN*sp)out.push(right)}}
      e[key]=out}
    for(const key of ['caps','ovs','zooms','vfx']){const out=[];for(const c of e[key]){if(c.t1<=a)out.push(c);else if(c.t0>=b){c.t0-=gap;c.t1-=gap;out.push(c)}
      else if(c.t0<a&&c.t1>b){c.t1-=gap;out.push(c)}else if(c.t0<a){c.t1=a;if(c.t1-c.t0>.1)out.push(c)}else if(c.t1>b){c.t0=a;c.t1-=gap;out.push(c)}}e[key]=out}}
  const act={
    cropstart(){cropStart()},cropstop(){cropStop(true)},cropcancel(){cropStop(false)},cropreset(){cropReset()},
    tog(){host.classList.toggle('vmin');q('[data-a="tog"]').textContent=host.classList.contains('vmin')?'▴ Show timeline':'▾ Hide timeline';requestAnimationFrame(()=>{sizePrev&&sizePrev();drawTl()})},mplay(){if(eng.playing)eng.pause();else{playRange=null;eng.unlock();eng.play()}},mrestart(){eng.pause();playRange=null;eng.seek(0);eng.unlock();eng.play()},
    play(){togglePlay()},playsel(){playSel()},playall(){playAll()},zin(){zoom=Math.min(16,zoom*1.6);keepHead()},zout(){zoom=Math.max(1,zoom/1.6);if(zoom<1.05)zoom=1;keepHead()},
    setin(){select(null);inT=Math.min(eng.t,outT-.1)},setout(){select(null);outT=Math.max(eng.t,inT+.1)},
    split(){const t=eng.t,targets=selClip()?[sel]:[...e.clips.map(c=>({type:'clip',ref:c})),...e.aud.map(c=>({type:'aud',ref:c}))];let n=0;snap();
      let skipped=0;for(const tg of targets){const c=tg.ref;if(tg.type==='clip'&&e.clips.some(o=>o!==c&&o.start<t&&clipEnd(o)>t)){skipped++;continue}if(t>c.start+MIN&&t<clipEnd(c)-MIN){const sp=c.speed||1,c2=clone(c);c2.id=newId(e,tg.type==='clip'?'c':'a');c2.a=c.a+(t-c.start)*sp;c2.start=t;c2.afi=0;c2.trans={type:'none'};c.b=c2.a;c.afo=0;(tg.type==='clip'?e.clips:e.aud).push(c2);n++}}
      if(!n){hist.pop();toast(skipped?'The playhead is inside a transition. Move it outside the change between clips to split.':'Move the playhead inside a clip first.');return}eng.sync();redraw();changed()},
    del(){doDelete(false)},delgap(){doDelete(true)},
    cut(){if(outT-inT<.1){toast('Set In and Out first.');return}snap();removeSpan(inT,outT);inT=0;outT=D();sel=null;eng.sync();eng.t=Math.min(eng.t,D());redraw();refreshAll();changed();toast('Cut out. The gap closed up.')},
    trim(){if(outT-inT<.1){toast('Set In and Out first.');return}snap();removeSpan(outT,total(e)+1e5);removeSpan(0,inT);inT=0;outT=D();sel=null;eng.sync();eng.t=0;redraw();refreshAll();changed()},
    undo(){const h=hist.pop();if(!h){toast('Nothing to undo.');return}fut.push(JSON.stringify(e));restore(h)},
    redo(){const h=fut.pop();if(!h){toast('Nothing to redo.');return}hist.push(JSON.stringify(e));restore(h)},
    dupclip(){const c=selClip();if(!c){toast('Click a clip on the timeline first.');return}snap();const ty=sel.type,len=clipLen(c),end=clipEnd(c),list=ty==='clip'?e.clips:e.aud;
      for(const x of list)if(x!==c&&x.start>=end-1e-6)x.start+=len;if(ty==='clip')for(const x of [...e.aud,...e.caps,...e.ovs,...e.zooms,...e.vfx]){if(x.start!=null){if(x.start>=end-1e-6)x.start+=len}else if(x.t0>=end-1e-6){x.t0+=len;x.t1+=len}}
      const d=clone(c);d.id=newId(e,ty==='clip'?'c':'a');d.start=end;if(d.trans)d.trans={type:'none'};list.push(d);eng.sync();select(ty,d);redraw();changed();toast('Duplicated. The copy is right after the original.')},
    addzoom(){if(!e.clips.length){toast('Add a video clip first.');return}snap();const t=eng.t,W=e.W,H=e.H,w=W/2,z={id:newId(e,'z'),t0:t,t1:Math.min(Math.max(t+4,t+.5),Math.max(D(),t+.5)),x:(W-w)/2,y:(H-w*H/W)/2,w,ease:.6};e.zooms.push(z);select('zoom',z);redraw();changed();toast('Zoom added. Drag a box on the picture to choose where it zooms.',5000)},
    vfxall(){const v=selVfx();if(!v)return;snap();v.t0=0;v.t1=D();vfxui();redraw();changed()},
    vfxhere(){const v=selVfx();if(!v)return;snap();v.t0=Math.min(eng.t,v.t1-.1);vfxui();redraw();changed()},
    vfxend(){const v=selVfx();if(!v)return;snap();v.t1=Math.max(eng.t,v.t0+.1);vfxui();redraw();changed()},
    vfxdup(){const v=selVfx();if(!v)return;snap();const d=clone(v);d.id=newId(e,'f');e.vfx.push(d);select('vfx',d);redraw();changed()},
    vfxdel(){const v=selVfx();if(!v)return;snap();e.vfx=e.vfx.filter(x=>x!==v);select(null);redraw();changed()},
    lkreset(){snap();e.look=null;redraw();changed();lookui(true)},lkcam(){R('camfile').click()},
    zdel(){const z=selZoom();if(!z)return;snap();e.zooms=e.zooms.filter(x=>x!==z);select(null);redraw();changed()},
    reset(){const s0=e.srcs.find(s=>s.self),dur=s0&&rt.src[s0.id]&&rt.src[s0.id].dur;if(!(dur>0)){toast('The original recording could not be read, so Reset is not available.');return}snap();e.clips=[{id:newId(e,'c'),src:s0.id,a:0,b:dur,start:0,speed:1,vol:1,mute:false,crop:{l:0,t:0,r:0,b:0},trans:{type:'none'},afi:0,afo:0}];e.aud=[];e.caps=[];e.ovs=[];e.zooms=[];e.vfx=[];e.master=defFx();e.muteVideo=false;e.fadeIn=e.fadeOut=false;sel=null;eng.sync();eng.refreshFx();inT=0;outT=D();eng.t=0;redraw();refreshAll();changed()},
    addvid(){addVideosDialog()},addaud(){R('audfile').click()},rec(){toggleRec()},
    fxreset(){snap();const c=fxTarget();if(c)c.fx=defFx();else e.master=defFx();eng.refreshFx();showFx();changed()},
    trlen(){const c=selClip();if(!c||sel.type!=='clip'){toast('Click a video clip first.');return}snap();if(setOverlap(c,+R('trlen').value||1)){redraw();refreshProps();changed()}else hist.pop()},
    trall(){const c=selClip();if(!c||sel.type!=='clip'){toast('Click a video clip first.');return}snap();const type=c.trans.type,len=+R('trlen').value||1;const list=vclips(e);for(let i=1;i<list.length;i++){list[i].trans={type};if(type!=='none')setOverlap(list[i],len)}redraw();refreshProps();changed()},
    ostart(){const o=selOv();if(o){snap();o.t0=Math.min(eng.t,o.t1-.1);ovui();changed()}},oend(){const o=selOv();if(o){snap();o.t1=Math.max(eng.t,o.t0+.1);ovui();changed()}},
    odup(){const o=selOv();if(!o)return;snap();const c=clone(o),used=new Set(e.ovs.map(x=>x.id));let nid=HK.newShape?HK.newShape(c.t,0,0).id:0;if(nid==null||used.has(nid))nid=Math.max(0,...e.ovs.map(x=>+x.id||0))+1;c.id=nid;HK.moveShape(c,30,30);e.ovs.push(c);select('ov',c);changed()},
    odel(){const o=selOv();if(!o)return;snap();e.ovs=e.ovs.filter(z=>z!==o);select(null);changed()},
    addcap(){snap();const t=eng.t,nc={t0:t,t1:t+3,text:'New caption',pos:'b',fs:6,c:'#ffffff',bg:true};e.caps.push(nc);select('cap',nc);caplist();changed();{const rows=qa('.vcaps .vrow'),inp=rows[e.caps.indexOf(nc)]&&rows[e.caps.indexOf(nc)].querySelector('input[type=text]');if(inp){inp.focus();inp.select();inp.scrollIntoView({block:'nearest'})}}},
    apply(){run('video')},gif(){run('gif')},stop(){if(exp)exp.cancel=true}};
  // 10.1.7: Undo/Redo keep the selection (found again by id) and the In–Out range
  const SEL_LIST={clip:'clips',aud:'aud',cap:'caps',zoom:'zooms',vfx:'vfx',ov:'ovs'};
  function restore(h){const st=sel?.type,key=st&&SEL_LIST[st],sid=sel&&(sel.ref.id!=null?sel.ref.id:null),sidx=key?e[key].indexOf(sel.ref):-1,i0=inT,o0=outT,atEnd=Math.abs(outT-D())<.02;
    for(const k of Object.keys(e))delete e[k];Object.assign(e,JSON.parse(h));fillDefaults(e);
    let ref=null;if(key){const l=e[key];ref=sid!=null?l.find(x=>x.id===sid):l[sidx]}sel=ref?{type:st,ref}:null;
    eng.sync();eng.refreshFx();sizePrev();outT=atEnd?D():Math.min(o0,D());inT=Math.min(i0,Math.max(0,outT-.1));refreshAll();changed()}
  function doDelete(keepGap){if(!sel){toast('Click something on the timeline first.');return}snap();const r=sel.ref,ty=sel.type;
    if(ty==='clip'){const s0=r.start,end=clipEnd(r);e.clips=e.clips.filter(c=>c!==r);if(!keepGap){const nx=e.clips.filter(c=>c.start>s0+1e-6).map(c=>c.start),shift=Math.max(0,Math.min(end,...nx)-s0);
      if(shift>0){for(const c of [...e.clips,...e.aud])if(c.start>s0+1e-6)c.start=Math.max(s0,c.start-shift);for(const c of [...e.caps,...e.ovs,...e.zooms,...e.vfx])if(c.t0>s0+1e-6){const n0=Math.max(s0,c.t0-shift);c.t1=Math.max(n0+.1,c.t1-shift);c.t0=n0}}}
      }
    else if(ty==='aud')e.aud=e.aud.filter(c=>c!==r);else if(ty==='cap')e.caps=e.caps.filter(c=>c!==r);else if(ty==='zoom')e.zooms=e.zooms.filter(c=>c!==r);else if(ty==='vfx')e.vfx=e.vfx.filter(c=>c!==r);else e.ovs=e.ovs.filter(c=>c!==r);
    sel=null;eng.sync();eng.t=Math.min(eng.t,D());refreshAll();redraw();changed()}
  const vclips=ee=>ee.clips.slice().sort((a,b)=>a.start-b.start);
  function prevOf(c){const l=vclips(e).filter(x=>x!==c&&x.start<c.start);return l[l.length-1]||null}
  function setOverlap(c,len){const p=prevOf(c);if(!p){toast('This is the first clip, so there is nothing to change from.');return false}
    len=clamp(len,.1,Math.max(.1,Math.min(clipLen(p),clipLen(c))));const s0=c.start,delta=(clipEnd(p)-len)-s0;for(const x of [...e.clips,...e.aud])if(x===c||x.start>=s0-1e-6)x.start=Math.max(0,x.start+delta);
    for(const x of [...e.caps,...e.ovs,...e.zooms,...e.vfx])if(x.t0>=s0-1e-6){x.t0=Math.max(0,x.t0+delta);x.t1=Math.max(x.t0+.1,x.t1+delta)}return true}
  const keepHead=()=>requestAnimationFrame(()=>{const w=tl.parentElement;w.scrollLeft=Math.max(0,xOf(eng.t)-w.clientWidth/2)});
  host.addEventListener('click',ev=>{const b=ev.target.closest('[data-a]');if(!b||!ready)return;const a=b.dataset.a;if(crop&&!/^(crop|tog|zin|zout)/.test(a))cropStop(true);const f=act[a];if(f)f()});

  // ----- playback -----
  function curRange(){if(sel){if(sel.type==='clip'||sel.type==='aud')return[sel.ref.start,clipEnd(sel.ref),sel.type==='aud'?'audio':'clip'];if(sel.type==='cap')return[sel.ref.t0,sel.ref.t1,'caption'];return[sel.ref.t0,sel.ref.t1,'item']}if(inT>.05||outT<D()-.05)return[inT,outT,'In–Out'];return null}
  // 10.1.7: Play and Space play on from the playhead; Play selection (Shift+Space) plays only the selected item or In–Out
  async function togglePlay(){if(eng.playing){eng.pause();playRange=null;return}playRange=null;eng.unlock();await eng.play()}
  async function playSel(){if(eng.playing){eng.pause();playRange=null;return}const r=curRange();if(!r){toast('Select a clip or set In and Out first.');return}playRange={a:r[0],b:r[1]};eng.t=r[0];eng.unlock();await eng.play()}
  async function playAll(){eng.pause();playRange=null;eng.t=0;await eng.play()}
  let lkSeekT=0;const lkFollow=()=>{if(tab==='look'&&!eng.playing){clearTimeout(lkSeekT);lkSeekT=setTimeout(()=>lookui(),350)}};
  function onTick(t){if(playRange&&t>=playRange.b-.02){if(R('loop').checked){const a=playRange.a;eng.pause();eng.seek(a).then(()=>eng.play())}else{eng.pause();eng.t=playRange.b;eng.render();playRange=null}}}

  // ----- panels -----
  qa('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;qa('[data-tab]').forEach(x=>x.setAttribute('aria-pressed',x===b));qa('[data-sec]').forEach(s=>s.hidden=s.dataset.sec!==tab);{const hn=R('hint');if(hn)hn.hidden=!['clip','trans','zoom'].includes(tab)}if(tab==='audio')showFx();refreshProps();ovui();if(tab==='look')lookui()});
  const setTab=k=>{const b=q(`[data-tab="${k}"]`);if(b)b.click()};
  function refreshProps(){const c=selClip(),isV=sel&&sel.type==='clip';
    // 10.1.7: with nothing selected, the Clip tab edits the video clip under the playhead
    const ec=c||playClip(),eV=isV||(!c&&!!ec);lastPlayClip=c?null:ec;
    R('clipnote').textContent=ec?(srcName(ec.src)+(eV?' — video clip':' — audio clip')+(c?'':' (at the playhead)')):'Click a clip on the timeline to edit it here.';
    const row=R('cprops');row.style.opacity=ec?1:.45;row.style.pointerEvents=ec?'':'none';
    {const c=ec,isV=eV;if(c){qa('[data-c]').forEach(i=>{const k=i.dataset.c;if(k==='vol')i.value=Math.round((c.vol==null?1:c.vol)*100);else if(i.type==='checkbox')i.checked=!!c[k];else if(k==='speed')i.value=String(c.speed||1);else i.value=(+c[k]||0).toFixed(k==='afi'||k==='afo'?1:2)});
      qa('[data-cr]').forEach(i=>{i.value=(c.crop&&c.crop[i.dataset.cr])||0;i.disabled=!isV})}
    // 8.07: with no clip selected, show empty boxes rather than the last clip's numbers (and not "0.25×").
    else qa('[data-c],[data-cr]').forEach(i=>{if(i.type!=='checkbox'&&i.type!=='range')i.value=''})}
    // transitions
    const hasPrev=isV&&prevOf(c);R('trnote').textContent=isV?(hasPrev?'Transition into: '+srcName(c.src):'This is the first clip, so it has no transition into it. Click a later clip.'):'Click a video clip (not the first one), then choose how the picture changes into it. Slide a clip over the one before it to set how long the change takes.';
    qa('[data-tr]').forEach(b=>{b.setAttribute('aria-pressed',!!(isV&&c.trans&&c.trans.type===b.dataset.tr));b.disabled=!hasPrev});
    if(hasPrev){const p=prevOf(c);R('trlen').value=Math.max(.1,clipEnd(p)-c.start).toFixed(1)}
    zui();vfxui();if(e)showFx()}
  let lastPlayClip=null;
  function playClip(){if(!e||!eng)return null;const at=e.clips.filter(c=>eng.t>=c.start&&eng.t<clipEnd(c)).sort((a,b)=>a.start-b.start);return at[at.length-1]||(e.clips.length===1?e.clips[0]:null)}
  const editClip=()=>selClip()||playClip(),editIsV=()=>sel?sel.type==='clip':!!playClip();
  const vfxLabel=v=>{const d=VFX_BY[v.kind]||['','Effect',0,0,0,''];return d[1]+(v.kind==='bw'||v.kind==='invert'?(+v.amt===100?'':' '+Math.round(v.amt)+'%'):' '+(v.amt>0&&d[2]<0?'+':'')+Math.round(v.amt)+d[5])+(v.off?' (off)':'')};
  function addVfx(kind){if(!e.clips.length){toast('Add a video clip first.');return}const d=VFX_BY[kind];snap();const t=Math.min(eng.t,Math.max(0,D()-.5)),v={id:newId(e,'f'),kind,amt:d[4],t0:t,t1:Math.min(D(),t+5),fi:0,fo:0};if(v.t1-v.t0<.5)v.t1=v.t0+.5;e.vfx.push(v);select('vfx',v);redraw();changed();toast(d[1]+' added. Drag its ends on the timeline, or click Whole video.',4500)}
  function vfxui(){if(!e)return;const v=selVfx(),box=R('vfxsel');box.hidden=!v;
    if(v){const d=VFX_BY[v.kind],a=R('vfxamt');R('vfxlbl').textContent=d[1];a.min=d[2];a.max=d[3];a.value=v.amt;R('vfxval').textContent=Math.round(v.amt)+d[5];R('vfxf').value=v.t0.toFixed(1);R('vfxt').value=v.t1.toFixed(1);R('vfxfi').value=(+v.fi||0).toFixed(1);R('vfxfo').value=(+v.fo||0).toFixed(1);R('vfxoff').checked=!!v.off}
    const L2=R('vfxlist');L2.innerHTML=e.vfx.length?'<span class="vh">Effects in this video</span>':'';e.vfx.slice().sort((a,b)=>a.t0-b.t0).forEach(x=>{const r=document.createElement('div');r.className='vrow'+(x===v?' vsel':'')+(x.off?' voff':'');r.innerHTML=`${vfxIcon(x.kind,1)}<b>${esc(vfxLabel(x))}</b><span class="sp"></span><span class="vh">${fmt(x.t0)} – ${fmt(x.t1)}</span>`;r.onclick=()=>{select('vfx',x);eng.pause();eng.seek(x.t0+.01)};L2.appendChild(r)})}
  qa('[data-vfx]').forEach(b=>b.onclick=()=>addVfx(b.dataset.vfx));
  {const a=R('vfxamt');a.addEventListener('pointerdown',()=>{if(selVfx())snapOnce()});a.addEventListener('focus',()=>{if(selVfx())snapOnce()});a.addEventListener('input',()=>{const v=selVfx();if(!v)return;v.amt=+a.value;R('vfxval').textContent=Math.round(v.amt)+VFX_BY[v.kind][5];redraw()});a.addEventListener('change',()=>{vfxui();changed()})}
  R('vfxf').onchange=()=>{const v=selVfx();if(!v)return;snap();v.t0=clamp(+R('vfxf').value||0,0,v.t1-.1);vfxui();redraw();changed()};
  R('vfxt').onchange=()=>{const v=selVfx();if(!v)return;snap();v.t1=Math.max(v.t0+.1,+R('vfxt').value||0);vfxui();redraw();changed()};
  R('vfxfi').onchange=()=>{const v=selVfx();if(!v)return;snap();v.fi=clamp(+R('vfxfi').value||0,0,10);vfxui();redraw();changed()};
  R('vfxfo').onchange=()=>{const v=selVfx();if(!v)return;snap();v.fo=clamp(+R('vfxfo').value||0,0,10);vfxui();redraw();changed()};
  R('vfxoff').onchange=()=>{const v=selVfx();if(!v)return;snap();v.off=R('vfxoff').checked;vfxui();redraw();changed()};
  let lkTab='looks',lkTimer=0;
  const lkSet=(patch,quiet)=>{snap();e.look=Object.assign(lookOf(e),patch);redraw();changed();lookui(true)};
  const lkSame=(a,b)=>Object.keys(b).every(k=>a[k]===b[k]);
  function lkThumb(patch){const W0=176,H0=Math.round(W0*e.H/e.W),c=document.createElement('canvas');c.width=W0;c.height=H0;const keep=e.look;e.look=Object.assign(lookOf(e),patch);try{eng.drawFrame(c.getContext('2d'),eng.t,W0,H0)}catch(_){}e.look=keep;return c}
  function lookui(soon){if(!e||!eng)return;if(tab!=='look')return;clearTimeout(lkTimer);lkTimer=setTimeout(lookBuild,soon?30:0)}
  function lookBuild(){const L=lookOf(e),cam=eng.hasCam(),grid=R('lkgrid');R('lknote').textContent=cam?'Pick a look, or set the layout and background separately. The previews use the frame at the playhead.':'This video has no separate webcam track, so layouts show the screen only. Recordings made with the webcam in Saveit 9.7 or later have one, or use Choose webcam video.';
    qa('[data-lk]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.lk===lkTab));grid.hidden=lkTab==='style';R('lkstyle').hidden=lkTab!=='style';grid.innerHTML='';
    const card=(label,patch,on,thumbPatch)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-pressed',!!on);b.title=label;b.append(lkThumb(thumbPatch||patch));const s=document.createElement('span');s.textContent=label;b.append(s);b.onclick=()=>lkSet(patch);grid.append(b)};
    if(lkTab==='looks')LOOKS.forEach(([n,p])=>card(n,p,lkSame(L,p)));
    else if(lkTab==='layout')LAYOUTS.forEach(([k,n])=>{if(!cam&&['pip','inset','side-r','side-l','split','cam-big','cam-only'].includes(k))return;card(n,{layout:k},L.layout===k)});
    else if(lkTab==='bg'){const covered=lookRects(L,e.W,e.H,cam).full,tp=k=>covered?{bg:k,layout:'screen'}:null;
      if(covered){R('lknote').textContent='The background shows around a smaller screen. Your current layout fills the whole frame, so it is hidden. Pick “Show background” to use Screen on background.';card('Show background',{layout:'screen'},false)}
      BGS.forEach(([k,n])=>card(n,{bg:k},L.bg===k,tp(k)));card('Custom colour',{bg:'custom'},L.bg==='custom',tp('custom'))}
    qa('[data-lkpos]').forEach(b=>b.setAttribute('aria-pressed',L.pos===b.dataset.lkpos));qa('[data-lkshape]').forEach(b=>b.setAttribute('aria-pressed',L.shape===b.dataset.lkshape));
    R('lksize').value=L.camSize;R('lkround').checked=!!L.round;R('lkshadow').checked=!!L.shadow;R('lkborder').checked=!!L.border;R('lkcolor').value=L.color||'#20262c'}
  qa('[data-lk]').forEach(b=>b.onclick=()=>{lkTab=b.dataset.lk;lookBuild()});
  qa('[data-lkpos]').forEach(b=>b.onclick=()=>lkSet({pos:b.dataset.lkpos}));qa('[data-lkshape]').forEach(b=>b.onclick=()=>lkSet({shape:b.dataset.lkshape}));
  {const sz=R('lksize');sz.addEventListener('pointerdown',snapOnce);sz.addEventListener('input',()=>{e.look=Object.assign(lookOf(e),{camSize:+sz.value});redraw()});sz.addEventListener('change',()=>{changed();lookui(true)})}
  for(const k of ['round','shadow','border'])R('lk'+k).onchange=()=>lkSet({[k]:R('lk'+k).checked});
  R('lkcolor').addEventListener('pointerdown',snapOnce);R('lkcolor').oninput=()=>{e.look=Object.assign(lookOf(e),{bg:'custom',color:R('lkcolor').value});redraw()};R('lkcolor').onchange=()=>{changed();lookui(true)};
  R('camfile').onchange=async()=>{const f=R('camfile').files[0];R('camfile').value='';if(!f)return;try{const url=URL.createObjectURL(f),meta=await loadMeta(url);snap();const id=newId(e,'s');e.srcs=e.srcs.filter(s=>!(e.cam&&s.id===e.cam.src));e.srcs.push({id,kind:'cam',name:f.name});it._edBlobs[id]=f;rt.src[id]={url,blob:f,dur:meta.dur,w:meta.w,h:meta.h};e.cam={src:id,off:0,o:{mirror:false}};if(!e.look||lookOf(e).layout==='full')e.look=Object.assign(lookOf(e),{layout:'pip'});eng.sync();redraw();changed();lookui(true);toast('Webcam video added. It starts with your recording; pick a layout to place it.',5000)}catch(err){hist.pop();toast(err.message)}};
  function zui(){const z=selZoom();R('zrow').hidden=!z;if(z){R('zpct').value=Math.round(e.W/z.w*100);R('zease').value=(+z.ease||0).toFixed(1);R('zf').value=z.t0.toFixed(1);R('zt').value=z.t1.toFixed(1)}if(eng){const ed=zedit()&&!eng.playing;if(eng.S.noZoom!==ed){eng.S.noZoom=ed;redraw()}}}
  const zfit=z=>{const W=e.W,H=e.H;z.w=clamp(z.w,W/8,W);const h=z.w*H/W;z.x=clamp(z.x,0,W-z.w);z.y=clamp(z.y,0,H-h)};
  R('zpct').onchange=()=>{const z=selZoom();if(!z)return;snap();const cx=z.x+z.w/2,cy=z.y+z.w*e.H/e.W/2;z.w=e.W/clamp((+R('zpct').value||200)/100,1.1,8);z.x=cx-z.w/2;z.y=cy-z.w*e.H/e.W/2;zfit(z);zui();redraw();changed()};
  R('zease').onchange=()=>{const z=selZoom();if(!z)return;snap();z.ease=clamp(+R('zease').value||0,0,3);zui();changed()};
  R('zf').onchange=()=>{const z=selZoom();if(!z)return;snap();z.t0=clamp(+R('zf').value||0,0,z.t1-.2);zui();redraw();changed()};
  R('zt').onchange=()=>{const z=selZoom();if(!z)return;snap();z.t1=Math.max(z.t0+.2,+R('zt').value||0);zui();redraw();changed()};
  qa('[data-c]').forEach(i=>i.addEventListener('change',()=>{const c=editClip();if(!c)return;if(i.dataset.c==='vol')snapOnce();else snap();const k=i.dataset.c,v=i.type==='checkbox'?i.checked:+i.value;const sd=(rt.src[c.src]&&rt.src[c.src].dur)||c.b;
    if(k==='vol')c.vol=clamp(v/100,0,3);else if(k==='mute')c.mute=v;else if(k==='speed'){const oe=clipEnd(c);c.speed=clamp(v||1,.25,4);const d=clipEnd(c)-oe;if(Math.abs(d)>1e-6){for(const x of [...e.clips,...e.aud])if(x!==c&&x.start>c.start+1e-6)x.start=Math.max(0,x.start+d);for(const x of [...e.caps,...e.ovs,...e.zooms,...e.vfx])if(x.t0>=oe-1e-6){x.t0+=d;x.t1+=d}}}else if(k==='start')c.start=Math.max(0,v);else if(k==='a')c.a=clamp(v,0,c.b-MIN);else if(k==='b')c.b=clamp(v,c.a+MIN,sd);else c[k]=Math.max(0,v);
    redraw();refreshProps();changed()}));
  qa('[data-c="vol"]').forEach(i=>{i.addEventListener('pointerdown',snapOnce);i.addEventListener('focus',snapOnce)});qa('[data-c="vol"]').forEach(i=>i.addEventListener('input',()=>{const c=editClip();if(c){c.vol=clamp(+i.value/100,0,3)}}));
  qa('[data-cr]').forEach(i=>i.addEventListener('change',()=>{const c=editClip();if(!c||!editIsV())return;snap();c.crop[i.dataset.cr]=clamp(+i.value||0,0,90);if(c.crop.l+c.crop.r>90)c.crop.r=90-c.crop.l;if(c.crop.t+c.crop.b>90)c.crop.b=90-c.crop.t;redraw();refreshProps();changed()}));
  qa('[data-tr]').forEach(b=>b.onclick=()=>{const c=selClip();if(!c||sel.type!=='clip')return;snap();c.trans={type:b.dataset.tr};const p=prevOf(c);if(p&&b.dataset.tr!=='none'&&clipEnd(p)-c.start<.1)setOverlap(c,Math.min(1,Math.min(clipLen(p),clipLen(c))/2));redraw();refreshProps();changed()});
  // 10.1.7: on-screen items and zoom boxes are in project pixels, so a new Size scales them and fits them into the new frame, the same way the video is fitted
  function refit(W0,H0){const W=e.W,H=e.H;if(W===W0&&H===H0)return;const k=Math.min(W/W0,H/H0),dx=(W-W0*k)/2,dy=(H-H0*k)/2,X=v=>v*k+dx,Y=v=>v*k+dy;
    for(const s of e.ovs){for(const [a,b] of [['x1','y1'],['x2','y2'],['tx','ty'],['cx','cy']])if(s[a]!=null){s[a]=X(s[a]);s[b]=Y(s[b])}if(Array.isArray(s.pts))s.pts.forEach(p=>{p[0]=X(p[0]);p[1]=Y(p[1])});for(const f of ['w','fs'])if(+s[f])s[f]=Math.max(1,s[f]*k);s._w=null}
    for(const z of e.zooms){const cx=X(z.x+z.w/2),cy=Y(z.y+z.w*H0/W0/2);z.w=z.w*k;z.x=cx-z.w/2;z.y=cy-z.w*H/W/2;zfit(z)}}
  R('canvas').onchange=()=>{snap();const v=R('canvas').value,W0=e.W,H0=e.H;if(v==='auto'){const f=vclips(e)[0],s=f&&rt.src[f.src];if(s&&s.w){e.W=s.w;e.H=s.h}}else{const [w,h]=v.split('x').map(Number);e.W=w;e.H=h}refit(W0,H0);sizePrev();changed()};
  R('ofps').onchange=()=>{snap();e.fps=+R('ofps').value||null;changed()};
  R('fi').onchange=()=>{snap();e.fadeIn=R('fi').checked;redraw();changed()};R('fo').onchange=()=>{snap();e.fadeOut=R('fo').checked;redraw();changed()};
  R('muteall').onchange=()=>{snap();e.muteVideo=R('muteall').checked;changed()};
  // audio fx
  const fxTarget=()=>R('atarget').value==='sel'&&selClip()?selClip():null;
  const fxObj=create=>{const c=fxTarget();if(c){if(!c.fx&&create)c.fx=defFx();return c.fx||defFx()}return e.master};
  function showFx(){const f=Object.assign(defFx(),fxObj(false));qa('[data-eq]').forEach(i=>{const v=+f.eq[+i.dataset.eq]||0;i.value=v;R('eqv'+i.dataset.eq).textContent=v>0?'+'+v:v});
    qa('[data-fx]').forEach(i=>{const k=i.dataset.fx;i.value=k==='gain'?Math.round(f.gain*100):k==='echoT'?Math.round(f.echoT*100):f[k]});
    R('eqpre').value=Object.keys(EQ_PRESETS).find(k=>EQ_PRESETS[k].join()===f.eq.join())||'Flat'}
  R('atarget').onchange=showFx;
  // 8.07: a click fires pointerdown and focus; save one undo step, not two.
  qa('[data-eq]').forEach(i=>{i.addEventListener('pointerdown',snapOnce);i.addEventListener('focus',snapOnce);i.addEventListener('input',()=>{const f=fxObj(true);f.eq[+i.dataset.eq]=+i.value;R('eqv'+i.dataset.eq).textContent=+i.value>0?'+'+i.value:i.value;eng.refreshFx()});i.addEventListener('change',changed)});
  qa('[data-fx]').forEach(i=>{i.addEventListener('pointerdown',snapOnce);i.addEventListener('focus',snapOnce);i.addEventListener('input',()=>{const f=fxObj(true),k=i.dataset.fx,v=+i.value;f[k]=k==='gain'||k==='echoT'?v/100:v;eng.refreshFx()});i.addEventListener('change',changed)});
  R('eqpre').onchange=()=>{snap();const f=fxObj(true);f.eq=[...EQ_PRESETS[R('eqpre').value]];eng.refreshFx();showFx();changed()};
  R('audfile').onchange=async()=>{const f=R('audfile').files[0];R('audfile').value='';if(!f)return;try{snap();const c=await addAudioSrc(f,f.name.replace(/\.[^.]+$/,''),eng.t);select('aud',c);toast('Added. Drag it on the timeline, or use the Audio tab to change the volume and sound.');changed()}catch(err){hist.pop();toast(err.message)}};
  async function addAudioSrc(blob,name,start){const url=URL.createObjectURL(blob),meta=await loadMeta(url,true),id=newId(e,'s');e.srcs.push({id,name,kind:'audio'});it._edBlobs[id]=blob;rt.src[id]={url,blob,dur:meta.dur};
    const c={id:newId(e,'a'),src:id,a:0,b:meta.dur,start:Math.max(0,start||0),speed:1,vol:1,afi:0,afo:0};e.aud.push(c);computePeaks(blob).then(p=>{if(p)rt.src[id].peaks=p});return c}
  async function addVideoSrc(item){const id=newId(e,'s'),meta=await loadMeta(item.url);e.srcs.push({id,name:item.name,itemId:item.itemId||null,kind:'video'});if(!item.itemId&&item.blob)it._edBlobs[id]=item.blob;rt.src[id]={url:item.url,blob:item.blob,dur:meta.dur,w:meta.w,h:meta.h};
    const c={id:newId(e,'c'),src:id,a:0,b:meta.dur,start:total(e),speed:1,vol:1,mute:false,crop:{l:0,t:0,r:0,b:0},trans:{type:'none'},afi:0,afo:0};e.clips.push(c);if(item.blob)computePeaks(item.blob).then(p=>{if(p)rt.src[id].peaks=p});return c}
  function updateRecBtn(){const b=q('[data-a="rec"]');b.textContent=rec?'■ Stop recording':'● Record voice-over';b.classList.toggle('pri',!!rec)}
  async function toggleRec(){if(rec){rec.mr.stop();return}let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}})}catch(_){toast('No microphone found, or microphone access is off. Check Windows Settings > Privacy & security > Microphone.',6000);return}
    const mr=new MediaRecorder(stream),ch=[],t0=eng.t;rec={mr,stream};mr.ondataavailable=ev=>ev.data.size&&ch.push(ev.data);
    mr.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());if(dead){rec=null;return}eng.pause();rec=null;updateRecBtn();const blob=new Blob(ch,{type:mr.mimeType||'audio/webm'});if(blob.size>800){try{snap();const c=await addAudioSrc(blob,'Voice-over',t0);select('aud',c);changed();toast('Voice-over added on the audio track.')}catch(err){toast(err.message)}}};
    mr.start();updateRecBtn();playRange=null;eng.unlock();eng.play()}
  function addVideosDialog(){const lib=api.videos?api.videos():[],rows=[];
    const m=document.createElement('div');m.className='modal vjoin';m.style.zIndex=90;document.body.appendChild(m);
    const draw=()=>{const free=lib.filter(x=>!rows.some(r=>r.id&&r.id===x.id));
      m.innerHTML=`<div class="box" style="width:min(520px,100%)"><h2>Add videos to the timeline</h2><p class="vnote">Each video becomes its own clip at the end of the timeline. You can then trim it, drag it around, and overlap it with the next one.</p>
      ${rows.map((r,i)=>`<div class="jr"><b>${i+1}. ${esc(r.name||'Video')}</b><button class="btn" data-up="${i}">↑</button><button class="btn" data-dn="${i}">↓</button><button class="btn" data-rm="${i}">✕</button></div>`).join('')}
      <div class="vh" style="margin:10px 0 4px">From your library</div>${free.length?free.map(x=>`<div class="jr"><b>${esc(x.name||'Video')}</b><button class="btn" data-add="${lib.indexOf(x)}">Add</button></div>`).join(''):'<p class="vnote">No other videos in your library yet.</p>'}
      <div class="vrow" style="justify-content:space-between;margin-top:12px"><button class="btn" data-file>Add a video file…</button><span><button class="btn" data-x>Cancel</button> <button class="btn pri" data-go ${rows.length?'':'disabled'}>Add ${rows.length||''} to timeline</button></span></div><input type="file" accept="video/*" multiple hidden></div>`;
      const fi=m.querySelector('input[type=file]');fi.onchange=()=>{for(const f of fi.files)rows.push({name:f.name.replace(/\.[^.]+$/,''),url:URL.createObjectURL(f),blob:f});draw()}};
    m.onclick=async ev=>{const t=ev.target;if(t===m||t.closest('[data-x]')){m.remove();return}const g=a=>{const b=t.closest('['+a+']');return b?+b.getAttribute(a):null};let i;
      if(t.closest('[data-go]')){m.remove();snap();try{let last=null;for(const r of rows){const o=r.id&&api.itemById&&api.itemById(r.id);if(o&&o._lazy&&api.hydrate)await api.hydrate(o);if(o){r.url=o.url;r.blob=o.blob}last=await addVideoSrc({name:r.name,url:r.url,blob:r.blob,itemId:r.id||null})}eng.sync();refreshAll();redraw();if(last)select('clip',last);changed();toast('Added. Drag the circles to trim each clip, and drag a clip over its neighbour to overlap them.',5000)}catch(err){toast(err.message)}return}
      if(t.closest('[data-file]')){m.querySelector('input[type=file]').click();return}
      if((i=g('data-add'))!==null){const x=lib[i];rows.push({name:x.name,url:x.url,blob:x.blob,id:x.id});draw()}else if((i=g('data-rm'))!==null){rows.splice(i,1);draw()}
      else if((i=g('data-up'))!==null&&i>0){[rows[i-1],rows[i]]=[rows[i],rows[i-1]];draw()}else if((i=g('data-dn'))!==null&&i<rows.length-1){[rows[i+1],rows[i]]=[rows[i],rows[i+1]];draw()}};
    draw()}
  // ----- captions -----
  function caplist(){const box=R('caps');box.innerHTML='';e.caps.forEach((c,i)=>{const r=document.createElement('div');r.className='vrow';
    r.innerHTML=`<input type="text" placeholder="Caption text" aria-label="Caption text"><label>from <input type="number" step="0.1" min="0" aria-label="Caption from (seconds)"></label><label>to <input type="number" step="0.1" min="0" aria-label="Caption to (seconds)"></label><select aria-label="Caption position"><option value="b">Bottom</option><option value="c">Middle</option><option value="t">Top</option></select><label>size <input type="number" min="2" max="20" step="0.5"></label><input type="color" aria-label="Caption colour"><label><input type="checkbox"> box</label><button class="btn" title="Delete this caption" aria-label="Delete this caption">✕</button>`;
    const ins=r.querySelectorAll('input,select'),[iT,iF,iTo,sP,iS,iC,iB]=ins;iT.value=c.text;iF.value=c.t0.toFixed(1);iTo.value=c.t1.toFixed(1);sP.value=c.pos||'b';iS.value=c.fs||6;iC.value=c.c||'#ffffff';iB.checked=c.bg!==false;
    const chg=()=>{snap();c.text=iT.value;c.t0=Math.max(0,+iF.value||0);c.t1=Math.max(c.t0+.1,+iTo.value||0);c.pos=sP.value;c.fs=+iS.value||6;c.c=iC.value;c.bg=iB.checked;redraw();changed()};
    const chg0=chg;ins.forEach(x=>x.addEventListener('change',()=>{if(x===iT){c.text=iT.value;redraw();changed();return}chg0()}));iT.addEventListener('focus',snapOnce);iT.addEventListener('input',()=>{c.text=iT.value;redraw()});
    r.querySelector('button').onclick=()=>{snap();e.caps.splice(i,1);if(selCap()===c)sel=null;caplist();redraw();changed()};r.addEventListener('focusin',()=>{if(selCap()!==c){sel={type:'cap',ref:c};qa('.vcaps .vrow').forEach((x,j)=>x.classList.toggle('vsel',e.caps[j]===c))}});r.classList.toggle('vsel',c===selCap());box.appendChild(r)})}
  // ----- crop (8.04) -----
  // Start crop shows the clip's whole frame with a box over it; dragging the box or its handles sets the
  // clip's L/T/R/B crop %, which the number boxes follow. Stop crop keeps it, Cancel goes back.
  const r1=v=>Math.round(v*10)/10;
  function cropGeom(c){const el=eng.elFor(c);if(!el||!el.videoWidth)return null;const vw=el.videoWidth,vh=el.videoHeight,k=Math.min(e.W/vw,e.H/vh),fw=vw*k,fh=vh*k,fx=(e.W-fw)/2,fy=(e.H-fh)/2,cr=c.crop;
    return{fx,fy,fw,fh,x0:fx+fw*cr.l/100,x1:fx+fw*(1-cr.r/100),y0:fy+fh*cr.t/100,y1:fy+fh*(1-cr.b/100)}}
  const cropHandles=G=>{const mx=(G.x0+G.x1)/2,my=(G.y0+G.y1)/2;return[['nw',G.x0,G.y0],['n',mx,G.y0],['ne',G.x1,G.y0],['e',G.x1,my],['se',G.x1,G.y1],['s',mx,G.y1],['sw',G.x0,G.y1],['w',G.x0,my]]};
  const CROP_CUR={nw:'nwse-resize',se:'nwse-resize',ne:'nesw-resize',sw:'nesw-resize',n:'ns-resize',s:'ns-resize',e:'ew-resize',w:'ew-resize',move:'move'};
  function cropHit(G,x,y,k){for(const [h,hx,hy] of cropHandles(G))if(Math.abs(x-hx)<=10*k&&Math.abs(y-hy)<=10*k)return h;if(x>G.x0&&x<G.x1&&y>G.y0&&y<G.y1)return'move';return null}
  function cropUi(){const on=!!crop;q('[data-a="cropstart"]').hidden=on;q('[data-a="cropstop"]').hidden=!on;q('[data-a="cropcancel"]').hidden=!on;R('cropnote').hidden=!on;ovui();redraw()}
  function cropInputs(){const c=crop&&crop.c;if(c)qa('[data-cr]').forEach(i=>{i.value=c.crop[i.dataset.cr]||0})}
  function cropStart(){if(crop)return;let c=sel&&sel.type==='clip'?sel.ref:null;
    if(!c){const at=e.clips.filter(x=>eng.t>=x.start&&eng.t<clipEnd(x));c=at[at.length-1]||e.clips[0]}
    if(!c){toast('Add a video clip first.');return}
    eng.pause();otool=null;select('clip',c);if(eng.t<c.start||eng.t>=clipEnd(c))eng.seek(c.start+.01);
    snap();c.crop=Object.assign({l:0,t:0,r:0,b:0},c.crop);crop={c,c0:clone(c.crop),drag:null};eng.S.cropEdit=c;
    if(pane!=='video')showPane('video');setTab('clip');HK.paneChanged&&HK.paneChanged();cropUi();R('croprow').scrollIntoView({block:'nearest'})}
  function cropStop(keep){if(!crop)return;const {c,c0}=crop,same=JSON.stringify(c.crop)===JSON.stringify(c0);if(!keep)Object.assign(c.crop,c0);if(!keep||same)hist.pop();
    crop=null;eng.S.cropEdit=null;cropUi();refreshProps();if(keep&&!same){changed();toast('Crop kept.')}}
  function cropReset(){const c=crop?crop.c:(sel&&sel.type==='clip'?sel.ref:null);if(!c){toast('Click a video clip on the timeline first.');return}
    if(!crop)snap();c.crop={l:0,t:0,r:0,b:0};if(crop)cropInputs();else{refreshProps();changed()}redraw()}
  function cropDown(ev){const G=cropGeom(crop.c);if(!G)return;ev.preventDefault();const p=ovPt(ev),h=cropHit(G,p.x,p.y,p.k);if(!h)return;ov.setPointerCapture(ev.pointerId);crop.drag={h,x:p.x,y:p.y,cr:clone(crop.c.crop),G}}
  function cropMove(ev){const p=ovPt(ev);if(!crop.drag){const G=cropGeom(crop.c),h=G&&cropHit(G,p.x,p.y,p.k);ov.style.cursor=h?CROP_CUR[h]:'default';return}
    const {h,cr,G}=crop.drag,dx=(p.x-crop.drag.x)/G.fw*100,dy=(p.y-crop.drag.y)/G.fh*100,c=crop.c.crop;
    if(h==='move'){const mx=clamp(dx,-cr.l,cr.r),my=clamp(dy,-cr.t,cr.b);c.l=r1(cr.l+mx);c.r=r1(cr.r-mx);c.t=r1(cr.t+my);c.b=r1(cr.b-my)}
    else{if(h.includes('w'))c.l=r1(clamp(cr.l+dx,0,90-cr.r));if(h.includes('e'))c.r=r1(clamp(cr.r-dx,0,90-cr.l));if(h.includes('n'))c.t=r1(clamp(cr.t+dy,0,90-cr.b));if(h.includes('s'))c.b=r1(clamp(cr.b-dy,0,90-cr.t))}
    cropInputs()}
  function cropDraw(g){const G=cropGeom(crop.c);if(!G)return;const k=ov.width/Math.max(1,ov.getBoundingClientRect().width);g.save();g.fillStyle='rgba(0,0,0,.55)';
    g.fillRect(0,0,e.W,G.y0);g.fillRect(0,G.y1,e.W,e.H-G.y1);g.fillRect(0,G.y0,G.x0,G.y1-G.y0);g.fillRect(G.x1,G.y0,e.W-G.x1,G.y1-G.y0);
    g.strokeStyle='#fff';g.lineWidth=1.5*k;g.strokeRect(G.x0,G.y0,G.x1-G.x0,G.y1-G.y0);g.globalAlpha=.35;g.lineWidth=1*k;g.beginPath();
    for(let i=1;i<3;i++){const x=G.x0+(G.x1-G.x0)*i/3,y=G.y0+(G.y1-G.y0)*i/3;g.moveTo(x,G.y0);g.lineTo(x,G.y1);g.moveTo(G.x0,y);g.lineTo(G.x1,y)}g.stroke();g.globalAlpha=1;
    const hs=5*k;for(const [,hx,hy] of cropHandles(G)){g.fillStyle='#fff';g.fillRect(hx-hs,hy-hs,hs*2,hs*2);g.strokeStyle='#5aa2ff';g.strokeRect(hx-hs,hy-hs,hs*2,hs*2)}g.restore()}
  // ----- on-screen items -----
  const ovPt=ev=>{const r=ov.getBoundingClientRect();return{x:(ev.clientX-r.left)/r.width*ov.width,y:(ev.clientY-r.top)/r.height*ov.height,k:ov.width/Math.max(1,r.width)}};
  const activeOvs=()=>e.ovs.filter(s=>eng.t>=s.t0&&eng.t<=s.t1);
  function zoomDraw(g,z){const W=e.W,H=e.H,h=z.w*H/W,k=ov.width/Math.max(1,ov.getBoundingClientRect().width);g.save();g.fillStyle='rgba(0,0,0,.5)';g.beginPath();g.rect(0,0,W,H);g.rect(z.x,z.y,z.w,h);g.fill('evenodd');
    g.strokeStyle='#4cc16b';g.lineWidth=2.5*k;g.strokeRect(z.x,z.y,z.w,h);const hs=6*k;for(const [hx,hy] of [[z.x,z.y],[z.x+z.w,z.y],[z.x,z.y+h],[z.x+z.w,z.y+h]]){g.fillStyle='#fff';g.fillRect(hx-hs,hy-hs,hs*2,hs*2);g.strokeRect(hx-hs,hy-hs,hs*2,hs*2)}
    g.fillStyle='#4cc16b';g.font=`700 ${14*k}px sans-serif`;g.fillText('Zoom '+Math.round(W/z.w*100)+'%',z.x+6*k,z.y+18*k);g.restore()}
  function ovDraw(){const g=ov.getContext('2d');g.clearRect(0,0,ov.width,ov.height);if(crop){cropDraw(g);return}if(zedit()&&!eng.playing){zoomDraw(g,selZoom());return}if(!HK.drawShape)return;
    if(odrag&&odrag.mode==='draw')HK.drawShape(g,odrag.s,{width:ov.width,height:ov.height});
    const o=selOv();if(o&&otool&&eng.t>=o.t0&&eng.t<=o.t1){const k=ov.width/Math.max(1,ov.getBoundingClientRect().width),line=o.t==='arrow'||o.t==='line',b=line||!HK.selBox?HK.bbox(o):HK.selBox(o),pd=line?4*k:0;g.save();g.strokeStyle='#5aa2ff';g.lineWidth=1.5*k;g.setLineDash([5*k,4*k]);g.strokeRect(b.x-pd,b.y-pd,b.w+pd*2,b.h+pd*2);g.setLineDash([]);const hs=4.5*k;for(const [,hx,hy] of HK.handles(o)){g.fillStyle='#fff';g.fillRect(hx-hs,hy-hs,hs*2,hs*2);g.strokeRect(hx-hs,hy-hs,hs*2,hs*2)}g.restore()}}
  function ovui(){qa('[data-ot]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.ot===otool));ov.style.pointerEvents=otool||crop||zedit()?'auto':'none';ov.style.cursor=crop||zedit()?'default':otool==='select'?'default':'crosshair';if(eng)zui();
    const o=selOv(),row=R('osel');row.hidden=!o;if(o){R('olbl').textContent=ovName(o);R('of').value=o.t0.toFixed(1);R('ot2').value=o.t1.toFixed(1)}}
  const hitOv=(x,y,k)=>{const tol=10*k;for(const s of activeOvs().reverse()){const b=HK.bbox(s);if(x>=b.x-tol&&x<=b.x+b.w+tol&&y>=b.y-tol&&y<=b.y+b.h+tol)return s}return null};
  const hitHandle=(s,x,y,k)=>{for(const [h,hx,hy] of HK.handles(s))if(Math.abs(x-hx)<9*k&&Math.abs(y-hy)<9*k)return h;return null};
  ov.addEventListener('pointerdown',ev=>{if(crop&&ready){cropDown(ev);return}
    if(zedit()&&ready){ev.preventDefault();eng.pause();ov.setPointerCapture(ev.pointerId);const z=selZoom(),p=ovPt(ev),h=z.w*e.H/e.W,tol=12*p.k;snap();
      const cn=[[z.x,z.y,z.x+z.w,z.y+h],[z.x+z.w,z.y,z.x,z.y+h],[z.x,z.y+h,z.x+z.w,z.y],[z.x+z.w,z.y+h,z.x,z.y]].find(([cx,cy])=>Math.abs(p.x-cx)<=tol&&Math.abs(p.y-cy)<=tol);
      if(cn)zdrag={mode:'size',ax:cn[2],ay:cn[3]};else if(p.x>z.x&&p.x<z.x+z.w&&p.y>z.y&&p.y<z.y+h)zdrag={mode:'move',lx:p.x,ly:p.y};else zdrag={mode:'size',ax:p.x,ay:p.y};zdrag.moved=false;return}if(!otool||!ready)return;ev.preventDefault();ov.setPointerCapture(ev.pointerId);const {x,y,k}=ovPt(ev),t=eng.t;eng.pause();
    const cur=selOv();if(cur&&t>=cur.t0&&t<=cur.t1){const h=hitHandle(cur,x,y,k);if(h){snap();odrag={mode:'handle',k:h,b0:HK.selBox?HK.selBox(cur):HK.norm(cur),s0:JSON.parse(JSON.stringify(cur))};return}}
    const hs=hitOv(x,y,k);
    if(otool==='select'||(hs&&hs===cur)){if(hs)select('ov',hs);else select(null);if(hs){snap();odrag={mode:'move',lx:x,ly:y}}return}
    snap();const s=HK.newShape(otool,x,y);s.t0=t;s.t1=t+3;const sc=Math.max(1,e.H/720);s.w=Math.round((+R('owid').value||6)*sc);s.fs=Math.round((s.fs||24)*sc*1.3);if(otool!=='highlight')s.c=R('ocol').value;
    if(otool==='step'||otool==='stamp'){if(otool==='step')s.n=e.ovs.filter(z=>z.t==='step').length+1;e.ovs.push(s);select('ov',s);return}
    if(otool==='text'){HK.askText('Text on the video','','Add').then(txt=>{if(txt){s.txt=txt;s._w=null;s.x2=s.x1+10;s.y2=s.y1+10;e.ovs.push(s);select('ov',s);changed()}else hist.pop()});return}
    select(null);odrag={mode:'draw',s}});
  ov.addEventListener('pointermove',ev=>{if(crop){cropMove(ev);return}
    if(zedit()){const z=selZoom(),p=ovPt(ev);if(!zdrag){const h=z.w*e.H/e.W,tol=12*p.k,onC=[[z.x,z.y],[z.x+z.w,z.y],[z.x,z.y+h],[z.x+z.w,z.y+h]].some(([cx,cy])=>Math.abs(p.x-cx)<=tol&&Math.abs(p.y-cy)<=tol);ov.style.cursor=onC?'nwse-resize':p.x>z.x&&p.x<z.x+z.w&&p.y>z.y&&p.y<z.y+h?'move':'crosshair';return}
      zdrag.moved=true;if(zdrag.mode==='move'){z.x+=p.x-zdrag.lx;z.y+=p.y-zdrag.ly;zdrag.lx=p.x;zdrag.ly=p.y}else{const W=e.W,H=e.H,w=clamp(Math.max(Math.abs(p.x-zdrag.ax),Math.abs(p.y-zdrag.ay)*W/H),W/8,W),h=w*H/W;z.w=w;z.x=p.x<zdrag.ax?zdrag.ax-w:zdrag.ax;z.y=p.y<zdrag.ay?zdrag.ay-h:zdrag.ay}zfit(z);zui();return}if(!odrag){if(otool){const c=selOv(),p=ovPt(ev),h=c&&eng.t>=c.t0&&eng.t<=c.t1?hitHandle(c,p.x,p.y,p.k):null;ov.style.cursor=h?((HK.handleCursor||{})[h]||'grab'):(otool==='select'?'default':'crosshair')}return}const {x,y}=ovPt(ev),o=selOv();
    if(odrag.mode==='draw'){odrag.s.x2=x;odrag.s.y2=y}else if(odrag.mode==='move'&&o){HK.moveShape(o,x-odrag.lx,y-odrag.ly);odrag.lx=x;odrag.ly=y;eng.render()}
    else if(odrag.mode==='handle'&&o){const k=odrag.k;if(k==='p1'){o.x1=x;o.y1=y}else if(k==='p2'){o.x2=x;o.y2=y}else if(k==='c'){o.cx=x;o.cy=y}else if(k==='tail'){o.tx=x;o.ty=y}else if(HK.resizeByHandle)HK.resizeByHandle(o,odrag,x,y,ev.shiftKey);o._w=null;eng.render()}});
  ov.addEventListener('pointerup',()=>{if(crop){crop.drag=null;return}if(zdrag){const m=zdrag.moved;zdrag=null;if(m){changed();refreshProps()}else hist.pop();return}if(!odrag)return;const d=odrag;odrag=null;if(d.mode==='draw'){const s=d.s;if(Math.abs(s.x2-s.x1)<4&&Math.abs(s.y2-s.y1)<4){hist.pop();return}e.ovs.push(s);select('ov',s)}changed();eng.render()});
  qa('[data-ot]').forEach(b=>b.onclick=()=>{otool=otool===b.dataset.ot?null:b.dataset.ot;if(!otool&&sel&&sel.type==='ov')select(null);ovui()});
  R('ocol').addEventListener('pointerdown',()=>{if(selOv())snapOnce()});R('ocol').oninput=()=>{HK.setStyle&&HK.setStyle('stroke',R('ocol').value);const o=selOv();if(o){o.c=R('ocol').value;eng.render()}};
  R('owid').onchange=()=>{const w=Math.max(1,+R('owid').value||6);HK.setStyle&&HK.setStyle('width',w);const o=selOv();if(o){snap();o.w=w*Math.max(1,e.H/720);o._w=null;eng.render()}};
  R('of').onchange=()=>{const o=selOv();if(o){snap();o.t0=clamp(+R('of').value||0,0,o.t1-.1);changed()}};R('ot2').onchange=()=>{const o=selOv();if(o){snap();o.t1=Math.max(o.t0+.1,+R('ot2').value||0);changed()}};
  R('in').onchange=()=>{inT=clamp(+R('in').value||0,0,outT-.1)};R('out').onchange=()=>{outT=clamp(+R('out').value||0,inT+.1,D())};
  host.addEventListener('keydown',x=>{if(x.target.matches('input,select,textarea'))x.stopPropagation()});
  // ----- export -----
  async function run(kind){if(exp||!ready)return;exp={cancel:false};eng.pause();const bar=R('prog'),fill=bar.firstElementChild,stopB=q('[data-a="stop"]');bar.hidden=false;stopB.hidden=false;fill.style.width='0';const prog=p=>{fill.style.width=Math.round(p*100)+'%'};
    try{
      if(kind==='video'){const sz=R('osize').value;let cw=e.W,ch=e.H;if(sz!=='project'){ch=+sz;cw=Math.round(ch*e.W/e.H)}cw&=~1;ch&=~1;toast('Saving edited video… every frame is drawn, so nothing is dropped.',6000);
        const o=await eng.exportRun(cw,ch,prog,exp,{fmt:'mp4'});if(!o)return;const n=api.addVideo(o.mp4||o.webm,(it.name||'Video')+' (edited)',it.thumb);n.webm=o.webm||null;n.mp4=o.mp4||null;api.persist(n);toast('Saved as a new video in your library.')}
      else{const fps=clamp(+R('fps').value||10,1,30),w=Math.max(2,Math.min(e.W,Math.max(64,+R('gw').value||480)))&~1,h=Math.round(w*e.H/e.W)&~1,T=D();let n=Math.max(1,Math.floor(T*fps)),times=Array.from({length:n},(_,i)=>i/fps),capped=false;if(n>900){times=Array.from({length:900},(_,i)=>i*T/900);capped=true}
        const gw=new GifWriter(w,h,true);toast('Making GIF…',3000);const ok=await eng.renderTimes(times,w,h,(g,i)=>{gw.addFrame(g.getImageData(0,0,w,h).data,Math.round(100/(capped?900/T:fps)));prog((i+1)/times.length)},exp);
        if(!ok)return;await api.saveBlob(gw.finish(),api.baseName(it)+'.gif');if(capped)toast('That was long, so frames were thinned to keep the GIF a sensible size.',5000)}
    }catch(err){toast('Export failed: '+(err.message||err),6000)}
    finally{exp=null;bar.hidden=true;stopB.hidden=true;try{eng.seek(0)}catch(_){}}}
  // ----- keys -----
  // which buttons were reached with the keyboard (Chrome's :focus-visible turns on for any focused button once a key is pressed, so it can't tell)
  let lastInput='key';const kbdFocused=new WeakSet(),onPtr=()=>{lastInput='mouse'},onKey=()=>{lastInput='key'},onFocus=ev=>{if(ev.target&&ev.target.matches&&ev.target.matches('button,summary,[role=button],a')){if(lastInput==='key')kbdFocused.add(ev.target);else kbdFocused.delete(ev.target)}};
  document.addEventListener('pointerdown',onPtr,true);document.addEventListener('keydown',onKey,true);host.addEventListener('focusin',onFocus);
  const key=ev=>{if(dead||!ready||!host.isConnected||!host.offsetParent||document.querySelector('.modal'))return;if(ev.target.matches&&ev.target.matches('input,select,textarea,[contenteditable],[contenteditable] *'))return;const k=ev.key.toLowerCase();
    // 10.1.8: Space or Enter on a button reached with the keyboard presses that button (after a mouse click, Space still plays)
    if((k===' '||k==='enter')&&kbdFocused.has(ev.target))return;if(crop&&(k==='enter'||k==='escape')){cropStop(k==='enter');ev.preventDefault();ev.stopPropagation();return}
    if((ev.ctrlKey||ev.metaKey)&&!ev.altKey&&k==='v'){ev.preventDefault();ev.stopPropagation();api.pasteMedia?.(ev.shiftKey?'insert':'stack');return}
    if((ev.ctrlKey||ev.metaKey)&&!ev.altKey&&(k==='z'||k==='y')){ev.preventDefault();if(k==='y'||ev.shiftKey)act.redo();else act.undo()}
    else if(ev.ctrlKey||ev.metaKey||ev.altKey)return;
    else if(k==='home'){ev.preventDefault();eng.pause();eng.seek(0)}else if(k==='end'){ev.preventDefault();eng.pause();eng.seek(D())}
    else if(k==='delete'||k==='backspace'){if(sel){ev.preventDefault();doDelete(ev.shiftKey)}else return}
    else if(k==='escape'){select(null);playRange=null}else if(k===' '){ev.preventDefault();if(ev.shiftKey)playSel();else togglePlay()}else if(k==='i')act.setin();else if(k==='o')act.setout();else if(k==='s'&&!ev.ctrlKey&&!ev.metaKey)act.split();
    else if(k==='arrowleft'){ev.preventDefault();eng.pause();eng.seek(eng.t-(ev.shiftKey?1:.1))}else if(k==='arrowright'){ev.preventDefault();eng.pause();eng.seek(eng.t+(ev.shiftKey?1:.1))}else return;ev.stopPropagation()};
  document.addEventListener('keydown',key,true);
  function refreshAll(){refreshProps();caplist();ovui();offlineUi();R('canvas').value=['1920x1080','1280x720','854x480','1080x1080','1080x1920'].includes(e.W+'x'+e.H)?e.W+'x'+e.H:'auto';R('fi').checked=!!e.fadeIn;R('fo').checked=!!e.fadeOut;R('muteall').checked=!!e.muteVideo;R('ofps').value=e.fps?String(e.fps):'';showFx()}
  // 9.8: true when the timeline is anything other than the untouched recording, so Save renders the edit.
  function isEdited(){const s0=rt.src.s0||{},dur=s0.dur||0,nz=v=>!!v&&v!=='none';if(e.clips.length!==1||e.aud.length||e.vfx.length||e.zooms.length||e.ovs.length||e.caps.some(c=>c.text)||e.fadeIn||e.fadeOut||e.muteVideo)return true;
    if(s0.w&&s0.h&&(e.W!==s0.w||e.H!==s0.h))return true;if(e.fps)return true; // 10.1.7: a new Size alone needs rendering
    const c=e.clips[0],src=e.srcs.find(s=>s.id===c.src);if(!src||!src.self||c.a>.05||(dur&&Math.abs(c.b-dur)>.05)||c.start>.01||(c.speed||1)!==1||(c.vol==null?1:c.vol)!==1||c.mute||c.afi||c.afo||(c.trans&&nz(c.trans.type)))return true;
    if(c.crop&&(c.crop.l||c.crop.t||c.crop.r||c.crop.b))return true;if(c.fx&&JSON.stringify(Object.assign(defFx(),c.fx))!==JSON.stringify(defFx()))return true;
    if(JSON.stringify(Object.assign(defFx(),e.master||{}))!==JSON.stringify(defFx()))return true;
    const known=new Set(['id','src','a','b','start','speed','vol','mute','crop','trans','afi','afo','fx','name','peaks','lane','color']);for(const [k,v] of Object.entries(c))if(!known.has(k)&&v&&!(typeof v==='object'&&!Object.keys(v).length))return true;
    return false}
  let lkLastT=-1;function ui(){if(!ready){return}if(!sel&&!crop&&playClip()!==lastPlayClip&&!host.contains(document.activeElement&&document.activeElement.matches('input,select')?document.activeElement:null))refreshProps();if(eng.t!==lkLastT&&!eng.playing){lkLastT=eng.t;lkFollow()}if(crop&&eng.playing)cropStop(true);const r=curRange();{const tt=`${fmt(eng.t)} / ${fmt(D())}`,te=R('time');if(te.textContent!==tt)te.textContent=tt}{const pb=q('[data-a="play"]'),sb=q('[data-a="playsel"]'),pt=eng.playing&&!playRange?'Pause':'Play',st=eng.playing&&playRange?'Pause':r?'Play '+r[2]:'Play selection';if(pb.textContent!==pt)pb.textContent=pt;if(sb.textContent!==st)sb.textContent=st;sb.disabled=!r&&!(eng.playing&&playRange)}
    // 10.1.8: redraw the timeline and overlay only while playing or when something may have changed (plus twice a second as a safety net)
    const now=performance.now(),sig=[eng.t,D(),zoom,tl.clientWidth,sel&&sel.type,inT,outT,hist.length,fut.length,otool,tab,pane].join('|');
    if(eng.playing||vDirty||sig!==lastSig||sel?.ref!==lastSelRef||now-lastDraw>500){vDirty=false;lastSig=sig;lastSelRef=sel?.ref;lastDraw=now;drawTl();ovDraw()}}
  let vDirty=true,lastSig='',lastSelRef=null,lastDraw=0;const dirty=()=>{vDirty=true};
  for(const t of ['pointerdown','pointermove','pointerup','input','change','click','wheel','keydown'])host.addEventListener(t,dirty,true);document.addEventListener('keydown',dirty,true);
  function tick(){if(dead)return;ui();raf=requestAnimationFrame(tick)}
  // ----- offline media (10.1.7) -----
  function offlineSrcs(){const ids=new Set((e.offline||[]).map(o=>o.c.src));return e.srcs.filter(s=>ids.has(s.id))}
  function offlineSync(){e.offline=e.offline||[];const back=e.offline.filter(o=>rt.src[o.c.src]);e.offline=e.offline.filter(o=>!rt.src[o.c.src]);for(const o of back)(o.kind==='aud'?e.aud:e.clips).push(o.c);
    for(const key of ['clips','aud']){const keep=[];for(const c of e[key])if(rt.src[c.src])keep.push(c);else e.offline.push({kind:key,c});e[key]=keep}offlineUi()}
  function offlineUi(){const row=R('offrow');if(!row||!e)return;const list=offlineSrcs();row.hidden=!list.length;row.innerHTML=list.length?'<span class="vh">Offline media</span>'+list.map(s=>{const n=e.offline.filter(o=>o.c.src===s.id).length;return`<span class="vnote">${esc(s.name||'Clip')} (${n} clip${n>1?'s':''})</span><button class="btn" data-relink="${esc(s.id)}" title="Find the file for this media, so its clips come back">Relink…</button>`}).join(''):''}
  async function relink(id,f){const s=e.srcs.find(x=>x.id===id);if(!s||!f)return;try{const url=URL.createObjectURL(f),meta=await loadMeta(url,s.kind==='audio');if(dead)return;it._edBlobs[id]=f;rt.src[id]={url,blob:f,dur:meta.dur,w:meta.w,h:meta.h};pasteUrls.add(url);delete s.itemId;
    offlineSync();eng.sync();computePeaks(f).then(p=>{if(p&&rt.src[id])rt.src[id].peaks=p});refreshAll();redraw();changed();toast('Relinked. The clips for '+(s.name||'this media')+' are back on the timeline.')}catch(err){toast(err.message)}}
  {let rid=null;const fi=R('relinkfile');R('offrow').addEventListener('click',ev=>{const b=ev.target.closest('[data-relink]');if(!b||!ready)return;rid=b.dataset.relink;const s=e.srcs.find(x=>x.id===rid);fi.accept=s&&s.kind==='audio'?'audio/*,video/*':'video/*';fi.click()});
    fi.onchange=()=>{const f=fi.files[0];fi.value='';if(f&&rid)relink(rid,f)}}
  // ----- start up -----
  (async()=>{try{
    rt.src.s0={url:it.url,blob:it.blob};const meta=await loadMeta(it.url);if(dead)return;Object.assign(rt.src.s0,{dur:meta.dur,w:meta.w,h:meta.h});
    e=ensureProject(it,meta);for(const k of Object.keys(it._edBlobs))if(!e.srcs.some(s=>s.id===k))delete it._edBlobs[k];
    for(const s of e.srcs){let url=null,blob=null;
      if(s.self){url=it.url;blob=it.blob;rt.src[s.id]=Object.assign(rt.src[s.id]||{},{url,blob,dur:meta.dur,w:meta.w,h:meta.h})}
      else{if(s.itemId){const o=api.itemById&&api.itemById(s.itemId);if(o&&o._lazy&&api.hydrate){try{await api.hydrate(o)}catch(_){}}if(dead)return;if(o&&o.url){url=o.url;blob=o.blob}}if(!url&&it._edBlobs[s.id]){blob=it._edBlobs[s.id];url=URL.createObjectURL(blob)}
        if(url){try{const m2=await loadMeta(url,s.kind==='audio');rt.src[s.id]={url,blob,dur:m2.dur,w:m2.w,h:m2.h}}catch(_){}}}}
    if(dead)return;
    // 10.1.7: clips whose media is missing are kept in e.offline (saved with the project) instead of being deleted, and come back on Relink
    offlineSync();{const gone=offlineSrcs().map(s=>s.name||'a clip');if(gone.length)toast('Some media could not be found: '+gone.join(', ')+'. Its clips are kept offline. Use Relink in the Clip tab to find the file.',9000)}
    if(!e.clips.length){const s0=e.srcs.find(s=>s.self);e.clips.push({id:newId(e,'c'),src:s0.id,a:0,b:meta.dur,start:0,speed:1,vol:1,mute:false,crop:{l:0,t:0,r:0,b:0},trans:{type:'none'},afi:0,afo:0})}
    if(dead)return;eng=makeEngine({e,rt});eng.onTick(onTick);eng.onEnd(()=>{playRange=null;if(rec)rec.mr.stop()});sizePrev();inT=0;outT=D();ready=true;refreshAll();
    for(const s of e.srcs){const r=rt.src[s.id];if(r&&r.blob&&!r.peaks)computePeaks(r.blob).then(p=>{if(p)r.peaks=p})}
    if(dead){eng.destroy();return}await eng.seek(0);
  }catch(err){if(!dead)toast(err.message||String(err))}})();
  raf=requestAnimationFrame(tick);
  // 8.0: the side panel shows one view at a time (video, effects or drawing tools); the editor's toolbar buttons pick it.
  const showPane=k=>{if(crop&&k!=='video')cropStop(true);pane=k;qa('[data-pane]').forEach(p=>p.hidden=p.dataset.pane!==k);if(k==='effects'&&e)refreshProps()};
  return{insertClip,get time(){return eng?.t||0},pause:()=>eng?.pause(),seek:t=>eng?.seek(t),undo:()=>act.undo(),redo:()=>act.redo(),info:q('.vinfo'),video:prev,pane:k=>{if(k)showPane(k);return pane},tool:t=>{if(t!==undefined){if(crop)cropStop(true);otool=t;if(!otool&&sel&&sel.type==='ov')select(null);ovui()}return otool},destroy(){dead=true;fitObs.disconnect();cancelAnimationFrame(raf);document.removeEventListener('keydown',key,true);document.removeEventListener('pointerdown',onPtr,true);document.removeEventListener('keydown',onKey,true);document.removeEventListener('keydown',dirty,true);if(exp)exp.cancel=true;try{rec&&rec.mr.stop()}catch(_){}if(eng)eng.destroy();pasteUrls.forEach(url=>URL.revokeObjectURL(url))},saveGif:()=>run('gif'),needsRender:()=>!!(e&&eng&&(eng.hasCam()||(e.look&&(lookOf(e).layout!=='full'||lookOf(e).bg!=='black'))||isEdited())),isEdited:()=>!!(e&&eng&&isEdited()),duration:()=>D(),
    get exporting(){return !!exp}, // 10.2.0: lets the update check see that a video export is running
    renderBlob:async(fmt='mp4')=>{if(exp)throw new Error('An export is already running.');exp={cancel:false};eng.pause();const bar=R('prog'),fill=bar.firstElementChild,stopB=q('[data-a="stop"]');bar.hidden=false;stopB.hidden=false;fill.style.width='0';
      try{return await eng.exportRun((e.W&~1)||2,(e.H&~1)||2,p=>{fill.style.width=Math.round(p*100)+'%'},exp,{fmt})}finally{exp=null;bar.hidden=true;stopB.hidden=true;try{await eng.seek(0)}catch(_){}}},grab:()=>eng?eng.snapshot(e.W,e.H):null,getProject:()=>e,
    // 10.1.7: read-only view of editor state for the automated tests
    _dbg:{get sel(){return sel},select,get inT(){return inT},get outT(){return outT},get eng(){return eng},act,get hist(){return hist.length},get rt(){return rt},get ready(){return ready}}}}
// Copy edited Library videos as they currently look/sound, without opening them in the destination editor.
async function copyClip(item,api,onProgress){const source=item.mp4||item.webm||item.blob;if(!item.edit)return source;const previousHK=HK,copyHK={...HK,...api};HK=copyHK;const urls=[],urlFor=blob=>{const u=URL.createObjectURL(blob);urls.push(u);return u};let engine=null;
  try{const url=urlFor(item.blob),meta=await loadMeta(url),temp={...item,edit:clone(item.edit)},e=ensureProject(temp,meta),rt={src:{}};
    const used=new Set([...e.clips,...e.aud].map(c=>c.src));
    for(const s of e.srcs){if(!s.self&&!used.has(s.id))continue;let blob=s.self?item.blob:item._edBlobs?.[s.id];if(!blob&&s.itemId){const other=api.itemById(s.itemId);if(other){await api.hydrate(other);blob=other.blob}}if(!blob)throw Error('A source clip for this edited video could not be found.');const u=s.self?url:urlFor(blob),m=await loadMeta(u,s.kind==='audio');rt.src[s.id]={url:u,blob,dur:m.dur,w:m.w,h:m.h}}
    engine=makeEngine({e,rt});const result=await engine.exportRun((e.W&~1)||2,(e.H&~1)||2,onProgress,{cancel:false},{fmt:'mp4'});return result.mp4||result.webm
  }finally{engine?.destroy();urls.forEach(u=>URL.revokeObjectURL(u));if(HK===copyHK)HK=previousHK}}
root.VEdit={mount,pack,copyClip,Core:{clipLen,clipEnd,total,ensureProject,makeEngine}};
})(window);
