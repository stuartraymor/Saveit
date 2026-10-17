// Automated UI tests, run inside the test harness page:  await QA.runAll()
// Each test maps to a finding in the 9.7.0 QA report (F-numbers) or guards an existing feature against regressions.
(function(){
const T=()=>window.__T,S=()=>__T.S,sleep=QA.sleep,until=QA.until,check=QA.check;
const fresh=(name,w=800,h=450,col='#6a9fd8')=>{const it=T().addImage(QA.canvas(w,h,col),name);T().openItem(it);return it};
const closeModal=()=>document.querySelectorAll('.modal').forEach(m=>m.remove());
const lastToast=()=>__toasts[__toasts.length-1]||'';
const tests={
async 'F15 step number comes back with Undo'(){const it=fresh('QA steps');await sleep(150);S().tool='step';S().stepNext=1;
  for(let i=0;i<3;i++){T().snap();const s=T().newShape('step',100+i*80,100);it.shapes.push(s);S().stepNext++}
  T().undo();const after=S().stepNext;T().snap();const s=T().newShape('step',400,200);it.shapes.push(s);S().stepNext++;
  const nums=it.shapes.filter(x=>x.t==='step').map(x=>x.n);check('F15 next counter restored to 3 after Undo',after===3,'next='+after);check('F15 sequence is 1,2,3',nums.join()==='1,2,3',nums.join());
  T().redo();check('F15 Redo after a new edit does nothing harmful',it.shapes.filter(x=>x.t==='step').length===3)},
async 'F2 Undo right after moving an effect slider'(){const it=fresh('QA effects');await sleep(150);T().snap();const s=T().newShape('text',100,100);s.text='keep me';it.shapes.push(s);T().render();
  document.querySelector('#fxBtn').click();await sleep(200);const v=document.querySelector('[data-fv="vig"]');await sleep(900);v.value=63;v.dispatchEvent(new Event('input',{bubbles:true}));v.focus();
  QA.key('z',{ctrlKey:true});await sleep(100);check('F2 Ctrl+Z on a focused slider reverts the vignette',(it.fx.vig||0)===0,'vig='+it.fx.vig);check('F2 the earlier text is kept',it.shapes.some(x=>x.t==='text'&&x.text==='keep me'));
  QA.key('y',{ctrlKey:true});await sleep(100);check('F2 Ctrl+Y brings the vignette back',it.fx.vig===63,'vig='+it.fx.vig);
  check('F3 Done / Reset stay pinned at the bottom of Effects',getComputedStyle(document.querySelector('.fxfoot')).position==='sticky');
  const names=[...document.querySelectorAll('#fxTiles button span')].map(x=>x.textContent);check('F8 every look shows its name',names.length===9&&names.every(Boolean),names.join(', '));
  check('F7 adjustment sliders have their own icons',document.querySelectorAll('.fxl .fxic').length>=8);
  const row=document.querySelector('[data-fa="br"]').closest('.row'),val=row.querySelector('.val,input[type=number]');check('F7 icon does not push the value onto a second line',!val||Math.abs(val.getBoundingClientRect().top-row.querySelector('input[type=range]').getBoundingClientRect().top)<14);
  document.querySelector('#fxDone').click()},
async 'F14 library selection follows the visible results'(){const it=fresh('qa-sel-target');await sleep(100);T().openLibrary();await sleep(200);T().libQuery='qa-sel-target';T().renderLib();await sleep(100);
  T().libSel.clear();T().libSel.add(it.id);T().renderLib();check('F14 item selected while it matches',T().libSel.size===1);
  T().renameItem(it,'qa renamed elsewhere '+Date.now());T().renderLib();await sleep(50);
  check('F14 renamed item that left the results is no longer selected',T().libSel.size===0,'selected='+T().libSel.size);
  check('F14 Open is disabled with nothing visible selected',document.querySelector('#libOpen').disabled);T().libQuery='';closeModal()},
async 'F9 F5 F16 video Save writes the visible edit'(){await QA.openVideo(3);const ctl=T().vid._ctl,e=ctl.getProject(),it=S().cur;
  check('F9 untouched video is not treated as edited',!ctl.isEdited());
  // untouched: Save writes the recording itself, instantly
  __saved.length=0;it.savedPath=null;await T().save();await until(()=>__saved.length,5000);const orig=(it.mp4||it.webm);check('F9 untouched Save writes the original file',__saved[0].size===orig.size,__saved[0].size+' vs '+orig.size);
  // edited: trim + long caption
  const c=e.clips[0];c.a=0.5;c.b=2.5;e.caps.push({id:'qa1',t0:0,t1:2,text:'Everyday export review — café, Español, 123. Please check that this longer caption stays inside the picture and remains readable when shared at 480p.',pos:'b',fs:6,c:'#fff'});
  check('F9 trimmed + captioned video counts as edited',ctl.isEdited());
  __saved.length=0;__toasts.length=0;it.savedPath=null;T().save();await until(()=>__saved.length,15000,100);const s=__saved[0],blob=new Blob([s.data],{type:s.name.endsWith('mp4')?'video/mp4':'video/webm'}),d=await QA.duration(blob);
  check('F9 Save wrote the 2.0 s edit, not the 3 s recording',Math.abs(d-2)<0.15,'saved '+d.toFixed(3)+' s');
  check('F5 rendered length matches the timeline within 0.1 s',Math.abs(d-2)<0.1,'diff '+(d-2).toFixed(3)+' s');
  check('F9 message says the edited video was saved, with length and path',__toasts.some(t=>/Saved the edited video \(0:02\.0\) to C:\\test\\/.test(t)),__toasts.join(' | '));
  // caption fits: grab the frame at 1 s and look at the outer 3% columns of the bottom third
  await sleep(200);const cv=ctl.grab(),g=cv.getContext('2d'),W=cv.width,H=cv.height;let dark=0,tot=0;for(let y=Math.round(H*.6);y<H;y+=2)for(const x of [2,Math.round(W*.02),W-3,W-1-Math.round(W*.02)]){const p=g.getImageData(x,y,1,1).data;tot++;if(p[0]+p[1]+p[2]<150)dark++}
  check('F16 long caption stays inside the picture (no box at the edges)',dark===0,dark+'/'+tot+' edge samples dark');
  let mid=0;for(let y=Math.round(H*.6);y<H;y+=2){const p=g.getImageData(W>>1,y,1,1).data;if(p[0]+p[1]+p[2]<150)mid++}check('F16 the caption is drawn (box present mid-frame)',mid>3,'dark mid samples '+mid);
  // cancelled render: nothing written
  __saved.length=0;__toasts.length=0;it.savedPath=null;T().save();await sleep(400);document.querySelector('[data-a="stop"]').click();await sleep(1200);
  check('F9 Cancel during Save writes nothing',__saved.length===0&&__toasts.some(t=>/cancelled/i.test(t)),__toasts.join(' | '))},
async 'F4 F6 F7 video side panel'(){if(!(T().vid&&T().vid._ctl))await QA.openVideo(2);const vs=document.querySelector('.vside');document.querySelector('[data-tab="vfx"]').click();await sleep(150);
  const ic=[...document.querySelectorAll('[data-vfx]')].map(b=>b.querySelector('svg')?b.querySelector('svg').innerHTML:'');check('F7 all 12 visual effects have an icon',ic.length===12&&ic.every(Boolean),ic.filter(Boolean).length+'/'+ic.length);
  check('F7 every effect icon is different',new Set(ic).size===ic.length);
  vs.scrollTop=vs.scrollHeight;await sleep(100);const tb=document.querySelector('.vpane[data-pane="video"] > .vtabs').getBoundingClientRect().top,vt=vs.getBoundingClientRect().top;check('F4 section tabs stay visible when the panel scrolls',vs.scrollTop>0?Math.abs(tb-vt)<4:true,'tabs '+tb.toFixed(0)+' panel '+vt.toFixed(0)+' scroll '+vs.scrollTop);
  check('F3 trimming hint folded away outside Clip',document.querySelector('[data-r="hint"]').hidden);
  document.querySelector('[data-tab="look"]').click();await sleep(150);document.querySelector('[data-lk="bg"]').click();await sleep(250);
  const cards=[...document.querySelectorAll('[data-r="lkgrid"] button')].map(b=>b.title);check('F6 background tab explains and offers “Show background”',cards[0]==='Show background'&&/hidden/.test(document.querySelector('[data-r="lknote"]').textContent),cards.slice(0,2).join(', '));
  document.querySelector('[data-tab="clip"]').click();await sleep(100);check('F3 hint shown again on Clip',!document.querySelector('[data-r="hint"]').hidden)},
async 'F11 scrolling capture warning reaches the user'(){const old=window.bench.capture;window.bench.capture=async()=>({url:QA.canvas(300,900,'#ccc').toDataURL(),area:'scroll',note:'Scrolling capture stopped early: test'});__toasts.length=0;
  try{await T().captureDesktop('scroll');await sleep(600)}finally{window.bench.capture=old}check('F11 incomplete scrolling capture shows a warning',__toasts.some(t=>/stopped early/.test(t)),__toasts.join(' | '));
  check('F11 the captured part is still opened',S().cur&&S().cur.kind==='image'&&S().cur.base&&S().cur.base.height===900)},
async 'F12 Word export wording'(){check('F12 Word option no longer promises editable screenshots',T().FMT_NOTE&&!/Editable in Word/.test(T().FMT_NOTE.docx)&&/picture/.test(T().FMT_NOTE.docx),T().FMT_NOTE&&T().FMT_NOTE.docx)},
async 'F1 accessibility names'(){const it=fresh('QA a11y');await sleep(200);
  const nm=el=>(el.getAttribute('aria-label')||(el.labels&&[...el.labels].map(l=>l.textContent).join(' '))||(!/^(INPUT|SELECT|TEXTAREA|CANVAS)$/.test(el.tagName)&&el.textContent)||el.getAttribute('title')||el.getAttribute('placeholder')||'').trim();
  const scan=()=>[...document.querySelectorAll('button,input:not([type=hidden]),select,textarea,canvas,[role=button]')].filter(e=>e.offsetParent!==null&&!e.closest('[aria-hidden="true"]')&&e.getAttribute('aria-hidden')!=='true').filter(e=>!nm(e)&&!(e.tagName==='CANVAS'&&e.closest('button'))).map(e=>e.tagName+(e.id?'#'+e.id:'')+'.'+e.className);
  const bad=new Set(scan()),tools=[...document.querySelectorAll('.tool')];for(const b of tools){b.click();await sleep(60);scan().forEach(x=>bad.add(x+' ('+(b.textContent.trim())+')'))}
  document.querySelector('#fxBtn')?.click();await sleep(80);scan().forEach(x=>bad.add(x+' (Effects)'));document.querySelector('#fxDone')?.click();
  check('F1 every visible control has a name, in every tool panel ('+tools.length+' tools)',bad.size===0,[...bad].slice(0,8).join(' '));
  T().toast('hello');check('F1 messages are announced (role=status)',document.querySelector('.toast')?.getAttribute('role')==='status')},
async 'Human: area tools show where they apply while dragging'(){const tool=n=>[...document.querySelectorAll('.tool')].find(b=>b.textContent.trim()===n);
  for(const name of ['Blur','Spotlight','Magnify']){const it=T().addImage(QA.page(),'drag '+name);T().openItem(it);await sleep(200);tool(name).click();await sleep(60);
    const [x0,y0]=QA.at(50,228),[x1,y1]=QA.at(380,275);const before=QA.px(50,250),row=[];for(let x=60;x<360;x+=4)row.push(QA.px(x,252));await QA.hold(x0,y0,x1,y1,8);await sleep(40);
    const edge=QA.px(50,250),inside=name==='Blur'?(()=>{let d=0,i=0;for(let x=60;x<360;x+=4){const p=QA.px(x,252),q=row[i++];if(Math.abs(p[0]-q[0])+Math.abs(p[1]-q[1])+Math.abs(p[2]-q[2])>40)d++}return d})():0;
    check(`${name}: dashed outline visible while dragging`,Math.abs(edge[0]-before[0])+Math.abs(edge[1]-before[1])>40||edge[0]>250,'edge '+edge.slice(0,3)+' before '+before.slice(0,3));
    if(name==='Blur')check('Blur: pixelation previews while dragging',inside>5,'changed text samples '+inside);
    await QA.release(x1,y1);await sleep(80);check(`${name}: applied after letting go`,it.shapes.some(s=>s.t===name.toLowerCase()))}},
async 'Human: toolbar, zoom keys, captions, narrow window'(){const it=fresh('human toolbar');await sleep(200);const cb=[...document.querySelectorAll('.tool')].find(b=>b.textContent.trim()==='Crop');
  check('Crop is on the toolbar',!!cb);cb&&cb.click();await sleep(50);check('Crop button picks the Crop tool',S().tool==='crop');QA.key('Escape');document.activeElement.blur();
  const w=()=>document.querySelector('#cv').getBoundingClientRect().width,w0=w();QA.key('=',{ctrlKey:true});await sleep(120);const w1=w();QA.key('-',{ctrlKey:true});await sleep(120);const w2=w();QA.key('0',{ctrlKey:true});await sleep(120);
  check('Ctrl + zooms in, Ctrl − zooms out, Ctrl 0 fits',w1>w0*1.1&&Math.abs(w2-w0)<3&&Math.abs(w()-w0)<3,[w0,w1,w2,w()].map(Math.round).join(' → '));
  const ov=QA.overlaps();check('top bar: no controls on top of each other at this window width ('+ov.w+' px)',!ov.hits.length&&!ov.offscreen.length,ov.hits.join('; '));
  await QA.openVideo(2);document.querySelector('[data-tab="caps"]').click();await sleep(80);document.querySelector('[data-a="addcap"]').click();await sleep(120);const ae=document.activeElement;
  check('Add caption puts you straight into typing',ae.tagName==='INPUT'&&ae.type==='text'&&ae.selectionEnd-ae.selectionStart===ae.value.length,ae.tagName+' '+ae.type)},
async 'Audio: capture bar, two mics, record, mix, library'(){const q=s=>document.querySelector(s),vis=s=>{const e=q(s);return !!e&&e.offsetParent!==null};
  q('#mAud').click();await sleep(700);
  check('Audio mode: button says Record audio',q('#capLbl').textContent==='Record audio');
  check('Audio mode: only audio settings shown',vis('.top .amic[data-n="1"]')&&vis('.top .asys')&&vis('#delay')&&!vis('#area')&&!vis('#curWrap')&&!vis('#clipWrap')&&!vis('#fxWrap'));
  check('Audio mode: logo only, no Saveit text',!/Saveit/.test(q('.top .brand').textContent));
  if(!vis('.top .amic[data-n="2"]')){q('.top .aadd').click();await sleep(900)}
  const s1=q('.top .amic[data-n="1"] select'),s2=q('.top .amic[data-n="2"] select');
  check('Mic 2 is a different microphone from Mic 1',s2.value&&s2.value!=='micA'&&[...s2.options].filter(o=>o.disabled).length>=1,s1.value+' / '+s2.value);
  await sleep(300);const lv=[...document.querySelectorAll('.top .ameter')].map(c=>+c.getAttribute('aria-valuenow'));check('Both level bars move while Audio is chosen',lv.length===2&&lv.every(v=>v>0),lv.join(','));
  const n0=S().items.length;q('#capBtn').click();await sleep(500);check('Recording: button turns into Stop',q('#capLbl').textContent==='Stop');await sleep(1500);q('#capBtn').click();
  await until(()=>S().items.length>n0,8000);await until(()=>document.querySelectorAll('.alane').length,8000);const it=S().cur;
  check('Stop opens the new recording in the Audio screen',it.kind==='audio'&&document.querySelectorAll('.alane').length===2,it.kind+' lanes '+document.querySelectorAll('.alane').length);
  check('Each mic is its own track',it.tracks.length===2&&it.tracks.every(t=>t.blob.size>1000),it.tracks.map(t=>t.name).join(' | '));
  await sleep(500);check('Mic bars come back after recording',window.__openMics===2,'open mics '+window.__openMics);
  check('Drawing tools are greyed out on audio',[...document.querySelectorAll('#rail .tool[data-t]')].every(b=>b.disabled));
  const hz=async()=>{__saved.length=0;await T().save('wav');await until(()=>__saved.length,8000);const b=await AEdit.decode(new Blob([__saved[0].data],{type:'audio/wav'})),d=b.getChannelData(0);let z=0;for(let i=1;i<b.sampleRate;i++)if((d[i-1]<0)!==(d[i]<0))z++;return{hz:Math.round(z/2),dur:b.duration}};
  it.tracks[1].mute=true;let r=await hz();check('Save WAV with Mic 2 muted has only Mic 1 (440 Hz)',Math.abs(r.hz-440)<15,r.hz+' Hz, '+r.dur.toFixed(2)+' s');
  it.tracks[1].mute=false;it.tracks[1].solo=true;r=await hz();check('Save WAV with Mic 2 solo has only Mic 2 (660 Hz)',Math.abs(r.hz-660)<15,r.hz+' Hz');it.tracks[1].solo=false;
  check('Saved WAV length matches the recording',Math.abs(r.dur-it.dur)<0.1,r.dur.toFixed(2)+' vs '+it.dur.toFixed(2));
  T().openLibrary();await sleep(300);const chip=[...document.querySelectorAll('#libChips button')].find(b=>b.dataset.f==='audio');check('Library has an Audio filter',!!chip&&/Audio · \d+/.test(chip.textContent),chip&&chip.textContent);closeModal();
  q('#mImg').click();await sleep(300);check('Back to Image: mic bars switch off',window.__openMics===0,'open mics '+window.__openMics);check('Back to Image: Capture button and image settings return',q('#capLbl').textContent==='Capture'&&vis('#area')&&vis('#fxWrap'))},
async 'Audio editing: select, delete, split, trim, fades, undo, zoom'(){const q=s=>document.querySelector(s);
  const it=T().addAudio([{name:'Tones',blob:await QA.toneWav(),vol:1,mute:false,solo:false}],'QA three tones');await until(()=>document.querySelectorAll('.alane').length===1,6000);await sleep(250);
  const cv=q('.alane canvas'),r=cv.getBoundingClientRect(),X=t=>r.left+r.width*t/3,save=async()=>{__saved.length=0;await T().save('wav');await until(()=>__saved.length,8000);return QA.savedWav()};
  await QA.drag(X(1),r.top+30,X(2),r.top+30,8,cv);check('Dragging across the waveform selects that part',/0:01\.0 – 0:02\.0/.test(q('[data-r="sel"]').textContent),q('[data-r="sel"]').textContent);
  document.activeElement.blur();QA.key('Delete');await sleep(200);let b=await save();
  check('Delete removes the selection and closes the gap (300 Hz then 700 Hz)',Math.abs(b.duration-2)<0.02&&Math.abs(QA.pitch(b,.1,.9)-300)<10&&Math.abs(QA.pitch(b,1.1,1.9)-700)<10,b.duration.toFixed(2)+' s');
  check('The library shows the edited length',Math.abs(it.dur-2)<0.02,it.dur);
  QA.key('z',{ctrlKey:true});await sleep(250);b=await save();check('Ctrl+Z brings the deleted part back',Math.abs(b.duration-3)<0.02&&Math.abs(QA.pitch(b,1.1,1.9)-500)<10,b.duration.toFixed(2)+' s');
  const ru=q('[data-r="ruler"]'),rr=ru.getBoundingClientRect();ru.dispatchEvent(new PointerEvent('pointerdown',QA.ev(rr.left+rr.width/3,rr.top+10,1)));ru.dispatchEvent(new PointerEvent('pointerup',QA.ev(rr.left+rr.width/3,rr.top+10,0)));await sleep(80);
  check('Clicking the ruler moves the playhead (whole view kept after Undo)',/^0:01\.0 \/ 0:03\.0/.test(q('[data-r="time"]').textContent),q('[data-r="time"]').textContent);
  QA.key('s');await sleep(150);check('S splits at the playhead',it.edit.clips.length===2);
  cv.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,clientX:X(2.5),clientY:r.top+30}));await sleep(80);check('Double-click selects a whole piece',/0:01\.0 – 0:03\.0/.test(q('[data-r="sel"]').textContent),q('[data-r="sel"]').textContent);
  q('[data-a="trim"]').click();await sleep(250);b=await save();check('Trim to selection keeps only that part (500 Hz then 700 Hz)',Math.abs(b.duration-2)<0.02&&Math.abs(QA.pitch(b,.1,.9)-500)<10&&Math.abs(QA.pitch(b,1.1,1.9)-700)<10,b.duration.toFixed(2)+' s');
  const fi=q('[data-r="fi"]');fi.value='1';fi.dispatchEvent(new Event('change',{bubbles:true}));await sleep(150);b=await save();const d=b.getChannelData(0),rms=(t0,t1)=>{let s=0,n=0;for(let i=Math.floor(t0*b.sampleRate);i<t1*b.sampleRate;i++){s+=d[i]*d[i];n++}return Math.sqrt(s/n)};
  check('Fade in rises from silence',rms(0,.1)<0.1&&rms(.45,.55)>0.25&&rms(.45,.55)<0.5&&rms(1.4,1.6)>0.6,[rms(0,.1),rms(.45,.55),rms(1.4,1.6)].map(x=>x.toFixed(2)).join(' → '));
  q('[data-a="reset"]').click();await sleep(250);check('Reset edits goes back to the full recording',Math.abs(it.dur-3)<0.02&&it.edit.clips.length===1&&!it.edit.fi);
  q('[data-a="zin"]').click();await sleep(50);check('Zoom in enables Fit',!q('[data-a="zfit"]').disabled);q('[data-a="zfit"]').click();await sleep(50);check('Fit shows the whole recording',q('[data-a="zfit"]').disabled);
  QA.key('Home');QA.key('ArrowRight');QA.key('i');QA.key('ArrowRight');QA.key('o');await sleep(60);check('I and O set the selection at the playhead',/0:01\.0 – 0:02\.0/.test(q('[data-r="sel"]').textContent),q('[data-r="sel"]').textContent);
  QA.key('Escape');await sleep(40);check('Esc clears the selection',q('[data-a="del"]').disabled)},
async 'Regression: image editing and export'(){const it=fresh('QA regress',640,360,'#2a7');await sleep(150);T().snap();const a=T().newShape('arrow',50,50);a.x2=300;a.y2=200;it.shapes.push(a);T().render();
  const n=it.shapes.length;T().undo();check('Undo removes the arrow',it.shapes.length===n-1);T().redo();check('Redo restores the arrow',it.shapes.length===n);
  __saved.length=0;await T().save('png');await until(()=>__saved.length,5000);const b=new Blob([__saved[0].data],{type:'image/png'}),im=await createImageBitmap(b);check('PNG export has the picture size',im.width===640&&im.height===360,im.width+'x'+im.height);
  __saved.length=0;await T().save('jpg');await until(()=>__saved.length,5000);check('JPG export writes a file',__saved[0].size>1000&&__saved[0].name.endsWith('.jpg'))},
async 'Regression: GIF export from video'(){await QA.openVideo(2);const ctl=T().vid._ctl;__saved.length=0;document.querySelector('[data-tab="export"]').click();await sleep(100);
  const gw=document.querySelector('[data-r="gw"]');if(gw)gw.value=160;const fps=document.querySelector('[data-r="fps"]');if(fps)fps.value=5;ctl.saveGif();await until(()=>__saved.length,20000,100);
  const s=__saved[0];const u8=new Uint8Array(s.data);check('GIF export writes a real GIF',s.name.endsWith('.gif')&&u8[0]===0x47&&u8[1]===0x49&&u8[2]===0x46,s.name+' '+s.size)},
};
QA.runAll=async(only)=>{QA.results=[];const t0=performance.now();for(const [name,fn] of Object.entries(tests)){if(only&&!name.includes(only))continue;try{await fn()}catch(err){check(name+' — crashed',false,String(err&&err.stack||err).slice(0,300))}closeModal()}
  const fail=QA.results.filter(r=>!r.ok);return{passed:QA.results.length-fail.length,failed:fail.length,seconds:+((performance.now()-t0)/1000).toFixed(1),failures:fail,all:QA.results.map(r=>(r.ok?'PASS ':'FAIL ')+r.name+(r.detail!==''?'  ['+r.detail+']':''))}};
QA.tests=Object.keys(tests);
})();
