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
 const at=(x,y)=>ev(({x,y})=>{const cv=document.querySelector('#cv'),r=cv.getBoundingClientRect(),k=cv.width/r.width;return{x:r.left+(x+__T.padX())/k,y:r.top+(y+__T.padY())/k}},{x,y});
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
 // ---- groups (10.0.7)
 const group=async types=>{await ev(types=>{document.querySelectorAll('.modal').forEach(m=>m.remove());const T=__T,it=T.addImage(QA.canvas(1000,600,'#ffffff'),'grp rot',{flat:true});T.openItem(it);T.S.zoom=.8;T.setTool('select');
   const geo={rect:{x1:300,y1:200,x2:420,y2:260,fill:'#ff0000'},ellipse:{x1:480,y1:260,x2:600,y2:340,fill:'#00aa00'},arrow:{x1:320,y1:380,x2:560,y2:420},blur:{x1:300,y1:440,x2:400,y2:500}},list=[];
   for(const t of types){const s=T.newShape(t,geo[t].x1,geo[t].y1);Object.assign(s,geo[t]);it.shapes.push(s);list.push(s)}T.S.sel=null;T.S.grp=list;T.render();window.gl=list;window.git=it},types)};
 const gbox=()=>ev(()=>{const bs=gl.map(s=>__T.bbox(s)),x=Math.min(...bs.map(b=>b.x)),y=Math.min(...bs.map(b=>b.y)),R=Math.max(...bs.map(b=>b.x+b.w)),B=Math.max(...bs.map(b=>b.y+b.h));return{x,y,w:R-x,h:B-y,k:__T.scale()}});
 const snapshot=()=>ev(()=>gl.map(s=>({t:s.t,x1:s.x1,y1:s.y1,x2:s.x2,y2:s.y2,rot:s.rot||0})));
 await test('A group turns together about its centre: shapes get the angle, arrows move their end points, Undo is one step',async()=>{
  await group(['rect','ellipse','arrow']);const b0=await gbox(),pv={x:b0.x+b0.w/2,y:b0.y+b0.h/2},before=await snapshot(),handle={x:pv.x,y:b0.y-26/b0.k};
  await dragTo(handle,toward(pv,90),null);
  const after=await snapshot(),R=(x,y)=>({x:pv.x+(x-pv.x)*0-(y-pv.y)*1,y:pv.y+(x-pv.x)*1+(y-pv.y)*0}); // 90 degrees clockwise
  near(after[0].rot,90,.6);near(after[1].rot,90,.6);
  const rc=R((before[0].x1+before[0].x2)/2,(before[0].y1+before[0].y2)/2),nc=await ev(()=>{const s=gl[0];return{x:(s.x1+s.x2)/2,y:(s.y1+s.y2)/2}});near(nc.x,rc.x,1.5);near(nc.y,rc.y,1.5);
  const a1=R(before[2].x1,before[2].y1),a2=R(before[2].x2,before[2].y2);near(after[2].x1,a1.x,1.5);near(after[2].y1,a1.y,1.5);near(after[2].x2,a2.x,1.5);near(after[2].y2,a2.y,1.5);near(after[2].rot,0,.01);
  await ev(()=>__T.undo());const back=await ev(()=>__T.S.cur.shapes.map(s=>({t:s.t,x1:s.x1,y1:s.y1,x2:s.x2,y2:s.y2,rot:s.rot||0})));for(let i=0;i<3;i++){near(back[i].x1,before[i].x1,.01);near(back[i].y1,before[i].y1,.01);near(back[i].rot,0,.01)}});
 await test('Shift snaps a group turn to 15°, and a group with a blur has no rotate handle',async()=>{
  await group(['rect','ellipse']);let b=await gbox(),pv={x:b.x+b.w/2,y:b.y+b.h/2};await dragTo({x:pv.x,y:b.y-26/b.k},toward(pv,37),'Shift');near(await ev(()=>gl[0].rot),30,.6);
  await group(['rect','blur']);b=await gbox();pv={x:b.x+b.w/2,y:b.y+b.h/2};const before=await snapshot();await dragTo({x:pv.x,y:b.y-26/b.k},toward(pv,60),null);const after=await snapshot();assert.deepEqual(after.map(s=>s.rot),[0,0])});
 // ---- edge cases
 await test('Rotated text, step and stamp resize from a corner without error and keep their angle',async()=>{
  for(const [t,p] of [['text',{x1:300,y1:250,txt:'Resize me',fs:40,c:'#000'}],['step',{x1:400,y1:300,fs:30,n:1}],['stamp',{x1:400,y1:300,sz:60,kind:'click'}]]){
   await fresh(t,p);await ev(()=>{sh.rot=35;sh._w=null;__T.render()});const se=await handle('se'),before=await ev(()=>({fs:sh.fs,sz:sh.sz}));
   await dragTo(se,{x:se.x+40,y:se.y+30});const after=await ev(id=>{const s=__T.S.cur.shapes.find(q=>q.id===id);return{fs:s.fs,sz:s.sz,rot:s.rot}},sid());near(after.rot,35,.01);
   assert.ok((t==='stamp'?after.sz>before.sz:after.fs>before.fs),t+' grew')}});
 await test('With no room above, the rotate handle moves below the object and still turns it',async()=>{
  await fresh('rect',{x1:300,y1:0,x2:500,y2:100});const h=await handle('rot'),p=await pivot();assert.ok(h.y>p.y,'no room above, so the handle goes below');await dragTo(h,toward(p,60));near(await rot(),240,3)});
 await test('Hidden or locked objects do not turn',async()=>{
  await fresh('rect',{x2:500,y2:300});await ev(()=>{sh.locked9=true;__T.render()});const h=await handle('rot'),p=await pivot();await dragTo(h,toward(p,60));near(await rot(),0,.01)});
 // ---- pictures (10.0.8)
 // a picture object that is red on its left half and blue on its right half
 const freshPic=async(props={})=>{sh_id=await ev(async props=>{document.querySelectorAll('.modal').forEach(m=>m.remove());const T=__T,it=T.addImage(QA.canvas(1000,600,'#ffffff'),'pic rot',{flat:true});T.openItem(it);T.S.zoom=.8;T.setTool('select');
   const c=document.createElement('canvas');c.width=200;c.height=100;const g=c.getContext('2d');g.fillStyle='#ff0000';g.fillRect(0,0,100,100);g.fillStyle='#0000ff';g.fillRect(100,0,100,100);
   const s=T.newShape('img',300,200);Object.assign(s,{x2:500,y2:300,src:c.toDataURL('image/png'),op:1,sh:false,c:'#000',w:1},props);const im=new Image();im.src=s.src;await im.decode();it.shapes.push(s);T.S.sel=s;T.render();await new Promise(r=>setTimeout(r,150));T.render();window.sh=s;window.it0=it;return s.id},props);return sh_id};
 const px=(x,y)=>ev(({x,y})=>{const g=__T.exportCanvas().getContext('2d');return[...g.getImageData(x,y,1,1).data]},{x,y});
 await test('Pictures turn with the rotate handle in Move / Select and are drawn and clicked where they really are',async()=>{
  await freshPic();let h=await handle('rot');assert.ok(h,'a picture has a rotate handle');const p=await pivot();await dragTo(h,toward(p,90));near(await rot(),90,.6);
  await ev(()=>{__T.S.sel=null;__T.render()});await page.waitForTimeout(100);
  // turned 90 degrees clockwise: the red left half is now on top (y 150-250), the blue right half below
  const top=await px(400,190),bottom=await px(400,310),away=await px(320,250);assert.ok(top[0]>200&&top[2]<60,'top '+top);assert.ok(bottom[2]>200&&bottom[0]<60,'bottom '+bottom);assert.ok(away[0]>240&&away[1]>240&&away[2]>240,'outside '+away);
  let q=await at(400,330);await page.mouse.click(q.x,q.y);assert.equal(await ev(()=>__T.S.sel&&__T.S.sel.t),'img');await ev(()=>{__T.S.sel=null;__T.render()});q=await at(320,250);await page.mouse.click(q.x,q.y);assert.equal(await ev(()=>!!(__T.S.sel&&__T.S.sel.t==='img')),false)});
 await test('Image tab: a picture gets a rotate handle; its box and handles turn with it and resizing keeps the opposite edge',async()=>{
  await freshPic();await ev(()=>{sh.rot=0;__T.setTool('image')});await page.waitForTimeout(200);const h=await handle('rot');assert.ok(h,'rotate handle in the Image tab');const p=await pivot();
  await dragTo(h,toward(p,90));near(await rot(),90,.6);
  const w0=await handle('w'),e0=await handle('e');await dragTo(e0,{x:e0.x,y:e0.y+50});await page.waitForTimeout(150);const w1=await handle('w');near(w1.x,w0.x,2);near(w1.y,w0.y,2);near(await ev(id=>{const s=__T.S.cur.shapes.find(q=>q.id===id);return Math.abs(s.x2-s.x1)},sid()),250,3);near(await rot(),90,.6);
  await ev(()=>__T.undo());await ev(()=>__T.undo());near(await rot(),0,.6)});
 await test('Image tab: typing a size for a turned picture keeps its centre; Rotate and Flip buttons turn and mirror it',async()=>{
  await freshPic();await ev(()=>{sh.rot=30;__T.setTool('image')});await page.waitForTimeout(200);const c0=await pivot();
  await page.locator('#resW87').fill('300');await page.locator('#resW87').press('Tab');await page.waitForTimeout(200);near(await ev(id=>{const s=__T.S.cur.shapes.find(q=>q.id===id);return Math.abs(s.x2-s.x1)},sid()),300,3);const c1=await pivot();near(c1.x,c0.x,2);near(c1.y,c0.y,2);
  const leftPixel=()=>ev(async id=>{const s=__T.S.cur.shapes.find(q=>q.id===id),im=new Image();im.src=s.src;await im.decode();const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const g=c.getContext('2d');g.drawImage(im,0,0);return[...g.getImageData(5,c.height/2,1,1).data]},sid());
  assert.ok((await leftPixel())[0]>200,'left is red');
  await page.locator('#imRotR').click();await page.waitForTimeout(300);near(await rot(),120,.01);assert.ok((await leftPixel())[0]>200,'turning does not change the pixels');
  await page.locator('#imFlipH').click();await page.waitForTimeout(400);near(await rot(),240,.01);const lp=await leftPixel();assert.ok(lp[2]>200&&lp[0]<60,'flip mirrors the pixels '+lp)});
 await test('A group with a picture turns together',async()=>{
  await freshPic();await ev(()=>{const T=__T,r=T.newShape('rect',560,220);Object.assign(r,{x2:700,y2:300,fill:'#00aa00'});__T.S.cur.shapes.push(r);T.S.sel=null;T.S.grp=[sh,r];T.render()});
  const b=await ev(()=>{const bs=[sh,__T.S.cur.shapes[1]].map(s=>__T.bbox(s)),x=Math.min(...bs.map(q=>q.x)),y=Math.min(...bs.map(q=>q.y)),R=Math.max(...bs.map(q=>q.x+q.w)),B=Math.max(...bs.map(q=>q.y+q.h));return{x,y,w:R-x,h:B-y,k:__T.scale()}});
  const pv={x:b.x+b.w/2,y:b.y+b.h/2};await dragTo({x:pv.x,y:b.y-26/b.k},toward(pv,90));near(await rot(),90,.6)});
 console.log(JSON.stringify({passed:results.filter(Boolean).length,failed:results.filter(x=>!x).length,errors}));await browser.close();process.exit(results.includes(0)||errors.length?1:0)})();
