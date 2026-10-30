import {performance} from 'node:perf_hooks';
import {parseGeometry} from './human-gltf-tools.mjs';
import {prepareHumans} from '../src/realistic-human.js';
import {apartmentCPUFixture} from './apartment-cpu-fixture.mjs';
import {PropPhysics} from '../src/prop-physics.js';
import {props} from '../src/physics.js';
import {DriveDynamics,STEP} from '../src/dynamics.js';

const parsed={};for(const id of ['sam','maya'])parsed[id]=await parseGeometry(new URL('../public/visual/humans/'+id+'.glb',import.meta.url));
await prepareHumans({baseURL:'https://offline.test/',loader:{loadAsync:async url=>parsed[url.includes('maya')?'maya':'sam']}});
const scenarios={};
for(const legacyShadows of [true,false]){
 const f=await apartmentCPUFixture({legacyShadows}),physics=await new PropPhysics().initialize();let serial=0;
 // Match the real application's registration: movable room furniture has
 // compound bodies; unregistered fixed room detail keeps exact triangle shapes.
 for(const object of f.movable){
  object.traverse(m=>{if(m.isMesh&&!m.userData.noContact&&!f.obstacles.includes(m))f.obstacles.push(m)});
  const p=props(object);physics.add('room_'+serial++,object,{dynamic:true,mass:Math.max(.05,Math.min(1000,p.m)),restitution:p.e,collider:'parts'});
 }
 physics.add('walker',f.P,{kinematic:true,mass:75});physics.environment(f.obstacles);
 const state=new DriveDynamics(),robot=f.rover.robot;robot.position.set(-3.2,0,.7);state.pose.x=-3.2;state.pose.y=-.7;physics.prepareRobot(state,robot);
 const timings=[];for(let i=0;i<240;i++){const start=performance.now();physics.step(STEP,state,robot);timings.push(performance.now()-start)}
 const steady=timings.slice(120).sort((a,b)=>a-b),items=[...physics.items.values()];
 scenarios[legacyShadows?'v13_1_shadow_contacts':'updated_visual_only_shadows']={
  objects:items.length,static_triangle_meshes:physics.statics.size,compound_parts:items.reduce((n,o)=>n+o.colliders.length,0),awake_furniture_after_2_sim_seconds:items.filter(o=>o.dynamic&&!o.body.isSleeping()).length,
  steady_contact_step_median_ms:steady[60],steady_contact_step_p95_ms:steady[114],total_240_steps_ms:timings.reduce((a,b)=>a+b,0),
 };
 physics.world.free();
}
console.log(JSON.stringify({schema:'dynora-apartment-contacts-14',scenarios,note:'Identical actual room source construction, solver iterations, CCD, source geometry and 120 Hz timestep. Only render-only shadow registration differs. Native Node CPU timings are not browser/laptop FPS.'},null,2));
