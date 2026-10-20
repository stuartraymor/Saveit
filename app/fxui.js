// Effect picker: a dropdown plus a small settings button that pops up the controls for the chosen effect.
window.FXUI={
 mount(sel,gear,state,onChange,onToggle){
  if(!document.getElementById('fxui-css')){const st=document.createElement('style');st.id='fxui-css';st.textContent=`
  .fxpop{position:fixed;z-index:9999;min-width:230px;background:#16181a;color:#e8eaec;border:1px solid #3a3f45;border-radius:10px;padding:10px 12px;box-shadow:0 8px 28px rgba(0,0,0,.55);font:12px "Segoe UI",system-ui,sans-serif;display:none}
  .fxpop.on{display:block}.fxpop h4{margin:0 0 8px;font-size:12px}
  .fxpop .r{display:flex;align-items:center;gap:8px;margin:6px 0}.fxpop .r span:first-child{width:62px;color:#b4bac0}.fxpop .r input[type=range]{flex:1;min-width:0}
  .fxpop .v{width:30px;text-align:right;font-family:Consolas,monospace;color:#9aa1a8}.fxpop select{background:#26292d;color:#e8eaec;border:1px solid #3a3f45;border-radius:6px;padding:3px}
  .fxpop .h{color:#9aa1a8}`;document.head.appendChild(st)}
  sel.innerHTML=FXDEFS.map(d=>`<option value="${d.id}">${d.label}</option>`).join('');
  const pop=document.createElement('div');pop.className='fxpop';document.body.appendChild(pop);
  const def=()=>FXDEFS.find(d=>d.id===state.id)||FXDEFS[0];
  const close=()=>{if(pop.classList.contains('on')){pop.classList.remove('on');onToggle&&onToggle(false)}};
  const place=()=>{const r=gear.getBoundingClientRect(),w=pop.offsetWidth||240;pop.style.left=Math.max(6,Math.min(innerWidth-w-6,r.left))+'px';pop.style.top=(r.bottom+6)+'px'};
  function build(){const d=def();sel.value=d.id;gear.disabled=!d.params.length;gear.title=d.params.length?'Settings for this effect':'This effect has no settings';
   pop.innerHTML=`<h4>${d.label}</h4>`+(d.params.length?d.params.map(q=>{const v=state.p[q.k]!=null?state.p[q.k]:q.def;
    if(q.type==='color')return`<div class="r"><span>${q.label}</span><input type="color" data-k="${q.k}" value="${v}"></div>`;
    if(q.type==='select')return`<div class="r"><span>${q.label}</span><select data-k="${q.k}">${q.options.map(([a,b])=>`<option value="${a}" ${a===v?'selected':''}>${b}</option>`).join('')}</select></div>`;
    return`<div class="r"><span>${q.label}</span><input type="range" data-k="${q.k}" min="${q.min}" max="${q.max}" value="${v}"><span class="v">${v}</span></div>`}).join(''):'<p class="h">Nothing to adjust.</p>');
   pop.querySelectorAll('[data-k]').forEach(el=>{const h=()=>{state.p[el.dataset.k]=el.type==='range'?+el.value:el.value;if(el.type==='range')el.nextElementSibling.textContent=el.value;onChange(state)};el.oninput=h;el.onchange=h})}
  sel.onchange=()=>{state.id=sel.value;state.p=FXDEFAULTS(state.id);build();onChange(state);if(def().params.length){pop.classList.add('on');place();onToggle&&onToggle(true)}else close()};
  gear.onclick=e=>{e.stopPropagation();if(gear.disabled)return;const on=!pop.classList.contains('on');if(on){build();pop.classList.add('on');place()}else pop.classList.remove('on');onToggle&&onToggle(on)};
  document.addEventListener('mousedown',e=>{if(!pop.contains(e.target)&&e.target!==gear&&e.target!==sel)close()},true);
  build();
  return{set(s){state.id=s&&s.id||'none';state.p=s&&s.p||FXDEFAULTS(state.id);build()},close,popEl:pop}}};
