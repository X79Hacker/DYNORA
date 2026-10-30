import {performance} from 'node:perf_hooks';
import * as T from 'three';
import {parseGeometry} from './human-gltf-tools.mjs';
import {prepareHumans} from '../src/realistic-human.js';
import {apartmentCPUFixture} from './apartment-cpu-fixture.mjs';
import {PropPhysics} from '../src/prop-physics.js';
import {CameraClearance} from '../src/camera-clearance.js';
import {DriveDynamics,STEP} from '../src/dynamics.js';
import {props} from '../src/physics.js';
const parsed={};for(const id of ['sam','maya'])parsed[id]=await parseGeometry(new URL('../public/visual/humans/'+id+'.glb',import.meta.url));
await prepareHumans({baseURL:'https://offline.test/',loader:{loadAsync:async url=>parsed[url.includes('maya')?'maya':'sam']}});
const f=await apartmentCPUFixture(),p=await new PropPhysics().initialize();let id=0;
for(const object of f.movable){const v=props(object);p.add('room_'+id++,object,{dynamic:true,mass:Math.max(.05,Math.min(1000,v.m)),restitution:v.e,collider:'parts'})}
p.add('walker',f.P,{kinematic:true,mass:75});p.environment(f.obstacles);
const drive=new DriveDynamics(),robot=f.rover.robot;robot.position.set(-3.2,0,.7);drive.pose.x=-3.2;drive.pose.y=-.7;p.prepareRobot(drive,robot);for(let i=0;i<240;i++)p.step(STEP,drive,robot);
const orbit=new T.PerspectiveCamera(50,16/9,.1,100),bot=new T.PerspectiveCamera(70,16/9,.0015,35),a=new CameraClearance(),b=new CameraClearance(),origin=new T.Vector3(),wanted=new T.Vector3(),mountOrigin=new T.Vector3(),mountWanted=new T.Vector3();
const times=[],queries=[];
for(let i=0;i<2200;i++){
 const x=-4+(i%40)*.2,z=(i%3===0?8:1),start=performance.now();origin.set(x,.3,z);wanted.set(x+3,2.7,z+2);a.resolve(p,origin,wanted,orbit,{smooth:true});mountOrigin.set(x,.18,z);mountWanted.set(x+.133,.18,z);b.resolve(p,mountOrigin,mountWanted,bot,{margin:.001});
 if(i>=200){times.push(performance.now()-start);queries.push(a.queries+b.queries)}
}
times.sort((a,b)=>a-b);const percentile=q=>times[Math.floor(q*(times.length-1))];console.log(JSON.stringify({kind:'CPU-only camera query overhead; not GPU FPS',iterations:times.length,phase:'one follow/orbit guard plus one mounted-camera guard',median_ms:percentile(.5),p95_ms:percentile(.95),max_ms:times.at(-1),mean_queries:queries.reduce((a,b)=>a+b,0)/queries.length,physics:p.metadata()},null,2));p.world.free();
