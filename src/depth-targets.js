import * as T from 'three';
import {LiveDepthQuery} from './depth-core.js';
import {resolveDepthAnchor} from './depth-guides.js';

export const MAX_LIVE_TARGETS=5,LIVE_HISTORY_BATCHES=1000;
const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
export function depthSettings(input={}){
 const s={maxRange:50,targetLimit:64,...input};
 if(!Number.isFinite(s.maxRange)||s.maxRange<.1||s.maxRange>250)throw Error('Depth range must be 0.1–250 m');
 if(!Number.isInteger(s.targetLimit)||s.targetLimit<1||s.targetLimit>256)throw Error('Target limit must be an integer from 1 to 256');
 return s;
}
export class DepthTargets{
 constructor(settings={}){
  this.settings=depthSettings(settings);this.items=[];this.serial=0;this.refs=new Map();this.activeId=null;
  this.liveIds=new Set();this.liveState='pending';this.batchSerial=0;this.latestBatch=null;this.liveHistory=[];this.droppedBatches=0;
 }
 activate(id){this.activeId=id;for(const item of this.items)if(!this.liveIds.has(item.id))item.live=null}
 configure(settings){const next=depthSettings({...this.settings,...settings}),changed=next.maxRange!==this.settings.maxRange;this.settings=next;if(changed)this.invalidateLive('pending');return this.settings}
 add(reading,anchor,selection,scene){
  if(this.items.length>=this.settings.targetLimit)throw Error('Saved target limit reached. Increase the limit or remove a target.');
  const{samples,...summary}=reading;
  const item={id:++this.serial,label:reading.surface||reading.anchor?.surface||'Surface',reading:summary,anchor:structuredClone(anchor),selection:structuredClone(selection),live:null};
  if(reading.kind==='region')item.reading.samples_retained='anchor only; remeasure for a full region CSV';
  this.items.push(item);if(anchor)this.refs.set(item.id,scene.getObjectByProperty('uuid',anchor.mesh_id));return item;
 }
 update(id,reading,anchor,selection,scene){
  const item=this.items.find(v=>v.id===id);if(!item)return null;
  const{samples,...summary}=reading;item.reading=summary;
  if(reading.kind==='region')item.reading.samples_retained='anchor only; remeasure for a full region CSV';
  item.anchor=structuredClone(anchor);item.selection=structuredClone(selection);item.live=null;
  this.refs.set(id,scene.getObjectByProperty('uuid',anchor.mesh_id));this.invalidateLive('pending');return item;
 }
 isLive(id){return this.liveIds.has(id)}
 liveItems(){return this.items.filter(item=>this.liveIds.has(item.id))}
 liveFor(id){return this.liveIds.has(id)?this.items.find(v=>v.id===id)?.live||null:null}
 setLive(id,on){
  const item=this.items.find(v=>v.id===id);if(!item)throw Error('Choose a saved target first.');
  if(on&&!item.anchor)throw Error('This region has no surface anchor. Remeasure it first.');
  if(on&&!this.liveIds.has(id)&&this.liveIds.size>=MAX_LIVE_TARGETS)throw Error('Five live slots are in use. Stop tracking one target before adding another.');
  if(this.liveIds.has(id)===on)return;
  if(on)this.liveIds.add(id);else this.liveIds.delete(id);
  this.invalidateLive('pending');
 }
 invalidateLive(reason='paused'){for(const item of this.items)item.live=null;this.latestBatch=null;this.liveState=reason}
 sampleLive(scene,camera,query,simTime,sampledAt=new Date().toISOString()){
  const id=this.batchSerial+1;
  const pending=this.liveItems().map(item=>({item,value:{...resolveDepthAnchor(scene,camera,item.anchor,query),sim_time_s:simTime,sampled_at_iso:sampledAt,live_batch_id:id}}));
  if(!pending.length)return null;
  this.batchSerial=id;for(const{item,value}of pending)item.live=value;
  const batch={id,sim_time_s:simTime,sampled_at_iso:sampledAt,targets:pending.map(({item,value})=>({target_id:item.id,label:item.label,region_anchor:item.reading.kind==='region',...value}))};
  this.latestBatch=batch;this.liveState='running';this.liveHistory.push(batch);
  if(this.liveHistory.length>LIVE_HISTORY_BATCHES){this.liveHistory.shift();this.droppedBatches++}
  return batch;
 }
 remove(id){this.items=this.items.filter(v=>v.id!==id);this.refs.delete(id);if(this.liveIds.delete(id))this.invalidateLive('pending');if(this.activeId===id)this.activate(null)}
 clear(){this.items=[];this.refs.clear();this.activeId=null;this.liveIds.clear();this.invalidateLive('pending');this.liveHistory=[];this.droppedBatches=0}
 project(camera){
  const out=[];
  for(const item of this.items){
   const o=this.refs.get(item.id);if(!o?.parent||o.geometry.uuid!==item.anchor?.geometry_id)continue;
   let visible=true,attached=false;for(let n=o;n;n=n.parent){if(!n.visible)visible=false;if(n.isScene)attached=true}if(!visible||!attached)continue;
   const point=new T.Vector3(...item.anchor.local_point).applyMatrix4(o.matrixWorld),p=point.project(camera),u=(p.x+1)/2,v=(1-p.y)/2;
   const tracking=this.isLive(item.id),state=tracking?item.live:null;
   if(p.z>=-1&&p.z<=1&&u>=0&&u<=1&&v>=0&&v<=1)out.push({id:item.id,u,v,tracking,visibility:state?.visibility||this.liveState,range_m:tracking?(state?.visibility==='visible'?state.range_m:null):(item.reading.kind==='point'?item.reading:item.reading.anchor)?.range_m,label:item.label});
  }return out;
 }
 csv(){
  return ['target_id,surface,range_m,z_depth_m,sim_time_s,measurement_state,visibility,live_batch_id,sampled_at_iso',...this.items.map(item=>{
   const tracking=this.isLive(item.id),state=tracking?item.live:null,valid=state?.visibility==='visible';
   const r=tracking?(valid?state:{}):(item.reading.kind==='point'?item.reading:item.reading.anchor)||{};
   return [item.id,quote(item.label),r.range_m??'',r.z_depth_m??'',tracking?state?.sim_time_s??'':item.reading.sim_time_s,tracking?(valid?'live anchor':state?'invalid live anchor':'pending live anchor'):'snapshot',quote(tracking?state?.visibility||this.liveState:'snapshot'),state?.live_batch_id??'',quote(state?.sampled_at_iso||'')].join(',');
  })].join('\n');
 }
 liveCSV(){return ['live_batch_id,sampled_at_iso,sim_time_s,target_id,surface,region_anchor,range_m,z_depth_m,visibility,history_dropped_batches_at_export',...this.liveHistory.flatMap(batch=>batch.targets.map(r=>[batch.id,quote(batch.sampled_at_iso),batch.sim_time_s,r.target_id,quote(r.label),r.region_anchor,r.visibility==='visible'?r.range_m:'',r.visibility==='visible'?r.z_depth_m:'',quote(r.visibility),this.droppedBatches].join(',')))].join('\n')}
 metadata(){return{settings:this.settings,active_target_id:this.activeId,live_target_ids:[...this.liveIds],live_limit:MAX_LIVE_TARGETS,live_state:this.liveState,latest_live_batch:this.latestBatch,history:{retained_batches:this.liveHistory.length,max_batches:LIVE_HISTORY_BATCHES,dropped_batches:this.droppedBatches},targets:this.items}}
}
export function sampleLiveDepth(targets,scene,camera,{exclude=[],simTime=0,sampledAt,newQuery=(s,o)=>new LiveDepthQuery(s,o)}={}){
 if(!targets.liveIds.size)return null;
 let query;
 try{query=newQuery(scene,{exclude,maxRange:targets.settings.maxRange});return targets.sampleLive(scene,camera,query,simTime,sampledAt)}
 catch(error){targets.invalidateLive('error');throw error}
 finally{query?.dispose()}
}
