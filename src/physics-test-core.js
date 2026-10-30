import * as T from 'three';
import {DriveDynamics,STEP,clamp} from './dynamics.js';
import {PropPhysics} from './prop-physics.js';
import {TerrainRide} from './terrain-ride.js';
import {Airflow2D,BalloonDynamics,quadraticDrag} from './airflow-core.js';
import {validateLabSettings,labSurface,labHeight,liveResetReasons} from './physics-test-settings.js';

export class LabExperiment{
 constructor(settings){
  this.settings=validateLabSettings(settings);this.initialSettings=structuredClone(this.settings);const {spawn}=this.settings;
  this.drive=new DriveDynamics(this.settings.robot);this.drive.reset({x:spawn.x,y:-spawn.z,yaw:spawn.yaw*Math.PI/180});this.drive.v=this.settings.drive.initialSpeed;
  this.robot=new T.Group();this.robot.rotation.order='YXZ';this.robot.position.set(spawn.x,0,spawn.z);this.robot.rotation.y=this.drive.pose.yaw;this.scene=new T.Scene();this.scene.add(this.robot);
  this.ride=new TerrainRide(this.settings.ride);this.height=labHeight(this.settings);this.surface=labSurface(this.settings);
  this.samples=[];this.events=[];this.droppedSamples=0;this.droppedEvents=0;this.steps=0;this.time=0;this.flowAccumulator=0;this.status='ready';this.command={forward:0,turn:0,brake:false};this.appliedCommand=[0,0];
  this.stopX=null;this.coastDistance=0;this.coastTime=0;this.stillTime=0;this.stopDistance=null;
  this.metrics={distance_m:0,peak_speed_mps:0,peak_slip_ratio:0,peak_pitch_deg:0,peak_roll_deg:0,slip_sum:0,energy_Wh:0,peak_robot_wind_N:0,peak_balloon_tension_N:0,physics_cpu_ms:0};this.previousX=spawn.x;this.previousY=-spawn.z;this.windForce=0;
 }
 async initialize(){
  this.physics=await new PropPhysics().initialize();const s=this.settings;this.robot.userData.roverProfile=s.robotProfile;
  if(s.case==='terrain')this.physics.setTerrain(this.height,{width:8,depth:3,spacing:.05});this.physics.ground.setFriction(s.collision.friction);
  if(s.case==='collision'){
   const wall=s.collision.target==='wall',size=wall?[.05,.8,2.4]:[.28,.28,.28],object=new T.Mesh(new T.BoxGeometry(...size));object.position.set(s.collision.x,size[1]/2,s.collision.z);object.rotation.y=s.collision.yaw*Math.PI/180;object.userData.label=wall?'Fixed test wall':'Collision target';this.scene.add(object);
   const mass=this.targetMass(s);this.physics.add('target',object,{dynamic:!wall,mass,friction:s.collision.friction,restitution:s.collision.restitution});this.target={object,size,mass,initialX:s.collision.x,initialZ:s.collision.z,fixed:wall};
  }
  if(s.case==='air'){
   const quality={low:{nx:32,ny:16,iterations:32},balanced:{nx:48,ny:24,iterations:48},high:{nx:72,ny:36,iterations:72}}[s.air.quality];this.flow=new Airflow2D({...s.air,...quality});this.balloon=new BalloonDynamics({...s.balloon,airDensity:s.air.density});this.balloon.lastForces=this.balloon.forces(this.flow.sample(this.balloon.position.x,this.balloon.position.y));
   if(s.air.baffle){this.baffle={minX:.66,maxX:.94,minY:.3,maxY:2.2};const baffle=new T.Mesh(new T.BoxGeometry(.28,1.9,.8));baffle.position.set(.8,1.25,0);baffle.userData.label='Airflow baffle';this.scene.add(baffle);this.physics.add('baffle',baffle,{dynamic:false,mass:100,collider:'box'})}
  }
  this.applyRide(this.ride.step(0,{x:s.spawn.x,z:s.spawn.z,yaw:this.drive.pose.yaw,p:this.drive.p,height:this.height,reset:true}));this.physics.prepareRobot(this.drive,this.robot);this.profile=Array.from({length:241},(_,i)=>{const x=-4+i/30;return[x,this.height(x,0)]});return this;
 }
 targetMass(s){return {light:.2,medium:5,heavy:80,wall:1000}[s.collision.target]??s.collision.mass}
 event(type,detail){this.events.push({t_s:this.time,type,...detail});if(this.events.length>400){this.events.shift();this.droppedEvents++}}
 setControl({forward=0,turn=0,brake=false}={}){
  if(!Number.isFinite(forward)||!Number.isFinite(turn)||typeof brake!=='boolean')throw Error('Manual commands need finite forward / turn duty and a boolean brake');
  const next={forward:clamp(forward,-1,1),turn:clamp(turn,-1,1),brake};if(JSON.stringify(next)!==JSON.stringify(this.command))this.event('manual_input',next);this.command=next;
 }
 updateSettings(input){
  const next=validateLabSettings(input),reasons=liveResetReasons(this.settings,next);if(reasons.length)throw Error('Apply & reset is needed for: '+reasons.join(', ')+'. Live settings were not changed.');
  const before=this.settings;this.drive.configure(next.robot);this.ride.configure(next.ride);this.surface=labSurface(next);
  if(this.target){this.target.mass=this.targetMass(next);this.physics.setProperties('target',{mass:this.target.mass,friction:next.collision.friction,restitution:next.collision.restitution})}this.physics.ground.setFriction(next.collision.friction);
  if(this.flow)for(const key of ['wind','angle','gust','frequency','viscosity'])this.flow[key]=next.air[key];
  if(this.balloon){const old=this.balloon,b=new BalloonDynamics({...next.balloon,airDensity:next.air.density});Object.assign(b,{position:{...old.position},velocity:{...old.velocity},anchor:{...old.anchor},time:old.time,lastForces:{...old.lastForces}});b.lastForces=b.forces(this.flow.sample(b.position.x,b.position.y));this.balloon=b}
  if(before.control.mode!==next.control.mode)this.setControl({brake:true});this.settings=next;if(next.control.mode==='manual'&&this.status==='completed')this.status='paused';this.event('settings_applied',{settings:structuredClone(next)});return next;
 }
 impulseBalloon({x=0,y=0}){if(!this.balloon)throw Error('Choose Air & balloon to apply a balloon impulse');if(!Number.isFinite(x)||!Number.isFinite(y)||Math.hypot(x,y)>.25)throw Error('Balloon impulse must be at most 0.25 N·s');this.balloon.velocity.x+=x/this.balloon.effectiveMass;this.balloon.velocity.y+=y/this.balloon.effectiveMass;this.event('balloon_impulse',{x_Ns:x,y_Ns:y})}
 applyRide(pose){this.robot.position.y=pose.y;this.robot.rotation.x=pose.roll;this.robot.rotation.z=pose.pitch;this.drive.rideWheelOffsets=this.ride.wheelOffsets}
 external(state){if(!this.flow)return null;const c=Math.cos(state.pose.yaw),sn=Math.sin(state.pose.yaw),wind=this.flow.sample(state.pose.x,this.robot.position.y+state.p.comHeight),vx=state.v*c-state.lateral*sn,drag=quadraticDrag({x:wind.x-vx,y:0},{density:this.settings.air.density,cd:this.settings.air.robotCd,area:this.settings.air.robotArea});this.windForce=drag.x;return{forward:drag.x*c,lateral:-drag.x*sn,yaw:0}}
 step(count=1){
  const begin=performance.now();for(let i=0;i<count;i++){
   const manual=this.settings.control.mode==='manual';if(!manual&&this.time>=this.settings.drive.duration-1e-9)break;
   const active=manual||this.time<this.settings.drive.driveSeconds,duty=manual?this.command.forward:active?this.settings.drive.duty:0,turn=manual?this.command.turn:active?this.settings.drive.turn:0;
   const brake=manual?this.command.brake||this.settings.drive.brake&&Math.abs(duty)+Math.abs(turn)<1e-8:!active&&this.settings.drive.brake;
   if(!manual&&!active&&this.stopX===null)this.stopX=this.drive.pose.x;this.appliedCommand=brake?[0,0]:[clamp(duty-turn,-1,1),clamp(duty+turn,-1,1)];
   this.drive.advance(STEP,this.appliedCommand,{surface:this.surface,brake,terrain:()=>({pitch:this.robot.rotation.z,roll:this.robot.rotation.x}),external:s=>this.external(s),onStep:(h,state)=>{
    this.robot.position.x=state.pose.x;this.robot.position.z=-state.pose.y;this.robot.rotation.y=state.pose.yaw;this.applyRide(this.ride.step(h,{x:state.pose.x,z:-state.pose.y,yaw:state.pose.yaw,p:state.p,height:this.height}));this.physics.step(h,state,this.robot);
    if(this.flow){this.flowAccumulator+=h;if(this.flowAccumulator>=1/30-1e-10){this.flow.step(1/30);this.flowAccumulator-=1/30}this.balloon.step(h,this.flow.sample(this.balloon.position.x,this.balloon.position.y),{width:8,height:4,baffle:this.baffle})}
   }});
   this.steps++;this.time=this.drive.time;const d=this.drive,m=this.metrics,travelled=Math.hypot(d.pose.x-this.previousX,d.pose.y-this.previousY);m.distance_m+=travelled;
   if(!manual&&!active){this.coastTime+=STEP;this.coastDistance+=travelled;this.stillTime=Math.abs(d.v)<.005&&Math.abs(d.w)<.03?this.stillTime+STEP:0;if(this.stopDistance===null&&this.stillTime>=.25)this.stopDistance=this.coastDistance}
   this.previousX=d.pose.x;this.previousY=d.pose.y;m.peak_speed_mps=Math.max(m.peak_speed_mps,Math.abs(d.v));m.peak_slip_ratio=Math.max(m.peak_slip_ratio,...d.slip.map(Math.abs));m.slip_sum+=(Math.abs(d.slip[0])+Math.abs(d.slip[1]))/2;m.peak_pitch_deg=Math.max(m.peak_pitch_deg,Math.abs(this.robot.rotation.z)*180/Math.PI);m.peak_roll_deg=Math.max(m.peak_roll_deg,Math.abs(this.robot.rotation.x)*180/Math.PI);m.energy_Wh=d.energyWh;m.peak_robot_wind_N=Math.max(m.peak_robot_wind_N,Math.abs(this.windForce));m.peak_balloon_tension_N=Math.max(m.peak_balloon_tension_N,this.balloon?.lastForces.tension_N||0);
   if(this.steps%6===0){this.samples.push(this.sample());if(this.samples.length>1600){this.samples.shift();this.droppedSamples++}}
  }
  this.metrics.physics_cpu_ms+=performance.now()-begin;if(this.settings.control.mode==='scripted'&&this.time>=this.settings.drive.duration-1e-9)this.status='completed';return this.snapshot();
 }
 sample(){const d=this.drive,b=this.balloon;return{sample_sequence:Math.floor(this.steps/6),t_s:this.time,x_m:d.pose.x,y_m:d.pose.y,z_m:this.robot.position.y,speed_mps:d.v,wheel_speed_mps:(d.omega[0]+d.omega[1])*d.p.radius/2,yaw_rate_rps:d.w,yaw_rad:d.pose.yaw,pitch_deg:this.robot.rotation.z*180/Math.PI,roll_deg:this.robot.rotation.x*180/Math.PI,slip_left:d.slip[0],slip_right:d.slip[1],traction_left_N:d.force[0],traction_right_N:d.force[1],normal_N:d.normalForce,voltage_V:d.voltage,current_A:d.current[0]+d.current[1],input_left_duty:this.appliedCommand[0],input_right_duty:this.appliedCommand[1],manual_forward_duty:this.settings.control.mode==='manual'?this.command.forward:null,manual_turn_duty:this.settings.control.mode==='manual'?this.command.turn:null,manual_brake:this.settings.control.mode==='manual'?this.command.brake:null,target_x_m:this.target?.object.position.x??null,target_z_m:this.target?.object.position.z??null,wind_drag_N:this.windForce,balloon_x_m:b?.position.x??null,balloon_y_m:b?.position.y??null,buoyancy_N:b?.lastForces.buoyancy_N??null,balloon_weight_N:b?.lastForces.weight_N??null,balloon_drag_x_N:b?.lastForces.drag_x_N??null,balloon_drag_y_N:b?.lastForces.drag_y_N??null,tension_N:b?.lastForces.tension_N??null,balloon_contact_impulse_Ns:b?.lastForces.contact_impulse_Ns??null,flow_divergence_s_inv:this.flow?.divergenceAfter??null}}
 summary(){const {slip_sum,...m}=this.metrics;return{...m,mean_abs_slip_ratio:this.steps?slip_sum/this.steps:0,stopping_distance_m:this.stopDistance,stopping_complete:this.stopDistance!==null,coast_distance_m:this.stopX===null?null:this.coastDistance,coast_observation_s:this.coastTime,target_displacement_m:this.target?Math.hypot(this.target.object.position.x-this.target.initialX,this.target.object.position.z-this.target.initialZ):null,contact_events:this.physics.collisions.length,max_contact_impulse_Ns:Math.max(0,...this.physics.collisions.map(e=>e.net_robot_impulse_Ns)),simulated_seconds:this.time,cpu_ms_per_physics_step:this.steps?m.physics_cpu_ms/this.steps:0,dropped_old_samples:this.droppedSamples,dropped_old_events:this.droppedEvents}}
 snapshot(){return{status:this.status,time_s:this.time,control_mode:this.settings.control.mode,command:{...this.command},testbed_contains_robot:Math.abs(this.drive.pose.x)<=3.8&&Math.abs(this.drive.pose.y)<=1.3,robot:{position:this.robot.position.toArray(),quaternion:this.robot.quaternion.toArray(),wheels:this.ride.wheelOffsets.slice(),wheel_angles:this.drive.angles.slice(),...this.sample(),wheel_loads_N:this.drive.wheelNormal.slice()},target:this.target?{position:this.target.object.position.toArray(),quaternion:this.target.object.quaternion.toArray(),size:this.target.size,mass_kg:this.target.mass,fixed:this.target.fixed}:null,balloon:this.balloon?.snapshot()||null,flow:this.flow?.metadata()||null,summary:this.summary(),last_collision:this.physics.collisions.at(-1)||null}}
 report(){return{schema:'dynora-test-report-14.1',status:this.status,settings:this.settings,initial_settings:this.initialSettings,summary:this.summary(),events:this.events,sample_window:{max_samples:1600,retained:this.samples.length,dropped_old_samples:this.droppedSamples,events_retained:this.events.length,dropped_old_events:this.droppedEvents},physics:this.physics.metadata(),terrain_ride:this.ride.metadata(),airflow:this.flow?.metadata()||null,balloon:this.balloon?.snapshot()||null,columns:Object.keys(this.sample()),samples:this.samples,collisions:this.physics.collisions,limitations:['Reduced-order rover tyres and chassis response; not a full suspension/rollover solver','Airflow is a coarse periodic 2D incompressible slice with finite pressure residual','Balloon uses a rigid sphere, quadratic drag, buoyancy and unilateral spring tether; no fabric deformation or feedback to flow','Only horizontal wind drag is applied to the rover; no aerodynamic lift/roll model','Terrain testbed is 8 × 3 m; manual driving outside it is indicated and is not a terrain measurement','Illustrative model parameters require real hardware calibration']}}
 dispose(){this.physics?.world.free();this.scene.traverse(o=>o.geometry?.dispose())}
}
export function labCSV(report){const quote=v=>v===null||v===undefined?'':typeof v==='number'?Number(v.toFixed(9)):JSON.stringify(String(v));return [report.columns.join(','),...report.samples.map(s=>report.columns.map(k=>quote(s[k])).join(','))].join('\n')}
