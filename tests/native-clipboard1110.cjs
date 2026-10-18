// Real Electron + the real Windows clipboard: copying from Saveit pastes as a picture in email, and annotations stay editable inside Saveit.
// node tests/native-clipboard1110.cjs <electron.exe> <app folder> <evidence folder>      Disposable profile only. Overwrites the clipboard.
const {_electron}=require('playwright'),assert=require('assert/strict'),fs=require('fs'),path=require('path');
(async()=>{
const [exe,appDir,outArg]=process.argv.slice(2),out=path.resolve(outArg),source=path.resolve(appDir),profile=path.join(out,'profile');fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
const app=await _electron.launch({executablePath:path.resolve(exe),args:[source],env:{...process.env,SAVEIT_REVIEW_DATA:profile},timeout:30000}),results=[],errors=[];
const clip=()=>app.evaluate(({clipboard})=>{const im=clipboard.readImage(),s=im.getSize();return{w:s.width,h:s.height,empty:im.isEmpty(),text:clipboard.readText(),formats:clipboard.availableFormats()}});
try{const page=await app.firstWindow();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.stack));await page.waitForFunction(()=>document.body.dataset.catalogCount);
const test=async(name,fn)=>{try{const detail=await fn();results.push({name,pass:true,detail});console.log('PASS',name,detail?JSON.stringify(detail):'')}catch(e){results.push({name,pass:false,error:e.stack});console.log('FAIL',name,e.message);await page.screenshot({path:path.join(out,'failure-'+results.length+'.png')})}};
const toastIs=re=>page.waitForFunction(r=>new RegExp(r).test(document.querySelector('.toast')?.textContent||''),re.source);
const clearToast=()=>page.evaluate(()=>document.querySelectorAll('.toast').forEach(t=>t.remove()));
await test('Native version/runtime/profile match intended test app',async()=>{const r=await app.evaluate(({app})=>({version:app.getVersion(),electron:process.versions.electron,profile:app.getPath('userData')}));assert.equal(r.version,require(path.join(source,'package.json')).version);assert.equal(r.electron,'33.2.1');assert.equal(r.profile,profile);return r});
// an 800 x 450 picture
const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=800;c.height=450;const g=c.getContext('2d');g.fillStyle='#e8eef5';g.fillRect(0,0,800,450);g.fillStyle='#1f3b57';g.fillRect(0,0,800,60);g.fillStyle='#fff';g.font='bold 28px Segoe UI';g.fillText('Account settings',24,40);return c.toDataURL().split(',')[1]});
const fixture=path.join(out,'Settings page.png');fs.writeFileSync(fixture,Buffer.from(png,'base64'));
await page.locator('#file').setInputFiles(fixture);await page.waitForFunction(()=>document.querySelector('#cv')?.width>=800);await page.waitForTimeout(400);
const box=await page.locator('#cv').boundingBox(),cx=box.x+box.width/2,cy=box.y+box.height/2;
// draw an arrow (it stays selected)
await page.locator('#cv').click({position:{x:5,y:5}});await page.keyboard.press('a');await page.mouse.move(cx-120,cy+40);await page.mouse.down();for(let i=1;i<=10;i++)await page.mouse.move(cx-120+i*20,cy+40-i*6);await page.mouse.up();await page.waitForTimeout(200);
await test('Right-click > Copy image puts the whole finished picture on the clipboard, with no text',async()=>{await app.evaluate(({clipboard})=>clipboard.writeText('old clipboard'));await page.mouse.click(cx+60,cy-10,{button:'right'});
  await page.locator('.capture-menu button[aria-label="Copy image"]').click();await page.waitForTimeout(400);const c=await clip();assert.ok(!c.empty,'no image');assert.equal(c.w+'x'+c.h,'800x450');assert.equal(c.text,'','text on the clipboard: '+c.text.slice(0,60));return c});
await test('Ctrl+C on a selected arrow copies a picture of it and no JSON text',async()=>{/* the right-click above selected the arrow */await app.evaluate(({clipboard})=>clipboard.writeText('old clipboard'));
  await page.keyboard.press('Control+c');await page.waitForTimeout(500);const c=await clip();assert.ok(!c.empty,'no image');assert.ok(c.w<800&&c.h<450,'whole picture copied: '+c.w+'x'+c.h);assert.ok(!/magic|Saveit editable/.test(c.text),'JSON on the clipboard');assert.equal(c.text,'');return c});
await test('Ctrl+V in Saveit pastes that arrow back as an editable object',async()=>{await clearToast();await page.keyboard.press('Control+v');await toastIs(/Pasted 1 editable annotation/);return await page.locator('.toast').textContent()});
await test('A picture copied from another app pastes as a picture, not as the arrow',async()=>{const before=await page.evaluate(()=>+document.body.dataset.catalogCount);
  await app.evaluate(({clipboard,nativeImage})=>{const w=320,h=200,b=Buffer.alloc(w*h*4);for(let i=0;i<w*h;i++){b[i*4]=200;b[i*4+1]=60;b[i*4+2]=40;b[i*4+3]=255}clipboard.writeImage(nativeImage.createFromBitmap(b,{width:w,height:h}))});
  await clearToast();await page.keyboard.press('Control+v');await page.waitForTimeout(1500);const t=await page.evaluate(()=>document.querySelector('.toast')?.textContent||''),after=await page.evaluate(()=>+document.body.dataset.catalogCount);
  assert.ok(!/annotation/.test(t),'pasted as annotations: '+t);assert.ok(after>before||/Pasted|picture|library/i.test(t),'nothing pasted: '+t);return{toast:t,before,after}});
await test('Annotations copied by an older Saveit (JSON text) still paste as editable objects',async()=>{const shapes=[{id:1,t:'rect',x1:40,y1:40,x2:140,y2:100,c:'#e5483b',w:4}];
  await app.evaluate(({clipboard},text)=>clipboard.writeText(text),JSON.stringify({magic:'Saveit editable annotations v1',shapes}));await clearToast();await page.keyboard.press('Control+v');await toastIs(/Pasted 1 editable annotation/)});
await test('Library: copying one selected image puts the picture on the clipboard',async()=>{await page.keyboard.press('Escape');await app.evaluate(({clipboard})=>clipboard.writeText('old clipboard'));
  await page.locator('#libBtn').click();await page.waitForSelector('#libGrid .card:not(.fold):not(.newfo)');await page.locator('#libGrid input.pick[aria-label="Select Settings page"]').first().check();await page.waitForTimeout(200);
  await page.keyboard.press('Control+c');await page.waitForTimeout(800);const c=await clip();assert.ok(!c.empty,'no image on the clipboard');assert.equal(c.w+'x'+c.h,'800x450');assert.equal(c.text,'');return c});
await test('Library: copying two items keeps the copy-between-folders message and Paste',async()=>{const picks=page.locator('#libGrid input.pick');await picks.nth(0).check();await picks.nth(1).check();await clearToast();await page.keyboard.press('Control+c');await toastIs(/Copied 2 items. Paste in a Saveit folder/);return await page.locator('.toast').textContent()});
results.push({name:'No native renderer errors',pass:errors.length===0,errors});
}finally{fs.writeFileSync(path.join(out,'native-clipboard1110-results.json'),JSON.stringify({passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,results},null,2));try{await app.evaluate(({app})=>app.isQuitting=true);await app.close()}catch(_){}}process.exitCode=results.some(r=>!r.pass)?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
