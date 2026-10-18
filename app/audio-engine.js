// One scheduling path for native playback and offline WAV mixdown. No speed changes.
(function(root){
const P=()=>root.AudioProject,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function tail(f){if(f.bypass||f.legacy)return 0;if(f.type==='reverb')return clamp(f.decay??.45,.05,3);if(f.type==='echo'){const feedback=clamp((f.feedback??35)/100,0,.85);return Math.min(6,(f.delayMs??180)/1000*(feedback>0?Math.ceil(Math.log(.001)/Math.log(feedback)):1))}return 0}
function duration(p){let T=P().length(p);if(!p.tails)return Math.max(.01,T);for(const o of [p,...p.tracks,...p.clips]){let cumulative=0;for(const f of o.effectsBypassed114?[]:o.effects){cumulative+=tail(f);T=Math.max(T,(o.src==null?0:o.start)+f.end+cumulative)}}return Math.max(.01,T)}
function graph(ctx,dest,effects,from,when,T){let output=ctx.createGain();const input=output,nodes=[output],clean=[],fxLive=[];
 const gain=()=>{const n=ctx.createGain();nodes.push(n);return n},time=t=>when+Math.max(0,t-from);
 for(const f of effects){if(f.bypass||f.end<=f.start)continue;
  if(root.AudioFX.defs[f.type]){const unit=root.AudioFX.build(ctx,f),dry=gain(),wet=gain(),next=gain(),on=from>=f.start&&from<f.end;output.connect(dry);dry.connect(next);output.connect(unit.input);unit.output.connect(wet);wet.connect(next);dry.gain.setValueAtTime(on?0:1,when);wet.gain.setValueAtTime(on?1:0,when);if(f.start>from){dry.gain.setValueAtTime(0,time(f.start));wet.gain.setValueAtTime(1,time(f.start))}if(f.end>from){dry.gain.setValueAtTime(1,time(f.end));wet.gain.setValueAtTime(0,time(f.end))}clean.push(()=>unit.dispose());fxLive.push({id:f.id,update:unit.update,reduction:unit.reduction,start:f.start,end:f.end});output=next;continue}
  if(f.legacy){const next=gain(),legacy=root.AudioTimeline.graph(ctx,next,[f],from,when,T);output.connect(legacy.input);clean.push(legacy.dispose);output=next;continue}
  const a=f.start,b=f.end,amount=clamp((f.amount??100)/100,0,2),next=gain();
  if(['volume','mute','fadein','fadeout'].includes(f.type)){
   const value=t=>t<a||t>=b?1:f.type==='mute'?0:f.type==='volume'?amount:(f.fadeFrom??(f.type==='fadein'?0:1))+((f.fadeTo??(f.type==='fadein'?1:0))-(f.fadeFrom??(f.type==='fadein'?0:1)))*(t-a)/(b-a),par=next.gain;
   par.setValueAtTime(value(from),when);if(a>from)par.setValueAtTime(value(a),time(a));
   if(b>from){if(f.type==='fadein'||f.type==='fadeout'){par.linearRampToValueAtTime(f.fadeTo??(f.type==='fadein'?1:0),time(b));par.setValueAtTime(1,time(b)+.0001)}else par.setValueAtTime(1,time(b))}output.connect(next);
  }else{
   const send=gain(),wet=gain();output.connect(next);output.connect(send);send.gain.setValueAtTime(from>=a&&from<b?1:0,when);if(a>from)send.gain.setValueAtTime(1,time(a));if(b>from)send.gain.setValueAtTime(0,time(b));wet.gain.value=amount;wet.connect(next);
   if(f.type==='echo'){const d=ctx.createDelay(1),fb=gain();nodes.push(d);d.delayTime.value=clamp((f.delayMs??180)/1000,.02,1);fb.gain.value=clamp((f.feedback??35)/100,0,.85);send.connect(d);d.connect(fb);fb.connect(d);d.connect(wet)}
   else if(f.type==='reverb'){const c=ctx.createConvolver(),decay=clamp(f.decay??.45,.05,3),imp=ctx.createBuffer(2,Math.ceil(ctx.sampleRate*decay),ctx.sampleRate);nodes.push(c);for(let ch=0;ch<2;ch++){const d=imp.getChannelData(ch);for(let i=0;i<d.length;i++)d[i]=Math.sin(i*12.9898+ch*78.233)*Math.pow(1-i/d.length,2)*.15}c.buffer=imp;send.connect(c);c.connect(wet)}
   // Explicit tails option controls render duration; graphs have the same gate in both modes.
  }output=next;
 }output.connect(dest);return{input,fxLive,dispose(){clean.forEach(f=>f());nodes.forEach(n=>{try{n.disconnect()}catch(_){}})}};
}
function envelope(param,clip,from,when){const len=clip.b-clip.a,fi=Math.min(clip.fi||0,len),fo=Math.min(clip.fo||0,len),a=clip.start,b=a+len,value=t=>{let v=clip.gain;if(fi&&t<a+fi)v*=clamp((t-a)/fi,0,1);if(fo&&t>b-fo)v*=clamp((b-t)/fo,0,1);return v};
 // Multiplying overlapping fades is represented exactly by sample automation.
 const begin=Math.max(a,from),finish=b;if(finish<=begin)return;const n=Math.max(2,Math.min(4096,Math.ceil((finish-begin)*500))),curve=new Float32Array(n);for(let i=0;i<n;i++)curve[i]=value(begin+(finish-begin)*i/(n-1));param.setValueAtTime(value(begin),when+Math.max(0,begin-from));if(fi||fo)param.setValueCurveAtTime(curve,when+Math.max(0,begin-from),finish-begin);
}
function schedule(ctx,it,bufs,from=0,when=0,destination=ctx.destination){const p=P().ensure(it,bufs),T=duration(p),srcs=[],nodes=[],graphs=[],live=[];
 const tap=node=>{const splitter=ctx.createChannelSplitter(2),meters=[ctx.createAnalyser(),ctx.createAnalyser()];node.connect(splitter);meters.forEach((n,i)=>{n.fftSize=1024;splitter.connect(n,i)});nodes.push(splitter,...meters);return meters};
 const master=ctx.createGain(),analyser=ctx.createAnalyser();analyser.fftSize=1024;nodes.push(master,analyser);const mg=graph(ctx,analyser,p.effectsBypassed114?[]:p.effects,from,when,T);graphs.push(mg);master.connect(mg.input);analyser.connect(destination);const meters=tap(analyser);
 const fade=p.legacyFades||{},fi=Math.min(fade.fi||0,P().length(p)/2),fo=Math.min(fade.fo||0,P().length(p)/2),content=P().length(p),mv=t=>Math.min(fi?clamp(t/fi,0,1):1,fo?clamp((content-t)/fo,0,1):1);master.gain.setValueAtTime(mv(from),when);if(fi&&from<fi)master.gain.linearRampToValueAtTime(1,when+fi-from);if(fo&&content>from){master.gain.setValueAtTime(mv(Math.max(from,content-fo)),when+Math.max(0,content-fo-from));master.gain.linearRampToValueAtTime(0,when+content-from)}
 const solo=p.tracks.some(t=>{const c=it.tracks[t.control];return c.solo&&!c.mute});
 for(const tr of p.tracks){const control=it.tracks[tr.control],vol=ctx.createGain(),pan=ctx.createStereoPanner(),g=graph(ctx,vol,tr.effectsBypassed114?[]:tr.effects,from,when,T);graphs.push(g);nodes.push(vol,pan);pan.channelCount=2;pan.channelCountMode='explicit';pan.pan.value=clamp(tr.pan||0,-1,1);pan.connect(g.input);vol.gain.value=control.mute||solo&&!control.solo?0:control.vol??1;vol.connect(master);live.push({vol,pan,track:tr.id,meters:tap(vol)});
  for(const c of p.clips.filter(c=>c.track===tr.id)){const end=P().end(c);if(c.mute||end<=from)continue;const b=bufs[c.src];if(!b)continue;const source=ctx.createBufferSource(),amp=ctx.createGain(),fx=(c.effectsBypassed114?[]:c.effects).map(f=>({...f,start:c.start+f.start,end:c.start+f.end})),cg=graph(ctx,pan,fx,from,when,T);graphs.push(cg);source.buffer=b;source.playbackRate.value=1;source.connect(amp);amp.connect(cg.input);nodes.push(amp);envelope(amp.gain,c,from,when);const skip=Math.max(0,from-c.start);source.start(when+Math.max(0,c.start-from),c.a+skip,Math.min(c.b-c.a-skip,b.duration-c.a-skip));srcs.push(source)}
 }return{analyser,meters,srcs,live,fxLive:graphs.flatMap(g=>g.fxLive||[]),dispose(){srcs.forEach(s=>{try{s.stop();s.disconnect()}catch(_){}});graphs.forEach(g=>g.dispose());nodes.forEach(n=>{try{n.disconnect()}catch(_){}})}};
}
async function mix(it){const bufs=await root.AEdit.buffers(it),p=P().ensure(it,bufs),sr=Math.max(44100,...bufs.map(b=>b.sampleRate)),ctx=new OfflineAudioContext(2,Math.max(1,Math.ceil(duration(p)*sr)),sr),g=await(async()=>{await root.AudioFX.prepare(ctx,p);return schedule(ctx,it,bufs)})();try{return await ctx.startRendering()}finally{g.dispose()}}
root.AudioEngine={graph,schedule,mix,duration,tail};
})(window);
