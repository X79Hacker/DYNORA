// Shared analytic surfaces: rendering and tyre support use these same profiles.
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
export const BASELINE_HOLE=Object.freeze({r:.34,depth:.02,aspect:.82,edge:.6,roughness:.09});
export const POTHOLE_PRESETS={
 shallow:{name:'Shallow worn patch',r:.28,depth:.025,aspect:.85,edge:.42,roughness:.09},
 standard:{name:'Broken asphalt',r:.34,depth:.05,aspect:.82,edge:.35,roughness:.13},
 deep:{name:'Deep damaged patch',r:.38,depth:.09,aspect:.78,edge:.45,roughness:.17}
};
export function validateHole(o){for(const[k,a,b]of[['r',.12,.65],['depth',.005,.15],['aspect',.5,1.3],['edge',.15,.8],['roughness',0,.2]])if(!Number.isFinite(o[k])||o[k]<a||o[k]>b)throw Error(`Pothole ${k} must be ${a}–${b}`);return o}
export function edgeRadius(o,theta){const p=(o.seed||1)*.73;return 1+(o.roughness||0)*(.52*Math.sin(3*theta+p)+.3*Math.sin(7*theta-p)+.18*Math.cos(11*theta+p))}
export function holePoint(o,theta,fraction=1){const r=o.r*edgeRadius(o,theta)*fraction,x=r*Math.cos(theta),z=r*(o.aspect||1)*Math.sin(theta),a=o.angle||0,c=Math.cos(a),s=Math.sin(a);return{x:(o.x||0)+x*c-z*s,z:(o.z||0)+x*s+z*c}}
export function holeCoordinates(o,x,z){const a=o.angle||0,c=Math.cos(a),s=Math.sin(a),dx=x-(o.x||0),dz=z-(o.z||0),u=(dx*c+dz*s)/o.r,v=(-dx*s+dz*c)/(o.r*(o.aspect||1)),theta=Math.atan2(v,u);return{theta,q:Math.hypot(u,v)/edgeRadius(o,theta)}}
export function holeDepth(o,x,z){const{q}=holeCoordinates(o,x,z);if(q>=1)return 0;const core=1-smooth((q-(1-(o.edge||.35)))/(o.edge||.35));const grain=(1-Math.cos(q*Math.PI))*Math.abs(Math.sin(x*47+z*23)*Math.cos(z*41-x*13));return o.depth*core*(1-.035*grain)}
export function outlineHole(o,n=96){return Array.from({length:n},(_,i)=>holePoint(o,i/n*Math.PI*2))}
export function bumpHeight(distance,width,height,profile='smooth'){
 const q=Math.abs(distance-width/2)/(width/2);if(q>=1)return 0;
 if(profile==='flat')return height*clamp((1-q)/.55);
 if(profile==='rounded')return height*Math.sqrt(Math.max(0,1-q*q));
 return height*.5*(1+Math.cos(Math.PI*q));
}
export function tyreSupportHeight(height,x,z,yaw,radius,width=.035){
 let centre=-Infinity;const c=Math.cos(yaw),s=Math.sin(yaw);
 // Upper envelope of a rolling circle, across three strips of tyre width.
 for(let i=-10;i<=10;i++){const d=radius*i/10,rise=Math.sqrt(Math.max(0,radius*radius-d*d));for(const side of[-.5,0,.5])centre=Math.max(centre,height(x+c*d+s*width*side,z-s*d+c*width*side)+rise)}
 return centre-radius;
}
export function contactLossFactor(previous,next,radius,damping=.18){if(!previous)return 1;const rise=next.reduce((sum,v,i)=>sum+Math.max(0,v-previous[i]),0)/next.length;return Math.exp(-damping*rise/Math.max(.005,radius))}

export class SpeedReference{
 constructor(p={}){this.value=0;this.configure(p)}
 configure(p={}){this.p={target:.28,acceleration:.25,braking:.6,strategy:'adaptive',...this.p,...p};for(const[k,a,b]of[['target',.02,1.2],['acceleration',.03,2],['braking',.05,3]])if(!Number.isFinite(this.p[k])||this.p[k]<a||this.p[k]>b)throw Error(`${k} must be ${a}–${b}`);if(!['adaptive','constant'].includes(this.p.strategy))throw Error('Invalid speed strategy');return this}
 step(dt,{factor=1,zone='',limit=Infinity}={}){const factors={'pothole':.35,'speed bumps':.45,'gravel patch':.6,'slippery surface':.65,'soft surface (grass)':.65,'narrow passage':.5};this.limit=Math.max(0,limit);const scale=this.p.strategy==='adaptive'?(factors[zone]||1):1;this.requested=Math.min(this.p.target,this.limit)*scale*clamp(factor);const rate=this.requested>this.value?this.p.acceleration:this.p.braking;const delta=clamp(this.requested-this.value,-rate*Math.max(0,dt),rate*Math.max(0,dt));this.value=Math.max(0,this.value+delta);if(factor<=.001)this.value=0;return this.value}
 reset(){this.value=0}
}
