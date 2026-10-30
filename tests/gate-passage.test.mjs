import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createSwingGate,GATE_DIMENSIONS} from '../src/track-gate.js';
import {PropPhysics} from '../src/prop-physics.js';
import {DriveDynamics,STEP} from '../src/dynamics.js';

async function fixture({reverse=false,mass=2.5,stiffness=.6}={}){const scene=new T.Scene(),physics=await new PropPhysics().initialize(),obstacles=[],gate=createSwingGate({parent:scene,frame:{x:.75,z:0,tx:1,tz:0,nx:0,nz:1},halfWidth:.66,leafMaterial:new T.MeshBasicMaterial(),postMaterial:new T.MeshBasicMaterial(),onObstacle:m=>obstacles.push(m)});for(const leaf of gate.leaves)physics.addHinge('gate'+leaf.sd,leaf.piv,{mass,stiffness,damping:.25});physics.environment(obstacles);const robot=new T.Group(),drive=new DriveDynamics();scene.add(robot);drive.reset({x:reverse?1.6:-.15,y:0,yaw:reverse?Math.PI:0});robot.position.x=drive.pose.x;robot.rotation.y=drive.pose.yaw;return{scene,physics,obstacles,gate,robot,drive}}
function step(f,command=[1,1]){const {drive:d,robot:r,physics:p}=f;d.advance(STEP,command,{onStep:()=>{r.position.set(d.pose.x,0,-d.pose.y);p.step(STEP,d,r)}})}
test('the actual two-leaf gate with solid posts opens under rover contact from either direction',async()=>{
 for(const reverse of [false,true]){const f=await fixture({reverse}),p=f.physics;let opening=0,firstContact=null;
  for(let i=0;i<1560;i++){step(f);opening=Math.max(opening,...f.gate.leaves.map(l=>l.piv.quaternion.angleTo(l.restQuaternion)));if(firstContact===null&&p.collisions.length)firstContact=f.drive.pose.x;
   for(const leaf of f.gate.leaves){const body=p.items.get('gate'+leaf.sd).body,pos=body.translation();assert.ok(Math.hypot(pos.x-.75,pos.z-leaf.sd*.66)<.003,'hinge stays anchored')}
  }
  assert.ok(opening>.55,'contact opens a real passage, rather than merely vibrating the leaves');assert.ok(reverse?f.drive.pose.x<-.3:f.drive.pose.x>1.8,`rover passes the gate: ${f.drive.pose.x}`);assert.ok(firstContact!==null);assert.ok(Math.abs(firstContact-.75)<.2,'the gate cannot push the rover before visible contact');assert.equal(p.statics.size,2,'only posts are static, no leaf ghost boxes');assert.ok([...p.items.values()].every(i=>i.colliders.length===1),'decorative hinge straps do not jam the posts');p.world.free();
 }
});
test('the gate remains shut before contact and its spring closes after the robot clears it',async()=>{
 const f=await fixture();for(let i=0;i<40;i++)step(f,[0,0]);assert.ok(f.gate.leaves.every(l=>l.piv.quaternion.angleTo(l.restQuaternion)<.002));for(let i=0;i<1250;i++)step(f);assert.ok(f.drive.pose.x>1.6);f.drive.reset({x:3,y:0,yaw:0});f.robot.position.x=3;for(let i=0;i<1800;i++)step(f,[0,0]);for(const leaf of f.gate.leaves)assert.ok(leaf.piv.quaternion.angleTo(leaf.restQuaternion)<.08,'spring returns a clear leaf to its closed rest');f.physics.world.free();
});
test('gate hinge clearance exceeds the square post diagonal through the whole swing',()=>{assert.ok(GATE_DIMENSIONS.hingeClearance>Math.SQRT2*GATE_DIMENSIONS.postWidth/2+.005)});
