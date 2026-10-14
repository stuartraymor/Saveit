// Scrolling-capture stitcher. Frames are {data:Buffer|Uint8Array (4 bytes/pixel), w, h}.
function rowHashes(f){const {data,w,h}=f,out=new Int32Array(h),step=Math.max(1,Math.floor(w/64));
  for(let y=0;y<h;y++){let x0=y*w*4,hh=2166136261|0;for(let x=0;x<w;x+=step){const i=x0+x*4;hh=Math.imul(hh^data[i],16777619);hh=Math.imul(hh^data[i+1],16777619);hh=Math.imul(hh^data[i+2],16777619)}out[y]=hh}return out}
// How far did `b` scroll down relative to `a`? Returns {shift, score} (shift 0 = same picture, -1 = no match)
function findShift(ha,hb,minOverlap){const h=ha.length;let same=0;for(let y=0;y<h;y++)if(ha[y]===hb[y])same++;if(same>=h*.995)return{shift:0,score:1};
  let best=-1,bs=0;const lim=h-Math.max(8,minOverlap|0);
  for(let s=1;s<=lim;s++){const ov=h-s;let m=0;for(let y=0;y<ov;y++)if(ha[y+s]===hb[y])m++;const sc=m/ov;if(sc>bs+1e-9||(sc>=bs-1e-9&&sc>0.97&&best<0)){bs=sc;best=s}}
  return bs>=0.9?{shift:best,score:bs}:{shift:-1,score:bs}}
class Stitcher{constructor(){this.parts=[];this.prev=null;this.w=0;this.h=0;this.total=0;this.lastShift=0}
  add(f){const hs=rowHashes(f);
    if(!this.prev){this.w=f.w;this.h=f.h;this.parts.push({data:Buffer.from(f.data),rows:f.h});this.total=f.h;this.prev={hs,f};return{added:f.h,done:false,first:true}}
    const r=findShift(this.prev.hs,hs,Math.floor(f.h*.1));
    if(r.shift===0)return{added:0,done:true};
    if(r.shift<0)return{added:0,done:true,lost:true};
    const rows=r.shift,start=(f.h-rows)*f.w*4;this.parts.push({data:Buffer.from(f.data.subarray?f.data.subarray(start):f.data.slice(start)),rows});this.total+=rows;this.lastShift=rows;this.prev={hs,f};return{added:rows,done:false}}
  result(){const out=Buffer.alloc(this.w*this.total*4);let o=0;for(const p of this.parts){p.data.copy(out,o);o+=p.data.length}return{data:out,w:this.w,h:this.total}}}
module.exports={Stitcher,rowHashes,findShift};
