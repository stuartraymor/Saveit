// Builds a browser-testable copy of the app: node tests/build-harness.js <outDir>
// - window.bench (the Electron bridge) is replaced by a stub that records saves in window.__saved
// - window.__T exposes editor internals (state object and a few functions) for the automated UI tests
// The real app folder is never modified.
const fs=require('fs'),path=require('path');
const APP=path.join(__dirname,'..','app'),OUT=path.resolve(process.argv[2]||'harness');
fs.rmSync(OUT,{recursive:true,force:true});fs.cpSync(APP,OUT,{recursive:true});
const stub=`<script>
window.__saved=[];window.__toasts=[];
(function(){const ok=v=>()=>Promise.resolve(v),noop=()=>{};
const api={appVersion:ok('test'),workflowConfig:ok({}),saveWorkflows:ok(true),readClipboard:ok(null),capture:ok(null),prepareRecord:ok(null),ocr:ok({lines:[]}),
  copyImage:ok(true),copyFile:ok(true),copyEditable:ok(true),printPdf:ok(null),saveMany:ok([]),quickMarkup:ok(null),ocrLayout:ok(null),printImage:ok(null),
  savePick:(name,exts)=>Promise.resolve('C:\\\\test\\\\'+name+'.'+((exts&&exts[0])||'png')),
  save:async(name,data,target)=>{const p=target||('C:\\\\test\\\\'+name);window.__saved.push({name,path:p,size:data.byteLength,data});return p}};
window.bench=new Proxy(api,{get:(t,k)=>k in t?t[k]:(String(k).startsWith('on')?noop:(()=>Promise.resolve(null)))});
const t0=window.setTimeout;})();
// two fake microphones (test tones) so audio recording can be tested without real devices
(function(){const md=navigator.mediaDevices;if(!md)return;const devs=[{deviceId:'default',kind:'audioinput',label:'Default - Test Mic A',groupId:'a'},{deviceId:'micA',kind:'audioinput',label:'Test Mic A',groupId:'a'},{deviceId:'micB',kind:'audioinput',label:'Test Mic B',groupId:'b'}];
 md.enumerateDevices=async()=>devs.map(d=>({...d}));window.__openMics=0;
 md.getUserMedia=async c=>{if(c&&c.video)throw new DOMException('no camera','NotFoundError');const id=(c&&c.audio&&c.audio.deviceId&&c.audio.deviceId.exact)||'micA';const ac=new AudioContext();try{await ac.resume()}catch(_){}
  const o=ac.createOscillator(),g=ac.createGain(),d=ac.createMediaStreamDestination();o.frequency.value=id==='micB'?660:440;g.gain.value=id==='micB'?.2:.5;o.connect(g);g.connect(d);o.start();
  const tr=d.stream.getAudioTracks()[0];Object.defineProperty(tr,'label',{value:id==='micB'?'Test Mic B':'Test Mic A'});window.__openMics++;const stop=tr.stop.bind(tr);tr.stop=()=>{if(tr.readyState!=='ended')window.__openMics--;stop();ac.close().catch(()=>{})};return d.stream};})();
</script>`;
const handleNames=['undo','redo','snap','renderLib','renderProps','render','openItem','addImage','save','saveBlob','toast','libPrune','libVisible','libChosen','persist','renumber','newShape','exportCanvas','openLib','addVideo','commitText','openLibrary','renameItem','captureDesktop','FMT_NOTE','addAudio','startAudioRec','setTool','selBox','bbox','handles','scale','padX','padY','applyZoom','cutRegion','persistNow','recordItem','dbRead','hydrate','group9','hit','newGuide','makeStep','toastSaved','pptx33','stepTitleFrom','onStepType','beginRecording','grabTextFrom'];
handleNames.push('selectedShapes','orderStep9','flattenImage','copyMediaClip','pasteMediaClip','mediaTimelineMenu','recordItem','dbRead','persistNow');
const handle=`\n// test handle (harness only)\nwindow.__T={get S(){return S},get audio(){return typeof aud!=='undefined'?aud?.ctl:null},get libSel(){return typeof libSel!=='undefined'?libSel:null},get libQuery(){return libQuery},set libQuery(v){libQuery=v},get vid(){return typeof vid!=='undefined'?vid:null},get rec(){return rec},get stepGuide(){return stepGuide},set stepGuide(v){stepGuide=v}};\n`+
  handleNames.map(n=>`try{window.__T.${n}=${n}}catch(_){}`).join('\n')+'\n';
let html=fs.readFileSync(path.join(OUT,'index.html'),'utf8');
html=html.replace('<head>','<head>'+stub);
const end='})();\n})();\n</script>';const i=html.lastIndexOf(end);if(i<0)throw new Error('IIFE end not found');
html=html.slice(0,i)+handle+html.slice(i);
// record toasts for assertions
html=html.replace('function toast(msg,ms=3200){','function toast(msg,ms=3200){try{window.__toasts.push(String(msg))}catch(_){}');
for(const f of ['harness-helpers.js','ui-tests.js'])fs.copyFileSync(path.join(__dirname,f),path.join(OUT,f));
{const b=html.lastIndexOf('</body>');html=html.slice(0,b)+`<script src="harness-helpers.js?v=${Date.now()}"></script>\n<script src="ui-tests.js?v=${Date.now()}"></script>\n`+html.slice(b)}
fs.writeFileSync(path.join(OUT,'index.html'),html);
// every local script and stylesheet gets a version stamp, so the browser can never use an older copy
{const v=Date.now(),bust=h=>h.replace(/(<script src=")([\w.-]+\.js)(")/g,`$1$2?v=${v}$3`).replace(/(href=")([\w.-]+\.css)(")/g,`$1$2?v=${v}$3`).replace(/l\.href='capbar\.css'/g,`l.href='capbar.css?v=${v}'`);
 for(const f of ['index.html','widget.html']){const p=path.join(OUT,f);fs.writeFileSync(p,bust(fs.readFileSync(p,'utf8')))}}
// the recording bar, with its bridge stubbed (levels can be pushed with window.__lv([..]))
{const p=path.join(OUT,'recbar.html');let h=fs.readFileSync(p,'utf8');h=h.replace('<head>',`<head><script>window.__cmds=[];let __lvFn=null;window.recbar={cmd:c=>window.__cmds.push(c),onState:fn=>{window.__st=fn},onLevel:fn=>{__lvFn=fn}};window.__lv=a=>__lvFn&&__lvFn(a);</script>`);fs.writeFileSync(p,h)}
// the capture widget, with its bridge stubbed (it records what it would send in window.__w)
{const mics=stub.slice(stub.indexOf('// two fake microphones'),stub.lastIndexOf('</script>'));
 const w=`<script>window.__w={opts:null,go:null,size:null};window.widget={onInit:fn=>setTimeout(()=>fn(JSON.parse(localStorage.getItem('saveit.widgetInit')||'{}')),50),opts:o=>{window.__w.opts=o},go:o=>{window.__w.go=o},editor:()=>{},camSettings:()=>{},appVersion:()=>Promise.resolve('test'),size:(w,h)=>{window.__w.size=[w,h]}};\n${mics}</script>`;
 let wh=fs.readFileSync(path.join(OUT,'widget.html'),'utf8');wh=wh.replace('<head>','<head>'+w);fs.writeFileSync(path.join(OUT,'widget.html'),wh)}
console.log('harness written to',OUT);
