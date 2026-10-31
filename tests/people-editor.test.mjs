import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {parseGeometry,glbParts} from '../tools/human-gltf-tools.mjs';
import {prepareHumans,createRealisticHuman,HUMAN_CATALOG} from '../src/realistic-human.js';
import {readTransform,writeTransform,validateTransform,TransformHistory} from '../src/scene-transform.js';

test('offline human GLBs retain rig, authored clips, embedded 1K textures and hashes',()=>{
  const sources=JSON.parse(readFileSync(new URL('../public/visual/humans/sources.json',import.meta.url)));
  assert.equal(sources.length,3);
  for(const source of sources){const {doc,bytes}=glbParts(new URL('../public/visual/humans/'+source.file,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),source.sha256);
    assert.equal(source.license,'CC0-1.0');assert.ok(source.texture_sizes.every(s=>Math.max(...s)<=1024));
    assert.ok((doc.images||[]).every(i=>i.bufferView!==undefined&&!i.uri));
    assert.ok((doc.buffers||[]).every(b=>!b.uri));
    if(source.id!=='researcher'){assert.ok(doc.skins[0].joints.length>=50);assert.ok(doc.animations.some(a=>a.name==='Walk_Carry'))}
    if(source.id==='sam')assert.ok(doc.animations.some(a=>a.name==='Sit_Stand'));
  }
});

test('independent textured-character rigs animate and sit without sharing bones or materials',async()=>{
  const parsed={};for(const id of ['sam','maya'])parsed[id]=await parseGeometry(new URL('../public/visual/humans/'+id+'.glb',import.meta.url));
  await prepareHumans({baseURL:'https://offline.test/',loader:{loadAsync:async url=>parsed[url.includes('maya')?'maya':'sam']}});
  const a=createRealisticHuman({character:'sam'}),b=createRealisticHuman({character:'sam'}),female=createRealisticHuman({character:'maya'});
  assert.ok(a.realistic&&female.realistic);assert.notEqual(a.mats.sh,b.mats.sh);
  const am=a.meshes.find(m=>m.isSkinnedMesh),bm=b.meshes.find(m=>m.isSkinnedMesh);
  assert.notEqual(am.skeleton.bones[0],bm.skeleton.bones[0]);
  const before=am.skeleton.bones.map(o=>o.quaternion.toArray());
  a.pose(1.8,1);assert.ok(am.skeleton.bones.some((o,i)=>o.quaternion.toArray().some((v,j)=>Math.abs(v-before[i][j])>1e-4)));
  const vertexIndex=Math.floor(am.geometry.attributes.position.count/2),point=new THREE.Vector3().fromBufferAttribute(am.geometry.attributes.position,vertexIndex);am.boneTransform(vertexIndex,point);assert.ok(point.toArray().every(Number.isFinite));
  a.sit(.46);assert.ok(am.skeleton.bones.every(o=>o.position.toArray().every(Number.isFinite)));
  a.stand();assert.ok(am.skeleton.bones.every((o,i)=>o.quaternion.toArray().every((v,j)=>Math.abs(v-before[i][j])<1e-6)));
  assert.deepEqual(bm.skeleton.bones.map(o=>o.quaternion.toArray()),before);
  assert.equal(HUMAN_CATALOG.length,6);
});

test('full transforms round-trip including tilted non-uniformly scaled objects',()=>{
  const o=new THREE.Group();o.position.set(1,.5,-2);o.rotation.set(.4,.8,.2);o.scale.set(.8,1.3,2);
  const saved=readTransform(o),other=new THREE.Group();writeTransform(other,saved);assert.deepEqual(readTransform(other),saved);
  for(const bad of [{...saved,scale:[0,1,1]},{...saved,position:[Infinity,0,0]},{...saved,quaternion:[0,0,0,0]},{...saved,position:[0,11,0]}])assert.throws(()=>validateTransform(bad));
});

test('undo / redo applies the right transforms, preserves failed history and clears branched redo',async()=>{
  const history=new TransformHistory(2),o=new THREE.Group(),a=readTransform(o);o.position.x=2;const b=readTransform(o);history.record('chair',a,b);
  await history.move('undo',async(id,t)=>{assert.equal(id,'chair');writeTransform(o,t)});assert.equal(o.position.x,0);
  await history.move('redo',async(id,t)=>writeTransform(o,t));assert.equal(o.position.x,2);
  await assert.rejects(history.move('undo',async()=>{throw Error('save failed')}));assert.equal(history.undoStack.length,1);
  await history.move('undo',async(id,t)=>writeTransform(o,t));o.position.z=1;history.record('chair',a,readTransform(o));assert.equal(history.redoStack.length,0);
});
