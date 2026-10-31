import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {parseGeometry} from '../tools/human-gltf-tools.mjs';
import {prepareHumans,createRealisticHuman} from '../src/realistic-human.js';
import {enableAnimatedCulling,beginRaycastFrame} from '../src/raycast-acceleration.js';
import {skinnedWorldBounds} from '../src/skinned-raycast.js';
import {captureSkin} from '../src/skin-snapshot.js';
const parsed={};for(const id of ['sam','maya'])parsed[id]=await parseGeometry(new URL('../public/visual/humans/'+id+'.glb',import.meta.url));
await prepareHumans({baseURL:'https://offline.test/',loader:{loadAsync:async url=>parsed[url.includes('maya')?'maya':'sam']}});

test('animated culling bounds contain every posed vertex for both rigs, seated and walking',()=>{
 for(const character of ['sam','maya']){
  const rig=createRealisticHuman({character}),scene=new T.Scene();scene.add(rig.g);rig.g.scale.set(1.15,.9,.8);rig.g.rotation.y=.7;rig.g.position.set(3,.2,-4);enableAnimatedCulling(scene);
  for(const pose of ['walk','sit']){
   if(pose==='walk')rig.animate({dt:.04,distance:.05,speed:1.25});else rig.action(.9,.49);
   scene.updateMatrixWorld(true);beginRaycastFrame();
   for(const mesh of rig.meshes){if(!mesh.isSkinnedMesh)continue;assert.ok(mesh.frustumCulled);const box=skinnedWorldBounds(mesh,pose),baked=captureSkin(mesh).bake(),p=baked.attributes.position,v=new T.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);assert.ok(box.containsPoint(v),character+' '+pose+' vertex '+i)}baked.dispose()}
  }
 }
});

test('camera and shadow frustums use current posed bounds without confusing shared character geometry',()=>{
 const scene=new T.Scene(),a=createRealisticHuman(),b=createRealisticHuman();scene.add(a.g,b.g);a.g.position.set(0,0,-3);b.g.position.set(20,0,-3);enableAnimatedCulling(scene);scene.updateMatrixWorld(true);beginRaycastFrame();
 const camera=new T.PerspectiveCamera(70,1,.01,30);camera.position.y=.9;camera.updateMatrixWorld(true);
 const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 assert.ok(a.meshes.some(m=>frustum.intersectsObject(m)));assert.ok(b.meshes.every(m=>!frustum.intersectsObject(m)));
 b.g.position.x=0;b.g.position.z=-5;scene.updateMatrixWorld(true);beginRaycastFrame();assert.ok(b.meshes.some(m=>frustum.intersectsObject(m)));
 const light=new T.OrthographicCamera(-25,25,25,-25,.01,60);light.position.set(0,15,0);light.lookAt(0,0,-3);light.updateMatrixWorld(true);const shadow=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(light.projectionMatrix,light.matrixWorldInverse));assert.ok(a.meshes.every(m=>shadow.intersectsObject(m)));
 a.meshes[0].morphTargetInfluences=[1];assert.equal(frustum.intersectsObject(a.meshes[0]),true,'unsupported animated morphs stay visible');
});
