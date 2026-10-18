// Scrolling-capture stitcher. Frames are {data:Buffer|Uint8Array (4 bytes/pixel), w, h}.
function rowHashes(f){const {data,w,h}=f,out=new Int32Array(h),step=Math.max(1,Math.floor(w/64));
  for(let y=0;y<h;y++){let x0=y*w*4,hh=2166136261|0;for(let x=0;x<w;x+=step){const i=x0+x*4;hh=Math.imul(hh^data[i],16777619);hh=Math.imul(hh^data[i+1],16777619);hh=Math.imul(hh^data[i+2],16777619)}out[y]=hh}return out}
// 9.8: a small colour sample of every row, used when rows are not pixel-identical after scrolling
// (fractional display scaling re-draws text slightly differently, smooth scrolling, fading scroll bars).
const SAMPLES=64;
function rowSamples(f){const {data,w,h}=f,out=new Uint8Array(h*SAMPLES*3);
  for(let y=0;y<h;y++){const r=y*w*4,o=y*SAMPLES*3;for(let s=0;s<SAMPLES;s++){const i=r+Math.min(w-1,Math.floor((s+.5)*w/SAMPLES))*4;out[o+s*3]=data[i];out[o+s*3+1]=data[i+1];out[o+s*3+2]=data[i+2]}}return out}
function rowDiff(sa,ya,sb,yb){let d=0;const a=ya*SAMPLES*3,b=yb*SAMPLES*3;for(let k=0;k<SAMPLES*3;k++){const v=sa[a+k]-sb[b+k];d+=v<0?-v:v}return d/(SAMPLES*3)}
// Fuzzy match: for each shift, average the closest 85% of rows (so a sticky header or footer does not spoil the match).
function fuzzyShift(sa,sb,h,minOverlap){const coarse=Math.max(1,Math.floor(h/240)),keep=.85;
  const trimmed=(s,step,kp=keep)=>{const ds=[];for(let y=0;y+s<h;y+=step)ds.push(rowDiff(sa,y+s,sb,y));if(ds.length<4)return 1e9;ds.sort((a,b)=>a-b);const n=Math.max(1,Math.floor(ds.length*kp));let t=0;for(let i=0;i<n;i++)t+=ds[i];return t/n};
  const same=trimmed(0,coarse);if(same<1.5)return{shift:0,score:1};
  let best=-1,bd=1e9;const lim=h-Math.max(8,minOverlap|0);for(let s=1;s<=lim;s++){const d=trimmed(s,coarse);if(d<bd){bd=d;best=s}}
  // refine on every row around the best coarse shift (sampling rows can make neighbouring shifts tie)
  if(best>0){const c=best;let fb=1e9;for(let s=Math.max(1,c-coarse-1);s<=Math.min(lim,c+coarse+1);s++){const d=trimmed(s,1,.98);if(d<fb){fb=d;best=s}}}
  return bd<9&&bd<same*.5?{shift:best,score:1-bd/255,fuzzy:true}:{shift:-1,score:0}}
// How far did `b` scroll down relative to `a`? Returns {shift, score} (shift 0 = same picture, -1 = no match)
function findShift(ha,hb,minOverlap,sa,sb){const h=ha.length;let same=0;for(let y=0;y<h;y++)if(ha[y]===hb[y])same++;if(same>=h*.995)return{shift:0,score:1};
  let best=-1,bs=0;const lim=h-Math.max(8,minOverlap|0);
  for(let s=1;s<=lim;s++){const ov=h-s;let m=0;for(let y=0;y<ov;y++)if(ha[y+s]===hb[y])m++;const sc=m/ov;if(sc>bs+1e-9||(sc>=bs-1e-9&&sc>0.97&&best<0)){bs=sc;best=s}}
  if(bs>=0.9)return{shift:best,score:bs};
  if(sa&&sb)return fuzzyShift(sa,sb,h,minOverlap);
  return{shift:-1,score:bs}}
class Stitcher{constructor(){this.parts=[];this.prev=null;this.w=0;this.h=0;this.total=0;this.lastShift=0}
  add(f){const hs=rowHashes(f),ss=rowSamples(f);
    if(!this.prev){this.w=f.w;this.h=f.h;this.parts.push({data:Buffer.from(f.data),rows:f.h});this.total=f.h;this.prev={hs,ss,f};return{added:f.h,done:false,first:true}}
    if(f.w!==this.w||f.h!==this.h)return{added:0,done:true,lost:true};
    const r=findShift(this.prev.hs,hs,Math.floor(f.h*.1),this.prev.ss,ss);
    if(r.shift===0)return{added:0,done:true};
    if(r.shift<0)return{added:0,done:true,lost:true};
    const rows=r.shift,start=(f.h-rows)*f.w*4;this.parts.push({data:Buffer.from(f.data.subarray?f.data.subarray(start):f.data.slice(start)),rows});this.total+=rows;this.lastShift=rows;this.prev={hs,ss,f};return{added:rows,done:false}}
  result(){const out=Buffer.alloc(this.w*this.total*4);let o=0;for(const p of this.parts){p.data.copy(out,o);o+=p.data.length}return{data:out,w:this.w,h:this.total}}}
module.exports={Stitcher,rowHashes,findShift,rowSamples};
