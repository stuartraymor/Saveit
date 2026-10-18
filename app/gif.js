// Small animated-GIF writer (local palette per frame, LZW).
(function(root){
function quantize(rgba,n){const hist=new Uint32Array(32768),sr=new Float64Array(32768),sg=new Float64Array(32768),sb=new Float64Array(32768);
  for(let i=0;i<n;i++){const o=i*4,r=rgba[o],g=rgba[o+1],b=rgba[o+2],k=((r>>3)<<10)|((g>>3)<<5)|(b>>3);hist[k]++;sr[k]+=r;sg[k]+=g;sb[k]+=b}
  const keys=[];for(let k=0;k<32768;k++)if(hist[k])keys.push(k);keys.sort((a,b)=>hist[b]-hist[a]);
  const pal=new Uint8Array(768),m=Math.min(256,keys.length),pr=[],pg=[],pb=[];
  for(let i=0;i<m;i++){const k=keys[i],c=hist[k];pr.push(sr[k]/c);pg.push(sg[k]/c);pb.push(sb[k]/c);pal[i*3]=pr[i];pal[i*3+1]=pg[i];pal[i*3+2]=pb[i]}
  const map=new Int16Array(32768).fill(-1),idx=new Uint8Array(n);
  for(let i=0;i<n;i++){const o=i*4,r=rgba[o],g=rgba[o+1],b=rgba[o+2],k=((r>>3)<<10)|((g>>3)<<5)|(b>>3);let v=map[k];
    if(v<0){let best=1e9;v=0;const cr=(r&0xf8)+4,cg=(g&0xf8)+4,cb=(b&0xf8)+4;for(let j=0;j<m;j++){const d=(pr[j]-cr)*(pr[j]-cr)+(pg[j]-cg)*(pg[j]-cg)+(pb[j]-cb)*(pb[j]-cb);if(d<best){best=d;v=j}}map[k]=v}
    idx[i]=v}
  return{pal,idx}}
function lzw(px){const min=8,clear=256,eoi=257,out=[];let cur=0,bits=0,size=9,next=258,table=new Map();
  const emit=c=>{cur|=c<<bits;bits+=size;while(bits>=8){out.push(cur&255);cur>>=8;bits-=8}};
  emit(clear);let code=px[0];
  for(let i=1;i<px.length;i++){const k=px[i],key=(code<<8)|k,h=table.get(key);
    if(h!==undefined){code=h}else{emit(code);code=k;
      if(next===4096){emit(clear);next=258;size=9;table=new Map()}else{if(next>=(1<<size))size++;table.set(key,next++)}}}
  emit(code);emit(eoi);if(bits>0)out.push(cur&255);return out}
function GifWriter(w,h,loop){const parts=[];const u16=n=>[n&255,(n>>8)&255];
  parts.push(new Uint8Array([71,73,70,56,57,97,...u16(w),...u16(h),0x70,0,0, 0x21,0xFF,0x0B,...'NETSCAPE2.0'.split('').map(c=>c.charCodeAt(0)),3,1,...u16(loop?0:1),0]));
  return{addFrame(rgba,delayCs){const {pal,idx}=quantize(rgba,w*h),bytes=lzw(idx),blocks=[];
    for(let i=0;i<bytes.length;i+=255){const n=Math.min(255,bytes.length-i);blocks.push(n);for(let j=0;j<n;j++)blocks.push(bytes[i+j])}blocks.push(0);
    const head=new Uint8Array([0x21,0xF9,4,0x04,...u16(Math.max(2,delayCs)),0,0, 0x2C,0,0,0,0,...u16(w),...u16(h),0x87]);
    parts.push(head,pal,new Uint8Array([8]),new Uint8Array(blocks))},
   finish(){parts.push(new Uint8Array([0x3B]));return new Blob(parts,{type:'image/gif'})}}}
root.GifWriter=GifWriter;if(typeof module!=='undefined')module.exports={GifWriter,lzw,quantize};
})(typeof window!=='undefined'?window:globalThis);
