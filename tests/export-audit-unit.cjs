const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),os=require('os');
(async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'saveit-export-test-')),main=fs.readFileSync(path.join(__dirname,'../app/main.js'),'utf8'),handlers={},choices=[],answers=[];let writes=0;
 const scope={fs,path,Buffer,workflowConfig:{},saveWorkflowConfig:async()=>{writes++},app:{getPath:k=>{assert.equal(k,'documents');return tmp}},win:{},dialog:{showSaveDialog:async(w,o)=>{choices.push(o);return answers.shift()},showMessageBox:async()=>({response:0})},ipcMain:{handle:(k,f)=>handlers[k]=f},FILTERS:{}};
 const begin=main.indexOf('// Export destinations are explicit'),end=main.indexOf('// 10.0.9: "Open folder"',begin);vm.createContext(scope);vm.runInContext(main.slice(begin,end),scope);
 try {
  const neutral=path.join(tmp,'Saveit Exports');answers.push({canceled:true});assert.equal(await handlers['save-pick'](null,'shot',['png']),null);assert.equal(choices[0].defaultPath,path.join(neutral,'shot.png'));assert.equal(writes,0);console.log('PASS fresh/cancelled export opens neutral folder without changing memory');
  const selected=path.join(tmp,'Chosen');fs.mkdirSync(selected);answers.push({filePath:path.join(selected,'shot.png')});assert.equal(await handlers['save-pick'](null,'shot',['png']),path.join(selected,'shot.png'));
  answers.push({canceled:true});await handlers['save-pick'](null,'next',['png']);assert.equal(choices.at(-1).defaultPath,path.join(selected,'next.png'));
  answers.push({canceled:true});await handlers['save-pick'](null,'movie',['mp4']);assert.equal(choices.at(-1).defaultPath,path.join(neutral,'movie.mp4'));console.log('PASS destination memory is per format');
  answers.push({filePath:path.join(selected,'report.pptx')});const corrected=await handlers.save(null,'report.pdf',Buffer.from('%PDF-1.4'));assert.equal(corrected,path.join(selected,'report.pdf'));assert.equal(fs.readFileSync(corrected,'utf8'),'%PDF-1.4');assert.equal(fs.existsSync(path.join(selected,'report.pptx')),false);console.log('PASS single-type export corrects mismatched extension');
  fs.writeFileSync(corrected,'original');answers.push({filePath:path.join(selected,'report.pptx')});assert.equal(await handlers.save(null,'report.pdf',Buffer.from('replacement')),null);assert.equal(fs.readFileSync(corrected,'utf8'),'original');console.log('PASS corrected target cannot overwrite an existing file without confirmation');
  answers.push({filePath:path.join(selected,'edit.jpg')});assert.equal(await handlers['save-pick'](null,'edit',['png','jpg']),path.join(selected,'edit.jpg'));console.log('PASS multi-type Save honors the chosen extension');
  const html=fs.readFileSync(path.join(__dirname,'../app/index.html'),'utf8'),f=html.slice(html.indexOf('async function pdfBlob('),html.indexOf('async function pdfFromImages('));
  const pdfScope={TextEncoder,Uint8Array,Blob,document:{createElement:()=>({getContext:()=>({fillRect(){},drawImage(){}}),toBlob:cb=>cb(new Blob([Uint8Array.from([255,216,255,217])]))})}};vm.createContext(pdfScope);vm.runInContext(f,pdfScope);
  const image=await pdfScope.pdfBlob([{width:556,height:326}],true);assert.match(await image.text(),/\/MediaBox \[0 0 417\.00 244\.50\]/);
  const guide=await pdfScope.pdfBlob([{width:556,height:326}]);assert.match(await guide.text(),/\/MediaBox \[0 0 612\.00 792\.00\]/);console.log('PASS screenshot PDF fits capture while guide fallback retains Letter pages');
 } finally {fs.rmSync(tmp,{recursive:true,force:true})}
 console.log('EXPORT AUDIT TESTS PASSED');
})().catch(e=>{console.error(e);process.exitCode=1});
