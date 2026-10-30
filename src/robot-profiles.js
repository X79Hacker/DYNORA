import {DEFAULTS,validateParameters} from './dynamics.js';

// Illustrative engineering presets. All use the same four-wheel skid-steer
// solver; these are not calibrated replicas of commercial robots.
export const ROBOT_PROFILES=[
 {id:'research',name:'Research 4WD',color:0x35b7cf,description:'Original open research chassis and calibration.',parameters:{...DEFAULTS}},
 {id:'scout',name:'Scout Mini',color:0x358ee5,description:'Small covered rover, light and quick.',parameters:{...DEFAULTS,mass:2.1,radius:.045,track:.18,wheelbase:.13,length:.20,width:.16,rpm:95,stallTorque:.22,yawInertia:.025,comHeight:.10}},
 {id:'carrier',name:'Cargo Carrier',color:0xe7a739,description:'Wide cargo tray, heavier payload platform.',parameters:{...DEFAULTS,mass:12,radius:.08,track:.37,wheelbase:.30,length:.44,width:.34,rpm:45,stallTorque:1.1,stallCurrent:5.5,wheelInertia:.003,yawInertia:.32,comHeight:.18}},
 {id:'courier',name:'Indoor Courier',color:0xe06b62,description:'Tall enclosed body with a raised camera.',parameters:{...DEFAULTS,mass:8,radius:.065,track:.28,wheelbase:.22,length:.34,width:.25,rpm:55,stallTorque:.7,stallCurrent:3.5,wheelInertia:.002,yawInertia:.15,comHeight:.22}},
 {id:'utility',name:'Utility Rover',color:0x9d81e4,description:'Large wheels, wide stance and front bumper.',parameters:{...DEFAULTS,mass:6,radius:.09,track:.33,wheelbase:.24,length:.36,width:.28,rpm:65,stallTorque:.65,stallCurrent:3.5,wheelInertia:.002,yawInertia:.18,comHeight:.16}}
];
export function robotProfile(id='research'){const p=ROBOT_PROFILES.find(p=>p.id===id);if(!p)throw Error('Unknown rover profile');return {...p,parameters:validateParameters(p.parameters)}}
export function profileMounts(id,p){
 robotProfile(id);if(id==='research')return {camera:{x:.133,y:0,z:p.radius+.0680894+.037},tof:[[.113,0,.0064,0],[.097,.073,.0064,Math.PI/2],[.099,-.0725,.0064,-Math.PI/2],[-.113,0,.0064,Math.PI]]};
 const base=p.radius+.0680894,top=base+(id==='courier'?.245:id==='carrier'?.11:.09);
 return {camera:{x:p.length/2+.014,y:0,z:top+.022},tof:[[p.length/2+(id==='utility'?.056:.015),0,.025,0],[0,p.width/2+.015,.025,Math.PI/2],[0,-p.width/2-.015,.025,-Math.PI/2],[-p.length/2-.015,0,.025,Math.PI]]};
}
// Every added visible housing has the identical contact box.
export function profileBoxes(id,p){
 robotProfile(id);if(id==='research')return[];const b=p.radius+.0680894,out=[];
 const box=(name,x,y,z,w,h,d)=>out.push({name,x,y,z,w,h,d});
 if(id==='carrier'){box('Cargo tray',0,b+.056,0,p.length*.95,.018,p.width*.94);for(const z of[-1,1])box('Cargo rail',0,b+.093,z*p.width*.46,p.length*.95,.06,.012)}
 else box(id==='courier'?'Courier cabin':'Protective cover',0,b+(id==='courier'?.13:.06),0,p.length*.86,id==='courier'?.23:.08,p.width*.84);
 if(id==='utility')box('Front bumper',p.length/2+.023,b+.025,0,.034,.065,p.width+ .035);
 const m=profileMounts(id,p);box('Camera support',m.camera.x-.014,(b+m.camera.z)/2,0,.012,m.camera.z-b,.018);box('Raised camera',m.camera.x,m.camera.z,0,.024,.022,.028);
 for(const[x,y,z,yaw]of m.tof){const side=Math.abs(Math.sin(yaw))>.5;box('Active ToF housing',x,b+z,-y,side?.008:.024,.018,side?.024:.008)}return out;
}
export function boxVertices(b){return Float32Array.from([-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].flatMap(z=>[b.x+x*b.w/2,b.y+y*b.h/2,b.z+z*b.d/2]))))}

export function profileRadius(id,p){const bounds=profileBoxes(id,p);let x=Math.max(p.length/2,p.wheelbase/2+p.radius),z=Math.max(p.width/2,p.track/2+.02);for(const b of bounds){x=Math.max(x,Math.abs(b.x)+b.w/2);z=Math.max(z,Math.abs(b.z)+b.d/2)}return Math.hypot(x,z)}
export function profileHeight(id,p){return Math.max(p.radius+.146,...profileBoxes(id,p).map(b=>b.y+b.h/2))}
