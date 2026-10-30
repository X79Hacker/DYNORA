import RAPIER from '@dimforge/rapier3d-compat';
import {LabExperiment} from './physics-test-core.js';
import {ROBOT_PROFILES,robotProfile,profileRadius} from './robot-profiles.js';
import {OccupancyGrid,planGrid,followPath} from './navigation-core.js';
import {TrialScore} from './scenario-core.js';
import {makeRNG} from './lab-core.js';
let generation=0;
const yieldThread=()=>new Promise(resolve=>setTimeout(resolve,0));
async function trial(profile,seed,test,controller,run){
 const rng=makeRNG('evaluation:'+seed),p=robotProfile(profile).parameters,env=await new LabExperiment({robotProfile:profile,robot:p,case:test==='pothole'?'terrain':test==='obstacle'?'collision':'surface',surface:seed%2?'dry':'wet',control:{mode:'manual',timeScale:1},collision:{target:'medium',x:0,z:(rng()-.5)*.15},spawn:{x:-1.5,z:0,yaw:0}}).initialize();
 try{
 env.step(1); // Initialize the contact/query pipeline before casting sensor rays.
 const grid=new OccupancyGrid({minX:-4,minY:-1.5,width:8,height:3,resolution:.1}),goal={x:1.5,y:0};grid.cells.fill(-2);grid.seen.fill(0);
 // This comparison intentionally uses a known geometric map for A*. The live
 // scene navigator separately builds its map from measured ToF only.
 if(env.target){const {x,z}=env.target.object.position;for(let i=0;i<grid.cells.length;i++){const q=grid.point(i);if(Math.abs(q.x-x)<.18&&Math.abs(q.y+z)<.18)grid.cells[i]=5}}
 const radius=profileRadius(profile,p),planned=planGrid(grid.snapshot(0),env.drive.pose,goal,{radius,allowUnknown:false}),score=new TrialScore({goal,timeout:60,label:`${profile} / ${test} / ${controller} / seed ${seed}`});
 for(let step=0;step<7201;step++){
  if(run!==generation)return null;const d=env.drive,readings=[];for(let side=0;side<4;side++){let distance=2,hit=false;const base=d.pose.yaw+[0,Math.PI/2,-Math.PI/2,Math.PI][side];for(let ray=0;ray<9;ray++){const angle=base+(ray-4)*12.5*Math.PI/720,dx=Math.cos(angle),dz=-Math.sin(angle),origin={x:d.pose.x+dx*(p.length/2+.03),y:env.robot.position.y+p.radius+.1,z:-d.pose.y+dz*(p.length/2+.03)},result=env.physics.world.castRay(new RAPIER.Ray(origin,{x:dx,y:0,z:dz}),2,true,undefined,undefined,undefined,env.physics.robotBody);if(result&&result.timeOfImpact<distance){distance=result.timeOfImpact;hit=true}}
   readings.push({status:hit?'ok':'out_of_range',value:hit?Math.max(.01,distance+(rng()-.5)*.01):null})}
  const path=controller==='astar'?planned.path:[{x:d.pose.x,y:d.pose.y},goal],command=followPath(path,d.pose,{front:readings[0],allowUnknown:true,maxDuty:.7,minimumDuty:p.deadband/255+.025});env.setControl({forward:(command.left+command.right)/2,turn:(command.right-command.left)/2,brake:command.brake});env.step(1);score.sample({time:d.time,x:d.pose.x,y:d.pose.y,speed:d.v,energyWh:d.energyWh,contacts:env.physics.collisionCount,readings});if(score.status!=='running')break;if(step%120===0)await yieldThread();
 }return{profile,seed,test,controller,planner:controller==='astar'?planned.status:null,...score.report()};
 }finally{env.dispose()}
}
self.onmessage=async({data})=>{if(data.command==='cancel'){generation++;return}if(data.command!=='run')return;const run=++generation,results=[];try{const profiles=data.profiles==='all'?ROBOT_PROFILES.map(p=>p.id):[robotProfile(data.profiles).id],seeds=Number(data.seeds);if(!Number.isInteger(seeds)||seeds<1||seeds>5)throw Error('Use 1–5 seeds');const total=profiles.length*seeds*6;for(const p of profiles)for(let seed=1;seed<=seeds;seed++)for(const test of['surface','obstacle','pothole'])for(const controller of['pursuit','astar']){if(run!==generation)return;const result=await trial(p,seed,test,controller,run);if(!result)return;results.push(result);self.postMessage({type:'progress',done:results.length,total,result})}self.postMessage({type:'complete',report:{schema:'dynora-evaluation-1',results,limits:'Isolated 8 × 3 m Rapier testbed. Known-map A* versus direct pursuit, shared profiles, surfaces and deterministic range noise. No apartment benchmark or trained model comparison.'}})}catch(e){if(run===generation)self.postMessage({type:'error',error:e.message})}};
