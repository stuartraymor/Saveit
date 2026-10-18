// Worker jobs own their copies; cancellation cannot modify the original buffers.
(function(root){
function job(action,buffer,options={}){
 const worker=new Worker(new URL('audio-cleanup-worker.js',document.baseURI)),channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i).slice());let settled=false,rejectJob;
 const promise=new Promise((resolve,reject)=>{rejectJob=reject;worker.onmessage=e=>{if('progress'in e.data){options.progress?.(e.data.progress);return}settled=true;worker.terminate();e.data.error?reject(Error(e.data.error)):resolve(e.data.result)};worker.onerror=e=>{settled=true;worker.terminate();reject(Error(e.message||'Audio processing could not finish.'))};worker.postMessage({action,channels,sampleRate:buffer.sampleRate,profile:options.profile,reductionDb:options.reductionDb},channels.map(c=>c.buffer))});
 return{promise,cancel(){if(!settled){settled=true;worker.terminate();rejectJob(Error('Audio processing cancelled. Original audio is unchanged.'))}}};
}
root.AudioCleanup={job};
})(window);
