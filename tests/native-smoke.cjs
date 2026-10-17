// Uses the installed Electron runtime with this checkout and a disposable profile.
// Does not install, close the user's app, record devices, or write user media.
const {_electron}=require('playwright'),path=require('path'),fs=require('fs'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]),runtime=process.env.SAVEIT_ELECTRON_PATH;
if(!runtime)throw Error('SAVEIT_ELECTRON_PATH must name a separate review runtime with resources/app copied from this checkout.');
(async()=>{
 const profile=path.join(out,'native-profile-'+Date.now()),app=await _electron.launch({executablePath:runtime,args:[path.join(root,'app')],env:{...process.env,SAVEIT_REVIEW_DATA:profile},timeout:30000});
 const results=[],check=(name,ok,detail)=>{results.push({name,pass:!!ok,detail});assert.ok(ok,name)};
 try{
  const page=await app.firstWindow();await page.waitForFunction(()=>window.bench&&document.querySelector('[data-t="cutout"]'));await page.waitForTimeout(500);
  const identity=await app.evaluate(({app})=>({version:app.getVersion(),profile:app.getPath('userData'),app:app.getAppPath()}));
  check('Native runtime uses the current package version',identity.version===require('../app/package.json').version,identity);
  check('Native profile is disposable',path.resolve(identity.profile)===profile,identity.profile);
  check('Native application files match this checkout',fs.readFileSync(path.join(identity.app,'index.html'),'utf8')===fs.readFileSync(path.join(root,'app','index.html'),'utf8'),identity.app);
  check('Real preload bridge reports 9.9.2',await page.evaluate(()=>window.bench.appVersion())==='9.9.2');
  await page.locator('#file').setInputFiles(path.join(out,'native-fixture.png'));await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('800 × 450'));
  await page.locator('[data-t="cutout"]').click();
  const rect=await page.locator('#cv').boundingBox();await page.mouse.move(rect.x+rect.width*.2,rect.y+rect.height*.3);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.4,rect.y+rect.height*.34,{steps:6});await page.mouse.up();
  check('Native Cut Out waits for confirmation',!await page.locator('#cutApply').isDisabled()&&/800 × 450/.test(await page.locator('#status').textContent()));
  await page.screenshot({path:path.join(out,'native-cutout.png')});await page.locator('#cutCancel').click();
  await page.locator('[data-t="simplify"]').click();await page.locator('#smPct').fill('50');await page.locator('#smPct').press('Tab');
  check('Native Simplify links percentage and pixels',await page.locator('#smW').inputValue()==='400'&&await page.locator('#smH').inputValue()==='225');
  await page.screenshot({path:path.join(out,'native-simplify.png')});await page.locator('#smCancel').click();
  check('Native cancelled operations keep the original dimensions',/800 × 450/.test(await page.locator('#status').textContent()));
  await page.locator('[data-t="arrow"]').click();const r=await page.locator('#cv').boundingBox();await page.mouse.move(r.x+r.width*.2,r.y+r.height*.2);await page.mouse.down();await page.mouse.move(r.x+r.width*.6,r.y+r.height*.6,{steps:6});await page.mouse.up();
  check('Native Arrow creates an editable object',/Selected arrow/i.test(await page.locator('#props').textContent())&&/Annotations\s+1/.test(await page.locator('#status').textContent()));
  await page.screenshot({path:path.join(out,'native-editor.png')});
 }finally{fs.writeFileSync(path.join(out,'native-results.json'),JSON.stringify({passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,results},null,2));await app.evaluate(({app})=>{app.isQuitting=true});await app.close()}
 console.log(JSON.stringify({passed:results.length,failed:0}));
})().catch(e=>{console.error(e);process.exitCode=1});
