// Disposable-profile native check: visibility, movement, and Pause/Resume/Stop command wiring.
const {_electron}=require('playwright'),assert=require('assert/strict'),path=require('path');
(async()=>{
 const app=await _electron.launch({executablePath:process.env.SAVEIT_TEST_EXE,env:{...process.env,SAVEIT_REVIEW_DATA:process.argv[2]},timeout:30000});
 try {
  assert.equal(await app.evaluate(({app})=>app.getVersion()),'10.2.10');
  assert.equal(await app.evaluate(({app})=>app.getAppPath()),path.join(path.dirname(process.env.SAVEIT_TEST_EXE),'resources','app'));
  const p=await app.firstWindow();await p.waitForFunction(()=>window.bench?.recUI);
  await app.evaluate(({ipcMain})=>{global.testRecCommands=[];ipcMain.on('rec-cmd',(_e,c)=>global.testRecCommands.push(c))});
  await p.evaluate(()=>window.bench.recUI(true,{display:{x:0,y:0,w:1920,h:1080}},{mic:false,sys:false}));
  const bar=await app.waitForEvent('window',{predicate:w=>w.url().includes('recbar.html')}).catch(()=>null);
  const b=bar||app.windows().find(w=>w.url().includes('recbar.html'));assert.ok(b);await b.waitForSelector('#pause');await b.waitForTimeout(500);
  const movement=await app.evaluate(({BrowserWindow,screen})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('recbar.html'));const before=w.getBounds();const displays=screen.getAllDisplays(),d=displays.find(d=>d.bounds.x!==0||d.bounds.y!==0)||displays[0];const x=d.workArea.x+40,y=d.workArea.y+80;w.setPosition(x,y);return{visible:w.isVisible(),movable:w.isMovable(),before,after:w.getBounds(),target:{x,y},displays:displays.length}});
  assert.equal(movement.visible,true);assert.equal(movement.movable,true);assert.equal(movement.after.x,movement.target.x);assert.equal(movement.after.y,movement.target.y);
  assert.equal(await b.locator('.bar').evaluate(e=>getComputedStyle(e).webkitAppRegion),'drag');assert.equal(await b.locator('#pause').evaluate(e=>getComputedStyle(e).webkitAppRegion),'no-drag');
  await b.locator('#pause').click();await p.evaluate(()=>window.bench.recState('paused'));await b.getByRole('button',{name:'Resume',exact:true}).waitFor();await b.locator('#pause').click();await p.evaluate(()=>window.bench.recState('recording'));await b.getByRole('button',{name:'Pause',exact:true}).waitFor();await b.locator('#stop').click();await b.waitForTimeout(150);
  assert.deepEqual(await app.evaluate(()=>global.testRecCommands),['pause','pause','stop']);console.log('PASS visible movable bar, Pause/Resume/Stop',JSON.stringify(movement));await p.evaluate(()=>window.bench.recUI(false));
 }finally{await app.evaluate(({app})=>app.isQuitting=true);await app.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
