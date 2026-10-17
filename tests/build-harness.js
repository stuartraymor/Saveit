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
</script>`;
const handleNames=['undo','redo','snap','renderLib','renderProps','render','openItem','addImage','save','saveBlob','toast','libPrune','libVisible','libChosen','persist','renumber','newShape','exportCanvas','openLib','addVideo','commitText','openLibrary','renameItem','captureDesktop','FMT_NOTE'];
const handle=`\n// test handle (harness only)\nwindow.__T={get S(){return S},get libSel(){return typeof libSel!=='undefined'?libSel:null},get libQuery(){return libQuery},set libQuery(v){libQuery=v},get vid(){return typeof vid!=='undefined'?vid:null}};\n`+
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
console.log('harness written to',OUT);
