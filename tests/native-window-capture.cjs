// Uses an owned runtime copy only. Never pass the installed runtime.
// node tests/native-window-capture.cjs <review-exe> <evidence-dir> [scale]
const {_electron}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{
 const exe=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]),source=path.resolve(__dirname,'../app');
 assert.ok(!exe.toLowerCase().includes('appdata\\local\\programs\\saveit\\'),'Use a disposable runtime');
 const dest=path.join(path.dirname(exe),'resources/app');assert.notEqual(dest,source);fs.mkdirSync(out,{recursive:true});fs.cpSync(source,dest,{recursive:true});
 fs.appendFileSync(path.join(dest,'main.js'),'\r\nglobalThis.__captureReview={grabWindow};\r\n');
 const app=await _electron.launch({executablePath:exe,args:process.argv[4]?['--force-device-scale-factor='+process.argv[4]]:[],env:{...process.env,SAVEIT_REVIEW_DATA:path.join(out,'profile-'+Date.now())},timeout:30000});
 try {
  await app.firstWindow();
  const results=await app.evaluate(async({BrowserWindow,screen})=>{
   const scale=screen.getPrimaryDisplay().scaleFactor,results=[];
   for(const [w,h] of (scale===1?[[570,340],[900,520]]:[[285,170],[450,260]])){
    const fixture=new BrowserWindow({width:w,height:h,frame:false,show:true,webPreferences:{contextIsolation:true}});
    try{await fixture.loadURL('data:text/html,<body style="background:white;font:20px monospace">Native window proof 42</body>');await new Promise(r=>setTimeout(r,400));const image=await globalThis.__captureReview.grabWindow(fixture.getMediaSourceId());results.push({logical:[w,h],scale,size:image.getSize()});}finally{fixture.destroy()}
   }return results;
  });
  for(const r of results){assert.equal(r.size.width,r.logical[0]*r.scale);assert.equal(r.size.height,r.logical[1]*r.scale)}
  fs.writeFileSync(path.join(out,'capture-results.json'),JSON.stringify(results,null,2));console.log('PASS native window dimensions',JSON.stringify(results));
 }finally{await app.evaluate(({app})=>app.isQuitting=true);await app.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
