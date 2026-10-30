import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {parseGeometry} from '../tools/human-gltf-tools.mjs';
import {prepareHumans,createRealisticHuman} from '../src/realistic-human.js';
import {HumanController,HumanNavigation,sceneSeats} from '../src/human-actions.js';
import {createFurniture} from '../src/visual-models.js';
const parsed={};for(const id of ['sam','maya'])parsed[id]=await parseGeometry(new URL('../public/visual/humans/'+id+'.glb',import.meta.url));
await prepareHumans({baseURL:'https://offline.test/',loader:{loadAsync:async url=>parsed[url.includes('maya')?'maya':'sam']}});
const V=a=>new THREE.Vector3(...a),dist=(a,b)=>V(a).distanceTo(V(b));
function fixture(id='sofa',character='sam'){
 const scene=new THREE.Scene(),furniture=createFurniture(id),obstacles=[];scene.add(furniture);furniture.traverse(m=>{if(m.isMesh)obstacles.push(m)});
 const rig=createRealisticHuman({character}),object=rig.g;object.position.set(-1.6,0,1.8);scene.add(object);
 const navigation=new HumanNavigation(obstacles,scene),controller=new HumanController({object,rig,navigation,seats:()=>sceneSeats(scene)});
 return {scene,furniture,rig,object,navigation,controller};
}
function stableLegs(rig){const j=rig.joints();for(const[s,i]of [['l',0],['r',1]]){assert.ok(Math.abs(dist(j['thigh_'+s],j['calf_'+s])-rig.legLengths[i][0])<1e-5,'femur length preserved');assert.ok(Math.abs(dist(j['calf_'+s],j['foot_'+s])-rig.legLengths[i][1])<1e-5,'shin length preserved')}assert.ok(Object.values(j).flat().every(Number.isFinite));return j}
test('Sam and Maya approach, turn, lower onto each seat and stand with constant leg lengths',()=>{
 for(const character of ['sam','maya'])for(const type of ['sofa','dining-chair','office-chair','armchair','bar-stool','double-bed']){
  const {rig,controller:c,scene,object}=fixture(type,character),seat=sceneSeats(scene)[0],states=new Set();
  assert.ok(c.sit(seat.id),character+' '+type+' is reachable');let previous=null,previousState=null,maxPlantedMotion=0;
  for(let i=0;i<1500&&c.state!=='seated';i++){c.step(1/60);states.add(c.state);const j=stableLegs(rig);if(c.state==='sitting'&&previousState==='sitting'&&previous&&seat.footHeight===0)maxPlantedMotion=Math.max(maxPlantedMotion,dist(j.foot_l,previous.foot_l));previous=j;previousState=c.state}
  assert.equal(c.state,'seated',character+' '+type+' completes');for(const s of ['approaching','turning','sitting','seated'])assert.ok(states.has(s));
  assert.ok(maxPlantedMotion<.001,'feet remain planted during lowering');const j=stableLegs(rig);assert.ok(Math.abs(j.pelvis[1]-(seat.point.y+.105))<.001);assert.ok(j.foot_l[1]>=seat.floor+.05,'feet stay above floor');
  c.stand();for(let i=0;i<140;i++)c.step(1/60);assert.equal(c.state,'idle');assert.equal(c.seat,null);stableLegs(rig);assert.ok(object.position.distanceTo(seat.point.clone().addScaledVector(seat.front,.59).setY(seat.floor))<.001);c.dispose();
 }
});
test('distance-driven gait preserves limbs and stationary ground contacts at several speeds',()=>{
 for(const character of ['sam','maya'])for(const speed of [.2,.9,1.8]){
  const rig=createRealisticHuman({character});rig.g.rotation.y=.7;let previous=null,contacts=0,slip=0;const base=rig.joints().foot_l[1];
  for(let i=0;i<360;i++){const dx=speed/60;rig.g.position.x+=Math.cos(.7)*dx;rig.g.position.z-=Math.sin(.7)*dx;rig.animate({dt:1/60,speed,distance:dx});const j=stableLegs(rig);if(i>50&&previous&&Math.abs(j.foot_l[1]-base)<1e-5&&Math.abs(previous.foot_l[1]-base)<1e-5){contacts++;slip=Math.max(slip,dist(j.foot_l,previous.foot_l))}previous=j}
  assert.ok(contacts>70,'enough observed ground contacts');assert.ok(slip<.001,character+' '+speed+' planted foot error '+slip);
 }
});
test('navigation goes around furniture and rejects a destination inside a wall',()=>{
 const scene=new THREE.Scene(),wall=new THREE.Mesh(new THREE.BoxGeometry(.5,2,2));wall.position.y=1;scene.add(wall);const nav=new HumanNavigation([wall],scene),start=new THREE.Vector3(-2,0,0),goal=new THREE.Vector3(2,0,0),path=nav.plan(start,goal);assert.ok(path?.length>1);let from=start;for(const p of path){assert.ok(nav.segment(from,p));from=p}
 const person=new THREE.Group();scene.add(person);person.position.copy(start);const c=new HumanController({object:person,rig:{animate(){}},navigation:nav});assert.equal(c.moveTo(new THREE.Vector3(0,0,0)),false);assert.ok(c.moveTo(goal));for(let i=0;i<1000;i++){c.step(1/60);assert.ok(nav.free(person.position.x,person.position.z))}assert.equal(c.state,'idle');assert.ok(person.position.distanceTo(goal)<.05);
});
test('seat anchors follow moved and scaled furniture and reject tilted or reserved seats',()=>{
 const {scene,furniture,controller:c}=fixture();furniture.position.set(2,.1,-1);furniture.rotation.y=.6;furniture.scale.set(1.2,1.1,.9);let seat=sceneSeats(scene)[0];assert.ok(seat.point.distanceTo(furniture.localToWorld(new THREE.Vector3(-.47,.505,.045)))<1e-8);assert.ok(seat.front.dot(new THREE.Vector3(Math.sin(.6),0,Math.cos(.6)))>.999);furniture.rotation.z=.4;assert.equal(sceneSeats(scene).length,0);furniture.rotation.z=0;c.navigation.refresh();seat=sceneSeats(scene)[0];assert.ok(c.sit(seat.id));const other=new HumanController({object:new THREE.Group(),rig:{},navigation:c.navigation,seats:()=>sceneSeats(scene)});assert.equal(other.sit(seat.id),false);c.dispose();other.dispose();
});
test('people wait for another actor and resume after it moves away',()=>{
 const scene=new THREE.Scene(),nav=new HumanNavigation([],scene),o=new THREE.Group(),other=new THREE.Group();scene.add(o,other);other.position.set(1,0,0);const c=new HumanController({object:o,rig:{animate(){}},navigation:nav,others:()=>[other]});c.moveTo(new THREE.Vector3(2,0,0));for(let i=0;i<300;i++)c.step(1/60);assert.ok(o.position.x<.45);other.position.z=2;for(let i=0;i<300;i++)c.step(1/60);assert.equal(c.state,'idle');assert.ok(o.position.x>1.95);
});
test('relaxed arms keep elbows near the torso, palms inward and stable limb lengths',()=>{for(const character of ['sam','maya']){const rig=createRealisticHuman({character});for(let n=0;n<64;n++){rig.pose(n*.1,1);const j=rig.joints();for(const[s,i,side]of [['l',0,-1],['r',1,1]]){assert.ok(Math.abs(dist(j['upperarm_'+s],j['lowerarm_'+s])-rig.armLengths[i][0])<1e-5);assert.ok(Math.abs(dist(j['lowerarm_'+s],j['hand_'+s])-rig.armLengths[i][1])<1e-5);assert.ok(Math.abs(j['lowerarm_'+s][2])<.32,'elbow stays beside torso');const normal=new THREE.Vector3(0,0,1).applyQuaternion(rig.bones['hand_'+s].getWorldQuaternion(new THREE.Quaternion()));assert.ok(normal.z*(-side)>.9,'resting palm faces inward')}}rig.action(1,.505);for(const s of ['l','r']){const normal=new THREE.Vector3(0,0,1).applyQuaternion(rig.bones['hand_'+s].getWorldQuaternion(new THREE.Quaternion()));assert.ok(normal.y<-.85,'seated palm faces down')}for(const s of ['l','r'])for(const f of ['index','middle','ring','pinky']){const angle=new THREE.Euler().setFromQuaternion(rig.bones[f+'_02_'+s].quaternion);assert.ok(Math.abs(angle.x)<.1,'fingers have a relaxed curl')}}});
