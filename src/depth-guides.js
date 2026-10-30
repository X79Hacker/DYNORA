import * as THREE from 'three';
import {depthAtPoint} from './depth-core.js';

export function guidePoints(camera,reading){
 const origin=new THREE.Vector3(...reading.camera_origin_m),point=new THREE.Vector3(...reading.world_xyz_m),forward=new THREE.Vector3(0,0,-1).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion())),axis=origin.clone().addScaledVector(forward,reading.z_depth_m);
 return {origin,point,axis,range:origin.distanceTo(point),z:origin.distanceTo(axis),lateral:axis.distanceTo(point)};
}
export function makeDepthAnchor(scene,reading){
 const hit=reading.kind==='region'?reading.anchor:reading;if(!hit)return null;
 const object=scene.getObjectByProperty('uuid',hit.mesh_id);if(!object)return null;object.updateWorldMatrix(true,false);
 const local=new THREE.Vector3(...hit.world_xyz_m).applyMatrix4(new THREE.Matrix4().copy(object.matrixWorld).invert());
 return {mesh_id:hit.mesh_id,geometry_id:hit.geometry_id||object.geometry.uuid,local_point:hit.local_point_m||local.toArray(),face_index:hit.face_index,surface:hit.surface};
}
export function resolveDepthAnchor(scene,camera,anchor,snapshot){
 const object=scene.getObjectByProperty('uuid',anchor.mesh_id);if(!object?.parent||object.geometry.uuid!==anchor.geometry_id)return {visibility:'removed',surface:anchor.surface};
 object.updateWorldMatrix(true,false);let node=object;while(node){if(!node.visible)return {visibility:'hidden',surface:anchor.surface};node=node.parent}
 // A live target is tied to its rigid surface coordinates. Animated skins need
 // a new triangle snapshot rather than pretending this point follows a bone.
 if(object.isSkinnedMesh)return {visibility:'animated_surface',surface:anchor.surface};
 const point=new THREE.Vector3(...anchor.local_point).applyMatrix4(object.matrixWorld),pixel=point.clone().project(camera),reading={kind:'point',...depthAtPoint(camera,point),u:(pixel.x+1)/2,v:(1-pixel.y)/2,mesh_id:anchor.mesh_id,surface:anchor.surface,face_index:anchor.face_index};
 if(reading.range_m>(snapshot.maxRange??Infinity))return {...reading,visibility:'out_of_range'};
 if(reading.z_depth_m<=camera.near||reading.z_depth_m>camera.far||reading.u<0||reading.u>1||reading.v<0||reading.v>1)return {...reading,visibility:'outside_view'};
 const hit=snapshot.point(camera,reading.u,reading.v),visible=hit?.mesh_id===anchor.mesh_id&&Math.abs(hit.range_m-reading.range_m)<.006;
 return {...reading,normal_world:visible?hit.normal_world:null,visibility:visible?'visible':'occluded'};
}

export class DepthGuides{
 constructor(scene){
  this.group=new THREE.Group();this.group.name='Depth measurement guides';this.group.userData.noDepth=true;this.group.userData.editorAuxiliary=true;scene.add(this.group);this.group.visible=false;
  const line=(color,dashed=true)=>{const material=dashed?new THREE.LineDashedMaterial({color,dashSize:.045,gapSize:.025,depthTest:true}):new THREE.LineBasicMaterial({color});const l=new THREE.Line(new THREE.BufferGeometry(),material);l.layers.set(1);this.group.add(l);return l};
  this.range=line(0xffc465);this.axis=line(0x51cbff);this.lateral=line(0xc5a0ff);this.normal=line(0x50efad,false);
  this.ticks=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xffe0a0}));this.ticks.layers.set(1);this.group.add(this.ticks);
  this.markers=new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial({color:0xffffff,size:7,sizeAttenuation:false}));this.markers.layers.set(1);this.group.add(this.markers);
 }
 update(camera,reading,{visible=true,normal=true}={}){
  this.group.visible=!!visible&&!!reading?.world_xyz_m;if(!this.group.visible)return;
  const key=JSON.stringify([camera.matrixWorld.elements,reading.world_xyz_m,reading.camera_origin_m,reading.normal_world,normal]);if(this.lastKey===key)return;this.lastKey=key;
  const {origin,point,axis,range}=guidePoints(camera,reading),set=(line,points)=>{const attribute=line.geometry.attributes.position;if(attribute?.count===points.length){for(let i=0;i<points.length;i++)attribute.setXYZ(i,points[i].x,points[i].y,points[i].z);attribute.needsUpdate=true;line.geometry.computeBoundingSphere()}else line.geometry.setFromPoints(points);if(line.material.isLineDashedMaterial)line.computeLineDistances()};
  set(this.range,[origin,point]);set(this.axis,[origin,axis]);set(this.lateral,[axis,point]);this.normal.visible=normal&&!!reading.normal_world;
  if(this.normal.visible)set(this.normal,[point,point.clone().addScaledVector(new THREE.Vector3(...reading.normal_world),.12)]);
  const direction=point.clone().sub(origin).normalize(),side=new THREE.Vector3(0,1,0).cross(direction).normalize();if(side.lengthSq()<.1)side.set(1,0,0);
  const positions=[],spacing=range>3?.5:range>1?.25:.1;for(let d=spacing;d<range;d+=spacing){const p=origin.clone().addScaledVector(direction,d);positions.push(p.clone().addScaledVector(side,-.012),p.clone().addScaledVector(side,.012))}
  set(this.ticks,positions);set(this.markers,[origin,axis,point]);
 }
 hide(){this.group.visible=false}
 dispose(){this.group.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});this.group.parent?.remove(this.group)}
}
