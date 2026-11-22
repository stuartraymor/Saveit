// Capture effect picker: rows of effects, each with its settings inline, that stack (used by the capture bar).
window.FXUI={
 // 10.4.12: effects in rows (capture bar under the selection): each row is an effect dropdown with its settings beside
 // it and a remove button; "Add effect" at the bottom right adds another row, so effects stack (Black & white + Border).
 stack(host,onChange){let rows=[{id:'none',p:{}}];
  const esc=v=>String(v).replace(/"/g,'&quot;');
  const ctl=(q,v,i)=>{const a=`data-i="${i}" data-k="${q.k}" aria-label="${q.label}"`;
   if(q.type==='color')return`<input type="color" ${a} value="${esc(v)}">`;
   if(q.type==='toggle')return`<input type="checkbox" class="fxtog" role="switch" ${a} ${v===false||v==='false'?'':'checked'}>`;
   if(q.type==='select')return`<select ${a}>${q.options.map(([o,l])=>`<option value="${o}" ${o===v?'selected':''}>${l}</option>`).join('')}</select>`;
   return`<input type="range" ${a} min="${q.min}" max="${q.max}" value="${v}"><span class="v">${v}</span>`};
  const list=()=>rows.filter(r=>r.id!=='none').map(r=>({id:r.id,p:{...r.p}}));
  const fire=()=>onChange(list());
  function build(){const used=rows.map(r=>r.id),last=rows.length-1,canAdd=FXDEFS.some(d=>d.id!=='none'&&!used.includes(d.id));
   host.innerHTML=rows.map((r,i)=>{const d=FXDEFS.find(x=>x.id===r.id)||FXDEFS[0];
    return`<div class="r2 fxr" data-row="${i}"><select class="fxsel" data-i="${i}" title="Effect applied to this capture" aria-label="Effect ${i+1}">${FXDEFS.map(x=>`<option value="${x.id}" ${x.id===r.id?'selected':''} ${x.id!=='none'&&x.id!==r.id&&used.includes(x.id)?'disabled':''}>${x.label}</option>`).join('')}</select>`+
     d.params.map(q=>`<span class="sep"></span><label class="fxp">${q.label} ${ctl(q,r.p[q.k]!=null?r.p[q.k]:q.def,i)}</label>`).join('')+
     `<span class="fxsp"></span>${rows.length>1?`<button class="fxdel" data-i="${i}" title="Remove this effect" aria-label="Remove effect ${i+1}">✕</button>`:''}`+
     (i===last?`<button class="fxadd" id="fxAdd" title="Add another effect on top of this one" ${canAdd&&r.id!=='none'?'':'disabled'}>+ Add effect</button>`:'')+`</div>`}).join('');
   host.querySelectorAll('.fxsel').forEach(el=>el.onchange=()=>{const r=rows[+el.dataset.i];r.id=el.value;r.p=FXDEFAULTS(r.id);build();fire()});
   host.querySelectorAll('[data-k]').forEach(el=>{const h=()=>{rows[+el.dataset.i].p[el.dataset.k]=el.type==='range'?+el.value:el.type==='checkbox'?el.checked:el.value;if(el.type==='range')el.nextElementSibling.textContent=el.value;fire()};el.oninput=h;el.onchange=h});
   host.querySelectorAll('.fxdel').forEach(el=>el.onclick=()=>{rows.splice(+el.dataset.i,1);if(!rows.length)rows=[{id:'none',p:{}}];build();fire()});
   const add=host.querySelector('#fxAdd');if(add)add.onclick=()=>{const u=rows.map(r=>r.id),d=FXDEFS.find(x=>x.id!=='none'&&!u.includes(x.id));if(!d)return;rows.push({id:d.id,p:FXDEFAULTS(d.id)});build();fire();const s=host.querySelectorAll('.fxsel');s[s.length-1].focus()}}
  build();
  return{set(v){const l=FXLIST(v);rows=l.length?l:[{id:'none',p:{}}];build()},get:list}}};
