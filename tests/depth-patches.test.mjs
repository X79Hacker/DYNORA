import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {patchGrid,patchAt,PatchSelection,parsePatchIds,patchPositions,patchCalibration,patchReference,samplePatchBatch,patchCSV,patchSamplesCSV} from '../src/depth-patch-core.js';
import {DepthSnapshot} from '../src/depth-core.js';
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const camera=()=>{const c=new T.PerspectiveCamera(70,1,.01,60);c.updateMatrixWorld(true);return c};
function plane(scene,z=-3){const m=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshBasicMaterial());m.position.z=z;m.userData.label='Reference plane';scene.add(m);return m}
const options={budgetMs:Infinity};

test('256 aligned patches cover square, HD, 4K, portrait and odd-sized images without crop or padding',()=>{
 for(const [w,h]of [[896,896],[1920,1080],[3840,2160],[1080,1920],[1001,777],[721,251],[49,913]]){
  const g=patchGrid(w,h);assert.equal(g.cells.length,256);near(g.cells.reduce((n,c)=>n+(c.bounds[2]-c.bounds[0])*(c.bounds[3]-c.bounds[1]),0),1);
  assert.deepEqual(g.cells.map(c=>c.id),Array.from({length:256},(_,i)=>i+1));
  for(let row=0;row<g.rows.length;row++){
   const ids=g.rows[row].ids;assert.equal(g.cells[ids[0]-1].bounds[0],0);assert.equal(g.cells[ids.at(-1)-1].bounds[2],1);
   for(let i=1;i<ids.length;i++)near(g.cells[ids[i-1]-1].bounds[2],g.cells[ids[i]-1].bounds[0]);
  }
  for(let i=0;i<200;i++){const u=((i*37)%199)/199,v=((i*73)%197)/197,c=patchAt(g,u,v);assert.ok(c);assert.ok(u>=c.bounds[0]-1e-12&&u<=c.bounds[2]+1e-12&&v>=c.bounds[1]-1e-12&&v<=c.bounds[3]+1e-12)}
 }
 const square=patchGrid(896,896);assert.equal(square.rows.length,16);assert.ok(square.cells.every(c=>c.width_px===56&&c.height_px===56));
 const hd=patchGrid(1920,1080);assert.equal(hd.rows.length,16);assert.ok(hd.rows.every(r=>r.columns===16));assert.ok(hd.cells.every(c=>c.width_px===120&&[67,68].includes(c.height_px)));
 assert.equal(patchAt(hd,1,1).id,256);assert.equal(patchAt(hd,-.1,.5),null);assert.throws(()=>patchGrid(0,1080));
});
test('ID parsing supports sparse and ranged selections and rejects invalid input without changing the selection',()=>{
 assert.deepEqual(parsePatchIds('1, 4, 20-23, 4'),[1,4,20,21,22,23]);assert.deepEqual(parsePatchIds(''),[]);
 for(const value of ['0','257','9-3','1.5','-2','2-no','1-999999'])assert.throws(()=>parsePatchIds(value));
 const s=new PatchSelection(patchGrid(896,896));s.setIds([1,20,40]);assert.throws(()=>s.setIds([300]));assert.deepEqual(s.snapshot().map(s=>s.id),[1,20,40]);
});
test('rectangle selection clips partial patches and all sample positions stay inside the assigned part',()=>{
 const g=patchGrid(896,896),s=new PatchSelection(g),rect=[.141,.153,.363,.421];s.selectRectangle(rect);
 assert.ok(s.items.size>1);for(const picked of s.snapshot())for(const p of patchPositions(g.cells[picked.id-1],picked,'25'))assert.ok(p.u>=rect[0]&&p.u<=rect[2]&&p.v>=rect[1]&&p.v<=rect[3]);
 s.selectRectangle([0,0,1,1],'remove');assert.equal(s.items.size,0);s.selectRectangle([0,0,.2,.2]);s.selectRectangle([.8,.8,1,1],'replace');assert.ok(s.snapshot().every(p=>g.cells[p.id-1].bounds[0]>=.75));
});
test('resizing preserves the chosen normalized image area and does not silently select the full image',()=>{
 const g=patchGrid(896,896),s=new PatchSelection(g);s.selectRectangle([.2,.3,.4,.6]);s.reflow(patchGrid(1920,1080));
 assert.ok(s.items.size>0&&s.items.size<60);for(const picked of s.snapshot())for(const p of patchPositions(s.grid.cells[picked.id-1],picked,'25'))assert.ok(p.u>=.2&&p.u<=.4&&p.v>=.3&&p.v<=.6);
});
test('reference dimensions reproduce 3.4 cm square patches and never alter measured metric depth',async()=>{
 const g=patchGrid(896,896),s=new PatchSelection(g);s.setIds([100]);const cal=patchCalibration({enabled:true});near(patchReference(g.cells[99],cal).reference_width_cm,3.4);near(patchReference(g.cells[99],cal).reference_height_cm,3.4);
 assert.deepEqual(patchReference(g.cells[0],patchCalibration()),{});assert.throws(()=>patchCalibration({width_cm:0}));
 const scene=new T.Scene();plane(scene);const q=new DepthSnapshot(scene,{indexed:true}),a=await samplePatchBatch(q,camera(),g,s.snapshot(),{...options,calibration:cal}),b=await samplePatchBatch(q,camera(),g,s.snapshot(),{...options,calibration:patchCalibration({enabled:true,width_cm:2000,height_cm:3000})});
 near(a.patches[0].z_depth.median_m,3);assert.deepEqual(a.patches[0].z_depth,b.patches[0].z_depth);q.dispose();
});
test('only selected patches run depth rays, and an empty selection performs zero queries',async()=>{
 const grid=patchGrid(1920,1080),s=new PatchSelection(grid);let calls=0;const query={point(){calls++;return null}};
 let r=await samplePatchBatch(query,camera(),grid,s.snapshot(),options);assert.equal(calls,0);assert.equal(r.attempted_samples,0);
 s.setIds([1,40,256]);r=await samplePatchBatch(query,camera(),grid,s.snapshot(),{...options,mode:'25'});assert.equal(calls,75);assert.deepEqual(r.selected_patch_ids,[1,40,256]);assert.ok(r.patches.every(p=>p.status==='no_hit'&&p.range===null));
});
test('all 256 patches have the same frozen acquisition time and a bounded 6400-point budget',async()=>{
 const scene=new T.Scene();plane(scene);const q=new DepthSnapshot(scene,{indexed:true}),g=patchGrid(3840,2160),s=new PatchSelection(g);s.setIds(g.cells.map(c=>c.id));
 const r=await samplePatchBatch(q,camera(),g,s.snapshot(),{...options,mode:'25',simTime:12.25});assert.equal(r.patches.length,256);assert.equal(r.attempted_samples,6400);assert.equal(r.samples.length,6400);assert.equal(r.sim_time_s,12.25);for(const p of r.patches)near(p.z_depth.median_m,3);q.dispose();
});
test('different visible parts within one patch are kept separate and never averaged together',async()=>{
 const grid=patchGrid(896,896),cell=grid.cells[0],selection=[{id:1,full:true,rects:[]}];
 const query={point(_c,u,v){const front=u<(cell.bounds[0]+cell.bounds[2])/2;return{u,v,mesh_id:front?'leg':'wall',surface:front?'Leg':'Wall',range_m:front?1:4,z_depth_m:front?1:4,world_xyz_m:[0,0,front?-1:-4]}}};
 const r=await samplePatchBatch(query,camera(),grid,selection,{...options,mode:'25'}),p=r.patches[0];assert.equal(p.status,'mixed');assert.equal(p.range,null);assert.equal(p.surfaces.length,2);assert.deepEqual(p.surfaces.map(s=>s.z_depth.median_m).sort(),[1,4]);
 const lines=patchCSV(r).split('\n').map(l=>l.split(',')),names=lines[0];for(const line of lines.slice(1)){near(Number(line[names.indexOf('surface_sample_support')]),Number(line[names.indexOf('valid_samples')])/25);near(Number(line[names.indexOf('patch_sample_support')]),1);}
 const target=await samplePatchBatch(query,camera(),grid,selection,{...options,mode:'25',targetMeshId:'leg'});assert.equal(target.patches[0].status,'valid');near(target.patches[0].z_depth.median_m,1);assert.ok(target.patches[0].excluded_surface_samples>0);
});
test('picked target remains occluded behind a foreground surface, never measured through it',async()=>{
 const scene=new T.Scene(),back=plane(scene,-4),front=plane(scene,-2),g=patchGrid(896,896),s=new PatchSelection(g);s.setIds([120]);
 const q=new DepthSnapshot(scene,{indexed:true}),r=await samplePatchBatch(q,camera(),g,s.snapshot(),{...options,targetMeshId:back.uuid});assert.equal(r.valid_samples,0);assert.equal(r.patches[0].status,'no_target_samples');assert.equal(r.patches[0].range,null);assert.equal(r.patches[0].excluded_surface_samples,9);q.dispose();front.visible=false;
 const fresh=new DepthSnapshot(scene,{indexed:true}),visible=await samplePatchBatch(fresh,camera(),g,s.snapshot(),{...options,targetMeshId:back.uuid});near(visible.patches[0].z_depth.median_m,4);fresh.dispose();
});
test('curved surfaces produce per-patch depth variation and radial distance differs from Z',async()=>{
 const scene=new T.Scene(),sphere=new T.Mesh(new T.SphereGeometry(1,40,24),new T.MeshBasicMaterial());sphere.position.z=-3;scene.add(sphere);const g=patchGrid(896,896),s=new PatchSelection(g);s.setIds([119,120,121,122,135,136,137,138]);
 const q=new DepthSnapshot(scene,{indexed:true}),r=await samplePatchBatch(q,camera(),g,s.snapshot(),{...options,mode:'25'}),valid=r.patches.filter(p=>p.z_depth);assert.ok(valid.length>3);assert.ok(Math.max(...valid.map(p=>p.z_depth.median_m))-Math.min(...valid.map(p=>p.z_depth.median_m))>.01);assert.ok(valid.some(p=>p.range.median_m>p.z_depth.median_m+.001));q.dispose();
});
test('adaptive sampling refines missing and mixed surfaces, while smooth surfaces keep the base nine points',async()=>{
 const g=patchGrid(896,896),s=new PatchSelection(g);s.setIds([1]);const hit=(u,v,z=3)=>({u,v,mesh_id:'surface',surface:'Surface',range_m:z,z_depth_m:z,world_xyz_m:[0,0,-z]});
 const smooth=await samplePatchBatch({point:(_c,u,v)=>hit(u,v)},camera(),g,s.snapshot(),{...options,mode:'adaptive'});assert.equal(smooth.attempted_samples,9);
 const empty=await samplePatchBatch({point:()=>null},camera(),g,s.snapshot(),{...options,mode:'adaptive'});assert.equal(empty.attempted_samples,25);
 const varied=await samplePatchBatch({point:(_c,u,v)=>hit(u,v,2+10*u)},camera(),g,s.snapshot(),{...options,mode:'adaptive'});assert.equal(varied.attempted_samples,25);
});
test('sampling yields within its budget, supports cancellation and freezes moved surface transforms',async()=>{
 const g=patchGrid(896,896),s=new PatchSelection(g);s.setIds([120,121]);let time=0,cancel=false,yields=0;const scene=new T.Scene(),m=plane(scene),q=new DepthSnapshot(scene,{indexed:true});
 const reading=await samplePatchBatch(q,camera(),g,s.snapshot(),{mode:'9',budgetMs:2,now:()=>++time,yieldFrame:async()=>{yields++;m.position.z=-10;scene.updateMatrixWorld(true)}});assert.ok(yields>0);assert.ok(reading.patches.every(p=>Math.abs(p.z_depth.median_m-3)<1e-7));q.dispose();
 await assert.rejects(samplePatchBatch({point:()=>null},camera(),g,s.snapshot(),{budgetMs:1,now:()=>++time,cancelled:()=>cancel,yieldFrame:async()=>{cancel=true}}),e=>e.name==='AbortError');
});
test('indexed snapshots match ordinary triangle results for moved, scaled and edited surfaces',()=>{
 const scene=new T.Scene();for(let i=0;i<80;i++){const m=new T.Mesh(new T.BoxGeometry(.3,.5,.4),new T.MeshBasicMaterial());m.position.set((i%10-5)*.6,(i%3-1)*.3,-2-Math.floor(i/10)*.7);m.rotation.y=i*.17;scene.add(m)}plane(scene,-12);
 const c=camera(),a=new DepthSnapshot(scene),b=new DepthSnapshot(scene,{indexed:true});for(let i=0;i<80;i++){const u=((i*13)%79)/79,v=((i*17)%73)/73,x=a.point(c,u,v),y=b.point(c,u,v);assert.equal(x?.mesh_id,y?.mesh_id);if(x)near(x.z_depth_m,y.z_depth_m)}a.dispose();b.dispose();
 const wall=scene.children.at(-1),p=wall.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,-2);p.needsUpdate=true;const fresh=new DepthSnapshot(scene,{indexed:true});near(fresh.point(c,.01,.01).z_depth_m,14);fresh.dispose();
});
test('indexed frozen skins use posed vertices without full skin baking or following later bone motion',()=>{
 const scene=new T.Scene(),geo=new T.PlaneGeometry(.6,.6,30,30),n=geo.attributes.position.count,w=new Float32Array(n*4);for(let i=0;i<n;i++)w[i*4]=1;geo.setAttribute('skinIndex',new T.Uint16BufferAttribute(new Uint16Array(n*4),4));geo.setAttribute('skinWeight',new T.Float32BufferAttribute(w,4));
 const m=new T.SkinnedMesh(geo,new T.MeshBasicMaterial()),bone=new T.Bone();m.add(bone);m.bind(new T.Skeleton([bone]));m.position.z=-3;scene.add(m);bone.position.y=.8;scene.updateMatrixWorld(true);const c=camera(),p=new T.Vector3(0,.8,-3).project(c),u=(p.x+1)/2,v=(1-p.y)/2;
 const snap=new DepthSnapshot(scene,{indexed:true});near(snap.point(c,u,v).z_depth_m,3);assert.equal(snap.owned.length,0);bone.position.y=-.8;scene.updateMatrixWorld(true);near(snap.point(c,u,v).z_depth_m,3);assert.equal(snap.owned.length,0);snap.dispose();
 const next=new DepthSnapshot(scene,{indexed:true});assert.equal(next.point(c,u,v),null);next.dispose();
});
test('patch exports retain separate surfaces, selected IDs, units, timestamps and sample coordinates',async()=>{
 const scene=new T.Scene();plane(scene);const g=patchGrid(896,896),s=new PatchSelection(g);s.setIds([1,20]);const q=new DepthSnapshot(scene,{indexed:true}),r=await samplePatchBatch(q,camera(),g,s.snapshot(),{...options,simTime:7});r.id=3;r.sampled_at_iso='2026-10-27T00:00:00Z';const csv=patchCSV(r),raw=patchSamplesCSV(r);
 assert.equal(csv.split('\n').length,3);assert.ok(csv.includes('range_median_m,z_median_m'));assert.ok(csv.includes('2026-10-27T00:00:00Z'));assert.equal(raw.split('\n').length,19);assert.ok(r.statistics_are_estimates);q.dispose();
});

test('pooled indexed snapshots preserve concurrent measurements and refresh transforms on reuse',()=>{
 const scene=new T.Scene(),m=plane(scene),c=camera(),first=new DepthSnapshot(scene,{indexed:true});near(first.point(c,.5,.5).z_depth_m,3);
 m.position.z=-5;scene.updateMatrixWorld(true);const second=new DepthSnapshot(scene,{indexed:true});near(second.point(c,.5,.5).z_depth_m,5);near(first.point(c,.5,.5).z_depth_m,3);
 const proxy=first.meshes[0];first.dispose();second.dispose();m.position.z=-7;scene.updateMatrixWorld(true);const third=new DepthSnapshot(scene,{indexed:true});assert.equal(third.meshes[0],proxy);near(third.point(c,.5,.5).z_depth_m,7);third.dispose();
});
