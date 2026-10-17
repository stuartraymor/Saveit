// 10.0.9: checks that need the real Electron main process. Uses a disposable profile (SAVEIT_REVIEW_DATA).
// node tests/native-stepguide.cjs <path-to-electron.exe> <path-to-app-folder> <scratch-folder>
const {_electron}=require('playwright'),path=require('path'),fs=require('fs'),assert=require('assert/strict');
(async()=>{const [exe,appDir,out]=process.argv.slice(2);const prof=path.join(out,'profile-sg');fs.mkdirSync(prof,{recursive:true});
 const app=await _electron.launch({executablePath:exe,args:[appDir],env:{...process.env,SAVEIT_REVIEW_DATA:prof}});
 const w=await app.firstWindow(),errs=[];w.on('pageerror',e=>errs.push(String(e)));await w.waitForSelector('#cv',{timeout:30000});await w.waitForTimeout(1500);
 const results=[],test=async(name,fn)=>{try{await fn();results.push(1);console.log('PASS',name)}catch(e){results.push(0);console.log('FAIL',name,e.message)}};

 await test('print-pdf returns real PDF bytes with embedded fonts (searchable text) when asked for the buffer',async()=>{
  const r=await w.evaluate(async()=>{const html='<!doctype html><html><head><meta charset="utf-8"><style>@page{size:Letter;margin:.6in}body{font-family:Segoe UI,Arial}</style></head><body><h1>Searchable heading</h1><p>Some step text to find.</p></body></html>';const b=await window.bench.printPdf(html,'x.pdf',true);return{type:Object.prototype.toString.call(b),len:b&&b.length,head:[...(b||[]).slice(0,5)].map(c=>String.fromCharCode(c)).join(''),text:new TextDecoder('latin1').decode(b||new Uint8Array())}});
  assert.ok(r.len>1000,'length '+r.len);assert.equal(r.head,'%PDF-');assert.ok(/\/Font|\/BaseFont/.test(r.text),'embedded fonts')});
 await test('reveal-file ignores relative, missing and non-string paths and accepts the main window only',async()=>{
  const r=await w.evaluate(async()=>{const o=[];for(const p of ['relative.txt','C:\\no\\such\\file.txt',42,null,undefined])o.push(await window.bench.revealFile(p));return o});assert.deepEqual(r,[undefined,undefined,undefined,undefined,undefined])});
 await test('The Save window opens at the previous file when the name is a full path; plain names still go to the usual folder',async()=>{
  await app.evaluate(({dialog})=>{global.__sd=[];dialog.showSaveDialog=async(win,o)=>{global.__sd.push(o);return{canceled:true}}});
  await w.evaluate(async()=>{await window.bench.savePick('C:\\Users\\Someone\\Documents\\old guide',['pdf','docx']);await window.bench.savePick('plain name',['png'])});
  const sd=await app.evaluate(()=>global.__sd);assert.equal(sd[0].defaultPath,'C:\\Users\\Someone\\Documents\\old guide.pdf');assert.equal(sd[0].filters[0].extensions[0],'pdf');assert.ok(/plain name\.png$/.test(sd[1].defaultPath)&&!/Someone/.test(sd[1].defaultPath))});
 await test('Library Save starts in Documents for documents and in Pictures for pictures',async()=>{
  await app.evaluate(({dialog})=>{global.__od=[];dialog.showOpenDialog=async(win,o)=>{global.__od.push(o.defaultPath);return{canceled:true,filePaths:[]}}});
  await w.evaluate(async()=>{await window.bench.saveMany([{name:'a.docx',data:new Uint8Array([1])},{name:'b.pdf',data:new Uint8Array([1])}]);await window.bench.saveMany([{name:'a.png',data:new Uint8Array([1])}])});
  const od=await app.evaluate(()=>global.__od);assert.ok(/Documents$/i.test(od[0]),od[0]);assert.ok(/Pictures$/i.test(od[1]),od[1])});
 await test('A window whose opacity is 0 is not in a screen capture (the basis of the step-bar fix)',async()=>{
  const r=await app.evaluate(async({BrowserWindow,desktopCapturer,screen})=>{const d=screen.getPrimaryDisplay(),b=d.bounds,sf=d.scaleFactor;
   const win=new BrowserWindow({x:b.x+20,y:b.y+20,width:200,height:200,frame:false,show:false,alwaysOnTop:true,focusable:false,skipTaskbar:true});
   await win.loadURL('data:text/html,<body style="margin:0;background:%23ff0000"></body>');win.setContentProtection(true);win.showInactive();
   const sleep=ms=>new Promise(r=>setTimeout(r,ms)),px=async()=>{const s=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:Math.round(b.width*sf),height:Math.round(b.height*sf)}});const t=(s.find(q=>String(q.display_id)===String(d.id))||s[0]).thumbnail,sz=t.getSize(),buf=t.toBitmap(),x=Math.round(120*sf),y=Math.round(120*sf),o=(y*sz.width+x)*4;return[buf[o+2],buf[o+1],buf[o]]};
   await sleep(500);const visible=await px();win.setOpacity(0);await sleep(60);const hidden=await px();win.setOpacity(1);await sleep(60);const back=await px();win.destroy();return{visible,hidden,back}});
  const isRed=p=>p[0]>200&&p[1]<80&&p[2]<80;console.log('   capture samples (r,g,b):',JSON.stringify(r));assert.ok(!isRed(r.hidden),'hidden window still captured');assert.ok(isRed(r.visible),'baseline: visible window is captured');assert.ok(isRed(r.back),'window is back after opacity 1')});
 await test('Step Capture starts saveit-steps.exe (not PowerShell) and Stop ends it',async()=>{
  const {execSync}=require('child_process'),running=n=>{try{return execSync('tasklist /FI "IMAGENAME eq '+n+'" /NH',{encoding:'utf8'}).toLowerCase().includes(n.toLowerCase())}catch(e){return false}};
  assert.equal(running('saveit-steps.exe'),false,'no helper before');
  await w.evaluate(()=>window.bench.startSteps(0));await new Promise(r=>setTimeout(r,2000));assert.equal(running('saveit-steps.exe'),true,'helper running during Step Capture');
  await app.evaluate(({ipcMain})=>ipcMain.emit('steps-cmd',{},'stop'));await new Promise(r=>setTimeout(r,1500));assert.equal(running('saveit-steps.exe'),false,'helper ended after Stop')});
 console.log(JSON.stringify({passed:results.filter(Boolean).length,failed:results.filter(x=>!x).length,errs}));await app.close();process.exit(results.includes(0)||errs.length?1:0)})().catch(e=>{console.log('FAIL',e.message);process.exit(1)});
