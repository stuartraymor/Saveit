// Saveit 10.1.9: pieces for saving edited videos frame by frame (no real-time recording).
//   VExport.demux(blob)            reads the video track of a WebM or MP4 file: codec, size and every encoded frame
//   VExport.frames(track)          a frame reader: await r.at(microseconds) gives the decoded picture shown at that time
//   VExport.mp4(...) / .webm(...)  write encoded video and audio into an MP4 (H.264 + AAC/Opus) or WebM (VP9/VP8 + Opus) file
//   VExport.stretch(chs, speed)    changes the speed of PCM audio without changing its pitch (for sped-up or slowed clips)
(function(root){
'use strict';
const u8=x=>x instanceof Uint8Array?x:new Uint8Array(x);
const cat=parts=>{let n=0;for(const p of parts)n+=p.length;const o=new Uint8Array(n);let i=0;for(const p of parts){o.set(p,i);i+=p.length}return o};
const hex2=v=>v.toString(16).padStart(2,'0');

// ---------- WebM reading ----------
function ebmlId(b,p){const f=b[p];let n=1;while(n<=4&&!(f&(0x80>>(n-1))))n++;if(n>4||p+n>b.length)return null;let v=0;for(let i=0;i<n;i++)v=v*256+b[p+i];return{v,n}}
function ebmlSize(b,p){const f=b[p];let n=1;while(n<=8&&!(f&(0x80>>(n-1))))n++;if(n>8||p+n>b.length)return null;const m=(0x80>>(n-1))-1;let v=f&m,ones=v===m;for(let i=1;i<n;i++){v=v*256+b[p+i];if(b[p+i]!==0xFF)ones=false}return{v,n,unknown:ones}}
const ebmlUint=(b,p,n)=>{let v=0;for(let i=0;i<n;i++)v=v*256+b[p+i];return v};
const CLUSTER_KIDS=new Set([0xE7,0xA3,0xA0,0xA7,0xAB,0x5854]);
function demuxWebm(b){let p=0;const h=ebmlId(b,0);if(!h||h.v!==0x1A45DFA3)return null;
  const hs=ebmlSize(b,h.n);p=h.n+hs.n+hs.v;const seg=ebmlId(b,p);if(!seg||seg.v!==0x18538067)return null;const ss=ebmlSize(b,p+seg.n);let q=p+seg.n+ss.n;const segEnd=ss.unknown?b.length:Math.min(b.length,q+ss.v);
  let scale=1e6;const tracks={};const samples=[];
  const kids=(s,e,fn)=>{let i=s;while(i<e){const id=ebmlId(b,i);if(!id)break;const sz=ebmlSize(b,i+id.n);if(!sz)break;const d=i+id.n+sz.n,de=sz.unknown?e:Math.min(e,d+sz.v);fn(id.v,d,de);i=de}};
  while(q<segEnd){const id=ebmlId(b,q);if(!id)break;const sz=ebmlSize(b,q+id.n);if(!sz)break;const d=q+id.n+sz.n;
    if(id.v===0x1F43B675){// Cluster (MediaRecorder writes these with unknown size)
      let tc=0,i=d;const end=sz.unknown?segEnd:Math.min(segEnd,d+sz.v);
      while(i<end){const cid=ebmlId(b,i);if(!cid||!CLUSTER_KIDS.has(cid.v))break;const cs=ebmlSize(b,i+cid.n);if(!cs||cs.unknown)break;const cd=i+cid.n+cs.n,ce=cd+cs.v;
        if(cid.v===0xE7)tc=ebmlUint(b,cd,cs.v);
        else if(cid.v===0xA3)block(cd,ce,tc,null);
        else if(cid.v===0xA0){let blk=null,ref=false;kids(cd,ce,(k,kd,ke)=>{if(k===0xA1)blk=[kd,ke];if(k===0xFB)ref=true});if(blk)block(blk[0],blk[1],tc,!ref)}
        i=ce}
      q=i;continue}
    const de=sz.unknown?segEnd:Math.min(segEnd,d+sz.v);
    if(id.v===0x1549A966)kids(d,de,(k,kd,ke)=>{if(k===0x2AD7B1)scale=ebmlUint(b,kd,ke-kd)});
    else if(id.v===0x1654AE6B)kids(d,de,(k,kd,ke)=>{if(k!==0xAE)return;const t={};kids(kd,ke,(f,fd,fe)=>{
      if(f===0xD7)t.num=ebmlUint(b,fd,fe-fd);else if(f===0x83)t.type=ebmlUint(b,fd,fe-fd);else if(f===0x86)t.codecId=new TextDecoder().decode(b.subarray(fd,fe));else if(f===0x63A2)t.priv=b.slice(fd,fe);
      else if(f===0xE0)kids(fd,fe,(v,vd,ve)=>{if(v===0xB0)t.w=ebmlUint(b,vd,ve-vd);if(v===0xBA)t.h=ebmlUint(b,vd,ve-vd)})});tracks[t.num]=t});
    q=de}
  function block(s,e,tc,keyOverride){const tn=ebmlSize(b,s);if(!tn)return;const t=tracks[tn.v];if(!t||t.type!==1)return;const rel=((b[s+tn.n]<<8)|b[s+tn.n+1])<<16>>16,fl=b[s+tn.n+2];if(fl&0x06)return;// laced video is not written by browsers
    samples.push({pts:Math.round((tc+rel)*scale/1000),key:keyOverride==null?!!(fl&0x80):keyOverride,data:b.subarray(s+tn.n+3,e)})}
  const vt=Object.values(tracks).find(t=>t.type===1);if(!vt||!samples.length)return null;
  let codec=null,description;
  if(vt.codecId==='V_VP9')codec='vp09.00.10.08';else if(vt.codecId==='V_VP8')codec='vp8';else if(vt.codecId==='V_MPEG4/ISO/AVC'&&vt.priv){codec='avc1.'+hex2(vt.priv[1])+hex2(vt.priv[2])+hex2(vt.priv[3]);description=vt.priv}else if(vt.codecId==='V_AV1')codec='av01.0.08M.08';
  if(!codec)return null;samples.sort((a,b)=>a.pts-b.pts);for(let i=0;i<samples.length;i++)samples[i].dur=i+1<samples.length?samples[i+1].pts-samples[i].pts:33333;
  return{codec,description,w:vt.w,h:vt.h,samples,order:'pts'}}

// ---------- MP4 reading (ordinary and fragmented, as MediaRecorder writes) ----------
function demuxMp4(b){const dv=new DataView(b.buffer,b.byteOffset,b.byteLength);const U32=p=>dv.getUint32(p),U16=p=>dv.getUint16(p),U64=p=>U32(p)*4294967296+U32(p+4),typ=p=>String.fromCharCode(b[p],b[p+1],b[p+2],b[p+3]);
  const boxes=(s,e,fn)=>{let p=s;while(p+8<=e){let sz=U32(p),hd=8;const t=typ(p+4);if(sz===1){sz=U64(p+8);hd=16}else if(sz===0)sz=e-p;if(sz<hd||p+sz>e)break;fn(t,p+hd,p+sz,p);p+=sz}};
  const find=(s,e,path)=>{let r=null;boxes(s,e,(t,d,en)=>{if(r)return;if(t===path[0])r=path.length===1?[d,en]:find(d,en,path.slice(1))});return r};
  if(typ(4)!=='ftyp')return null;let moov=null;boxes(0,b.length,(t,d,e)=>{if(t==='moov')moov=[d,e]});if(!moov)return null;
  let vt=null;boxes(moov[0],moov[1],(t,d,e)=>{if(t!=='trak'||vt)return;const hd=find(d,e,['mdia','hdlr']);if(!hd||typ(hd[0]+8)!=='vide')return;
    const tk=find(d,e,['tkhd']),md=find(d,e,['mdia','mdhd']),st=find(d,e,['mdia','minf','stbl']);const v=b[tk[0]];vt={id:v===1?U32(tk[0]+20):U32(tk[0]+12),ts:b[md[0]]===1?U32(md[0]+20):U32(md[0]+12),stbl:st}});
  if(!vt||!vt.stbl)return null;const [ss,se]=vt.stbl;let codec=null,description=null,w=0,h=0;
  const sd=find(ss,se,['stsd']);if(sd){const ep=sd[0]+8,et=typ(ep+4);w=U16(ep+8+24);h=U16(ep+8+26);boxes(ep+8+78,ep+U32(ep),(t,d,e)=>{if(t==='avcC'){description=b.slice(d,e);codec=(et==='avc3'?'avc3.':'avc1.')+hex2(b[d+1])+hex2(b[d+2])+hex2(b[d+3])}else if(t==='vpcC'){codec='vp09.'+hex2(b[d+4]).padStart(2,'0')+'.'+String(b[d+5]).padStart(2,'0')+'.'+String(b[d+6]>>4).padStart(2,'0')}else if(t==='hvcC'){description=b.slice(d,e);codec='hvc1.1.6.L93.B0'}});if(!codec&&et==='vp08')codec='vp8'}
  if(!codec)return null;const samples=[],scale=1e6/vt.ts;
  // ordinary sample tables
  {const tab=n=>find(ss,se,[n]);const stts=tab('stts'),stsz=tab('stsz'),stsc=tab('stsc'),stco=tab('stco')||tab('co64'),co64=!!tab('co64'),stss=tab('stss'),ctts=tab('ctts');
   if(stts&&stsz&&stsc&&stco&&U32(stsz[0]+8)){const n=U32(stsz[0]+8),fixed=U32(stsz[0]+4),size=i=>fixed||U32(stsz[0]+12+i*4);
     const durs=[];for(let i=0,c=U32(stts[0]+4);i<c;i++){const k=U32(stts[0]+8+i*8),d=U32(stts[0]+12+i*8);for(let j=0;j<k;j++)durs.push(d)}
     const cts=[];if(ctts){const v1=b[ctts[0]]===1;for(let i=0,c=U32(ctts[0]+4);i<c;i++){const k=U32(ctts[0]+8+i*8);let o=U32(ctts[0]+12+i*8);if(v1&&o>0x7fffffff)o-=4294967296;for(let j=0;j<k;j++)cts.push(o)}}
     const sync=stss?new Set(Array.from({length:U32(stss[0]+4)},(_,i)=>U32(stss[0]+8+i*4)-1)):null;
     const nch=U32(stco[0]+4),off=i=>co64?U64(stco[0]+8+i*8):U32(stco[0]+8+i*4),runs=Array.from({length:U32(stsc[0]+4)},(_,i)=>({first:U32(stsc[0]+8+i*12)-1,per:U32(stsc[0]+12+i*12)}));
     let si=0,dts=0;for(let r=0;r<runs.length;r++){const last=r+1<runs.length?runs[r+1].first:nch;for(let c=runs[r].first;c<last&&si<n;c++){let p=off(c);for(let k=0;k<runs[r].per&&si<n;k++,si++){const sz=size(si);
       samples.push({pts:Math.round((dts+(cts[si]||0))*scale),dur:Math.round((durs[si]||0)*scale),key:sync?sync.has(si):true,data:b.subarray(p,p+sz)});dts+=durs[si]||0;p+=sz}}}}}
  // fragments (moof + mdat)
  let trex={dur:0,size:0,flags:0};{const mv=find(moov[0],moov[1],['mvex']);if(mv)boxes(mv[0],mv[1],(t,d)=>{if(t==='trex'&&U32(d+4)===vt.id)trex={dur:U32(d+12),size:U32(d+16),flags:U32(d+20)}})}
  boxes(0,b.length,(t,d,e,start)=>{if(t!=='moof')return;boxes(d,e,(tt,td,te)=>{if(tt!=='traf')return;let base=start,def={...trex},tid=-1,bdt=null;
    boxes(td,te,(x,xd)=>{if(x==='tfhd'){const fl=U32(xd)&0xffffff;let p=xd+4;tid=U32(p);p+=4;if(fl&1){base=U64(p);p+=8}if(fl&2)p+=4;if(fl&8){def.dur=U32(p);p+=4}if(fl&0x10){def.size=U32(p);p+=4}if(fl&0x20){def.flags=U32(p);p+=4}}
      if(x==='tfdt')bdt=b[xd]===1?U64(xd+4):U32(xd+4)});if(tid!==vt.id)return;let dts=bdt!=null?bdt:(samples.length?Math.round((samples[samples.length-1].dtsRaw||0)):0);
    boxes(td,te,(x,xd)=>{if(x!=='trun')return;const ver=b[xd],fl=U32(xd)&0xffffff;let p=xd+4;const n=U32(p);p+=4;let doff=0;if(fl&1){doff=dv.getInt32(p);p+=4}let first=null;if(fl&4){first=U32(p);p+=4}let dp=base+doff;
      for(let i=0;i<n;i++){let dur=def.dur,sz=def.size,f=i===0&&first!=null?first:def.flags,co=0;if(fl&0x100){dur=U32(p);p+=4}if(fl&0x200){sz=U32(p);p+=4}if(fl&0x400){f=U32(p);p+=4}if(fl&0x800){co=ver===1?dv.getInt32(p):U32(p);p+=4}
        samples.push({pts:Math.round((dts+co)*scale),dur:Math.round(dur*scale),key:!(f&0x10000),data:b.subarray(dp,dp+sz),dtsRaw:dts+dur});dts+=dur;dp+=sz}})})});
  if(!samples.length)return null;return{codec,description,w,h,samples,order:'dts'}}

async function demux(blob){const b=u8(await blob.arrayBuffer());let r=null;try{r=demuxWebm(b)}catch(_){r=null}if(!r)try{r=demuxMp4(b)}catch(_){r=null}if(!r)return null;
  try{const ok=await VideoDecoder.isConfigSupported({codec:r.codec,description:r.description||undefined});if(!ok.supported)return null}catch(_){return null}
  // frames per second, from the typical gap between frames
  const ps=r.samples.map(s=>s.pts).sort((a,b)=>a-b),gaps=[];for(let i=1;i<ps.length&&i<400;i++)if(ps[i]>ps[i-1])gaps.push(ps[i]-ps[i-1]);gaps.sort((a,b)=>a-b);const g=gaps[gaps.length>>1];r.fps=g?1e6/g:30;
  const t0=Math.min(...ps.slice(0,50));r.start=t0;r.keys=[];r.samples.forEach((s,i)=>{if(s.key)r.keys.push(i)});return r}

// ---------- frame reader ----------
// Decodes forward from the nearest keyframe and keeps only the frames it still needs. at(us) returns {img,w,h} for the frame shown at us.
function frames(tr){let dec=null,q=[],next=0,cur=null,flushed=false,err=null,wake=null;const S=tr.samples,keyPts=tr.keys.map(i=>S[i].pts),half=Math.max(1000,(1e6/(tr.fps||30))/2);
  const kick=()=>{const w=wake;wake=null;w&&w()},nap=()=>new Promise(r=>{wake=r;setTimeout(r,250)});
  function open(i){for(const f of q)f.close();q=[];if(cur){cur.close();cur=null}try{dec&&dec.state!=='closed'&&dec.close()}catch(_){}err=null;flushed=false;
    dec=new VideoDecoder({output:f=>{q.push(f);kick()},error:e=>{err=e;kick()}});dec.configure({codec:tr.codec,description:tr.description||undefined,optimizeForLatency:false});next=tr.keys[i]}
  function keyFor(us){let lo=0,hi=keyPts.length-1,k=0;while(lo<=hi){const m=(lo+hi)>>1;if(keyPts[m]<=us+half){k=m;lo=m+1}else hi=m-1}return k}
  async function at(us){us+=tr.start;const k=keyFor(us),cp=cur?cur.timestamp:-Infinity;
    if(!dec||us<cp-half||tr.keys[k]>next||(err&&!q.length))open(k);
    let idle=0;
    for(;;){if(err)throw err;q.sort((a,b)=>a.timestamp-b.timestamp);
      // release frames we have already passed while decoding forward (a decoder only has a few picture buffers)
      let li=-1;for(let i=0;i<q.length;i++)if(q[i].timestamp<=us+half)li=i;if(li>0){for(let i=0;i<li;i++)q[i].close();q=q.slice(li)}
      if(q.some(f=>f.timestamp>us+half))break;
      if(next<S.length){if(dec.decodeQueueSize>3){const n0=q.length;await nap();if(q.length===n0&&dec.decodeQueueSize>3){if(++idle>20)throw Error('The video decoder stopped responding.')}else idle=0;continue}const s=S[next++];dec.decode(new EncodedVideoChunk({type:s.key?'key':'delta',timestamp:s.pts,duration:s.dur||undefined,data:s.data}));if(dec.decodeQueueSize>1)await nap();continue}
      if(!flushed){flushed=true;try{await dec.flush()}catch(e){if(!q.length&&!cur)throw e}continue}break}
    let pick=-1;for(let i=0;i<q.length;i++)if(q[i].timestamp<=us+half)pick=i;
    if(pick>=0){if(cur)cur.close();cur=q[pick];for(let i=0;i<pick;i++)q[i].close();q=q.slice(pick+1)}else if(!cur&&q.length){cur=q.shift()}
    return cur?{img:cur,w:cur.displayWidth,h:cur.displayHeight}:null}
  function close(){for(const f of q)f.close();q=[];if(cur)cur.close();cur=null;try{dec&&dec.state!=='closed'&&dec.close()}catch(_){}dec=null}
  return{at,close,fps:tr.fps}}

// ---------- WebM writing ----------
const idB=id=>{const o=[];let v=id;while(v>0){o.unshift(v&255);v=Math.floor(v/256)}return o};
function szB(n,len){if(!len){len=1;while(len<8&&n>=Math.pow(2,7*len)-1)len++}const o=new Uint8Array(len);let x=n;for(let i=len-1;i>=0;i--){o[i]=x%256;x=Math.floor(x/256)}o[0]|=0x80>>(len-1);return o}
const el=(id,...parts)=>{const body=cat(parts.map(u8));return cat([new Uint8Array(idB(id)),szB(body.length),body])};
const uintB=(v,len)=>{if(!len){len=1;while(len<8&&v>=Math.pow(256,len))len++}const o=new Uint8Array(len);let x=v;for(let i=len-1;i>=0;i--){o[i]=x%256;x=Math.floor(x/256)}return o};
const elU=(id,v,len)=>el(id,uintB(v,len)),elF=(id,v)=>{const o=new Uint8Array(8);new DataView(o.buffer).setFloat64(0,v);return el(id,o)},elS=(id,s)=>el(id,new TextEncoder().encode(s));
function opusHead(ch,pre,rate){const o=new Uint8Array(19);o.set(new TextEncoder().encode('OpusHead'));o[8]=1;o[9]=ch;new DataView(o.buffer).setUint16(10,pre,true);new DataView(o.buffer).setUint32(12,rate,true);return o}
// video/audio: {chunks:[{ts(us),data,key}], ...}; returns a Blob
function webm({video,audio,durationMs,app='Saveit'}){
  const vtr=el(0xAE,elU(0xD7,1),elU(0x73C5,1+Math.floor(Math.random()*1e9)),elU(0x83,1),elU(0x9C,0),elS(0x86,video.codecId),el(0xE0,elU(0xB0,video.w),elU(0xBA,video.h)));
  const atr=audio?el(0xAE,elU(0xD7,2),elU(0x73C5,2+Math.floor(Math.random()*1e9)),elU(0x83,2),elU(0x9C,0),elS(0x86,'A_OPUS'),el(0x63A2,audio.head||opusHead(audio.channels,audio.preskip||312,audio.rate)),elU(0x56AA,Math.round((audio.preskip||312)/audio.rate*1e9)),elU(0x56BB,80000000),el(0xE1,elF(0xB5,audio.rate),elU(0x9F,audio.channels))):new Uint8Array(0);
  const info=el(0x1549A966,elU(0x2AD7B1,1000000),elS(0x4D80,app),elS(0x5741,app),elF(0x4489,durationMs)),tracks=el(0x1654AE6B,vtr,atr);
  // interleave by time; a new cluster starts at each video keyframe (or after 30 s)
  const all=[...video.chunks.map(c=>({...c,tn:1})),...(audio?audio.chunks.map(c=>({...c,tn:2,key:true})):[])].sort((a,b)=>a.ts-b.ts||a.tn-b.tn);
  const clusters=[],cues=[];let curr=null;
  const flush=()=>{if(curr){clusters.push({tc:curr.tc,bytes:el(0x1F43B675,elU(0xE7,curr.tc),...curr.blocks),key:curr.key});curr=null}};
  for(const c of all){const ms=Math.round(c.ts/1000);if(!curr||(c.tn===1&&c.key)||ms-curr.tc>30000){flush();curr={tc:ms,blocks:[],key:c.tn===1&&c.key}}
    const rel=ms-curr.tc,hd=new Uint8Array(4);hd[0]=0x80|c.tn;hd[1]=(rel>>8)&255;hd[2]=rel&255;hd[3]=c.key?0x80:0;curr.blocks.push(el(0xA3,hd,c.data))}flush();
  // segment layout: SeekHead, Info, Tracks, Clusters, Cues (seek positions use fixed 8-byte numbers so sizes are known in advance)
  const seekEntry=(id,pos)=>el(0x4DBB,el(0x53AB,new Uint8Array(idB(id))),elU(0x53AC,pos,8));const shLen=el(0x114D9B74,seekEntry(0x1549A966,0),seekEntry(0x1654AE6B,0),seekEntry(0x1C53BB6B,0)).length;
  let pos=shLen+info.length+tracks.length;const cpos=[];for(const c of clusters){cpos.push(pos);pos+=c.bytes.length}
  clusters.forEach((c,i)=>{if(c.key)cues.push(el(0xBB,elU(0xB3,c.tc),el(0xB7,elU(0xF7,1),elU(0xF1,cpos[i]))))});
  const cuesB=el(0x1C53BB6B,...cues),seek=el(0x114D9B74,seekEntry(0x1549A966,shLen),seekEntry(0x1654AE6B,shLen+info.length),seekEntry(0x1C53BB6B,pos));
  const body=[seek,info,tracks,...clusters.map(c=>c.bytes),cuesB],segLen=body.reduce((n,x)=>n+x.length,0);
  const ebml=el(0x1A45DFA3,elU(0x4286,1),elU(0x42F7,1),elU(0x42F2,4),elU(0x42F3,8),elS(0x4282,'webm'),elU(0x4287,4),elU(0x4285,2));
  return new Blob([ebml,new Uint8Array([0x18,0x53,0x80,0x67]),szB(segLen,8),...body],{type:'video/webm'})}

// ---------- MP4 writing ----------
const be32=v=>{const o=new Uint8Array(4);new DataView(o.buffer).setUint32(0,v>>>0);return o},be16=v=>{const o=new Uint8Array(2);new DataView(o.buffer).setUint16(0,v&65535);return o},be64=v=>cat([be32(Math.floor(v/4294967296)),be32(v%4294967296)]);
const box=(t,...parts)=>{const body=cat(parts.map(u8));return cat([be32(body.length+8),new TextEncoder().encode(t),body])},full=(t,v,f,...parts)=>box(t,new Uint8Array([v,(f>>16)&255,(f>>8)&255,f&255]),...parts);
const zeros=n=>new Uint8Array(n),MATRIX=cat([be32(0x10000),be32(0),be32(0),be32(0),be32(0x10000),be32(0),be32(0),be32(0),be32(0x40000000)]);
function desc(tag,body){const n=body.length,len=[ (n>>21)&127|128,(n>>14)&127|128,(n>>7)&127|128,n&127];return cat([new Uint8Array([tag,...len]),body])}
function sttsOf(durs){const runs=[];for(const d of durs){const r=runs[runs.length-1];if(r&&r[1]===d)r[0]++;else runs.push([1,d])}return full('stts',0,0,be32(runs.length),...runs.map(([n,d])=>cat([be32(n),be32(d)])))}
// video: {chunks:[{ts,dur,data,key}], w,h, avcC, timescale}; audio: {chunks:[{ts,dur,data}], rate, channels, codec:'aac'|'opus', asc|preskip}
function mp4({video,audio,durationMs}){const now=0,VT=90000,AT=audio?audio.rate:1;
  const vs=video.chunks.map(c=>({c,dur:Math.max(1,Math.round(c.dur*VT/1e6))})),as=audio?audio.chunks.map(c=>({c,dur:Math.max(1,Math.round(c.dur*AT/1e6))})):[];
  // interleave samples by time in the mdat; every sample is its own chunk, so any order works
  const order=[...vs.map(s=>({s,v:1})),...as.map(s=>({s,v:0}))].sort((a,b)=>a.s.c.ts-b.s.c.ts);
  const total=order.reduce((n,o)=>n+o.s.c.data.length,0),big=total>4e9;
  const build=offs=>{const vOff=[],aOff=[];if(offs){let p=offs;for(const o of order){(o.v?vOff:aOff).push(p);p+=o.s.c.data.length}}else{vs.forEach(()=>vOff.push(0));as.forEach(()=>aOff.push(0))}
    const coBox=list=>big?full('co64',0,0,be32(list.length),...list.map(be64)):full('stco',0,0,be32(list.length),...list.map(be32));
    const stsz=list=>full('stsz',0,0,be32(0),be32(list.length),...list.map(s=>be32(s.c.data.length))),stsc=full('stsc',0,0,be32(1),be32(1),be32(1),be32(1));
    const dinf=box('dinf',full('dref',0,0,be32(1),full('url ',0,1)));
    const vDur=vs.reduce((n,s)=>n+s.dur,0),mvDur=Math.round(durationMs);
    const avc1=box('avc1',zeros(6),be16(1),zeros(16),be16(video.w),be16(video.h),be32(0x480000),be32(0x480000),be32(0),be16(1),zeros(32),be16(0x18),be16(0xffff),box('avcC',video.avcC));
    const sync=vs.map((s,i)=>s.c.key?i+1:0).filter(Boolean);
    const vtrak=box('trak',full('tkhd',0,3,be32(now),be32(now),be32(1),be32(0),be32(mvDur),zeros(8),be16(0),be16(0),be16(0),be16(0),MATRIX,be32(video.w*65536),be32(video.h*65536)),
      box('mdia',full('mdhd',0,0,be32(now),be32(now),be32(VT),be32(vDur),be16(0x55C4),be16(0)),full('hdlr',0,0,be32(0),new TextEncoder().encode('vide'),zeros(12),new TextEncoder().encode('VideoHandler\0')),
        box('minf',full('vmhd',0,1,zeros(8)),dinf,box('stbl',full('stsd',0,0,be32(1),avc1),sttsOf(vs.map(s=>s.dur)),full('stss',0,0,be32(sync.length),...sync.map(be32)),stsc,stsz(vs),coBox(vOff)))));
    let atrak=new Uint8Array(0);
    if(audio){const aDur=as.reduce((n,s)=>n+s.dur,0);let entry;
      if(audio.codec==='aac'){const dcd=desc(4,cat([new Uint8Array([0x40,0x15,0,0,0]),be32(audio.bitrate||192000),be32(audio.bitrate||192000),desc(5,audio.asc)])),es=desc(3,cat([be16(2),new Uint8Array([0]),dcd,desc(6,new Uint8Array([2]))]));
        entry=box('mp4a',zeros(6),be16(1),zeros(8),be16(audio.channels),be16(16),be16(0),be16(0),be32(audio.rate*65536),full('esds',0,0,es))}
      else entry=box('Opus',zeros(6),be16(1),zeros(8),be16(audio.channels),be16(16),be16(0),be16(0),be32(audio.rate*65536),box('dOps',new Uint8Array([0,audio.channels]),be16(audio.preskip||312),be32(audio.rate),be16(0),new Uint8Array([0])));
      atrak=box('trak',full('tkhd',0,3,be32(now),be32(now),be32(2),be32(0),be32(mvDur),zeros(8),be16(0),be16(1),be16(0x100),be16(0),MATRIX,be32(0),be32(0)),
        box('mdia',full('mdhd',0,0,be32(now),be32(now),be32(AT),be32(aDur),be16(0x55C4),be16(0)),full('hdlr',0,0,be32(0),new TextEncoder().encode('soun'),zeros(12),new TextEncoder().encode('SoundHandler\0')),
          box('minf',full('smhd',0,0,zeros(4)),dinf,box('stbl',full('stsd',0,0,be32(1),entry),sttsOf(as.map(s=>s.dur)),stsc,stsz(as),coBox(aOff)))))}
    const mvhd=full('mvhd',0,0,be32(now),be32(now),be32(1000),be32(mvDur),be32(0x10000),be16(0x100),zeros(10),MATRIX,zeros(24),be32(audio?3:2));
    return box('moov',mvhd,vtrak,atrak)};
  const ftyp=box('ftyp',new TextEncoder().encode('isom'),be32(512),new TextEncoder().encode('isomiso2avc1mp41'));
  const mdatHd=big?cat([be32(1),new TextEncoder().encode('mdat'),be64(total+16)]):cat([be32(total+8),new TextEncoder().encode('mdat')]);
  const moovLen=build(null).length,moov=build(ftyp.length+moovLen+mdatHd.length);
  return new Blob([ftyp,moov,mdatHd,...order.map(o=>o.s.c.data)],{type:'video/mp4'})}

// ---------- audio speed change that keeps the pitch (overlap-add with a short similarity search) ----------
function stretch(chs,speed){if(!(speed>0)||Math.abs(speed-1)<1e-3)return chs;const N=2048,Hs=512,Ha=Hs*speed,tol=192,cmp=256,len=chs[0].length,outLen=Math.max(1,Math.ceil(len/speed)),win=new Float32Array(N);
  for(let i=0;i<N;i++)win[i]=.5-.5*Math.cos(2*Math.PI*i/N);const out=chs.map(()=>new Float32Array(outLen+N)),norm=new Float32Array(outLen+N),mono=new Float32Array(len);
  for(const c of chs)for(let i=0;i<len;i++)mono[i]+=c[i]/chs.length;let prev=-1;
  for(let k=0;k*Hs<outLen;k++){let pos=Math.round(k*Ha);if(prev>=0){const nat=prev+Hs;let best=0,bv=-Infinity;for(let d=-tol;d<=tol;d+=2){const p=pos+d;if(p<0||p+cmp>=len)continue;let s=0;for(let j=0;j<cmp;j+=2)s+=mono[p+j]*mono[nat+j<len?nat+j:len-1];if(s>bv){bv=s;best=d}}pos+=best}
    pos=Math.max(0,Math.min(len-1,pos));const o=k*Hs;for(let i=0;i<N&&pos+i<len;i++){const w=win[i];for(let c=0;c<chs.length;c++)out[c][o+i]+=chs[c][pos+i]*w;norm[o+i]+=w}prev=pos}
  return out.map(a=>{const r=new Float32Array(outLen);for(let i=0;i<outLen;i++)r[i]=norm[i]>1e-3?a[i]/norm[i]:0;return r})}

// H.264 level for a frame size and rate (macroblocks per second and per frame)
function avcCodec(w,h,fps){const mbs=Math.ceil(w/16)*Math.ceil(h/16),r=mbs*fps,L=[[0x1e,40500,1620],[0x1f,108000,3600],[0x20,216000,5120],[0x28,245760,8192],[0x2a,522240,8704],[0x32,589824,22080],[0x33,983040,36864],[0x34,2073600,36864]];
  const l=(L.find(x=>r<=x[1]&&mbs<=x[2])||L[L.length-1])[0];return['avc1.4200'+hex2(l),'avc1.4d00'+hex2(l),'avc1.6400'+hex2(l)]}
root.VExport={demux,frames,webm,mp4,stretch,avcCodec,_demuxWebm:demuxWebm,_demuxMp4:demuxMp4,ok:typeof VideoEncoder!=='undefined'&&typeof VideoDecoder!=='undefined'&&typeof AudioEncoder!=='undefined'};
})(window);
