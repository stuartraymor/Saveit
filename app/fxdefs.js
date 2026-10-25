// Shared effect definitions (used by the editor, the capture widget and the floating widget)
window.FXDEFS=[
 {id:'none',label:'No effect',params:[]},
 {id:'shadow',label:'Drop shadow',params:[{k:'blur',label:'Softness',min:4,max:30,def:24}]},
 {id:'border',label:'Border',params:[{k:'w',label:'Width',min:1,max:40,def:6},{k:'color',label:'Color',type:'color',def:'#1b2428'}]},
 {id:'rounded',label:'Rounded corners',params:[{k:'r',label:'Radius',min:2,max:80,def:16}]},
 {id:'torn',label:'Torn / cut edge',params:[{k:'style',label:'Style',type:'select',options:[['torn','Torn paper'],['zigzag','Zigzag'],['wave','Wave']],def:'torn'},{k:'depth',label:'Depth',min:3,max:30,def:10}]},
 {id:'gray',label:'Black & white',params:[{k:'amt',label:'Amount',min:0,max:100,def:100}]},
 {id:'sepia',label:'Sepia',params:[{k:'amt',label:'Amount',min:0,max:100,def:80}]},
 {id:'vignette',label:'Vignette',params:[{k:'amt',label:'Strength',min:5,max:100,def:50}]},
 {id:'soften',label:'Soften (blur)',params:[{k:'px',label:'Blur',min:1,max:20,def:3}]},
 {id:'brighten',label:'Brighten',params:[{k:'amt',label:'Amount',min:-60,max:60,def:20}]},
 {id:'contrast',label:'More contrast',params:[{k:'amt',label:'Amount',min:-60,max:80,def:30}]},
 {id:'invert',label:'Invert colors',params:[]}
];
window.FXBLANK=function(){return{border:0,borderColor:'#1b2428',radius:0,shadow:false,shadowBlur:24,adj:{br:0,co:0,sa:0,hue:0,blur:0,gray:0,sepia:0,invert:0},edge:null,vig:0}};
window.FXDEFAULTS=function(id){const d=FXDEFS.find(x=>x.id===id),p={};if(d)d.params.forEach(q=>p[q.k]=q.def);return p};
// Apply one effect (with its settings) onto an fx object
window.FXAPPLY=function(f,id,p){p=Object.assign(FXDEFAULTS(id),p||{});f.adj=Object.assign({br:0,co:0,sa:0,hue:0,blur:0,gray:0,sepia:0,invert:0},f.adj||{});
 switch(id){
  case'shadow':f.shadow=true;f.shadowBlur=+p.blur;break;
  case'border':f.border=+p.w;f.borderColor=p.color;break;
  case'rounded':f.radius=+p.r;break;
  case'torn':f.edge={style:p.style,depth:+p.depth};break;
  case'gray':f.adj.gray=+p.amt;break;
  case'sepia':f.adj.sepia=+p.amt;break;
  case'vignette':f.vig=+p.amt;break;
  case'soften':f.adj.blur=+p.px;break;
  case'brighten':f.adj.br=+p.amt;break;
  case'contrast':f.adj.co=+p.amt;break;
  case'invert':f.adj.invert=100;break}
 return f};
window.FXFILTER=function(a){if(!a)return'none';const o=[];
 if(a.br)o.push(`brightness(${100+a.br}%)`);if(a.co)o.push(`contrast(${100+a.co}%)`);if(a.sa)o.push(`saturate(${100+a.sa}%)`);if(a.hue)o.push(`hue-rotate(${a.hue}deg)`);
 if(a.blur)o.push(`blur(${a.blur}px)`);if(a.gray)o.push(`grayscale(${a.gray}%)`);if(a.sepia)o.push(`sepia(${a.sepia}%)`);if(a.invert)o.push(`invert(${a.invert}%)`);
 return o.length?o.join(' '):'none'};
