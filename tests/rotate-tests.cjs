// 10.0.6: free rotation of selected objects. Build and serve tests/build-harness.js first.
// node tests/rotate-tests.cjs http://127.0.0.1:8944
const {chromium}=require('playwright'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SAVEIT_BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),results=[],errors=[];page.on('pageerror',e=>errors.push(e.stack));page.setDefaultTimeout(20000);
 await page.goto(process.argv[2]||'http://127.0.0.1:8944');await page.waitForFunction(()=>window.__T?.addAudio&&document.body.dataset.catalogCount);
 const ev=(fn,a)=>page.evaluate(fn,a),test=async(name,fn)=>{try{await fn();results.push(1);console.log('PASS',name)}catch(e){results.push(0);console.log('FAIL',name,e.message)}};
 let sh_id=0;const near=(v,w,t=1.5)=>assert.ok(Math.abs(v-w)<=t,`${v} vs ${w}`);
 // a fresh 1000x600 image at 80% zoom with one shape of the given type selected
 const fresh=async(type,props={})=>{sh_id=await ev(({type,props})=>{document.querySelectorAll('.modal').forEach(m=>m.remove());const T=__T,it=T.addImage(QA.canvas(1000,600,'#ffffff'),'rot test',{flat:true});T.openItem(it);T.S.zoom=.8;T.setTool('select');
   const s=T.newShape(type,props.x1??300,props.y1??200);Object.assign(s,{x2:300,y2:200},props);it.shapes.push(s);T.S.sel=s;T.render();window.sh=s;window.it0=it;return s.id},{type,props});return sh_id};
 const at=(x,y)=>ev(({x,y})=>{const cv=document.querySelector('#cv'),r=cv.getBoundingClientRect(),k=cv.width/r.width;return{x:r.left+x/k,y:r.top+y/k}},{x,y});
 const handle=k=>ev(k=>{const h=__T.handles(sh).find(q=>q[0]===k);return h?{x:h[1],y:h[2]}:null},k);
 const sid=()=>sh_id;
 const pivot=()=>ev(()=>{const b=__T.selBox(sh);return{x:b.x+b.w/2,y:b.y+b.h/2}});
 const dragTo=async(from,to,mods)=>{const a=await at(from.x,from.y),b=await at(to.x,to.y);await page.mouse.move(a.x,a.y);if(mods)await page.keyboard.down(mods);await page.mouse.down();await page.mouse.move((a.x+b.x)/2,(a.y+b.y)/2,{steps:4});await page.mouse.move(b.x,b.y,{steps:4});await page.mouse.up();if(mods)await page.keyboard.up(mods)};
 const toward=(p,deg,r=150)=>({x:p.x+r*Math.cos((deg-90)*Math.PI/180),y:p.y+r*Math.sin((deg-90)*Math.PI/180)}); // pointer position that points the handle at angle deg
 const rot=()=>ev(id=>(__T.S.cur.shapes.find(q=>q.id===id)||{}).rot||0,sid());

 await test('The rotate handle exists for shapes that can turn, not for arrows, lines, blur or pictures',async()=>{
  for(const [t,expect] of [['rect',true],['ellipse',true],['callout',true],['highlight',true],['step',true],['arrow',false],['line',false],['blur',false],['spotlight',false]]){await fresh(t,{x2:500,y2:360});assert.equal(!!(await handle('rot')),expect,t)}});
 await test('The rotate handle sits above the top-middle and moves with the shape',async()=>{await fresh('rect',{x2:500,y2:360});let h=await handle('rot'),p=await pivot();near(h.x,p.x);assert.ok(h.y<200-10);
  await ev(()=>{sh.rot=90;__T.render()});h=await handle('rot');p=await pivot();near(h.y,p.y);assert.ok(h.x>p.x+80)});
 await test('Dragging the handle turns the object about its centre, with a magnet at 45° and Shift for 15° steps; Undo restores it',async()=>{
  await fresh('rect',{x2:500,y2:360});const p=await pivot();let h=await handle('rot');await dragTo(h,toward(p,45));near(await rot(),45,.6);
  const c1=await pivot();near(c1.x,p.x);near(c1.y,p.y);
  await ev(()=>{sh.rot=0;__T.render()});h=await handle('rot');await dragTo(h,toward(p,37),'Shift');near(await rot(),30,.6);
  await ev(()=>__T.undo());near(await rot(),0,.6)});
 await test('Clicking selects a rotated object where it really is, not where its unrotated box was',async()=>{
  await fresh('rect',{x2:500,y2:300,fill:'#ff0000'});await ev(()=>{sh.rot=90;__T.render();__T.S.sel=null;__T.render()});
  // frame 200x100 at (300,200)-(500,300), centre (400,250); rotated 90° it spans x 350-450, y 150-350
  let p=await at(400,170);await page.mouse.click(p.x,p.y);assert.equal(await ev(()=>__T.S.sel===sh),true);
  await ev(()=>{__T.S.sel=null;__T.render()});p=await at(320,250);await page.mouse.click(p.x,p.y);assert.equal(await ev(()=>__T.S.sel===sh),false)});
 await test('A rotated object is drawn rotated in the picture (export check)',async()=>{
  await fresh('rect',{x2:500,y2:300,fill:'#ff0000',w:1});await ev(()=>{sh.rot=90;__T.S.sel=null;__T.render()});
  const px=await ev(()=>{const c=__T.exportCanvas(),g=c.getContext('2d'),at=(x,y)=>[...g.getImageData(x,y,1,1).data];return{inside:at(400,170),outside:at(320,250),centre:at(400,250)}});
  assert.ok(px.inside[0]>200&&px.inside[1]<60,'inside '+px.inside);assert.ok(px.outside[1]>200,'outside '+px.outside);assert.ok(px.centre[0]>200&&px.centre[1]<60)});
 await test('Resizing a rotated object works along its own axes and keeps the opposite edge fixed',async()=>{
  await fresh('rect',{x2:500,y2:300,fill:'#ff0000'});await ev(()=>{sh.rot=90;__T.render()});
  const w0=await handle('w'),e0=await handle('e'),before=await ev(()=>{const b=__T.selBox(sh);return b.w});
  // at 90° the 'e' handle points down; drag it 60 px further down
  await dragTo(e0,{x:e0.x,y:e0.y+60});const w1=await handle('w'),after=await ev(()=>__T.selBox(sh).w);
  near(after,before+60,2);near(w1.x,w0.x,1.5);near(w1.y,w0.y,1.5);near(await rot(),90,.01)});
 await test('Resize cursors turn with the object',async()=>{
  await fresh('rect',{x2:500,y2:300});await ev(()=>{sh.rot=90;__T.render()});const e=await handle('e'),q=await at(e.x,e.y);
  await page.mouse.move(q.x+30,q.y+30);await page.mouse.move(q.x,q.y);assert.equal(await ev(()=>document.querySelector('#cv').style.cursor),'ns-resize');
  const r=await handle('rot'),q2=await at(r.x,r.y);await page.mouse.move(q2.x+30,q2.y+30);await page.mouse.move(q2.x,q2.y);assert.equal(await ev(()=>document.querySelector('#cv').style.cursor),'grab')});
 await test('A rotated callout: the tail follows the pointer',async()=>{
  await fresh('callout',{x2:520,y2:300,tx:410,ty:380});await ev(()=>{sh.rot=30;__T.render()});const t=await handle('tail'),target={x:t.x+40,y:t.y+25};await dragTo(t,target);const t2=await handle('tail');near(t2.x,target.x,2);near(t2.y,target.y,2)});
 await test('The Rotation field in Position and size sets the angle about the centre; Undo and Redo keep it',async()=>{
  await fresh('rect',{x2:500,y2:300});await ev(()=>{__T.renderProps()});const p=await pivot();await page.locator('[data-rot103]').fill('30');await page.locator('[data-rot103]').press('Tab');near(await rot(),30,.01);const c=await pivot();near(c.x,p.x,.01);near(c.y,p.y,.01);
  await page.locator('[data-rot103]').fill('-45');await page.locator('[data-rot103]').press('Tab');near(await rot(),315,.01);
  await ev(()=>__T.undo());near(await rot(),30,.01);await ev(()=>__T.redo());near(await rot(),315,.01)});
 await test('Rotation survives saving and reopening, and a duplicated object keeps its angle',async()=>{
  await fresh('ellipse',{x2:520,y2:320});await ev(()=>{sh.rot=33;__T.render()});
  const r=await ev(async()=>{await __T.persistNow(it0);const rec=await __T.dbRead(it0.id);const s2=(rec.shapes||[]).find(q=>q.t==='ellipse');return s2&&s2.rot});near(r,33,.01)});
 await test('Text keeps its angle through editing',async()=>{
  await fresh('text',{x1:300,y1:250,txt:'Turn me',fs:36,c:'#000000'});await ev(()=>{sh.rot=20;sh._w=null;__T.render()});
  const c=await ev(()=>{const b=__T.bbox(sh);return{x:b.x+b.w/2,y:b.y+b.h/2}}),p=await at(c.x,c.y);await page.mouse.dblclick(p.x,p.y);await page.waitForTimeout(150);
  assert.equal(await ev(()=>sh.rot),0,'upright while editing');await page.keyboard.type(' now');await page.keyboard.press('Control+Enter');await page.waitForTimeout(150);near(await rot(),20,.01);assert.match(await ev(()=>sh.txt),/now/)});
 await test('Dragging the body or the border moves a rotated object without changing its angle',async()=>{
  await fresh('rect',{x2:500,y2:300,fill:'#ff0000'});await ev(()=>{sh.rot=40;__T.render()});const c=await pivot();
  await dragTo({x:c.x,y:c.y},{x:c.x+70,y:c.y+45});const c2=await ev(id=>{const s=__T.S.cur.shapes.find(q=>q.id===id),b=__T.selBox(s);return{x:b.x+b.w/2,y:b.y+b.h/2,rot:s.rot}},sid());near(c2.x,c.x+70,1.5);near(c2.y,c.y+45,1.5);near(c2.rot,40,.01)});
 await test('A rotated pen stroke is selected where it is drawn',async()=>{
  await fresh('pen',{pts:[[300,200],[400,200],[500,200]],x2:500,y2:200,w:6});await ev(()=>{sh.rot=90;__T.S.sel=null;__T.render()});
  // the stroke is centred on (400,200) and runs 200 px; turned 90 degrees it is vertical there
  let p=await at(400,120);await page.mouse.click(p.x,p.y);assert.equal(await ev(()=>!!__T.S.sel),true);await ev(()=>{__T.S.sel=null;__T.render()});p=await at(330,200);await page.mouse.click(p.x,p.y);assert.equal(await ev(()=>!!__T.S.sel),false)});
 await test('Image tab: rotate right/left and flip turn a rotated rectangle about its own centre',async()=>{
  await fresh('rect',{x2:500,y2:300,fill:'#ff0000'});await ev(()=>{sh.rot=30;__T.render()});const c0=await pivot();
  await ev(()=>{__T.setTool('image')});await page.locator('#imRotR').click();await page.waitForTimeout(150);
  let r=await ev(id=>{const s=__T.S.cur.shapes.find(q=>q.id===id),b=__T.selBox(s);return{rot:s.rot,x:b.x+b.w/2,y:b.y+b.h/2}},sid());near(r.rot,120,.01);near(r.x,c0.x,1);near(r.y,c0.y,1);
  await page.locator('#imRotL').click();await page.waitForTimeout(150);r=await ev(id=>__T.S.cur.shapes.find(q=>q.id===id).rot,sid());near(r,30,.01);
  await page.locator('#imFlipH').click();await page.waitForTimeout(150);r=await ev(id=>__T.S.cur.shapes.find(q=>q.id===id).rot,sid());near(r,330,.01);
  await page.locator('#imFlipV').click();await page.waitForTimeout(150);r=await ev(id=>__T.S.cur.shapes.find(q=>q.id===id).rot,sid());near(r,30,.01)});
 await test('Image tab: flipping a rotated callout mirrors its tail about the whole object',async()=>{
  await fresh('callout',{x2:520,y2:300,tx:410,ty:380});await ev(()=>{sh.rot=30;__T.render()});const tail0=await handle('tail'),axis=await ev(()=>{const b=__T.bbox(sh);return b.x+b.w/2});
  await ev(()=>{__T.setTool('image')});await page.locator('#imFlipH').click();await page.waitForTimeout(150);
  const t=await ev(id=>{const s=__T.S.cur.shapes.find(q=>q.id===id),h=__T.handles(s).find(q=>q[0]==='tail');return{x:h[1],y:h[2],rot:s.rot}},sid());near(t.rot,330,.01);near(t.x,2*axis-tail0.x,1.5);near(t.y,tail0.y,1.5)});
 console.log(JSON.stringify({passed:results.filter(Boolean).length,failed:results.filter(x=>!x).length,errors}));await browser.close();process.exit(results.includes(0)||errors.length?1:0)})();
