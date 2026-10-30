import * as T from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

const identity={x:0,y:0,z:0,w:1};
// Enclose the entire near plane, including its corners. A centre ray alone lets
// the edge of the image cut through a wall while the lens is still outside it.
export function cameraClearanceRadius(camera,margin=.006){
 const y=camera.near*Math.tan(camera.fov*Math.PI/360);
 return Math.hypot(camera.near,y,y*camera.aspect)+margin;
}

export class CameraClearance{
 constructor(){this.delta=new T.Vector3();this.point=new T.Vector3();this.length=null;this.ball=null;this.radius=0;this.queries=0;this.adjusted=false;}
 resolve(physics,origin,wanted,camera,{dt=1/60,smooth=false,margin=.006,occlusion=true}={}){
  this.point.copy(wanted);this.adjusted=false;this.queries=0;
  if(!physics?.ready||!physics.world||!physics.steps){this.length=null;return this.point}
  const radius=cameraClearanceRadius(camera,margin);
  if(radius!==this.radius){this.radius=radius;this.ball=new RAPIER.Ball(radius)}
  const world=physics.world,exclude=physics.robotBody;
  this.delta.subVectors(wanted,origin);const distance=this.delta.length();
  let allowed=distance;
  if(occlusion&&distance>1e-8){
   this.delta.divideScalar(distance);this.queries++;
   const hit=world.castShape(origin,identity,this.delta,this.ball,.001,distance,false,undefined,undefined,undefined,exclude);
   if(hit)allowed=Math.max(0,Math.min(distance,hit.time_of_impact-.002));
   // Pull in immediately. Ease only the return to the user's requested distance.
   if(smooth&&this.length!==null&&allowed>this.length)allowed=Math.min(allowed,this.length+(allowed-this.length)*(1-Math.exp(-8*Math.min(.1,Math.max(0,dt)))));
   this.point.copy(origin).addScaledVector(this.delta,allowed);
  }
  // A moving prop or an editor placement can start around the camera. Resolve
  // that overlap as well; no render-mesh traversal or extra world step is needed.
  for(let pass=0;pass<4;pass++){
   let moved=false;this.queries++;
   world.intersectionsWithShape(this.point,identity,this.ball,collider=>{
    const contact=collider.contactShape(this.ball,this.point,identity,0);
    if(contact&&contact.distance<-.00001){this.point.addScaledVector(contact.normal1,-contact.distance+.001);moved=true}
    return true;
   },undefined,undefined,undefined,exclude);
   if(!moved)break;
  }
  this.length=this.point.distanceTo(origin);this.adjusted=this.point.distanceToSquared(wanted)>1e-8;
  return this.point;
 }
}

// The configured optical mount is retained separately, so a transient clearance
// correction cannot accumulate or silently change the user's calibration.
export class MountedCameraClearance{
 constructor(robot,camera){this.robot=robot;this.camera=camera;this.guard=new CameraClearance();this.wanted=new T.Vector3();this.origin=new T.Vector3();this.local=new T.Vector3();this.configured=camera.position.clone();}
 setMount(position){this.configured.copy(position)}
 update(physics){
  this.robot.updateWorldMatrix(true,false);
  this.wanted.copy(this.configured).applyMatrix4(this.robot.matrixWorld);
  this.origin.set(0,this.configured.y,0).applyMatrix4(this.robot.matrixWorld);
  const safe=this.guard.resolve(physics,this.origin,this.wanted,this.camera,{margin:.001});
  this.local.copy(safe);this.robot.worldToLocal(this.local);this.camera.position.copy(this.local);this.camera.updateMatrixWorld(true);
 }
 metadata(){return{configured_body_xyz_m:[this.configured.x,-this.configured.z,this.configured.y],effective_body_xyz_m:[this.camera.position.x,-this.camera.position.z,this.camera.position.y],clearance_adjusted:this.guard.adjusted,near_m:this.camera.near,clearance_radius_m:this.guard.radius};}
}
