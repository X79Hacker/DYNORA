import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import * as T from 'three';
const root=resolve(process.argv[2]||'src'),module=name=>import(pathToFileURL(root+'/'+name).href),{PropPhysics}=await module('prop-physics.js'),{DepthSnapshot}=await module('depth-core.js'),{DriveDynamics,STEP}=await module('dynamics.js');
const metric=(fn,n=100)=>{for(let i=0;i<8;i++)fn();const times=[];for(let i=0;i<n;i++){const t=performance.now();fn();times.push(performance.now()-t)}times.sort((a,b)=>a-b);return {median_ms:times[Math.floor(n*.5)],p95_ms:times[Math.floor(n*.95)],calls:n}};
const scene=new T.Scene(),obstacles=[];
for(let i=0;i<220;i++){const o=new T.Mesh(new T.BoxGeometry(.04,.5,.04));o.position.set(-4+(i%22)*.4,.25,-2+Math.floor(i/22)*.4);scene.add(o);obstacles.push(o)}
const p=await new PropPhysics().initialize();p.environment(obstacles);const d=new DriveDynamics(),robot=new T.Group();d.pose.x=10;robot.position.x=10;
const environment=metric(()=>p.environment(obstacles),160),step=metric(()=>p.step(STEP,d,robot),800);
const depthScene=new T.Scene(),wall=new T.Mesh(new T.PlaneGeometry(8,8,90,90),new T.MeshBasicMaterial());wall.position.z=-3;depthScene.add(wall);
for(let k=0;k<2;k++){const geo=new T.PlaneGeometry(1,1.7,100,100),n=geo.attributes.position.count,weights=new Float32Array(n*4);for(let i=0;i<n;i++)weights[i*4]=1;geo.setAttribute('skinIndex',new T.Uint16BufferAttribute(new Uint16Array(n*4),4));geo.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));const m=new T.SkinnedMesh(geo,new T.MeshBasicMaterial()),b=new T.Bone();m.add(b);m.bind(new T.Skeleton([b]));m.position.set(7+k,0,-2);depthScene.add(m)}
const camera=new T.PerspectiveCamera(70,1,.01,30);camera.updateMatrixWorld(true);
const liveDepth=metric(()=>{const s=new DepthSnapshot(depthScene);s.point(camera,.51,.51);s.dispose()},70);
const snap=new DepthSnapshot(depthScene),point=metric(()=>snap.point(camera,.51,.51),200);snap.dispose();
console.log(JSON.stringify({schema:'dynora-cpu-benchmark-11',source_root:root,environment_sync:environment,contact_step:step,live_depth_snapshot_and_point:liveDepth,depth_point:point,robot_colliders:p.robotColliders.length,robot_hull_vertices:p.robotParts.reduce((a,p)=>a+p.vertices.length/3,0),note:'CPU microbenchmarks on this host; does not measure the user GPU or full app FPS'},null,2));p.world.free();
