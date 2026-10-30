import * as T from 'three';
import {apartmentCPUFixture} from './apartment-cpu-fixture.mjs';
import {parseGeometry} from './human-gltf-tools.mjs';
import {prepareHumans} from '../src/realistic-human.js';
import {warmRaycasts,beginRaycastFrame} from '../src/raycast-acceleration.js';
import {DepthSnapshot} from '../src/depth-core.js';
import {patchGrid,PatchSelection,samplePatchBatch} from '../src/depth-patch-core.js';

const parsed={};for(const id of ['sam','maya'])parsed[id]=await parseGeometry(new URL('../public/visual/humans/'+id+'.glb',import.meta.url));
await prepareHumans({baseURL:'https://offline.test/',loader:{loadAsync:async url=>parsed[url.includes('maya')?'maya':'sam']}});
const f=await apartmentCPUFixture();await warmRaycasts(f.scene);const grid=patchGrid(1920,1080),results=[];
const camera=new T.PerspectiveCamera(70,16/9,.015,50);camera.position.set(-1.9,.5,-.5);camera.lookAt(-1.9,.5,-3);camera.updateMatrixWorld(true);
for(const count of [20,40,256]){
 const selection=new PatchSelection(grid);selection.setIds(count===256?grid.cells.map(c=>c.id):Array.from({length:count},(_,i)=>95+i));
 for(let iteration=0;iteration<3;iteration++){
  f.HP.animate({dt:1/60,distance:.01,speed:.6});f.scene.updateMatrixWorld(true);beginRaycastFrame();
  const start=performance.now(),query=new DepthSnapshot(f.scene,{exclude:[f.rover.robot],indexed:true}),built=performance.now();
  const batch=await samplePatchBatch(query,camera,grid,selection.snapshot(),{mode:'9',budgetMs:Infinity,simTime:iteration/60});
  results.push({selected:count,iteration,snapshot_ms:built-start,sampling_ms:performance.now()-built,ray_ms:batch.query_ms,rays:batch.attempted_samples,valid:batch.valid_samples,skin_bakes:query.owned.length});query.dispose();
 }
}
console.log(JSON.stringify({kind:'CPU-only apartment geometry benchmark',note:'Original room geometry and bundled posed humans. No GPU, DOM or frame-rate estimate. Browser measurements yield between chunks; these CPU totals intentionally do not.',results},null,2));
