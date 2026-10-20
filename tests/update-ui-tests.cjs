// 10.1.13: the "Check for Updates" link and dialog in the editor. Build and serve tests/build-harness.js first.
// node tests/update-ui-tests.cjs http://127.0.0.1:8944
const {chromium}=require('playwright'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SAVEIT_BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage({viewport:{width:1440,height:900}}),results=[],errors=[];page.on('pageerror',e=>errors.push(e.stack));page.setDefaultTimeout(15000);
 await page.goto(process.argv[2]||'http://127.0.0.1:8944');await page.waitForFunction(()=>window.__T&&document.body.dataset.catalogCount&&document.querySelector('#updLink103'));
 const ev=(fn,a)=>page.evaluate(fn,a),test=async(name,fn)=>{try{await fn();results.push(1);console.log('PASS',name)}catch(e){results.push(0);console.log('FAIL',name,e.message)}};
 const calls=()=>ev(()=>({...(window.__updCalls||{})})),dlg=()=>ev(()=>(document.querySelector('#updateDialog103')||{}).innerText||'');
 const reset=()=>ev(()=>{document.querySelectorAll('#updateDialog103').forEach(m=>m.remove());window.__updCalls={};while(window.busyLeave103&&__T.updateBusy103().length&&document.__x===undefined){break}});
 const AVAILABLE={ok:true,state:'available',current:'10.1.12',latest:'10.1.13',canInstall:true,notes:"## What's new\n\n- **Check for Updates** link at the bottom right\n- Fixes [thing](http://x.y)\n"};

 await test('The link is small, at the bottom right, and nothing contacts GitHub on its own',async()=>{
  await page.waitForTimeout(2500);assert.deepEqual(await calls(),{},'no update call before a click');
  const r=await ev(()=>{const b=document.querySelector('#updLink103'),q=b.getBoundingClientRect(),cs=getComputedStyle(b),st=document.querySelector('#status').getBoundingClientRect();return{text:b.textContent,fs:parseFloat(cs.fontSize),right:innerWidth-q.right,bottom:innerHeight-q.bottom,inStatus:q.top>=st.top-1&&q.bottom<=st.bottom+1,visible:q.width>0&&b.offsetParent!==null}});
  assert.equal(r.text,'Check for Updates \u2192');assert.ok(r.fs<=12,'small letters: '+r.fs);assert.ok(r.right<30&&r.bottom<30,'bottom right corner '+JSON.stringify(r));assert.ok(r.inStatus,'sits in the bar that runs across the bottom');assert.ok(r.visible)});
 await test('Up to date: one request, and the message says so',async()=>{
  await reset();await page.locator('#updLink103').click();await page.waitForSelector('#updBody103 .upd-big');assert.deepEqual(await calls(),{check:1});assert.match(await dlg(),/Saveit is up to date\./)});
 await test('Update available: shows the new version, clean release notes and an Install Update button; Not now closes without downloading',async()=>{
  await reset();await ev(a=>{window.bench.updateCheck=async()=>a},AVAILABLE);await page.locator('#updLink103').click();await page.waitForSelector('#updInstall103');
  const t=await dlg();assert.match(t,/Version 10\.1\.13 is available/);assert.match(t,/You have version 10\.1\.12/);assert.match(t,/Check for Updates link at the bottom right/);assert.doesNotMatch(t,/\*\*|\]\(http/);assert.ok(await page.locator('#updInstall103').isEnabled());
  await page.locator('[data-close2]').click();assert.equal(await page.locator('#updateDialog103').count(),0);assert.equal((await calls()).download||0,0)});
 await test('GitHub unavailable: a plain message and Try again, nothing installed',async()=>{
  await reset();await ev(()=>{window.bench.updateCheck=async()=>({ok:false,code:'network',message:'Saveit could not reach GitHub. Check your internet connection and try again.'})});await page.locator('#updLink103').click();await page.waitForSelector('#updRetry103');
  assert.match(await dlg(),/could not reach GitHub/);await ev(a=>{window.bench.updateCheck=async()=>a},{ok:true,state:'current',current:'10.1.12'});await page.locator('#updRetry103').click();await page.waitForSelector('.upd-big');assert.match(await dlg(),/up to date/)});
 await test('Install Update downloads, then asks to save work and confirm; Cancel leaves everything alone',async()=>{
  await reset();await ev(a=>{window.bench.updateCheck=async()=>a;window.bench.updateDownload=async()=>{window.__updCalls.download=(window.__updCalls.download||0)+1;return{ok:true,version:'10.1.13'}}},AVAILABLE);
  await page.locator('#updLink103').click();await page.locator('#updInstall103').click();await page.waitForSelector('#updGo103');
  const t=await dlg();assert.match(t,/ready to install/);assert.match(t,/downloaded and verified/);assert.match(t,/save your work first/i);assert.match(t,/close, install it, and open again/);
  await page.locator('[data-close2]').click();assert.equal((await calls()).apply||0,0);assert.equal((await calls()).download,1)});
 await test('Install and restart saves the library, then asks the desktop to start the update, once',async()=>{
  await reset();await ev(a=>{window.bench.updateCheck=async()=>a;window.bench.updateDownload=async()=>({ok:true,version:'10.1.13'});window.bench.updateApply=async()=>{window.__updCalls.apply=(window.__updCalls.apply||0)+1;return{ok:true}}},AVAILABLE);
  await page.locator('#updLink103').click();await page.locator('#updInstall103').click();await page.locator('#updGo103').click();await page.waitForFunction(()=>/closing to finish the update/.test(document.querySelector('#updateDialog103')?.innerText||''));assert.equal((await calls()).apply,1)});
 await test('Busy: an export in progress blocks the update (before download and again before closing)',async()=>{
  await reset();await ev(a=>{window.bench.updateCheck=async()=>a;window.bench.updateDownload=async()=>{window.__updCalls.download=(window.__updCalls.download||0)+1;return{ok:true,version:'10.1.13'}};window.bench.updateApply=async()=>{window.__updCalls.apply=(window.__updCalls.apply||0)+1;return{ok:true}};window.busyEnter103()},AVAILABLE);
  await page.locator('#updLink103').click();await page.locator('#updInstall103').click();await page.waitForSelector('#updRetry103');assert.match(await dlg(),/cannot update right now because an export or save is still running/);assert.equal((await calls()).download||0,0);
  await ev(()=>window.busyLeave103());await page.locator('#updRetry103').click();await page.locator('#updLink103').click();await page.locator('#updInstall103').click();await page.waitForSelector('#updGo103');
  await ev(()=>window.busyEnter103());await page.locator('#updGo103').click();await page.waitForSelector('#updRetry103');assert.equal((await calls()).apply||0,0,'closing never starts while busy');await ev(()=>window.busyLeave103())});
 await test('A recording or a video export counts as busy',async()=>{
  const r=await ev(()=>{const base=__T.updateBusy103();return{base}});assert.deepEqual(r.base,[]);
  const v=await ev(async()=>{await QA.openVideo(1);let c=null;for(let i=0;i<40&&!(c=__T.vid&&__T.vid._ctl);i++)await new Promise(r=>setTimeout(r,100));const idle=__T.updateBusy103();const run=c.renderBlob();await new Promise(r=>setTimeout(r,200));const during=__T.updateBusy103();await run;return{idle,during,after:__T.updateBusy103()}});
  assert.deepEqual(v.idle,[]);assert.ok(v.during.some(x=>/video is being exported/.test(x)),JSON.stringify(v.during));assert.deepEqual(v.after,[])});
 await test('A failed or unverifiable download is explained and nothing is installed',async()=>{
  await reset();await ev(a=>{window.bench.updateCheck=async()=>a;window.bench.updateDownload=async()=>({ok:false,code:'verify',message:'The downloaded update could not be verified as genuine, so it was deleted and nothing was installed.'});window.bench.updateApply=async()=>{window.__updCalls.apply=1;return{ok:true}}},AVAILABLE);
  await page.locator('#updLink103').click();await page.locator('#updInstall103').click();await page.waitForSelector('#updRetry103');const t=await dlg();assert.match(t,/could not be verified as genuine/);assert.match(t,/Nothing was installed, and Saveit is unchanged/);assert.equal((await calls()).apply||0,0)});
 await test('An update that cannot be installed automatically (no signature or not the installed app) disables Install Update',async()=>{
  await reset();await ev(()=>{window.bench.updateCheck=async()=>({ok:true,state:'unavailable',current:'10.1.12',latest:'10.1.13',reason:'This release has no signature, so Saveit cannot verify it and will not install it automatically. You can download it from GitHub.'})});
  await page.locator('#updLink103').click();await page.waitForSelector('#updPage103');assert.match(await dlg(),/no signature/);assert.equal(await page.locator('#updInstall103').count(),0);
  await reset();await ev(a=>{window.bench.updateCheck=async()=>({...a,canInstall:false})},AVAILABLE);await page.locator('#updLink103').click();await page.waitForSelector('#updInstall103');assert.equal(await page.locator('#updInstall103').isDisabled(),true);assert.match(await dlg(),/only in the installed version/)});
 await test('After an update: a success shows the installed version once; a rollback or failure explains what happened and where the log is',async()=>{
  await reset();await ev(()=>{document.querySelectorAll('.toast').forEach(t=>t.remove());window.showUpdateResult103({status:'ok',version:'10.1.14',message:'Saveit was updated to version 10.1.14 and is running.'})});
  const t=await ev(()=>[...document.querySelectorAll('.toast')].map(x=>x.textContent).join('|'));assert.match(t,/Saveit was updated to version 10\.1\.14\. Your library and settings were kept\./);assert.equal(await page.locator('#updateDialog103').count(),0);
  await ev(()=>window.showUpdateResult103({status:'rolled-back',version:'10.1.13',message:'The update to 10.1.14 could not be completed (The new version did not start properly). Saveit put back version 10.1.13 and it is running normally.',log:'C:\\x\\update.log'}));
  const d=await dlg();assert.match(d,/The update was not installed/);assert.match(d,/put back version 10\.1\.13/);assert.match(d,/Details: C:\\x\\update\.log/);
  await reset();await ev(()=>window.showUpdateResult103({status:'failed',message:'Could not restore.',log:'L'}));assert.match(await dlg(),/The update could not be completed/);
  await reset();await ev(()=>{document.querySelectorAll('.toast').forEach(t=>t.remove());window.showUpdateResult103(null);window.showUpdateResult103({})});assert.equal(await page.locator('#updateDialog103').count(),0)});
 console.log(JSON.stringify({passed:results.filter(Boolean).length,failed:results.filter(x=>!x).length,errors}));await browser.close();process.exit(results.includes(0)||errors.length?1:0)})();
