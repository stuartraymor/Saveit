// Unit tests for the scrolling-capture stitcher.  Run: node tests/stitch.test.js
const assert=require('assert');const {Stitcher,findShift,rowHashes,rowSamples}=require('../app/stitch.js');
// A tall synthetic "page": 60 coloured rows of 44 px with a dark divider and some "text" blocks that differ per row.
function page(W,H){const d=new Uint8Array(W*H*4);for(let y=0;y<H;y++){const row=Math.floor(y/44),hue=row*13;for(let x=0;x<W;x++){const i=(y*W+x)*4;let r=200+((hue*7)%55),g=200+((hue*3)%55),b=200+((hue*11)%55);
  if(y%44>=42){r=g=b=24}else if(y%44>12&&y%44<30&&x>20&&x<40+((row*37)%300)&&((x>>2)%3)){r=g=b=30}d[i]=r;d[i+1]=g;d[i+2]=b;d[i+3]=255}}return d}
function crop(P,W,y0,h,{noise=0,header=0}={}){const d=new Uint8Array(W*h*4);for(let y=0;y<h;y++){const sy=y<header?y:y0+y;for(let x=0;x<W;x++){const i=(y*W+x)*4,j=(sy*W+x)*4;for(let k=0;k<3;k++){let v=P[j+k];if(noise){let q=Math.imul((x+1)*73856093^(sy+1)*19349663^(y0+7)*83492791^k,2654435761)>>>0;v=Math.max(0,Math.min(255,v+(q%(2*noise+1))-noise))};d[i+k]=v}d[i+3]=255}}return{data:d,w:W,h}}
function run(name,opts){const W=400,H=60*44,VH=500,P=page(W,H),st=new Stitcher();let y=0,steps=[0];while(y+VH<H){y=Math.min(H-VH,y+137+(steps.length%3)*41);steps.push(y)}
  for(const s of steps){const r=st.add(Buffer.from?{...crop(P,W,s,VH,opts),data:Buffer.from(crop(P,W,s,VH,opts).data)}:crop(P,W,s,VH,opts));assert(!r.done||r.added===0,name+': stopped early at '+s+' '+JSON.stringify(r))}
  const last=st.add({...crop(P,W,steps[steps.length-1],VH,opts),data:Buffer.from(crop(P,W,steps[steps.length-1],VH,opts).data)});assert(last.done&&!last.lost,name+': end of page not detected');
  assert.strictEqual(st.total,H,name+': stitched height '+st.total+' != page height '+H);console.log('pass',name,st.total+'px')}
run('pixel-identical frames',{});
run('re-rendered frames (DPI noise +-3)',{noise:3});
run('sticky 40px header + noise',{noise:2,header:40});
// unrelated frame must be reported as lost, not stitched
{const W=200,a={data:Buffer.alloc(W*300*4,40),w:W,h:300},b=crop(page(W,3000),W,900,300);const st=new Stitcher();st.add(a);const r=st.add({...b,data:Buffer.from(b.data)});assert(r.done&&r.lost,'unrelated frame should be lost');console.log('pass unrelated frame -> lost')}
console.log('stitch tests OK');
