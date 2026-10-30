import * as THREE from 'three';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const smooth=x=>{x=clamp(x,0,1);return x*x*x*(x*(x*6-15)+10)};

// Both MakeHuman rigs have detached ankle bones. Aim the thigh and shin,
// then place the independent ankle; never lengthen a bone to reach a target.
export function createHumanRig(g,model,meshes){
 const bones={};model.traverse(o=>{if(o.isBone)bones[o.name]=o});
 const rest=Object.values(bones).map(b=>[b,b.position.clone(),b.quaternion.clone(),b.scale.clone()]);
 g.updateWorldMatrix(true,true);
 const local=b=>g.worldToLocal(b.getWorldPosition(V()));
 const localQ=b=>g.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(b.getWorldQuaternion(new THREE.Quaternion()));
 const pelvis=bones.pelvis,hip=local(pelvis),qHip=localQ(pelvis);
 const chains=['l','r'].map(side=>{
  const upper=bones['thigh_'+side],lower=bones['calf_'+side],foot=bones['foot_'+side],ball=bones['ball_'+side];
  const a=local(upper),b=local(lower),c=local(foot),q=localQ(foot);
  const shin=lower.worldToLocal(foot.getWorldPosition(V()));
  const toe=local(ball).sub(c);q.premultiply(new THREE.Quaternion().setFromAxisAngle(V(0,1,0),Math.atan2(toe.z,toe.x)));
  return {side,upper,lower,foot,ball,shin,L1:a.distanceTo(b),L2:b.distanceTo(c),z:a.z,ankle:c.y,footQ:q,plant:null,swing:null,stance:null};
 });
 const arms=['l','r'].map(side=>{const upper=bones['upperarm_'+side],lower=bones['lowerarm_'+side],hand=bones['hand_'+side];return {side,upper,lower,hand,L1:local(upper).distanceTo(local(lower)),L2:local(lower).distanceTo(local(hand))}});
 let phase=0,weight=0,seated=false,idle=0,lastPhase=0;
 const reset=()=>{for(const[b,p,q,s]of rest){b.position.copy(p);b.quaternion.copy(q);b.scale.copy(s)}g.updateWorldMatrix(true,true)};
 const world=p=>g.localToWorld(p.clone());
 function position(b,p){b.position.copy(b.parent.worldToLocal(world(p)));b.updateWorldMatrix(false,true)}
 function orient(b,q){b.quaternion.copy(b.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(g.getWorldQuaternion(new THREE.Quaternion()).multiply(q)));b.updateWorldMatrix(false,true)}
 function aim(b,from,to){
  const q=b.getWorldQuaternion(new THREE.Quaternion());
  q.premultiply(new THREE.Quaternion().setFromUnitVectors(from.clone().normalize(),to.clone().normalize()));
  b.quaternion.copy(b.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));b.updateWorldMatrix(false,true);
 }
 function solve(upper,lower,end,target,pole,L1,L2,tip=null){
  const a=local(upper),delta=target.clone().sub(a),d=clamp(delta.length(),Math.abs(L1-L2)+.00001,L1+L2-.00001),axis=delta.normalize();
  const bend=pole.clone().sub(a).addScaledVector(axis,-pole.clone().sub(a).dot(axis)).normalize();
  const along=(L1*L1-L2*L2+d*d)/(2*d),height=Math.sqrt(Math.max(0,L1*L1-along*along));
  const knee=a.clone().addScaledVector(axis,along).addScaledVector(bend,height),ankle=a.clone().addScaledVector(axis,d);
  aim(upper,lower.getWorldPosition(V()).sub(upper.getWorldPosition(V())),world(knee).sub(world(a)));
  const from=tip?lower.localToWorld(tip.clone()):end.getWorldPosition(V());
  aim(lower,from.sub(lower.getWorldPosition(V())),world(ankle).sub(lower.getWorldPosition(V())));
  return ankle;
 }
 function finish(){g.updateWorldMatrix(true,true);for(const m of meshes)if(m.isSkinnedMesh)m.skeleton.update()}
 function apply({sit=0,height=.46,feet=null,walkWeight=0,cycle=0,footHeight=0,footAdvance=.54}){
  reset();g.userData.seated=sit>.999;
  // Pelvis centre is above the contact surface; the body mesh supplies the
  // remaining soft tissue. Foot targets stay on the floor during lowering.
  const h=hip.y+(height+.105-hip.y)*sit-.065*walkWeight+.009*Math.cos(cycle*4*Math.PI)*walkWeight;
  position(pelvis,V(hip.x+.12*sit,h,hip.z));orient(pelvis,qHip);
  const lean=.32*Math.sin(Math.PI*sit)+.06*sit+.035*walkWeight;
  const spine=bones.spine_01;
  const spineQ=localQ(spine);spineQ.premultiply(new THREE.Quaternion().setFromAxisAngle(V(0,0,1),-lean));orient(spine,spineQ);
  for(let i=0;i<chains.length;i++){
   const c=chains[i],target=feet?.[i]||V(.012+footAdvance*sit,c.ankle+footHeight*sit,c.z);
   const actual=solve(c.upper,c.lower,c.foot,target,V(1,h-.25,c.z),c.L1,c.L2,c.shin);
   position(c.foot,actual);orient(c.foot,c.footQ);
  }
  for(let i=0;i<arms.length;i++){
   const a=arms[i],side=i===0?-1:1,A=local(a.upper),knee=local(chains[i].lower);
   // Sagittal arm swing: elbows stay beside the torso. The wrist trajectory
   // remains inside anatomical reach instead of forcing both arms straight.
   const swing=Math.sin(cycle*Math.PI*2+(i?Math.PI:0))*.17*walkWeight;
   const neutral=V(A.x+.025+swing,A.y-(a.L1+a.L2)*.955+.025*walkWeight*(1-Math.cos(cycle*Math.PI*2)),A.z+side*.025);
   const seatedTarget=local(chains[i].upper).lerp(knee,.65).add(V(.005,.075,side*.02)),target=neutral.lerp(seatedTarget,sit);
   solve(a.upper,a.lower,a.hand,target,V(A.x+.18,A.y-.23,A.z+side*.045),a.L1,a.L2);
   // Local Y follows fingers, local Z is the palm normal. Palms face inward
   // at rest and turn downward onto the thighs when sitting.
   const finger=V(.035,-1,0).lerp(V(.98,-.20,0),sit).normalize();
   const palm=V(0,0,-side).lerp(V(0,-1,0),sit);palm.addScaledVector(finger,-palm.dot(finger)).normalize();
   const shaft=local(a.hand).sub(local(a.lower)).normalize(),oldPalm=V(0,0,1).applyQuaternion(localQ(a.hand));
   oldPalm.addScaledVector(shaft,-oldPalm.dot(shaft)).normalize();const wantPalm=palm.clone().addScaledVector(shaft,-palm.dot(shaft)).normalize();
   const twist=Math.atan2(shaft.dot(oldPalm.clone().cross(wantPalm)),oldPalm.dot(wantPalm));
   const forearm=localQ(a.lower);forearm.premultiply(new THREE.Quaternion().setFromAxisAngle(shaft,twist*.75));orient(a.lower,forearm);
   const proximal=bones['lowerarm_prox_'+a.side];if(proximal)proximal.quaternion.setFromAxisAngle(V(0,1,0),-twist*.5);
   const across=finger.clone().cross(palm).normalize();
   orient(a.hand,new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across,finger,palm)));
   for(const name of ['index','middle','ring','pinky'])for(const joint of ['02','03']){const bone=bones[name+'_'+joint+'_'+a.side];if(bone){const e=new THREE.Euler().setFromQuaternion(bone.quaternion);e.x=joint==='02'?.055:.035;bone.quaternion.setFromEuler(e)}}
  }
  finish();
 }
 function resetFeet(){phase=0;weight=0;idle=0;for(const c of chains){c.plant=c.swing=null;c.stance=null}}
 function animate({dt=1/60,distance=0,speed=0,ground=()=>0,reset:clear=false}={}){
  if(clear)resetFeet();seated=false;dt=clamp(dt,0,.05);
  const C=clamp(.72+speed*.15,.76,1.02);phase+=Math.max(0,distance)/C;
  weight+=(clamp(speed/.35,0,1)-weight)*(1-Math.exp(-dt*12));
  if(speed<.025)idle+=dt;else idle=0;
  g.updateWorldMatrix(true,true);
  const feet=chains.map((c,i)=>{
   const t=(phase+i*.5)%1,stance=t<.62,neutral=world(V(.012,c.ankle,c.z));
   const floorAt=p=>{p.y=ground(p.x,p.z)+c.ankle*g.getWorldScale(V()).y;return p};
   if(!c.plant)c.plant=floorAt(neutral.clone());
   if(weight<.01||idle>.45){c.plant.lerp(floorAt(neutral),smooth(Math.min(1,dt*12)));c.stance=null;return g.worldToLocal(c.plant.clone())}
   if(stance){if(c.stance===false)c.plant=floorAt(world(V((.31-t)*C,c.ankle,c.z)));c.swing=null}
   else{
    if(c.stance!==false)c.swing=c.plant.clone();
    const u=(t-.62)/.38,remaining=(1-t)*C/Math.max(speed,.1),landing=floorAt(world(V(.31*C+speed*remaining,c.ankle,c.z)));
    const p=(c.swing||c.plant).clone().lerp(landing,smooth(u));p.y+=Math.sin(Math.PI*u)**2*.085*weight;
    c.stance=false;return g.worldToLocal(p);
   }
   c.stance=true;return g.worldToLocal(c.plant.clone());
  });
  apply({feet,walkWeight:weight,cycle:phase});
 }
 function action(progress,height=.46,options={}){seated=progress>.999;resetFeet();apply({sit:clamp(progress,0,1),height,...options})}
 function stand(){seated=false;resetFeet();apply({})}
 function sit(height=.46){action(1,height)}
 // Compatibility for static previews and the old player; controllers use real
 // travelled distance through animate(), which also plants feet in world space.
 function pose(p,a){if(seated)return;const dt=1/60;lastPhase=p;const cycle=p/(Math.PI*2);const feet=chains.map((c,i)=>{const t=(cycle+i*.5)%1,stance=t<.62,u=stance?t/.62:(t-.62)/.38;return V((stance?.24-.48*u:-.24+.48*smooth(u))*a,c.ankle+(stance?0:Math.sin(Math.PI*u)**2*.075*a),c.z)});apply({feet,walkWeight:clamp(a,0,1),cycle})}
 function joints(){return Object.fromEntries(['pelvis','thigh_l','calf_l','foot_l','ball_l','thigh_r','calf_r','foot_r','ball_r','upperarm_l','lowerarm_l','hand_l','upperarm_r','lowerarm_r','hand_r'].map(n=>[n,bones[n].getWorldPosition(V()).toArray()]))}
 stand();return {pose,stand,sit,animate,action,joints,resetFeet,bones,legLengths:chains.map(c=>[c.L1,c.L2]),armLengths:arms.map(a=>[a.L1,a.L2])};
}
