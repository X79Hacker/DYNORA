import {GRAVITY} from './dynamics.js';
import {tyreSupportHeight} from './track-surface.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

// A fixed-step spring/damper for tyre compliance and chassis attitude. Falling
// cannot accelerate faster than gravity. Wheels follow support within 14 mm of
// compliance, then become airborne rather than stretching down into a hole.
export class TerrainRide{
 constructor(parameters={}){this.configure(parameters);this.ready=false;this.axes=[{x:0,v:0},{x:0,v:0},{x:0,v:0}];this.wheelOffsets=[0,0,0,0]}
 configure(parameters={}){this.p={heaveHz:13,attitudeHz:10,damping:.86,travel:.014,...this.p,...parameters};for(const[k,a,b]of[['heaveHz',3,18],['attitudeHz',3,15],['damping',.3,2],['travel',.002,.03]])if(!Number.isFinite(this.p[k])||this.p[k]<a||this.p[k]>b)throw Error(`Ride ${k} must be ${a}–${b}`);return this}
 step(h,{x,z,yaw,p,height,reset=false}){
  const c=Math.cos(yaw),s=Math.sin(yaw),a=p.wheelbase/2,b=p.track/2;
  const wheels=[[a,-b],[a,b],[-a,-b],[-a,b]];
  const support=wheels.map(([u,v])=>tyreSupportHeight(height,x+c*u+s*v,z-s*u+c*v,yaw,p.radius));
  const target=[support.reduce((a,b)=>a+b,0)/4,Math.atan2(support[0]+support[1]-support[2]-support[3],2*p.wheelbase),-Math.atan2(support[1]+support[3]-support[0]-support[2],2*p.track)];
  const moved=this.previous&&Math.hypot(x-this.previous.x,z-this.previous.z)>.25;
  if(!this.ready||reset||moved){this.axes.forEach((axis,i)=>{axis.x=target[i];axis.v=0});this.ready=true}
  else for(let i=0;i<3;i++){
   const axis=this.axes[i],omega=2*Math.PI*(i===0?this.p.heaveHz:this.p.attitudeHz),accel=omega*omega*(target[i]-axis.x)-2*this.p.damping*omega*axis.v;
   axis.v+=(i===0?Math.max(-GRAVITY,accel):accel)*h;axis.x+=axis.v*h;
   // Finite tyre compression: support cannot cut arbitrarily into a wheel.
   const limit=i===0?this.p.travel:.12;if(axis.x<target[i]-limit){axis.x=target[i]-limit;axis.v=Math.max(0,axis.v)}
  }
  const [y,pitch,roll]=this.axes.map(v=>v.x);
  // YXZ body rotation: the exact vertical component of each wheel centre.
  this.wheelOffsets=wheels.map(([u,v],i)=>clamp((support[i]+p.radius-y-u*Math.cos(roll)*Math.sin(pitch)+v*Math.sin(roll))/Math.max(.5,Math.cos(roll)*Math.cos(pitch))-p.radius,-this.p.travel,this.p.travel));
  this.previous={x,z};this.support=support;this.target=target;this.pose={y,pitch,roll};return this.pose;
 }
 metadata(){return {model:'120 Hz damped chassis heave, pitch and roll with rolling-circle tyre support',heave_frequency_hz:this.p.heaveHz,attitude_frequency_hz:this.p.attitudeHz,damping_ratio:this.p.damping,max_wheel_compliance_m:this.p.travel,fall_acceleration_limit_mps2:GRAVITY,limitations:'Reduced-order tyre compliance; not a full articulated suspension or rollover solver'}}
}
