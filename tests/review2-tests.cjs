// Fixes from the second company review (10.0.11 -> 10.0.12 and later). Build and serve tests/build-harness.js first.
// node tests/review2-tests.cjs http://127.0.0.1:8944
const {chromium}=require('playwright'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SAVEIT_BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),results=[],errors=[];page.on('pageerror',e=>errors.push(e.stack));page.setDefaultTimeout(30000);
 await page.goto(process.argv[2]||'http://127.0.0.1:8944');await page.waitForFunction(()=>window.__T?.makeStep&&document.body.dataset.catalogCount);
 const ev=(fn,a)=>page.evaluate(fn,a),test=async(name,fn)=>{try{await fn();results.push(1);console.log('PASS',name)}catch(e){results.push(0);console.log('FAIL',name,e.message)}};

 await test('B9: invisible direction marks are removed from step names',async()=>{
  const t=await ev(()=>__T.stepTitleFrom({name:'Clock 7:33 PM \u200e10/\u200e17/\u200e2026',type:'button',ctype:50000,button:'left'}).title);
  assert.equal(t,'Click "Clock 7:33 PM 10/17/2026"');
  const u=await ev(()=>__T.stepTitleFrom({name:'\ufeffSave\u202a as\u2069',type:'button',ctype:50000}).title);assert.equal(u,'Click "Save as"')});
 await test('S1: the Library opens with an empty search even after an earlier search',async()=>{
  await ev(()=>{document.querySelectorAll('.modal').forEach(m=>m.remove());__T.libQuery='Sample'});
  await ev(()=>__T.openLibrary());await page.waitForSelector('#libQ');assert.equal(await page.locator('#libQ').inputValue(),'');assert.equal(await ev(()=>__T.libQuery),'');
  await page.locator('#libQ').fill('abc');assert.equal(await ev(()=>__T.libQuery),'abc');await ev(()=>document.querySelectorAll('.modal').forEach(m=>m.remove()))});
 await test('S2: the first Save of a video lists MP4, WebM and GIF',async()=>{
  const r=await ev(async()=>{const T=__T;await QA.openVideo(1);window.bench.savePickCalls=[];window.bench.savePick=(name,exts)=>{window.bench.savePickCalls.push([...exts]);return Promise.resolve(null)};
   await T.save();await new Promise(r=>setTimeout(r,300));return window.bench.savePickCalls[0]});
  assert.ok(r.includes('gif'),JSON.stringify(r));assert.ok(r.includes('mp4')||r.includes('webm'),JSON.stringify(r))});
 // ---- Fill (10.1.0)
 await test('B1: Fill defaults to Similar colours 3, and one click on a grey row of the sample stays at about 13%',async()=>{
  const r=await ev(()=>{const it=__T.S.items.find(i=>i.name==='Sample capture');__T.openItem(it);__T.setTool('fill');const W=it.base.width,H=it.base.height,g=it.base.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H);
   const slider=document.querySelector('[data-fp="tol"]').value,res=ImgTools.region(g,210,44,+slider,true);return{slider,pct:res.count/(W*H),tolDefault:__T.S.p.tol}});
  assert.equal(r.slider,'3');assert.ok(r.pct>.1&&r.pct<.16,'filled '+Math.round(r.pct*100)+'%')});
 await test('B1: grow edge no longer eats the letters inside a filled area (and still tidies a shape edge)',async()=>{
  const r=await ev(()=>{const it=__T.S.items.find(i=>i.name==='Sample capture'),W=it.base.width,H=it.base.height,g0=it.base.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H),lum=(d,i)=>.3*d[i]+.59*d[i+1]+.11*d[i+2];
   const out=ImgTools.fill(it.base,210,44,'#e5372a',5,true,1),img=out.canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H);let text=0,eaten=0;
   for(let y=44;y<H;y++)for(let x=210;x<W;x++){const o=(y*W+x)*4;if(lum(g0.data,o)<200){text++;if(img.data[o]!==g0.data[o]||img.data[o+1]!==g0.data[o+1]||img.data[o+2]!==g0.data[o+2])eaten++}}
   // a plain shape: a white box with a soft grey edge pixel; growing the fill must still cover that edge pixel
   const c=document.createElement('canvas');c.width=60;c.height=60;const g=c.getContext('2d');g.fillStyle='#202020';g.fillRect(0,0,60,60);g.fillStyle='#808080';g.fillRect(9,9,42,42);g.fillStyle='#ffffff';g.fillRect(10,10,40,40);
   const o2=ImgTools.fill(c,30,30,'#ff0000',3,true,1),d2=o2.canvas.getContext('2d').getImageData(0,0,60,60).data,px=(x,y)=>[...d2.slice((y*60+x)*4,(y*60+x)*4+3)];
   return{text,eaten,inner:px(30,30),edgeCovered:px(9,30),border:px(2,30)}});
  assert.ok(r.text>1000);assert.equal(r.eaten,0,'letters overwritten: '+r.eaten);assert.deepEqual(r.inner,[255,0,0]);assert.deepEqual(r.edgeCovered,[255,0,0],'the grey edge pixel is tidied');assert.deepEqual(r.border,[32,32,32],'the dark border stays')});
 await test('B1: a very large fill says how much it filled and how to undo or narrow it',async()=>{
  await ev(()=>{document.querySelectorAll('.toast').forEach(t=>t.remove());const T=__T,it=T.addImage(QA.canvas(400,300,'#ffffff'),'big fill',{flat:true});T.openItem(it);T.S.zoom=1;T.setTool('fill')});
  const q=await ev(()=>{const cv=document.querySelector('#cv'),r=cv.getBoundingClientRect(),k=cv.width/r.width;return{x:r.left+(100+__T.padX())/k,y:r.top+(100+__T.padY())/k}});await page.mouse.click(q.x,q.y);await page.waitForTimeout(300);
  const t=await ev(()=>[...document.querySelectorAll('.toast')].map(x=>x.textContent).join('|'));assert.match(t,/That filled 100% of the picture/);assert.match(t,/Ctrl\+Z/);assert.match(t,/lower Similar colours/)});
 // ---- WebM length (10.1.1)
 const recordWebm=()=>ev(async()=>{const c=document.createElement('canvas');c.width=160;c.height=120;const g=c.getContext('2d'),stream=c.captureStream(15),mr=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'}),chunks=[];mr.ondataavailable=e=>e.data.size&&chunks.push(e.data);
   const done=new Promise(r=>mr.onstop=r);mr.start(250);const t0=performance.now();let n=0;const iv=setInterval(()=>{g.fillStyle='hsl('+(n++*20%360)+',70%,50%)';g.fillRect(0,0,160,120)},60);await new Promise(r=>setTimeout(r,1500));clearInterval(iv);mr.stop();await done;
   window.__webm=new Blob(chunks,{type:'video/webm'});window.__webmMs=performance.now()-t0;return{size:window.__webm.size,ms:window.__webmMs}});
 await test('B10: MediaRecorder WebM has no length; WebmFix.fix writes it (11 bytes added) and the file still plays and seeks',async()=>{
  const rec=await recordWebm();
  const r=await ev(async()=>{const W=window.WebmFix,b=window.__webm,before=await W.duration(b),fixed=await W.fix(b,1500),after=await W.duration(fixed);
   const probe=blob=>new Promise(res=>{const v=document.createElement('video');v.muted=true;v.preload='metadata';v.src=URL.createObjectURL(blob);v.onloadedmetadata=()=>{const d=v.duration;v.currentTime=0.5;v.onseeked=()=>res({d,seeked:true});setTimeout(()=>res({d,seeked:false}),4000)};v.onerror=()=>res({d:-1,seeked:false})});
   return{before,after,grew:fixed.size-b.size,again:(await W.fix(fixed,900))===fixed,bad:(await W.fix(new Blob([new Uint8Array([1,2,3,4,5,6,7,8])]),1000)).size,playing:await probe(fixed),rawDur:(await probe(b)).d}});
  assert.equal(r.before,0);assert.ok(Math.abs(r.after-1500)<1,'stored '+r.after);assert.equal(r.grew,11);assert.equal(r.again,true,'a file that already has a length is left alone');assert.equal(r.bad,8,'garbage is returned unchanged');
  assert.ok(Number.isFinite(r.playing.d)&&Math.abs(r.playing.d-1.5)<.05,'player duration '+r.playing.d);assert.equal(r.playing.seeked,true)});
 await test('B10: ensure() measures a WebM without a length, patches it once, and a saved older recording gets its length',async()=>{
  await recordWebm();
  const r=await ev(async()=>{const W=window.WebmFix,b=window.__webm,fixed=await W.ensure(b),again=await W.ensure(b),ms=await W.duration(fixed);
   const T=__T,v=T.addVideo(b,'older webm');v.webm=b;v.mp4=null;window.bench.savePick=(name,exts)=>Promise.resolve('C:\\test\\'+name+'.webm');__saved.length=0;T.openItem(v);await T.save('webm');await new Promise(r=>setTimeout(r,800));
   const saved=__saved.at(-1);return{ms,same:fixed===again,grew:fixed.size-b.size,savedMs:saved?await W.duration(new Blob([saved.data])):-1,savedName:saved&&saved.name}});
  assert.ok(Math.abs(r.ms-1500)<300,'measured '+r.ms);assert.equal(r.same,true,'cached');assert.equal(r.grew,11);assert.ok(r.savedMs>1000&&r.savedMs<2200,'saved file length '+r.savedMs+' ('+r.savedName+')')});
 await test('B10: a video exported from the editor has its WebM length written',async()=>{
  const r=await ev(async()=>{await QA.openVideo(1);let ctl=null;for(let i=0;i<40&&!(ctl=__T.vid&&__T.vid._ctl);i++)await new Promise(r=>setTimeout(r,100));/* 10.1.9: Save makes only the format asked for */const o=await ctl.renderBlob('webm');return{keys:Object.keys(o||{}),ms:o&&o.webm?await WebmFix.duration(o.webm):-1}});
  assert.ok(r.keys.includes('webm'),'no webm: '+r.keys);assert.ok(r.ms>500&&r.ms<2500,'exported WebM length '+r.ms)});
 await test('B10: a screen recording (with a pause) is stored with its WebM length, excluding the paused time',async()=>{
  const r=await ev(async()=>{const T=__T,c=document.createElement('canvas');c.width=160;c.height=120;const g=c.getContext('2d'),stream=c.captureStream(15);let n=0;const iv=setInterval(()=>{g.fillStyle='hsl('+(n++*20%360)+',70%,50%)';g.fillRect(0,0,160,120)},60);
   const before=T.S.items.length;await T.beginRecording(stream,stream,null,null,{});await new Promise(r=>setTimeout(r,1200));T.rec.togglePause();await new Promise(r=>setTimeout(r,1200));T.rec.togglePause();await new Promise(r=>setTimeout(r,800));T.rec.stop();
   for(let i=0;i<100&&T.S.items.length===before;i++)await new Promise(r=>setTimeout(r,100));clearInterval(iv);await new Promise(r=>setTimeout(r,500));
   const v=T.S.items.find(i=>i.kind==='video'&&i.webm&&/^Recording|^Video|^Screen/i.test(i.name||'')||i.kind==='video'&&i.webm);return{n:T.S.items.length-before,has:!!(v&&v.webm),ms:v&&v.webm?await WebmFix.duration(v.webm):-1}});
  assert.ok(r.has,'a recording with a WebM was stored');assert.ok(r.ms>1500&&r.ms<2600,'length '+r.ms+' ms (about 2.0 s of recording, 1.2 s of pause left out)')});
 // ---- Grab Text (10.1.2)
 await test('B11: text annotations are read from the shapes, not from the picture, and follow the text read from the picture',async()=>{
  const r=await ev(async()=>{const T=__T,base=QA.canvas(600,300,'#ffffff'),g=base.getContext('2d');g.fillStyle='#000';g.font='20px sans-serif';g.fillText('Row text on the picture',20,40);
   const it=T.addImage(base,'ocr notes',{flat:true});T.openItem(it);const c=T.newShape('callout',200,100);Object.assign(c,{x2:500,y2:200,tx:300,ty:260,txt:'Follow up with purchasing',fill:'#ffff99'});it.shapes.push(c);
   let sent=null;window.bench.ocr=async url=>{sent=url;return 'Row text on the picture'};window.bench.ocrLayout=async()=>({lines:[]});
   await T.grabTextFrom({x:0,y:0,w:600,h:300});await new Promise(r=>setTimeout(r,500));
   const img=new Image();img.src=sent;await img.decode();const cv=document.createElement('canvas');cv.width=img.naturalWidth;cv.height=img.naturalHeight;const cx=cv.getContext('2d');cx.drawImage(img,0,0);const k=img.naturalWidth/600,p=cx.getImageData(Math.round(350*k),Math.round(150*k),1,1).data;
   return{text:document.querySelector('#ocrText')?.value,calloutAreaWhite:p[0]>250&&p[1]>250&&p[2]>250,scaled:k}});
  assert.equal(r.text,'Row text on the picture\n\nFollow up with purchasing');assert.equal(r.calloutAreaWhite,true,'the callout is not in the picture that is read')});
 console.log(JSON.stringify({passed:results.filter(Boolean).length,failed:results.filter(x=>!x).length,errors}));await browser.close();process.exit(results.includes(0)||errors.length?1:0)})();
