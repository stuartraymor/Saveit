// One scheduling path for native playback and offline WAV mixdown. No speed changes.
(function(root){
const P=()=>root.AudioProject,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function tail(f){if(f.bypass||f.legacy)return 0;if(root.VoiceFX&&root.VoiceFX.has(f.type))return root.VoiceFX.tail(f);if(f.type==='reverb')return clamp(f.decay??.45,.05,3);if(f.type==='echo'){const feedback=clamp((f.feedback??35)/100,0,.85);return Math.min(6,(f.delayMs??180)/1000*(feedback>0?Math.ceil(Math.log(.001)/Math.log(feedback)):1))}return 0}
function duration(p){let T=P().length(p);if(!p.tails)return Math.max(.01,T);for(const o of [p,...p.tracks,...p.clips]){let cumulative=0;for(const f of o.effectsBypassed114?[]:o.effects){cumulative+=tail(f);T=Math.max(T,(o.src==null?0:o.start)+f.end+cumulative)}}return Math.max(.01,T)}
function graph(ctx,dest,effects,from,when,T){let output=ctx.createGain();const input=output,nodes=[output],clean=[],fxLive=[];
 const gain=()=>{const n=ctx.createGain();nodes.push(n);return n},time=t=>when+Math.max(0,t-from);
 for(const f of effects){if(f.bypass||f.end<=f.start)continue;
  // 10.3.10 voice effects: the voice passes dry outside the effect's range; inside it, dry and processed sound are blended by Mix.
  // Both switch with a 12 ms ramp (no clicks), and only the processor's input is gated, so echo and reverb ring out naturally.
  if(root.VoiceFX&&root.VoiceFX.has(f.type)){const unit=root.VoiceFX.build(ctx,f),gate=gain(),send=gain(),keep=gain(),wet=gain(),next=gain(),R=.012,on=from>=f.start&&from<f.end,m=unit.mix(f);
   output.connect(gate);gate.connect(next);output.connect(send);send.connect(keep);keep.connect(next);send.connect(unit.input);const rings=root.VoiceFX.ringsOut(f.type),wg=gain();unit.output.connect(wg);wg.connect(wet);wet.connect(next);keep.gain.value=1-m;wet.gain.value=m;
   const sw=(par,inside,outside)=>{par.setValueAtTime(on?inside:outside,when);if(f.start>from){const t=time(f.start);par.setValueAtTime(outside,Math.max(when,t-R));par.linearRampToValueAtTime(inside,Math.max(when+1e-4,t))}if(f.end>from){const t=time(f.end);par.setValueAtTime(inside,Math.max(when,t-R));par.linearRampToValueAtTime(outside,Math.max(when+1e-4,t))}};
   sw(gate.gain,0,1);sw(send.gain,1,0);if(!rings)sw(wg.gain,1,0);clean.push(()=>unit.dispose());
   fxLive.push({id:f.id,update:n=>{unit.update(n);const v=unit.mix(n);keep.gain.setTargetAtTime(1-v,ctx.currentTime,.015);wet.gain.setTargetAtTime(v,ctx.currentTime,.015)},reduction:()=>0,start:f.start,end:f.end});output=next;continue}
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
 const begin=Math.max(a,from),finish=b;if(finish<=begin)return;param.setValueAtTime(value(begin),when+Math.max(0,begin-from));if(!fi&&!fo)return;
 // 10.3.10: curves cover only the fade spans, so a short fade on a long clip keeps its length (one curve over the
 // whole clip had too few points: a 0.05 s fade on a 1-hour clip lasted almost a second)
 const seg=(t0,t1)=>{if(t1-t0<1e-6)return;const n=Math.max(2,Math.min(4096,Math.ceil((t1-t0)*2000))),curve=new Float32Array(n);for(let i=0;i<n;i++)curve[i]=value(t0+(t1-t0)*i/(n-1));param.setValueCurveAtTime(curve,when+(t0-from),t1-t0)};
 if(fi+fo>=len-1e-6)seg(begin,finish);else{seg(begin,a+fi);seg(Math.max(begin,b-fo),b)}
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
// span {from,to} renders only that part of the timeline (copying a short selection of a long project)
async function mix(it,span){const bufs=await root.AEdit.buffers(it),p=P().ensure(it,bufs),sr=Math.max(44100,...bufs.map(b=>b.sampleRate)),from=Math.max(0,span?.from||0),to=span&&span.to!=null?Math.min(duration(p),span.to):duration(p),ctx=new OfflineAudioContext(2,Math.max(1,Math.ceil((to-from)*sr)),sr),g=await(async()=>{await root.AudioFX.prepare(ctx,p);return schedule(ctx,it,bufs,from,0)})();try{return await ctx.startRendering()}finally{g.dispose()}}
root.AudioEngine={graph,schedule,mix,duration,tail};
})(window);
