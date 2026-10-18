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
 console.log(JSON.stringify({passed:results.filter(Boolean).length,failed:results.filter(x=>!x).length,errors}));await browser.close();process.exit(results.includes(0)||errors.length?1:0)})();
