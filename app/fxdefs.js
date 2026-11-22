// Shared effect definitions (used by the editor, the capture widget and the floating widget)
// 10.4.12: every effect has more settings, effects can be stacked (a list of {id,p}), and the adjustments of stacked
// effects add up (Black & white plus More contrast gives both).
const FXAMT=(k,label,min,max,def)=>({k,label,min,max,def});
window.FXDEFS=[
 {id:'none',label:'No effect',params:[]},
 {id:'shadow',label:'Drop shadow',params:[FXAMT('blur','Softness',4,60,24),FXAMT('dist','Distance',0,40,8),
   {k:'dir',label:'Direction',type:'select',options:[['down','Below'],['br','Below right'],['bl','Below left'],['around','All around']],def:'down'},
   FXAMT('op','Darkness',10,90,38),{k:'color',label:'Color',type:'color',def:'#000000'}]},
 {id:'border',label:'Border',params:[FXAMT('w','Width',1,40,6),{k:'color',label:'Color',type:'color',def:'#1b2428'},
   {k:'style',label:'Style',type:'select',options:[['solid','Solid'],['dashed','Dashed'],['dotted','Dotted'],['double','Double']],def:'solid'},
   {k:'place',label:'Placement',type:'select',options:[['outside','Around'],['inside','Over edge']],def:'outside'},FXAMT('r','Corners',0,60,0)]},
 {id:'rounded',label:'Rounded corners',params:[FXAMT('r','Radius',2,80,16),
   {k:'which',label:'Corners',type:'select',options:[['all','All'],['top','Top'],['bottom','Bottom'],['left','Left'],['right','Right']],def:'all'}]},
 {id:'torn',label:'Torn / cut edge',params:[{k:'style',label:'Style',type:'select',options:[['torn','Torn paper'],['zigzag','Zigzag'],['wave','Wave']],def:'torn'},
   FXAMT('depth','Depth',3,30,10),FXAMT('size','Size',4,60,14)]},
 {id:'gray',label:'Black & white',params:[FXAMT('amt','Amount',0,100,100),FXAMT('co','Contrast',-60,80,0),FXAMT('br','Brightness',-60,60,0)]},
 {id:'sepia',label:'Sepia',params:[FXAMT('amt','Amount',0,100,80),FXAMT('co','Contrast',-60,80,0),FXAMT('br','Brightness',-60,60,0)]},
 {id:'vignette',label:'Vignette',params:[FXAMT('amt','Strength',5,100,50),FXAMT('size','Size',10,90,50),{k:'color',label:'Color',type:'color',def:'#000000'}]},
 {id:'soften',label:'Soften (blur)',params:[FXAMT('px','Blur',1,20,3),FXAMT('br','Brightness',-60,60,0),FXAMT('sa','Saturation',-100,100,0)]},
 {id:'brighten',label:'Brighten',params:[FXAMT('amt','Amount',-60,60,20),FXAMT('co','Contrast',-60,80,0),FXAMT('sa','Saturation',-100,100,0)]},
 {id:'contrast',label:'More contrast',params:[FXAMT('amt','Amount',-60,80,30),FXAMT('br','Brightness',-60,60,0),FXAMT('sa','Saturation',-100,100,0)]},
 {id:'hue',label:'Color shift',params:[FXAMT('hue','Hue',-180,180,90),FXAMT('sa','Saturation',-100,100,0)]},
 {id:'invert',label:'Invert colors',params:[{k:'on',label:'On',type:'toggle',def:true}]}
];
window.FXBLANK=function(){return{border:0,borderColor:'#1b2428',radius:0,shadow:false,shadowBlur:24,adj:{br:0,co:0,sa:0,hue:0,blur:0,gray:0,sepia:0,invert:0},edge:null,vig:0}};
window.FXDEFAULTS=function(id){const d=FXDEFS.find(x=>x.id===id),p={};if(d)d.params.forEach(q=>p[q.k]=q.def);return p};
// The capture effect setting is a list of {id,p}; older settings were one {id,p}.
window.FXLIST=function(v){const a=Array.isArray(v)?v:(v&&v.id?[v]:[]);return a.filter(e=>e&&e.id&&e.id!=='none'&&FXDEFS.some(d=>d.id===e.id)).map(e=>({id:e.id,p:Object.assign(FXDEFAULTS(e.id),e.p||{})}))};
// Apply one effect (with its settings) onto an fx object
window.FXAPPLY=function(f,id,p){p=Object.assign(FXDEFAULTS(id),p||{});f.adj=Object.assign({br:0,co:0,sa:0,hue:0,blur:0,gray:0,sepia:0,invert:0},f.adj||{});
 const add=(k,v)=>{f.adj[k]=(+f.adj[k]||0)+(+v||0)};
 switch(id){
  case'shadow':{const d=+p.dist||0,o={down:[0,d],br:[d,d],bl:[-d,d],around:[0,0]}[p.dir]||[0,d];f.shadow=true;f.shadowBlur=+p.blur;f.shadowX=o[0];f.shadowY=o[1];f.shadowOp=(+p.op||38)/100;f.shadowColor=p.color;break}
  case'border':f.border=+p.w;f.borderColor=p.color;f.bStyle=p.style||'solid';f.bPlace=p.place==='inside'?'inside':'outside';if(+p.r>0){f.radius=+p.r;f.radii=null}break;
  case'rounded':{const r=+p.r,m={all:[r,r,r,r],top:[r,r,0,0],bottom:[0,0,r,r],left:[r,0,0,r],right:[0,r,r,0]}[p.which]||[r,r,r,r];f.radius=r;f.radii=p.which&&p.which!=='all'?m:null;break}
  case'torn':f.edge={style:p.style,depth:+p.depth,size:+p.size};break;
  case'gray':add('gray',p.amt);add('co',p.co);add('br',p.br);break;
  case'sepia':add('sepia',p.amt);add('co',p.co);add('br',p.br);break;
  case'vignette':f.vig=+p.amt;f.vigSize=+p.size;f.vigColor=p.color;break;
  case'soften':add('blur',p.px);add('br',p.br);add('sa',p.sa);break;
  case'brighten':add('br',p.amt);add('co',p.co);add('sa',p.sa);break;
  case'contrast':add('co',p.amt);add('br',p.br);add('sa',p.sa);break;
  case'hue':add('hue',p.hue);add('sa',p.sa);break;
  case'invert':add('invert',p.on===false||p.on==='false'?0:(p.amt!=null?+p.amt:100));break}
 return f};
// Apply a list of effects in order
window.FXAPPLYALL=function(f,list){for(const e of FXLIST(list))FXAPPLY(f,e.id,e.p);return f};
// Vignette shading used by the editor, exports and the capture preview
window.FXVIG=function(g,x,y,W,H,f){if(!f.vig)return;const inner=Math.max(0,Math.min(.9,(100-(f.vigSize!=null?+f.vigSize:50))/100*.5)),c=/^#[0-9a-f]{6}$/i.test(f.vigColor||'')?f.vigColor:'#000000',rgb=[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)).join(',');
 const gr=g.createRadialGradient(x+W/2,y+H/2,Math.min(W,H)*inner,x+W/2,y+H/2,Math.hypot(W,H)/2);gr.addColorStop(0,`rgba(${rgb},0)`);gr.addColorStop(1,`rgba(${rgb},${f.vig/100*.85})`);g.fillStyle=gr;g.fillRect(x,y,W,H)};
window.FXFILTER=function(a){if(!a)return'none';const o=[];
 if(a.br)o.push(`brightness(${100+a.br}%)`);if(a.co)o.push(`contrast(${100+a.co}%)`);if(a.sa)o.push(`saturate(${100+a.sa}%)`);if(a.hue)o.push(`hue-rotate(${a.hue}deg)`);
 if(a.blur)o.push(`blur(${a.blur}px)`);if(a.gray)o.push(`grayscale(${a.gray}%)`);if(a.sepia)o.push(`sepia(${a.sepia}%)`);if(a.invert)o.push(`invert(${a.invert}%)`);
 return o.length?o.join(' '):'none'};
