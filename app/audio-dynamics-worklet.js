// Stereo-linked, zero-lookahead dynamics. Runs identically for playback and offline export.
class SaveitDynamics extends AudioWorkletProcessor {
 constructor(options){super();this.settings=options.processorOptions||{};this.gain=1;this.frames=0;this.port.onmessage=e=>{this.settings={...this.settings,...e.data}}}
 process(inputs,outputs){
  const input=inputs[0],output=outputs[0],s=this.settings;if(s.stop)return false;
  if(!input?.length||!output?.length)return true;
  const release=Math.exp(-1/(sampleRate*Math.max(.001,(s.releaseMs??150)/1000))),attack=Math.exp(-1/(sampleRate*Math.max(.0001,(s.attackMs??10)/1000))),ceiling=10**((s.ceilingDb??-1)/20),makeup=10**((s.makeupDb??0)/20),threshold=s.thresholdDb??-18,ratio=s.ratio??3,knee=s.kneeDb??12;
  for(let i=0;i<output[0].length;i++){
   let peak=0;for(let ch=0;ch<input.length;ch++)peak=Math.max(peak,Math.abs(input[ch][i]||0));
   let desired=1;
   if(s.type==='limiter')desired=peak>ceiling?ceiling/peak:1;
   else{const db=20*Math.log10(Math.max(1e-12,peak)),over=db-threshold;let reduction=0;
    if(knee>0&&over>-knee/2&&over<knee/2)reduction=(1/ratio-1)*(over+knee/2)**2/(2*knee);
    else if(over>=knee/2)reduction=(1/ratio-1)*over;
    desired=10**(reduction/20);
   }
   const coeff=desired<this.gain?(s.type==='limiter'?0:attack):release;this.gain=coeff*this.gain+(1-coeff)*desired;
   for(let ch=0;ch<output.length;ch++)output[ch][i]=(input[ch]||input[0])[i]*this.gain*(s.type==='limiter'?1:makeup);
  }
  if(++this.frames%20===0)this.port.postMessage({reductionDb:-20*Math.log10(Math.max(1e-12,this.gain))});return true;
 }
}
registerProcessor('saveit-dynamics',SaveitDynamics);
