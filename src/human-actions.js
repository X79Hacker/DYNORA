import * as THREE from 'three';
import {smooth} from './human-rig.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),angle=x=>Math.atan2(Math.sin(x),Math.cos(x));

// Local seat surface points and front direction, in the furniture's frame.
// Anchors follow the entire parent transform when furniture is moved/scaled.
export const SEAT_PROFILES={
 'dining-chair':[{p:[0,.4725,.035],front:[0,0,1]}],
 'office-chair':[{p:[0,.5075,.035],front:[0,0,1]}],
 sofa:[-.47,.47].map(x=>({p:[x,.505,.045],front:[0,0,1]})),
 armchair:[{p:[0,.505,.055],front:[0,0,1]}],
 'bar-stool':[{p:[0,.74,.025],front:[0,0,1],footHeight:.30,footAdvance:.12}],
 'double-bed':[-.48,.48].map(x=>({p:[x,.58,.77],front:[0,0,1]})),
};
function humanObject(o){while(o){if(o.userData.human)return true;o=o.parent}return false}
export function sceneSeats(scene){
 const seats=[],occupied=[];scene.updateMatrixWorld(true);scene.traverse(o=>{if(o.userData.human&&o.userData.seated){let p=o,controlled=false;while(p){if(p.userData.humanController)controlled=true;p=p.parent}if(!controlled)occupied.push(o.getWorldPosition(V()))}});scene.traverse(o=>{
  const profile=o.userData.seats||SEAT_PROFILES[o.userData.catalog_id];if(!profile)return;
  const up=V(0,1,0).transformDirection(o.matrixWorld);if(up.y<.98)return;
  profile.forEach((s,i)=>{
   const point=o.localToWorld(V(...s.p)),front=V(...s.front).transformDirection(o.matrixWorld);front.y=0;front.normalize();
   let owner=o;while(owner.parent&&owner.parent!==scene&&!owner.parent.userData.human)owner=owner.parent;
   const floor=owner.getWorldPosition(V()).y;const bounds=new THREE.Box3().setFromObject(o);let reach=0;for(const x of[bounds.min.x,bounds.max.x])for(const z of[bounds.min.z,bounds.max.z])reach=Math.max(reach,V(x,point.y,z).sub(point).dot(front));const standoff=Math.max(.59,reach+.26);
   if(point.y-floor<.25||point.y-floor>.85)return;
   const path=[];let part=o;while(part!==owner){path.unshift(part.parent.children.indexOf(part));part=part.parent}const stable=(owner.userData.seatKey||owner.uuid)+'/'+path.join('.');
   seats.push({footHeight:s.footHeight||0,footAdvance:s.footAdvance??.54,standoff,occupied:occupied.some(p=>Math.hypot(p.x-point.x,p.z-point.z)<.3),id:stable+':'+i,name:(owner.userData.label||o.name||o.userData.catalog_id||'Seat')+(profile.length>1?' · seat '+(i+1):''),object:o,owner,point,front,floor,height:point.y-floor,approach:point.clone().addScaledVector(front,standoff).setY(floor),yaw:Math.atan2(-front.z,front.x)});
  });
 });return seats;
}

export class HumanNavigation{
 constructor(obstacles,scene){this.obstacles=obstacles;this.scene=scene;this.boxes=[];this.clock=0;this.refresh()}
 refresh(){this.scene.updateMatrixWorld(true);this.boxes=[];for(const m of this.obstacles){if(!m.parent||humanObject(m)||m.userData.noHumanCollision)continue;let p=m,visible=true;while(p){if(!p.visible)visible=false;p=p.parent}if(!visible)continue;const b=new THREE.Box3().setFromObject(m);if(b.max.y<.08||b.min.y>1.6||b.isEmpty())continue;this.boxes.push({box:b,object:m})}this.clock=0}
 update(dt){if((this.clock+=dt)>.35)this.refresh()}
 free(x,z,r=.235,ignore=null){return !this.boxes.some(({box:b,object})=>{if(ignore&&(object===ignore||ignore.getObjectById(object.id)))return false;return x>b.min.x-r&&x<b.max.x+r&&z>b.min.z-r&&z<b.max.z+r})}
 segment(a,b,ignore=null){
  const dx=b.x-a.x,dz=b.z-a.z,r=.235;
  for(const {box,object}of this.boxes){if(ignore&&(object===ignore||ignore.getObjectById(object.id)))continue;let lo=0,hi=1,hit=true;
   for(const[p,d,min,max]of [[a.x,dx,box.min.x-r,box.max.x+r],[a.z,dz,box.min.z-r,box.max.z+r]]){if(Math.abs(d)<1e-10){if(p<=min||p>=max){hit=false;break}}else{let t=(min-p)/d,u=(max-p)/d;if(t>u)[t,u]=[u,t];lo=Math.max(lo,t);hi=Math.min(hi,u);if(lo>=hi-1e-9){hit=false;break}}}
   if(hit&&hi>0&&lo<1)return false;
  }return true;
 }

 plan(from,to){
  if(!this.free(to.x,to.z))return null;
  if(this.segment(from,to))return[to.clone()];
  const step=.24,minX=Math.min(from.x,to.x)-5,minZ=Math.min(from.z,to.z)-5;
  const nx=Math.ceil((Math.abs(from.x-to.x)+10)/step)+1,nz=Math.ceil((Math.abs(from.z-to.z)+10)/step)+1;
  if(nx*nz>45000)return null;
  const key=(x,z)=>z*nx+x,point=k=>V(minX+(k%nx)*step,0,minZ+Math.floor(k/nx)*step),cell=p=>key(Math.round((p.x-minX)/step),Math.round((p.z-minZ)/step));
  let start=cell(from),goal=cell(to);const nearest=(p,k)=>{if(this.free(point(k).x,point(k).z))return k;let best=-1,dist=.65;for(let x=-3;x<=3;x++)for(let z=-3;z<=3;z++){const q=k+x+z*nx,v=point(q),d=v.distanceTo(p);if(q>=0&&q<nx*nz&&d<dist&&this.free(v.x,v.z)){best=q;dist=d}}return best};
  start=nearest(from,start);goal=nearest(to,goal);if(start<0||goal<0)return null;
  const open=new Set([start]),closed=new Set(),cost=new Map([[start,0]]),prev=new Map(),goalP=point(goal),heur=k=>point(k).distanceTo(goalP);
  const dirs=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
  while(open.size&&closed.size<18000){let cur=-1,best=Infinity;for(const k of open){const score=cost.get(k)+heur(k);if(score<best){best=score;cur=k}}if(cur===goal){let path=[to.clone()],k=goal;while(k!==start){path.push(point(k));k=prev.get(k)}path.push(point(start));path.reverse();const out=[];let anchor=from;for(let i=0;i<path.length;){let j=i;while(j+1<path.length&&this.segment(anchor,path[j+1]))j++;out.push(path[j]);anchor=path[j];i=j+1}return out}
   open.delete(cur);closed.add(cur);const x=cur%nx,z=Math.floor(cur/nx),p=point(cur);
   for(const[dx,dz]of dirs){const xx=x+dx,zz=z+dz,k=key(xx,zz);if(xx<0||zz<0||xx>=nx||zz>=nz||closed.has(k))continue;const q=point(k);if(!this.free(q.x,q.z)||!this.segment(p,q))continue;const c=cost.get(cur)+Math.hypot(dx,dz)*step;if(c<(cost.get(k)??Infinity)){cost.set(k,c);prev.set(k,cur);open.add(k)}}
  }return null;
 }
}

const reservations=new Map();
const controllers=new WeakMap();
export const humanControllerFor=object=>controllers.get(object);
export class HumanController{
 constructor({object,rig,navigation,seats=()=>[],others=()=>[],speed=.9,onStatus=()=>{}}){this.object=object;controllers.set(object,this);this.rig=rig;this.navigation=navigation;this.seats=seats;this.others=others;this.speed=speed;this.onStatus=onStatus;this.state='idle';this.velocity=0;this.path=[];this.k=0;this.yaw=object.rotation.y;this.progress=0;this.seat=null;this.blocked=0;this.lastMessage='Standing';object.userData.human=true;object.userData.humanController=true}
 message(text){this.lastMessage=text;this.onStatus(text)}
 release(){if(this.seat&&reservations.get(this.seat.id)===this)reservations.delete(this.seat.id);this.seat=null}
 moveTo(point){if(this.seat&&this.progress>0){this.afterStand=()=>this.moveTo(point);this.stand();return true}if(this.seat)this.release();const path=this.navigation.plan(this.object.position,point);if(!path){this.state='idle';this.message('No clear walking path. Move the destination or furniture.');return false}this.path=path;this.k=0;this.state='walking';this.message('Walking to destination');return true}
 sit(id){if(this.seat){this.message('Stand up before choosing another seat.');return false}const seat=this.seats().find(s=>s.id===id);if(!seat){this.message('Choose an upright chair, sofa, armchair, stool or bed.');return false}if(seat.occupied||reservations.has(id)){this.message('That seat is occupied. Choose another seat.');return false}if(!this.navigation.free(seat.approach.x,seat.approach.z)){this.message('The seat approach is blocked. Move the furniture or choose another seat.');return false}
  const path=this.navigation.plan(this.object.position,seat.approach);if(!path){this.message('No clear path to this seat.');return false}
  this.seat=seat;reservations.set(id,this);this.path=path;this.k=0;this.state='approaching';this.progress=0;this.message('Walking to '+seat.name);return true;
 }
 resumeSeat(id,progress=1){const seat=this.seats().find(s=>s.id===id||s.name===id);if(!seat||seat.occupied||reservations.has(seat.id))return false;this.release();this.seat=seat;reservations.set(seat.id,this);this.progress=Math.max(0,Math.min(1,progress));this.state=this.progress===1?'seated':'sitting';this.step(.00001);return true}
 stand(){if(this.seat&&this.progress>0){this.state='standing';this.message('Standing up');return}if(this.state==='approaching'||this.state==='turning'||this.state==='aligning'){this.release()}this.state='idle';this.path=[];this.rig.stand?.();this.message('Standing')}
 dispose(){this.release()}
 step(dt){dt=Math.min(.05,Math.max(0,dt));if(!dt)return;const o=this.object;o.userData.sitProgress=this.progress;o.userData.humanAction=this.state;
  if(this.seat){const seat=this.seats().find(s=>s.id===this.seat.id);if(!seat){this.release();this.state='idle';this.progress=0;this.rig.stand?.();this.message('Seat removed; standing');return}this.seat=seat}
  const seat=this.seat;
  if(['sitting','seated','standing'].includes(this.state)){
   this.velocity=0;const old=this.progress;
   if(this.state==='sitting')this.progress=Math.min(1,this.progress+dt/1.6);
   if(this.state==='standing')this.progress=Math.max(0,this.progress-dt/1.8);
   o.userData.sitProgress=this.progress;const s=smooth(this.progress),scale=o.getWorldScale(V()).y;
   o.position.copy(seat.point).addScaledVector(seat.front,.59-.54*s).setY(seat.floor);o.rotation.set(0,seat.yaw,0);this.yaw=seat.yaw;
   this.rig.action?.(s,seat.height/scale,{footHeight:seat.footHeight/scale,footAdvance:seat.footAdvance/scale});
   if(this.state==='sitting'&&this.progress===1){this.state='seated';this.message('Seated on '+seat.name)}
   if(this.state==='standing'&&this.progress===0){this.release();this.state='idle';this.rig.stand?.();this.message('Standing');const next=this.afterStand;this.afterStand=null;next?.()}return;
  }
  if(this.state==='turning'){
   const diff=angle(seat.yaw-this.yaw);this.yaw+=Math.sign(diff)*Math.min(Math.abs(diff),dt*2.8);o.rotation.y=this.yaw;
   this.rig.animate?.({dt,speed:0,distance:0});if(Math.abs(diff)<.025&&this.velocity<.02){this.state='aligning';this.message('Placing feet before sitting')}return;
  }
  if(this.state==='aligning'){
   const target=seat.point.clone().addScaledVector(seat.front,.59).setY(seat.floor),d=o.position.distanceTo(target),next=o.position.clone().lerp(target,Math.min(1,dt*.25/Math.max(d,.00001)));
   if(this.navigation.segment(o.position,next,seat.object)){const step=o.position.distanceTo(next);o.position.copy(next);this.rig.animate?.({dt,distance:step,speed:step/dt})}else{this.message('Seat alignment blocked. Move nearby furniture.');return}
   if(d<.008){o.position.copy(target);this.rig.stand?.();this.state='sitting';this.progress=0;this.message('Sitting down')}return;
  }
  let distance=0;
  if(this.state==='walking'||this.state==='approaching'){
   while(this.k<this.path.length&&o.position.distanceTo(this.path[this.k])<.002)this.k++;
   if(this.k>=this.path.length){this.velocity=0;if(this.state==='approaching'){o.position.copy(seat.approach);this.state='turning';this.message('Turning toward seat')}else{this.state='idle';this.message('Arrived')};this.rig.animate?.({dt,speed:0,distance:0});return}
   const target=this.path[this.k],dx=target.x-o.position.x,dz=target.z-o.position.z,d=Math.hypot(dx,dz),desired=Math.atan2(-dz,dx),diff=angle(desired-this.yaw);
   this.yaw+=Math.sign(diff)*Math.min(Math.abs(diff),2.8*dt);o.rotation.y=this.yaw;
   let remaining=d;for(let i=this.k+1;i<this.path.length;i++)remaining+=this.path[i].distanceTo(this.path[i-1]);
   const desiredSpeed=Math.min(this.speed,Math.sqrt(2*1.8*remaining))*Math.max(0,Math.cos(diff))**3;
   this.velocity+=Math.sign(desiredSpeed-this.velocity)*Math.min(Math.abs(desiredSpeed-this.velocity),(desiredSpeed>this.velocity?1.3:2.5)*dt);
   const next=o.position.clone().add(V(dx/d,0,dz/d).multiplyScalar(Math.min(d,this.velocity*dt)));
   const collision=this.others().some(other=>{if(!other||other===o||!other.visible||other.position.y<-.5)return false;return Math.hypot(next.x-other.position.x,next.z-other.position.z)<.56});
   if(!collision&&this.navigation.segment(o.position,next)){distance=o.position.distanceTo(next);o.position.copy(next);this.blocked=0}
   else{this.velocity=0;this.blocked+=dt;if(this.blocked>1.5){this.navigation.refresh();const replanned=this.navigation.plan(o.position,this.path.at(-1));if(replanned){this.path=replanned;this.k=0}this.blocked=0;this.message(collision?'Waiting for another person or the robot':'Replanning around furniture')}}
  }else this.velocity=Math.max(0,this.velocity-dt*3);
  this.rig.animate?.({dt,speed:distance/dt,distance});
 }
 info(){return {action:this.state,seat:this.seat?.name||null,seat_id:this.seat?.id||null,speed_mps:this.velocity,position:this.object.position.toArray(),progress:this.progress,status:this.lastMessage}}
}
