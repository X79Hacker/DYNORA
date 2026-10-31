import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {DepthSnapshot,depthAtPoint,cameraForViewport} from '../src/depth-core.js';
import {DepthGuides,guidePoints,makeDepthAnchor,resolveDepthAnchor} from '../src/depth-guides.js';
function fixture(){const scene=new T.Scene(),camera=new T.PerspectiveCamera(65,1,.01,30),target=new T.Mesh(new T.BoxGeometry(.5,1,.2));target.position.set(.4,0,-3);target.userData.label='Table leg';scene.add(target);camera.updateMatrixWorld(true);return{scene,camera,target}}
function reading(scene,camera,target){scene.updateMatrixWorld(true);const pixel=new T.Vector3().setFromMatrixPosition(target.matrixWorld).project(camera),snap=new DepthSnapshot(scene),hit=snap.point(camera,(pixel.x+1)/2,(1-pixel.y)/2);snap.dispose();return {kind:'point',...hit}}
test('dashed range and Z endpoints are measured from the actual optical centre',()=>{
 const camera=new T.PerspectiveCamera();camera.position.set(1,2,3);camera.rotation.y=.4;camera.updateMatrixWorld(true);const world=new T.Vector3(.6,-.3,-2).applyMatrix4(camera.matrixWorld),reading=depthAtPoint(camera,world),g=guidePoints(camera,reading);assert.ok(Math.abs(g.range-Math.hypot(.6,.3,2))<1e-10);assert.ok(Math.abs(g.z-2)<1e-10);assert.ok(Math.abs(g.lateral-Math.hypot(.6,.3))<1e-10);assert.ok(g.origin.distanceTo(camera.position)<1e-10);assert.ok(g.axis.clone().sub(g.origin).dot(g.point.clone().sub(g.axis))<1e-10);
});
test('guides are dashed 3D editor geometry, can be hidden and never appear as measured surfaces',()=>{
 const {scene,camera,target}=fixture(),hit=reading(scene,camera,target),guide=new DepthGuides(scene);guide.update(camera,hit);assert.equal(guide.group.visible,true);assert.equal(guide.range.material.isLineDashedMaterial,true);assert.ok(guide.range.geometry.attributes.lineDistance.count===2);assert.ok(guide.range.geometry.attributes.position.count===2);assert.ok(guide.ticks.geometry.attributes.position.count>0);let snap=new DepthSnapshot(scene);assert.ok(snap.meshes.every(m=>!m.userData.original.userData.editorAuxiliary));assert.equal(snap.meshes.length,1);snap.dispose();guide.update(camera,hit,{visible:false});assert.equal(guide.group.visible,false);guide.dispose();assert.equal(scene.children.length,1);
});
test('live depth follows a camera translation while the selected surface point stays pinned',()=>{
 const {scene,camera,target}=fixture(),hit=reading(scene,camera,target),anchor=makeDepthAnchor(scene,hit);camera.position.z=-.5;camera.updateMatrixWorld(true);const snap=new DepthSnapshot(scene),live=resolveDepthAnchor(scene,camera,anchor,snap);snap.dispose();assert.equal(live.visibility,'visible');assert.ok(Math.abs(live.z_depth_m-(hit.z_depth_m-.5))<1e-9);assert.deepEqual(live.world_xyz_m,hit.world_xyz_m);
});
test('live depth follows a moved target through its local surface coordinates',()=>{
 const {scene,camera,target}=fixture(),hit=reading(scene,camera,target),anchor=makeDepthAnchor(scene,hit);target.position.z=-4;const snap=new DepthSnapshot(scene),live=resolveDepthAnchor(scene,camera,anchor,snap);snap.dispose();assert.equal(live.visibility,'visible');assert.ok(Math.abs(live.z_depth_m-hit.z_depth_m-1)<1e-9);
});
test('live target is invalid when occluded, outside view or removed',()=>{
 const {scene,camera,target}=fixture(),hit=reading(scene,camera,target),anchor=makeDepthAnchor(scene,hit),blocker=new T.Mesh(new T.BoxGeometry(3,3,.1));blocker.position.z=-1;scene.add(blocker);let snap=new DepthSnapshot(scene);assert.equal(resolveDepthAnchor(scene,camera,anchor,snap).visibility,'occluded');snap.dispose();scene.remove(blocker);camera.rotation.y=Math.PI;camera.updateMatrixWorld(true);snap=new DepthSnapshot(scene);assert.equal(resolveDepthAnchor(scene,camera,anchor,snap).visibility,'outside_view');snap.dispose();scene.remove(target);snap=new DepthSnapshot(scene);assert.equal(resolveDepthAnchor(scene,camera,anchor,snap).visibility,'removed');snap.dispose();
});
test('live tracking uses world transforms of nested, scaled targets',()=>{
 const {scene,camera,target}=fixture(),parent=new T.Group();scene.remove(target);parent.position.set(.1,0,-.3);parent.scale.set(1.2,.8,1.1);parent.add(target);scene.add(parent);const cam=cameraForViewport(camera,900,600),hit=reading(scene,cam,target),anchor=makeDepthAnchor(scene,hit);parent.position.z-=.4;let snap=new DepthSnapshot(scene);const live=resolveDepthAnchor(scene,cam,anchor,snap);snap.dispose();assert.equal(live.visibility,'visible');assert.ok(Math.abs(live.z_depth_m-hit.z_depth_m-.4)<1e-9);
});
