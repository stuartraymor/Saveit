// Tests that need no browser:  node tests/run-node-tests.js
// 1. every app script (and every inline <script> in the app's HTML pages) parses
// 2. scrolling-capture stitcher unit tests
const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process');
const APP=path.join(__dirname,'..','app');let fail=0;const ok=(m)=>console.log('PASS',m),bad=(m)=>{fail++;console.log('FAIL',m)};
for(const f of fs.readdirSync(APP).filter(f=>f.endsWith('.js'))){try{new vm.Script(fs.readFileSync(path.join(APP,f),'utf8'),{filename:f});ok('parses: '+f)}catch(e){bad(f+': '+e.message)}}
for(const f of fs.readdirSync(APP).filter(f=>f.endsWith('.html'))){const h=fs.readFileSync(path.join(APP,f),'utf8'),re=/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;let m,n=0;
  while((m=re.exec(h))){n++;try{new vm.Script(m[1],{filename:f+'#'+n})}catch(e){bad(f+' inline script '+n+': '+e.message)}}if(n)ok(`parses: ${f} (${n} inline script${n>1?'s':''})`)}
// every file index.html loads must exist
{const h=fs.readFileSync(path.join(APP,'index.html'),'utf8');for(const m of h.matchAll(/<script src="([^"]+)"/g)){fs.existsSync(path.join(APP,m[1]))?ok('exists: '+m[1]):bad('missing script '+m[1])}}
// line endings stay as they were (these files are CRLF in the repository)
for(const f of ['main.js','preload.js']){const s=fs.readFileSync(path.join(APP,f),'latin1'),lf=(s.match(/[^\r]\n/g)||[]).length;lf?bad(f+' has '+lf+' LF-only lines (should be CRLF)'):ok('CRLF kept: '+f)}
try{console.log(cp.execFileSync(process.execPath,[path.join(__dirname,'stitch.test.js')]).toString().trim());ok('stitch tests')}catch(e){bad('stitch tests\n'+(e.stdout||'')+(e.stderr||''))}
console.log(fail?`\n${fail} FAILED`:'\nALL NODE TESTS PASSED');process.exit(fail?1:0);
