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
  results:[],
  check(name,ok,detail){QA.results.push({name,ok:!!ok,detail:detail===undefined?'':detail});return !!ok},
};
