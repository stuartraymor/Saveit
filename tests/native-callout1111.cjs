// 10.1.11: letters typed into a callout are visible while typing, for every Fill and Quick style, and long text stays in view. Real Electron 33, disposable profile.
// node tests/native-callout1111.cjs <electron.exe> <app folder> <evidence folder>
const {_electron}=require('playwright'),fs=require('fs'),path=require('path');
(async()=>{const [exe,appDir,out]=process.argv.slice(2);fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
const app=await _electron.launch({executablePath:exe,args:[path.resolve(appDir)],env:{...process.env,SAVEIT_REVIEW_DATA:path.join(out,'profile')},timeout:30000});const rows=[];
try{const page=await app.firstWindow();page.setDefaultTimeout(15000);await page.waitForFunction(()=>document.body.dataset.catalogCount);
const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1000;c.height=560;const g=c.getContext('2d');g.fillStyle='#f5f7fa';g.fillRect(0,0,1000,560);g.fillStyle='#1f3b57';g.fillRect(0,0,1000,70);g.fillStyle='#fff';g.font='bold 30px Segoe UI';g.fillText('Account settings',30,46);g.fillStyle='#142130';g.font='22px Segoe UI';['Name: Jane Example','Email: jane@example.com'].forEach((t,i)=>g.fillText(t,60,140+i*60));return c.toDataURL().split(',')[1]});
fs.writeFileSync(path.join(out,'page.png'),Buffer.from(png,'base64'));await page.locator('#file').setInputFiles(path.join(out,'page.png'));await page.waitForFunction(()=>document.querySelector('#cv')?.width>=1000);await page.waitForTimeout(500);
// how many pixels of the box differ clearly from its own background = visible letters
const visible=async(loc)=>{const buf=await loc.screenshot();return page.evaluate(async b64=>{const im=new Image();im.src='data:image/png;base64,'+b64;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);const d=g.getImageData(4,4,c.width-8,c.height-8).data;
  const cnt={};for(let i=0;i<d.length;i+=4){const k=(d[i]>>4)+','+(d[i+1]>>4)+','+(d[i+2]>>4);cnt[k]=(cnt[k]||0)+1}const bg=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0].split(',').map(v=>v*16+8);let n=0;for(let i=0;i<d.length;i+=4)if(Math.abs(d[i]-bg[0])+Math.abs(d[i+1]-bg[1])+Math.abs(d[i+2]-bg[2])>120)n++;return n},buf.toString('base64'))};
const box=await page.locator('#cv').boundingBox();let k=0;
async function run(name,setup,opts={}){k++;await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.locator('#cv').click({position:{x:4,y:4}});await page.keyboard.press('c');await page.waitForTimeout(150);
  if(setup)await setup();const sx=box.x+60+((k*90)%(box.width-420)),sy=box.y+box.height*.35;await page.mouse.move(sx,sy);await page.mouse.down();await page.mouse.move(sx+(opts.w||260),sy+(opts.h||100),{steps:6});await page.mouse.up();await page.waitForTimeout(250);
  const te=page.locator('#te');const st=await page.evaluate(()=>{const t=document.querySelector('#te'),c=getComputedStyle(t);return{color:c.color,bg:c.backgroundColor,caret:c.caretColor,focused:document.activeElement===t}});
  await page.keyboard.type(opts.text||'Hello world',{delay:10});await page.waitForTimeout(150);const typing=await visible(te);
  const over=await page.evaluate(()=>{const t=document.querySelector('#te');return t.scrollHeight>t.clientHeight+2});
  await page.screenshot({path:path.join(out,k+'-typing.png'),clip:await te.boundingBox().then(b=>({x:b.x-20,y:b.y-20,width:b.width+40,height:b.height+40}))});
  if(opts.reedit){await page.keyboard.press('Escape');await page.waitForTimeout(200);await page.mouse.dblclick(sx+(opts.w||260)/2,sy+(opts.h||100)/2);await page.waitForTimeout(250);await page.keyboard.press('End');await page.keyboard.type(' again');await page.waitForTimeout(150)}
  const typing2=opts.reedit?await visible(te):null;
  await page.keyboard.press('Escape');await page.waitForTimeout(250);const after=await visible(page.locator('#cv'));
  await page.screenshot({path:path.join(out,k+'-after.png'),clip:{x:sx-20,y:sy-20,width:(opts.w||260)+40,height:(opts.h||100)+40}});
  const r={k,name,...st,textPixelsWhileTyping:typing,reeditPixels:typing2,overflowHidden:over};rows.push(r);console.log(JSON.stringify(r))}
const vis=sel=>page.locator(sel+':visible').first();
// realistic flow: draw a callout, finish it, change its Fill or Quick style while it is selected, then double-click to type into it
async function edit(name,apply){k++;await page.keyboard.press('Escape');await page.locator('#cv').click({position:{x:4,y:4}});await page.keyboard.press('c');await page.waitForTimeout(120);
  const sx=box.x+40+((k*70)%(box.width-380)),sy=box.y+60+((k*37)%(box.height-200));await page.mouse.move(sx,sy);await page.mouse.down();await page.mouse.move(sx+240,sy+90,{steps:6});await page.mouse.up();await page.waitForTimeout(200);
  await page.keyboard.type('Hi');await page.keyboard.press('Escape');await page.waitForTimeout(200);await page.keyboard.press('v');await page.mouse.click(sx+120,sy+45);await page.waitForTimeout(200);
  let applied=true;try{await apply()}catch(e){applied='could not click: '+e.message.slice(0,120)}await page.waitForTimeout(200);
  const fillPx=await page.evaluate(()=>0);
  await page.mouse.dblclick(sx+120,sy+45);await page.waitForTimeout(250);const te=page.locator('#te');
  const st=await page.evaluate(()=>{const t=document.querySelector('#te'),c=getComputedStyle(t);return{editing:!t.hidden,color:c.color,bg:c.backgroundColor,caret:c.caretColor}});
  await page.keyboard.press('End');await page.keyboard.type(' there, can you read me',{delay:10});await page.waitForTimeout(150);const px=st.editing?await visible(te):null;
  if(st.editing)await page.screenshot({path:path.join(out,'B'+k+'-typing.png'),clip:await te.boundingBox().then(b=>({x:b.x-20,y:b.y-20,width:b.width+40,height:b.height+40}))});
  await page.keyboard.press('Escape');await page.waitForTimeout(200);await page.screenshot({path:path.join(out,'B'+k+'-after.png'),clip:{x:sx-15,y:sy-15,width:270,height:120}});
  const r={k,name,applied,...st,textPixelsWhileTyping:px};r.fail=r.applied!==true||!r.editing||!(px>800)||r.color===r.bg;rows.push(r);console.log(r.fail?'FAIL':'PASS',name,JSON.stringify(r))}
// long text in a small callout stays in view while typing
{k++;await page.keyboard.press('Escape');await page.locator('#cv').click({position:{x:4,y:4}});await page.keyboard.press('c');await page.waitForTimeout(120);const sx=box.x+60,sy=box.y+40;await page.mouse.move(sx,sy);await page.mouse.down();await page.mouse.move(sx+180,sy+70,{steps:6});await page.mouse.up();await page.waitForTimeout(200);
  await page.keyboard.type('This is a much longer sentence that keeps going past the end of the callout box',{delay:5});await page.waitForTimeout(150);const r=await page.evaluate(()=>{const t=document.querySelector('#te');return{hidden:t.scrollHeight>t.clientHeight+2,h:t.clientHeight}});r.k=k;r.name='Long text stays in view while typing';r.fail=r.hidden;rows.push(r);console.log(r.fail?'FAIL':'PASS',r.name,JSON.stringify(r));await page.keyboard.press('Escape')}
for(const f of ['none','#ffffff','#111111','#f5c400','#e5372a','#1971c2','#0e8577'])await edit('Fill '+f,()=>vis('[data-k="fill"][data-v="'+f+'"]').click({timeout:3000}));
for(let i=0;i<8;i++)await edit('Quick style '+(i+1),()=>vis('#qs button[data-i="'+i+'"]').click({timeout:3000}));
}finally{const fails=rows.filter(r=>r.fail);fs.writeFileSync(path.join(out,'native-callout1111-results.json'),JSON.stringify({passed:rows.length-fails.length,failed:fails.length,rows},null,2));process.exitCode=fails.length||!rows.length?1:0;try{await app.evaluate(({app})=>app.isQuitting=true);await app.close()}catch(_){}}
})().catch(e=>{console.error(e);process.exitCode=1});
