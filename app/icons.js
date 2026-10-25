// 9.8: one shared set of effect icons (24 x 24, drawn with the same 1.8 px rounded stroke as the toolbar),
// used by the video Visual effects list and the image Effects sliders. Each effect has its own symbol and tile
// colour, so Brightness, Contrast, Exposure and the rest can be told apart at a glance (like Snagit and Camtasia).
(function(root){
const F='fill="currentColor" stroke="none"';
const P={
  // sun: brightness
  bright:`<circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.3M12 19.1v2.3M2.6 12h2.3M19.1 12h2.3M5.35 5.35l1.62 1.62M17.03 17.03l1.62 1.62M5.35 18.65l1.62-1.62M17.03 6.97l1.62-1.62"/>`,
  // half-filled circle: contrast
  contrast:`<circle cx="12" cy="12" r="8.6"/><path d="M12 3.4a8.6 8.6 0 0 1 0 17.2z" ${F}/>`,
  // plus / minus split square: exposure (the camera exposure-compensation symbol)
  exposure:`<rect x="3.4" y="3.4" width="17.2" height="17.2" rx="2.6"/><path d="M4.2 19.8 19.8 4.2"/><path d="M6.6 8.6h4.4M8.8 6.4v4.4M13.4 15.6h4.4"/>`,
  // half-full droplet: saturation
  sat:`<path d="M12 3.2c2.4 3 6.3 7 6.3 10.7a6.3 6.3 0 0 1-12.6 0C5.7 10.2 9.6 6.2 12 3.2z"/><path d="M6.1 14.2a5.9 5.9 0 0 0 11.8 0z" ${F}/>`,
  // picture split in black and white
  bw:`<rect x="3.4" y="5" width="17.2" height="14" rx="2.2"/><path d="M12 5h6.4a2.2 2.2 0 0 1 2.2 2.2v9.6a2.2 2.2 0 0 1-2.2 2.2H12z" ${F}/>`,
  // old photograph
  sepia:`<rect x="3.4" y="5" width="17.2" height="14" rx="2.2"/><path d="m6.4 16.2 3.9-4.4 2.9 2.9 2.1-2.1 2.5 3.6"/><circle cx="15.6" cy="9" r="1.5"/>`,
  // swap arrows: invert
  invert:`<path d="M4 8.4h14.2l-3.4-3.4M20 15.6H5.8l3.4 3.4"/>`,
  // colour wheel: hue (keeps its own colours)
  hue:`<g stroke-width="3.2"><path d="M12 3.4A8.6 8.6 0 0 1 20.6 12" stroke="#ff6b6b"/><path d="M20.6 12A8.6 8.6 0 0 1 12 20.6" stroke="#ffd43b"/><path d="M12 20.6A8.6 8.6 0 0 1 3.4 12" stroke="#51cf66"/><path d="M3.4 12A8.6 8.6 0 0 1 12 3.4" stroke="#4dabf7"/></g><circle cx="12" cy="12" r="2.4" ${F}/>`,
  // soft rings fading out: blur
  blur:`<circle cx="12" cy="12" r="3.3" ${F}/><circle cx="12" cy="12" r="6.4" opacity=".6"/><circle cx="12" cy="12" r="9.4" opacity=".28"/>`,
  // flame: warm
  warm:`<path d="M12 2.8c.6 3.3 5.4 5.4 5.4 10.6a5.4 5.4 0 0 1-10.8 0c0-2.6 1.4-4.3 2.7-5.4.2 1.9 1.1 3.2 2.3 3.6-.6-2.8-.4-5.8.4-8.8z"/><path d="M12 20.2a2.4 2.4 0 0 1-2.4-2.4c0-1.6 1.6-2.6 2.4-4 .8 1.4 2.4 2.4 2.4 4a2.4 2.4 0 0 1-2.4 2.4z" ${F} opacity=".85"/>`,
  // snowflake: cool
  cool:`<path d="M12 2.8v18.4M4.03 7.4l15.94 9.2M4.03 16.6l15.94-9.2"/><path d="m9.5 4.5 2.5 2 2.5-2M9.5 19.5l2.5-2 2.5 2M4.6 10.4l3.1-.6-1-3M19.4 13.6l-3.1.6 1 3M4.6 13.6l3.1.6-1 3M19.4 10.4l-3.1-.6 1-3"/>`,
  // frame with darkened corners: vignette
  vignette:`<path fill-rule="evenodd" d="M5.4 5h13.2a2.2 2.2 0 0 1 2.2 2.2v9.6a2.2 2.2 0 0 1-2.2 2.2H5.4a2.2 2.2 0 0 1-2.2-2.2V7.2A2.2 2.2 0 0 1 5.4 5zM12 7.7a5.4 4.3 0 1 0 0 8.6 5.4 4.3 0 1 0 0-8.6z" ${F} opacity=".55"/><rect x="3.2" y="5" width="17.6" height="14" rx="2.2"/>`,
};
// tile colours (background gradient, icon colour)
const T={bright:['#f59f00','#ffc533','#fff'],contrast:['#495057','#868e96','#fff'],exposure:['#e8590c','#ff922b','#fff'],sat:['#d6336c','#f06595','#fff'],
  bw:['#343a40','#6c757d','#fff'],sepia:['#8d5a2b','#c08552','#fff'],invert:['#5f3dc4','#845ef7','#fff'],hue:['#212529','#3b4148','#fff'],
  blur:['#0b7285','#22b8cf','#fff'],warm:['#e03131','#ff8c3a','#fff'],cool:['#1864ab','#4dabf7','#fff'],vignette:['#3b2f63','#7048e8','#fff']};
// image Effects slider keys -> the same symbols
const ALIAS={br:'bright',co:'contrast',sa:'sat',gray:'bw',vig:'vignette'};
function svg(k,size){k=ALIAS[k]||k;const p=P[k];if(!p)return'';return`<svg viewBox="0 0 24 24" width="${size||16}" height="${size||16}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${p}</svg>`}
// a coloured tile holding the symbol, sized by CSS (.fxic)
function tile(k,extra){k=ALIAS[k]||k;const t=T[k]||['#495057','#868e96','#fff'];return`<i class="fxic fxic-${k}${extra?' '+extra:''}" aria-hidden="true" style="background:linear-gradient(135deg,${t[0]},${t[1]});color:${t[2]}">${svg(k,15)}</i>`}
const CSS=`.fxic{display:inline-grid;place-items:center;width:26px;height:22px;border-radius:6px;flex:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,.14),0 1px 2px rgba(0,0,0,.35)}
.fxic svg{display:block;filter:drop-shadow(0 1px 0 rgba(0,0,0,.25))}
.fxic.sm{width:20px;height:18px;border-radius:5px}.fxic.sm svg{width:13px;height:13px}`;
function css(){if(typeof document==='undefined'||document.getElementById('fxicCss'))return;const s=document.createElement('style');s.id='fxicCss';s.textContent=CSS;(document.head||document.documentElement).appendChild(s)}
css();
root.SaveitIcons={svg,tile,has:k=>!!P[ALIAS[k]||k],keys:Object.keys(P)};
})(window);
