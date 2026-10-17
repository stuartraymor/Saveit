// 10.0.10: the native Step Capture helper (saveit-steps.exe), built from native/saveit-steps.cs.
// node tests/native-steps-helper.cjs          (add --live to also click and type in a small test window of its own)
const {spawn,execFileSync}=require('child_process'),path=require('path'),assert=require('assert/strict');
const root=path.join(__dirname,'..'),exe=path.join(root,'app','saveit-steps.exe');let fail=0;
const ok=m=>console.log('PASS',m),bad=m=>{fail++;console.log('FAIL',m)},test=async(name,fn)=>{try{await fn();ok(name)}catch(e){bad(name+' '+e.message)}};
const waitFor=(fn,ms)=>new Promise((res,rej)=>{const t0=Date.now(),i=setInterval(()=>{const v=fn();if(v){clearInterval(i);res(v)}else if(Date.now()-t0>ms){clearInterval(i);rej(new Error('timed out'))}},25)});
(async()=>{
 await test('--probe describes what is under a screen point and exits',async()=>{
  const t0=Date.now(),o=execFileSync(exe,['--probe','20','20'],{encoding:'utf8',timeout:8000}).trim(),j=JSON.parse(o);
  for(const k of ['n','button','double','x','y','name','type','ctype','id','help','value','isPassword','rect','menu','window','app'])assert.ok(k in j,'missing '+k);
  assert.equal(j.x,20);assert.equal(j.y,20);assert.ok(Date.now()-t0<5000,'slow '+(Date.now()-t0))});
 await test('The helper says READY quickly, stays quiet, and exits when Saveit closes its input',async()=>{
  const t0=Date.now(),p=spawn(exe,[],{stdio:['pipe','pipe','ignore'],windowsHide:true});let out='',exited=false;p.stdout.on('data',d=>out+=d);p.on('exit',()=>exited=true);
  await waitFor(()=>/READY/.test(out),3000);assert.ok(Date.now()-t0<1500,'start took '+(Date.now()-t0)+' ms');
  await new Promise(r=>setTimeout(r,400));assert.equal(out.trim(),'READY','no events without input');
  p.stdin.end();await waitFor(()=>exited,3000)});
 if(process.argv.includes('--live'))await test('Live: clicks name the control, typing is reported per field, password fields are never read',async()=>{
  const out=execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'steps-helper-live.ps1'),'-Helper',exe],{encoding:'utf8',timeout:90000}),lines=out.split(/\r?\n/).filter(l=>l.startsWith('LINE ')).map(l=>l.slice(5)),res=out.split(/\r?\n/).filter(l=>l.startsWith('RESULT'));
  assert.equal(res.length,0,res.join(';'));assert.ok(/EXITED True/.test(out),'helper exits when stdin closes');
  const clicks=lines.filter(l=>/^CLICK \d+$/.test(l)),info=lines.filter(l=>l.startsWith('INFO ')).map(l=>JSON.parse(l.slice(5))),types=lines.filter(l=>l.startsWith('TYPE ')).map(l=>JSON.parse(l.replace(/^TYPE \d+ /,'')));
  console.log('   events:',lines.map(l=>l.slice(0,90)).join(' | '));
  assert.equal(clicks.length,4,'four clicks: '+lines.join(' | '));
  assert.equal(info[0].name,'Search');assert.match(info[0].type,/edit/i);assert.equal(info[1].name,'OK');assert.match(info[1].type,/button/i);assert.equal(info[3].name,'OK');
  assert.equal(types.length,2,'two typing steps (the password one is empty and flagged)');assert.equal(types[0].text,'abc 42');assert.equal(types[0].field,'Search');
  assert.equal(types[1].isPassword,true);assert.equal(types[1].text,'');assert.ok(!lines.join('\n').includes('hunter2'),'the password never appears');
  const iT=lines.findIndex(l=>l.startsWith('TYPE ')&&l.includes('abc 42')),ci=lines.map((l,i)=>/^CLICK \d+$/.test(l)?i:-1).filter(i=>i>=0);assert.ok(iT>ci[0]&&iT<ci[1],'typing is reported after the click that focused the field and before the next click')});
 console.log(fail?`\n${fail} FAILED`:'\nHELPER TESTS PASSED');process.exit(fail?1:0)})();
