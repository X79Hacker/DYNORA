// ===== robot ↔ object collisions with momentum: a light object is pushed away, a heavy one pushes the robot back =====
import * as THREE from 'three';
import {G,props} from './physics.js';
import {impact1D} from './dynamics.js';

export let ROBOT_KG=3.5;            // robot mass (chassis, 4 motors, 3S battery); set in Build → Weights (importers see the new value)
export const setRobotKg=m=>{ROBOT_KG=m};
const MU=.35,BUMPER=.5;   // robot radius and height (m); sliding friction on the floor; bumper restitution

// bump(dv, heavy): change the robot's speed along its heading by dv m/s; roll: rolling module (vel / setVel)
export function initCollide({robot,movable,obstacles,roll,bump,say,log,radius=()=>.27,top=()=>.32}){
 const slide=new Map(),box=new THREE.Box3(),gb=new THREE.Box3(),rc=new THREE.Raycaster(),c3=new THREE.Vector3();let px=robot.position.x,pz=robot.position.z,quiet=0;
 const vel=g=>g.userData.roll?roll.vel(g):(slide.get(g)||[0,0]);
 const setVel=(g,vx,vz)=>{if(g.userData.roll)roll.setVel(g,vx,vz);else slide.set(g,[vx,vz])};
 // is the object pressed against something fixed (wall, built-in furniture) in direction (nx,nz)? loose objects can be pushed along, so they do not count
 // light: loose objects up to this mass (kg) are pushed along instead of blocking (people never block)
 function stuck(g,nx,nz,light=0){const TOP=top();const own=new Set();g.traverse(o=>own.add(o));gb.setFromObject(g);gb.getCenter(c3);const h=Math.abs(nx)*(gb.max.x-c3.x)+Math.abs(nz)*(gb.max.z-c3.z);
  rc.set(new THREE.Vector3(c3.x,Math.min(TOP,Math.max(.05,gb.min.y+.05)),c3.z),new THREE.Vector3(nx,0,nz));rc.far=h+.03;
  return rc.intersectObjects(obstacles,false).some(i=>{const u=i.object.userData;if(own.has(i.object)||u.dyn&&!u.pick)return false;return!u.pick||props(i.object.parent).m>light})}
 // closest touching part of the object (only parts low enough to meet the robot body, e.g. table legs, not the tabletop)
 function contact(g,obs){const RR=radius(),TOP=top();gb.setFromObject(g);const rp=robot.position;if(gb.isEmpty()||gb.min.y>TOP||rp.x<gb.min.x-RR||rp.x>gb.max.x+RR||rp.z<gb.min.z-RR||rp.z>gb.max.z+RR)return null;
  let best=null;g.traverse(m=>{if(!m.isMesh||!obs.has(m))return;box.setFromObject(m);if(box.isEmpty()||box.min.y>TOP)return;
   const cx=Math.max(box.min.x,Math.min(rp.x,box.max.x)),cz=Math.max(box.min.z,Math.min(rp.z,box.max.z)),dx=cx-rp.x,dz=cz-rp.z,d=Math.hypot(dx,dz);
   if(d<RR&&(!best||d<best.d)){box.getCenter(c3);best={d,dx,dz,cx:c3.x,cz:c3.z}}});
  if(!best)return null;let nx=best.dx,nz=best.dz,l=best.d;if(l<1e-4){nx=best.cx-rp.x;nz=best.cz-rp.z;l=Math.hypot(nx,nz)||1}
  return{nx:nx/l,nz:nz/l,pen:RR-best.d}}

 function update(dt){if(!dt)return;const rp=robot.position,vrx=(rp.x-px)/dt,vrz=(rp.z-pz)/dt;px=rp.x;pz=rp.z;quiet-=dt;const obs=new Set(obstacles);
  if(Math.hypot(vrx,vrz)>3)return;   // the robot was placed somewhere new (task start), not driven
  movable().forEach(g=>{if(!g.parent||g.userData.contactManaged||g.position.y>.25)return;const c=contact(g,obs);if(!c)return;
   const blocked=stuck(g,c.nx,c.nz,ROBOT_KG),[vox,voz]=vel(g);
   if(!blocked){g.position.x+=c.nx*c.pen;g.position.z+=c.nz*c.pen;if(g.userData.roll)roll.setVel(g,vox,voz)}   // push apart (no overlap); keep a rolling object rolling
   const vr=vrx*c.nx+vrz*c.nz,vo=vox*c.nx+voz*c.nz;if(vr-vo<=.02)return;   // only when closing in
   // 1-D impact along the contact normal: momentum kept, restitution e; an object pressed against a wall acts as infinitely heavy
   // restitution of the pair: object material averaged with the robot's plastic bumper (0.5)
   const p=props(g),mr=ROBOT_KG,mo=blocked?1e9:p.m,e=Math.min(.8,(p.e+BUMPER)/2),{v1:vr2,v2:vo2}=impact1D(mr,mo,vr,vo,e);
   if(!blocked)setVel(g,vox+(vo2-vo)*c.nx,voz+(vo2-vo)*c.nz);
   const hx=Math.cos(robot.rotation.y),hz=-Math.sin(robot.rotation.y);bump((vr2-vr)*(c.nx*hx+c.nz*hz),mo>mr);
   if(quiet<=0&&vr-vo>.08){quiet=2.5;const nm=g.userData.label||'object',kg=p.m<1?(p.m*1000).toFixed(0)+' g':p.m.toFixed(1)+' kg';
    const what='the '+nm+' ('+kg+(blocked?', pressed against a wall':'')+')',moved=(g.userData.roll?'rolled':'slid')+' away at '+vo2.toFixed(2)+' m/s';
    const msg=vr2<-.02?'Bot hit '+what+' and bounced back at '+(-vr2).toFixed(2)+' m/s'+(blocked?'.':'; it '+moved+'.')
     :mo>mr?'Bot hit '+what+', which is heavier: the bot was nearly stopped ('+vr2.toFixed(2)+' m/s)'+(blocked?'.':' and it only '+moved+'.')
     :'Bot bumped '+what+'; it '+moved+' and the bot slowed to '+vr2.toFixed(2)+' m/s.';
    say&&say(msg,'stop');log&&log('collision',msg)}});
  // pushed boxes and furniture slide and stop by friction (μ·g), or stop against a wall
  slide.forEach((v,g)=>{const s=Math.hypot(v[0],v[1]);if(!g.parent||g.userData.contactManaged||s<.01){slide.delete(g);return}const nx=v[0]/s,nz=v[1]/s;if(stuck(g,nx,nz)){slide.delete(g);return}
   g.position.x+=v[0]*dt;g.position.z+=v[1]*dt;const ns=Math.max(0,s-MU*G*dt);v[0]=nx*ns;v[1]=nz*ns})}
 return{update};
}
