// Voice effects, shared parameter definitions, processing and honest response diagrams.
(function(root){
const defs={
 highpass:{name:'Rumble filter',short:'Low cut',color:'#72cdb8',hint:'Reduce low rumble and microphone handling noise.',params:[['cutoffHz','Cut below',20,400,1,80,'Hz']]},
 eq:{name:'Voice EQ',short:'EQ',color:'#8db3ff',hint:'Shape warmth, clarity and brightness without changing timing.',params:[['lowDb','Warmth',-12,12,.5,0,'dB'],['midDb','Clarity',-12,12,.5,0,'dB'],['highDb','Brightness',-12,12,.5,0,'dB'],['midHz','Clarity frequency',200,8000,50,2500,'Hz']]},
 compressor:{name:'Compressor',short:'Dynamics',color:'#d5a4f4',hint:'Reduce loud passages for a more even voice. Output gain restores level.',params:[['thresholdDb','Threshold',-60,0,1,-18,'dB'],['ratio','Ratio',1,12,.1,3,':1'],['kneeDb','Soft knee',0,30,1,12,'dB'],['attackMs','Attack',1,100,1,10,'ms'],['releaseMs','Release',30,600,10,150,'ms'],['makeupDb','Output gain',0,18,.5,0,'dB']]},
 limiter:{name:'Peak limiter',short:'Peak control',color:'#f2bd78',hint:'Keep loud peaks below a chosen level while preserving stereo balance.',params:[['ceilingDb','Ceiling',-12,0,.5,-1,'dBFS'],['releaseMs','Release',20,500,10,100,'ms']]},
 gain:{name:'Gain (dB)',short:'Level',color:'#72cdb8',hint:'Raise or lower this target by an exact number of decibels.',params:[['gainDb','Gain',-60,36,.1,0,'dB']]}
};
const presets={
 narration:{name:'Clean narration',hint:'Low rumble, clear speech, gentle leveling.',effects:[['highpass',{cutoffHz:80}],['eq',{lowDb:-1,midDb:2,highDb:1,midHz:2500}],['compressor',{thresholdDb:-20,ratio:3,kneeDb:12,attackMs:12,releaseMs:180,makeupDb:2}]]},
 warm:{name:'Warm voice',hint:'A little body with softer high frequencies.',effects:[['highpass',{cutoffHz:65}],['eq',{lowDb:2,midDb:1,highDb:-1,midHz:1800}],['compressor',{thresholdDb:-18,ratio:2.5,kneeDb:15,attackMs:18,releaseMs:200,makeupDb:1}]]},
 clear:{name:'Speech clarity',hint:'Less low-frequency weight and more presence.',effects:[['highpass',{cutoffHz:100}],['eq',{lowDb:-2,midDb:3,highDb:1.5,midHz:3000}],['compressor',{thresholdDb:-22,ratio:2.5,kneeDb:12,attackMs:10,releaseMs:150,makeupDb:2}]]}
};
const pending=new WeakMap(),db=v=>v>0?20*Math.log10(v):-Infinity,linear=d=>d<=-60?0:10**(d/20),fmtDb=v=>v>0?(db(v)>=0?'+':'')+db(v).toFixed(1)+' dB':'−∞ dB';
function defaults(type){return Object.fromEntries((defs[type]?.params||[]).map(p=>[p[0],p[5]]))}
function validate(f){const d=defs[f.type];if(!d)return;for(const [key,,min,max,,,]of d.params){const v=f[key];if(v!==undefined&&(!Number.isFinite(v)||v<min||v>max))throw Error('Use a valid '+d.name+' setting.')}}
function needsWorklet(p){return[p,...p.tracks,...p.clips].some(o=>!o.effectsBypassed114&&o.effects.some(f=>!f.bypass&&['compressor','limiter'].includes(f.type)))}
async function prepare(ctx,p){if(!needsWorklet(p))return;if(!ctx.audioWorklet)throw Error('Voice dynamics are unavailable in this runtime. Bypass Compressor and Peak limiter to continue.');if(!pending.has(ctx))pending.set(ctx,ctx.audioWorklet.addModule(new URL('audio-dynamics-worklet.js',document.baseURI).href).catch(e=>{pending.delete(ctx);throw e}));await pending.get(ctx)}
function filters(ctx,f){const result=[],mk=(type,hz,gain=0,q=.707)=>{const n=ctx.createBiquadFilter();n.type=type;n.frequency.value=Math.min(ctx.sampleRate*.45,hz);n.gain.value=gain;n.Q.value=q;result.push(n)};
 if(f.type==='highpass')mk('highpass',f.cutoffHz??80);
 else if(f.type==='eq'){mk('lowshelf',180,f.lowDb??0);mk('peaking',f.midHz??2500,f.midDb??0,.9);mk('highshelf',6500,f.highDb??0)}
 return result;
}
function build(ctx,f){validate(f);let nodes=filters(ctx,f),update;
 if(nodes.length){update=n=>{const values=n.type==='highpass'?[[n.cutoffHz??80,0]]:[[180,n.lowDb??0],[n.midHz??2500,n.midDb??0],[6500,n.highDb??0]];nodes.forEach((node,i)=>{node.frequency.setTargetAtTime(Math.min(ctx.sampleRate*.45,values[i][0]),ctx.currentTime,.015);node.gain.setTargetAtTime(values[i][1],ctx.currentTime,.015)})}}
 else if(f.type==='gain'){const n=ctx.createGain();n.gain.value=10**((f.gainDb??0)/20);nodes=[n];update=s=>n.gain.setTargetAtTime(10**((s.gainDb??0)/20),ctx.currentTime,.015)}
 else{const n=new AudioWorkletNode(ctx,'saveit-dynamics',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],processorOptions:f});nodes=[n];update=s=>n.port.postMessage(s)}
 nodes.forEach((n,i)=>{if(i)nodes[i-1].connect(n)});return{input:nodes[0],output:nodes.at(-1),nodes,update,dispose(){nodes.forEach(n=>{try{n.port?.postMessage({stop:true});n.port?.close();n.disconnect()}catch(_){}})}};
}
const paths={highpass:'M3 18h4L12 7h9',eq:'M3 14c4 0 4-7 8-7s4 10 7 10h3',compressor:'M4 19 12 11 20 8M4 5v14h16',limiter:'M3 18 9 12 13 7h8M4 4h16',gain:'M5 6h14M8 12h11M11 18h8M8 4v4M14 10v4M17 16v4',echo:'M4 12h2M9 7v10M14 5v14M19 8v8',reverb:'M4 7v10M8 5v14M12 8v8M16 10v4M20 11v2',fadein:'M4 18 20 6M4 20h16',fadeout:'M4 6 20 18M4 20h16',mute:'M5 10h4l5-4v12l-5-4H5zM18 9l4 6m0-6-4 6',volume:'M5 9h4l5-4v14l-5-4H5zM18 8q6 4 0 8'};
function icon(type){return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(paths[type]||paths.volume)+'"/></svg>'}
function controls(f){const def=defs[f.type];if(!def)return'';return '<div class="fxcontrols114">'+def.params.map(([key,label,min,max,step,value,unit])=>'<label class="fxcontrol114"><span>'+label+'<small>'+unit+'</small></span><div><input type="range" data-fxslide="'+key+'" aria-label="'+label+' slider" min="'+min+'" max="'+max+'" step="'+step+'" value="'+(f[key]??value)+'"><input type="number" data-fxnumber="'+key+'" aria-label="'+label+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+(f[key]??value)+'"></div></label>').join('')+'</div>'}
let visualContext;
function visual(f){const W=300,H=116,x=t=>24+t*260,y=v=>H-20-v*82;let points=[],title='',labels='';
 if(f.type==='highpass'||f.type==='eq'){
  title='Frequency response';visualContext??=new OfflineAudioContext(1,128,48000);const ns=filters(visualContext,f),freq=new Float32Array(100),mag=new Float32Array(100),phase=new Float32Array(100),combined=new Float32Array(100).fill(1);for(let i=0;i<100;i++)freq[i]=20*1000**(i/99);for(const n of ns){n.getFrequencyResponse(freq,mag,phase);for(let i=0;i<100;i++)combined[i]*=mag[i];n.disconnect()}points=Array.from(combined,(m,i)=>[x(i/99),58-Math.max(-18,Math.min(18,db(m)))*2.1]);labels='<text x="25" y="111">20 Hz</text><text x="126" y="111">1 kHz</text><text x="247" y="111">20 kHz</text><text x="25" y="13">+18 dB</text>';
 }else if(f.type==='compressor'||f.type==='limiter'){
  title=f.type==='compressor'?'Compression curve':'Sample peak ceiling';for(let i=0;i<=80;i++){const a=-60+i*.75,t=f.thresholdDb??-18,ratio=f.ratio??3,knee=f.kneeDb??12,over=a-t;let b=a;if(f.type==='limiter')b=Math.min(a,f.ceilingDb??-1);else if(knee>0&&Math.abs(over)<knee/2)b+=(1/ratio-1)*(over+knee/2)**2/(2*knee);else if(over>=knee/2)b=t+over/ratio;points.push([x(i/80),y((b+(f.makeupDb??0)+60)/60)])}labels='<text x="24" y="111">−60</text><text x="253" y="111">0 dB in</text><text x="25" y="13">Output</text>';
 }else{title='Effect shape';for(let i=0;i<=80;i++){const t=i/80,v=f.type==='fadein'?t:f.type==='fadeout'?1-t:f.type==='echo'?Math.exp(-t*3)*(.4+.5*Math.abs(Math.cos(t*24))):f.type==='reverb'?Math.exp(-t*4)*(.35+.5*Math.abs(Math.sin(t*74))):f.type==='mute'?0:.45;points.push([x(t),y(v)])}labels='<text x="24" y="111">Start</text><text x="257" y="111">End</text>'}
 const d=points.map((p,i)=>(i?'L':'M')+p.map(v=>Number(v).toFixed(2)).join(',')).join(' '),color=defs[f.type]?.color||'#79cdb7';
 return '<div class="fxvisual114" style="--fx-color:'+color+'"><span>'+title+'</span><svg viewBox="0 0 300 116" role="img" aria-label="'+title+'"><path class="fxgrid114" d="M24 17V96H284M24 58H284M89 17V96M154 17V96M219 17V96"/><path class="fxfill114" d="'+d+'L284,96L24,96Z"/><path class="fxcurve114" d="'+d+'"/>'+labels+'</svg></div>';
}
async function peak(buffer){let result=0;for(let ch=0;ch<buffer.numberOfChannels;ch++){const d=buffer.getChannelData(ch);for(let i=0;i<d.length;i++){result=Math.max(result,Math.abs(d[i]));if(i&&i%2000000===0)await new Promise(r=>setTimeout(r,0))}}return result}
root.AudioFX={defs,presets,defaults,validate,prepare,build,icon,controls,visual,peak,db,linear,fmtDb};
})(window);
