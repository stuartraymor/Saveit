// Stereo-linked, frequency-selective de-essing. No delay, resampling or source edits.
class SaveitDeesser extends AudioWorkletProcessor {
 constructor(options){super();this.settings=options.processorOptions||{};this.detector=[];this.shelf=[];this.reduction=0;this.frequency=this.settings.frequencyHz??6000;this.frames=0;this.port.onmessage=e=>{this.settings={...this.settings,...e.data}}}
 process(inputs,outputs){
  const input=inputs[0],output=outputs[0],s=this.settings;if(s.stop)return false;if(!input?.length||!output?.length)return true;
  const hz=Math.max(100,Math.min(sampleRate*.4,s.frequencyHz??6000)),release=Math.exp(-1/(sampleRate*(s.releaseMs??80)/1000)),attack=Math.exp(-1/(sampleRate*.001)),threshold=s.thresholdDb??-28,max=s.rangeDb??6;
  this.frequency+=.15*(hz-this.frequency);const w=2*Math.PI*this.frequency/sampleRate,c=Math.cos(w),sn=Math.sin(w),alpha=sn/2,den=1+alpha,band=[alpha/den,0,-alpha/den,-2*c/den,(1-alpha)/den];
  const filter=(v,coeff,state)=>{const y=coeff[0]*v+state[0];state[0]=coeff[1]*v-coeff[3]*y+state[1];state[1]=coeff[2]*v-coeff[4]*y;return y};
  while(this.detector.length<input.length)this.detector.push([0,0]);while(this.shelf.length<output.length)this.shelf.push([0,0]);let coeff=[1,0,0,0,0],maxReduction=0;
  for(let i=0;i<output[0].length;i++){
   let level=0;const detected=input.map((channel,ch)=>{const v=filter(channel[i]||0,band,this.detector[ch]);level=Math.max(level,Math.abs(v));return v});
   const desired=Math.min(max,Math.max(0,(20*Math.log10(Math.max(1e-12,level))-threshold)*.75)),smoothing=desired>this.reduction?attack:release;this.reduction=smoothing*this.reduction+(1-smoothing)*desired;maxReduction=Math.max(maxReduction,this.reduction);
   // A high shelf, driven by the detected sibilance band, preserves low voice body.
   // Smooth control state, and refresh coefficients every 16 samples.
   if(i%16===0){const A=10**(-this.reduction/40),a=sn/2*Math.SQRT2,b=2*Math.sqrt(A)*a,d=(A+1)-(A-1)*c+b;coeff=[A*((A+1)+(A-1)*c+b)/d,-2*A*((A-1)+(A+1)*c)/d,A*((A+1)+(A-1)*c-b)/d,2*((A-1)-(A+1)*c)/d,((A+1)-(A-1)*c-b)/d]}
   for(let ch=0;ch<output.length;ch++){const dry=(input[ch]||input[0])[i]||0,wet=filter(dry,coeff,this.shelf[ch]);output[ch][i]=s.listen?detected[Math.min(ch,detected.length-1)]:wet}
  }
  if(++this.frames%20===0)this.port.postMessage({reductionDb:maxReduction});return true;
 }
}
registerProcessor('saveit-deesser',SaveitDeesser);
