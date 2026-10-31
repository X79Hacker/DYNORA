import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {BufferGeometryUtils} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {PropPhysics} from '../src/prop-physics.js';
import {DriveDynamics,DEFAULTS,STEP} from '../src/dynamics.js';
import {TerrainRide} from '../src/terrain-ride.js';
import {BASELINE_HOLE,holeDepth} from '../src/track-surface.js';

function mesh(scene,w,h,d,x,y,z){const o=new T.Mesh(new T.BoxGeometry(w,h,d));o.position.set(x,y,z);scene.add(o);return o}
async function run(obstacles,{start={x:0,y:0,yaw:0},speed=.4,steps=400,physics=null,motors=false}={}){
 const p=physics||await new PropPhysics().initialize(),robot=new T.Group(),d=new DriveDynamics();d.reset(start);robot.position.set(start.x,0,-start.y);d.v=speed;p.environment(obstacles);let min=speed,maxX=start.x,first=null;
 for(let i=0;i<steps;i++){
  if(motors)d.advance(STEP,[1,1],{onStep:()=>{robot.position.set(d.pose.x,0,-d.pose.y);p.step(STEP,d,robot)}});
  else{d.pose.x+=d.v*Math.cos(d.pose.yaw)*STEP;d.pose.y+=d.v*Math.sin(d.pose.yaw)*STEP;robot.position.set(d.pose.x,0,-d.pose.y);p.step(STEP,d,robot)}
  if(first===null&&d.v<speed*.9)first={x:d.pose.x,time:i*STEP};min=Math.min(min,d.v);maxX=Math.max(maxX,d.pose.x);
 }
 return {p,d,robot,min,maxX,first};
}
test('a merged track fence retains its opening instead of filling its entire bounding box',async()=>{
 const scene=new T.Scene(),geometries=[-1,1].map(z=>new T.BoxGeometry(.035,.3,.8).translate(.75,.15,z)),fence=new T.Mesh(BufferGeometryUtils.mergeBufferGeometries(geometries));scene.add(fence);
 const r=await run([fence],{speed:.6});assert.ok(r.d.pose.x>1.8,'open middle remains drivable');assert.equal(r.p.collisions.length,0);assert.equal(r.p.statics.size,1);r.p.world.free();
});
test('a thin track fence stops sustained motor force without the bot entering it',async()=>{
 const scene=new T.Scene(),fence=mesh(scene,.012,.4,4,.75,.2,0),r=await run([fence],{motors:true,steps:1200});
 assert.ok(r.maxX<.75-.006-.14+.003,`robot nose crossed fence: ${r.maxX}`);assert.ok(r.d.pose.x>.5);assert.ok(r.p.collisions.length>0);r.p.world.free();
});
test('rotated thin surfaces do not collide with the empty corners of their world bounds',async()=>{
 const scene=new T.Scene(),rail=mesh(scene,2,.4,.025,0,.2,0);rail.rotation.y=Math.PI/4;
 const r=await run([rail],{start:{x:-.8,y:.55,yaw:0},speed:.45,steps:175});assert.ok(r.d.pose.x>-.2,'robot passes through an empty AABB corner before reaching the actual rail');assert.equal(r.p.collisions.length,0);r.p.world.free();
});
test('the middle gap below the chassis is open while a wheel remains solid',async()=>{
 const scene=new T.Scene(),lowPole=mesh(scene,.035,.05,.035,.75,.025,0),gap=await run([lowPole],{speed:.6});assert.ok(gap.d.pose.x>1.8);gap.p.world.free();
 lowPole.position.z=DEFAULTS.track/2;const wheel=await run([lowPole],{speed:.6});assert.ok(wheel.maxX<.75,'the same pole in a tyre path is a real impact');assert.ok(wheel.p.collisions.length>0);wheel.p.world.free();
});
test('upper chassis contact starts at its visible plate rather than the tyre envelope',async()=>{
 const scene=new T.Scene(),bar=mesh(scene,.02,.012,1,.75,DEFAULTS.radius+.0680894+.002,0),r=await run([bar],{speed:.25});
 const expected=.75-.01-(DEFAULTS.length/2+.0007);assert.ok(r.first, 'contact detected');assert.ok(Math.abs(r.first.x-expected)<.004,`contact should be within 4 mm of visible plate: ${r.first.x} vs ${expected}`);r.p.world.free();
});
test('CCD catches a 4 mm wall at high speed',async()=>{
 const scene=new T.Scene(),wall=mesh(scene,.004,1,3,.5,.5,0),r=await run([wall],{speed:7,steps:80});assert.ok(r.maxX<.5-.002-.14+.004);assert.ok(r.p.collisions.length>0);r.p.world.free();
});
test('moved and removed track meshes update on the next contact synchronization',async()=>{
 const p=await new PropPhysics().initialize(),scene=new T.Scene(),o=mesh(scene,.03,.4,3,.7,.2,0);p.environment([o]);const handle=p.statics.get(o.uuid).collider.handle;o.position.x=1.4;p.environment([o]);assert.equal(p.statics.get(o.uuid).collider.handle,handle,'movement does not rebuild geometry');assert.ok(Math.abs(p.statics.get(o.uuid).collider.translation().x-1.4)<1e-6);scene.remove(o);p.environment([o]);assert.equal(p.statics.size,0,'detached geometry leaves no ghost collider');p.world.free();
});
test('a real hinged gate receives impact, opens, stays on its hinge and leaves no static ghost',async()=>{
 const p=await new PropPhysics().initialize(),scene=new T.Scene(),pivot=new T.Group();pivot.position.set(.75,0,-.3);pivot.rotation.y=-Math.PI/2;scene.add(pivot);const leaf=new T.Mesh(new T.BoxGeometry(.6,.4,.03));leaf.position.set(.3,.25,0);pivot.add(leaf);p.addHinge('gate',pivot,{mass:1,stiffness:.1,damping:.08});p.environment([leaf]);assert.equal(p.statics.size,0);
 const body=p.items.get('gate').body,r=await run([leaf],{speed:.6,steps:420,physics:p,motors:true});const angle=2*Math.atan2(body.rotation().y,body.rotation().w);assert.ok(Math.abs(angle+Math.PI/2)>.3,'impact rotates the gate');assert.ok(body.translation().x>.74&&body.translation().x<.76);assert.ok(body.translation().z>-.31&&body.translation().z<-.29);assert.ok(r.p.collisions.some(e=>e.dynamic));p.remove('gate');assert.equal(p.items.size,0);p.world.free();
});
test('a short explicit robot reset updates its physical position even below the old teleport threshold',async()=>{
 const p=await new PropPhysics().initialize(),d=new DriveDynamics(),robot=new T.Group();p.step(STEP,d,robot);d.reset({x:.12,y:0,yaw:0});robot.position.x=.12;p.step(STEP,d,robot);assert.ok(Math.abs(d.pose.x-.12)<1e-6);p.world.free();
});

function rideRun(fps,{coupled=false}={}){
 const ride=new TerrainRide(),d=new DriveDynamics(),height=(x,z)=>-holeDepth({...BASELINE_HOLE,x:0,z:0},x,z);d.reset({x:-.85,y:0,yaw:0});const samples=[];
 for(let frame=0;frame<fps*12;frame++)d.advance(1/fps,coupled?[.57,.57]:[0,0],{terrain:()=>({pitch:ride.pose?.pitch||0,roll:ride.pose?.roll||0}),onStep:(h,s)=>{if(!coupled){s.v=.18;s.pose.x=-.85+(s.steps+1)*h*.18}s.pose.y=0;const pose=ride.step(h,{x:s.pose.x,z:0,yaw:0,p:s.p,height});samples.push({x:s.pose.x,...pose,v:s.v,support:[...ride.support],wheelOffsets:[...ride.wheelOffsets]})}});
 return {ride,d,samples};
}
test('pothole response is fixed-step invariant at 30, 60 and 120 display FPS',()=>{
 const a=rideRun(30),b=rideRun(60),c=rideRun(120);assert.deepEqual(a.samples,b.samples);assert.deepEqual(b.samples,c.samples);assert.ok(a.samples.some(p=>p.y<-.015),'chassis actually enters the depression');assert.ok(Math.abs(a.samples.at(-1).y)<.0001,'chassis settles after the hole');
});
test('pothole chassis attitude is bounded, damped and has no instantaneous pose snaps',()=>{
 const {samples}=rideRun(60);let maxHeaveDelta=0,maxPitchDelta=0;for(let i=1;i<samples.length;i++){const a=samples[i-1],b=samples[i];maxHeaveDelta=Math.max(maxHeaveDelta,Math.abs(b.y-a.y));maxPitchDelta=Math.max(maxPitchDelta,Math.abs(b.pitch-a.pitch));assert.ok(b.wheelOffsets.every(v=>Math.abs(v)<=.01400001));assert.ok(Number.isFinite(b.y+b.pitch+b.roll))}assert.ok(maxHeaveDelta<.002);assert.ok(maxPitchDelta<.025);assert.ok(samples.every(p=>Math.abs(p.pitch)<.3));
});
test('motor-driven pothole traversal uses current substep attitude and agrees across display rates',()=>{
 const a=rideRun(30,{coupled:true}),b=rideRun(120,{coupled:true});assert.ok(a.d.pose.x>.8,'default rover exits the baseline pothole');assert.ok(Math.abs(a.d.pose.x-b.d.pose.x)<1e-10);assert.ok(a.samples.every(s=>Math.abs(s.v)<1));
});
test('a sudden loss of tyre support falls under gravity rather than snapping down',()=>{
 const ride=new TerrainRide(),p=DEFAULTS;ride.step(STEP,{x:0,z:0,yaw:0,p,height:()=>0});const pose=ride.step(STEP,{x:.01,z:0,yaw:0,p,height:()=>-.1});assert.ok(pose.y>-.001);assert.ok(ride.axes[0].v>=-9.80665*STEP-1e-10);
});

test('driving with scene editing still enabled cannot bypass the contact solver',async()=>{
 const {stepVisualPhysics}=await import('../src/prop-physics.js'),p=await new PropPhysics().initialize(),scene=new T.Scene(),wall=mesh(scene,.02,.4,3,.7,.2,0),d=new DriveDynamics(),robot=new T.Group();p.environment([wall]);let animationTime=0;
 for(let i=0;i<900;i++)d.advance(STEP,[1,1],{onStep:(h,s)=>stepVisualPhysics(h,s,{physics:p,robot,editing:true,mixers:[{update(dt){animationTime+=dt}}]})});
 assert.equal(animationTime,0,'editor pauses only animation');assert.equal(p.steps,900);assert.ok(d.pose.x<.7-.01-.14+.003);assert.ok(p.collisions.length>0);p.world.free();
});
