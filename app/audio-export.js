// Saveit 10.0.2: save audio as MP3 or M4A as well as WAV. The mix is rendered exactly as for WAV, then encoded here.
// MP3 uses the bundled lamejs encoder (third-party/lame.min.js). M4A (AAC) uses the browser's own encoder, in real time.
(function(root){
const A=root.AEdit,KBPS=[96,128,160,192,256,320],MP3_RATES=[8000,11025,12000,16000,22050,24000,32000,44100,48000];
function kbps(){try{const v=+localStorage.getItem('saveit.audioKbps');if(KBPS.includes(v))return v}catch(e){}return 192}
function setKbps(v){v=+v;if(!KBPS.includes(v))return;try{localStorage.setItem('saveit.audioKbps',v)}catch(e){}}
const tick=()=>new Promise(r=>setTimeout(r));
function int16(f){const o=new Int16Array(f.length);for(let i=0;i<f.length;i++){const v=Math.max(-1,Math.min(1,f[i]));o[i]=v<0?v*0x8000:v*0x7fff}return o}
async function resample(buf,sr){const off=new OfflineAudioContext(buf.numberOfChannels,Math.max(1,Math.ceil(buf.duration*sr)),sr),s=off.createBufferSource();s.buffer=buf;s.connect(off.destination);s.start();return off.startRendering()}
async function mp3(buf,k){if(!root.lamejs||!root.lamejs.Mp3Encoder)throw Error('The MP3 encoder is missing. Save as WAV instead.');
  if(!MP3_RATES.includes(buf.sampleRate))buf=await resample(buf,48000);
  const ch=Math.min(2,buf.numberOfChannels),enc=new root.lamejs.Mp3Encoder(ch,buf.sampleRate,k||kbps()),L=int16(buf.getChannelData(0)),R=ch>1?int16(buf.getChannelData(1)):null,parts=[],step=1152*32;
  for(let i=0,n=0;i<L.length;i+=step,n++){const d=R?enc.encodeBuffer(L.subarray(i,i+step),R.subarray(i,i+step)):enc.encodeBuffer(L.subarray(i,i+step));if(d.length)parts.push(new Uint8Array(d));if(n%40===39)await tick()}
  const e=enc.flush();if(e.length)parts.push(new Uint8Array(e));return new Blob(parts,{type:'audio/mpeg'})}
const M4A_MIME='audio/mp4;codecs=mp4a.40.2';
async function m4a(buf,k){if(!root.MediaRecorder||!MediaRecorder.isTypeSupported(M4A_MIME))throw Error('M4A is not available on this computer. Save as MP3 instead.');
  const ctx=new AudioContext({sampleRate:buf.sampleRate}),dest=ctx.createMediaStreamDestination(),src=ctx.createBufferSource();src.buffer=buf;src.connect(dest);
  const rec=new MediaRecorder(dest.stream,{mimeType:M4A_MIME,audioBitsPerSecond:(k||kbps())*1000}),chunks=[],done=new Promise(r=>rec.onstop=r);
  rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};rec.start(1000);src.onended=()=>setTimeout(()=>{if(rec.state!=='inactive')rec.stop()},250);
  try{await ctx.resume();src.start();await done}finally{try{ctx.close()}catch(e){}}
  return new Blob(chunks,{type:'audio/mp4'})}
// fmt: 'wav' | 'mp3' | 'm4a'
async function renderAs(it,fmt,k){if(fmt!=='mp3'&&fmt!=='m4a')return A.renderWav(it);const buf=await A.mix(it);return fmt==='mp3'?mp3(buf,k):m4a(buf,k)}
A.renderAs=renderAs;A.encodeMp3=mp3;A.encodeM4a=m4a;A.audioKbps={list:KBPS,get:kbps,set:setKbps};
})(window);
