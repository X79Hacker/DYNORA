import {randomStream} from './app-random.js';
import * as THREE from 'three';
import {HumanController,HumanNavigation,sceneSeats} from './human-actions.js';
const random=randomStream('people'),$=id=>document.getElementById(id);
let picker=null,dx0=0,dy0=0;
addEventListener('pointerdown',e=>{dx0=e.clientX;dy0=e.clientY},true);
addEventListener('pointerup',e=>{if(!document.body.classList.contains('depth-measuring')&&picker&&e.button===0&&Math.hypot(e.clientX-dx0,e.clientY-dy0)<5)picker(e)},true);

export function initPeople({scene,cam,renderer,walkers,randomPoint,robot,human,say,obstacles=[]}){
 const nav=new HumanNavigation(obstacles,scene),W=walkers.map((w,i)=>{
  const dx=w.b[0]-w.a[0],dz=w.b[1]-w.a[1],L=Math.hypot(dx,dz)||1,f=Math.min(w.f||0,L);w.g.position.set(w.a[0]+dx/L*f,0,w.a[1]+dz/L*f);w.g.rotation.y=Math.atan2(-dz,dx);w.g.userData.human=true;
  return {...w,id:i,mode:'route',speed:w.v,leg:1,wait:0,controller:null};
 });
 let sel=W.length===1?0:-1,want=null,clock=0;
 for(const w of W)w.controller=new HumanController({object:w.g,rig:w.H,navigation:nav,seats:()=>sceneSeats(scene),others:()=>[robot,human(),...W.map(x=>x.g),...scene.children.filter(o=>o.userData.human&&o!==w.g)],speed:w.speed,onStatus:text=>{if(w.id===sel)$('ppAction').textContent=text}});
 const ring=new THREE.Mesh(new THREE.RingGeometry(.3,.38,36),new THREE.MeshBasicMaterial({color:0xfb923c,transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.layers.set(1);ring.userData.noPaint=true;scene.add(ring);
 const card=document.createElement('div');card.className='card';card.innerHTML=`<h3>People · walking & seats</h3>
 <label class="pl">Person <select id="ppWho">${W.length>1?'<option value="-1">All people</option>':''}${W.map(w=>`<option value="${w.id}">${w.name}</option>`).join('')}</select></label>
 <div class="seg pm" id="ppMode"><button data-m="route">↔ Route</button><button data-m="random">🎲 Random</button><button data-m="stand">⏸ Stand</button></div>
 <label class="pl">Speed <input id="ppSpd" type="range" min="0.1" max="2" step="0.05"> <b id="ppSpdT"></b></label>
 <label>Seat <select id="ppSeat"></select></label><div class="btns"><button id="ppSit">Walk to seat & sit</button><button id="ppStand">Stand up</button></div><p id="ppAction" class="mut" role="status">Standing</p>
 <div class="btns"><button id="ppPos">📍 Set position</button><button id="ppGo">🎯 Walk to…</button><button id="ppRoute">↔ Set route A→B</button><button id="ppReset">↺ Default route</button></div>
 <p class="mut" id="ppHint">Choose a seat or click a clear floor destination. People brake for turns, avoid furniture and wait for others. Esc cancels floor picking.</p>`;
 $('bDraw').closest('.card').before(card);
 const list=()=>sel<0?W:[W[sel]],cur=()=>list()[0];
 function seats(){const old=$('ppSeat').value;const all=sceneSeats(scene);$('ppSeat').replaceChildren(new Option('Choose a chair, sofa or other seat',''),...all.map(s=>new Option(s.name,s.id)));if(all.some(s=>s.id===old))$('ppSeat').value=old}
 function show(){const w=cur();if(!w)return;$('ppWho').value=sel;const m=list().every(x=>x.mode===w.mode)?w.mode:'';$('ppMode').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.m===m));$('ppSpd').value=w.speed;$('ppSpdT').textContent=w.speed.toFixed(2)+' m/s';for(const id of ['ppPos','ppGo','ppRoute','ppSit','ppSeat'])$(id).disabled=sel<0;$('ppAction').textContent=sel<0?'Choose one person for seat actions.':w.controller.lastMessage;seats()}
 function setMode(w,m){w.mode=m;w.wait=0;w.controller.stand();if(m==='route')w.leg=1}
 $('ppWho').onchange=e=>{sel=+e.target.value;show()};$('ppMode').onclick=e=>{const m=e.target.closest('button')?.dataset.m;if(m){list().forEach(w=>setMode(w,m));show()}};
 $('ppSpd').oninput=e=>{list().forEach(w=>w.controller.speed=w.speed=+e.target.value);show()};
 $('ppSit').onclick=()=>{const w=W[sel];if(w.controller.sit($('ppSeat').value))w.mode='seat';show()};
 $('ppStand').onclick=()=>{list().forEach(w=>setMode(w,'stand'));show()};
 $('ppReset').onclick=()=>{list().forEach(w=>{w.a=[...walkers[w.id].a];w.b=[...walkers[w.id].b];w.speed=walkers[w.id].v;w.controller.speed=w.speed;setMode(w,'route')});show()};
 const rc=new THREE.Raycaster(),mv=new THREE.Vector2(),floor=new THREE.Plane(new THREE.Vector3(0,1,0),0);
 function endPick(text='Choose a clear floor destination or a seat.'){want=picker=null;document.body.classList.remove('picking');$('ppHint').textContent=text}
 function pick(kind,steps){want={kind,steps,got:[]};document.body.classList.add('picking');$('bIso')?.click();$('ppHint').textContent='Click the floor: '+steps[0]+'. Esc cancels.';picker=e=>{
  if(!want||e.target!==renderer.domElement)return;const r=e.target.getBoundingClientRect();mv.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);rc.setFromCamera(mv,cam);const hit=rc.ray.intersectPlane(floor,new THREE.Vector3());if(!hit)return;if(!nav.free(hit.x,hit.z)){say?.('Choose clear floor away from furniture.','info');return}want.got.push([hit.x,hit.z]);if(want.got.length<steps.length){$('ppHint').textContent='Click the floor: '+steps[want.got.length];return}const w=W[sel],c=w.controller,[a,b]=want.got;
  if(c.seat){endPick('Stand up before relocating this person.');return}
  if(kind==='pos'){c.stand();w.mode='stand';w.g.position.set(a[0],0,a[1]);w.H.resetFeet?.()}
  if(kind==='go'){w.mode='goto';c.moveTo(new THREE.Vector3(a[0],0,a[1]))}
  if(kind==='route'){w.a=a;w.b=b;setMode(w,'route');c.moveTo(new THREE.Vector3(a[0],0,a[1]));w.leg=1}
  endPick(c.lastMessage);show();
 }}
 $('ppPos').onclick=()=>pick('pos',['new position']);$('ppGo').onclick=()=>pick('go',['destination']);$('ppRoute').onclick=()=>pick('route',['route start A','route end B']);addEventListener('keydown',e=>{if(e.code==='Escape'&&want)endPick('Picking cancelled.')});
 function update(dt){nav.update(dt);for(const w of W){const c=w.controller;c.step(dt);if(c.state==='idle'&&!c.seat&&['route','random'].includes(w.mode)){w.wait-=dt;if(w.wait<=0){let t;if(w.mode==='route'){t=w.leg?w.b:w.a;w.leg^=1}else t=randomPoint(w.g.position.x,w.g.position.z,1.5,7);if(t)c.moveTo(new THREE.Vector3(t[0],0,t[1]));w.wait=.4+random()*.6}}if(w.mode==='goto'&&c.state==='idle')w.mode='stand'}ring.visible=sel>=0;if(sel>=0)ring.position.copy(W[sel].g.position).setY(.02);if((clock+=dt)>1){clock=0;seats()}}
 show();return{update,info:()=>W.map(w=>({name:w.name,mode:w.mode,speed_mps:w.speed,...w.controller.info()})),snapshot:()=>W.map(w=>({name:w.name,mode:w.mode,speed:w.speed,a:w.a,b:w.b,leg:w.leg,wait:w.wait,position:w.g.position.toArray(),yaw:w.controller.yaw,action:w.controller.state,progress:w.controller.progress,seat:w.controller.seat?.name||null,seat_id:w.controller.seat?.id||null})),restore(states){if(!Array.isArray(states)||states.length!==W.length)throw Error('People count differs');states.forEach((s,i)=>{if(!['route','random','goto','stand','seat'].includes(s.mode)||!Number.isFinite(s.speed)||s.speed<0||s.speed>3||!Array.isArray(s.position)||s.position.some(x=>!Number.isFinite(x)))throw Error('Invalid walker state');const w=W[i];w.controller.dispose();w.g.position.fromArray(s.position);w.g.rotation.y=w.controller.yaw=s.yaw||0;w.mode=s.mode;w.a=s.a;w.b=s.b;w.speed=w.controller.speed=s.speed;w.leg=s.leg;w.wait=0;w.controller.state='idle';w.H.stand?.();if(s.seat){const seat=sceneSeats(scene).find(x=>x.name===s.seat);if(seat&&w.controller.resumeSeat(s.seat_id||seat.name,s.progress??1)){w.controller.state=s.action||'seated';w.controller.progress=s.progress??1;w.controller.step(.001)}else w.mode='stand'}});show()}};
}
