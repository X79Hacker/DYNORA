import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import * as T from 'three';
import {parseGeometry} from './human-gltf-tools.mjs';
const root=resolve(process.argv[2]||'src'),from=name=>import(pathToFileURL(root+'/'+name).href);
const {prepareHumans,createRealisticHuman}=await from('realistic-human.js'),{beginRaycastFrame,warmRaycasts}=await from('raycast-acceleration.js');
const parsed={};for(const id of ['sam','maya'])parsed[id]=await parseGeometry(new URL('../public/visual/humans/'+id+'.glb',import.meta.url));
await prepareHumans({baseURL:'https://offline.test/',loader:{loadAsync:async url=>parsed[url.includes('maya')?'maya':'sam']}});
// Same body-frame mounts and sensor height as robot-model.js / my_bot.urdf.
const mounts=[[.113,0,0],[.097,.073,Math.PI/2],[.099,-.0725,-Math.PI/2],[-.113,0,Math.PI]],sensorHeight=.0675+.0680894+.0064;
const result={schema:'dynora-apartment-cpu-12',note:'Real bundled animated meshes, four supplied-URDF mounts, 36 rays/frame, 2 m sensor range; CPU costs only, not GPU FPS',sensor_height_m:sensorHeight,scenarios:{}};
for(const [name,distance] of [['person_beyond_sensor_range',4],['person_within_sensor_range',1]]){
 const scene=new T.Scene(),rig=createRealisticHuman({character:'sam'});rig.g.position.set(distance,0,0);scene.add(rig.g);const objects=rig.meshes;
 await warmRaycasts(scene);let ray=[],animate=[];const rc=new T.Raycaster(new T.Vector3(),new T.Vector3(1,0,0),.01,2);
 for(let frame=0;frame<64;frame++){
  const start=performance.now();rig.animate({dt:1/60,distance:.008,speed:.48});scene.updateMatrixWorld(true);const castStart=performance.now();beginRaycastFrame();
  for(const[x,y,yaw]of mounts)for(let k=0;k<9;k++){const a=yaw+(k-4)*12.5*Math.PI/180/4;rc.set(new T.Vector3(x,sensorHeight,-y),new T.Vector3(Math.cos(a),0,-Math.sin(a)));rc.intersectObjects(objects,false)}
  if(frame>7){animate.push(castStart-start);ray.push(performance.now()-castStart)}
 }
 const stats=values=>{values.sort((a,b)=>a-b);return {median_ms:values[Math.floor(values.length*.5)],p95_ms:values[Math.floor(values.length*.95)],frames:values.length}};
 result.scenarios[name]={vertices:objects.reduce((s,m)=>s+m.geometry.attributes.position.count,0),mesh_count:objects.length,animate_and_matrices:stats(animate),sensor_batch:stats(ray)};
}
console.log(JSON.stringify(result,null,2));
