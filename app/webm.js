// Saveit 10.1.1: WebM files written by MediaRecorder have no Duration, so players can't show the length or seek.
//   WebmFix.fix(blob, ms)    writes the Duration into the file's Info block (only the first few KB are read; the rest is not copied)
//   WebmFix.ensure(blob)     the same, after measuring the length when the file doesn't have one
//   WebmFix.duration(blob)   the Duration stored in the file, in ms (0 when there is none)
// If the file is not laid out the way MediaRecorder writes it (for example it has a SeekHead), the original blob is returned unchanged.
(function(root){
const HEAD=16384,ID_EBML=0x1A45DFA3,ID_SEGMENT=0x18538067,ID_INFO=0x1549A966,ID_DURATION=0x4489,ID_TIMESCALE=0x2AD7B1,ID_SEEKHEAD=0x114D9B74,ID_CLUSTER=0x1F43B675;
function readId(b,p){if(p>=b.length)return null;const f=b[p];let len=1;while(len<=4&&!(f&(0x80>>(len-1))))len++;if(len>4||p+len>b.length)return null;let id=0;for(let i=0;i<len;i++)id=id*256+b[p+i];return{id,len}}
function readSize(b,p){if(p>=b.length)return null;const f=b[p];let len=1;while(len<=8&&!(f&(0x80>>(len-1))))len++;if(len>8||p+len>b.length)return null;
  const mask=(0x80>>(len-1))-1;let v=f&mask,allOnes=(f&mask)===mask;for(let i=1;i<len;i++){v=v*256+b[p+i];if(b[p+i]!==0xFF)allOnes=false}return{size:v,len,unknown:allOnes}}
function putSize(v,len){const out=new Uint8Array(len);let x=v;for(let i=len-1;i>=0;i--){out[i]=x%256;x=Math.floor(x/256)}if(x)return null;out[0]|=0x80>>(len-1);const max=Math.pow(2,7*len)-1;return v>=max?null:out}
// Finds what the patch needs: where the Segment and Info headers are, the timecode scale and any existing Duration.
function scan(b){let p=0,r=readId(b,p);if(!r||r.id!==ID_EBML)return null;let s=readSize(b,p+r.len);if(!s||s.unknown)return null;p+=r.len+s.len+s.size;
  r=readId(b,p);if(!r||r.id!==ID_SEGMENT)return null;s=readSize(b,p+r.len);if(!s)return null;const seg={sizePos:p+r.len,sizeLen:s.len,size:s.size,unknown:s.unknown};p+=r.len+s.len;
  while(p<b.length){r=readId(b,p);if(!r)return null;if(r.id===ID_SEEKHEAD||r.id===ID_CLUSTER)return null;s=readSize(b,p+r.len);if(!s||s.unknown)return null;
    if(r.id===ID_INFO){const info={pos:p,sizePos:p+r.len,sizeLen:s.len,size:s.size,start:p+r.len+s.len,end:p+r.len+s.len+s.size,scale:1000000,durationPos:-1,durationLen:0};if(info.end>b.length)return null;
      let q=info.start;while(q<info.end){const ci=readId(b,q);if(!ci)return null;const cs=readSize(b,q+ci.len);if(!cs||cs.unknown)return null;const vp=q+ci.len+cs.len;
        if(ci.id===ID_TIMESCALE){let v=0;for(let i=0;i<cs.size;i++)v=v*256+b[vp+i];info.scale=v||1000000}
        if(ci.id===ID_DURATION){info.durationPos=vp;info.durationLen=cs.size}q=vp+cs.size}
      // a SeekHead after Info would hold positions that shift when bytes are added, so leave such files alone
      let q2=info.end;while(q2<b.length){const ri=readId(b,q2);if(!ri||ri.id===ID_CLUSTER)break;if(ri.id===ID_SEEKHEAD)return null;const rs=readSize(b,q2+ri.len);if(!rs||rs.unknown)break;q2+=ri.len+rs.len+rs.size}
      return{seg,info}}
    p+=r.len+s.len+s.size}
  return null}
const view=b=>new DataView(b.buffer,b.byteOffset,b.byteLength);
function storedMs(b,sc){if(sc.info.durationPos<0)return 0;const dv=view(b),L=sc.info.durationLen;let t=0;if(L===8)t=dv.getFloat64(sc.info.durationPos);else if(L===4)t=dv.getFloat32(sc.info.durationPos);return isFinite(t)&&t>0?t*sc.info.scale/1e6:0}
async function head(blob){return new Uint8Array(await blob.slice(0,Math.min(blob.size,HEAD)).arrayBuffer())}
async function duration(blob){try{const b=await head(blob),sc=scan(b);return sc?storedMs(b,sc):0}catch(e){return 0}}
async function fix(blob,ms){try{if(!blob||!(ms>0)||!isFinite(ms))return blob;const b=await head(blob),sc=scan(b);if(!sc)return blob;if(storedMs(b,sc)>0)return blob;
  const ticks=ms*1e6/sc.info.scale,dur=new Uint8Array(11);dur[0]=0x44;dur[1]=0x89;dur[2]=0x88;view(dur).setFloat64(3,ticks);
  const {info,seg}=sc;let before,infoBody,after;
  if(info.durationPos>=0){ // an empty Duration element is already there (size 4 or 8): rewrite it in place
    const copy=new Uint8Array(b.subarray(0,info.end));if(info.durationLen===8)view(copy).setFloat64(info.durationPos,ticks);else if(info.durationLen===4)view(copy).setFloat32(info.durationPos,ticks);else return blob;
    return new Blob([copy,blob.slice(info.end)],{type:'video/webm'})}
  const newInfoSize=putSize(info.size+dur.length,info.sizeLen);if(!newInfoSize)return blob;
  const parts=[b.subarray(0,info.sizePos)];let segFix=null;
  if(!seg.unknown){segFix=putSize(seg.size+dur.length,seg.sizeLen);if(!segFix)return blob}
  if(segFix){const first=new Uint8Array(b.subarray(0,info.sizePos));first.set(segFix,seg.sizePos);parts[0]=first}
  parts.push(newInfoSize,b.subarray(info.start,info.end),dur,blob.slice(info.end));
  return new Blob(parts,{type:'video/webm'})}catch(e){return blob}}
// Measures a WebM that has no stored length by asking the browser to seek to the end.
function measure(blob){return new Promise(res=>{const v=document.createElement('video');v.preload='metadata';v.muted=true;const url=URL.createObjectURL(blob);let done=false;
  const fin=ms=>{if(done)return;done=true;try{URL.revokeObjectURL(url);v.removeAttribute('src');v.load()}catch(e){}res(ms)};
  v.onloadedmetadata=()=>{if(isFinite(v.duration)&&v.duration>0)return fin(v.duration*1000);v.ontimeupdate=()=>{if(isFinite(v.duration)&&v.duration>0){v.ontimeupdate=null;fin(v.duration*1000)}};try{v.currentTime=1e9}catch(e){fin(0)}};
  v.onerror=()=>fin(0);setTimeout(()=>fin(0),15000);v.src=url})}
const cache=new WeakMap();
async function ensure(blob){if(!blob)return blob;if(cache.has(blob))return cache.get(blob);let out=blob;
  try{if(!(await duration(blob))){const ms=await measure(blob);if(ms>0)out=await fix(blob,ms)}}catch(e){}cache.set(blob,out);return out}
root.WebmFix={fix,ensure,duration,measure};
})(window);
