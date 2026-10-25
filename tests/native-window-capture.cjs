// Native still-image regression using a separate owned window process.
// node tests/native-window-capture.cjs <owned-review-exe> <evidence-dir> [capture-scale]
const {_electron}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{
 const exe=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]),source=path.resolve(__dirname,'../app'),runtime=path.dirname(exe),dest=path.join(runtime,'resources/app');
 assert.ok(!exe.toLowerCase().includes('appdata\\local\\programs\\saveit\\'),'Use a disposable runtime');assert.ok(!out.startsWith(runtime+path.sep),'Evidence must be outside the runtime');assert.notEqual(source,dest);
 fs.mkdirSync(out,{recursive:true});fs.cpSync(source,dest,{recursive:true});
 let main=fs.readFileSync(path.join(dest,'main.js'),'utf8');if(process.env.SAVEIT_TEST_VIDEO_BASELINE)main=main.replace("  if (process.platform === 'win32') return require('./window-capture.js').captureWindow(desktopCapturer, id);",'');
 fs.writeFileSync(path.join(dest,'main.js'),main+'\r\nglobalThis.__captureReview={grabWindow};\r\n');
 const fixtureRoot=path.join(out,'fixture-runtime');fs.cpSync(runtime,fixtureRoot,{recursive:true,filter:p=>p!==path.join(runtime,'resources')});fs.mkdirSync(path.join(fixtureRoot,'resources/app'),{recursive:true});
 fs.writeFileSync(path.join(fixtureRoot,'resources/app/package.json'),JSON.stringify({name:'native-window-fixture',version:'1.0.0',main:'main.js'}));
 fs.writeFileSync(path.join(fixtureRoot,'resources/app/main.js'),`const {app,BrowserWindow}=require('electron');app.setPath('userData',process.env.SAVEIT_REVIEW_DATA);app.whenReady().then(()=>{const w=new BrowserWindow({width:285,height:171,frame:false});w.loadURL('data:text/html,'+encodeURIComponent('<title>Native odd window fixture</title><body style="margin:0"><canvas id="c"></canvas><script>window.paint=()=>{c.width=innerWidth;c.height=innerHeight;const g=c.getContext("2d");g.fillStyle="rgb(24,48,72)";g.fillRect(0,0,c.width,c.height);for(let x=0;x<c.width;x++){g.fillStyle=x%2?"white":"black";g.fillRect(x,10,1,1)}g.fillStyle="white";g.fillRect(c.width-1,0,1,c.height);g.fillStyle="white";g.fillRect(0,c.height-1,c.width,1);g.fillStyle="black";g.fillRect(c.width-1,c.height-1,1,1)};addEventListener("resize",paint);paint()</script>'))});`);
 let fixture,app;const results=[];
 try{
  fixture=await _electron.launch({executablePath:path.join(fixtureRoot,path.basename(exe)),args:['--force-device-scale-factor=1'],env:{...process.env,SAVEIT_REVIEW_DATA:path.join(out,'fixture-profile')}});const f=await fixture.firstWindow();await f.waitForFunction(()=>window.paint);
  app=await _electron.launch({executablePath:exe,args:process.argv[4]?['--force-device-scale-factor='+process.argv[4]]:[],env:{...process.env,SAVEIT_REVIEW_DATA:path.join(out,'capture-profile')},timeout:30000});const p=await app.firstWindow();
  for(const [width,height] of [[285,171],[285,170],[286,171],[286,172],[570,340],[900,520]]){
   await fixture.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setSize(...size),[width,height]);await f.waitForFunction(([w,h])=>innerWidth===w&&innerHeight===h,[width,height]);await f.evaluate(()=>paint());await p.waitForTimeout(200);
   const result=await app.evaluate(async({desktopCapturer})=>{
    const src=(await desktopCapturer.getSources({types:['window'],thumbnailSize:{width:0,height:0}})).find(s=>s.name==='Native odd window fixture');if(!src)throw Error('Owned test window not found');
    const image=await globalThis.__captureReview.grabWindow(src.id),size=image.getSize(),bitmap=image.toBitmap();const rgb=(x,y)=>{const i=(y*size.width+x)*4;return[bitmap[i+2],bitmap[i+1],bitmap[i]]};
    return{size,png:image.toPNG().toString('base64'),right:rgb(size.width-1,20),bottom:rgb(20,size.height-1),corner:rgb(size.width-1,size.height-1),stripes:Array.from({length:80},(_,x)=>rgb(x+10,10))};
   });
   fs.writeFileSync(path.join(out,`${width}x${height}.png`),Buffer.from(result.png,'base64'));delete result.png;results.push({expected:{width,height},...result});assert.deepEqual(result.size,{width,height});assert.deepEqual(result.right,[255,255,255]);assert.deepEqual(result.bottom,[255,255,255]);assert.deepEqual(result.corner,[0,0,0]);result.stripes.forEach((rgb,i)=>assert.deepEqual(rgb,(i+10)%2?[255,255,255]:[0,0,0]));console.log('PASS exact dimensions, last row/column and one-pixel stripes',width,height);
  }
 }finally{
  fs.writeFileSync(path.join(out,'capture-results.json'),JSON.stringify(results,null,2));if(app){await app.evaluate(({app})=>app.isQuitting=true);await app.close()}if(fixture)await fixture.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1});
