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
 console.log(JSON.stringify({passed:results.filter(Boolean).length,failed:results.filter(x=>!x).length,errors}));await browser.close();process.exit(results.includes(0)||errors.length?1:0)})();
