// SI units. An explicit reduced-order model; parameters require hardware calibration.
export const GRAVITY = 9.80665;
export const STEP = 1 / 120;
export const DEFAULTS = Object.freeze({
  mass: 3.99822528, radius: .0675, track: .251018, wheelbase: .151022,
  length: .24, width: .24, height: .16, rpm: 60, stallTorque: .32,
  stallCurrent: 2, idleCurrent: .15, wheelInertia: .0008, yawInertia: .06,
  mu: .75, crr: .025, stiffness: 25, yawDamping: .09, batteryWh: 44,
  nominalVoltage: 12, internalResistance: .12, deadband: 35,
  comHeight:.13, lateralGrip:4, contactRestitution:.05,
});
export const SURFACES = Object.freeze({
  dry: {mu:.75, crr:.025}, wet:{mu:.12, crr:.025},
  gravel:{mu:.55, crr:.07}, grass:{mu:.5, crr:.20},
  // Rubber tyre on the floors of the obstacle track; textbook ranges, not measured.
  asphalt:{mu:.8, crr:.015}, oak:{mu:.55, crr:.012},
  tiles:{mu:.5, crr:.01}, concrete:{mu:.7, crr:.015},
});
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function validateParameters(input={}) {
  const p={...DEFAULTS,...input};
  const ranges={mass:[.5,50],radius:[.02,.25],track:[.08,1],wheelbase:[.08,1],length:[.1,1.5],width:[.1,1.5],height:[.05,1],rpm:[10,300],stallTorque:[.02,3],stallCurrent:[.2,15],idleCurrent:[0,1],wheelInertia:[.0001,.03],yawInertia:[.001,5],mu:[.01,1.5],crr:[0,.4],stiffness:[1,40],yawDamping:[0,2],batteryWh:[1,500],nominalVoltage:[6,24],internalResistance:[0,1],deadband:[0,100]};
  Object.assign(ranges,{comHeight:[.02,.8],lateralGrip:[0,100],contactRestitution:[0,.8]});
  for(const [k,[a,b]] of Object.entries(ranges))if(!Number.isFinite(p[k])||p[k]<a||p[k]>b)throw Error(`${k} must be between ${a} and ${b}`);
  return Object.fromEntries(Object.keys(DEFAULTS).map(k=>[k,p[k]]));
}
export function integratePose(pose, distance, angle) {
  const scale=Math.abs(angle)<1e-8?1:Math.sin(angle/2)/(angle/2), mid=pose.yaw+angle/2;
  pose.x+=distance*scale*Math.cos(mid);pose.y+=distance*scale*Math.sin(mid);pose.yaw+=angle;
  return pose;
}
export function impact1D(m1,m2,u1,u2,e) {
  if(!(m1>0&&m2>0&&e>=0&&e<=1))throw Error('Invalid impact parameters');
  const J=(1+e)*(u1-u2)/(1/m1+1/m2);
  return {v1:u1-J/m1,v2:u2+J/m2,impulse:J};
}
export function fallingStep(y,v,h,{g=GRAVITY,restitution=0,floor=0}={}) {
  let next=y+v*h-.5*g*h*h, speed=v-g*h;
  if(next<floor){const hit=(v+Math.sqrt(v*v+2*g*Math.max(0,y-floor)))/g,remaining=Math.max(0,h-hit);speed=-(v-g*hit)*restitution;next=floor+speed*remaining-.5*g*remaining*remaining;speed-=g*remaining;if(next<floor){next=floor;speed=0}}
  return {y:next,v:speed};
}
export class DriveDynamics {
  constructor(parameters={}){this.p=validateParameters(parameters);this.reset();}
  reset(pose={x:0,y:0,yaw:0}){
    this.resetEpoch=(this.resetEpoch||0)+1;
    this.pose={...pose};this.odom={...pose};this.v=0;this.w=0;this.omega=[0,0];this.angles=[0,0];this.ticks=[0,0];
    this.current=[0,0];this.duty=[0,0];this.force=[0,0];this.slip=[0,0];this.energyWh=0;this.voltage=12.6;
    this.time=0;this.accumulator=0;this.droppedTime=0;this.normalForce=this.p.mass*GRAVITY;this.steps=0;this.accel=0;
    this.lateral=0;this.wheelNormal=Array(4).fill(this.normalForce/4);this.lateralForces=Array(4).fill(0);this.tipRisk=false;this.lastOptions={};
  }
  configure(parameters){this.p=validateParameters({...this.p,...parameters});}
  // Sign is electrical command; speed error changes motor no-load RPM, not the ground pose.
  advance(dt, commands, {pitch=0,roll=0,surface=null,error=[0,0],brake=false,hold=false,onStep=null,terrain=null,external=null,commandTransform=null,voltageScale=1}={}) {
    if(!Number.isFinite(dt)||dt<0)throw Error('dt must be finite and nonnegative');if(!Number.isFinite(voltageScale)||voltageScale<0||voltageScale>1)throw Error('Voltage scale must be 0–1');
    const allowed=Math.min(dt,.1);this.droppedTime+=dt-allowed;this.accumulator+=allowed;
    while(this.accumulator+1e-12>=STEP){
      const attitude=terrain?.(this)||{pitch,roll},load=typeof external==='function'?external(this):external;this.lastOptions={pitch:attitude.pitch,roll:attitude.roll,surface:surface?{...surface}:null,error:[...error],brake,hold,...(voltageScale!==1?{voltageScale}:{}),...(load?{external:{...load}}:{})};
      const adjusted=commandTransform?.({left:commands[0],right:commands[1],brake,source:this.controlSource},this.time);const used=adjusted?[adjusted.left,adjusted.right]:commands;if(adjusted){this.lastOptions.voltageScale=clamp(adjusted.voltageScale??1,0,1);this.lastOptions.brake=!!adjusted.brake}this.inputCommand=[...used];this.substep(STEP,used,this.lastOptions);if(onStep)onStep(STEP,this);
      this.accumulator=Math.max(0,this.accumulator-STEP);this.time+=STEP;this.steps++;
    }
    return this;
  }
  substep(h,commands,{pitch,roll,surface,error,brake,hold,external=null,voltageScale=1}) {
    const p=this.p,m=p.mass,r=p.radius,mu=surface?.mu??p.mu,crr=surface?.crr??p.crr;
    const normal=m*GRAVITY*Math.max(0,Math.cos(pitch)*Math.cos(roll));this.normalForce=normal;
    // Quasi-static load transfer, four contact patches (FL, FR, RL, RR).
    const longitudinal=m*(this.accel+GRAVITY*Math.sin(pitch))*p.comHeight/(2*p.wheelbase),lateral=m*(this.v*this.w+GRAVITY*Math.sin(roll))*p.comHeight/(2*p.track);
    const raw=[normal/4-longitudinal-lateral,normal/4-longitudinal+lateral,normal/4+longitudinal-lateral,normal/4+longitudinal+lateral];this.tipRisk=raw.some(n=>n<0);
    const supported=raw.map(n=>Math.max(0,n)),total=supported.reduce((a,b)=>a+b,0)||1;this.wheelNormal=supported.map(n=>n*normal/total);this.lateralForces.fill(0);
    const soc=clamp(1-this.energyWh/p.batteryWh,0,1),ocv=9.6+3*soc;
    const amps=this.current[0]+this.current[1];this.voltage=Math.max(0,ocv-p.internalResistance*amps)*voltageScale;
    const maxW=p.rpm*Math.PI/30, previousV=this.v;
    for(let i=0;i<2;i++) {
      const u=clamp(Number(commands[i])||0,-1,1), effective=Math.abs(u)*255<p.deadband?0:u;
      this.duty[i]=effective;
      const sideSpeed=this.v+(i?1:-1)*this.w*p.track/2;
      const noLoad=maxW*Math.max(.5,1+(error[i]||0));
      const motor=effective||brake?2*p.stallTorque*clamp(effective*this.voltage/p.nominalVoltage-this.omega[i]/noLoad,-1,1):0;
      let force=0;const sideNormal=this.wheelNormal[i]+this.wheelNormal[i+2],want=p.stiffness*(this.omega[i]*r-sideSpeed);
      for(const k of [i,i+2]){const x=(k<2?1:-1)*p.wheelbase/2,N=this.wheelNormal[k],limit=mu*N;
       const fy=clamp(-p.lateralGrip*(this.lateral+this.w*x),-limit,limit),fx=want*N/Math.max(1e-9,sideNormal),scale=Math.min(1,limit/Math.max(1e-12,Math.hypot(fx,fy)));
       force+=fx*scale;this.lateralForces[k]=fy*scale;
      }
      this.force[i]=force;
      this.omega[i]+=(motor-force*r-.002*this.omega[i])/(2*p.wheelInertia)*h;
      this.omega[i]=clamp(this.omega[i],-maxW*4,maxW*4);
      this.angles[i]+=this.omega[i]*h;this.ticks[i]=this.angles[i]/(2*Math.PI)*1200;
      this.current[i]=effective?2*(p.idleCurrent*Math.abs(effective)+(p.stallCurrent-p.idleCurrent)*Math.min(1,Math.abs(motor)/(2*p.stallTorque))):0;
      const peripheral=this.omega[i]*r;
      this.slip[i]=(peripheral-sideSpeed)/Math.max(.05,Math.abs(peripheral),Math.abs(sideSpeed));
    }
    const net=this.force[0]+this.force[1]-m*GRAVITY*Math.sin(pitch)+(external?.forward||0), resistance=crr*normal;
    let nv=this.v+((net-Math.sign(this.v||net)*resistance)/m+this.w*this.lateral)*h;
    if((Math.abs(this.v)<.002||Math.sign(nv)!==Math.sign(this.v))&&Math.abs(net)<=resistance)nv=0;
    this.v=hold?0:nv;
    const lateralMoment=this.lateralForces.reduce((sum,f,i)=>sum+f*(i<2?1:-1)*p.wheelbase/2,0);
    const fy=this.lateralForces.reduce((a,b)=>a+b,0)-m*GRAVITY*Math.sin(roll)+(external?.lateral||0);
    this.lateral+=(fy/m-this.w*this.v)*h;
    this.w+=((this.force[1]-this.force[0])*p.track/2+lateralMoment+(external?.yaw||0)-p.yawDamping*this.w*Math.min(1,mu/.75))/p.yawInertia*h;
    if(hold){this.w=0;this.lateral=0}
    this.accel=(this.v-previousV)/h;
    const mid=this.pose.yaw+this.w*h/2;integratePose(this.pose,hold?0:(previousV+this.v)/2*h,this.w*h);
    if(!hold){this.pose.x-=this.lateral*Math.sin(mid)*h;this.pose.y+=this.lateral*Math.cos(mid)*h;}
    integratePose(this.odom,(this.omega[0]+this.omega[1])*r*h/2,(this.omega[1]-this.omega[0])*r*h/p.track);
    this.energyWh+=this.voltage*(this.current[0]+this.current[1])*h/3600;
  }
  snapshot(){return{model:'DYNORA four-contact reduced-order tyre/motor v3',fixed_step_s:STEP,sim_time_s:this.time,dropped_time_s:this.droppedTime,parameters:{...this.p},ground_truth:{...this.pose,v:this.v,w:this.w,lateral_v:this.lateral},encoder_odometry:{...this.odom},wheel_rad_s:[...this.omega],wheel_ticks:this.ticks.map(Math.round),duty:[...this.duty],current_A:[...this.current],traction_N:[...this.force],slip_ratio:[...this.slip],normal_N:this.normalForce,wheel_normal_N:[...this.wheelNormal],wheel_lateral_N:[...this.lateralForces],tip_risk:this.tipRisk,battery_V:this.voltage,energy_Wh:this.energyWh};}
}
export function runBenchmarks() {
  const rows=[];
  function check(name,measured,expected,tolerance,unit){rows.push({name,measured,expected,tolerance,unit,error:Math.abs(measured-expected),pass:Math.abs(measured-expected)<=tolerance});}
  let f={y:10,v:0};for(let i=0;i<60;i++)f=fallingStep(f.y,f.v,STEP,{floor:-100});
  check('Free fall, 0.5 s',f.y,10-.5*GRAVITY*.5**2,1e-8,'m');
  const impact=impact1D(3.5,1.5,.6,-.2,.4);
  check('Impact: momentum',3.5*impact.v1+1.5*impact.v2,3.5*.6-1.5*.2,1e-10,'kg·m/s');
  check('Impact: restitution',impact.v2-impact.v1,.4*(.6+.2),1e-10,'m/s');
  const pose={x:0,y:0,yaw:0};for(let i=0;i<120;i++)integratePose(pose,.5*STEP,Math.PI/2*STEP);
  check('Constant curvature arc',pose.x,1/Math.PI,1e-8,'m');
  const drive=hz=>{const d=new DriveDynamics();for(let i=0;i<hz*2;i++)d.advance(1/hz,[.7,.7]);return d;};
  const a=drive(30),b=drive(144);check('30 / 144 FPS drive agreement',a.pose.x,b.pose.x,1e-9,'m');
  check('Symmetric motors stay straight',a.pose.y,0,1e-9,'m');
  const dry=drive(60),wet=new DriveDynamics({...DEFAULTS,mu:.08});for(let i=0;i<120;i++)wet.advance(STEP,[1,1]);
  check('Tyre force respects μN',Math.max(0,...wet.force.map(v=>Math.abs(v)-.08*wet.normalForce/2)),0,1e-10,'N');
  rows.push({name:'Wheel slip separates odometry from truth',measured:Math.abs(wet.odom.x-wet.pose.x),expected:'> 0.01',unit:'m',pass:Math.abs(wet.odom.x-wet.pose.x)>.01});
  return rows;
}
