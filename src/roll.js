import {contactBody} from './contact-bindings.js';
import {randomStream} from './app-random.js';
const random=randomStream('roll');
// ===== round objects (balls, bottles, cans) that roll, bounce and slow to a stop (shared by both environments) =====
import * as THREE from 'three';
import {G,props,drag,rollKeep} from './physics.js';

const $=id=>document.getElementById(id);
const VMAX=8;   // m/s, cap for very light objects
function tex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.anisotropy=8;return t}
// sphere textures, so the spin is visible while it rolls
const TEX={
 ball:()=>tex(256,128,(x,w,h)=>{x.fillStyle='#dc2626';x.fillRect(0,0,w,h);x.fillStyle='#fff';x.fillRect(0,h*.44,w,h*.12);x.fillRect(w*.24,0,w*.06,h);x.fillRect(w*.74,0,w*.06,h)}),
 tennis:()=>tex(256,128,(x,w,h)=>{x.fillStyle='#d4f03c';x.fillRect(0,0,w,h);x.strokeStyle='#fafafa';x.lineWidth=5;x.beginPath();for(let i=0;i<=w;i+=4){const y=h/2+Math.sin(i/w*Math.PI*4)*h*.28;i?x.lineTo(i,y):x.moveTo(i,y)}x.stroke()}),
 football:()=>tex(512,256,(x,w,h)=>{x.fillStyle='#f5f5f5';x.fillRect(0,0,w,h);x.fillStyle='#111';for(let r=0;r<4;r++)for(let i=0;i<8;i++){const cx=(i+(r%2)*.5)*w/8,cy=(r+.5)*h/4;x.beginPath();for(let k=0;k<5;k++){const a=k/5*Math.PI*2-Math.PI/2;x.lineTo(cx+Math.cos(a)*18,cy+Math.sin(a)*18*(1+Math.abs(r-1.5)*.5))}x.fill()}})};
const glassy=(m,o)=>{m.material.transparent=true;m.material.opacity=o;m.material.roughness=.08;m.material.metalness=.1;return m};
// spawnable round objects: label, rolling shape and builder (part = the scene's own part() helper)
export const ROUND={
 ball:{label:'red ball',roll:{kind:'sphere',r:.2},build:(g,part)=>{const m=part(g,.4,0,0,0,.2,0,0xffffff,'s');m.material.map=TEX.ball()}},
 can:{label:'metal can',roll:{kind:'cyl',r:.12,h:.35},build:(g,part)=>part(g,.24,.35,0,0,.175,0,0xb8c2cc,.12)},
 tennis:{label:'tennis ball',roll:{kind:'sphere',r:.0335},build:(g,part)=>{const m=part(g,.067,0,0,0,.0335,0,0xffffff,'s');m.material.map=TEX.tennis();m.material.roughness=1}},
 football:{label:'football',roll:{kind:'sphere',r:.11},build:(g,part)=>{const m=part(g,.22,0,0,0,.11,0,0xffffff,'s');m.material.map=TEX.football();m.material.roughness=.5}},
 water:{label:'plastic water bottle',roll:{kind:'cyl',r:.035,h:.255,neck:1},build:(g,part)=>{const c=0x9fd3f0;
  glassy(part(g,.07,.17,0,0,.085,0,c,.035),.55);glassy(part(g,.03,.04,0,0,.19,0,c,.035),.55);glassy(part(g,.03,.025,0,0,.2225,0,c,.015),.6);
  part(g,.034,.02,0,0,.245,0,0x1d4ed8,.017);part(g,.072,.06,0,0,.09,0,0xf8fafc,.036)}},
 glass:{label:'glass bottle',roll:{kind:'cyl',r:.038,h:.325,neck:1},build:(g,part)=>{const c=0x166534;
  glassy(part(g,.076,.2,0,0,.1,0,c,.038),.85);glassy(part(g,.03,.05,0,0,.225,0,c,.038),.85);glassy(part(g,.03,.06,0,0,.28,0,c,.015),.85);
  part(g,.032,.02,0,0,.315,0,0x7f1d1d,.016);part(g,.078,.08,0,0,.1,0,0xf5e6c8,.039)}}};

const UP=new THREE.Vector3(0,1,0);
export function initRoll({obstacles,cam,toast,target,robot,human}){
 const R=new Map(),rc=new THREE.Raycaster(),v3=new THREE.Vector3(),q=new THREE.Quaternion(),qi=new THREE.Quaternion();
 let push=.6;   // push impulse, N·s: the same push moves a light ball faster than a heavy one
 // turn every child mesh about a pivot (group-local), so the group keeps its flat list of meshes
 function spin(g,axisW,ang,piv){qi.copy(g.quaternion).invert();const a=v3.copy(axisW).applyQuaternion(qi).normalize();q.setFromAxisAngle(a,ang);
  g.children.forEach(m=>{m.position.sub(piv).applyQuaternion(q).add(piv);m.quaternion.premultiply(q)})}
 function state(g){let s=R.get(g);if(!s){const d=g.userData.roll;s={g,d,vx:0,vz:0,lying:d.kind==='sphere',piv:new THREE.Vector3(0,d.kind==='sphere'?d.r:d.h/2,0),curve:(random()<.5?-1:1),x:g.position.x,z:g.position.z};R.set(g,s)}return s}
 // a standing bottle or can tips over onto its side, axis across the push direction
 function tip(s,dx,dz){const{g,d}=s,A=new THREE.Vector3(dz,0,-dx).normalize();q.setFromUnitVectors(UP,v3.copy(A).applyQuaternion(qi.copy(g.quaternion).invert()));
  g.children.forEach(m=>{m.position.sub(s.piv).applyQuaternion(q).add(s.piv);m.quaternion.premultiply(q);m.position.y-=d.h/2-d.r});s.piv.y=d.r;s.lying=true}
 function roll(g,sp){if(!g||!g.parent)return toast('Spawn or click an object first');if(!g.userData.roll)return toast('Only balls, bottles and cans can roll');
  cam.getWorldDirection(v3);v3.y=0;if(v3.lengthSq()<1e-4)v3.set(0,0,-1);v3.normalize().applyAxisAngle(UP,(random()-.5)*.35);
  // impulse J gives speed J/m; then sliding friction turns part of it into spin until it rolls
  const binding=contactBody(g);if(binding){binding.applyImpulse({x:v3.x*sp,y:0,z:v3.z*sp},true);return toast('Applied '+sp.toFixed(2)+' N·s to '+(g.userData.label||'object'))}const dx=v3.x,dz=v3.z,s=state(g),p=props(g),v=Math.min(VMAX,sp/p.m)*rollKeep(p);if(!s.lying)tip(s,dx,dz);s.vx=dx*v;s.vz=dz*v;s.x=g.position.x;s.z=g.position.z;
  toast((g.userData.label||'Object')+' ('+(p.m<1?(p.m*1000).toFixed(0)+' g':p.m.toFixed(1)+' kg')+') rolls at '+v.toFixed(1)+' m/s')}
 $('bRoll').onclick=()=>roll(target(),push);
 $('nPush').oninput=e=>{push=+e.target.value;$('nPushT').textContent=push.toFixed(2)+' N·s'};
 let hx=0,hz=0;
 function update(dt){if(!dt)return;
  // a walking human kicks round objects
  const H=human();let hv=0,hdx=0,hdz=0;if(H){hdx=(H.position.x-hx)/dt;hdz=(H.position.z-hz)/dt;hv=Math.hypot(hdx,hdz);hx=H.position.x;hz=H.position.z}
  if(H&&hv>.3&&hv<8)target.all().forEach(g=>{if(!g.userData.roll||!g.parent)return;const s=state(g),dx=g.position.x-H.position.x,dz=g.position.z-H.position.z,l=Math.hypot(dx,dz);
   if(l<s.d.r+.45&&(dx*hdx+dz*hdz)>0&&Math.hypot(s.vx,s.vz)<hv){if(!s.lying)tip(s,dx/l,dz/l);const p=props(g),kv=Math.min(VMAX,1.5*hv/p.m)*rollKeep(p)/* a kick: about 1.5 kg of foot at walking speed */;s.vx=dx/l*kv;s.vz=dz/l*kv;s.x=g.position.x;s.z=g.position.z}});
  R.forEach((s,g)=>{const body=contactBody(g);if(body){if(Math.hypot(s.vx,s.vz)>0)body.setLinvel({x:s.vx,y:body.linvel().y,z:s.vz},true);s.vx=s.vz=0;return}const v=Math.hypot(s.vx,s.vz);if(!g.parent){R.delete(g);return}if(v<1e-4)return;
   // dragged or carried by someone else: stop rolling
   if(Math.abs(g.position.x-s.x)>1e-3||Math.abs(g.position.z-s.z)>1e-3){s.vx=s.vz=0;return}
   const sph=s.d.kind==='sphere',r=s.d.r,dir=new THREE.Vector3(s.vx/v,0,s.vz/v),step=v*dt;
   // collisions: ray from the centre along the motion; bounce off the surface normal, losing energy
   // the ray starts at the object's own height (it may be on a table or in the air)
   const own=new Set(g.children);rc.set(new THREE.Vector3(g.position.x,g.position.y+Math.max(r,.05),g.position.z),dir);rc.far=r+step+.02;
   const h=rc.intersectObjects(obstacles,false).find(i=>!own.has(i.object));
   if(h&&h.face){const n=h.face.normal.clone().transformDirection(h.object.matrixWorld);n.y=0;n.normalize();const dn=s.vx*n.x+s.vz*n.z;
    // bounce: the speed into the wall comes back times the restitution e of the object
    const e=Math.min(.9,props(g).e+.15);if(dn<0){if(sph){s.vx-=(1+e)*dn*n.x;s.vz-=(1+e)*dn*n.z}else{s.vx*=-e;s.vz*=-e}return}}
   g.position.x+=s.vx*dt;g.position.z+=s.vz*dt;s.x=g.position.x;s.z=g.position.z;
   spin(g,new THREE.Vector3(dir.z,0,-dir.x),step/r,s.piv);
   // a bottle rolls in an arc around its narrow neck
   if(s.d.neck){const t=s.curve*step/1.1;g.children.forEach(m=>{m.position.sub(s.piv).applyAxisAngle(UP,t).add(s.piv);m.quaternion.premultiply(q.setFromAxisAngle(UP,t))});const c=Math.cos(t),sn=Math.sin(t),vx=s.vx;s.vx=vx*c+s.vz*sn;s.vz=-vx*sn+s.vz*c}
   // rolling resistance + air drag: balls roll far, bottles and cans stop sooner
   // rolling resistance (crr·g, only on a surface) + air drag (½ρ·Cd·A·v²/m)
   const p=props(g),nv=Math.max(0,v-((g.userData.airborne?0:p.crr*G)+drag(p,v))*dt);if(nv<.03){s.vx=s.vz=0}else{s.vx*=nv/v;s.vz*=nv/v}});
 }
 // for collisions (collide.js): read and set the rolling velocity; a hit tips a standing bottle or can over
 const vel=g=>{const s=R.get(g);return s?[s.vx,s.vz]:[0,0]};
 function setVel(g,vx,vz){const s=state(g),v=Math.hypot(vx,vz);if(!s.lying&&v>.05)tip(s,vx/v,vz/v);s.vx=vx;s.vz=vz;s.x=g.position.x;s.z=g.position.z}
 return{update,roll,vel,setVel};
}
