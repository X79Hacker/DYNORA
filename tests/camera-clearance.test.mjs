import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {PropPhysics} from '../src/prop-physics.js';
import {CameraClearance,MountedCameraClearance,cameraClearanceRadius} from '../src/camera-clearance.js';
const vec=(x,y,z)=>new T.Vector3(x,y,z),rot={x:0,y:0,z:0,w:1};
async function fixture(){const physics=await new PropPhysics().initialize();physics.world.step();physics.steps++;return physics}
function refresh(p){p.world.step();p.steps++}
test('camera boom stops before a thin obstacle with clearance for all near-plane corners',async()=>{
 const p=await fixture(),wall=p.world.createCollider(RAPIER.ColliderDesc.cuboid(.01,2,2).setTranslation(1,1,0));refresh(p);
 const camera=new T.PerspectiveCamera(70,16/9,.1,100),guard=new CameraClearance(),origin=vec(0,1,0),wanted=vec(3,1,0),safe=guard.resolve(p,origin,wanted,camera).clone(),radius=cameraClearanceRadius(camera);
 assert.ok(safe.x<.99-radius);assert.ok(safe.x>.5);assert.equal(guard.adjusted,true);
 const contact=wall.contactShape(new RAPIER.Ball(radius),safe,rot,.01);assert.ok(!contact||contact.distance>=0);
 p.world.free();
});
test('camera clearance uses moved props, excludes the rover and returns smoothly after removal',async()=>{
 const p=await fixture(),body=p.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,1,0));p.world.createCollider(RAPIER.ColliderDesc.cuboid(.3,.3,.3),body);p.robotBody=body;
 const prop=p.world.createCollider(RAPIER.ColliderDesc.cuboid(.15,.5,.5).setTranslation(1,1,0));refresh(p);
 const camera=new T.PerspectiveCamera(50,1,.05,100),g=new CameraClearance(),o=vec(0,1,0),w=vec(3,1,0);
 const blocked=g.resolve(p,o,w,camera,{smooth:true}).clone();assert.ok(blocked.x>.4&&blocked.x<1);
 prop.setTranslation({x:2,y:1,z:0});refresh(p);const moved=g.resolve(p,o,w,camera,{smooth:false}).clone();assert.ok(moved.x>1.5&&moved.x<2);
 p.world.removeCollider(prop,true);refresh(p);const eased=g.resolve(p,o,w,camera,{dt:1/60,smooth:true}).clone();assert.ok(eased.x>moved.x&&eased.x<3);
 const clear=g.resolve(p,o,w,camera,{smooth:false});assert.ok(clear.distanceTo(w)<1e-8);p.world.free();
});
test('a camera initially enclosed by a newly placed prop is pushed outside its contact surface',async()=>{
 const p=await fixture(),wall=p.world.createCollider(RAPIER.ColliderDesc.cuboid(.2,.3,.3).setTranslation(1,1,0));refresh(p);
 const camera=new T.PerspectiveCamera(50,1,.02,100),g=new CameraClearance(),safe=g.resolve(p,vec(1,1,0),vec(1.05,1,0),camera).clone();
 const contact=wall.contactShape(new RAPIER.Ball(g.radius),safe,rot,.01);assert.ok(!contact||contact.distance>=-.0001);assert.ok(g.queries<=5);p.world.free();
});
test('mounted camera corrects an obstructed calibrated mount and exports its effective extrinsics without drift',async()=>{
 const p=await fixture(),wall=p.world.createCollider(RAPIER.ColliderDesc.cuboid(.02,.3,.3).setTranslation(.145,.18,0));refresh(p);
 const robot=new T.Group(),camera=new T.PerspectiveCamera(70,16/9,.0015,35);camera.position.set(.133,.18,0);robot.add(camera);
 const mount=new MountedCameraClearance(robot,camera);mount.update(p);const state=mount.metadata();
 assert.equal(state.clearance_adjusted,true);assert.deepEqual(state.configured_body_xyz_m,[.133,-0,.18]);assert.ok(state.effective_body_xyz_m[0]<.125);assert.ok(camera.near<.002);
 const first=camera.position.clone();for(let i=0;i<20;i++)mount.update(p);assert.ok(camera.position.distanceTo(first)<1e-7);
 p.world.removeCollider(wall,true);refresh(p);mount.update(p);assert.ok(camera.position.distanceTo(vec(.133,.18,0))<1e-7);p.world.free();
});
test('a doorway remains open to the camera sphere and absent render helpers cannot obstruct it',async()=>{
 const p=await fixture();p.world.createCollider(RAPIER.ColliderDesc.cuboid(.05,1,.5).setTranslation(1,1,-1));p.world.createCollider(RAPIER.ColliderDesc.cuboid(.05,1,.5).setTranslation(1,1,1));refresh(p);
 const camera=new T.PerspectiveCamera(50,1,.02,100),g=new CameraClearance(),wanted=vec(3,1,0);assert.ok(g.resolve(p,vec(0,1,0),wanted,camera).distanceTo(wanted)<1e-7);p.world.free();
});
test('free overview keeps its requested distance while follow/chase respects wall occlusion',async()=>{
 const p=await fixture();p.world.createCollider(RAPIER.ColliderDesc.cuboid(.05,2,3).setTranslation(1,1,0));refresh(p);
 const camera=new T.PerspectiveCamera(50,16/9,.1,100),g=new CameraClearance(),o=vec(0,1,0),wanted=vec(8,3,2);
 assert.ok(g.resolve(p,o,wanted,camera,{occlusion:false}).distanceTo(wanted)<1e-8);assert.ok(g.resolve(p,o,wanted,camera,{occlusion:true}).x<1);p.world.free();
});
test('camera sweep respects the exact two-sided triangles of a rotated legacy wall',async()=>{
 const p=await fixture(),mesh=new T.Mesh(new T.PlaneGeometry(3,3));mesh.position.set(1,1,0);mesh.rotation.y=Math.PI/2;mesh.userData.label='thin partition';const scene=new T.Scene();scene.add(mesh);scene.updateMatrixWorld(true);p.environment([mesh]);refresh(p);
 const camera=new T.PerspectiveCamera(50,1,.03,100),g=new CameraClearance();assert.ok(g.resolve(p,vec(0,1,0),vec(3,1,0),camera).x<1-g.radius);assert.ok(g.resolve(p,vec(2,1,0),vec(-1,1,0),camera).x>1+g.radius);p.world.free();
});
