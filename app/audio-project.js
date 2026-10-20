// Audio project v1. Source blobs stay in item.tracks; clips only reference them.
// Track control indexes preserve existing mute/solo/volume without copying media.
(function(root){
const copy=x=>JSON.parse(JSON.stringify(x)),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));let serial=0;
const id=prefix=>prefix+Date.now().toString(36)+'-'+(serial++).toString(36),end=c=>c.start+c.b-c.a;
function validate(p,bufs,sources){
 if(p?.version!==1||!Array.isArray(p.tracks)||!Array.isArray(p.clips)||!Array.isArray(p.effects)||!Number.isFinite(p.length)||p.length<0)throw Error('This audio project uses an unsupported or invalid timeline. The original recording is kept.');
 const tracks=new Set(),ids=new Set();for(const t of p.tracks){if(!t.id||tracks.has(t.id)||!Number.isInteger(t.control)||t.control<0||t.control>=sources.length||!Array.isArray(t.effects))throw Error('Invalid audio track.');tracks.add(t.id)}
 for(const c of p.clips){if(!c.id||ids.has(c.id)||!tracks.has(c.track)||!Number.isInteger(c.src)||!bufs[c.src]||![c.a,c.b,c.start,c.gain,c.fi,c.fo].every(Number.isFinite)||c.a<0||c.b<=c.a||c.b>bufs[c.src].duration+.001||c.start<0||c.gain<0||c.gain>4||c.fi<0||c.fo<0||!Array.isArray(c.effects))throw Error('Invalid audio clip. Original media has not been changed.');ids.add(c.id)}
 for(const c of p.clips)if(c.noiseOriginal115!==undefined&&(!Number.isInteger(c.noiseOriginal115)||!bufs[c.noiseOriginal115]||c.b>bufs[c.noiseOriginal115].duration+.001))throw Error('Invalid original noise-cleanup source.');
 const effects=[p.effects,...p.tracks.map(t=>t.effects),...p.clips.map(c=>c.effects)].flat();
 for(const f of effects)if(!f.id||!['volume','fadein','fadeout','mute','echo','reverb',...Object.keys(root.AudioFX.defs)].includes(f.type)||![f.start,f.end,f.amount].every(Number.isFinite)||f.start<0||f.end<=f.start||f.amount<0||f.amount>200||[f.fadeFrom,f.fadeTo].some(v=>v!==undefined&&(!Number.isFinite(v)||v<0||v>1)))throw Error('Invalid audio effect.');
 for(const f of effects)root.AudioFX.validate(f);
 return p;
}
function ensure(it,bufs){if(it.audioProject)return validate(it.audioProject,bufs,it.tracks);
 const sourceDuration=root.AudioTimeline.duration(bufs,it.tracks),ed=it.edit||{clips:[{a:0,b:sourceDuration}],fi:0,fo:0};
 if(!Array.isArray(ed.clips)||!ed.clips.length||ed.clips.some(c=>!Number.isFinite(c.a)||!Number.isFinite(c.b)||c.a<0||c.b<=c.a)||[ed.fi||0,ed.fo||0].some(n=>!Number.isFinite(n)||n<0))throw Error('The previous audio edit could not be converted safely. Use the original editor to inspect it.');
 const p={version:1,length:ed.clips.reduce((s,c)=>s+c.b-c.a,0),tracks:[],clips:[],effects:copy(ed.effects||[]).map(f=>({...f,legacy:true})),legacyFades:{fi:ed.fi||0,fo:ed.fo||0},tails:false};
 bufs.forEach((b,i)=>{const track={id:id('track'),control:i,name:it.tracks[i].name||'Track '+(i+1),pan:0,height:112,effects:[]};p.tracks.push(track);for(const r of root.AudioTimeline.segments(it.tracks[i],b,ed))p.clips.push({id:id('clip'),track:track.id,src:i,name:it.tracks[i].name||it.name||'Audio clip',a:r.a,b:r.b,start:r.start,gain:1,fi:0,fo:0,effects:[]})});
 validate(p,bufs,it.tracks);
 // Commit only after the complete conversion validates; original blobs stay put.
 it.audioLegacy={edit:copy(ed),regions:it.tracks.map(t=>t.regions?copy(t.regions):null),duration:it.dur||p.length};it.audioProject=p;return p;
}
const length=p=>{const last=Math.max(0,...p.clips.map(end));return Math.abs(last-p.length)<1e-9?p.length:Math.max(p.length,last)};
function clampEffects(c){const len=c.b-c.a;c.fi=clamp(c.fi,0,len);c.fo=clamp(c.fo,0,len);root.AudioTimeline.trimEffects(c,0,len,.00001)}
function trim(c,a,b,moveStart=true){const oldA=c.a,delta=a-oldA;c.a=a;c.b=b;if(moveStart)c.start+=delta;c.effects=c.effects.map(f=>({...f,start:f.start-delta,end:f.end-delta}));clampEffects(c)}
function split(p,ids,at){const added=[];for(const c of p.clips.slice()){if(!ids.has(c.id)||at<=c.start+.0001||at>=end(c)-.0001)continue;const pos=at-c.start,right={...copy(c),id:id('clip'),a:c.a+pos,start:at,fi:0};right.effects=right.effects.map(f=>({...f,id:id('fx'),start:f.start-pos,end:f.end-pos}));c.b=right.a;c.fo=0;clampEffects(c);clampEffects(right);p.clips.push(right);added.push(right.id)}return added}
function affectedTracks(p,ids,range,all){return all?new Set(p.tracks.map(t=>t.id)):new Set(range?[range.track]:p.clips.filter(c=>ids.has(c.id)).map(c=>c.track))}
function remove(p,ids,range,ripple=false,all=false){
 if(!range&&ripple){
  const chosen=p.clips.filter(c=>ids.has(c.id));if(!chosen.length)return false;
  const merge=clips=>{const spans=[];for(const c of clips.slice().sort((a,b)=>a.start-b.start)){const last=spans.at(-1);if(last&&c.start<=last[1])last[1]=Math.max(last[1],end(c));else spans.push([c.start,end(c)])}return spans};
  const global=merge(chosen);p.clips=p.clips.filter(c=>!ids.has(c.id));
  for(const t of p.tracks){const spans=all?global:merge(chosen.filter(c=>c.track===t.id));for(const c of p.clips.filter(c=>c.track===t.id))c.start-=spans.filter(s=>s[1]<=c.start+.000001).reduce((sum,s)=>sum+s[1]-s[0],0);for(const [a,b]of spans.slice().reverse()){const e={effects:t.effects};root.AudioTimeline.cutEffects(e,a,b);t.effects=e.effects}}
  if(all)for(const [a,b]of global.slice().reverse()){const e={effects:p.effects};root.AudioTimeline.cutEffects(e,a,b);p.effects=e.effects}p.length=Math.max(0,...p.clips.map(end));return true;
 }
 const tracks=affectedTracks(p,ids,range,all);let a,b;
 if(range){a=range.s;b=range.e}else{const clips=p.clips.filter(c=>ids.has(c.id));if(!clips.length)return false;a=Math.min(...clips.map(c=>c.start));b=Math.max(...clips.map(end))}
 if(b-a<.00001)return false;const out=[];
 for(const c of p.clips){if(!tracks.has(c.track)){out.push(c);continue}if(!range&&!ids.has(c.id)){if(ripple&&c.start>=b)c.start-=b-a;out.push(c);continue}
  if(end(c)<=a||c.start>=b){if(ripple&&c.start>=b)c.start-=b-a;out.push(c);continue}
  const old=copy(c);if(c.start<a){c.b=c.a+a-c.start;clampEffects(c);out.push(c)}
  if(end(old)>b){const r={...old,id:old.start<a?id('clip'):old.id};trim(r,old.a+b-old.start,old.b);if(ripple)r.start-=b-a;out.push(r)}
 }
 p.clips=out;if(ripple){for(const t of p.tracks)if(tracks.has(t.id)){const e={effects:t.effects};root.AudioTimeline.cutEffects(e,a,b);t.effects=e.effects}if(all){p.length=Math.max(0,p.length-(b-a));const e={effects:p.effects};root.AudioTimeline.cutEffects(e,a,b);p.effects=e.effects}}
 return true;
}
function insertGap(p,at,amount,tracks,all=false){split(p,new Set(p.clips.filter(c=>tracks.has(c.track)).map(c=>c.id)),at);for(const c of p.clips)if(tracks.has(c.track)&&c.start>=at-.000001)c.start+=amount;for(const t of p.tracks)if(tracks.has(t.id))t.effects=root.AudioTimeline.insertEffects(t.effects,at,amount);if(all){p.effects=root.AudioTimeline.insertEffects(p.effects,at,amount);p.length+=amount}}
function duplicate(p,ids){const selected=p.clips.filter(c=>ids.has(c.id));if(!selected.length)return[];const a=Math.min(...selected.map(c=>c.start)),b=Math.max(...selected.map(end));return selected.map(c=>{const n={...copy(c),id:id('clip'),start:c.start+b-a};n.effects=n.effects.map(f=>({...f,id:id('fx')}));p.clips.push(n);return n.id})}
function owner(p,type,target){return type==='master'?p:type==='track'?p.tracks.find(t=>t.id===target):p.clips.find(c=>c.id===target)}
function effect(type,start,stop){return{...root.AudioFX.defaults(type),id:id('fx'),type,start,end:stop,amount:type==='volume'?100:type==='echo'?35:type==='reverb'?30:100,delayMs:180,feedback:35,decay:.45,bypass:false}}
root.AudioProject={id,copy,clamp,end,length,ensure,validate,trim,split,remove,insertGap,duplicate,owner,effect,clampEffects};
})(window);
