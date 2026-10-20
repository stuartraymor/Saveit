// Pixel tools for the Saveit editor: fill, smart object detection, simplify, cut-out, background colour.
(function(root){
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=Math.max(1,w);c.height=Math.max(1,h);return c};
const gd=c=>c.getContext('2d',{willReadFrequently:true});
const close=(d,i,r,g,b,t)=>Math.abs(d[i]-r)<=t&&Math.abs(d[i+1]-g)<=t&&Math.abs(d[i+2]-b)<=t&&d[i+3]>=0;
// Region of similar colour. Returns {mask,count,x0,y0,x1,y1}. contiguous=false matches the whole image.
function region(img,sx,sy,tol,contiguous){const {data:d,width:W,height:H}=img;sx|=0;sy|=0;if(sx<0||sy<0||sx>=W||sy>=H)return null;
  const o=(sy*W+sx)*4,r=d[o],g=d[o+1],b=d[o+2],mask=new Uint8Array(W*H);let n=0,x0=W,y0=H,x1=-1,y1=-1;
  const put=(x,y)=>{mask[y*W+x]=1;n++;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y};
  if(!contiguous){for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(close(d,(y*W+x)*4,r,g,b,tol))put(x,y);return{mask,count:n,x0,y0,x1,y1}}
  const st=[sx,sy];while(st.length){const y=st.pop(),x=st.pop();let l=x;
    while(l>=0&&!mask[y*W+l]&&close(d,(y*W+l)*4,r,g,b,tol))l--;l++;
    let up=false,dn=false;for(let xx=l;xx<W&&!mask[y*W+xx]&&close(d,(y*W+xx)*4,r,g,b,tol);xx++){put(xx,y);
      if(y>0){const m=!mask[(y-1)*W+xx]&&close(d,((y-1)*W+xx)*4,r,g,b,tol);if(m&&!up){st.push(xx,y-1);up=true}else if(!m)up=false}
      if(y<H-1){const m=!mask[(y+1)*W+xx]&&close(d,((y+1)*W+xx)*4,r,g,b,tol);if(m&&!dn){st.push(xx,y+1);dn=true}else if(!m)dn=false}}}
  return{mask,count:n,x0,y0,x1,y1}}
function hex(c){const m=/^#?([0-9a-f]{6})$/i.exec(c||'');const n=m?parseInt(m[1],16):0;return[n>>16&255,n>>8&255,n&255]}
// Small separate objects inside or beside a filled area (the letters of a label, a dot) must not be eaten by "grow edge".
// Returns a mask of every non-filled pixel that belongs to an object smaller than the limit.
function smallObjects(mask,W,H,limit){const prot=new Uint8Array(W*H),seen=new Uint8Array(W*H),stack=new Int32Array(W*H),list=new Int32Array(W*H);
  for(let s=0;s<W*H;s++){if(mask[s]||seen[s])continue;let sp=0,n=0;stack[sp++]=s;seen[s]=1;
    while(sp){const i=stack[--sp];list[n++]=i;const x=i%W,y=(i-x)/W;
      if(x>0&&!mask[i-1]&&!seen[i-1]){seen[i-1]=1;stack[sp++]=i-1}if(x<W-1&&!mask[i+1]&&!seen[i+1]){seen[i+1]=1;stack[sp++]=i+1}
      if(y>0&&!mask[i-W]&&!seen[i-W]){seen[i-W]=1;stack[sp++]=i-W}if(y<H-1&&!mask[i+W]&&!seen[i+W]){seen[i+W]=1;stack[sp++]=i+W}}
    if(n<limit)for(let k=0;k<n;k++)prot[list[k]]=1}
  return prot}
function fill(base,x,y,color,tol,contiguous,grow){const W=base.width,H=base.height,img=gd(base).getImageData(0,0,W,H),R=region(img,x,y,tol,contiguous);if(!R)return null;
  const out=mk(W,H),g=out.getContext('2d');g.drawImage(base,0,0);const none=!color||color==='none',[r,gg,b]=hex(color);let mask=R.mask;
  if(grow>0){const prot=smallObjects(mask,W,H,Math.max(600,Math.round(W*H*.0025))),m2=new Uint8Array(mask);for(let k=0;k<grow;k++){const src=k?m2.slice():mask;for(let yy=1;yy<H-1;yy++)for(let xx=1;xx<W-1;xx++){const i=yy*W+xx;if(!src[i]&&!prot[i]&&(src[i-1]||src[i+1]||src[i-W]||src[i+W]))m2[i]=1}}mask=m2}
  const d=img.data;for(let i=0;i<W*H;i++)if(mask[i]){const o=i*4;if(none){d[o+3]=0}else{d[o]=r;d[o+1]=gg;d[o+2]=b;d[o+3]=255}}
  g.putImageData(img,0,0);return{canvas:out,count:R.count}}
function dominant(base){const W=base.width,H=base.height,d=gd(base).getImageData(0,0,W,H).data,h=new Map(),st=Math.max(1,Math.floor(Math.sqrt(W*H/60000)));
  for(let y=0;y<H;y+=st)for(let x=0;x<W;x+=st){const o=(y*W+x)*4,k=(d[o]>>3)<<10|(d[o+1]>>3)<<5|d[o+2]>>3,e=h.get(k);if(e)e.n++;else h.set(k,{n:1,r:d[o],g:d[o+1],b:d[o+2]})}
  let best=null;for(const e of h.values())if(!best||e.n>best.n)best=e;return best?[best.r,best.g,best.b]:[255,255,255]}
function localBg(base,r){const W=base.width,H=base.height,m=Math.max(14,Math.round(Math.max(r.w,r.h)*1.2)),x=Math.max(0,r.x-m),y=Math.max(0,r.y-m),w=Math.min(W-x,r.w+m*2),h=Math.min(H-y,r.h+m*2),c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(base,-x,-y);return dominant(c)}
function ringColor(base,r){const W=base.width,H=base.height,g=gd(base),h=new Map(),pts=[];
  for(let x=r.x;x<r.x+r.w;x+=Math.max(1,Math.floor(r.w/20))){pts.push([x,r.y-2],[x,r.y+r.h+1])}for(let y=r.y;y<r.y+r.h;y+=Math.max(1,Math.floor(r.h/20))){pts.push([r.x-2,y],[r.x+r.w+1,y])}
  for(const [x,y] of pts){if(x<0||y<0||x>=W||y>=H)continue;const p=g.getImageData(x,y,1,1).data,k=(p[0]>>3)<<10|(p[1]>>3)<<5|p[2]>>3,e=h.get(k);if(e)e.n++;else h.set(k,{n:1,c:[p[0],p[1],p[2]]})}
  let best=null;for(const e of h.values())if(!best||e.n>best.n)best=e;return best?best.c:dominant(base)}
// Smart object detection for a click: a solid area (button, box, bar) or a text/graphic cluster on a plain background.
function smart(base,x,y){const W=base.width,H=base.height,img=gd(base).getImageData(0,0,W,H);x|=0;y|=0;if(x<0||y<0||x>=W||y>=H)return null;
  const R=region(img,x,y,10,true),bw=R.x1-R.x0+1,bh=R.y1-R.y0+1;let bgc3;
  if(R.count>=W*H*.45)bgc3=[img.data[(y*W+x)*4],img.data[(y*W+x)*4+1],img.data[(y*W+x)*4+2]];
  else if(bw>=24&&bh>=24)return{x:R.x0,y:R.y0,w:bw,h:bh,kind:'shape'};
  else bgc3=localBg(base,{x:R.x0,y:R.y0,w:bw,h:bh});
  const d=img.data,br=bgc3[0],bgc=bgc3[1],bb=bgc3[2],fg=new Uint8Array(W*H);
  for(let i=0;i<W*H;i++){const q=i*4;fg[i]=(Math.abs(d[q]-br)>14||Math.abs(d[q+1]-bgc)>14||Math.abs(d[q+2]-bb)>14)?1:0}
  const gx=Math.max(6,Math.round(W/120)),gy=Math.max(3,Math.round(H/160));
  const I=new Int32Array((W+1)*(H+1));for(let yy=0;yy<H;yy++){let rs=0;for(let xx=0;xx<W;xx++){rs+=fg[yy*W+xx];I[(yy+1)*(W+1)+xx+1]=I[yy*(W+1)+xx+1]+rs}}
  const sum=(x0,y0,x1,y1)=>I[(y1+1)*(W+1)+x1+1]-I[y0*(W+1)+x1+1]-I[(y1+1)*(W+1)+x0]+I[y0*(W+1)+x0];
  const dil=new Uint8Array(W*H);for(let yy=0;yy<H;yy++)for(let xx=0;xx<W;xx++)dil[yy*W+xx]=sum(Math.max(0,xx-gx),Math.max(0,yy-gy),Math.min(W-1,xx+gx),Math.min(H-1,yy+gy))>0?1:0;
  // seed: clicked pixel if it is in the dilated mask, else the nearest foreground within 14px
  let sx=x,sy=y;if(!fg[y*W+x]){let bd=1e9;for(let yy=Math.max(0,y-14);yy<=Math.min(H-1,y+14);yy++)for(let xx=Math.max(0,x-14);xx<=Math.min(W-1,x+14);xx++)if(fg[yy*W+xx]){const dd=(xx-x)**2+(yy-y)**2;if(dd<bd){bd=dd;sx=xx;sy=yy}}if(bd===1e9)return null}
  const seen=new Uint8Array(W*H),st=[sx,sy];let x0=W,y0=H,x1=-1,y1=-1;seen[sy*W+sx]=1;
  while(st.length){const cy=st.pop(),cx=st.pop();const i=cy*W+cx;if(fg[i]){if(cx<x0)x0=cx;if(cx>x1)x1=cx;if(cy<y0)y0=cy;if(cy>y1)y1=cy}
    for(const [ax,ay] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=cx+ax,ny=cy+ay;if(nx<0||ny<0||nx>=W||ny>=H)continue;const j=ny*W+nx;if(!seen[j]&&dil[j]){seen[j]=1;st.push(nx,ny)}}}
  if(x1<0)return null;return{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1,kind:'content'}}
// Simplify: soften fine detail, reduce colours, optionally outline edges and shrink the resolution.
function simplify(base,o){const W=base.width,H=base.height,out=mk(W,H),g=out.getContext('2d');
  const blur=(o.detail||0)/100*2.5;g.imageSmoothingQuality='high';
  const tw=o.width??Math.max(1,Math.round(W*(o.scale||100)/100)),th=o.height??Math.max(1,Math.round(H*(o.scale||100)/100));
  if(tw!==W||th!==H){const t=mk(tw,th);const tg=t.getContext('2d');tg.imageSmoothingQuality='high';tg.drawImage(base,0,0,t.width,t.height);g.imageSmoothingEnabled=true;g.drawImage(t,0,0,W,H)}else g.drawImage(base,0,0);
  if(blur>0.05){const t=mk(W,H);t.getContext('2d').drawImage(out,0,0);g.clearRect(0,0,W,H);g.filter=`blur(${blur}px)`;g.drawImage(t,0,0);g.filter='none'}
  const L=Math.max(2,Math.min(32,o.levels||32));
  if(L<32||o.outline){const img=g.getImageData(0,0,W,H),d=img.data,step=255/(L-1);
    let edge=null;if(o.outline){const gray=new Float32Array(W*H);for(let i=0;i<W*H;i++)gray[i]=.3*d[i*4]+.59*d[i*4+1]+.11*d[i*4+2];edge=new Uint8Array(W*H);const th=60;
      for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x,gx=gray[i+1]-gray[i-1]+ (gray[i-W+1]-gray[i-W-1]+gray[i+W+1]-gray[i+W-1])*.5,gy=gray[i+W]-gray[i-W]+(gray[i+W+1]-gray[i-W+1]+gray[i+W-1]-gray[i-W-1])*.5;if(Math.abs(gx)+Math.abs(gy)>th)edge[i]=1}}
    for(let i=0;i<W*H;i++){const q=i*4;if(L<32){d[q]=Math.round(d[q]/step)*step;d[q+1]=Math.round(d[q+1]/step)*step;d[q+2]=Math.round(d[q+2]/step)*step}if(edge&&edge[i]){d[q]=d[q+1]=d[q+2]=30}}
    g.putImageData(img,0,0)}
  return out}
// Remove a strip and close the gap. axis 'x' removes columns [a,b), 'y' removes rows.
function cut(base,axis,a,b){a=Math.max(0,Math.round(a));b=Math.round(b);const W=base.width,H=base.height;
  if(axis==='x'){b=Math.min(W,b);const n=b-a;if(n<1||n>=W)return null;const c=mk(W-n,H),g=c.getContext('2d');g.drawImage(base,0,0,a,H,0,0,a,H);g.drawImage(base,b,0,W-b,H,a,0,W-b,H);return c}
  b=Math.min(H,b);const n=b-a;if(n<1||n>=H)return null;const c=mk(W,H-n),g=c.getContext('2d');g.drawImage(base,0,0,W,a,0,0,W,a);g.drawImage(base,0,b,W,H-b,0,a,W,H-b);return c}
root.ImgTools={region,fill,dominant,ringColor,smart,simplify,cut,hex};
})(window);
