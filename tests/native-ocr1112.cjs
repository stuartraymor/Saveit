// 10.1.12: Grab Text accuracy in the real app (Electron 33 + Windows OCR). Disposable profile.
// The test draws known text in a window (several fonts and sizes, money, codes, a file path, dark mode, app windows with icons), sends each picture
// through the same call the editor uses (bench.ocr), and scores the result against the known text.
// node tests/native-ocr1112.cjs <electron.exe> <app folder> <evidence folder>
const {_electron}=require('playwright'),assert=require('assert/strict'),fs=require('fs'),path=require('path');
(async()=>{const [exe,appDir,outArg]=process.argv.slice(2),out=path.resolve(outArg),source=path.resolve(appDir);fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
const app=await _electron.launch({executablePath:path.resolve(exe),args:[source,'--force-device-scale-factor=1'],env:{...process.env,SAVEIT_REVIEW_DATA:path.join(out,'profile')},timeout:30000}),results=[],errors=[];
const lev=(a,b)=>{const m=a.length,n=b.length;let p=Array.from({length:n+1},(_,j)=>j),q=new Array(n+1);for(let i=1;i<=m;i++){q[0]=i;for(let j=1;j<=n;j++)q[j]=Math.min(p[j]+1,q[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));[p,q]=[q,p]}return p[n]};
const norm=s=>s.split('\n').map(l=>l.replace(/\s+/g,' ').trim()).filter(Boolean).join('\n');
const lineScore=(truth,text)=>{const outs=norm(text).split('\n');return norm(truth).split('\n').map(t=>{let best=t.length,got='';for(const o of outs){const e=lev(t,o);if(e<best){best=e;got=o}}return{truth:t,got:best===t.length?'(missing)':got,errors:best}})};
try{const page=await app.firstWindow();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.stack));await page.waitForFunction(()=>document.body.dataset.catalogCount);
const test=async(name,fn)=>{try{const d=await fn();results.push({name,pass:true,detail:d});console.log('PASS',name,d?JSON.stringify(d).slice(0,300):'')}catch(e){results.push({name,pass:false,error:e.stack});console.log('FAIL',name,e.message.split('\n')[0])}};
const PROSE=['The quick brown fox jumps over the lazy dog.','Please check your settings before you continue.'],MONEY='Invoice 2024-0815 is due on 12 March for $1,234.56';
const cases=[];const add=(name,lines,font,color='#1b1b1b',bg='#ffffff',html=null)=>cases.push({name,lines,font,color,bg,html});
for(const f of ['Segoe UI','Calibri','Arial','Times New Roman','Georgia','Verdana','Tahoma','Consolas','Courier New'])for(const px of [12,14])add(f+' '+px+'px',[...PROSE,MONEY],`${px}px '${f}'`);
add('file path in red',['Error 0x80070005: Access is denied.','The file C:\\Users\\Jane\\Documents\\report-01.docx is in use.'],"12px 'Segoe UI'",'#c42b1c');
add('numbers',['Total 10,008.00  Tax 0.08','Phone +1 (555) 010-0199','Zip 01001'],"13px 'Segoe UI'");
add('dark mode',[...PROSE,MONEY],"13px 'Segoe UI'",'#d4d4d4','#1e1e1e');
add('settings window',['Settings','Display','Brightness and color','Notifications','Alerts from apps and system','Storage','Used 212 GB of 476 GB'],'',null,'#f3f3f3','<div style="padding:16px 20px;width:520px;font:13px Segoe UI;color:#1b1b1b"><div style="font:600 20px Segoe UI;margin-bottom:12px">Settings</div>'+[['\u{1F5B5}','Display','Brightness and color'],['\u{1F514}','Notifications','Alerts from apps and system'],['\u{1F4BE}','Storage','Used 212 GB of 476 GB']].map(([i,a,b])=>'<div style="display:flex;align-items:center;gap:14px;background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:10px 14px;margin:6px 0"><span style="font-size:20px">'+i+'</span><div style="flex:1"><div>'+a+'</div><div style="color:#616161;font-size:12px">'+b+'</div></div><span style="width:40px;height:20px;border-radius:10px;background:#0f6cbd;display:inline-block"></span><span>\u203A</span></div>').join('')+'</div>');
// draw every case in a window of the app's own main process and capture it, as a screen capture would
const shots=await app.evaluate(async({BrowserWindow},cases)=>{const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');const w=new BrowserWindow({show:true,width:1300,height:800,frame:false,x:0,y:0,skipTaskbar:true});const res=[];
  for(const c of cases){const body=c.html||`<div style="padding:18px 22px;font:${c.font};color:${c.color};line-height:1.45">${c.lines.map(l=>`<div style="white-space:pre">${esc(l)}</div>`).join('')}</div>`;
    await w.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(`<!doctype html><meta charset="utf-8"><body style="margin:0;background:${c.bg}"><div id="t" style="display:inline-block">${body}</div></body>`));await new Promise(r=>setTimeout(r,250));
    const r=await w.webContents.executeJavaScript('(()=>{const b=document.getElementById("t").getBoundingClientRect();return{x:Math.floor(b.x),y:Math.floor(b.y),width:Math.ceil(b.width),height:Math.ceil(b.height)}})()');
    let img=await w.webContents.capturePage(r);for(let k=0;k<5&&img.isEmpty();k++){await new Promise(q=>setTimeout(q,300));img=await w.webContents.capturePage(r)}res.push(img.toDataURL())}w.destroy();return res},cases);
const scored=[];
for(let i=0;i<cases.length;i++){const c=cases[i];fs.writeFileSync(path.join(out,String(i).padStart(2,'0')+' '+c.name+'.png'),Buffer.from(shots[i].split(',')[1],'base64'));
  // the editor sends a canvas PNG; re-encode the capture the same way
  const url=await page.evaluate(async u=>{const im=new Image();im.src=u;await im.decode();const cv=document.createElement('canvas');cv.width=im.width;cv.height=im.height;cv.getContext('2d').drawImage(im,0,0);return cv.toDataURL('image/png')},shots[i]);
  const t0=Date.now(),text=await page.evaluate(u=>window.bench.ocr(u),url),ms=Date.now()-t0;scored.push({name:c.name,ms,text,lines:lineScore(c.lines.join('\n'),text)})}
fs.writeFileSync(path.join(out,'native-ocr1112-detail.json'),JSON.stringify(scored,null,1));
const cer=filter=>{let e=0,n=0;for(const s of scored)for(const l of s.lines)if(filter(s,l)){e+=l.errors;n+=l.truth.length}return n?e/n:0};
const summary={overallCER:+(100*cer(()=>true)).toFixed(2),proseCER:+(100*cer((s,l)=>PROSE.includes(l.truth)&&!/Courier/.test(s.name))).toFixed(2),moneyPerfect:scored.filter(s=>s.lines.some(l=>l.truth===MONEY&&!l.errors)).length+'/'+scored.filter(s=>s.lines.some(l=>l.truth===MONEY)).length,averageSeconds:+(scored.reduce((a,s)=>a+s.ms,0)/scored.length/1000).toFixed(2)};
console.log('SUMMARY',JSON.stringify(summary));for(const s of scored)for(const l of s.lines)if(l.errors)console.log('  ',s.name.padEnd(22),JSON.stringify(l.truth).slice(0,50).padEnd(52),'->',JSON.stringify(l.got).slice(0,60));
const get=(n,t)=>scored.find(s=>s.name===n).lines.find(l=>l.truth.startsWith(t));
await test('A file path that Windows OCR used to drop is read',async()=>{const l=get('file path in red','The file');assert.ok(l.errors<=4,l.got);return l});
await test('Money amounts read with the $ sign in the common UI fonts',async()=>{const fonts=['Segoe UI 14px','Calibri 14px','Arial 14px','Verdana 14px','Tahoma 14px'],ok=fonts.filter(f=>!get(f,'Invoice').errors);assert.ok(ok.length>=4,'only '+ok.join(', '));return ok});
// letter case aside (Windows OCR may read "Zip" as "zip")
await test('Numbers with look-alike letters come out as numbers',async()=>{const s=scored.find(x=>x.name==='numbers');assert.ok(s.lines.every(l=>l.got.toLowerCase()===l.truth.toLowerCase()),JSON.stringify(s.lines));return s.text});
// Windows OCR itself reads the bell icon as one letter ("h Notifications"), in 10.1.11 too; recovery must not add anything more
await test('An app window with icons, toggles and borders reads every line, with at most an icon read as one letter',async()=>{const s=scored.find(x=>x.name==='settings window'),e=s.lines.reduce((a,l)=>a+l.errors,0);assert.ok(s.lines.every(l=>l.got!=='(missing)')&&e<=2,JSON.stringify(s.lines));return{errors:e,text:s.text}});
await test('Ordinary sentences stay near-perfect (fonts other than Courier New)',async()=>{assert.ok(summary.proseCER<2,'prose CER '+summary.proseCER+'%');return summary});
await test('Grab Text still takes under 3 seconds a picture',async()=>{assert.ok(summary.averageSeconds<3,summary.averageSeconds+' s');return summary.averageSeconds});
results.push({name:'No native renderer errors',pass:errors.length===0,errors});results.push({name:'summary',pass:true,detail:summary});
}finally{fs.writeFileSync(path.join(out,'native-ocr1112-results.json'),JSON.stringify({passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,results},null,2));try{await app.evaluate(({app})=>app.isQuitting=true);await app.close()}catch(_){}}process.exitCode=results.some(r=>!r.pass)?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
