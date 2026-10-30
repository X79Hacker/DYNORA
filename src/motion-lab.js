import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {prepareHumans,createRealisticHuman} from './realistic-human.js';
import {createFurniture} from './visual-models.js';
import {HumanController,HumanNavigation,sceneSeats} from './human-actions.js';
const $=id=>document.getElementById(id);
async function start(){
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.4));renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;$('stage').prepend(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color(0xe5e8df);scene.add(new THREE.HemisphereLight(0xffffff,0x8c9a87,1.15));const sun=new THREE.DirectionalLight(0xfff3da,2);sun.position.set(-3,6,4);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.normalBias=.002;scene.add(sun);
 const camera=new THREE.PerspectiveCamera(40,1,.01,60);camera.position.set(3.5,2.3,4.8);const orbit=new OrbitControls(camera,renderer.domElement);orbit.target.set(0,.85,.7);orbit.enableDamping=true;orbit.update();
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshStandardMaterial({color:0xe0e0d1,roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
 const grid=new THREE.GridHelper(12,24,0xc5cbbd,0xd0d5c8);grid.position.y=.001;scene.add(grid);
 const obstacles=[],nav=new HumanNavigation(obstacles,scene);await prepareHumans();
 const people=['sam','maya'].map((id,i)=>{const rig=createRealisticHuman({character:id}),object=rig.g;object.position.set(i?1.5:-1.5,0,1.6);scene.add(object);return {id,rig,object,controller:null}});
 for(const p of people)p.controller=new HumanController({object:p.object,rig:p.rig,navigation:nav,seats:()=>sceneSeats(scene),others:()=>people.filter(q=>q!==p).map(q=>q.object)});
 let furniture=null,walking=false,study=false,clock=performance.now(),timer=0;
 function reset(){for(const[p,i]of people.map((p,i)=>[p,i])){p.controller.dispose();p.controller.state='idle';p.controller.velocity=0;p.object.position.set(i?1.5:-1.5,0,1.6);p.object.rotation.y=p.controller.yaw=-Math.PI/2;p.rig.stand()}walking=study=false;$('step').value=0}
 function build(){reset();if(furniture)scene.remove(furniture);obstacles.length=0;furniture=createFurniture($('seatType').value);furniture.userData.label=$('seatType').selectedOptions[0].textContent;scene.add(furniture);furniture.traverse(o=>{if(o.isMesh)obstacles.push(o)});nav.refresh()}
 const chosen=()=>people.filter(p=>$('person').value==='both'||$('person').value===p.id);
 $('seatType').onchange=build;$('reset').onclick=reset;
 $('walk').onclick=()=>{study=false;walking=true;for(const p of chosen())p.controller.moveTo(new THREE.Vector3(p.object.position.x<0?2.2:-2.2,0,p.id==='sam'?1.5:2.3))};
 $('sit').onclick=()=>{walking=study=false;const seats=sceneSeats(scene);for(const[p,i]of chosen().map((p,i)=>[p,i])){if(seats[i])p.controller.sit(seats[i].id);else p.controller.message('Choose one person for this single seat.')}};
 $('stand').onclick=()=>{walking=study=false;for(const p of chosen())p.controller.stand()};
 $('step').oninput=()=>{walking=false;study=true;const s=Number($('step').value),seats=sceneSeats(scene);chosen().forEach((p,i)=>{const seat=seats[i];if(!seat)return;p.controller.dispose();p.controller.state='idle';p.object.position.copy(seat.point).addScaledVector(seat.front,.59-.54*s).setY(0);p.object.rotation.y=p.controller.yaw=seat.yaw;p.rig.action(s,seat.height)})};
 build();
 function loop(now){requestAnimationFrame(loop);const dt=Math.min(.05,(now-clock)/1000);clock=now;nav.update(dt);if(!study)for(const p of people){p.controller.step(dt);if(walking&&chosen().includes(p)&&p.controller.state==='idle')p.controller.moveTo(new THREE.Vector3(p.object.position.x<0?2.2:-2.2,0,p.id==='sam'?1.5:2.3))}
  if((timer+=dt)>.2){timer=0;$('status').textContent=people.map(p=>{const j=p.rig.joints();return p.id.toUpperCase()+' · '+(study?'pose study':p.controller.state)+'\n'+p.controller.lastMessage+'\nAnkles: '+j.foot_l[1].toFixed(3)+' / '+j.foot_r[1].toFixed(3)+' m'}).join('\n\n')}
  const r=$('stage').getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();orbit.update();renderer.render(scene,camera);
 }requestAnimationFrame(loop);
}
start().catch(error=>{$('status').textContent='Motion lab could not load: '+error.message;console.error(error)});
