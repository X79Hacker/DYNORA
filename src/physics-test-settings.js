import {robotProfile} from './robot-profiles.js';
import {DEFAULTS,SURFACES,validateParameters} from './dynamics.js';
import {BASELINE_HOLE,validateHole,bumpHeight,holeDepth} from './track-surface.js';
// color: the lane in the 2D view; the 3D view draws a texture (surface-looks.js).
export const LAB_SURFACES={dry:{name:'Dry floor',color:'#344253',...SURFACES.dry},asphalt:{name:'Asphalt',color:'#4a4f57',...SURFACES.asphalt},oak:{name:'Oak wood floor',color:'#b48a5e',...SURFACES.oak},tiles:{name:'Ceramic tiles · dry',color:'#9fc9dc',...SURFACES.tiles},concrete:{name:'Concrete / stone',color:'#8f8b86',...SURFACES.concrete},wet:{name:'Wet / low grip',color:'#5b8aa3',...SURFACES.wet},gravel:{name:'Loose gravel',color:'#7a7064',...SURFACES.gravel},grass:{name:'Soft grass',color:'#2f5520',...SURFACES.grass}};
export const LAB_DEFAULTS={schema:'dynora-test-lab-11',case:'surface',surface:'dry',robotProfile:'research',robot:{...DEFAULTS},ride:{heaveHz:13,attitudeHz:10,damping:.86,travel:.014},drive:{duty:.7,turn:0,duration:12,driveSeconds:7,brake:false,initialSpeed:0},collision:{target:'light',mass:.2,friction:.5,restitution:.15},terrain:{kind:'pothole',...BASELINE_HOLE,bumpH:.025,bumpW:.22,bumpGap:.4,bumpCount:3,rampH:.15,rampLength:1.5},air:{quality:'balanced',wind:2,angle:0,gust:.5,frequency:.3,viscosity:.000015,baffle:false,density:1.225,robotCd:1.05,robotArea:.04},balloon:{radius:.22,gasDensity:.164,envelope:.012,payload:.008,cd:.47,tether:true,length:1.6,stiffness:4,damping:.15,addedMass:.5}};
export function validateLabSettings(input={}){
 const d=structuredClone(LAB_DEFAULTS),s={...d,...input};for(const k of ['robot','ride','drive','collision','terrain','air','balloon','control','spawn'])s[k]={...d[k],...input[k]};
 if(!['surface','collision','terrain','air'].includes(s.case))throw Error('Choose a valid experiment');if(!LAB_SURFACES[s.surface]&&s.surface!=='custom')throw Error('Unknown surface');robotProfile(s.robotProfile);s.robot=validateParameters(s.robot);
 const check=(group,k,a,b,integer=false)=>{const n=s[group][k];if(!Number.isFinite(n)||n<a||n>b||integer&&!Number.isInteger(n))throw Error(`${group} ${k} must be ${a}–${b}${integer?' (integer)':''}`)};
 if(!['manual','scripted'].includes(s.control.mode))throw Error('Choose manual or scripted control');check('control','timeScale',.25,2);
 for(const[k,a,b]of[['x',-3.5,3.5],['z',-1.2,1.2],['yaw',-180,180]])check('spawn',k,a,b);
 for(const[k,a,b]of[['x',-3.5,3.5],['z',-1.2,1.2],['yaw',-180,180]])check('collision',k,a,b);
 for(const[k,a,b]of[['duty',0,1],['turn',-1,1],['duration',2,60],['driveSeconds',0,60],['initialSpeed',0,2]])check('drive',k,a,b);
 for(const[k,a,b]of[['heaveHz',3,18],['attitudeHz',3,15],['damping',.3,2],['travel',.002,.03]])check('ride',k,a,b);
 if(!['light','medium','heavy','wall','custom'].includes(s.collision.target))throw Error('Unknown collision target');for(const[k,a,b]of[['mass',.05,1000],['friction',0,2],['restitution',0,.8]])check('collision',k,a,b);
 if(!['pothole','bumps','ramp','flat'].includes(s.terrain.kind))throw Error('Unknown terrain');validateHole(s.terrain);for(const[k,a,b]of[['bumpH',.005,.08],['bumpW',.08,.6],['bumpGap',.14,1],['rampH',0,.4],['rampLength',.6,3]])check('terrain',k,a,b);check('terrain','bumpCount',1,6,true);if(s.terrain.bumpGap<s.terrain.bumpW+.04)throw Error('Bump gap must exceed width by 4 cm');
 if(!['low','balanced','high'].includes(s.air.quality))throw Error('Unknown flow quality');for(const[k,a,b]of[['wind',0,15],['angle',-180,180],['gust',0,5],['frequency',0,3],['viscosity',0,.1],['density',.5,2],['robotCd',.05,2],['robotArea',.001,1]])check('air',k,a,b);
 for(const[k,a,b]of[['radius',.06,.5],['gasDensity',0,2],['envelope',.002,.2],['payload',0,.5],['cd',.05,2],['length',.2,3.5],['stiffness',.1,20],['damping',0,2],['addedMass',0,1]])check('balloon',k,a,b);
 for(const[g,k]of[['drive','brake'],['air','baffle'],['balloon','tether']])if(typeof s[g][k]!=='boolean')throw Error(`${g} ${k} must be true or false`);return s;
}
export function labSurface(s){return s.surface==='custom'?{name:'Custom',mu:s.robot.mu,crr:s.robot.crr}:LAB_SURFACES[s.surface]}
export function labHeight(s){if(s.case!=='terrain')return()=>0;const t=s.terrain;if(t.kind==='pothole')return(x,z)=>-holeDepth({...t,x:0,z:0,seed:11},x,z);if(t.kind==='bumps')return x=>{let h=0;for(let i=0;i<t.bumpCount;i++)h=Math.max(h,bumpHeight(x+.3-i*t.bumpGap,t.bumpW,t.bumpH,'smooth'));return h};if(t.kind==='ramp')return x=>bumpHeight(x+t.rampLength/2,t.rampLength,t.rampH,'flat');return()=>0}
export function trackSettingsFromLab(s){s=validateLabSettings(s);return {track:{id:'bench',seed:1},terrain:{schema:'dynora-terrain-5',track:'bench',holes:[{...BASELINE_HOLE,...Object.fromEntries(['r','depth','aspect','edge','roughness'].map(k=>[k,s.terrain[k]])),s:3.2,d:0,seed:11,enabled:s.terrain.kind==='pothole'}],bumps:[{h:s.terrain.bumpH,width:s.terrain.bumpW,gap:s.terrain.bumpGap,n:s.terrain.bumpCount,profile:'smooth'}]},ride:s.ride}}

// Old saved trials remain scripted. The new UI explicitly chooses Manual for a
// first visit, without changing the interpretation of an older experiment file.
LAB_DEFAULTS.control={mode:'scripted',timeScale:1};
LAB_DEFAULTS.spawn={x:-1.2,z:0,yaw:0};
Object.assign(LAB_DEFAULTS.collision,{x:.1,z:0,yaw:0});

export function liveResetReasons(before,after){
 const paths=['robotProfile','case','spawn','drive.initialSpeed','terrain','air.quality','air.baffle','balloon.radius','robot.radius','robot.wheelbase','robot.track','robot.length','robot.width','robot.height'];
 const get=(s,path)=>path.split('.').reduce((a,k)=>a?.[k],s);
 const changed=paths.filter(path=>JSON.stringify(get(before,path))!==JSON.stringify(get(after,path)));
 if((before.collision.target==='wall')!==(after.collision.target==='wall'))changed.push('collision.target');
 for(const key of ['x','z','yaw'])if(before.collision[key]!==after.collision[key])changed.push('collision.'+key);
 return changed;
}

export function transferableTerrain(input){
 const s=validateLabSettings(input);
 if(!['pothole','bumps'].includes(s.terrain.kind))throw Error('Direct track transfer supports potholes and bumps. Use Track > Ramps for a ramp.');
 if(s.terrain.kind==='pothole'&&s.terrain.r*s.terrain.aspect*(1+s.terrain.roughness)>.575)throw Error('This pothole is wider than the isolated track lane. Reduce its width.');
 return trackSettingsFromLab(s);
}
