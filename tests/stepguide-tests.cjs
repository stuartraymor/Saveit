// 10.0.9: step-guide fixes (remembered Add step mode, Preparing / Saved messages, Save once per session,
// more guide formats, searchable PDF). Build and serve tests/build-harness.js first.
// node tests/stepguide-tests.cjs http://127.0.0.1:8944
const {chromium}=require('playwright'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SAVEIT_BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),results=[],errors=[];page.on('pageerror',e=>errors.push(e.stack));page.setDefaultTimeout(20000);
 await page.goto(process.argv[2]||'http://127.0.0.1:8944');await page.waitForFunction(()=>window.__T?.makeStep&&document.body.dataset.catalogCount);
 const ev=(fn,a)=>page.evaluate(fn,a),test=async(name,fn)=>{try{await fn();results.push(1);console.log('PASS',name)}catch(e){results.push(0);console.log('FAIL',name,e.message)}};
 // a guide with two steps, and a stub bridge that records what the app asks the desktop to do
 const guide=()=>ev(()=>{document.querySelectorAll('.modal,.toast').forEach(m=>m.remove());const T=__T,g=T.newGuide('Test guide');
   const a=T.makeStep(g,QA.canvas(400,300,'#ffffff'),{x:100,y:100});a.title='Click "Start"';a.text='Press the Start button.';
   const b=T.makeStep(g,QA.canvas(400,300,'#eeeeee'),{x:200,y:150});b.title='Open Settings';b.text='';
   window.bench.savePickCalls=[];window.bench.savePick=(name,exts)=>{window.bench.savePickCalls.push([name,[...exts]]);return Promise.resolve('C:\\docs\\'+(name.split('\\').pop())+'.'+exts[0])};
   window.bench.save=async(name,data,target)=>{window.__saved.push({name,path:target||('C:\\test\\'+name),size:data.byteLength,data});return target||('C:\\test\\'+name)};
   window.bench.printPdf=async(html,name,asBuf)=>{window.__pdfHtml=html;return asBuf?new Uint8Array([37,80,68,70]):'C:\\docs\\'+name};
   window.bench.revealFile=p=>{window.__revealed=p};__saved.length=0;window.g0=g;T.openItem(g);return g.id});
 const toastText=()=>ev(()=>[...document.querySelectorAll('.toast')].map(t=>t.textContent).join('|'));

 await test('Fix 2: the Add step mode (Region / Window / Full screen) survives the panel being rebuilt',async()=>{
  await guide();await page.locator('#gAddMode').selectOption('screen');assert.equal(await page.locator('#gAddMode').inputValue(),'screen');
  await ev(()=>__T.renderProps());assert.equal(await page.locator('#gAddMode').inputValue(),'screen');
  await ev(()=>__T.renderProps());assert.equal(await ev(()=>localStorage.getItem('saveit.guideAddMode')),'screen');
  await page.locator('#gAddMode').selectOption('region');await ev(()=>__T.renderProps());assert.equal(await page.locator('#gAddMode').inputValue(),'region')});
 await test('Fix 3: Preparing stays until replaced; Saved to has one Open folder button that reveals the file',async()=>{
  await guide();await ev(()=>__T.toast('Preparing the test…',0));await page.waitForTimeout(2200);assert.match(await toastText(),/Preparing the test/);
  await ev(()=>__T.saveBlob(new Blob(['x']),'t.png'));await page.waitForTimeout(150);const t=await toastText();assert.match(t,/Saved to/);assert.doesNotMatch(t,/Preparing/);
  assert.equal(await page.locator('.toast button:has-text("Open folder")').count(),1);await page.locator('.toast button:has-text("Open folder")').click();assert.match(await ev(()=>window.__revealed),/t\.png$/)});
 await test('Fix 3: Word export shows Preparing the Word document at once and then Saved to',async()=>{
  await guide();await page.locator('#gDocx').click();await page.waitForTimeout(100);assert.match(await toastText(),/Preparing the Word document/);
  await page.waitForFunction(()=>/Saved to/.test([...document.querySelectorAll('.toast')].map(t=>t.textContent).join('')));assert.ok((await ev(()=>__saved.at(-1).name)).endsWith('.docx'))});
 await test('Fix 3: cancelling the Save window clears the Preparing message',async()=>{
  await guide();await ev(()=>{window.bench.save=async()=>null;__T.toast('Preparing the test…',0)});await ev(()=>__T.saveBlob(new Blob(['x']),'t.png'));await page.waitForTimeout(150);assert.equal(await toastText(),'')});
 await test('Fix 4: the first Save of an item in a session asks where; the second writes over the file silently',async()=>{
  await guide();
  const r=await ev(async()=>{const T=__T,it=T.addImage(QA.canvas(300,200,'#ffffff'),'save once',{flat:true});T.openItem(it);window.bench.savePickCalls=[];
   await T.save();await new Promise(r=>setTimeout(r,300));const first=window.bench.savePickCalls.length;await T.save();await new Promise(r=>setTimeout(r,300));return{first,second:window.bench.savePickCalls.length}});
  assert.equal(r.first,1);assert.equal(r.second,1)});
 await test('Fix 4: an item saved in an earlier session asks again, at the old file with its type listed first',async()=>{
  await guide();
  const r=await ev(async()=>{const T=__T,it=T.addImage(QA.canvas(300,200,'#ffffff'),'older',{flat:true});T.openItem(it);it.savedPath='C:\\docs\\old report.jpg';window.bench.savePickCalls=[];await T.save();await new Promise(r=>setTimeout(r,300));return window.bench.savePickCalls[0]});
  assert.equal(r[0],'C:\\docs\\old report');assert.equal(r[1][0],'jpg')});
 await test('Fix 5: the guide panel has PowerPoint, PNG and JPG buttons that write those files',async()=>{
  await guide();for(const id of ['gPptx','gPng','gJpg','gDocx','gPdf','gSaveit'])assert.equal(await page.locator('#'+id).count(),1,id);
  await page.locator('#gPng').click();await page.waitForFunction(()=>__saved.length&&__saved.at(-1).name.endsWith('.png'));
  await page.locator('#gPptx').click();await page.waitForFunction(()=>__saved.at(-1).name.endsWith('.pptx'),null,{timeout:30000});assert.ok(await ev(()=>__saved.at(-1).size)>5000)});
 await test('Fix 6: PDF export builds a real-text page (headings, text, one block per step) and shows Saved to',async()=>{
  await guide();await ev(()=>{window.__pdfHtml=''});await page.locator('#gPdf').click();await page.waitForFunction(()=>window.__pdfHtml&&/Saved to/.test([...document.querySelectorAll('.toast')].map(t=>t.textContent).join('')));
  const html=await ev(()=>window.__pdfHtml);assert.match(html,/<h1>Test guide<\/h1>/);assert.match(html,/Click &quot;Start&quot;/);assert.match(html,/Open Settings/);assert.match(html,/Press the Start button\./);assert.equal((html.match(/class="st"/g)||[]).length,2);assert.match(html,/break-inside:avoid/)});
 // ---- native helper wording and typed text (10.0.10)
 await test('Step wording from the native helper: buttons, menus, right-click, and the old format unchanged',async()=>{
  const t=await ev(()=>{const w=i=>__T.stepTitleFrom(i).title;return{start:w({name:'Start',type:'button',ctype:50000,button:'left'}),menu:w({name:'Save as',type:'menu item',ctype:50011,menu:'File',button:'left'}),right:w({name:'Desktop',type:'pane',ctype:50033,button:'right'}),tab:w({name:'Insert',type:'tab item',ctype:50019}),box:w({name:'Address and search bar',type:'edit',ctype:50004}),old:w({name:'OK',type:'ControlType.Button',window:'Dialog'}),empty:w({name:'',type:'',ctype:0,window:''})}});
  assert.equal(t.start,'Click "Start"');assert.equal(t.menu,'Select "Save as" from the "File" menu');assert.equal(t.right,'Right-click "Desktop"');assert.equal(t.tab,'Open the "Insert" tab');assert.equal(t.box,'Click in the "Address and search bar" box');assert.equal(t.old,'Click "OK"');assert.equal(t.empty,'')});
 await test('Typed text becomes an instruction on the step that clicked the field; repeats and empty text are ignored',async()=>{
  await guide();const r=await ev(async()=>{const T=__T;T.stepGuide=g0;T.onStepType({field:'Search',text:'invoice 42'});await new Promise(r=>setTimeout(r,100));T.onStepType({field:'Search',text:'invoice 42'});T.onStepType({field:'x',text:'   '});T.onStepType({field:'',text:'hello'});await new Promise(r=>setTimeout(r,100));const last=g0.steps.at(-1),first=g0.steps[0];T.stepGuide=null;T.onStepType({field:'a',text:'ignored'});return{last:last.text,first:first.text}});
  assert.equal(r.last,'Type "invoice 42" in the "Search" box.\nType "hello".');assert.equal(r.first,'Press the Start button.')});
 console.log(JSON.stringify({passed:results.filter(Boolean).length,failed:results.filter(x=>!x).length,errors}));await browser.close();process.exit(results.includes(0)||errors.length?1:0)})();
