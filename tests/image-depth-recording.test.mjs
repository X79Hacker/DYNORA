import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {ImageDepthRecorder,validateImageDepthLinks} from '../src/image-depth-recording.js';
import {patchGrid,samplePatchBatch} from '../src/depth-patch-core.js';
import {DepthSnapshot,cameraForViewport} from '../src/depth-core.js';
import {parseCSV} from '../src/lab-core.js';
import {drawDepthSnap,snapName,validColor,snapOptions,SNAP_DEFAULTS} from '../src/depth-snap-image.js';
const grid=patchGrid(640,480),selection=[{id:120,full:true,rects:[]}];
function fixture(){const scene=new T.Scene(),mesh=new T.Mesh(new T.PlaneGeometry(30,30),new T.MeshBasicMaterial());mesh.position.z=-3;scene.add(mesh);const camera=new T.PerspectiveCamera(70,4/3,.01,50);camera.updateMatrixWorld(true);return{scene,mesh,camera};}
const context=(n=1)=>({image:`images/run_img_${n}.png`,width:640,height:480,frame_id:`run_${n}`,run_id:'run',source_frame_index:n*10,capture_sim_s:n*.2,sampled_at_iso:'2026-10-27T00:00:00Z',image_interval_s:.2,rgb_pixel_aligned:true,camera:{fx:343,fy:343},tof:[{value:.7,acquired:n*.2-.03,delivered:n*.2-.01,status:'ok'}],telemetry:{image:`images/run_img_${n}.png`,run_id:'run',frame_id:`run_${n}`,sim_time_s:n*.2,image_capture_sim_s:n*.2,tof_front_m:.7,sensor_age_s:.03,pwm_left:90}});
const prepare=(f,mode='4')=>c=>{const q=new DepthSnapshot(f.scene,{indexed:true}),camera=cameraForViewport(f.camera,640,480);return{dispose:()=>q.dispose(),sample:async()=>({...await samplePatchBatch(q,camera,grid,selection,{mode,simTime:c.capture_sim_s,budgetMs:Infinity}),id:c.source_frame_index,source_frame_index:c.source_frame_index,camera_world_matrix:camera.matrixWorld.toArray(),projection_matrix:camera.projectionMatrix.toArray()})};};

test('2, 3, 4 and arbitrary 1–64 sample counts use exactly that many deterministic in-patch rays',async()=>{
 const f=fixture(),q=new DepthSnapshot(f.scene,{indexed:true});
 for(const count of [1,2,3,4,7,9,16,25,63,64]){const b=await samplePatchBatch(q,f.camera,grid,selection,{mode:String(count),budgetMs:Infinity});assert.equal(b.attempted_samples,count);assert.equal(b.valid_samples,count);assert.equal(new Set(b.samples.map(s=>s.u+','+s.v)).size,count);for(const s of b.samples){const cell=grid.cells[s.patch_id-1];assert.ok(s.u>=cell.bounds[0]&&s.u<cell.bounds[2]&&s.v>=cell.bounds[1]&&s.v<cell.bounds[3]);}}
 await assert.rejects(samplePatchBatch(q,f.camera,grid,selection,{mode:'65'}));q.dispose();
});

test('each image keeps its frozen camera/geometry even while the scene and camera move before completion',async()=>{
 const f=fixture(),rec=new ImageDepthRecorder({prepare:prepare(f)}),first=rec.capture(context(1));f.mesh.position.z=-8;f.camera.position.x=1;f.scene.updateMatrixWorld(true);f.camera.updateMatrixWorld(true);const a=await first;assert.equal(a.status,'complete');assert.ok(a.reading.samples.every(s=>Math.abs(s.z_depth_m-3)<1e-8));assert.equal(a.reading.camera_world_matrix[12],0);const b=await rec.capture(context(2));assert.ok(b.reading.samples.every(s=>Math.abs(s.z_depth_m-8)<1e-8));assert.equal(b.reading.camera_world_matrix[12],1);assert.equal(b.previous_capture_id,'run_1');assert.ok(Math.abs(b.image_dt_s-.2)<1e-10);
 const files=new Map(await rec.files()),index=parseCSV(files.get('image_frames.csv')),rows=index.rows.map(r=>Object.fromEntries(index.columns.map((k,i)=>[k,r[i]])));assert.deepEqual(rows.map(r=>r.image_name),['run_img_1.png','run_img_2.png']);assert.ok(rows.every(r=>r.patch_sync_delta_s==='0'&&r.image_source_frame_index===r.patch_source_frame_index));const payload=JSON.parse(files.get(rows[0].patch_file));assert.equal(payload.tof[0].acquired,.17);assert.equal(payload.telemetry.patch_status,'complete');assert.equal(payload.telemetry.pwm_left,90);
});

test('bounded recording applies backpressure and never reuses another image depth result',async()=>{
 const f=fixture();let finish;const gate=new Promise(r=>finish=r),base=prepare(f),rec=new ImageDepthRecorder({prepare:c=>{const p=base(c);return{...p,sample:async()=>{await gate;return p.sample();}};}});
 const task=rec.capture(context());assert.equal(rec.ready(),false);rec.defer();assert.throws(()=>rec.capture(context(2)),/queue is full/);finish();await task;await rec.busy();assert.equal(rec.ready(),true);assert.equal(rec.entries.length,1);assert.equal(rec.report().deferred_capture_opportunities,1);assert.throws(()=>rec.capture(context()),/Duplicate/);
});

test('timestamp/frame mismatches and thrown samplers are explicit failures and release their query',async()=>{
 const f=fixture();let disposed=0;for(const kind of ['time','frame','throw']){const base=prepare(f),rec=new ImageDepthRecorder({prepare:c=>{const p=base(c);return{dispose:()=>{disposed++;p.dispose();},sample:()=>{if(kind==='throw')throw Error('test failure');return p.sample().then(b=>({...b,...(kind==='time'?{sim_time_s:99}:{source_frame_index:999})}));}};}});const result=await rec.capture(context());assert.equal(result.status,'error');assert.equal(rec.pending.size,0);assert.equal(rec.entries[0].payload,undefined);}assert.equal(disposed,3);
});

test('no selected region is represented by an image index row without fabricated patch depths',async()=>{
 const rec=new ImageDepthRecorder({prepare:()=>({status:'no_region'})});await rec.capture(context());const files=new Map(await rec.files()),data=parseCSV(files.get('image_frames.csv'));assert.equal(data.rows[0][data.columns.indexOf('patch_status')],'no_region');assert.equal(data.rows[0][data.columns.indexOf('patch_file')],'');assert.equal(rec.report().images,1);
 const f=fixture();f.scene.remove(f.mesh);const empty=new ImageDepthRecorder({prepare:prepare(f)});await empty.capture(context(1));await empty.capture(context(2));const csv=new Map(await empty.files()).get('depth/image-samples.csv');assert.equal(csv.split('\n').length,1,'zero-hit images must not add repeated headers as fake sample rows');assert.equal(empty.report().status_counts.no_samples,2);
});

test('recording memory capacity stops acquisition without dropping previously retained files',async()=>{
 const f=fixture(),rec=new ImageDepthRecorder({prepare:prepare(f),maxBytes:1});await rec.capture(context());assert.equal(rec.ready(),false);assert.equal(rec.report().capacity_reached,true);assert.ok((await rec.files()).some(([n])=>n.startsWith('depth/frames/')));rec.clear();assert.equal(rec.ready(),true);assert.equal(rec.entries.length,0);
});

test('export validation checks filename, timestamps, display frame IDs and completion status',()=>{
 const columns=['image','image_capture_sim_s','image_source_frame_index','patch_status','patch_capture_sim_s','patch_source_frame_index','patch_file'],good=['images/a.png',.2,10,'complete',.2,10,'depth/frames/a.json'];assert.deepEqual(validateImageDepthLinks(columns,[good],['images/a.png'],{'images/a.png':{source_frame_index:10}}),[]);
 for(const [index,value,code]of [[3,'pending','patch_capture'],[4,.4,'patch_time_sync'],[5,11,'patch_frame_sync'],[6,'','patch_file']]){const bad=[...good];bad[index]=value;assert.ok(validateImageDepthLinks(columns,[bad],['images/a.png']).some(e=>e.code===code));}
 assert.ok(validateImageDepthLinks(columns,[],['images/a.png']).some(e=>e.code==='patch_image_link'));
});

test('snapshot alpha visibility freezes opacity and texture transforms at RGB acquisition',()=>{
 const f=fixture(),texture=new T.DataTexture(new Uint8Array([255,255,255,255,255,255,255,0]),2,1,T.RGBAFormat);texture.magFilter=T.NearestFilter;texture.wrapS=T.RepeatWrapping;f.mesh.material=new T.MeshBasicMaterial({map:texture,alphaTest:.5});const q=new DepthSnapshot(f.scene,{indexed:true});texture.offset.x=.5;texture.updateMatrix();f.mesh.material.opacity=0;assert.ok(q.point(f.camera,.49,.5));q.dispose();const next=new DepthSnapshot(f.scene,{indexed:true});assert.equal(next.point(f.camera,.49,.5),null);next.dispose();
});


test('deforming mesh buffers are frozen while a later snapshot sees the new surface',()=>{
 const f=fixture();f.mesh.userData.depthDeforming=true;const q=new DepthSnapshot(f.scene,{indexed:true}),p=f.mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,-2);p.needsUpdate=true;assert.ok(Math.abs(q.point(f.camera,.5,.5).z_depth_m-3)<1e-8);q.dispose();const next=new DepthSnapshot(f.scene,{indexed:true});assert.ok(Math.abs(next.point(f.camera,.5,.5).z_depth_m-5)<1e-8);next.dispose();
});

test('image-linked CSV preserves commas, quotes and line breaks in imported part labels',async()=>{
 const f=fixture();f.mesh.userData.label='chair "leg", left\npart';const rec=new ImageDepthRecorder({prepare:prepare(f)});await rec.capture(context());const files=new Map(await rec.files()),table=parseCSV(files.get('depth/image-patches.csv'));assert.equal(table.rows.length,1);assert.equal(table.rows[0][table.columns.indexOf('surface')],f.mesh.userData.label);assert.equal(table.rows[0][table.columns.indexOf('image')],context().image);
});

test('each measured image gets its own SNAP image file next to the RGB image',async()=>{
 const f=fixture(),seen=[],rec=new ImageDepthRecorder({prepare:prepare(f),snap:async(reading,c)=>{seen.push([reading.sim_time_s,c.image]);return new Blob([c.image]);}});
 await rec.capture(context(1));await rec.capture(context(2));const files=new Map(await rec.files()),index=parseCSV(files.get('image_frames.csv')),col=index.columns.indexOf('snap_file');
 assert.deepEqual(index.rows.map(r=>r[col]),['snaps/run_img_1.png','snaps/run_img_2.png']);assert.deepEqual(seen,[[.2,'images/run_img_1.png'],[.4,'images/run_img_2.png']]);
 assert.equal(await files.get('snaps/run_img_2.png').text(),'images/run_img_2.png');assert.equal(JSON.parse(files.get(index.rows[0][index.columns.indexOf('patch_file')])).snap_file,'snaps/run_img_1.png');assert.equal(rec.report().snap_images,2);
 const failing=new ImageDepthRecorder({prepare:prepare(f),snap:()=>{throw Error('no canvas');}});const entry=await failing.capture(context());assert.equal(entry.status,'complete');assert.equal(entry.snap_file,'');assert.equal(failing.report().snap_errors,1);
 const none=new ImageDepthRecorder({prepare:()=>({status:'no_region'}),snap:()=>assert.fail('no region has no snap')});await none.capture(context());assert.ok(![...(await none.files())].some(([n])=>n.startsWith('snaps/')));
});

test('SNAP image: plain background, optional grid and dashed region outline, chosen colours, no text',()=>{
 const calls=[],ctx=new Proxy({},{get:(t,k)=>k in t?t[k]:(...a)=>calls.push([k,...a]),set:(t,k,v)=>{t[k]=v;calls.push(['set:'+k,v]);return true;}});
 const reading={sim_time_s:1.2,projected_region_polygon:[[.25,.25],[.75,.25],[.75,.75],[.25,.75]],summary:{count:4,range:{median_m:1.5},z_depth:{median_m:1.4}},patches:[{patch_id:120,pixel_bounds:[0,0,40,30]},{patch_id:121,pixel_bounds:[40,0,80,30]}]};
 drawDepthSnap(ctx,reading,{width:640,height:480});assert.deepEqual(calls.slice(0,2),[['set:fillStyle','#ffffff'],['fillRect',0,0,640,480]],'white by default');
 assert.equal(calls.filter(c=>c[0]==='strokeRect').length,0,'grid is an optional guide, off by default');assert.deepEqual(calls.filter(c=>c[0]==='moveTo'||c[0]==='lineTo').map(c=>c.slice(1)),[[160,120],[480,120],[480,360],[160,360],[160,120]],'the measured outline of this frame');
 assert.deepEqual(calls.filter(c=>c[0]==='setLineDash')[0],['setLineDash',[6,4]]);
 calls.length=0;drawDepthSnap(ctx,reading,{width:640,height:480,background:'#000000',grid:'#ff0000',outline:'#00ff00',showGrid:true});
 assert.equal(calls.find(c=>c[0]==='set:fillStyle')[1],'#000000');assert.deepEqual(calls.filter(c=>c[0]==='set:strokeStyle').map(c=>c[1]),['#ff0000','#00ff00']);
 for(const k of ['fillText','drawImage'])assert.ok(!calls.some(c=>c[0]===k),'no '+k);
 calls.length=0;drawDepthSnap(ctx,reading,{width:640,height:480,showGrid:false});assert.ok(!calls.some(c=>c[0]==='strokeRect'));assert.ok(calls.some(c=>c[0]==='moveTo'));
 calls.length=0;drawDepthSnap(ctx,reading,{width:640,height:480,showOutline:false,showGrid:true});assert.ok(!calls.some(c=>c[0]==='moveTo'));assert.equal(calls.filter(c=>c[0]==='strokeRect').length,2);
 assert.throws(()=>snapOptions({grid:'red'}));assert.throws(()=>snapOptions({showGrid:'yes'}));assert.deepEqual(snapOptions(),SNAP_DEFAULTS);
 assert.equal(snapName('images/run 1_img.jpg'),'snaps/run_1_img.png');assert.ok(validColor('#A0b1c2')&&!validColor('#fff'));
});
