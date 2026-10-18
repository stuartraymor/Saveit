// Local PCM tools. Runs in a worker; callers transfer copies, never source media.
const N=2048,HOP=N/4,window115=Float64Array.from({length:N},(_,i)=>Math.sin(Math.PI*(i+.5)/N));
function fft(re,im,inverse=false){
 for(let i=1,j=0;i<N;i++){let bit=N>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]]}}
 for(let len=2;len<=N;len*=2){const a=(inverse?2:-2)*Math.PI/len,wr=Math.cos(a),wi=Math.sin(a);for(let start=0;start<N;start+=len){let r=1,m=0;for(let j=0;j<len/2;j++){const x=start+j,y=x+len/2,tr=r*re[y]-m*im[y],ti=r*im[y]+m*re[y];re[y]=re[x]-tr;im[y]=im[x]-ti;re[x]+=tr;im[x]+=ti;const next=r*wr-m*wi;m=r*wi+m*wr;r=next}}}
 if(inverse)for(let i=0;i<N;i++){re[i]/=N;im[i]/=N}
}
function spectrum(data,start){const re=new Float64Array(N),im=new Float64Array(N);for(let i=0;i<N;i++)re[i]=(data[start+i]||0)*window115[i];fft(re,im);return{re,im}}
function learn(channels,sampleRate){
 if(!channels.length||channels.some(c=>c.length<sampleRate*.25))throw Error('Select at least 0.25 seconds of noise without speech.');
 const powers=channels.map(data=>{const power=new Float64Array(N/2+1);let count=0;for(let start=0;start+N<=data.length;start+=HOP){const {re,im}=spectrum(data,start);for(let k=0;k<power.length;k++)power[k]+=re[k]**2+im[k]**2;count++}if(!count)throw Error('Noise sample is too short.');for(let k=0;k<power.length;k++)power[k]/=count;return power});
 if(!powers.some(p=>p.some(v=>v>1e-12)))throw Error('The sample is silent. Choose audible room noise without speech.');
 return{sampleRate,powers};
}
function clean(channels,sampleRate,profile,reductionDb){
 if(!Number.isFinite(reductionDb)||reductionDb<0||reductionDb>24)throw Error('Choose a reduction from 0 to 24 dB.');
 if(profile?.sampleRate!==sampleRate||!Array.isArray(profile.powers)||!profile.powers.length||profile.powers.some(p=>p.length!==N/2+1||p.some(v=>!Number.isFinite(v)||v<0)))throw Error('Learn noise from a recording with the same sample rate first.');
 if(reductionDb===0)return channels;
 const length=channels[0].length,out=channels.map(()=>new Float32Array(length)),weight=new Float64Array(length),floor=10**(-reductionDb/20),previous=new Float64Array(N/2+1).fill(1);
 for(let start=-N+HOP,frame=0;start<length;start+=HOP,frame++){
  const spectra=channels.map(data=>spectrum(data,start)),gains=new Float64Array(N/2+1);
  for(let k=0;k<gains.length;k++){let gain=floor;for(let ch=0;ch<spectra.length;ch++){const {re,im}=spectra[ch],noise=profile.powers[Math.min(ch,profile.powers.length-1)][k],power=re[k]**2+im[k]**2;if(power<1e-30&&noise<1e-30)continue;gain=Math.max(gain,Math.sqrt(Math.max(0,1-1.5*noise/Math.max(1e-30,power))))}gains[k]=gain}
  for(let k=0;k<gains.length;k++){const smooth=(gains[Math.max(0,k-1)]+2*gains[k]+gains[Math.min(gains.length-1,k+1)])/4;previous[k]=.25*previous[k]+.75*smooth}
  for(let ch=0;ch<spectra.length;ch++){const {re,im}=spectra[ch];for(let k=0;k<N;k++){const gain=previous[k<=N/2?k:N-k];re[k]*=gain;im[k]*=gain}fft(re,im,true);for(let i=0;i<N;i++){const at=start+i;if(at>=0&&at<length)out[ch][at]+=re[i]*window115[i]}}
  for(let i=0;i<N;i++){const at=start+i;if(at>=0&&at<length)weight[at]+=window115[i]**2}
  if(frame%128===0)postMessage({progress:Math.max(0,Math.min(1,start/length))});
 }
 for(const data of out)for(let i=0;i<length;i++)data[i]/=weight[i]||1;
 return out;
}
// BS.1770 K-weighting. Coefficients are mapped from the specified 48 kHz poles
// and zeros by a bilinear transform, retaining the same response at other rates.
function coefficients(sr){
 const K=Math.tan(Math.PI*1681.974450955533/sr),Vh=10**(3.999843853973347/20),Vb=Vh**.4996667741545416,Q=.7071752369554196,a=1+K/Q+K*K;
 const shelf=[(Vh+Vb*K/Q+K*K)/a,2*(K*K-Vh)/a,(Vh-Vb*K/Q+K*K)/a,2*(K*K-1)/a,(1-K/Q+K*K)/a];
 const k=Math.tan(Math.PI*38.13547087602444/sr),q=.5003270373238773,d=1+k/q+k*k;
 return[shelf,[1,-2,1,2*(k*k-1)/d,(1-k/q+k*k)/d]];
}
function measure(channels,sampleRate){
 if(!channels.length||channels.length>2)throw Error('Loudness measurement supports mono and stereo audio.');
 const length=channels[0].length,step=Math.round(sampleRate*.1),block=step*4;
 if(length<block)throw Error('Loudness matching needs at least 0.4 seconds of audio.');
 const energy=new Float64Array(Math.ceil(length/step)),filters=coefficients(sampleRate);let peak=0;
 for(const data of channels){const states=filters.map(()=>[0,0]);for(let i=0;i<length;i++){let v=data[i];if(!Number.isFinite(v))throw Error('Audio contains invalid samples.');peak=Math.max(peak,Math.abs(v));for(let j=0;j<2;j++){const [b0,b1,b2,a1,a2]=filters[j],s=states[j],y=b0*v+s[0];s[0]=b1*v-a1*y+s[1];s[1]=b2*v-a2*y;v=y}energy[Math.floor(i/step)]+=v*v}}
 const blocks=[];for(let i=0;(i+4)*step<=length;i++)blocks.push((energy[i]+energy[i+1]+energy[i+2]+energy[i+3])/block);
 const lufs=e=>e>0?-.691+10*Math.log10(e):-Infinity,mean=a=>a.reduce((x,y)=>x+y,0)/a.length,absolute=blocks.filter(e=>lufs(e)>=-70);
 if(!absolute.length)return{lufs:null,peak,blocks:blocks.length};const relative=lufs(mean(absolute))-10,gated=absolute.filter(e=>lufs(e)>=relative);
 return{lufs:lufs(mean(gated)),peak,blocks:blocks.length};
}
onmessage=e=>{try{const {action,channels,sampleRate,profile,reductionDb}=e.data;const result=action==='learn'?learn(channels,sampleRate):action==='clean'?clean(channels,sampleRate,profile,reductionDb):action==='measure'?measure(channels,sampleRate):null;if(!result)throw Error('Unknown audio task.');postMessage({result},action==='clean'?result.map(c=>c.buffer):[])}catch(e){postMessage({error:e.message})}};
