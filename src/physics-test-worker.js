import {LabExperiment} from './physics-test-core.js';
import {validateLabSettings,LAB_SURFACES} from './physics-test-settings.js';
let experiment=null,timer=null,generation=0,last=0,accumulator=0,lastSent=0,lastField=0,wallStart=0,simStart=0,sendField=true,lastInput=0;
function stop(){if(timer!==null)clearInterval(timer);timer=null;accumulator=0;experiment?.setControl({brake:true})}
function emit(type='state',extra={}){
 if(!experiment)return;
 const now=performance.now(),message={type,generation,state:experiment.snapshot(),samples:experiment.samples.slice(-3),...extra};
 if(experiment.flow&&sendField&&now-lastField>=80){message.field=experiment.flow.field();lastField=now}
 postMessage(message,message.field?[message.field.velocity.buffer,message.field.solid.buffer]:[]);lastSent=now;
}
function run(){
 if(!experiment||experiment.status==='completed'||timer!==null)return;
 experiment.status='running';last=performance.now();wallStart=last;simStart=experiment.time;
 timer=setInterval(()=>{try{
  const now=performance.now();
  if(experiment.settings.control.mode==='manual'&&now-lastInput>450&&(experiment.command.forward!==0||experiment.command.turn!==0))experiment.setControl({brake:true});
  accumulator+=Math.min(.1,(now-last)/1000)*experiment.settings.control.timeScale;last=now;
  const steps=Math.min(12,Math.floor((accumulator+1e-10)*120));
  if(steps){experiment.step(steps);accumulator=Math.max(0,accumulator-steps/120)}
  if(now-lastSent>=32)emit('state',{realtime_ratio:(experiment.time-simStart)/Math.max(.001,(now-wallStart)/1000)});
  if(experiment.status==='completed'){stop();emit('completed',{report:experiment.report()})}
 }catch(error){stop();postMessage({type:'error',generation,message:error.message})}},8);
}
self.onmessage=async({data})=>{try{
 if(data.command==='configure'){
  const token=++generation;stop();experiment?.dispose();experiment=null;
  const next=await new LabExperiment(validateLabSettings(data.settings)).initialize();
  if(token!==generation){next.dispose();return}
  experiment=next;lastField=0;lastInput=performance.now();emit('ready',{request_id:data.request_id,settings:next.settings,profile:next.profile});return;
 }
 if(data.command==='input'){if(experiment&&data.generation===generation){experiment.setControl(data.input);lastInput=performance.now()}return}
 if(data.command==='update'){
  if(!experiment||data.generation!==generation)return;
  const settings=experiment.updateSettings(data.settings);emit('settings-applied',{request_id:data.request_id,settings});return;
 }
 if(data.command==='balloon-impulse'){experiment?.impulseBalloon(data.impulse);emit();return}
 if(data.command==='start'){run();return}
 if(data.command==='pause'){stop();if(experiment&&experiment.status!=='completed')experiment.status='paused';emit('paused',{reason:data.reason||'user'});return}
 if(data.command==='step'){stop();if(experiment){if(experiment.settings.control.mode==='manual')experiment.setControl(data.input||{});experiment.step(Math.max(1,Math.min(120,Math.round(data.count)||1)));if(experiment.status!=='completed')experiment.status='paused';emit()}return}
 if(data.command==='report'){if(experiment)postMessage({type:'report',report:experiment.report()});return}
 if(data.command==='field'){sendField=!!data.enabled;return}
 if(data.command==='compare'){
  const token=++generation;stop();if(experiment&&experiment.status!=='completed')experiment.status='paused';const results=[];
  for(const surface of Object.keys(LAB_SURFACES)){
   const s=validateLabSettings({...data.settings,case:'surface',surface,control:{...data.settings.control,mode:'scripted'}}),test=await new LabExperiment(s).initialize();
   while(test.status!=='completed'){
    test.step(120);postMessage({type:'compare-progress',surface,time_s:test.time,duration_s:s.drive.duration});await new Promise(r=>setTimeout(r,0));
    if(token!==generation){test.dispose();return}
   }
   results.push({surface,summary:test.summary()});test.dispose();
  }
  postMessage({type:'comparison',results});emit();return;
 }
 if(data.command==='cancel'){generation++;stop();if(experiment)experiment.status='paused';emit('paused');return}
}catch(error){postMessage({type:'error',generation,request_id:data.request_id,message:error.message})}};
postMessage({type:'worker-ready'});
