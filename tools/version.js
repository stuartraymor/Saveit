// Saveit version numbers. See VERSIONING.md for the rule.
//   node tools/version.js          show the current and next version, and check every file agrees
//   node tools/version.js bump     move every file to the next version and start its CHANGES file
//   node tools/version.js set X.Y.Z  move every file to an exact version (only for a deliberate reset)
//
// Rule: MAJOR.MINOR.PATCH, MINOR and PATCH each run 0..12.
// Every iteration adds one to PATCH. After .12 it goes back to 0 and MINOR goes up one;
// after MINOR .12 it goes back to 0 and MAJOR goes up one.
//   10.0.0 -> 10.0.1 -> ... -> 10.0.12 -> 10.1.0 -> ... -> 10.12.12 -> 11.0.0
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..'),MAX=12;
const parse=v=>{const m=/^(\d+)\.(\d+)\.(\d+)$/.exec(String(v).trim());if(!m)throw Error('Not a version: '+v);const n=m.slice(1).map(Number);if(n[1]>MAX||n[2]>MAX)throw Error(`${v}: minor and patch must be 0-${MAX}`);return n};
function next(v){let [a,b,c]=parse(v);if(++c>MAX){c=0;if(++b>MAX){b=0;a++}}return `${a}.${b}.${c}`}

// Every place the version is written. Each entry: file, pattern whose group 2 is the version.
const SPOTS=[
  ['app/package.json',/("version":\s*")(\d+\.\d+\.\d+)(")/],
  ['install.ps1',/(Saveit Setup  \(version )(\d+\.\d+\.\d+)(\))/],
  ['install.ps1',/(DisplayVersion ')(\d+\.\d+\.\d+)(')/],
  ['README.txt',/^(SAVEIT )(\d+\.\d+\.\d+)( - WINDOWS SETUP)/],
];
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
function found(){return SPOTS.map(([f,re])=>{const m=re.exec(read(f));return{f,v:m?m[2]:null}})}
function check(){const cur=JSON.parse(read('app/package.json')).version;parse(cur);const bad=found().filter(s=>s.v!==cur);return{cur,bad}}
function setAll(v){parse(v);for(const [f,re] of SPOTS){const s=read(f),t=s.replace(re,(_,a,__,c)=>a+v+c);if(t===s&&!re.test(s))throw Error('Version not found in '+f);fs.writeFileSync(path.join(ROOT,f),t)}
  const ch=path.join(ROOT,`CHANGES-${v}.md`);if(!fs.existsSync(ch))fs.writeFileSync(ch,`# Saveit ${v}\n\n- \n`)}

if(require.main===module){const [cmd,arg]=process.argv.slice(2);
  if(cmd==='bump'||cmd==='set'){const {cur,bad}=check();if(bad.length&&cmd==='bump'){console.error('Files disagree before bumping:',bad);process.exit(1)}
    const v=cmd==='bump'?next(cur):arg;setAll(v);console.log(`${cur} -> ${v}  (fill in CHANGES-${v}.md)`)}
  else{const {cur,bad}=check();console.log(`current ${cur}, next ${next(cur)}`);if(bad.length){console.error('Out of step:',bad);process.exit(1)}}}
module.exports={next,parse,check,MAX};
