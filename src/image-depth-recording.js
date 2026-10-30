import {patchCSV,patchSamplesCSV} from './depth-patch-core.js';
import {parseCSV} from './lab-core.js';
import {snapName} from './depth-snap-image.js';

const quote=value=>{const s=String(value??'');return /[",\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};
export const tableCSV=(columns,rows)=>'\ufeff'+[columns,...rows].map(row=>row.map(quote).join(',')).join('\n');
const stem=name=>name.replace(/^images\//,'').replace(/[^a-zA-Z0-9_.-]/g,'_');
const prefix=['image','image_name','capture_id','telemetry_frame_id','run_id','image_source_frame_index','image_capture_sim_s','rgb_pixel_aligned','snap_file','snap_selection_revision'];
function linkedCSV(entry,text){
 const parsed=text.includes('\n')?parseCSV(text):{columns:text.split(','),rows:[]},columns=parsed.columns.map(c=>c==='source_frame_index'?'patch_source_frame_index':c==='sim_time_s'?'patch_capture_sim_s':c),values=[entry.image,entry.image_name,entry.capture_id,entry.frame_id,entry.run_id,entry.source_frame_index,entry.capture_sim_s,entry.rgb_pixel_aligned?1:0,entry.snap_file,entry.snap_selection_revision];
 return tableCSV([...prefix,...columns],parsed.rows.map(row=>[...values,...row])).replace(/^\ufeff/,'');
}
const joinTables=tables=>tables.map((s,i)=>i?(s.includes('\n')?s.slice(s.indexOf('\n')+1):''):s).filter(Boolean).join('\n');

// One frozen geometry query per captured RGB. Completion time never becomes
// acquisition time. Backpressure prevents an unbounded queue of room snapshots.
// snap(reading,context) returns a Blob: the SNAP overlay of that image on white.
export class ImageDepthRecorder{
 constructor({prepare,snap=null,now=()=>performance.now(),maxBytes=128*1024*1024}={}){this.prepare=prepare;this.snap=snap;this.now=now;this.maxBytes=maxBytes;this.entries=[];this.names=new Set();this.pending=new Set();this.bytes=0;this.deferred=0;this.previous=new Map();}
 ready(){return this.pending.size===0&&this.bytes<this.maxBytes;}
 defer(){this.deferred++;}
 capture(context){
  if(!context?.image)return Promise.resolve(null);
  if(this.names.has(context.image))throw Error('Duplicate image-depth capture: '+context.image);
  if(!this.ready())throw Error('Image-depth capture queue is full');
  const copy=structuredClone(context),previous=this.previous.get(copy.run_id),entry={...copy,image_name:copy.image.split('/').at(-1),capture_id:copy.frame_id||copy.image,status:'pending',patch_file:'',snap_file:'',snap_status:this.snap?'pending':'disabled',snap_meta_file:'',snap_selection_revision:null,snap_source_frame_index:null,snap_capture_sim_s:null,snap_pixel_aligned:null,region_count:0,patch_count:0,valid_samples:0,requested_samples:0,sync_delta_s:null,patch_source_frame_index:null,patch_capture_sim_s:null,latency_ms:null,previous_capture_id:previous?.capture_id||'',image_dt_s:previous?copy.capture_sim_s-previous.capture_sim_s:null};
  this.names.add(entry.image);this.entries.push(entry);this.previous.set(entry.run_id,entry);this.bytes+=JSON.stringify(copy).length;
  const started=this.now();let prepared;
  try{prepared=this.prepare(copy);}catch(error){entry.status='error';entry.error=error.message;return Promise.resolve(entry);}
  if(!prepared?.sample){entry.status=prepared?.status||'no_region';entry.snap_status=entry.status;return Promise.resolve(entry);}
  let task;
  task=(async()=>{
   let reading;
   try{
    reading=await Promise.resolve().then(()=>prepared.sample());
    entry.patch_capture_sim_s=reading.sim_time_s;entry.patch_source_frame_index=reading.source_frame_index;entry.sync_delta_s=reading.sim_time_s-entry.capture_sim_s;
    if(Math.abs(entry.sync_delta_s)>1e-7||reading.source_frame_index!==entry.source_frame_index)throw Error('RGB and depth capture snapshots differ');
    entry.status=reading.patch_status||(reading.valid_samples?'complete':'no_samples');entry.region_count=reading.region_count??(reading.region?1:0);entry.region_rows=(reading.region_readings||[]).map(r=>[entry.image,entry.image_name,entry.capture_id,entry.frame_id,entry.source_frame_index,entry.capture_sim_s,r.region_id,r.region_label,r.region?.selection_revision??'',r.status,r.selection_outline.status,r.valid_samples,r.attempted_samples,r.summary?.range?.median_m??'',r.summary?.z_depth?.median_m??'']);entry.patch_count=reading.patches.length;entry.valid_samples=reading.valid_samples;entry.requested_samples=reading.attempted_samples;entry.patch_file='depth/frames/'+stem(entry.image)+'.json';entry.latency_ms=this.now()-started;
    if(this.snap)try{entry.snap_blob=await this.snap(reading,copy);entry.snap_file=snapName(entry.image);entry.snap_status=reading.snap_contours?.status||'complete';entry.snap_meta_file='snaps/metadata/'+stem(entry.image)+'.json';entry.snap_selection_revision=reading.selection_revision??null;entry.snap_geometry=reading.snap_options?.geometry||'surface';entry.snap_source_frame_index=reading.source_frame_index;entry.snap_capture_sim_s=reading.sim_time_s;entry.snap_pixel_aligned=reading.snap_pixel_aligned??entry.rgb_pixel_aligned;entry.snap_metadata=JSON.stringify({schema:'dynora-snap-frame-3',image:entry.image,snap_file:entry.snap_file,capture_id:entry.capture_id,frame_id:entry.frame_id,run_id:entry.run_id,width:entry.width,height:entry.height,source_frame_index:entry.source_frame_index,capture_sim_s:entry.capture_sim_s,selection_revision:entry.snap_selection_revision,geometry:entry.snap_geometry,status:entry.snap_status,pixel_aligned:entry.snap_pixel_aligned,options:reading.snap_options,region:reading.region,projected_region_polygon:reading.projected_region_polygon,selection_outline:reading.selection_outline,regions:reading.regions,selected_region_ids:reading.selected_region_ids??reading.regions?.map(r=>r.region_id),saved_region_count:reading.saved_region_count,selection_policy:reading.selection_policy,region_summaries:reading.region_readings?.map(r=>({region_id:r.region_id,region_label:r.region_label,status:r.status,outline_status:r.selection_outline.status,valid_samples:r.valid_samples,attempted_samples:r.attempted_samples})),camera:entry.camera,camera_world_matrix:reading.camera_world_matrix,projection_matrix:reading.projection_matrix,contour_precision:reading.snap_contours?.precision,segments:reading.snap_contours?.segments});this.bytes+=entry.snap_blob.size+entry.snap_metadata.length;}catch(error){entry.snap_error=error.message;entry.snap_status='error';}
    const payload={schema:'dynora-image-depth-frame-1',image:entry.image,image_name:entry.image_name,capture_id:entry.capture_id,frame_id:entry.frame_id,run_id:entry.run_id,source_frame_index:entry.source_frame_index,capture_sim_s:entry.capture_sim_s,rgb_pixel_aligned:entry.rgb_pixel_aligned,camera:entry.camera,tof:entry.tof,telemetry:{...entry.telemetry,image_source_frame_index:entry.source_frame_index,patch_source_frame_index:reading.source_frame_index,patch_capture_sim_s:reading.sim_time_s,patch_sync_delta_s:entry.sync_delta_s,patch_status:entry.status,patch_file:entry.patch_file,snap_file:entry.snap_file,rgb_pixel_aligned:entry.rgb_pixel_aligned?1:0},snap_file:entry.snap_file,snap_meta_file:entry.snap_meta_file,snap_status:entry.snap_status,snap_selection_revision:entry.snap_selection_revision,depth:reading};
    entry.payload=JSON.stringify(payload);entry.patch_csv=linkedCSV(entry,patchCSV(reading));entry.sample_csv=linkedCSV(entry,patchSamplesCSV(reading));
    this.bytes+=entry.payload.length+entry.patch_csv.length+entry.sample_csv.length;
    return{...entry,reading};
   }catch(error){entry.status='error';entry.error=error.message;entry.latency_ms=this.now()-started;return entry;}
   finally{prepared.dispose?.();this.pending.delete(task);}
  })();
  this.pending.add(task);return task;
 }
 async busy(){while(this.pending.size)await Promise.all([...this.pending]);}
 report(){const counts={};for(const e of this.entries)counts[e.status]=(counts[e.status]||0)+1;return{schema:'dynora-image-depth-sync-1',images:this.entries.length,status_counts:counts,pending:this.pending.size,deferred_capture_opportunities:this.deferred,retained_bytes_estimate:this.bytes,limit_bytes:this.maxBytes,capacity_reached:this.bytes>=this.maxBytes,snap_images:this.entries.filter(e=>e.snap_blob).length,snap_errors:this.entries.filter(e=>e.snap_error).length,max_abs_sync_delta_s:this.entries.reduce((v,e)=>Math.max(v,Math.abs(e.sync_delta_s||0)),0),rgb_geometry_mismatch:this.entries.filter(e=>e.rgb_pixel_aligned===false).length,policy:'Same frozen scene/camera state as RGB. Delayed measured ToF keeps its acquisition time and age; gt_tof is current simulated geometry. No previous depth is copied into a new image.'};}
 async files(){
  await this.busy();if(!this.entries.length)return[];
  const keys=[...new Set(this.entries.flatMap(e=>Object.keys(e.telemetry||{})))],extra=['image_name','capture_id','image_source_frame_index','patch_source_frame_index','patch_capture_sim_s','patch_sync_delta_s','patch_status','patch_file','snap_file','snap_meta_file','snap_status','snap_geometry','snap_selection_revision','snap_source_frame_index','snap_capture_sim_s','snap_pixel_aligned','region_count','patch_count','patch_valid_samples','patch_attempted_samples','patch_latency_ms','rgb_pixel_aligned','previous_capture_id','image_dt_s','requested_image_interval_s'];
  const columns=[...keys.filter(k=>!extra.includes(k)),...extra];
  const rows=this.entries.map(e=>{const values={...e.telemetry,image:e.image,image_name:e.image_name,capture_id:e.capture_id,image_source_frame_index:e.source_frame_index,patch_source_frame_index:e.patch_source_frame_index,patch_capture_sim_s:e.patch_capture_sim_s,patch_sync_delta_s:e.sync_delta_s,patch_status:e.status,patch_file:e.patch_file,snap_file:e.snap_file,snap_meta_file:e.snap_meta_file,snap_status:e.snap_status,snap_geometry:e.snap_geometry,snap_selection_revision:e.snap_selection_revision,snap_source_frame_index:e.snap_source_frame_index,snap_capture_sim_s:e.snap_capture_sim_s,snap_pixel_aligned:e.snap_pixel_aligned===null?'':e.snap_pixel_aligned?1:0,region_count:e.region_count,patch_count:e.patch_count,patch_valid_samples:e.valid_samples,patch_attempted_samples:e.requested_samples,patch_latency_ms:e.latency_ms,rgb_pixel_aligned:e.rgb_pixel_aligned?1:0,previous_capture_id:e.previous_capture_id,image_dt_s:e.image_dt_s,requested_image_interval_s:e.image_interval_s};return columns.map(k=>values[k]);});
  return[['image_frames.csv',tableCSV(columns,rows)],['depth/image-regions.csv',tableCSV(['image','image_name','capture_id','frame_id','source_frame_index','capture_sim_s','region_id','region_label','selection_revision','depth_status','outline_status','valid_samples','attempted_samples','range_median_m','z_depth_median_m'],this.entries.flatMap(e=>e.region_rows||[]))],['depth/image-patches.csv',joinTables(this.entries.filter(e=>e.patch_csv).map(e=>e.patch_csv))],['depth/image-samples.csv',joinTables(this.entries.filter(e=>e.sample_csv).map(e=>e.sample_csv))],['depth/sync-report.json',JSON.stringify(this.report(),null,2)],...this.entries.filter(e=>e.payload).map(e=>[e.patch_file,e.payload]),...this.entries.filter(e=>e.snap_blob).flatMap(e=>[[e.snap_file,e.snap_blob],[e.snap_meta_file,e.snap_metadata]])];
 }
 clear(){if(this.pending.size)throw Error('Wait for image-depth captures before clearing');this.entries=[];this.names.clear();this.previous.clear();this.bytes=0;this.deferred=0;}
}

export function validateImageDepthLinks(columns,rows,imageNames,imageAudit={}){
 const index=Object.fromEntries(columns.map((n,i)=>[n,i])),errors=[];
 if(!('patch_status'in index))return errors;
 const byImage=new Map(rows.filter(r=>r[index.image]).map(r=>[r[index.image],r]));
 for(const image of imageNames){const r=byImage.get(image),audit=imageAudit[image];if(!r){errors.push({code:'patch_image_link',message:'Missing telemetry row for '+image});continue;}
  if('frame_id'in index&&(!r[index.frame_id]||!r[index.run_id]))errors.push({code:'capture_identity',message:'Missing recording/frame identity: '+image});const status=r[index.patch_status];if(!status||status==='pending'||status==='error')errors.push({code:'patch_capture',message:image+': '+(status||'missing patch status')});
  if('snap_status'in index&&['pending','error'].includes(r[index.snap_status]))errors.push({code:'snap_capture',message:'Snap capture did not complete: '+image});
  if(r[index.snap_file]&&('snap_source_frame_index'in index)&&(String(r[index.snap_source_frame_index])!==String(r[index.image_source_frame_index])||Math.abs(Number(r[index.snap_capture_sim_s])-Number(r[index.image_capture_sim_s]))>1e-7))errors.push({code:'snap_sync',message:'RGB and snap source frame/time differ: '+image});
  if(['complete','no_samples'].includes(status)){
   const depthTime=Number(r[index.patch_capture_sim_s]),imageTime=Number(r[index.image_capture_sim_s]);
   if(!Number.isFinite(depthTime)||!Number.isFinite(imageTime)||Math.abs(depthTime-imageTime)>1e-7||r[index.patch_capture_sim_s]==='')errors.push({code:'patch_time_sync',message:'Depth/image acquisition times differ: '+image});
   if(String(r[index.image_source_frame_index])!==String(r[index.patch_source_frame_index])||audit&&String(audit.source_frame_index)!==String(r[index.patch_source_frame_index]))errors.push({code:'patch_frame_sync',message:'Depth/image source frames differ: '+image});
   if(!r[index.patch_file])errors.push({code:'patch_file',message:'Missing per-image patch file: '+image});
  }
 }
 return errors;
}
