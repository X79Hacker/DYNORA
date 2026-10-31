import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {SensorRayIndex} from '../src/sensor-ray-index.js';
import {beginRaycastFrame} from '../src/raycast-acceleration.js';

function same(index, objects, ray) {
  const expected=ray.intersectObjects(objects,false)[0], far=ray.far, actual=index.nearest(ray);
  assert.equal(ray.far,far); assert.equal(actual?.object,expected?.object);
  if(expected){assert.ok(Math.abs(actual.distance-expected.distance)<1e-8);assert.equal(actual.faceIndex,expected.faceIndex)}
  return actual;
}

test('sensor broad phase matches triangle hits on dense, rotated and scaled room surfaces',()=>{
  const scene=new T.Scene(),objects=[];
  for(let i=0;i<180;i++){const m=new T.Mesh(new T.BoxGeometry(.17,.7,.26),new T.MeshBasicMaterial());m.position.set((i%18-9)*.6,.35,-Math.floor(i/18)*.7);m.rotation.y=i*.13;m.scale.set(.6+i%3,.9,1.1);scene.add(m);objects.push(m)}
  const wall=new T.Mesh(new T.PlaneGeometry(15,3,55,20),new T.MeshBasicMaterial({side:T.DoubleSide}));wall.position.set(0,1,-8);objects.push(wall);scene.add(wall);scene.updateMatrixWorld(true);
  const index=new SensorRayIndex().update(objects);
  for(let k=0;k<100;k++){const a=k*.073,ray=new T.Raycaster(new T.Vector3(.3,.14,.2),new T.Vector3(Math.cos(a),.04,-Math.sin(a)).normalize(),.015,k%3===0?2:15);same(index,objects,ray)}
  const ray=new T.Raycaster(new T.Vector3(.3,.14,.2),new T.Vector3(1,0,0),0,2);same(index,objects,ray);assert.ok(index.tested<objects.length/5);
});

test('moving, replacing, removing and editing a sensor surface takes effect on the next update',()=>{
  const scene=new T.Scene(),parent=new T.Group(),m=new T.Mesh(new T.BoxGeometry(.5,.5,.5),new T.MeshBasicMaterial());scene.add(parent);parent.add(m);m.position.z=-1;let objects=[m];const index=new SensorRayIndex(),ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,0,-1),0,5);
  const check=()=>{scene.updateMatrixWorld(true);index.update(objects);return same(index,objects,ray)};
  assert.ok(check());parent.position.x=2;assert.equal(check(),null);parent.position.x=0;assert.ok(check());
  const a=m.geometry.attributes.position;for(let i=0;i<a.count;i++)a.setZ(i,a.getZ(i)-2);a.needsUpdate=true;assert.ok(check().distance>2);
  m.geometry=new T.SphereGeometry(.2,30,20);assert.ok(check().distance<1);objects=[];assert.equal(check(),null);objects=[m];assert.ok(check());
});

test('posed skins and morph targets retain exact raycasts, and source layers stay pickable',()=>{
  const g=new T.BoxGeometry(.4,.4,.4),n=g.attributes.position.count,weights=new Float32Array(n*4);for(let i=0;i<n;i++)weights[i*4]=1;
  g.setAttribute('skinIndex',new T.Uint16BufferAttribute(new Uint16Array(n*4),4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
  const m=new T.SkinnedMesh(g,new T.MeshBasicMaterial()),bone=new T.Bone();m.add(bone);m.bind(new T.Skeleton([bone]));bone.position.x=1;m.position.z=-1;
  const scene=new T.Scene();scene.add(m);scene.updateMatrixWorld(true);beginRaycastFrame();const index=new SensorRayIndex().update([m]),ray=new T.Raycaster(new T.Vector3(1,0,0),new T.Vector3(0,0,-1),0,3);assert.ok(same(index,[m],ray));
  const rigid=new T.Mesh(new T.BoxGeometry(.3,.3,.3),new T.MeshBasicMaterial());rigid.position.set(1,0,-.5);rigid.layers.set(2);scene.add(rigid);scene.updateMatrixWorld(true);index.update([m,rigid]);assert.equal(same(index,[m,rigid],ray).object,rigid);assert.equal(ray.layers.mask,1);
  const morph=new T.Mesh(new T.BoxGeometry(.2,.2,.2),new T.MeshBasicMaterial());morph.morphTargetInfluences=[.5];morph.raycast=(_r,hits)=>hits.push({object:morph,distance:.1,faceIndex:0});index.update([morph]);assert.equal(index.nearest(ray).object,morph);
});

test('equal-distance hits preserve original object order and ray state is restored after an error',()=>{
  const a=new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshBasicMaterial()),b=a.clone();a.position.z=b.position.z=-2;a.updateMatrixWorld();b.updateMatrixWorld();
  const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,0,-1),0,5),index=new SensorRayIndex();index.update([b,a]);assert.equal(same(index,[b,a],ray).object,b);
  const broken={raycast(){throw Error('bad sensor surface')},layers:new T.Layers(),children:[]};index.update([a,broken]);assert.throws(()=>index.nearest(ray),/bad sensor surface/);assert.equal(ray.far,5);
});
