import {validateImageDepthLinks} from './image-depth-recording.js';
import JSZip from 'jszip';
import {validateDataset,sha256,parseCSV,splitFor,VERSION,BUILD_ID} from './lab-core.js';
export function csvText(columns,rows){const quote=value=>{const s=String(value??'');return /[",\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};return '\ufeff'+[columns,...rows].map(row=>row.map(quote).join(',')).join('\n');}
// Dataset recordings contain measurements, not copies of the simulator project.
export const isOptionalRecordingFile=name=>['scene.json','scene_timeline.json','replays.json','annotations.jsonl','events.csv','events.jsonl','visual/scene.json','visual/collisions.json'].includes(name)||name.startsWith('cad/')||name.startsWith('visual/models/');
export async function datasetFiles({csv,metadata,annotations=[],events=[],eventCSV='',images=[],columns,rows,imageAudit={},extras=[],onProgress=()=>{}}){
 extras=extras.filter(([name])=>!isOptionalRecordingFile(name));annotations=[];events=[];
 if(!columns||!rows){const data=parseCSV(csv);columns=data.columns;rows=data.rows;}
 const files=new Map(),json=x=>JSON.stringify(x,null,2),idx=Object.fromEntries(columns.map((n,i)=>[n,i]));
 for(let i=0;i<images.length;i++){const[name,blob]=images[i];if(!/^images\/[a-zA-Z0-9_./-]+$/.test(name)||name.includes('..'))throw Error('Unsafe image filename');const bytes=blob instanceof Blob?new Uint8Array(await blob.arrayBuffer()):new Uint8Array(blob);files.set(name,bytes);if(!bytes.length)imageAudit[name]={...imageAudit[name],empty:true};onProgress(images.length?(i+1)/images.length*25:25);}
 const quality=validateDataset({columns,rows,imageNames:images.map(i=>i[0]),annotations,events,imageAudit,expectedStep:metadata.sample_rate_hz?1/metadata.sample_rate_hz:null});
 quality.errors.push(...validateImageDepthLinks(columns,rows,images.map(i=>i[0]),imageAudit));const extraNames=new Set(extras.map(e=>e[0]));for(const r of rows)if(r[idx.image]&&r[idx.patch_file]&&!extraNames.has(r[idx.patch_file]))quality.errors.push({code:'patch_file_missing',message:'Missing '+r[idx.patch_file]});for(const r of rows)if(r[idx.image])for(const field of ['snap_file','snap_meta_file'])if(r[idx[field]]&&!extraNames.has(r[idx[field]]))quality.errors.push({code:'snap_file_missing',message:'Missing '+r[idx[field]]});if('snap_pixel_aligned'in idx&&rows.some(r=>r[idx.snap_file]&&Number(r[idx.snap_pixel_aligned])===0))quality.warnings.push({code:'snap_temporal_alignment',message:'Some snap images accompany frozen or temporally blended RGB; inspect snap_pixel_aligned before training.'});if('rgb_pixel_aligned'in idx&&rows.some(r=>r[idx.image]&&Number(r[idx.rgb_pixel_aligned])===0&&['complete','no_samples'].includes(r[idx.patch_status])))quality.warnings.push({code:'rgb_geometry_mismatch',message:'Some RGB images have distortion, temporal blur or camera-freeze effects; geometric patch coordinates refer to the undistorted current camera. Use only rgb_pixel_aligned=1 for direct pixel supervision.'});quality.pass=quality.errors.length===0;quality.status=!quality.pass?'FAIL':quality.warnings.length?'PASS_WITH_WARNINGS':'PASS';
 const inputs=columns.filter(n=>/^tof_/.test(n)&&!n.includes('truth')||/^imu_|^odom_|^enc_/.test(n)||['run_id','frame_id','sim_time_s','image','image_capture_sim_s','sensor_acquisition_sim_s','sensor_delivery_sim_s','sensor_sequence','sensor_age_s'].includes(n));
 const truth=columns.filter(n=>n.startsWith('gt_')||['run_id','frame_id','sim_time_s','slip_left_ratio','slip_right_ratio','normal_force_N','tip_risk'].includes(n));
 const controls=columns.filter(n=>['run_id','frame_id','sim_time_s','pwm_left','pwm_right','duty_left_pct','duty_right_pct','mode'].includes(n));
 const select=names=>rows.map(r=>names.map(n=>r[idx[n]]));
 files.set('data.csv',csv);files.set('inputs.csv',csvText(inputs,select(inputs)));files.set('ground_truth.csv',csvText(truth,select(truth)));files.set('commands.csv',csvText(controls,select(controls)));
 const runs=metadata.research?.runs||[],lookup=new Map(runs.map(r=>[r.run_id,r])),splitRows={train:[],validation:[],test:[]};
 for(const r of rows){const run=lookup.get(r[idx.run_id]),group=run?.split_group||metadata.environment?.name||'unassigned',split=splitFor(group,metadata.research?.split_seed||'dynora');splitRows[split].push([r[idx.run_id]??'legacy',r[idx.frame_id]??'',r[idx.image]??'',group]);}
 for(const[split,r]of Object.entries(splitRows))files.set(`splits/${split}.csv`,csvText(['run_id','frame_id','image','split_group'],r));
 files.set('splits.json',json({grouping:metadata.research?.split_grouping||'environment',seed:metadata.research?.split_seed||'dynora',ratios:[.7,.15,.15],counts:Object.fromEntries(Object.entries(splitRows).map(([k,v])=>[k,v.length])),warning:'A small collection may have empty splits. Use additional independent environments; never move neighbouring frames between splits.'}));
 files.set('quality.json',json({...quality,image_audit:imageAudit}));
 const meta={...metadata,schema_version:3,software_version:VERSION,source_build_sha256:BUILD_ID,quality_status:quality.status,export_profile:{mode:'lean',scene_backups:false,model_backups:false,physics_replays:false,language_and_event_logs:false},column_roles:{legacy_ground_truth:['x_m','y_m','yaw_deg','v_mps','omega_dps','accel_mps2'],training_inputs:inputs,ground_truth:truth,commands:controls,language_annotations:'not recorded in lean datasets'},training_note:'inputs.csv excludes true pose, true velocity, true ToF and current motor commands. Choose inputs/targets for the actual learning task; automatic separation alone does not prevent every form of target leakage.'};
 files.set('metadata.json',json(meta));for(const[name,value]of extras){if(name.includes('..')||name.startsWith('/')||files.has(name))throw Error('Invalid or duplicate extra filename');files.set(name,value instanceof Blob?new Uint8Array(await value.arrayBuffer()):value);}
 const entries=[];for(const[name,value]of files){const bytes=typeof value==='string'?new TextEncoder().encode(value):value instanceof Uint8Array?value:new Uint8Array(value);entries.push({path:name,bytes:bytes.byteLength,sha256:await sha256(bytes)});}
 files.set('manifest.json',json({schema:'dynora-manifest-3',software_version:VERSION,quality_status:quality.status,files:entries,manifest_self_hash:'excluded',privacy:'Generated locally; no uploads required'}));return{files,quality};
}
export async function datasetZip(options){
 const zip=new JSZip(),bundle=options.files?{files:options.files}:await datasetFiles(options);for(const[name,value]of bundle.files)zip.file(name,value);
 return zip.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:3}},state=>options.onProgress?.(30+state.percent*.7));
}
export async function verifyDatasetZip(bytes){
 const zip=await JSZip.loadAsync(bytes,{checkCRC32:true});
 const manifest=JSON.parse(await zip.file('manifest.json')?.async('string')||'null');
 if(!Array.isArray(manifest?.files)||!manifest.files.length)throw Error('ZIP manifest is missing');
 let images=0;for(const entry of manifest.files){const file=zip.file(entry.path);if(!file)throw Error('ZIP is missing '+entry.path);const data=await file.async('uint8array');if(data.length!==entry.bytes||await sha256(data)!==entry.sha256)throw Error('ZIP verification failed for '+entry.path);if(entry.path.startsWith('images/'))images++}
 return {verified:true,files:manifest.files.length,images,crc32:true,sha256:true};
}
