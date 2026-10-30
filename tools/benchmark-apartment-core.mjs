import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import * as T from 'three';
import {parseGeometry} from './human-gltf-tools.mjs';
import {prepareHumans} from '../src/realistic-human.js';
import {apartmentCPUFixture} from './apartment-cpu-fixture.mjs';
import {SensorRayIndex} from '../src/sensor-ray-index.js';
import {RigidRenderBatches} from '../src/rigid-render-batches.js';
import {beginRaycastFrame,enableAnimatedCulling,warmRaycasts} from '../src/raycast-acceleration.js';

const parsed={};for(const id of ['sam','maya'])parsed[id]=await parseGeometry(new URL('../public/visual/humans/'+id+'.glb',import.meta.url));
await prepareHumans({baseURL:'https://offline.test/',loader:{loadAsync:async url=>parsed[url.includes('maya')?'maya':'sam']}});
const f=await apartmentCPUFixture();await warmRaycasts(f.scene);
const cameras={orbit:new T.PerspectiveCamera(50,16/9,.1,100),corridor_bot:new T.PerspectiveCamera(70,16/9,.015,50)};
cameras.orbit.position.set(14.7,14.9,15.7);cameras.orbit.lookAt(0,0,4);
cameras.corridor_bot.position.set(2,.173,6.5);cameras.corridor_bot.lookAt(2,.173,9);
for(const camera of Object.values(cameras))camera.updateMatrixWorld(true);
const count=camera=>{
 const frustum=camera?new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse)):null;
 let draws=0,triangles=0,skinDraws=0;
 f.scene.traverseVisible(o=>{if(o.isMesh&&(o.layers.mask&1)&&(!frustum||!o.frustumCulled||frustum.intersectsObject(o))){draws++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);if(o.isSkinnedMesh)skinDraws++}});
 return{mesh_submissions:draws,triangles:Math.round(triangles),skinned_mesh_submissions:skinDraws};
};
const views=()=>Object.fromEntries(Object.entries(cameras).map(([name,camera])=>[name,count(camera)]));
const draw={unbatched_v9_pattern:views(),all_scene_triangles:count(null).triangles};
if(process.argv[2]){
 const {RigidRenderBatches:PriorBatches}=await import(pathToFileURL(resolve(process.argv[2],'src/rigid-render-batches.js')).href);
 const prior=new PriorBatches();for(const root of f.layout)prior.track(root);draw.v13_1=views();prior.dispose();
}
const batches=new RigidRenderBatches({validationMs:250});batches.trackEnvironment(f.scene,f.layout,f.movable);enableAnimatedCulling(f.scene);f.scene.updateMatrixWorld(true);beginRaycastFrame();
draw.updated=views();draw.updated_all_scene_triangles=count(null).triangles;draw.batches=batches.info();
if(draw.all_scene_triangles!==draw.updated_all_scene_triangles)throw Error('Source geometry changed');
const stats=values=>{values.sort((a,b)=>a-b);return{median_ms:values[Math.floor(values.length*.5)],p95_ms:values[Math.floor(values.length*.95)],samples:values.length}};
const mounts=[[.113,0,0],[.097,-.073,Math.PI/2],[.099,.0725,-Math.PI/2],[-.113,0,Math.PI]],rc=new T.Raycaster(new T.Vector3(),new T.Vector3(),0,2),index=new SensorRayIndex();
const sensor={};
for(const[name,x,z,yaw]of [['living_room',-3.2,.7,0],['near_person',-1.9,-2.4,0],['corridor',2,6.5,-Math.PI/2]]){
 const cast=(optimized,verify=false)=>{
  if(optimized)index.update(f.obstacles);else beginRaycastFrame();let tested=0;
  for(const[mx,mz,angle]of mounts)for(let k=0;k<9;k++){
   rc.ray.origin.set(x+mx*Math.cos(yaw)+mz*Math.sin(yaw),.1419894,z-mx*Math.sin(yaw)+mz*Math.cos(yaw));
   const a=yaw+angle+(k-4)*12.5*Math.PI/180/4;rc.ray.direction.set(Math.cos(a),0,-Math.sin(a));
   const hit=optimized?index.nearest(rc):rc.intersectObjects(f.obstacles,false)[0];tested+=optimized?index.tested:f.obstacles.length;
   if(verify){const expected=rc.intersectObjects(f.obstacles,false)[0];if(hit?.object!==expected?.object||hit&&Math.abs(hit.distance-expected.distance)>1e-8)throw Error('Sensor result changed')}
  }
  return tested;
 };
 cast(true,true);let work={};
 for(const optimized of [false,true]){
  for(let i=0;i<12;i++)cast(optimized);
  const times=[];let tested;
  for(let i=0;i<100;i++){f.HP.animate({dt:1/60,distance:.01,speed:.6});f.scene.updateMatrixWorld(true);const start=performance.now();tested=cast(optimized);times.push(performance.now()-start)}
  work[optimized?'indexed':'unindexed']={...stats(times),object_ray_tests_per_frame:tested};
 }
 sensor[name]=work;
}
console.log(JSON.stringify({schema:'dynora-apartment-core-14',fixture:'Actual apartment construction, upgraded furniture, PBR roles and bundled posed Sam/Maya geometry; deterministic construction seed 42',draw,sensor,note:'CPU timings and frustum-visible mesh submissions only. Not a GPU benchmark or a prediction of laptop FPS. View triangle reductions are offscreen culling; all scene triangles and source assets remain intact.'},null,2));batches.dispose();
