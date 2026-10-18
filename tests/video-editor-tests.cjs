// Video editor checks for the bugs in VIDEO-EDITOR-REVIEW-10.1.6.md (B-numbers below match that review).
// node tests/video-editor-tests.cjs http://127.0.0.1:8944 <evidence-folder>
// Tests marked todo cover bugs planned for a later version: they are reported (TODO-FAIL / TODO-PASS)
// but do not fail the run. When a todo test passes, move it out of todo in the version that fixes it.
const {chromium}=require('playwright'),assert=require('assert/strict'),fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
// ffprobe measures the saved files when it is available (set FFPROBE to its path)
const FFPROBE=[process.env.FFPROBE,'C:/Users/stuar/AppData/Local/Programs/TasiaCraft/tools/ffprobe.exe'].find(p=>p&&fs.existsSync(p));
const probe=file=>FFPROBE?JSON.parse(execFileSync(FFPROBE,['-v','error','-count_frames','-show_entries','stream=codec_type,codec_name,width,height,r_frame_rate,nb_read_frames,duration:format=duration','-of','json',file]).toString()):null;
(async()=>{
const out=path.resolve(process.argv[3]||'../video-editor-evidence');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),results=[],errors=[];page.on('pageerror',e=>errors.push(e.stack));page.setDefaultTimeout(15000);
const ev=(fn,arg)=>page.evaluate(fn,arg),near=(a,b,t=.02,m='')=>assert.ok(Math.abs(a-b)<=t,m+' '+a+' vs '+b);
// ONLY=<regex> runs just the matching checks
const test=async(name,fn,o={})=>{if(process.env.ONLY&&!new RegExp(process.env.ONLY).test(name))return;const tag=o.todo?'['+o.todo+'] ':'';try{const detail=await Promise.race([fn(),new Promise((_,j)=>setTimeout(()=>j(Error('timed out after 120 s')),120000))]);results.push({name,todo:o.todo||null,pass:true,detail});console.log(o.todo?'TODO-PASS':'PASS',tag+name,detail?JSON.stringify(detail):'')}
  catch(e){results.push({name,todo:o.todo||null,pass:false,error:e.stack});console.log(o.todo?'TODO-FAIL':'FAIL',tag+name,'-',e.message.split('\n')[0]);await page.screenshot({path:path.join(out,(o.todo?'todo-':'failure-')+results.length+'.png')})}};
try{
await page.goto(process.argv[2]||'http://127.0.0.1:8944');await page.waitForFunction(()=>window.__T?.addVideo&&window.QA);
// one recorded test clip, reused by every test (recording takes real time)
await ev(async()=>{const v=await QA.video(3);window.vblob=v.blob;window.vmp4=v.mp4});
// the same kind of clip as a WebM (VP9 + Opus), the way Saveit records
await ev(async()=>{const w=640,h=360,c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d'),st=c.captureStream(30),ac=new AudioContext(),o=ac.createOscillator(),d=ac.createMediaStreamDestination();o.connect(d);o.start();st.addTrack(d.stream.getAudioTracks()[0]);
  const mr=new MediaRecorder(st,{mimeType:'video/webm;codecs=vp9,opus'}),ch=[];mr.ondataavailable=e=>e.data.size&&ch.push(e.data);const t0=performance.now(),iv=setInterval(()=>{const t=(performance.now()-t0)/1000;g.fillStyle=`hsl(${t*60},60%,45%)`;g.fillRect(0,0,w,h);g.fillStyle='#fff';g.font='bold 60px Segoe UI';g.fillText(t.toFixed(1)+' s',40,120)},33);
  mr.start(250);await QA.sleep(3000);mr.stop();await new Promise(r=>mr.onstop=r);clearInterval(iv);o.stop();ac.close();window.vwebm=new Blob(ch,{type:'video/webm'})});
await ev(()=>{
  window.D=()=>__T.vid._ctl._dbg;window.P=()=>__T.vid._ctl.getProject();
  window.openV=async(setup,blob=vblob)=>{document.querySelectorAll('.modal').forEach(m=>m.remove());const it=__T.addVideo(blob,'VE test '+Date.now());if(blob.type.includes('mp4'))it.mp4=blob;else it.webm=blob;if(setup)setup(it);__T.openItem(it);
    await QA.until(()=>__T.vid?._ctl?._dbg?.ready&&__T.vid._ctl._dbg.eng);await QA.sleep(150);window.cur=it;return it};
  window.splitAt=async t=>{await D().eng.seek(t);D().act.split()};
  // keeps the page busy for ms of every frame, like a slow PC
  window.busy=ms=>{let on=true;const f=()=>{if(!on)return;const t=performance.now();while(performance.now()-t<ms);requestAnimationFrame(f)};requestAnimationFrame(f);return()=>{on=false}};
  window.change=(sel,val)=>{const el=document.querySelector(sel);if(el.type==='checkbox')el.checked=val;else el.value=val;el.dispatchEvent(new Event('change',{bubbles:true}))};
});

// ---------- 10.1.7 ----------
await test('B5 clips whose media is missing are kept (offline), not deleted on the next edit',async()=>{const r=await ev(async()=>{
  const it=await openV(it=>{it.edit={v:2,srcs:[{id:'s0',self:true,name:'Video',kind:'video'},{id:'s9',name:'Lost music',kind:'audio'}],clips:[{id:'c1',src:'s0',a:0,b:2.8,start:0,speed:1,vol:1}],aud:[{id:'a1',src:'s9',a:0,b:2,start:.5,speed:1,vol:1}],nextId:200,W:640,H:360};it._edBlobs={}});
  const before=P().aud.length;change('[data-r="fi"]',true);await QA.sleep(500);await __T.persistNow(it);const rec=await __T.dbRead(it.id);
  // playback must still work with the offline clip present
  await D().eng.seek(1);await D().eng.play();await QA.sleep(300);D().eng.pause();
  const count=e=>(e.aud||[]).length+(e.offline||[]).filter(o=>o.kind==='aud').length;
  return{live:count(P()),saved:count(rec.edit),toast:__toasts.slice(-3).join(' | ')}});
  assert.equal(r.live,1,'missing clip was dropped on open');assert.equal(r.saved,1,'missing clip was deleted from the saved project');return r});

await test('B5 Relink brings the offline clip back on the timeline',async()=>{const btn=page.locator('[data-relink]');assert.equal(await btn.count(),1,'no Relink button');
  const wav=await ev(async()=>[...new Uint8Array(await (await QA.toneWav([300,500],1)).arrayBuffer())]);
  const [fc]=await Promise.all([page.waitForEvent('filechooser'),btn.click()]);await fc.setFiles({name:'music.wav',mimeType:'audio/wav',buffer:Buffer.from(wav)});
  await page.waitForFunction(()=>P().aud.length===1);const r=await ev(()=>({aud:P().aud.length,offline:P().offline.length,start:P().aud[0].start,button:document.querySelectorAll('[data-relink]').length}));
  assert.equal(r.offline,0);near(r.start,.5,.01,'clip kept its place');assert.equal(r.button,0);return r});

await test('B6 changing Size moves and scales on-screen items and zoom boxes',async()=>{const r=await ev(async()=>{await openV();const e=P();if(e.W+'x'+e.H!=='640x360')throw Error('test video is '+e.W+'x'+e.H);
  const s=__T.newShape('arrow',100,100);Object.assign(s,{x2:300,y2:200,t0:0,t1:3,w:6});e.ovs.push(s);e.zooms.push({id:'z1',t0:0,t1:2,x:160,y:90,w:320,ease:.5});
  change('[data-r="canvas"]','1280x720');const a=P().ovs[0],z=P().zooms[0];const same={x1:a.x1,y1:a.y1,x2:a.x2,y2:a.y2,w:a.w,zx:z.x,zy:z.y,zw:z.w};
  change('[data-r="canvas"]','1080x1920');const b=P().ovs[0],z2=P().zooms[0];
  return{same,vert:{x1:b.x1,y1:b.y1,x2:b.x2,y2:b.y2,zx:z2.x,zy:z2.y,zw:z2.w,W:P().W,H:P().H}}});
  const s=r.same;near(s.x1,200,1,'x1');near(s.y1,200,1,'y1');near(s.x2,600,1,'x2');near(s.y2,400,1,'y2');near(s.w,12,.6,'width');near(s.zx,320,1,'zoom x');near(s.zw,640,1,'zoom w');
  const v=r.vert;for(const k of ['x1','x2','zx'])assert.ok(v[k]>=0&&v[k]<=v.W,k+' outside vertical frame');for(const k of ['y1','y2','zy'])assert.ok(v[k]>=0&&v[k]<=v.H,k+' outside vertical frame');return r});

await test('B19 Undo keeps the selected clip and the In/Out range',async()=>{const r=await ev(async()=>{await openV();await splitAt(1.5);await D().eng.seek(.5);D().act.setin();await D().eng.seek(2.5);D().act.setout();
  const c2=P().clips.find(c=>c.start>1);D().select('clip',c2);change('[data-r="fi"]',true);D().act.undo();
  return{sel:D().sel?.ref?.id,want:c2.id,inT:D().inT,outT:D().outT,fi:P().fadeIn}});
  assert.equal(r.fi,false,'undo did not undo');assert.equal(r.sel,r.want,'selection lost');near(r.inT,.5,.02,'In');near(r.outT,2.5,.02,'Out');return r});

await test('B21 duplicated on-screen items always get unique ids',async()=>{const r=await ev(async()=>{await openV();const e=P();const a=__T.newShape('rect',50,50),b=__T.newShape('rect',150,50);Object.assign(a,{id:5,x2:100,y2:100,t0:0,t1:3});Object.assign(b,{id:6,x2:200,y2:100,t0:0,t1:3});e.ovs.push(a,b);
  D().select('ov',b);D().act.odup();D().select('ov',a);D().act.odup();D().select('ov',a);D().act.odup();const ids=P().ovs.map(o=>o.id);return{ids,unique:new Set(ids).size===ids.length}});assert.ok(r.unique,'duplicate ids '+r.ids);return r});

await test('B10 Play and Space play on from the playhead even when a clip is selected',async()=>{const r=await ev(async()=>{await openV();await splitAt(1.5);const c1=P().clips.find(c=>c.start<1);D().select('clip',c1);await D().eng.seek(0);
  document.querySelector('[data-a="play"]').click();await QA.sleep(2300);const t=D().eng.t,playing=D().eng.playing;D().eng.pause();
  await D().eng.seek(0);D().select('clip',c1);document.body.focus();QA.key(' ');await QA.sleep(2300);const t2=D().eng.t;D().eng.pause();return{t,playing,t2,label:document.querySelector('[data-a="play"]').textContent}});
  assert.ok(r.t>1.8,'Play stopped at the end of the selected clip ('+r.t.toFixed(2)+')');assert.ok(r.t2>1.8,'Space stopped at the end of the selected clip ('+r.t2.toFixed(2)+')');return r});

await test('B10 Shift+Space plays only the selection',async()=>{const r=await ev(async()=>{await openV();await splitAt(1.5);const c1=P().clips.find(c=>c.start<1);D().select('clip',c1);await D().eng.seek(0);
  document.body.focus();QA.key(' ',{shiftKey:true});await QA.sleep(2300);const t=D().eng.t;D().eng.pause();return{t}});near(r.t,1.5,.12,'stop point');return r});

// second review (Saveit 10.1.4 video editor review, V/VU numbers)
await test('V2 changing only the Size makes Save render at that size',async()=>{const r=await ev(async()=>{await openV();const before=__T.vid._ctl.needsRender();change('[data-r="canvas"]','1280x720');return{before,after:__T.vid._ctl.needsRender()}});
  assert.equal(r.before,false,'untouched video should still be copied');assert.equal(r.after,true,'a new Size alone is not rendered');return r});

await test('V7 the Export tab quality does not change the top-bar Save size',async()=>{const r=await ev(async()=>{await openV();change('[data-r="osize"]','480');change('[data-r="fi"]',true);const o=await __T.vid._ctl.renderBlob(),b=o.webm||o.mp4,v=document.createElement('video');v.src=URL.createObjectURL(b);await new Promise(r=>v.onloadedmetadata=r);return{w:v.videoWidth,h:v.videoHeight,dur:await QA.duration(b),want:__T.vid._ctl.duration()}});
  assert.equal(r.w+'x'+r.h,'640x360');near(r.dur,r.want,.25,'edited save length');return r});

await test('V4 typed crop applies with no clip selected (single clip under the playhead)',async()=>{const r=await ev(async()=>{await openV();D().select(null);await D().eng.seek(1);await QA.sleep(200);
  const g=c=>{const x=c.getContext('2d').getImageData(10,180,1,1).data;return[...x].slice(0,3)},before=g(__T.vid._ctl.grab());
  const inp=document.querySelector('[data-cr="l"]');inp.value='25';inp.dispatchEvent(new Event('change',{bubbles:true}));await D().eng.seek(1);await QA.sleep(200);
  return{crop:P().clips[0].crop.l,edited:__T.vid._ctl.needsRender(),before,after:g(__T.vid._ctl.grab()),disabled:inp.disabled,pe:getComputedStyle(inp.closest('[data-r="cprops"]')).pointerEvents}});
  assert.equal(r.crop,25,'crop not stored');assert.ok(r.edited);assert.notEqual(r.pe,'none','clip boxes are not usable without a selection');return r});

await test('V5 I and O keys set In and Out after clicking the timeline',async()=>{await ev(()=>openV());const box=await page.locator('.vtl').boundingBox(),D0=await ev(()=>__T.vid._ctl.duration()),xOf=t=>box.x+11+t/D0*(box.width-22);
  await page.mouse.click(xOf(.8),box.y+box.height-6);await page.waitForTimeout(150);await page.keyboard.press('i');await page.mouse.click(xOf(2.2),box.y+box.height-6);await page.waitForTimeout(150);await page.keyboard.press('o');
  const r=await ev(()=>({inT:D().inT,outT:D().outT,t:D().eng.t,active:document.activeElement?.tagName+'.'+document.activeElement?.className}));near(r.inT,.8,.08,'In');near(r.outT,2.2,.08,'Out');return r});

await test('VU1 every editor button and tab has a tooltip',async()=>{const r=await ev(async()=>{await openV();return[...document.querySelectorAll('.vwrap button, .vside button, .vpanel button')].filter(b=>b.offsetParent!==null||b.closest('.vtabs')).filter(b=>!b.title&&!b.getAttribute('aria-label')).map(b=>b.textContent.trim())});
  assert.deepEqual(r,[],'no tooltip: '+r.join(', '));return r.length});

await test('VU3 every editor field has a clear accessible name',async()=>{const r=await ev(async()=>{await openV();const bad=[];for(const i of document.querySelectorAll('.vside input:not([type=file]):not([type=checkbox]), .vside select, .vpanel input:not([type=checkbox])')){if(i.closest('[hidden]')&&!i.closest('[data-sec]'))continue;const n=(i.getAttribute('aria-label')||(i.labels&&i.labels[0]?i.labels[0].textContent:'')||'').trim();if(n.length<3)bad.push((i.dataset.cr||i.dataset.c||i.dataset.r||i.dataset.fx||i.dataset.eq||i.type)+':"'+n+'"')}return bad});
  assert.deepEqual(r,[],'unclear names: '+r.join(', '));return r.length});

// ---------- 10.1.9: frame-by-frame saving (B1 / V1) ----------
const saveEdit=async(o)=>{const r=await ev(async o=>{await openV(null,o.src==='webm'?vwebm:vblob);if(o.cut){await D().eng.seek(1);D().act.setin();await D().eng.seek(2);D().act.setout();D().act.cut()}if(o.speed){const i=document.querySelector('[data-c="speed"]');D().select('clip',P().clips[0]);i.value=String(o.speed);i.dispatchEvent(new Event('change',{bubbles:true}))}
    const stop=busy(o.load||0),t0=performance.now();let res;try{res=await __T.vid._ctl.renderBlob(o.fmt)}finally{stop()}const b=res[o.fmt],secs=(performance.now()-t0)/1000,want=__T.vid._ctl.duration();
    // sound: decoded back, checked for gaps and pitch
    const ac=new OfflineAudioContext(1,48000,48000),buf=await ac.decodeAudioData(await b.arrayBuffer()),d=buf.getChannelData(0),sr=buf.sampleRate,win=Math.round(sr*.02);let gap=0,run=0;/* the last 0.2 s is skipped: MediaRecorder test recordings stop their sound a little before their picture */for(let i=Math.round(sr*.1);i<d.length-Math.round(sr*.2);i+=win){let m=0;for(let j=i;j<i+win&&j<d.length;j++)m=Math.max(m,Math.abs(d[j]));if(m<.01){run+=win/sr;gap=Math.max(gap,run)}else run=0}
    const tone=QA.toneAnalysis(buf,.2,Math.max(.4,buf.duration-.2));
    // the file plays and seeks
    const v=document.createElement('video');v.muted=true;v.src=URL.createObjectURL(b);await new Promise((r,j)=>{v.onloadedmetadata=r;v.onerror=()=>j(Error('saved file does not open'))});const sought=await new Promise(r=>{v.onseeked=()=>r(true);v.currentTime=want/2;setTimeout(()=>r(false),4000)});
    const bytes=[...new Uint8Array(await b.arrayBuffer())];return{want,stats:D().eng.S.lastExport,secs:+secs.toFixed(2),audioSecs:+buf.duration.toFixed(3),longestSilence:+gap.toFixed(3),hz:Math.round(tone.hz),playerDuration:v.duration,sought,size:b.size,bytes}},o);
  const file=path.join(out,'saved-'+(o.src||'mp4')+'-'+o.fmt+(o.load?'-load':'')+(o.speed?'-speed':'')+'.'+o.fmt);fs.writeFileSync(file,Buffer.from(r.bytes));delete r.bytes;r.file=file;r.ffprobe=probe(file);return r};
const checkSave=(r,fps=30)=>{assert.equal(r.stats.mode,'frames','used '+r.stats.mode+': '+r.stats.reason);const n=Math.round(r.want*fps);assert.equal(r.stats.frames,n);
  near(r.audioSecs,r.want,.08,'sound length');assert.ok(r.longestSilence<.03,'silence '+r.longestSilence+' s');assert.ok(r.sought,'saved file does not seek');near(r.playerDuration,r.want,.1,'player length');
  if(r.ffprobe){const v=r.ffprobe.streams.find(x=>x.codec_type==='video'),a=r.ffprobe.streams.find(x=>x.codec_type==='audio');assert.ok(a,'no audio stream');assert.equal(+v.nb_read_frames,n,'frames in file');near(+r.ffprobe.format.duration,r.want,.08,'file length')}};
for(const [src,fmt] of [['mp4','mp4'],['mp4','webm'],['webm','mp4'],['webm','webm']])
  await test('B1 an edited '+src.toUpperCase()+' saved as '+fmt.toUpperCase()+' keeps every frame and all of its sound',async()=>{const r=await saveEdit({src,fmt,cut:true});checkSave(r);near(r.hz,440,6,'pitch');return r});
await test('B1 saving under CPU load still keeps every frame and all of its sound',async()=>{const r=await saveEdit({src:'webm',fmt:'mp4',cut:true,load:25});checkSave(r);return r});
await test('B1 a 2× clip saves at half length with the sound at its own pitch',async()=>{const r=await saveEdit({src:'webm',fmt:'mp4',speed:2});assert.ok(r.want>1.3&&r.want<1.7,'length '+r.want);checkSave(r);near(r.hz,440,10,'pitch at 2×');return r});
await test('B18 Frame rate 60 makes a 60 fps file',async()=>{await ev(async()=>{await openV(null,vwebm);change('[data-r="ofps"]','60')});const r=await ev(async()=>{const o=await __T.vid._ctl.renderBlob('mp4');return{stats:D().eng.S.lastExport,need:__T.vid._ctl.needsRender(),fps:P().fps,want:__T.vid._ctl.duration()}});
  assert.equal(r.stats.fps,60);assert.equal(r.stats.frames,Math.round(r.want*60));assert.equal(r.fps,60);assert.ok(r.need,'a new frame rate alone is not rendered');return r});

// ---------- later versions (todo) ----------
await test('B4 one video element per source, not per clip',async()=>{const r=await ev(async()=>{await openV();for(const t of [.5,1,1.5,2,2.5])await splitAt(t);await D().eng.seek(0);await D().eng.play();await QA.sleep(2800);D().eng.pause();
  const els=Object.values(D().eng.S.pool).flat().filter(o=>!o.isAud).length;return{clips:P().clips.length,videoElements:els}});assert.ok(r.videoElements<=2,r.videoElements+' video elements for '+r.clips+' clips');return r});

await test('B14 the editor does not redraw the timeline while idle',async()=>{const r=await ev(async()=>{await openV();D().eng.pause();await QA.sleep(300);const g=document.querySelector('.vtl').getContext('2d'),orig=g.clearRect;let n=0;g.clearRect=function(...a){n++;return orig.apply(this,a)};await QA.sleep(1000);g.clearRect=orig;return{redrawsPerSecond:n}});
  assert.ok(r.redrawsPerSecond<5,r.redrawsPerSecond+' redraws in 1 s idle');return r});

await test('B7 the timeline scale stays fixed while dragging the last clip',async()=>{await ev(async()=>{await openV();await splitAt(1.5);await D().eng.seek(0)});
  const box=await page.locator('.vtl').boundingBox(),m=await ev(()=>({D:__T.vid._ctl.duration(),start:P().clips.find(c=>c.start>1).start}));
  const xOf=t=>box.x+11+t/m.D*(box.width-22),y=box.y+46,x0=xOf(2.25);await page.mouse.move(x0,y);await page.mouse.down();for(let i=1;i<=10;i++){await page.mouse.move(x0+i*10,y);await page.waitForTimeout(16)}await page.mouse.up();
  const now=await ev(()=>P().clips.find(c=>c.start>1).start),want=m.start+100/(box.width-22)*m.D;near(now,want,want*.03+.02,'clip start after a 100 px drag');return{start:m.start,now,want}},{todo:'10.1.10'});

await test('B17 Right arrow steps one frame',async()=>{const r=await ev(async()=>{await openV();await D().eng.seek(1);document.body.focus();QA.key('ArrowRight');await QA.sleep(300);return{t:D().eng.t}});near(r.t,1+1/30,.005,'after one step');return r},{todo:'10.1.10'});

await test('B9 ripple delete keeps spanning audio in sync with the picture',async()=>{
  const wav=await ev(async()=>[...new Uint8Array(await (await QA.toneWav([300,500,700],1)).arrayBuffer())]);
  await ev(async()=>{await openV();await splitAt(1.5)});await page.locator('[data-tab="audio"]').click().catch(()=>{});
  await page.locator('[data-r="audfile"]').setInputFiles({name:'music.wav',mimeType:'audio/wav',buffer:Buffer.from(wav)});
  const r=await ev(async()=>{await QA.until(()=>P().aud.length===1);const a=P().aud[0];a.start=0;const c1=P().clips.find(c=>c.start<1);D().select('clip',c1);D().act.del();
    // the audio that was under the deleted 1.5 s must be gone too: what plays at t=0 should be source time 1.5
    const at0=P().aud.filter(x=>x.start<=1e-3).map(x=>x.a);return{aud:P().aud.map(x=>({a:+x.a.toFixed(2),b:+x.b.toFixed(2),start:+x.start.toFixed(2)})),at0}});
  assert.ok(r.at0.some(a=>Math.abs(a-1.5)<.05),'audio at 0 s starts at source '+r.at0);return r},{todo:'10.1.10'});

await test('B22 Space on a focused button presses that button and does not start playback',async()=>{const r=await ev(async()=>{await openV();await D().eng.seek(1);const before=P().clips.length;return{before}});
  await page.keyboard.press('Shift');await page.locator('[data-a="split"]').focus();await page.keyboard.press('Space');await page.waitForTimeout(400);
  const r2=await ev(()=>{const x={clips:P().clips.length,playing:D().eng.playing};D().eng.pause();return x});assert.ok(r2.clips>r.before,'the focused Split button was not pressed');assert.ok(!r2.playing,'playback started');return{...r,...r2}});

await test('B22 after clicking a button with the mouse, Space still plays',async()=>{await ev(async()=>{await openV();await D().eng.seek(1)});await page.locator('[data-a="split"]').click();await page.waitForTimeout(150);
  const n=await ev(()=>P().clips.length);await page.keyboard.press('Space');await page.waitForTimeout(400);const r=await ev(()=>{const x={clips:P().clips.length,playing:D().eng.playing};D().eng.pause();return x});
  assert.equal(r.clips,n,'Space pressed the button again');assert.ok(r.playing,'Space did not play');return r});

for(const load of [0,25])await test('B3 no black or blank frames at cuts (split, and a cut to another video)'+(load?' under CPU load':''),async()=>{const r=await ev(async load=>{const stop=busy(load);try{await openV();await splitAt(1.5);await __T.vid._ctl.insertClip({blob:vblob,name:'Second'},'stack',P().clips.reduce((m,c)=>Math.max(m,c.start+(c.b-c.a)),0));
  const cv=document.querySelector('.vprev'),g=cv.getContext('2d'),runs=[];
  for(const [a,b] of [[1.1,1.9],[2.5,3.4]]){await D().eng.seek(a);await D().eng.play();let min=999,n=0;await new Promise(res=>{const f=()=>{const t=D().eng.t;if(t>a+.1){const d=g.getImageData(cv.width>>1,cv.height>>1,1,1).data,v=d[0]+d[1]+d[2];min=Math.min(min,v);n++}if(t>=b||!D().eng.playing)return res();requestAnimationFrame(f)};requestAnimationFrame(f)});D().eng.pause();runs.push({a,b,minBrightness:min,frames:n})}return runs}finally{stop()}},load);
  for(const x of r)assert.ok(x.minBrightness>60,'dark frame near '+x.a+'-'+x.b+': '+x.minBrightness);return r});

for(const load of [0,25])await test('B2 picture stays within 25 ms of the timeline clock while playing'+(load?' under CPU load':''),async()=>{const r=await ev(async load=>{const stop=busy(load);try{await openV();await D().eng.seek(0);await D().eng.play();await QA.sleep(600);let max=0,n=0;const c=P().clips[0];
  await new Promise(res=>{const t0=performance.now(),f=()=>{const o=D().eng.S.els[c.id];if(o&&!o.el.paused&&!o.el.seeking){const want=c.a+(D().eng.t-c.start)*(c.speed||1);max=Math.max(max,Math.abs(o.el.currentTime-want));n++}if(performance.now()-t0>1500)return res();requestAnimationFrame(f)};requestAnimationFrame(f)});D().eng.pause();return{maxDriftMs:Math.round(max*1000),samples:n}}finally{stop()}},load);
  assert.ok(r.samples>10,'too few samples');assert.ok(r.maxDriftMs<25,'drift '+r.maxDriftMs+' ms');return r});

results.push({name:'No renderer errors',pass:errors.length===0,errors});if(errors.length)console.log('FAIL No renderer errors',errors[0]);
}finally{const req=results.filter(r=>!r.todo),todo=results.filter(r=>r.todo);
  fs.writeFileSync(path.join(out,'video-editor-results.json'),JSON.stringify({passed:req.filter(r=>r.pass).length,failed:req.filter(r=>!r.pass).length,todoPassed:todo.filter(r=>r.pass).length,todoFailed:todo.filter(r=>!r.pass).length,results},null,2));
  console.log(`\n${req.filter(r=>r.pass).length}/${req.length} required passed; todo ${todo.filter(r=>r.pass).length}/${todo.length} passing`);await browser.close();process.exitCode=req.some(r=>!r.pass)?1:0}
})().catch(e=>{console.error(e);process.exitCode=1});
