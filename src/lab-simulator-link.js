import {validateLabSettings,labSurface,transferableTerrain} from './physics-test-settings.js';
export const LAB_TRANSFER_KEY='dynora-lab-transfer-14';
export const LAB_ACK_KEY='dynora-lab-ack-14';
export const LAB_DESTINATIONS=['apartment','canteen','obstacle track'];

export function labTransfer(settings,destination,scope='profile',now=Date.now()){
 if(!LAB_DESTINATIONS.includes(destination))throw Error('Choose the simulator environment to update');
 if(!['profile','terrain','contact'].includes(scope))throw Error('Unknown simulator transfer');
 const validated=validateLabSettings(settings);
 if(scope==='terrain'){if(destination!=='obstacle track')throw Error('Terrain transfers require Obstacle track');transferableTerrain(validated)}
 if(scope==='contact'&&validated.case!=='collision')throw Error('Choose the Collision experiment first');
 return{schema:'dynora-lab-transfer-14.1',id:globalThis.crypto?.randomUUID?.()||String(now)+'-'+Math.random().toString(36).slice(2),created_ms:now,destination,scope,settings:validated};
}
export function validateTransfer(packet,environment,now=Date.now()){
 if(packet?.schema!=='dynora-lab-transfer-14.1'||typeof packet.id!=='string'||packet.id.length>120||!Number.isFinite(packet.created_ms)||now-packet.created_ms>300000||packet.created_ms>now+10000)throw Error('This transfer expired. Apply again from Test Lab.');
 if(packet.destination!==environment)return null;
 // Reuse the same validation without trusting a message from another tab.
 const checked=labTransfer(packet.settings,packet.destination,packet.scope,now);
 return{...checked,id:packet.id,created_ms:packet.created_ms};
}

// Event-driven, with no per-frame polling or solver work in normal rooms.
export function initSimulatorLabLink({environment,ready,PX,guard,applyRide,applyTerrain,applyContact,notify=()=>{},storage=globalThis.localStorage,eventTarget=globalThis.window,now=Date.now}){
 let disposed=false,queue=Promise.resolve();const seen=new Set();try{const receipt=storage.getItem('dynora-lab-receipt-14:'+environment);if(receipt)seen.add(receipt)}catch{}
 async function receive(packet){
  if(disposed||packet?.destination!==environment||seen.has(packet.id))return;
  let checked;
  try{
   checked=validateTransfer(packet,environment,now());if(!checked)return;
   await ready;if(disposed||seen.has(checked.id))return;guard();
   const s=checked.settings;let detail;
   if(checked.scope==='profile'){
    const surface=labSurface(s);if(PX.applyRoverProfile)PX.applyRoverProfile(s.robotProfile,{...s.robot,mu:surface.mu,crr:surface.crr});else PX.applyCalibration({...s.robot,mu:surface.mu,crr:surface.crr});PX.setSurface(s.surface);PX.setBrake?.(s.drive.brake);
    applyRide?.(s.ride);storage.setItem('dynora-terrain-ride-11',JSON.stringify(s.ride));
    detail='Robot calibration, selected surface and brake applied'+(applyRide?' with ride response.':'. Ride response saved for the obstacle track.');
   }else if(checked.scope==='terrain'){
    if(!applyTerrain)throw Error('Open the obstacle track to apply terrain');
    const data=transferableTerrain(s);await applyTerrain(s,data);detail='Isolated track rebuilt with this terrain. Rover is paused at the start.';
   }else{
    if(!applyContact)throw Error('Select a model in the simulator first');
    detail=await applyContact(s);
   }
   seen.add(checked.id);storage.setItem('dynora-lab-receipt-14:'+environment,checked.id);if(seen.size>50)seen.delete(seen.values().next().value);
   const ack={id:checked.id,destination:environment,status:'applied',scope:checked.scope,detail,at_ms:now()};storage.setItem(LAB_ACK_KEY,JSON.stringify(ack));notify(detail);return ack;
  }catch(error){const ack={id:packet?.id,destination:environment,status:'rejected',scope:packet?.scope,detail:error.message,at_ms:now()};storage.setItem(LAB_ACK_KEY,JSON.stringify(ack));return ack}
 }
 function enqueue(packet){queue=queue.then(()=>receive(packet));return queue}
 const listener=event=>{if(event.key===LAB_TRANSFER_KEY&&event.newValue){try{enqueue(JSON.parse(event.newValue))}catch{}}};
 eventTarget?.addEventListener('storage',listener);
 try{const saved=JSON.parse(storage.getItem(LAB_TRANSFER_KEY)||'null');if(saved?.destination===environment&&now()-saved.created_ms<=300000)enqueue(saved)}catch{}
 return{receive:enqueue,dispose(){disposed=true;eventTarget?.removeEventListener('storage',listener)}};
}
