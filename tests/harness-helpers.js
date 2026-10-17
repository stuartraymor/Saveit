// Loaded only by the test harness (tests/build-harness.js). Small helpers for the automated UI tests.
window.QA={
  sleep:ms=>new Promise(r=>setTimeout(r,ms)),
  async until(fn,ms=8000,step=50){const t=performance.now();for(;;){let v;try{v=await fn()}catch(_){}if(v)return v;if(performance.now()-t>ms)throw new Error('timed out waiting for '+fn);await QA.sleep(step)}},
  canvas(w=640,h=360,col='#8ac'){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle=col;g.fillRect(0,0,w,h);return c},
  // Records a short test video (moving colour + a time label + a tone) with MediaRecorder.
  async video(sec=3,w=640,h=360){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d'),st=c.captureStream(30),ac=new AudioContext(),o=ac.createOscillator(),d=ac.createMediaStreamDestination();o.connect(d);o.start();st.addTrack(d.stream.getAudioTracks()[0]);
    const mt=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/webm;codecs=vp9,opus','video/webm'].find(m=>MediaRecorder.isTypeSupported(m)),mr=new MediaRecorder(st,{mimeType:mt}),ch=[];mr.ondataavailable=e=>e.data.size&&ch.push(e.data);
    const t0=performance.now();const iv=setInterval(()=>{const t=(performance.now()-t0)/1000;g.fillStyle=`hsl(${t*60},60%,45%)`;g.fillRect(0,0,w,h);g.fillStyle='#fff';g.font='bold 60px Segoe UI';g.fillText(t.toFixed(1)+' s',40,120)},33);
    mr.start(250);await QA.sleep(sec*1000);mr.stop();await new Promise(r=>mr.onstop=r);clearInterval(iv);o.stop();ac.close();return{blob:new Blob(ch,{type:mt.split(';')[0]}),mp4:mt.includes('mp4')}},
  async openVideo(sec=3){const {blob,mp4}=await QA.video(sec);const it=__T.addVideo(blob,'QA test video '+Date.now());if(mp4)it.mp4=blob;else it.webm=blob;__T.openItem(it);await QA.until(()=>__T.vid&&__T.vid._ctl&&__T.vid._ctl.getProject&&__T.vid._ctl.getProject());return it},
  // Duration of a media blob, read the same way the editor does.
  async duration(blob){const v=document.createElement('video');v.preload='auto';v.src=URL.createObjectURL(blob);await new Promise(r=>{v.onloadedmetadata=r;v.onerror=r});if(isFinite(v.duration)&&v.duration>0)return v.duration;
    await new Promise(r=>{v.ontimeupdate=()=>{v.ontimeupdate=null;r()};v.currentTime=1e101;setTimeout(r,4000)});return v.duration},
  key(k,o={}){(document.activeElement||document.body).dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true,...o}))},
  // Real pointer events on the editor canvas, in page (CSS) pixels. hold() presses and moves but does not let go.
  ev(x,y,b){return{clientX:x,clientY:y,bubbles:true,pointerId:1,button:0,buttons:b,isPrimary:true,pointerType:'mouse'}},
  async hold(x0,y0,x1,y1,steps=8,el){el=el||document.querySelector('#cv');el.dispatchEvent(new PointerEvent('pointerdown',QA.ev(x0,y0,1)));for(let i=1;i<=steps;i++){el.dispatchEvent(new PointerEvent('pointermove',QA.ev(x0+(x1-x0)*i/steps,y0+(y1-y0)*i/steps,1)));await QA.sleep(16)}},
  async release(x,y,el){el=el||document.querySelector('#cv');const p=QA.ev(x,y,0);el.dispatchEvent(new PointerEvent('pointerup',p));window.dispatchEvent(new PointerEvent('pointerup',p));await QA.sleep(60)},
  async drag(x0,y0,x1,y1,steps,el){await QA.hold(x0,y0,x1,y1,steps,el);await QA.release(x1,y1,el)},
  // canvas pixel at an image coordinate of the current picture
  px(ix,iy){const cv=document.querySelector('#cv'),g=cv.getContext('2d'),p=(cv.width-__T.S.cur.base.width)/2;return[...g.getImageData(Math.round(ix+p),Math.round(iy+p),1,1).data]},
  page(){const c=document.createElement('canvas');c.width=1200;c.height=700;const g=c.getContext('2d');g.fillStyle='#f5f7fa';g.fillRect(0,0,1200,700);g.fillStyle='#1f3b57';g.fillRect(0,0,1200,70);g.fillStyle='#fff';g.font='bold 30px Segoe UI';g.fillText('Account settings',30,46);
    g.fillStyle='#142130';g.font='22px Segoe UI';['Name: Jane Example','Email: jane@example.com','Card: 4111 1111 1111 1111','Phone: 555-0100'].forEach((t,i)=>g.fillText(t,60,140+i*60));g.fillStyle='#087f8c';g.fillRect(60,420,220,60);g.fillStyle='#fff';g.fillText('Save changes',95,458);g.fillStyle='#d52b3e';g.fillRect(320,420,160,60);g.fillStyle='#fff';g.fillText('Delete',360,458);return c},
  // image coordinate -> page pixel on the editor canvas
  at(ix,iy){const cv=document.querySelector('#cv'),r=cv.getBoundingClientRect(),p=(cv.width-__T.S.cur.base.width)/2;return[r.left+(ix+p)*r.width/cv.width,r.top+(iy+p)*r.height/cv.height]},
  // controls in the top bar that sit on top of each other or run off the window
  overlaps(){const top=document.querySelector('.top');const els=[...top.querySelectorAll('button,select,label,input')].filter(e=>e.offsetParent&&(!e.closest('label')||e.tagName==='LABEL'));const box=e=>e.getBoundingClientRect(),nm=e=>(e.id||e.textContent.trim().slice(0,14)||e.className).replace(/\s+/g,' ');const hits=new Set();
    for(let i=0;i<els.length;i++)for(let j=i+1;j<els.length;j++){const a=els[i],b=els[j];if(a.contains(b)||b.contains(a))continue;const A=box(a),B=box(b);if(Math.min(A.right,B.right)-Math.max(A.left,B.left)>3&&Math.min(A.bottom,B.bottom)-Math.max(A.top,B.top)>3)hits.add(nm(a)+' X '+nm(b))}
    return{w:innerWidth,hits:[...hits],offscreen:els.filter(e=>box(e).right>innerWidth+1).map(nm)}},
  results:[],
  check(name,ok,detail){QA.results.push({name,ok:!!ok,detail:detail===undefined?'':detail});return !!ok},
};
