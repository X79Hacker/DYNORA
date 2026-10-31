import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {parseGeometry} from '../tools/human-gltf-tools.mjs';
import {prepareHumans,createRealisticHuman} from '../src/realistic-human.js';
import {captureSkin} from '../src/skin-snapshot.js';
import {beginRaycastFrame,originalMeshRaycast,warmRaycasts} from '../src/raycast-acceleration.js';
import {rayIntersectsRangeBox,skinnedRayStatistics} from '../src/skinned-raycast.js';
import {renderDisplayFrame} from '../src/render-frame.js';
import {WebGLInfo} from 'three/src/renderers/webgl/WebGLInfo.js';
const parsed={};for(const id of ['sam','maya'])parsed[id]=await parseGeometry(new URL('../public/visual/humans/'+id+'.glb',import.meta.url));
await prepareHumans({baseURL:'https://offline.test/',loader:{loadAsync:async url=>parsed[url.includes('maya')?'maya':'sam']}});

test('range-box clipping handles near/far, an origin inside, parallel and backward rays',()=>{
 const box=new T.Box3(new T.Vector3(-1,-1,-4),new T.Vector3(1,1,-3)),ray=new T.Ray(new T.Vector3(),new T.Vector3(0,0,-1));
 assert.equal(rayIntersectsRangeBox(ray,box,0,2),false);assert.equal(rayIntersectsRangeBox(ray,box,0,3),true);assert.equal(rayIntersectsRangeBox(ray,box,4.1,10),false);ray.origin.z=-3.5;assert.equal(rayIntersectsRangeBox(ray,box,0,.1),true);ray.origin.x=2;assert.equal(rayIntersectsRangeBox(ray,box,0,10),false);ray.origin.set(0,0,0);ray.direction.z=1;assert.equal(rayIntersectsRangeBox(ray,box,0,10),false);
});
test('a detailed person beyond ToF range skins zero vertices',async()=>{
 const scene=new T.Scene(),rig=createRealisticHuman();rig.g.position.x=4;scene.add(rig.g);await warmRaycasts(scene);rig.animate({dt:.016,speed:.7,distance:.012});scene.updateMatrixWorld(true);beginRaycastFrame();const ray=new T.Raycaster(new T.Vector3(0,.0675,0),new T.Vector3(1,0,0),0,2);assert.equal(ray.intersectObjects(rig.meshes,false).length,0);assert.ok(rig.meshes.reduce((s,m)=>s+m.geometry.attributes.position.count,0)>60000);assert.ok(rig.meshes.every(m=>skinnedRayStatistics(m).posed_vertices===0));
});
test('animated ray hits match full frozen meshes for Sam/Maya, walk/sit, both sides and nonuniform scales',async()=>{
 let comparisons=0;
 for(const id of ['sam','maya']){const scene=new T.Scene(),rig=createRealisticHuman({character:id});scene.add(rig.g);rig.g.rotation.y=.23;rig.g.scale.set(1.15,.9,.82);await warmRaycasts(scene);
  for(const pose of ['walk','sit']){if(pose==='walk')rig.animate({dt:.04,distance:.045,speed:1});else rig.action(.85,.505);scene.updateMatrixWorld(true);beginRaycastFrame();const proxies=rig.meshes.map(m=>{const proxy=new T.Mesh(captureSkin(m).bake(),m.material);proxy.matrixAutoUpdate=false;proxy.matrixWorld.copy(m.matrixWorld);return proxy});
   for(let i=0;i<60;i++){const y=.04+(i%15)*.112,z=(Math.floor(i/15)-1.5)*.135+.019,reverse=i%2===0,rc=new T.Raycaster(new T.Vector3(reverse?2:-2,y,z),new T.Vector3(reverse?-1:1,0,0),.01,5),fast=rc.intersectObjects(rig.meshes,false),slow=[];for(const m of proxies)originalMeshRaycast().call(m,rc,slow);slow.sort((a,b)=>a.distance-b.distance);assert.equal(fast.length,slow.length,`${id} ${pose} ray ${i}`);for(let k=0;k<fast.length;k++){assert.ok(Math.abs(fast[k].distance-slow[k].distance)<3e-6,`${id} ${pose} distance`);assert.equal(fast[k].faceIndex,slow[k].faceIndex);if(fast[k].uv)assert.ok(fast[k].uv.distanceTo(slow[k].uv)<1e-5)}comparisons++}
   proxies.forEach(m=>m.geometry.dispose());
  }
 }assert.equal(comparisons,240);
});

function displayFixture(){const scene=new T.Scene(),camera=new T.PerspectiveCamera(),robotCamera=new T.PerspectiveCamera(),objects=Array.from({length:4},()=>new T.Group());scene.add(...objects);objects[0].visible=false;let target=null,shadows=0,matrixUpdates=0,mode=0;const views=[],renderer={info:new WebGLInfo({TRIANGLES:4}),shadowMap:{autoUpdate:true,needsUpdate:false},getRenderTarget:()=>target,setRenderTarget:t=>target=t,setScissorTest(){},setViewport(){},setScissor(){},render(s,c){if(s.autoUpdate){s.updateMatrixWorld();matrixUpdates++}if(this.shadowMap.autoUpdate||this.shadowMap.needsUpdate){shadows++;this.info.update(6,4,1);this.shadowMap.needsUpdate=false}this.info.update(3,4,1);views.push({camera:c,mode,visible:objects.map(o=>o.visible)})}};const update=scene.updateMatrixWorld.bind(scene);scene.updateMatrixWorld=()=>{matrixUpdates++;return update()};const options={renderer,scene,camera,robotCamera,path:objects[0],lidar:objects[1],fov:objects[2],robot:objects[3],width:1200,height:800,preview:()=>({left:900,bottom:300,width:280,height:160}),cameraMode:on=>mode+=on?1:-1};return{options,objects,views,stats:()=>({shadows,matrixUpdates,mode,target})}}
test('main, preview and capture share one fresh shadow pass without leaking helper visibility or capture aspect',()=>{
 const f=displayFixture(),o=f.options;renderDisplayFrame({...o,capture:()=>{o.renderer.render(o.scene,o.robotCamera);o.robotCamera.aspect=99}});assert.equal(f.stats().shadows,1);assert.equal(f.stats().matrixUpdates,1);assert.equal(f.views.length,3);assert.equal(o.renderer.info.render.calls,4);assert.equal(o.renderer.info.render.frame,1);assert.equal(o.renderer.info.autoReset,true);assert.equal(f.views[1].visible[3],true);assert.ok([f.views[0],f.views[2]].every(v=>v.visible.every(x=>!x)&&v.mode===1));assert.deepEqual(f.objects.map(x=>x.visible),[false,true,true,true]);assert.equal(o.robotCamera.aspect,280/160);assert.equal(o.scene.autoUpdate,true);assert.equal(o.renderer.shadowMap.autoUpdate,true);assert.equal(f.stats().mode,0);renderDisplayFrame(o);assert.equal(f.stats().shadows,2,'moving scene receives a fresh shadow every display frame');
});
test('an interrupted capture restores renderer state, and hidden preview still records an opaque clean camera pass',()=>{
 const f=displayFixture(),o=f.options;assert.throws(()=>renderDisplayFrame({...o,botView:true,preview:()=>null,capture:()=>{assert.ok(f.objects.every(x=>!x.visible));o.renderer.setRenderTarget({});throw Error('capture failed')}}),/capture failed/);assert.equal(f.stats().target,null);assert.equal(f.stats().mode,0);assert.equal(o.scene.autoUpdate,true);assert.equal(o.renderer.shadowMap.autoUpdate,true);assert.deepEqual(f.objects.map(x=>x.visible),[false,true,true,true]);
});
test('depth workspace submits one camera view at the visible feed aspect and restores full-canvas state',()=>{
 const f=displayFixture(),o=f.options,viewports=[],scissors=[];let clears=0,scissor=false,aspect;
 o.renderer.clear=()=>clears++;o.renderer.setViewport=(...v)=>viewports.push(v);o.renderer.setScissor=(...v)=>scissors.push(v);o.renderer.setScissorTest=v=>scissor=v;
 renderDisplayFrame({...o,botView:true,primaryViewport:{left:96,top:124,bottom:772,width:728,height:648},preview:()=>null,capture:()=>{aspect=o.robotCamera.aspect}});
 assert.equal(f.views.length,1);assert.equal(clears,1);assert.equal(aspect,1,'offscreen capture runs before the visible feed changes its aspect');assert.deepEqual(scissors,[[96,28,728,648]]);assert.deepEqual(viewports.at(-1),[0,0,1200,800]);assert.equal(scissor,false);assert.equal(f.stats().shadows,1);assert.equal(o.robotCamera.aspect,728/648);assert.ok(f.views[0].visible.every(x=>!x));assert.equal(f.stats().mode,0);
});
