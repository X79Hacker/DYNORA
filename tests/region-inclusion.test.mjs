import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {DepthRegions} from '../src/depth-regions.js';
import {DepthSnapshot} from '../src/depth-core.js';
import {patchGrid} from '../src/depth-patch-core.js';
import {prepareRegions,sampleRegions} from '../src/depth-region-capture.js';

test('inclusion is independent of edit focus and survives refine/replace',()=>{
 const r=new DepthRegions(),a=r.commit({selection_key:'a'}),b=r.commit({selection_key:'b'});
 assert.deepEqual(r.included.map(x=>x.region_id),[a.region_id,b.region_id]);
 r.setIncluded(a.region_id,false);r.select(a.region_id);
 assert.equal(r.activeId,a.region_id);assert.deepEqual(r.included.map(x=>x.region_id),[b.region_id]);
 assert.equal(r.commit({...a,label:'refined'}).included,false);
 assert.equal(r.commit({selection_key:'replacement'},{replace:true}).included,false);
 assert.equal(r.items.length,2);assert.throws(()=>r.setIncluded(b.region_id,'false'));
});
test('acquired region snapshots keep the checked set while later selections change',()=>{
 const r=new DepthRegions(),a=r.commit({selection_key:'a'}),b=r.commit({selection_key:'b'});
 const before=r.snapshotIncluded();r.setIncluded(a.region_id,false);
 assert.deepEqual(before.map(x=>x.region_id),[1,2]);assert.ok(before.every(x=>x.included));
 const next=r.snapshotIncluded();r.setIncluded(b.region_id,false);
 assert.deepEqual(next.map(x=>x.region_id),[2]);assert.equal(r.snapshotIncluded().length,0);
 assert.equal(r.snapshot().length,2);
});
test('sampling boundary excludes unchecked paths and depth queries, including all off',async()=>{
 const scene=new T.Scene(),mesh=new T.Mesh(new T.PlaneGeometry(8,8),new T.MeshBasicMaterial());mesh.position.z=-3;scene.add(mesh);
 const camera=new T.PerspectiveCamera(60,4/3,.01,20);camera.updateMatrixWorld(true);
 const grid=patchGrid(640,480),q=new DepthSnapshot(scene,{indexed:true});
 const defs=[{kind:'region',region_id:1,included:false,polygon:[[.1,.3],[.3,.3],[.3,.6],[.1,.6]]},{kind:'region',region_id:2,included:true,polygon:[[.6,.3],[.8,.3],[.8,.6],[.6,.6]]}];
 try{
  const prepared=prepareRegions(q,camera,defs,grid);assert.deepEqual(prepared.map(p=>p.region.region_id),[2]);
  const batch=await sampleRegions(q,camera,grid,prepared,{mode:'2',simTime:1.2,sourceFrame:7});
  assert.ok(batch.valid_samples>0);assert.ok(batch.samples.every(s=>s.region_id===2));assert.ok(batch.patches.every(s=>s.region_id===2));
  assert.equal(batch.region_count,1);assert.equal(batch.region_readings[0].source_frame_index,7);
  defs[1].included=false;const empty=await sampleRegions(q,camera,grid,prepareRegions(q,camera,defs,grid),{mode:'2'});
  assert.equal(empty.attempted_samples,0);assert.equal(empty.selection_outline.paths.length,0);assert.equal(empty.region_count,0);
 }finally{q.dispose();}
});

