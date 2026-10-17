// 10.0.3: fixes from the 9.9.4 company review (bugs 1-4). Build and serve tests/build-harness.js first.
// node tests/review103-tests.cjs http://127.0.0.1:8944
const {chromium}=require('playwright'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SAVEIT_BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),results=[],errors=[];page.on('pageerror',e=>errors.push(e.stack));page.setDefaultTimeout(20000);
 await page.goto(process.argv[2]||'http://127.0.0.1:8944');await page.waitForFunction(()=>window.__T?.addAudio&&document.body.dataset.catalogCount);
 const ev=(fn,a)=>page.evaluate(fn,a),test=async(name,fn)=>{try{await fn();results.push(1);console.log('PASS',name)}catch(e){results.push(0);console.log('FAIL',name,e.message)}};
 const bar=()=>ev(()=>({mode:S_mode(),lbl:document.querySelector('#capLbl').textContent,pressed:['mImg','mVid','mAud'].map(i=>document.getElementById(i).getAttribute('aria-pressed'))}));
 await ev(()=>{window.S_mode=()=>__T.S.mode});
 await test('Bug 1: opening an audio item from Recent switches the top bar to Audio, and an image switches it back',async()=>{
  await ev(async()=>{window.aud1=__T.addAudio([{name:'Voice',blob:await QA.toneWav([300],1),vol:1,mute:false,solo:false}],'Audio one');__T.openItem(__T.S.items.find(i=>i.kind==='image'))});
  let b=await bar();assert.equal(b.mode,'image');assert.equal(b.lbl,'Capture');
  await ev(()=>__T.openItem(aud1));b=await bar();assert.equal(b.mode,'audio');assert.equal(b.lbl,'Record audio');assert.deepEqual(b.pressed,['false','false','true']);
  await ev(()=>__T.openItem(__T.S.items.find(i=>i.kind==='image')));b=await bar();assert.equal(b.mode,'image');assert.equal(b.lbl,'Capture')});
 await test('Bug 1: opening a video item switches the top bar to Video',async()=>{await ev(async()=>{await QA.openVideo(1)});const b=await bar();assert.equal(b.mode,'video');await ev(()=>__T.openItem(__T.S.items.find(i=>i.kind==='image')));assert.equal((await bar()).mode,'image')});
 await test('Bug 3: a new capture says 0 annotations; real annotations and extra pictures are counted',async()=>{
  const s=await ev(async()=>{const c=QA.canvas(800,450,'#edf2f7');__T.addImage(c,'Fresh capture');await new Promise(r=>setTimeout(r,400));const a=document.querySelector('#status').textContent;
   const sample=__T.S.items.find(i=>i.name==='Sample capture');__T.openItem(sample);return[a,document.querySelector('#status').textContent]});
  assert.match(s[0],/Annotations 0/);assert.doesNotMatch(s[0],/Pictures/);assert.match(s[1],/Annotations 6/)});
 await test('Bug 2: Fill defaults to a tight tolerance and fills one cell, not the whole page',async()=>{
  const r=await ev(()=>{const it=__T.S.items.find(i=>i.name==='Sample capture');__T.openItem(it);__T.setTool('fill');return{slider:document.querySelector('[data-fp="tol"]').value,
   count:(()=>{const c=it.base,W=c.width,H=c.height,img=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H);return ImgTools.region(img,300,300,+document.querySelector('[data-fp="tol"]').value,true).count/(W*H)})()}});
  assert.equal(r.slider,'5');assert.ok(r.count<.15,'fill covered '+Math.round(r.count*100)+'%')});
 await test('Bug 4: Undo after splitting an audio clip joins it again (top bar and audio bar)',async()=>{
  const r=await ev(async()=>{document.querySelectorAll('.modal').forEach(m=>m.remove());const it=__T.addAudio([{name:'Voice',blob:await QA.toneWav([300,500,700],1),vol:1,mute:false,solo:false}],'Split undo');await QA.until(()=>__T.S.cur===it&&__T.audio?.getProject?.());await __T.audio.ready;
   const n=()=>it.audioProject.clips.length,o={start:n()};__T.audio.seek(1.5);__T.audio.split();o.split=n();document.querySelector('#undoBtn').click();await new Promise(r=>setTimeout(r,150));o.afterTopUndo=n();
   __T.audio.redo?.();o.redo=n();__T.audio.undo();o.afterAudioUndo=n();return o});
  assert.equal(r.start,1);assert.equal(r.split,2);assert.equal(r.afterTopUndo,1,JSON.stringify(r));assert.equal(r.afterAudioUndo,1,JSON.stringify(r))});
 await test('10.0.4 cursors: resize arrows on box handles, grab hand on arrow/line ends, move on the body',async()=>{
  await ev(()=>{const it=__T.addImage(QA.canvas(1000,600,'#edf2f7'),'cursor test',{flat:true});__T.openItem(it);__T.S.zoom=.8});
  const at=(x,y)=>ev(({x,y})=>{const cv=document.querySelector('#cv'),r=cv.getBoundingClientRect(),k=cv.width/r.width;return{x:r.left+x/k,y:r.top+y/k}},{x,y}),cur=()=>ev(()=>document.querySelector('#cv').style.cursor);
  const draw=async(tool,a,z)=>{await ev(t=>__T.setTool(t),tool);const p=await at(...a),q=await at(...z);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(q.x,q.y,{steps:6});await page.mouse.up();return ev(()=>{const s=__T.S.sel;return[s.x1,s.y1,s.x2,s.y2]})};
  const hover=async(x,y)=>{const q=await at(x,y);await page.mouse.move(q.x+25,q.y+25);await page.mouse.move(q.x,q.y);return cur()};
  let r=await draw('rect',[200,200],[500,400]);assert.equal(await hover(r[2],r[3]),'nwse-resize');assert.equal(await hover(r[2],r[1]),'nesw-resize');assert.equal(await hover(350,r[1]),'ns-resize');assert.equal(await hover((r[0]+r[2])/2,(r[1]+r[3])/2),'move');
  r=await draw('arrow',[600,150],[850,300]);assert.equal(await hover(r[0],r[1]),'grab');assert.equal(await hover(r[2],r[3]),'grab');
  r=await draw('line',[600,400],[850,520]);assert.equal(await hover(r[0],r[1]),'grab');assert.equal(await hover(r[2],r[3]),'grab');
  const q=await at(r[2],r[3]);await page.mouse.move(q.x,q.y);await page.mouse.down();await page.mouse.move(q.x+10,q.y+10,{steps:3});assert.equal(await cur(),'grabbing');await page.mouse.up()});
 await test('10.0.5: mic tracks are named Mic 1 / Mic 2 (not the long device name); pan shows as "Pan C" with a tooltip',async()=>{
  const r=await ev(async()=>{const o={};for(const mics of [['pitchA'],['pitchA','pitchB']]){const ctl=await AEdit.record({mics,sys:false,onLevel(){},warn(){}});ctl.start();await QA.sleep(400);const tracks=await ctl.stop();o[mics.length]=tracks.map(t=>t.name)}return o});
  assert.deepEqual(r[1],['Microphone']);assert.deepEqual(r[2],['Mic 1','Mic 2']);
  const hint=await ev(async()=>{const it=__T.addAudio([{name:'Microphone',blob:await QA.toneWav([300],1),vol:1,mute:false,solo:false}],'pan');await QA.until(()=>__T.S.cur===it&&__T.audio?.getProject?.());await new Promise(r=>setTimeout(r,300));const e=document.querySelector('.alane .arow .hint');return[e.textContent,e.title,e.getAttribute('aria-label')]});
  assert.deepEqual(hint,['Pan C','Pan: centre','Pan: centre'])});
 console.log(JSON.stringify({passed:results.filter(Boolean).length,failed:results.filter(x=>!x).length,errors}));await browser.close();process.exit(results.includes(0)||errors.length?1:0)})();
