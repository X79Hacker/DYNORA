import {saveCameraSnapshot} from './camera-snapshot.js';
import {addCaster} from './caster-model.js';
import {wireRecordingControls} from './recording-controls.js';
import {publishRecording,restoreRecordingDownloads,resetRecordingDownloads} from './recording-download.js';
import {initRoverTools} from './rover-tools.js';
import {SensorRayIndex} from './sensor-ray-index.js';
import {FrameProfiler} from './frame-budget.js';
import {BASELINE_HOLE,holeDepth,holePoint,holeCoordinates,outlineHole,bumpHeight} from './track-surface.js';
import {bumpTaper,closedBumpGeometry,bridgeSupportStations} from './track-structures.js';
import {closestRouteProgress} from './rover-spawn.js';
import {TerrainRide} from './terrain-ride.js';
import {createSwingGate} from './track-gate.js';
import {renderDisplayFrame} from './render-frame.js';
import {floorWithHoles,potholeGeometry} from './track-geometry.js';
import {initTrackTests,loadTrackSettings} from './track-tests.js';
import {initStudioLayout} from './studio-layout.js';
import {initSpeedControl} from './speed-control.js';
import {initVisualStudio} from './visual-studio.js';
import {createFurniture} from './visual-models.js';
import {initLab,LAB_COLUMNS} from './lab.js';
import {randomStream} from './app-random.js';
const random=randomStream('track');
import {DEFAULTS} from './dynamics.js';
import {createRover} from './robot-model.js';
import {initResearch,PHYSICS_COLUMNS} from './research.js';
import {makeHuman} from './human.js';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as THREE from 'three';
import {csvText,datasetZip,verifyDatasetZip,datasetFiles} from './dataset-export.js';
import {initMove} from './move3d.js';
import {initLighting} from './lighting.js';
import {initPaint} from './paint.js';
import {initRoll,ROUND} from './roll.js';
import {initNarrate} from './narrate.js';
import {initRotate} from './rotate.js';
import {initTask} from './task.js';
import {initCollide,ROBOT_KG} from './collide.js';
import {initWeights} from './weights.js';
import {initWheelErr,sideErr,wheelErrInfo} from './wheelerr.js';
import {G} from './physics.js';
import {BufferGeometryUtils} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import './style.css';

const dark=true;
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x0b1220);
const renderer=new THREE.WebGLRenderer({antialias:true});
const frameProfiler=new FrameProfiler();
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;
document.body.prepend(renderer.domElement);
const cam=new THREE.PerspectiveCamera(50,1,0.1,100);
let PW=240,PH=150;function resize(){renderer.setSize(innerWidth,innerHeight);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();}
addEventListener('resize',resize);resize();

scene.add(new THREE.HemisphereLight(0xffffff,0x667788,0.5));
const sun=new THREE.DirectionalLight(0xffffff,0.7);
sun.position.set(5,10,4);sun.castShadow=true;
sun.shadow.camera.left=-8;sun.shadow.camera.right=8;sun.shadow.camera.top=8;sun.shadow.camera.bottom=-8;sun.shadow.mapSize.set(2048,2048);
scene.add(sun);

// floor (light wooden planks) + grid
const floor=new THREE.Mesh(new THREE.PlaneGeometry(10,6),new THREE.MeshStandardMaterial({roughness:.55,map:(()=>{const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');for(let r=0;r<8;r++){let px=-random()*200;while(px<512){const w=180+random()*160;x.fillStyle='hsl('+(30+random()*6)+','+(32+random()*10)+'%,'+(66+random()*8)+'%)';x.fillRect(px,r*64,w,64);x.fillStyle='rgba(0,0,0,.18)';x.fillRect(px,r*64,1.5,64);px+=w}x.fillStyle='rgba(0,0,0,.2)';x.fillRect(0,r*64,512,1.5)}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(5,3);t.anisotropy=8;return t})()}));
floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const grid=new THREE.GridHelper(10,10,0x888888,0x888888);grid.scale.z=6/10;grid.position.y=0.005;grid.material.opacity=0.08;grid.material.transparent=true;scene.add(grid);
const obstacles=[],FIXED0=[];
function box(w,h,d,x,z,color,solid=true){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color}));
  m.position.set(x,h/2,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);
  if(solid)obstacles.push(m);return m;
}
// walls (height 2.5, semi-transparent so you can see in); 10 x 6 m room, door gap in the south wall at x = -1.5
const wallMat=0xb9c2cf;
function wall(w,d,x,z){const m=box(w,2.5,d,x,z,wallMat);m.material.transparent=true;m.material.opacity=0.45;}
wall(10.4,.2,0,-3.1);wall(3.3,.2,-3.65,3.1);wall(6.3,.2,2.05,3.1);wall(.2,6.2,-5.1,0);wall(.2,6.2,5.1,0);

function part(g,w,h,d,x,y,z,c,s){const geo=s==='s'?new THREE.SphereGeometry(w/2,28,18):s?new THREE.CylinderGeometry(w/2,s,h,28):new RoundedBoxGeometry(w,h,d,3,Math.min(.05,Math.min(w,h,d)/2.5));const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:c,roughness:0.7}));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;g.add(m);obstacles.push(m);return m}
const MOV=[];function grp(x,z,r=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=r;scene.add(g);MOV.push(g);return g}
const rr=(a,b)=>a+random()*(b-a);
function cx(w,h,draw,rep){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;if(rep)t.repeat.set(rep[0],rep[1]);t.anisotropy=8;return t}

// ===== OBSTACLE TRACK environment =====
// x east, z south. The room, its furniture and the decor stay the same; the track itself is chosen in Build → Track
// (7 ready-made tracks or a random one from a seed). A track is a closed centre line plus features placed along it
// at a distance s (m) from the start line. Height features (rises = ramp up + deck + ramp down, stairs, speed bumps) shape
// the drive surface; surface features (gravel, slippery, grass, narrow passage, swing gate) lie on top of them.
const DST=0x8b95a1,STEEL=0xc9ced6;
const fx=g=>{FIXED0.push(g);return g};
const lin=(a,b,v)=>Math.min(1,Math.max(0,(v-a)/(b-a)));
const TWD=.9;   // default track width (m); a track can set its own (w)
const D2R=Math.PI/180;

// ----- ready-made tracks: centre line from turtle steps (S length, L/R radius degrees) or from control points; features at s (m) or f (fraction of the length) -----
const PRESETS=[
 {id:'bench',name:'Isolated terrain laboratory',w:1.2,paved:true,start:[-3.1,2.1,0],turtle:[['S',6.2],['L',.8,90],['S',2.6],['L',.8,90],['S',6.2],['L',.8,90],['S',2.6],['L',.8,90]],feats:[{type:'bumps',s:12.8,n:3,gap:.4,width:.22,h:.025,profile:'smooth'}],holes:[{...BASELINE_HOLE,s:3.2,d:0}]},
 {id:'classic',name:'Classic loop',island:true,start:[-3.1,2.25,0],turtle:[['S',6.2],['L',.8,90],['S',2.9],['L',.8,90],['S',6.2],['L',.8,90],['S',2.9],['L',.8,90]],
  feats:[{type:'slip',s:1.7,len:2.6},{type:'rise',s:4.7,slot:1.6,h:.12,up:16.7,down:8.5,names:['short climb','ramp top','ramp (down)'],tags:['','','Ramp (down)']},
   {type:'bumps',s:8.25,n:4,gap:.3},{type:'gravel',s:10.1,len:2},{type:'rise',s:13.11,slot:8,h:.2,up:11.3,down:5.7,names:['ramp (up)','bridge','inclined slope'],tags:['Ramp (up)','Bridge','Inclined Slope (down)']}]},
 {id:'hairpins',name:'Hairpins',start:[-3,2,0],turtle:[['S',6],['L',.8,90],['S',2.5],['L',.8,90],['S',.6],['L',.65,90],['S',1.3],['R',.65,180],['S',1.3],['L',.65,90],['S',.4],['L',.65,90],['S',1.3],['R',.65,180],['S',1.3],['L',.65,90],['L',.6,90],['S',2.7],['L',.8,90]],
  feats:[{type:'rise',s:1,slot:3.6,h:.18,up:12,down:9},{type:'bumps',s:7.6,n:4,gap:.3},{type:'gravel',s:9.9,len:1.6},{type:'slip',s:12.7,len:1.2},{type:'rise',s:26.4,slot:2.5,h:.1,up:10,down:10}]},
 {id:'sbends',name:'S-bends',start:[-2.9,1.8,0],turtle:[['S',1.1],['L',.7,40],['R',.7,80],['L',.7,80],['R',.7,80],['L',.7,40],['S',1.1],['L',.9,90],['S',1.9],['L',.9,90],
  ['S',1.1],['L',.7,40],['R',.7,80],['L',.7,80],['R',.7,80],['L',.7,40],['S',1.1],['L',.9,90],['S',1.9],['L',.9,90]],
  feats:[{type:'slip',f:.1,len:1.5},{type:'rise',f:.3,slot:2.2,h:.12,up:12,down:12},{type:'gravel',f:.5,len:1.5},{type:'bumps',f:.72,n:4,gap:.3},{type:'rise',f:.84,slot:2.4,h:.15,up:14,down:9}]},
 {id:'kidney',name:'Kidney',pts:[[-3,1.9],[0,1.98],[3,1.9],[3.65,.95],[3.6,-1.15],[2.85,-1.9],[1.5,-1.85],[.5,-1],[-.5,-1],[-1.5,-1.85],[-2.85,-1.9],[-3.6,-1.15],[-3.65,.95]],
  feats:[{type:'rise',f:.04,slot:4.5,h:.22,up:10,down:8},{type:'bumps',f:.33,n:4,gap:.3},{type:'gravel',f:.52,len:1.8},{type:'slip',f:.74,len:1.5}]},
 {id:'climb',name:'Long climb (oval)',start:[-1.8,2.05,0],turtle:[['S',3.6],['L',2.05,180],['S',3.6],['L',2.05,180]],
  feats:[{type:'rise',s:.9,slot:3.1,h:.3,up:12,down:15},{type:'bumps',s:5.2,n:4,gap:.3},{type:'rise',s:10.3,slot:3.1,h:.2,up:8,down:20},{type:'gravel',s:15.2,len:2.2}]},
 {id:'rough',name:'Rough course',pts:[[-3.1,1.75],[.5,1.8],[3.3,1.5],[3.7,-.6],[2.6,-1.85],[-.4,-1.7],[-3.1,-1.85],[-3.7,0]],
  feats:[{type:'gravel',f:.05,len:2},{type:'bumps',f:.2,n:5,gap:.28},{type:'slip',f:.32,len:2},{type:'gravel',f:.5,len:2},{type:'bumps',f:.64,n:3,gap:.3},{type:'slip',f:.76,len:1.6},{type:'rise',f:.87,slot:1.5,h:.08,up:10,down:10}]},
 // test course: 1.1 m wide paved track with a wooden fence, cameras in the corners; driven clockwise from the start (north-west):
 // stairs → ramp up 10° onto a raised deck → gravel → narrow passage (0.8 m) → grass → ramp down 10° → swing gate at the entrance → tiles → bump area
 {id:'course',name:'Test course',w:1.1,fence:true,paved:true,cams:true,decor:'course',start:[-2.85,-1.95,0],turtle:[['S',5.7],['R',.9,90],['S',2.05],['R',.9,90],['S',5.7],['R',.9,90],['S',2.05],['R',.9,90]],
  feats:[{type:'stairs',s:.9,n:3,hs:.04,tread:.15,top:.3},{type:'rise',s:2.6,slot:11.58,h:.2645,up:10,down:10,names:['ramp (up)','raised deck','ramp (down)'],tags:['Ramp Up','','Ramp Down']},
   {type:'gravel',s:4.5,len:1.5},{type:'narrow',s:7.4,len:1.5,w:.8},{type:'grass',s:10.8,len:1.5},{type:'slip',s:15.4,len:1.5,tiles:true},{type:'bumps',s:18.2,n:4,gap:.29,h:.05}],
  // a shortcut lane across the middle: from the bottom straight by the entrance (s 14.9), through the swing gate in the side fence, to the top straight (s 2.35)
  shortcut:{from:14.9,to:2.35,via:[[-1.2,.35],[-.75,-.35]],w:.9},
  // two potholes in the asphalt, a little bigger than the robot (its wheels span about 54 × 44 cm), in the middle of the track
  // (d: m to the right of the centre line): a 5 cm deep one and a slightly larger, 10 cm deep one
  holes:[{s:14.55,d:0,r:.325,depth:.05},{s:19.55,d:0,r:.35,depth:.1}]}];
function turtle(start,steps){let[x,z,a]=start;a*=D2R;const P=[[x,z]];
 steps.forEach(([k,p,deg])=>{if(k==='S'){const n=Math.max(1,Math.ceil(p/.4));for(let i=0;i<n;i++){x+=Math.cos(a)*p/n;z-=Math.sin(a)*p/n;P.push([x,z])}}
  else{const sg=k==='L'?1:-1,cxp=x-Math.sin(a)*p*sg,czp=z-Math.cos(a)*p*sg,n=Math.max(2,Math.ceil(deg/15));for(let i=1;i<=n;i++){const b=a+sg*deg*D2R*i/n;x=cxp+Math.sin(b)*p*sg;z=czp+Math.cos(b)*p*sg;P.push([x,z])}a+=sg*deg*D2R}});
 P.pop();return P}   // the last point is the start again (closed curve)
// ----- random tracks: seeded, so the same seed gives the same track -----
function rng(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const BX=3.9,BZ0=-2.15,BZ1=2.1;   // the centre line stays in this box, clear of the walls and the furniture along them
function checkLoop(c){const n=600,P=c.getSpacedPoints(n),L=c.getLength(),st=L/n;   // inside the box, no bend tighter than 0.5 m, no two parts closer than 1.15 m
 for(const p of P)if(Math.abs(p.x)>BX||p.z<BZ0||p.z>BZ1)return false;
 for(let i=0;i<n;i++){const a=P[(i+n-3)%n],b=P[i],d=P[(i+3)%n],ab=a.distanceTo(b),bd=b.distanceTo(d),ad=a.distanceTo(d),cr=Math.abs((b.x-a.x)*(d.z-a.z)-(b.z-a.z)*(d.x-a.x));if(cr>1e-9&&ab*bd*ad/(2*cr)<.5)return false}
 const k=Math.ceil(2.2/st);for(let i=0;i<n;i++)for(let j=i+k;j<n;j++){if(n-(j-i)<k)continue;if(P[i].distanceTo(P[j])<1.15)return false}return true}
function randomTrack(seed){const R=rng(seed),ri=(a,b)=>a+R()*(b-a);
 for(let tries=0;tries<400;tries++){const n=6+Math.floor(R()*6),pts=[],th0=2.4;
  for(let k=0;k<n;k++){const th=th0-2*Math.PI*(k+ri(-.25,.25))/n,r=R()<.25?ri(.3,.55):ri(.6,1);pts.push([Math.max(-BX,Math.min(BX,BX*.98*r*Math.cos(th))),Math.max(BZ0,Math.min(BZ1,2.05*r*Math.sin(th)))])}
  const c=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(p[0],0,p[1])),true,'centripetal'),L=c.getLength();if(L<15||L>34||!checkLoop(c))continue;
  const pool=['rise','bumps','gravel','slip','rise','bumps','gravel','slip','grass','stairs','narrow','gate'].sort(()=>R()-.5),feats=[];let s=ri(.9,1.6);
  for(const type of pool.slice(0,3+Math.floor(R()*4))){let f;
   if(type==='rise'){const h=ri(.08,.25),up=ri(8,16),down=ri(6,14);f={type,h,up,down,slot:h/Math.tan(up*D2R)+h/Math.tan(down*D2R)+ri(.5,2)}}
   else if(type==='bumps')f={type,n:3+Math.floor(R()*3),gap:ri(.26,.36)};
   else if(type==='stairs')f={type,n:2+Math.floor(R()*2),hs:ri(.025,.04),tread:.15,top:ri(.3,.6)};
   else if(type==='narrow')f={type,len:ri(1,1.6),w:.7};else if(type==='gate')f={type};else f={type,len:ri(1.2,2.4)};
   f.s=s;s+=flen(f)+ri(.6,2);if(s>L-.8)break;feats.push(f)}
  return{id:'random',seed,name:'Random #'+seed,pts,feats}}
 return Object.assign({},PRESETS.find(p=>p.id==='classic'),{id:'random',seed,name:'Random #'+seed+' (no valid layout, classic used)'})}
const HEIGHT_T=new Set(['rise','stairs','bumps']);   // these shape the surface; the other types lie on top of it
const flen=f=>f.type==='rise'?f.slot:f.type==='bumps'?(f.n-1)*f.gap+(f.width||.14):f.type==='stairs'?2*f.n*f.tread+f.top:f.type==='gate'?.2:f.len;

// ----- the current track: centre line, features, height + zone raster (2 cm cells over the room) -----
let TR=null,TESTS=null,terrainPhysics=null,applyLabTerrain=null;
const RX0=-5,RZ0=-3,RES=.02,GX=500,GZ=300,HG=new Float32Array(GX*GZ),BASE_HG=new Float32Array(GX*GZ),ZG=new Uint8Array(GX*GZ),ZN=['','track'];
function baseHeight(x,z){const fi=(x-RX0)/RES-.5,fj=(z-RZ0)/RES-.5,i=Math.floor(fi),j=Math.floor(fj);if(i<0||j<0||i>=GX-1||j>=GZ-1)return 0;const u=fi-i,v=fj-j,k=j*GX+i;return(BASE_HG[k]*(1-u)+BASE_HG[k+1]*u)*(1-v)+(BASE_HG[k+GX]*(1-u)+BASE_HG[k+GX+1]*u)*v}
function HT(x,z){return baseHeight(x,z)-TR.holes.reduce((sum,o)=>sum+(o.enabled===false?0:holeDepth(o,x,z)),0)}
function zoneCell(x,z){const i=Math.floor((x-RX0)/RES),j=Math.floor((z-RZ0)/RES);return i<0||j<0||i>=GX||j>=GZ?'':ZN[ZG[j*GX+i]]}
// a rise keeps its height; an angle sets the ramp length (h / tan angle); the flat top takes what is left of the slot (at least 0.3 m)
function fitRise(f){const room=f.slot-.3;f.up=Math.max(f.up,Math.atan(f.h/Math.max(.05,room-f.h/Math.tan(f.down*D2R)))/D2R);f.down=Math.max(f.down,Math.atan(f.h/Math.max(.05,room-f.h/Math.tan(f.up*D2R)))/D2R);
 f.upL=f.h/Math.tan(f.up*D2R);f.dnL=f.h/Math.tan(f.down*D2R);f.top=f.slot-f.upL-f.dnL}
const wrapS=s=>((s%TR.L)+TR.L)%TR.L;
function featAt(s){s=wrapS(s);for(const f of TR.feats)if(s>=f.s0&&s<=f.s0+flen(f))return f;return null}   // height feature at s
function surfAt(s){s=wrapS(s);for(const f of TR.surfs)if(s>=f.s0&&s<=f.s0+flen(f))return f;return null}   // surface feature at s
// stairs: n steps up (riser hs, tread depth), a flat top, n steps down
function fh(f,s,x,z){const d=s-f.s0;
 if(f.type==='rise')return d<f.upL?f.h*d/f.upL:d<f.upL+f.top?f.h:f.h*Math.max(0,1-(d-f.upL-f.top)/f.dnL);
 if(f.type==='stairs'){const up=f.n*f.tread;return d<up?(Math.floor(d/f.tread)+1)*f.hs:d<up+f.top?f.n*f.hs:Math.max(0,f.n-1-Math.floor((d-up-f.top)/f.tread))*f.hs}
 if(f.type==='bumps'){const width=f.width||.14,k=Math.max(0,Math.min(f.n-1,Math.round((d-width/2)/f.gap)));const c=at(s,0),offset=(x-c.x)*c.nx+(z-c.z)*c.nz;return bumpHeight(d-k*f.gap,width,f.h||.03,f.profile||'smooth')*bumpTaper(offset,TR.hw)}return 0}
const sh=(f,x,z)=>f.type==='gravel'?.012+.006*(Math.sin(x*31+z*7)+Math.sin(z*29-x*11)):f.type==='grass'?.004:0;   // a surface's own small height
// Analytic broken-edge basin, shared by raster, visible geometry and tyre support.
const holeDip=(o,rho,x,z)=>o.enabled===false?0:holeDepth(o,x,z);
const SZ={bumps:'speed bumps',stairs:'stairs',gravel:'gravel patch',slip:'slippery surface',grass:'soft surface (grass)',narrow:'narrow passage',gate:'gate'};
function fzone(f,s){const d=s-f.s0;if(f.type==='rise'){const N=f.names||['ramp (up)','bridge','ramp (down)'];return d<f.upL?N[0]:d<f.upL+f.top?N[1]:N[2]}return SZ[f.type]}
function hS(s,x,z){s=wrapS(s);const f=featAt(s),u=surfAt(s);return(f?fh(f,s,x,z):0)+(u?sh(u,x,z):0)}
const CP=new THREE.Vector3(),CT=new THREE.Vector3();
function at(s,d){const u=wrapS(s)/TR.L;TR.curve.getPointAt(u,CP);TR.curve.getTangentAt(u,CT);const l=Math.hypot(CT.x,CT.z)||1,nx=-CT.z/l,nz=CT.x/l;return{x:CP.x+nx*d,z:CP.z+nz*d,nx,nz,tx:CT.x/l,tz:CT.z/l}}   // point d m to the right of the centre line
function makeTrack(id,seed){const P=id==='random'?randomTrack(seed):PRESETS.find(p=>p.id===id)||PRESETS.find(p=>p.id==='classic'),pts=P.turtle?turtle(P.start,P.turtle):P.pts;
 const curve=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(p[0],0,p[1])),true,'centripetal');curve.arcLengthDivisions=3000;const L=curve.getLength();
 // height features must not overlap each other, nor surface features each other; a surface may lie on a height feature (gravel on a deck)
 const all=P.feats.map(f=>Object.assign({},f,{s0:f.s!==undefined?f.s:f.f*L})).sort((a,b)=>a.s0-b.s0),feats=[],surfs=[];
 [[feats,f=>HEIGHT_T.has(f.type)],[surfs,f=>!HEIGHT_T.has(f.type)]].forEach(([out,ok])=>{let end=.8;all.filter(ok).forEach(f=>{if(f.s0<end||f.s0+flen(f)>L-.6)return;f.up0=f.up;f.down0=f.down;f.hs0=f.hs;out.push(f);end=f.s0+flen(f)+.3})});
 const w=P.w||TWD;return loadTrackSettings({id:P.id,seed:P.seed,name:P.name,island:!!P.island,curve,L,feats,surfs,w,hw:w/2,fence:!!P.fence,paved:!!P.paved,cams:!!P.cams,decor:P.decor||'',shortcut:P.shortcut||null,holes:(P.holes||[]).map(o=>({...o})),lane:null,route:(()=>{try{return P.shortcut&&localStorage.getItem('rsw_route_'+P.id)||'loop'}catch(e){return'loop'}})()})}
// ----- shortcut lane (Test course): its own centre line from the track's inner edge at `from`, through `via`, to the inner edge at `to` -----
function lane(){const sc=TR.shortcut;if(!sc)return null;if(TR.lane)return TR.lane;const hw=TR.hw,P=[at(sc.from,hw-.1),at(sc.from,hw+.35),...sc.via.map(([x,z])=>({x,z})),at(sc.to,hw+.35),at(sc.to,hw-.1)];
 const c=new THREE.CatmullRomCurve3(P.map(p=>new THREE.Vector3(p.x,0,p.z)),false,'centripetal');c.arcLengthDivisions=1000;return TR.lane={curve:c,L:c.getLength(),hw:sc.w/2}}
function laneAt(s,d){const ln=lane(),u=Math.max(0,Math.min(1,s/ln.L));ln.curve.getPointAt(u,CP);ln.curve.getTangentAt(u,CT);const l=Math.hypot(CT.x,CT.z)||1,nx=-CT.z/l,nz=CT.x/l;return{x:CP.x+nx*d,z:CP.z+nz*d,nx,nz,tx:CT.x/l,tz:CT.z/l}}
// the robot's default route: the whole loop, or (with a shortcut) start → top junction → down the lane through the gate → bottom junction → on to the start
function routeCurve(){if(TR.route!=='shortcut'||!TR.shortcut)return TR.curve;const sc=TR.shortcut,ln=lane(),P=[];
 for(let s=0;s<=sc.to-.6;s+=.3){const c=at(s,0);P.push([c.x,c.z])}
 for(let s=ln.L;s>=0;s-=.3){const c=laneAt(s,0);P.push([c.x,c.z])}
 for(let s=sc.from+.6;s<TR.L-.15;s+=.3){const c=at(s,0);P.push([c.x,c.z])}
 const c=new THREE.CatmullRomCurve3(P.map(p=>new THREE.Vector3(p[0],0,p[1])),true,'centripetal');c.arcLengthDivisions=3000;return c}
function stamp(){HG.fill(0);ZG.fill(0);ZN.length=2;const zi=n=>{let k=ZN.indexOf(n);if(k<0){k=ZN.length;ZN.push(n)}return k},L=TR.L,ds=.008,n=Math.ceil(L/ds),HW=TR.hw;
 for(let k=0;k<n;k++){const s=k*ds,c=at(s,0),f=featAt(s),u=surfAt(s),zid=zi(u?fzone(u,s):f?fzone(f,s):s<.6||s>L-.6?'start area':'track');
  for(let d=-HW;d<=HW+1e-6;d+=.01){const x=c.x+c.nx*d,z=c.z+c.nz*d,i=Math.floor((x-RX0)/RES),j=Math.floor((z-RZ0)/RES);if(i<0||j<0||i>=GX||j>=GZ)continue;const q=j*GX+i,h=(f?fh(f,s,x,z):0)+(u?sh(u,x,z):0);if(!ZG[q]||h>=HG[q]){HG[q]=Math.max(HG[q],h);ZG[q]=zid}}}
 // the shortcut lane: flat floor, zone "shortcut" (where it overlaps the track, the track keeps its zone)
 const ln=lane();if(ln){const zs=zi('shortcut');for(let s=0;s<=ln.L;s+=.008){const c=laneAt(s,0);for(let d=-ln.hw;d<=ln.hw+1e-6;d+=.01){const i=Math.floor((c.x+c.nx*d-RX0)/RES),j=Math.floor((c.z+c.nz*d-RZ0)/RES);if(i>=0&&j>=0&&i<GX&&j<GZ&&!ZG[j*GX+i])ZG[j*GX+i]=zs}}}
 BASE_HG.set(HG);
 // potholes: the surface dips (the only place where it goes below the floor); zone "pothole"
 TR.holes.forEach(o=>{const c=at(o.s,o.d);o.x=c.x;o.z=c.z;o.angle=Math.atan2(c.tz,c.tx);o.base=baseHeight(c.x,c.z);if(o.enabled===false)return;const zp=zi('pothole');o.x=c.x;o.z=c.z;const n=Math.ceil(o.r*1.5/RES)+1,ci=Math.floor((c.x-RX0)/RES),cj=Math.floor((c.z-RZ0)/RES);
  for(let j=cj-n;j<=cj+n;j++)for(let i=ci-n;i<=ci+n;i++){if(i<0||j<0||i>=GX||j>=GZ)continue;const x=RX0+(i+.5)*RES,z=RZ0+(j+.5)*RES,rho=Math.hypot(x-c.x,z-c.z);if(holeCoordinates(o,x,z).q>=1)continue;const q=j*GX+i;HG[q]-=holeDip(o,rho,x,z);ZG[q]=zp}})}

// ----- track visuals (all in TG, rebuilt on every change); rails are solid (ToF sensors see them) -----
const TG=new THREE.Group();scene.add(TG);let TOBS=[];
const T2=(draw,rep)=>cx(256,256,draw,rep);
const rampT=T2((x,s)=>{x.fillStyle='#4b5563';x.fillRect(0,0,s,s);for(let i=0;i<2600;i++){x.fillStyle='rgba(255,255,255,'+rr(0,.12)+')';x.fillRect(rr(0,s),rr(0,s),2,2)}x.fillStyle='#facc15';x.fillRect(0,0,16,s);x.fillRect(s-16,0,16,s)});
const plankT=T2((x,w)=>{for(let r=0;r<4;r++){x.fillStyle='hsl('+rr(26,32)+',40%,'+rr(36,44)+'%)';x.fillRect(0,r*64,w,64);x.fillStyle='rgba(0,0,0,.35)';x.fillRect(0,r*64,w,2)}},[1,3]);
const gravT=T2((x,s)=>{x.fillStyle='#5e574d';x.fillRect(0,0,s,s);for(let i=0;i<3000;i++){const v=rr(60,130)|0;/* compacted base under the loose stones: darker, so a rut where the stones were pushed away shows */x.fillStyle='rgb('+v+','+(v-6)+','+(v-14)+')';x.beginPath();x.arc(rr(0,s),rr(0,s),rr(1,3.5),0,7);x.fill()}},[2,2]);
const chk=cx(128,128,(x,s)=>{for(let i=0;i<8;i++)for(let j=0;j<8;j++){x.fillStyle=(i+j)%2?'#111':'#fff';x.fillRect(i*16,j*16,16,16)}});
const MT={ramp:new THREE.MeshStandardMaterial({color:0xffffff,map:rampT,roughness:.85}),deck:new THREE.MeshStandardMaterial({color:0xffffff,map:plankT,roughness:.75}),gravel:new THREE.MeshStandardMaterial({color:0xffffff,map:gravT,roughness:1}),
 slip:new THREE.MeshStandardMaterial({color:0x7cc4f2,roughness:.04,metalness:.2,transparent:true,opacity:.75}),start:new THREE.MeshStandardMaterial({map:chk,roughness:.6}),
 side:new THREE.MeshStandardMaterial({color:0x5b4636,roughness:.8,side:THREE.DoubleSide}),post:new THREE.MeshStandardMaterial({color:0x6b7280}),bar1:new THREE.MeshStandardMaterial({color:0xfacc15}),bar2:new THREE.MeshStandardMaterial({color:0x111827}),
 bump:new THREE.MeshStandardMaterial({color:0xfacc15,roughness:.6}),bumpB:new THREE.MeshStandardMaterial({color:0x111111,roughness:.6}),stone:new THREE.MeshStandardMaterial({color:0x9a948a,roughness:1}),dash:new THREE.MeshBasicMaterial({color:0x3b82f6,side:THREE.DoubleSide}),
 tiles:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.05,metalness:.1,map:T2((x,s)=>{x.fillStyle='#b9e2f5';x.fillRect(0,0,s,s);for(let i=0;i<4;i++)for(let j=0;j<4;j++){x.fillStyle='hsl(200,60%,'+rr(80,88)+'%)';x.fillRect(i*64+3,j*64+3,58,58)}},[2,2])}),
 grass:new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,map:T2((x,s)=>{x.fillStyle='#2c4f1c';x.fillRect(0,0,s,s);for(let i=0;i<9000;i++){x.strokeStyle='hsl('+rr(80,115)+','+rr(35,60)+'%,'+rr(14,34)+'%)';x.lineWidth=rr(.6,1.4);x.beginPath();const a=rr(0,s),b=rr(0,s);x.moveTo(a,b);x.lineTo(a+rr(-3,3),b-rr(2,6));x.stroke()}},[3,3])}),   // dense, dark turf under the blades
 blade:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.85,side:THREE.DoubleSide}),
 asphalt:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.95,map:T2((x,s)=>{x.fillStyle='#4a4f57';x.fillRect(0,0,s,s);for(let i=0;i<5000;i++){const v=rr(55,110)|0;x.fillStyle='rgb('+v+','+v+','+(v+4)+')';x.fillRect(rr(0,s),rr(0,s),1.5,1.5)}x.fillStyle='#e5e7eb';x.fillRect(6,0,5,s);x.fillRect(s-11,0,5,s)})}),
 wood:new THREE.MeshStandardMaterial({color:0xb07a45,roughness:.8}),stair:new THREE.MeshStandardMaterial({color:0xa8a29e,roughness:.9}),nose:new THREE.MeshStandardMaterial({color:0xfacc15,roughness:.6}),
 gate:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.75,map:T2((x,s)=>{x.fillStyle='#7c4a1e';x.fillRect(0,0,s,s);for(let i=0;i<8;i++){x.fillStyle='hsl(28,'+rr(38,48)+'%,'+rr(38,48)+'%)';x.fillRect(i*32+2,0,28,s)}x.fillStyle='#5b3613';x.fillRect(0,0,s,22);x.fillRect(0,s-22,s,22)})}),
 hole:new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,vertexColors:true,side:THREE.DoubleSide,map:T2((x,n)=>{x.fillStyle='#6c6255';x.fillRect(0,0,n,n);for(let i=0;i<2400;i++){const v=rr(75,155)|0;x.fillStyle='rgb('+v+','+(v-6)+','+(v-12)+')';x.fillRect(rr(0,n),rr(0,n),rr(1,3),rr(1,3))}})}),
 cam:new THREE.MeshStandardMaterial({color:0x6d28d9,roughness:.4}),lens:new THREE.MeshStandardMaterial({color:0x111111,roughness:.1}),fov:new THREE.MeshBasicMaterial({color:0xa855f7,transparent:true,opacity:.06,depthWrite:false,side:THREE.DoubleSide})};
// a strip of the track surface from s0 to s1, following the height; sides go down to the floor (or a thin slab for a bridge deck)
function ribbon(s0,s1,mat,{lift=.003,skirt=false,thin=0,label=''}={}){const n=Math.max(2,Math.ceil((s1-s0)/.035)),m=Math.ceil(TR.w/.035),pos=[],uv=[],idx=[],E=[[],[]],HW=TR.hw;
 for(let a=0;a<=n;a++){const s=s0+(s1-s0)*a/n,c=at(s,0);for(let b=0;b<=m;b++){const d=-HW+2*HW*b/m,x=c.x+c.nx*d,z=c.z+c.nz*d,y=hS(s,x,z)-TR.holes.reduce((a,o)=>a+(o.enabled===false?0:holeDepth(o,x,z)),0)+lift;pos.push(x,y,z);uv.push(b/m,s);if(b===0)E[0].push([x,y,z]);if(b===m)E[1].push([x,y,z])}}
 for(let a=0;a<n;a++)for(let b=0;b<m;b++){const i=a*(m+1)+b;idx.push(i,i+1,i+m+1,i+1,i+m+2,i+m+1)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
 const me=new THREE.Mesh(g,mat);me.receiveShadow=me.castShadow=!!(skirt||thin);if(label)me.userData.label=label;TG.add(me);
 if(skirt||thin){const sp=[];E.forEach(e=>{for(let i=0;i<e.length-1;i++){const[a,b]=[e[i],e[i+1]],ya=thin?a[1]-thin:0,yb=thin?b[1]-thin:0;sp.push(a[0],a[1],a[2],b[0],b[1],b[2],a[0],ya,a[2],b[0],b[1],b[2],b[0],yb,b[2],a[0],ya,a[2])}});
  for(const end of [0,n]){const a=E[0][end],b=E[1][end],ya=thin?a[1]-thin:0,yb=thin?b[1]-thin:0;const q=[a[0],a[1],a[2],a[0],ya,a[2],b[0],b[1],b[2],b[0],b[1],b[2],a[0],ya,a[2],b[0],yb,b[2]];if(end===n)for(let i=0;i<q.length;i+=9){const tri=q.slice(i,i+9);sp.push(...tri.slice(6,9),...tri.slice(3,6),...tri.slice(0,3))}else sp.push(...q);}
  const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(sp,3));sg.computeVertexNormals();const sm=new THREE.Mesh(sg,MT.side);sm.castShadow=sm.receiveShadow=true;TG.add(sm);obstacles.push(sm);TOBS.push(sm)}
 if(thin){const bg=g.clone();bg.translate(0,-thin,0);bg.setIndex(Array.from(bg.index.array).reverse());const underside=new THREE.Mesh(bg,MT.side);underside.userData.label='bridge underside';TG.add(underside);obstacles.push(underside);TOBS.push(underside)}
 return me}
function solid(geo,mat,x,y,z,ob){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;TG.add(m);if(ob){obstacles.push(m);TOBS.push(m)}return m}
function rails(s0,s1){for(const sd of[-1,1]){const n=Math.max(1,Math.round((s1-s0)/.45)),P=[];
 for(let i=0;i<=n;i++){const s=s0+(s1-s0)*i/n,c=at(s,sd*(TR.hw+.03)),y=hS(s,c.x,c.z);P.push([c.x,y,c.z]);solid(new THREE.BoxGeometry(.04,.3,.04),MT.post,c.x,y+.15,c.z,true)}
 for(let i=0;i<n;i++){const[a,b]=[P[i],P[i+1]],run=Math.hypot(b[0]-a[0],b[2]-a[2]),ang=Math.atan2(b[2]-a[2],b[0]-a[0]);
  [[.28,MT.bar1,.04,.04],[.12,MT.bar2,.04,.04],[.035,MT.bar2,.07,.055]].forEach(([dy,mt,h,w])=>{const m=solid(new THREE.BoxGeometry(Math.hypot(run,b[1]-a[1]),h,w),mt,(a[0]+b[0])/2,(a[1]+b[1])/2+dy,(a[2]+b[2])/2,true);m.rotation.order='YZX';m.rotation.y=-ang;m.rotation.z=Math.atan2(b[1]-a[1],run)})}}}
// floating name tags (main view only: layer 1 is not seen by the robot camera)
cam.layers.enable(1);
function tag(txt,bg,x,z,y=1.1,par=scene){const w=Math.max(260,txt.length*26+40),t=cx(w,72,(c,W,Hh)=>{c.fillStyle=bg;c.beginPath();c.roundRect(2,2,W-4,Hh-4,16);c.fill();c.strokeStyle='#fff';c.lineWidth=4;c.stroke();c.fillStyle='#fff';c.font='bold 38px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(txt,W/2,Hh/2+2)});
 const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:false}));s.scale.set(w/72*.28,.28,1);s.position.set(x,y,z);s.renderOrder=5;s.layers.set(1);par.add(s);
 const ln=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x,y-.14,z),new THREE.Vector3(x,HT(x,z)+.02,z)]),new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.6}));ln.layers.set(1);par.add(ln)}
const TAGC={rise:['#7c3aed','#2563eb','#dc2626'],bumps:'#d97706',gravel:'#0f766e',slip:'#2563eb',stairs:'#16a34a',grass:'#15803d',narrow:'#dc2626',gate:'#7c3aed'};
// many small boxes merged into one mesh per ~2 m chunk: fences stay solid for the ToF sensors but cheap to ray-cast
const EU=new THREE.Euler(),QU=new THREE.Quaternion(),M4=new THREE.Matrix4(),V3=new THREE.Vector3(),ONE=new THREE.Vector3(1,1,1);
function boxAt(w,h,d,x,y,z,yaw=0,pitch=0){const g=new THREE.BoxGeometry(w,h,d);EU.set(0,yaw,pitch,'YZX');QU.setFromEuler(EU);M4.compose(V3.set(x,y,z),QU,ONE);g.applyMatrix4(M4);return g}
function merged(geos,mat,label,ob=true,extra){if(!geos.length)return;const m=new THREE.Mesh(BufferGeometryUtils.mergeBufferGeometries(geos),mat);geos.forEach(g=>g.dispose());m.castShadow=m.receiveShadow=true;m.userData.fine=true;if(label)m.userData.label=label;if(extra)Object.assign(m.userData,extra);TG.add(m);if(ob){obstacles.push(m);TOBS.push(m)}return m}
// a low wooden fence d m to the side of the centre line (posts every ~0.5 m, two rails)
// pt / hf: the centre line it follows (the track by default, or the shortcut lane) and its surface height
function fence(s0,s1,d,{h=.28,label='wooden fence',pt=at,hf=hS}={}){if(s1-s0<.2)return;const n=Math.max(1,Math.round((s1-s0)/.5));let geos=[],P=[];
 for(let i=0;i<=n;i++){const s=s0+(s1-s0)*i/n,c=pt(s,d),y=hf(s,c.x,c.z);P.push([c.x,y,c.z]);geos.push(boxAt(.05,h,.05,c.x,y+h/2,c.z,Math.atan2(-c.tz,c.tx)))}
 for(let i=0;i<n;i++){const[a,b]=[P[i],P[i+1]],run=Math.hypot(b[0]-a[0],b[2]-a[2]),ang=Math.atan2(b[2]-a[2],b[0]-a[0]),l=Math.hypot(run,b[1]-a[1]),p=Math.atan2(b[1]-a[1],run);
  [h-.04,h*.4].forEach(dy=>geos.push(boxAt(l,.05,.025,(a[0]+b[0])/2,(a[1]+b[1])/2+dy,(a[2]+b[2])/2,-ang,p)));if(geos.length>40){merged(geos,MT.wood,label);geos=[]}}
 merged(geos,MT.wood,label)}
// fence on both sides along the whole track, except where a rise has its own rails and at gate posts; the inner side (+, where the
// shortcut lane is) also opens where the lane joins; the lane has its own fences
function fenceAll(){const both=[...TR.feats.filter(f=>f.type==='rise').map(f=>[f.s0+.25,f.s0+f.slot-.25]),...TR.surfs.filter(f=>f.type==='gate').map(f=>[f.s0-.12,f.s0+flen(f)+.12])],sc=TR.shortcut,w=sc?sc.w/2+.1:0;
 [[-1,both],[1,sc?both.concat([[sc.from-w,sc.from+w],[sc.to-w,sc.to+w]]):both]].forEach(([sd,skip])=>{skip=skip.slice().sort((a,b)=>a[0]-b[0]);
  let s=0;const runs=[];skip.forEach(([a,b])=>{if(a>s)runs.push([s,a]);s=Math.max(s,b)});runs.push([s,TR.L]);runs.forEach(([a,b])=>fence(a,b,sd*(TR.hw+.05)))});
 const ln=lane();if(ln)[-1,1].forEach(sd=>fence(.25,ln.L-.2,sd*(ln.hw+.05),{pt:laneAt,hf:(s,x,z)=>HT(x,z)}))}
// stairs: solid treads with a yellow nosing on each step edge
function stairs(f){const up=f.n*f.tread,ends=[];for(let k=0;k<f.n;k++)ends.push([f.s0+k*f.tread,f.s0+(k+1)*f.tread]);ends.push([f.s0+up,f.s0+up+f.top]);for(let k=0;k<f.n;k++)ends.push([f.s0+up+f.top+k*f.tread,f.s0+up+f.top+(k+1)*f.tread]);
 ends.forEach(([a,b])=>ribbon(a+.002,b-.002,MT.stair,{skirt:true,label:'stairs'}));
 const geos=[];ends.forEach(([a,b],i)=>{const sEdge=i<f.n?a:i===f.n?null:b;if(sEdge===null)return;const c=at(sEdge,0),y=hS(i<f.n?a+.01:b-.01,c.x,c.z);geos.push(boxAt(.03,.012,2*TR.hw,c.x,y+.006,c.z,Math.atan2(-c.tz,c.tx)))});merged(geos,MT.nose,'',false)}
// swing gate: two wooden leaves hinged on posts at the sides of a passage, meeting in the middle; see gateStep for the physics.
// On a track feature it spans the track; on the Test course it sits in the side fence, at the entrance of the shortcut lane.
let GATE=null;
function gate(f){const c=at(f.s0+.1,0);gateAt(c,TR.hw+.06)}
function gateAt(c,H){GATE=createSwingGate({parent:TG,frame:c,halfWidth:H,leafMaterial:MT.gate,postMaterial:MT.wood,onObstacle:mesh=>{obstacles.push(mesh);TOBS.push(mesh)}})}
// test-course extras: wall cameras with their field of view (main view only) and benches, planters and boxes inside the loop
function cams(){[[-4.82,-2.82],[4.82,-2.82],[4.82,2.82],[-4.82,2.82]].forEach(([x,z],i)=>{const g=new THREE.Group();g.position.set(x,2.15,z);g.rotation.y=Math.atan2(z,-x);TG.add(g);
  const b=new THREE.Mesh(new THREE.BoxGeometry(.22,.12,.12),MT.cam);g.add(b);const l=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.05,16),MT.lens);l.rotation.z=Math.PI/2;l.position.x=.13;g.add(l);
  const cone=new THREE.Mesh(new THREE.ConeGeometry(1.6,4.2,24,1,true),MT.fov);cone.rotation.z=Math.PI/2;cone.position.x=2.25;cone.rotation.y=0;g.add(cone);cone.layers.set(1);g.rotation.z=-.42;
  tag('Cam '+(i+1),'#6d28d9',x*.93,z*.93,2.55,TG)})}
function decor(){const S=(w,h,d,x,y,z,mt,lb)=>{const m=solid(new THREE.BoxGeometry(w,h,d),mt,x,y,z,true);if(lb)m.userData.label=lb;return m},leaf=new THREE.MeshStandardMaterial({color:0x15803d,roughness:.8});
 [[-2.05,-.6,0],[-2.45,-.15,0],[1.9,.55,Math.PI/2]].forEach(([x,z,r])=>{const b=S(r?.42:1.1,.05,r?1.1:.42,x,.44,z,MT.wood,'bench');[-1,1].forEach(q=>S(r?.36:.06,.42,r?.06:.36,x+(r?0:q*.45),.21,z+(r?q*.45:0),MT.post))});
 [[.1,.1],[1.5,-.65]].forEach(([x,z],i)=>{S(i?.45:1.1,.38,.45,x,.19,z,new THREE.MeshStandardMaterial({color:0x8b5a2b,roughness:.8}),'planter');for(let k=0;k<(i?1:4);k++){const p=new THREE.Mesh(new THREE.SphereGeometry(.17,16,12),leaf);p.position.set(x+(i?0:-.36+k*.24),.5,z);p.scale.set(1,1.3,1);p.castShadow=true;TG.add(p)}});
 [[-2.75,.55,.38],[-2.4,.75,.3],[2.7,-.55,.35]].forEach(([x,z,s])=>S(s,s,s,x,s/2,z,new THREE.MeshStandardMaterial({color:0xc9a26b,roughness:.85}),'wooden box'))}
// ----- loose gravel: every stone on a gravel patch sits in a 5 cm grid, so the tyres can find it and kick it -----
// Every stone under a tyre's contact patch moves: it is ploughed out of the tyre's path to the nearer side (that makes the ruts and
// the ridges beside them) or flicked out; the chance of a flick grows with wheel speed and wheelspin.
// A flicked stone leaves at up to the tyre's surface speed (more when the wheel spins): backwards and sideways out of the
// contact patch and a little up (stones that ride on the tread). It flies under gravity, bounces (e 0.3), slides to a stop
// (μ 0.6) and stays where it lands, so the gravel slowly scatters, as real gravel does.
// A small stone can also be caught in the tread: it rides on the tyre up the back of the wheel (whatever the speed, up to the
// top of the wheel), lets go somewhere behind the top with the speed of that point of the tyre (robot speed + wheel spin), and falls behind.
const STONES={sets:[],grid:new Map()},SO=new THREE.Object3D(),FC=new THREE.Color(),FLY=[],FLYMAX=400,CARRY=[],CARRYMAX=16,CV=new THREE.Vector3();
const flyM=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.03,0),MT.stone,FLYMAX+CARRYMAX);flyM.castShadow=true;flyM.frustumCulled=false;flyM.count=0;scene.add(flyM);
function stoneDraw(st){SO.position.set(st.x,st.y,st.z);SO.rotation.set(st.rx,st.ry,st.rz);SO.scale.set(st.sc,st.sc*st.sy,st.sc);SO.updateMatrix();st.set.im.setMatrixAt(st.i,SO.matrix);st.set.im.instanceMatrix.needsUpdate=true}
function stoneGrid(st,add){const k=Math.floor(st.x/.05)+','+Math.floor(st.z/.05);let a=STONES.grid.get(k);if(add){if(!a)STONES.grid.set(k,a=[]);a.push(st)}else if(a){const i=a.indexOf(st);if(i>=0)a.splice(i,1)}}
const WHEELS=[[DEFAULTS.wheelbase/2,DEFAULTS.track/2],[DEFAULTS.wheelbase/2,-DEFAULTS.track/2],[-DEFAULTS.wheelbase/2,DEFAULTS.track/2],[-DEFAULTS.wheelbase/2,-DEFAULTS.track/2]];   // tyre contact points in the robot frame (forward, left)
function gravelStep(dt){if(!dt)return;const sp=Math.abs(DR.v),slip=DR.slip||0;
 if((sp>.03||slip>0)&&STONES.sets.length){const ry=robot.rotation.y,hx=Math.cos(ry),hz=-Math.sin(ry),sx=Math.sin(ry),sz=Math.cos(ry),dir=Math.sign(DR.v)||1,tnow=PX.drive.time*1000;
  WHEELS.forEach(([a,b])=>{const wx=robot.position.x+hx*a+sx*b,wz=robot.position.z+hz*a+sz*b;if(zoneAt(wx,wz)!=='gravel patch')return;
   const ci=Math.floor(wx/.05),cj=Math.floor(wz/.05);
   for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const arr=STONES.grid.get((ci+i)+','+(cj+j));if(!arr)continue;
    for(let k=arr.length-1;k>=0;k--){const st=arr[k],dx=st.x-wx,dz=st.z-wz,al=dx*hx+dz*hz,lt=dx*sx+dz*sz;
     if(Math.abs(lt)>.035+.012*st.sc||Math.abs(al)>.04||tnow-st.t<1500)continue;st.t=tnow;   // under this tyre (6 cm wide), once per pass
     if(FLY.length>=FLYMAX)continue;
     const side=Math.sign(lt)||(random()<.5?-1:1);arr.splice(k,1);SO.scale.set(0,0,0);SO.updateMatrix();st.set.im.setMatrixAt(st.i,SO.matrix);st.set.im.instanceMatrix.needsUpdate=true;
     if(st.sc<.65&&CARRY.length<CARRYMAX&&random()<.12+.3*slip){CARRY.push({st,a,b,dir,ang:.15,rel:rr(1.7,2.9),x:st.x,y:st.y,z:st.z});continue}   // caught in the tread
     if(random()<Math.min(.9,.15+sp*.5+slip*.6)){const vs=sp+slip*rr(.3,.8),v0=vs*rr(.3,1),vl=vs*rr(0,.4);   // flicked: thrown backwards, sideways and up
      FLY.push({st,x:st.x,y:st.y+.01,z:st.z,vx:-dir*hx*v0+side*sx*vl,vz:-dir*hz*v0+side*sz*vl,vy:vs*rr(.2,.9),wx:rr(-20,20),wz:rr(-20,20)})}
     else{const dl=Math.max(.005,.035+.012*st.sc+rr(0,.015)-Math.abs(lt)),df=rr(0,.02),d=Math.hypot(dl,df),v=Math.sqrt(2*.6*G*d);   // ploughed: pushed out of the tyre's path (a rut), sliding to rest
      FLY.push({st,x:st.x,y:st.y,z:st.z,vx:(side*sx*dl+dir*hx*df)/d*v,vz:(side*sz*dl+dir*hz*df)/d*v,vy:0,wx:rr(-6,6),wz:rr(-6,6)})}}}})}
 // stones in the tread turn with the wheel: a rim point (local to the robot, so it follows the robot's tilt) from the bottom up the back
 if(CARRY.length){robot.updateMatrixWorld();const ry=robot.rotation.y,hx=Math.cos(ry),hz=-Math.sin(ry),R=WR+.008;
  for(let i=CARRY.length-1;i>=0;i--){const c=CARRY[i];c.ang+=sp/WR*dt;const go=c.ang>=c.rel||sp<.01||Math.sign(DR.v||c.dir)!==c.dir;
   CV.set(c.a-Math.sin(c.ang)*R*c.dir,WR-Math.cos(c.ang)*R,c.b);robot.localToWorld(CV);c.x=CV.x;c.y=CV.y;c.z=CV.z;c.st.rx+=sp/WR*dt;
   if(go){const lx=c.dir*sp*(1-Math.cos(c.ang)),ly=sp*Math.sin(c.ang);   // ground speed of that tyre point: hub speed + spin
    FLY.push({st:c.st,x:c.x,y:c.y,z:c.z,vx:hx*lx,vz:hz*lx,vy:ly,wx:rr(-15,15),wz:rr(-15,15)});CARRY.splice(i,1)}}}
 const n=Math.max(1,Math.ceil(dt/.01)),h=dt/n;   // 10 ms steps: a stone's hop lasts only a few hundredths of a second
 for(let i=FLY.length-1;i>=0;i--){const p=FLY[i],st=p.st;let rest=false;
  for(let k=0;k<n&&!rest;k++){p.vy-=G*h;p.x+=p.vx*h;p.y+=p.vy*h;p.z+=p.vz*h;st.rx+=p.wx*h;st.rz+=p.wz*h;const gy=HT(p.x,p.z);
   if(p.y<=gy){p.y=gy;if(p.vy<-.25){p.vy=-p.vy*.3;p.vx*=.6;p.vz*=.6;p.wx*=.5;p.wz*=.5}   // bounce
    else{p.vy=0;p.wx=p.wz=0;const v=Math.hypot(p.vx,p.vz),d=.6*G*h;if(v<=d)rest=true;else{p.vx*=1-d/v;p.vz*=1-d/v}}}}   // slide (μ 0.6), then rest
  if(rest){st.x=p.x;st.y=p.y;st.z=p.z;stoneDraw(st);stoneGrid(st,true);FLY.splice(i,1)}}
 const MOVING=FLY.concat(CARRY);   // flying, sliding and carried stones are drawn together
 MOVING.forEach((p,i)=>{const st=p.st;SO.position.set(p.x,p.y,p.z);SO.rotation.set(st.rx,st.ry,st.rz);SO.scale.set(st.sc,st.sc*st.sy,st.sc);SO.updateMatrix();flyM.setMatrixAt(i,SO.matrix);st.set.im.getColorAt(st.i,FC);flyM.setColorAt(i,FC)});
 flyM.count=MOVING.length;flyM.instanceMatrix.needsUpdate=true;if(flyM.instanceColor)flyM.instanceColor.needsUpdate=true}
// ----- grass: a turf of thin, tapered, slightly curved blades (about 4000 per m², 3–7 cm, mixed greens, a little dry grass, a random lean) -----
// A tyre that rolls over a blade presses it flat in the direction of travel; a pressed blade slowly stands up again (about 20 s),
// so the robot leaves visible tracks in the grass.
const BLADES={sets:[],grid:new Map(),active:new Set()},BG=new THREE.BufferGeometry(),BO=new THREE.Object3D();
BG.setAttribute('position',new THREE.Float32BufferAttribute([-.0035,0,0,.0035,0,0,-.0024,.5,.05,.0024,.5,.05,0,1,.16],3));BG.setIndex([0,1,3,0,3,2,2,3,4]);BG.computeVertexNormals();   // unit-height blade, bent forward
BO.rotation.order='YXZ';
function bladeDraw(b){BO.position.set(b.x,b.y,b.z);BO.rotation.set(b.tilt+(1.35-b.tilt)*b.f,b.ry,0);BO.scale.set(1,b.h,b.h);BO.updateMatrix();b.set.im.setMatrixAt(b.i,BO.matrix);b.set.im.instanceMatrix.needsUpdate=true}
function grassStep(dt){if(!dt||!BLADES.sets.length)return;
 if(Math.abs(DR.v)>.02){const ry=robot.rotation.y,hx=Math.cos(ry),hz=-Math.sin(ry),sx=Math.sin(ry),sz=Math.cos(ry),dir=Math.sign(DR.v),by=Math.atan2(hx*dir,hz*dir);
  WHEELS.forEach(([a,b])=>{const wx=robot.position.x+hx*a+sx*b,wz=robot.position.z+hz*a+sz*b;if(zoneAt(wx,wz)!=='soft surface (grass)')return;const ci=Math.floor(wx/.05),cj=Math.floor(wz/.05);
   for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const arr=BLADES.grid.get((ci+i)+','+(cj+j));if(arr)arr.forEach(bl=>{const dx=bl.x-wx,dz=bl.z-wz;if(Math.abs(dx*sx+dz*sz)<.035&&Math.abs(dx*hx+dz*hz)<.05){bl.f=1;bl.ry=by;BLADES.active.add(bl)}})}})}   // under this tyre: pressed flat
 BLADES.active.forEach(bl=>{bl.f=Math.max(0,bl.f-dt/20);bladeDraw(bl);if(!bl.f)BLADES.active.delete(bl)})}
function buildVisuals(){TOBS.forEach(m=>{const i=obstacles.indexOf(m);if(i>=0)obstacles.splice(i,1)});TOBS=[];STONES.sets=[];STONES.grid.clear();FLY.length=0;CARRY.length=0;flyM.count=0;BLADES.sets=[];BLADES.grid.clear();BLADES.active.clear();
 TG.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.userData.ownMaterial)o.material.dispose();if(o.isSprite){o.material.map.dispose();o.material.dispose()}});TG.clear();
 const tg=(txt,col,s,y=1.1)=>{const c=at(s,0);tag(txt,col,c.x,c.z,y+hS(s,c.x,c.z),TG)},HW=TR.hw;GATE=null;
 // paved track: asphalt where there is no rise or stairs (those have their own surface)
 if(TR.paved){const own=TR.feats.filter(f=>f.type!=='bumps').map(f=>[f.s0,f.s0+flen(f)]);let s=0;own.forEach(([a,b])=>{if(a>s)ribbon(s,a,MT.asphalt,{lift:.001,label:'track'});s=b});ribbon(s,TR.L,MT.asphalt,{lift:.001,label:'track'})}
 [...TR.feats,...TR.surfs].forEach(f=>{const e=f.s0+flen(f),mid=f.s0+flen(f)/2;
  if(f.type==='rise'){const N=f.tags||['Ramp (up)','Bridge','Ramp (down)'];ribbon(f.s0,f.s0+f.upL,MT.ramp,{skirt:true,label:(f.names||[])[0]||'ramp (up)'});ribbon(f.s0+f.upL,f.s0+f.upL+f.top,MT.deck,{thin:.06,label:(f.names||[])[1]||'bridge'});ribbon(f.s0+f.upL+f.top,e,MT.ramp,{skirt:true,label:(f.names||[])[2]||'ramp (down)'});
   for(const station of bridgeSupportStations(f.s0+f.upL,f.top)){
    for(const side of [-1,1]){const c=at(station,side*(HW-.09)),h=Math.max(.01,HT(c.x,c.z)-.057);solid(new THREE.BoxGeometry(.09,h,.09),MT.post,c.x,h/2,c.z,true).userData.label='bridge support';}
    const c=at(station,0),beam=solid(new THREE.BoxGeometry(.1,.05,TR.w-.08),MT.side,c.x,HT(c.x,c.z)-.082,c.z,true);beam.rotation.y=-Math.atan2(c.tz,c.tx);beam.userData.label='bridge crossbeam';
   }
   rails(f.s0+.25,e-.25);if(N[0])tg(N[0]+' '+f.up.toFixed(0)+'°',TAGC.rise[0],f.s0+f.upL/2,1.15);if(N[1]&&f.top>1)tg(N[1],TAGC.rise[1],f.s0+f.upL+f.top/2,1.3);if(N[2])tg(N[2]+' '+f.down.toFixed(0)+'°',TAGC.rise[2],e-f.dnL/2,1.15)}
  else if(f.type==='slip'){ribbon(f.s0,e,f.tiles?MT.tiles:MT.slip,{lift:.004,label:'slippery surface'});tg(f.tiles?'Slippery Surface (tiles)':'Slippery Surface',TAGC.slip,mid)}
  else if(f.type==='grass'){ribbon(f.s0,e,MT.grass,{lift:.006,label:'soft surface (grass)'});/* above a deck and gravel */tg('Soft Surface (damp grass)',TAGC.grass,mid);
   const N=Math.round(flen(f)*2*HW*4000),im=new THREE.InstancedMesh(BG,MT.blade,N),col=new THREE.Color(),set={im};BLADES.sets.push(set);
   for(let i=0;i<N;i++){const s=rr(f.s0,e),c=at(s,rr(-HW+.01,HW-.01)),dry=random()<.08,bl={set,i,x:c.x,y:HT(c.x,c.z)+.004,z:c.z,ry:rr(0,6.28),tilt:rr(0,.45),h:rr(.03,.07),f:0};
    bladeDraw(bl);const k=Math.floor(bl.x/.05)+','+Math.floor(bl.z/.05);let a=BLADES.grid.get(k);if(!a)BLADES.grid.set(k,a=[]);a.push(bl);
    im.setColorAt(i,dry?col.setHSL(rr(.11,.15),rr(.35,.5),rr(.32,.45)):col.setHSL(rr(.21,.3),rr(.45,.7),rr(.16,.34)))}
   im.receiveShadow=true;TG.add(im)}
  else if(f.type==='stairs'){stairs(f);tg('Stairs ('+f.n+' steps, '+(f.hs*100).toFixed(1)+' cm)',TAGC.stairs,mid,1.2)}
  else if(f.type==='narrow'){[-1,1].forEach(sd=>fence(f.s0,e,sd*(f.w/2+.03),{h:.34,label:'narrow passage wall'}));tg('Narrow Passage ('+f.w.toFixed(1)+' m)',TAGC.narrow,mid,1.3)}
  else if(f.type==='gate'){gate(f);tg('Gate',TAGC.gate,mid,1.1)}
  else if(f.type==='gravel'){ribbon(f.s0,e,MT.gravel,{lift:.005,label:'gravel patch'});/* above a deck (0.003) too */tg('Gravel / Rough Surface',TAGC.gravel,mid);
   const N=Math.round(flen(f)*2*HW*450),im=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.03,0),MT.stone,N),col=new THREE.Color(),set={im};STONES.sets.push(set);   // ~450 stones per m²: a closed layer, so the ruts show
   for(let i=0;i<N;i++){const s=rr(f.s0,e),c=at(s,rr(-HW+.02,HW-.02)),st={set,i,x:c.x,y:HT(c.x,c.z),z:c.z,sc:rr(.3,1),sy:rr(.5,.9),rx:rr(0,6),ry:rr(0,6),rz:rr(0,6),t:0};stoneDraw(st);stoneGrid(st,true);im.setColorAt(i,col.setHSL(.08,.08,rr(.35,.7)))}
   im.castShadow=im.receiveShadow=true;TG.add(im)}
  else if(f.type==='bumps'){const width=f.width||.14;for(let k=0;k<f.n;k++){const g=closedBumpGeometry({start:f.s0+k*f.gap,width,halfWidth:HW,point:at,top:(_s,_d,p)=>HT(p.x,p.z)+.001,bottom:(ss,_d,p)=>HT(p.x,p.z)-fh(f,ss,p.x,p.z)-.004});const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94});const mesh=new THREE.Mesh(g,mat);mesh.userData.ownMaterial=true;mesh.userData.label='speed bumps';mesh.userData.pick=true;mesh.userData.visualAsset=true;obstacles.push(mesh);TOBS.push(mesh);mesh.receiveShadow=mesh.castShadow=true;TG.add(mesh)}tg('Speed bumps '+((f.h||.03)*100).toFixed(1)+' cm',TAGC.bumps,mid)}});
 if(TR.fence)fenceAll();if(TR.cams)cams();if(TR.decor==='course')decor();
 ribbon(-.08,.08,MT.start,{lift:.005,label:'start line'});tg(TR.fence?'START / FINISH':'START','#16a34a',0,.9);
 // shortcut lane: paved, with the swing gate in the side fence where it leaves the track
 const ln=lane();if(ln){const n=Math.ceil(ln.L/.05),m=6,pos=[],uv=[],idx=[];
  for(let a=0;a<=n;a++){const s=ln.L*a/n,c=laneAt(s,0);for(let b=0;b<=m;b++){const d=-ln.hw+2*ln.hw*b/m,x=c.x+c.nx*d,z=c.z+c.nz*d;pos.push(x,HT(x,z)+.0015,z);uv.push(b/m,s)}}
  for(let a=0;a<n;a++)for(let b=0;b<m;b++){const i=a*(m+1)+b;idx.push(i,i+1,i+m+1,i+1,i+m+2,i+m+1)}
  const lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));lg.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));lg.setIndex(idx);lg.computeVertexNormals();
  const lm=new THREE.Mesh(lg,MT.asphalt);lm.receiveShadow=true;lm.userData.label='shortcut';TG.add(lm);
  gateAt(laneAt(.2,0),ln.hw+.06);const gc=laneAt(.2,0);tag('Gate','#7c3aed',gc.x,gc.z,1.1,TG);const mc=laneAt(ln.L/2,0);tag('Shortcut','#0891b2',mc.x,mc.z,1.0,TG)}
 // The room floor is actually cut out. The bowl has real depth and ordinary depth testing.
 const active=TR.holes.filter(o=>o.enabled!==false);floor.geometry.dispose();floor.geometry=floorWithHoles(active);
 active.forEach(o=>{const mesh=new THREE.Mesh(potholeGeometry(o,baseHeight),MT.hole);mesh.receiveShadow=true;mesh.userData.label='pothole';mesh.userData.pick=true;mesh.userData.visualAsset=true;obstacles.push(mesh);TOBS.push(mesh);TG.add(mesh);
  const rubble=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.012,0),MT.stone,28),dummy=new THREE.Object3D();for(let i=0;i<28;i++){const th=i/28*Math.PI*2,p=holePoint(o,th,.82+.1*Math.sin(i*9.7));dummy.position.set(p.x,HT(p.x,p.z)+.007,p.z);dummy.scale.set(1+.3*Math.sin(i),.35+.2*Math.cos(i),.7+.3*Math.sin(i*2));dummy.rotation.set(i*.7,i*2.3,i*.4);dummy.updateMatrix();rubble.setMatrixAt(i,dummy.matrix)}rubble.receiveShadow=true;rubble.castShadow=true;TG.add(rubble);
  const cracks=[];for(let i=0;i<12;i++){const th=i/12*Math.PI*2,A=holePoint(o,th,.99),B=holePoint(o,th+.025,1.08),C=holePoint(o,th-.018,1.18);for(const[p,q]of[[A,B],[B,C]])cracks.push(p.x,baseHeight(p.x,p.z)+.005,p.z,q.x,baseHeight(q.x,q.z)+.005,q.z)}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(cracks,3));TG.add(new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0x171b20})));tg('Pothole '+(o.depth*100).toFixed(1)+' cm', '#c9955b',o.s,.85)});
 // blue dashed guide line on the centre line (and on the shortcut lane); the Track card can hide it
 GUIDE=[];const dashes=(pt,L)=>{const pos=[],n=Math.floor(L/.4);for(let i=0;i<n;i++){const c=pt(i*L/n,0),ax=c.tx*.11,az=c.tz*.11,bx=c.nx*.022,bz=c.nz*.022,q=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([s,r])=>{const x=c.x+ax*s+bx*r,z=c.z+az*s+bz*r;return[x,HT(x,z)+.008,z]});[0,1,2,0,2,3].forEach(k=>pos.push(...q[k]))}
  const dg_=new THREE.BufferGeometry();dg_.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));const m=new THREE.Mesh(dg_,MT.dash);m.visible=guideOn;m.layers.set(1);TG.add(m);GUIDE.push(m)};
 dashes(at,TR.L);if(ln)dashes(laneAt,ln.L)}
let GUIDE=[],guideOn=true;try{guideOn=localStorage.getItem('rsw_guide')!=='0'}catch(e){}
function setGuide(on){guideOn=on;GUIDE.forEach(m=>m.visible=on);try{localStorage.setItem('rsw_guide',on?'1':'0')}catch(e){}}
// angles you set are kept per track (and per seed for random tracks)
const tkey=()=>'rsw_ramps_'+TR.id+(TR.id==='random'?'_'+TR.seed:'');
// saved as {r:[[up,down],…] per rise, s:[step height,…] per stairs}; an older plain array holds only the rises
function loadAngles(){try{let a=JSON.parse(localStorage.getItem(tkey())||'{}');if(Array.isArray(a))a={r:a};
 TR.feats.filter(f=>f.type==='rise').forEach((f,i)=>{const v=(a.r||[])[i];if(v){f.up=+v[0]||f.up;f.down=+v[1]||f.down}});
 TR.feats.filter(f=>f.type==='stairs').forEach((f,i)=>{const v=(a.s||[])[i];if(v)f.hs=Math.min(.08,Math.max(.02,+v))})}catch(e){}}
function saveAngles(){try{localStorage.setItem(tkey(),JSON.stringify({r:TR.feats.filter(f=>f.type==='rise').map(f=>[f.up,f.down]),s:TR.feats.filter(f=>f.type==='stairs').map(f=>f.hs)}))}catch(e){}}
let resetDepthSelections=()=>{};
function layout(){resetDepthSelections();TR.feats.forEach(f=>{if(f.type==='rise')fitRise(f)});stamp();buildVisuals();if(terrainPhysics?.ready)terrainPhysics.setTerrain(HT)}
let TSEL={id:'classic',seed:1};try{const s=JSON.parse(localStorage.getItem('rsw_track')||'null');if(s&&s.id)TSEL={id:s.id,seed:+s.seed||1}}catch(e){}
TR=makeTrack(TSEL.id,TSEL.seed);loadAngles();layout();

// centre island (classic loop only): low wooden fence around a table with chairs, a planter and boxes
const ISL={meshes:[],groups:[]};
const FEN=0xa16207;[[6.4,.08,0,-1.55],[6.4,.08,0,1.55],[.08,3.1,-3.2,0],[.08,3.1,3.2,0]].forEach(([w,d,x,z])=>{const m=box(w,.5,d,x,z,FEN);m.userData.label='island fence';ISL.meshes.push(m)});
function cchair(g,x,z,sd,col){part(g,.44,.05,.42,x,.45,z,col);part(g,.42,.2,.035,x,.74,z+sd*.2,col);part(g,.42,.12,.035,x,.56,z+sd*.2,col);[-.19,.19].forEach(q=>part(g,.03,.34,.03,x+q,.62,z+sd*.2,DST));
 [[-.19,-.18],[.19,-.18],[-.19,.18],[.19,.18]].forEach(p=>part(g,.03,.45,.03,x+p[0],.225,z+p[1],DST))}
{const g=grp(0,-.75);g.userData.label='dining table with chairs';part(g,1.6,.05,.8,0,.74,0,0x9a6b3f);[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a,b])=>part(g,.05,.72,.05,a*.72,.36,b*.33,0x3f2a1a));
 [-1,1].forEach(sd=>[-.55,0,.55].forEach(xo=>cchair(g,xo,sd*.55,sd,0x1e293b)));ISL.groups.push(g)}
const pl=fx(grp(0,.95));part(pl,1.7,.4,.45,0,.2,0,0x7c4a1e);part(pl,1.62,.03,.37,0,.39,0,0x3b2a1a);ISL.groups.push(pl);
for(let k=0;k<9;k++){const x=-.7+k*.175,h=rr(.25,.5);part(pl,.05,h,0,x,.4+h/2,rr(-.08,.08),0x3f6212,.02);const l=part(pl,rr(.22,.32),0,0,x,.42+h,rr(-.06,.06),[0x15803d,0x16a34a,0x166534][k%3],'s');l.scale.set(1,.55,1)}
[[-2.5,1.05,.4],[-2.05,1.15,.32]].forEach(([x,z,s])=>{const g=grp(x,z,rr(-.3,.3));part(g,s,s,s,0,s/2,0,0xc9a26b);g.userData.label='cardboard box';ISL.groups.push(g)});
ISL.groups.forEach(g=>g.userData.home=g.position.clone());
let islandOn=true;
function showIsland(on){if(on===islandOn)return;islandOn=on;const ms=[...ISL.meshes,...ISL.groups.flatMap(g=>g.children.filter(c=>c.isMesh))];
 ISL.meshes.forEach(m=>on?scene.add(m):scene.remove(m));ISL.groups.forEach(g=>{if(on){g.position.copy(g.userData.home);scene.add(g)}else scene.remove(g)});
 ms.forEach(m=>{const i=obstacles.indexOf(m);if(on&&i<0)obstacles.push(m);if(!on&&i>=0)obstacles.splice(i,1)})}
showIsland(TR.island);

// surroundings: potted plants, cabinets, shelf, trolley, gravel pile, signs (the same for every track)
function pot(x,z,s=1){const g=fx(grp(x,z));part(g,.36*s,.4*s,0,0,.2*s,0,0x57534e,.14*s);for(let k=0;k<7;k++){const a=k/7*6.28,m=part(g,.34*s,0,0,Math.cos(a)*.12*s,.55*s+rr(0,.25)*s,Math.sin(a)*.12*s,[0x15803d,0x166534,0x22c55e][k%3],'s');m.scale.set(.8,1.3,.8)}g.userData.label='potted plant';return g}
pot(-4.7,2.7);pot(4.7,2.7);pot(4.7,1.7,.8);pot(1.95,-2.75,.8);
const cab=fx(grp(2.65,-2.85));part(cab,1,.9,.26,0,.45,0,0x7c4a1e);[-.25,.25].forEach(x=>part(cab,.03,.12,.02,x,.6,.14,0xd4d4d8));cab.userData.label='wooden cabinet';
const cab2=fx(grp(-3.7,2.86));part(cab2,1.2,.6,.24,0,.3,0,0x7c4a1e);part(cab2,1.22,.03,.26,0,.61,0,0x3b2a1a);cab2.userData.label='low cabinet';
const shf=fx(grp(-4.85,1.6));part(shf,.26,1.1,1.2,0,.55,0,0x8b5a2b);[.3,.65,1].forEach(y=>part(shf,.27,.03,1.18,0,y,0,0x5b3a1a));for(let k=0;k<8;k++)part(shf,.18,.24,.06,0,.45+(k%2)*.35,-.45+k*.12,[0xdc2626,0x2563eb,0x16a34a,0xf59e0b][k%4]);shf.userData.label='bookshelf';
{const N=220,im=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.03,0),MT.stone,N),q=new THREE.Object3D(),c=new THREE.Color();   // gravel pile in the north-east corner
 for(let i=0;i<N;i++){const x=4.7+rr(-.3,.25),z=-2.7+rr(-.22,.3),s=rr(.3,1.6);q.position.set(x,rr(0,.12)*(1-Math.hypot(x-4.7,z+2.7)/.45),z);q.rotation.set(rr(0,6),rr(0,6),rr(0,6));q.scale.set(s,s*rr(.5,.9),s);q.updateMatrix();im.setMatrixAt(i,q.matrix);im.setColorAt(i,c.setHSL(.08,.08,rr(.35,.7)))}
 im.castShadow=im.receiveShadow=true;scene.add(im)}
// tray trolley parked by the east wall
const cart=grp(4.72,-.85,Math.PI/2);part(cart,.7,.04,.42,0,.18,0,STEEL);part(cart,.7,.04,.42,0,.7,0,STEEL);[[-.33,-.19],[.33,-.19],[-.33,.19],[.33,.19]].forEach(p=>{part(cart,.04,.55,.04,p[0],.45,p[1],DST);const caster=addCaster(cart,{x:p[0],z:p[1],radius:0.06,width:0.05,mountTop:0.185,rubber:new THREE.MeshStandardMaterial({color:0x171b20,roughness:.9}),metal:new THREE.MeshStandardMaterial({color:0x8e9aa3,metalness:.65,roughness:.35})});caster.traverse(o=>{if(o.isMesh)obstacles.push(o)})});
// south door (sliding glass, opens when the robot or the human is close)
const door=grp(-1.5,3.0);const dm=part(door,1,2.3,.04,0,1.15,0,0x6fb3d2);dm.material.transparent=true;dm.material.opacity=.55;door.userData.o=0;
// no people in this room: P is an empty marker far outside, so the person_* CSV columns read 99 m away
const P=new THREE.Group();P.position.set(99,0,-99);
cart.traverse(m=>{m.userData.dyn=true});
function tick(s){const dd=Math.min(Math.hypot(robot.position.x+1.5,robot.position.z-3),humanOn?Math.hypot(hg.position.x+1.5,hg.position.z-3):99);door.userData.o+=((dd<1.6?1:0)-door.userData.o)*.05;door.position.x=-1.5-door.userData.o*1.02}
// the robot's default route is the centre line of the current track, from the start line
const lift=v=>{v.y=HT(v.x,v.z)+.03;return v};
let curve=routeCurve();
const pathLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(900).map(lift)),new THREE.LineBasicMaterial({color:0xe8590c}));
scene.add(pathLine);pathLine.visible=false;
const ZSPD={'gravel patch':.6,'speed bumps':.5,'slippery surface':.8,'soft surface (grass)':.75};   // set speed per surface (the controller slows down on rough or slippery ground; slopes are left to the physics)


// Parametric rover: supplied URDF wheel joints, calibrated SI dimensions.
const rover=createRover(scene,DEFAULTS);
const {robot,wheels,rcam,fov}=rover;

// lidar
const N=4,lPos=new Float32Array(N*18);
const lGeo=new THREE.BufferGeometry();lGeo.setAttribute('position',new THREE.BufferAttribute(lPos,3));
const lidar=new THREE.LineSegments(lGeo,new THREE.LineBasicMaterial({color:0xff3b3b,transparent:true,opacity:0.55}));
lidar.frustumCulled=false;scene.add(lidar);
const rc=new THREE.Raycaster(),sensorIndex=new SensorRayIndex();let sensorPanelAt=-Infinity,sensorPanelText='';let RANGE=2;const tof=[2,2,2,2],tofReflectance=[1,1,1,1];let fDyn=false;

// orbit camera
let th=0.35,ph=0.75,rad=11;const tgt=new THREE.Vector3(0,0,0);
function placeCam(){if(follow)tgt.lerp(FT.position,.1);cam.position.set(tgt.x+rad*Math.sin(ph)*Math.sin(th),tgt.y+rad*Math.cos(ph),tgt.z+rad*Math.sin(ph)*Math.cos(th));cam.lookAt(tgt)}
let drag=false,lx=0,ly=0;
const cv=renderer.domElement;
cv.addEventListener('pointerdown',e=>{drag=true;lx=e.clientX;ly=e.clientY;cv.setPointerCapture(e.pointerId)});
cv.addEventListener('pointerup',()=>drag=false);
cv.addEventListener('pointermove',e=>{if(!drag)return;th-=(e.clientX-lx)*0.006;ph=Math.min(1.55,Math.max(0.05,ph-(e.clientY-ly)*0.006));lx=e.clientX;ly=e.clientY});
cv.addEventListener('wheel',e=>{e.preventDefault();rad=Math.min(45,Math.max(4,rad+e.deltaY*0.01))},{passive:false});

// buttons
const $=id=>document.getElementById(id);
let paused=false;
$('bPath').onclick=e=>{pathLine.visible=!pathLine.visible;e.target.classList.toggle('on')};
$('bLidar').onclick=e=>{lidar.visible=!lidar.visible;fov.visible=lidar.visible;e.target.classList.toggle('on')};
$('bPause').onclick=()=>{paused=!paused;$('bPause').classList.toggle('on',paused)};
$('bPath').classList.remove('on');

// ---- dataset capture: camera images + ToF/pose CSV ----
let snapshotRequest=null,snapshotBusy=false;
let recOn=false,rows=[],imgs=[],acc=0,grabCb=null;
const g2=document.createElement('canvas'),g2x=g2.getContext('2d');
let follow=false,hdRT=null,serial=0,partNo=1;const CAP={w:1920,h:1080,mime:'image/png',ext:'png',every:10,sp:.2,img:.2,max:150,noise:0.01,batch:0,dir:null,speed:0.005,avoid:true};
const gs=()=>(random()+random()+random()+random()-2)*1.7;
const nz=v=>v>=1.999?'2.000':Math.max(0.02,Math.min(2,v+gs()*CAP.noise*(0.5+v))).toFixed(3);
const OP=sessionStorage.getItem('rsw_user')||'anon',TPR=1200;let TW=DEFAULTS.track,WR=DEFAULTS.radius,VMAX=DEFAULTS.rpm*Math.PI/30*WR,spd=1;
const TM={init:false,x:0,y:0,yaw:0,v:0,w:0,eL:0,eR:0,ox:0,oy:0,oyaw:0,iy:0,dist:0,lap:0,pt:0,E:0,n:0};
const HDR=['timestamp_iso','sim_time_s','sample','operator','lap','mode','x_m','y_m','yaw_deg','v_mps','omega_dps','accel_mps2','v_left_mps','v_right_mps','rpm_left','rpm_right','pwm_left','pwm_right','duty_left_pct','duty_right_pct','dir_left','dir_right','enc_left_ticks','enc_right_ticks','odom_x_m','odom_y_m','odom_yaw_deg','dist_travelled_m','imu_ax_mps2','imu_ay_mps2','imu_gz_dps','imu_yaw_deg','motor_i_left_A','motor_i_right_A','batt_v','batt_pct','tof_front_m','tof_left_m','tof_right_m','tof_back_m','tof_front_ok','tof_left_ok','tof_right_ok','tof_back_ok','tof_min_m','obstacle_stop','person_x_m','person_y_m','person_dist_m','cart_x_m','cart_y_m','door_open_pct','image','img_w','img_h','time_of_day','daylight_pct','bulbs_on',...PHYSICS_COLUMNS,...LAB_COLUMNS];
function telem(s,dt,nm){const x=robot.position.x,y=-robot.position.z,yaw=robot.rotation.y;
 let dx=x-TM.x,dy=y-TM.y,dyaw=Math.atan2(Math.sin(yaw-TM.yaw),Math.cos(yaw-TM.yaw));
 if(!TM.init){TM.init=true;dx=dy=dyaw=0;TM.ox=x;TM.oy=y;TM.oyaw=yaw;TM.iy=yaw}
 TM.x=x;TM.y=y;TM.yaw=yaw;
 const pit=robot.rotation.z,ds=Math.hypot(dx,dy)/Math.cos(pit)*(Math.cos(Math.atan2(dy,dx)-yaw)>=0?1:-1);   // distance along the slope (what the wheels roll)
 const v=TM.v*.3+(ds/dt)*.7,w=TM.w*.3+(dyaw/dt)*.7,a=(v-TM.v)/dt;TM.v=v;TM.w=w;
 const vl=v-w*TW/2,vr=v+w*TW/2,rpm=u=>u/(2*Math.PI*WR)*60;
 // PWM is the duty the motor model used (speed loop or keys), plus the left/right split for turning; 0 = coasting
 const pwm=d=>DR.u===0&&Math.abs(w)<.05?0:Math.round(Math.max(-255,Math.min(255,d*255))),dir=u=>u>.005?'FWD':u<-.005?'REV':'STOP';
 // wheel speed error: on a path each side needs the duty for its real speed ÷ (1 + error); by hand the keys set the duty itself
 const[eL,eR]=manualOn?[0,0]:sideErr(),pl=pwm((DR.u-w*TW/2/VNL)/(1+eL)),pr=pwm((DR.u+w*TW/2/VNL)/(1+eR));
 TM.eL+=Math.round(vl*dt/(2*Math.PI*WR)*TPR*(1+.004*gs()));TM.eR+=Math.round(vr*dt/(2*Math.PI*WR)*TPR*(1+.004*gs()));
 const vo=(vl*(1+.01*gs())+vr*(1+.01*gs()))/2,gz=w*180/Math.PI+.4+.25*gs();
 TM.oyaw+=((vr-vl)/TW+.002*gs())*dt;TM.ox+=vo*Math.cos(TM.oyaw)*dt;TM.oy+=vo*Math.sin(TM.oyaw)*dt;TM.iy+=gz*Math.PI/180*dt;TM.dist+=Math.abs(ds);
 // current follows motor force (torque): 2.4 A per side at stall, plus a little for turning; 0.15 A for the driver and encoders
 const iT=Math.abs(w)*.25,il=Math.max(0,.15+2.4*Math.abs(DR.F)/FST+iT+.03*gs()),ir=Math.max(0,.15+2.4*Math.abs(DR.F)/FST+iT+.03*gs());
 TM.E+=(il+ir)*12*dt/3600;const pct=Math.max(0,100-TM.E/44*100),bv=9.6+3*pct/100-.15*(il+ir);
 if(t<TM.pt-.5)TM.lap++;TM.pt=t;
 const px=P.position.x,py=-P.position.z,mode=manualOn?'MANUAL':paused?'PAUSED':fDyn?'OBSTACLE_STOP':Math.abs(w)>.3?'TURNING':spd<.05?'IDLE':'CRUISING';
 const r=(q,d=3)=>(+q).toFixed(d),ok=q=>q<1.999?1:0;
 return LAB.enrich(PX.enrich([new Date().toISOString(),r(s,2),TM.n++,OP,TM.lap,mode,r(x),r(y),r(yaw*180/Math.PI,2),r(v),r(w*180/Math.PI,2),r(a),r(vl),r(vr),r(rpm(vl),1),r(rpm(vr),1),pl,pr,r(Math.abs(pl)/2.55,1),r(Math.abs(pr)/2.55,1),dir(vl),dir(vr),TM.eL,TM.eR,r(TM.ox),r(TM.oy),r(TM.oyaw*180/Math.PI,2),r(TM.dist),r(a+G*Math.sin(pit)+.05*gs()),r(v*w+.05*gs()),r(gz,2),r(TM.iy*180/Math.PI,2),r(il),r(ir),r(bv,2),r(pct,1),nz(tof[0]),nz(tof[1]),nz(tof[2]),nz(tof[3]),ok(tof[0]),ok(tof[1]),ok(tof[2]),ok(tof[3]),r(Math.min(...tof)),fDyn?1:0,r(px),r(py),r(Math.hypot(px-x,py-y)),r(cart.position.x),r(-cart.position.z),r(door.userData.o*100,0),nm,CAP.w,CAP.h,...LT.row()],HDR),HDR,dt)}
function META(){const vf=70*Math.PI/180,fy=CAP.h/2/Math.tan(vf/2);return{...PX.metadata(),...LAB.metadata(),visuals:VIS.metadata(),speed_control:SPEED.metadata(),rover_tools:TOOLS.metadata(),terrain_tests:TESTS.metadata(),terrain_ride:ride.metadata(),operator:OP,created:new Date().toISOString(),sample_rate_hz:+(1/CAP.sp).toFixed(2),image_interval_s:CAP.img,language:{recorded:false,note:'Captions and event logs omitted from lean datasets'},units:'SI (m, s, deg, A, V); tof in metres, pwm 8-bit signed',columns:HDR,lighting:LT.meta(),people:PP.info(),curtains:CU.info(),
 environment:{name:'Obstacle track v2',size_m:'10x6 room',track:{id:TR.id,name:TR.name,seed:TR.id==='random'?TR.seed:null,length_m:+TR.L.toFixed(2),width_m:TR.w,centre_island:TR.island,fence:TR.fence,
   shortcut:TR.shortcut?{length_m:+lane().L.toFixed(2),width_m:TR.shortcut.w,swing_gate:'in the side fence at its entrance'}:null,route:TR.route,route_length_m:+curveLen.toFixed(2),potholes:TR.holes.map(o=>({at_m:o.s,offset_m:o.d,diameter_m:2*o.r,depth_m:o.depth}))},
  features:[...TR.feats,...TR.surfs].sort((a,b)=>a.s0-b.s0).map(f=>({type:f.type,start_m:+f.s0.toFixed(2),length_m:+flen(f).toFixed(2),...(f.type==='rise'?{height_m:f.h,up_deg:+f.up.toFixed(1),down_deg:+f.down.toFixed(1),top_m:+f.top.toFixed(2)}:f.type==='bumps'?{bumps:f.n,height_m:f.h||.03}:
   f.type==='stairs'?{steps:f.n,step_height_m:f.hs,tread_m:f.tread,climbable:f.hs<=CLIMB}:f.type==='narrow'?{width_m:f.w}:f.type==='gate'?{leaf_mass_kg:GP.m,closer_spring_Nm_per_rad:GP.k,leaf_length_m:+(GATE?GATE.L:0).toFixed(2)}:f.type==='slip'&&f.tiles?{surface:'tiles'}:{})})),
  dynamic:['automatic door',...(GATE?['swing gate (rigid body revolute joints)']:[])],coords:'x east, y north (gazebo-style), yaw 0 = +x; robot height and tilt follow the drive surface'},
 robot:{type:'4-wheel skid steer',mass_kg:ROBOT_KG,wheel_speed_error:wheelErrInfo(),track_width_m:TW,wheel_radius_m:WR,max_speed_mps:VMAX,encoder_ticks_per_rev:TPR,pwm:'+-255, deadband 35, left/right channels',battery:'Editable 3S voltage sag / energy model; empirical motor current estimates'},
 tof:LAB.sensorMetadata(),camera:LAB.cameraMetadata()}}
async function writeFile(nm,b){try{const p=nm.split('/');let d=CAP.dir;for(const s of p.slice(0,-1))d=await d.getDirectoryHandle(s,{create:true});const f=await d.getFileHandle(p[p.length-1],{create:true});const w=await f.createWritable();await w.write(b);await w.close()}catch(e){throw Error('Folder write failed: '+e.message)}}
function doGrab(){const W=CAP.w,H=CAP.h;if(!hdRT||hdRT.width!==W||hdRT.height!==H){if(hdRT)hdRT.dispose();try{if(!renderer.capabilities.isWebGL2)throw Error('WebGL1');hdRT=new THREE.WebGLMultisampleRenderTarget(W,H);hdRT.samples=4}catch(e){hdRT=new THREE.WebGLRenderTarget(W,H)}}
 hdRT.texture.encoding=renderer.outputEncoding;rcam.aspect=W/H;rcam.updateProjectionMatrix();renderer.setRenderTarget(hdRT);renderer.render(scene,rcam);
 const px=new Uint8Array(W*H*4);renderer.readRenderTargetPixels(hdRT,0,0,W,H,px);renderer.setRenderTarget(null);
 rcam.aspect=PW/PH;rcam.updateProjectionMatrix();
 g2.width=W;g2.height=H;const id=g2x.createImageData(W,H);for(let y=0;y<H;y++)id.data.set(px.subarray((H-1-y)*W*4,(H-y)*W*4),y*W*4);const shot=snapshotRequest,shotTask=LAB.processImage(id,shot?.image||pendNm,shot?{snapshotCapture:context=>VIS.captureDepthSnapshot(context)}:{});g2x.putImageData(id,0,0);
 const cb=grabCb,captureName=pendNm;grabCb=null;pendNm=null;snapshotRequest=null;LAB.encode(g2,b=>cb(b,shotTask),shot?null:captureName,CAP.mime)}
function stat(){$('rst').textContent=rows.length+' rows · '+imgs.length+' imgs \u00b7 '+evts.length+' events'}
let lastSampleClock=0,lastEmittedClock=0,recordRowStart=0,nextImageClock=0;
function recTick(dt,s){const frameNow=performance.now(),frameSpan=frameNow-FPS.t;if(!FPS.t)FPS.t=frameNow;else{FPS.n++;if(frameSpan>=1000){$('fpsChip').textContent=Math.round(FPS.n*1000/frameSpan)+' fps';FPS.n=0;FPS.t=frameNow}}const actualDt=Math.max(0,s-lastSampleClock);acc+=actualDt;lastSampleClock=s;if(acc<CAP.sp-1e-9)return;const dt2=s-lastEmittedClock;lastEmittedClock=s;LAB.markLate(Math.max(0,Math.floor((acc+1e-9)/CAP.sp)-1));acc%=CAP.sp;const n=rows.length;let nm='';
 if(recOn&&!snapshotRequest&&s+1e-9>=nextImageClock&&(CAP.dir||imgs.length+LAB.pendingImages()<CAP.max)){if(!LAB.imageCaptureReady())LAB.deferImageCapture();else if(pendNm)nm=pendNm;else{nextImageClock=s+CAP.img;nm=pendNm='images/'+LAB.imagePrefix()+'_img_'+String(serial++).padStart(6,'0')+'.'+CAP.ext;grabCb=async b=>{if(!b)throw Error('Camera returned an empty image');if(CAP.dir)await writeFile(nm,b);else imgs.push([nm,b]);stat();if(CAP.batch&&!CAP.dir&&imgs.length%CAP.batch===0)queueMicrotask(()=>exportData(rows,imgs,'robot_dataset_checkpoint'+(partNo++)+'.zip',anns,evts))}}}
 LIVE=telem(s,dt2,nm);NR.step(LIVE,n=>rg(LIVE,n));if(recOn){rows.push(LIVE);stat();if(nm)lastImg=nm}hist()}
async function save(name,data,verification=null){
 const blob=data instanceof Blob?data:new Blob([data]);
 if(name.endsWith('.zip'))return publishRecording(name,blob,verification);
 const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
restoreRecordingDownloads();
let exportBusy=false,exportTask=null;
async function exportData(R=rows,I=imgs,fn='robot_dataset.zip',A=anns,E=evts){
 if(exportBusy){await exportTask;return exportData(R,I,fn,A,E)}if(!R.length){$('rst').textContent='Record something first';return}
 exportBusy=true;let finishExport;exportTask=new Promise(resolve=>finishExport=resolve);$('bExp').disabled=$('bRec').disabled=$('bClr').disabled=true;
 try{if(grabCb)await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));await LAB.busy();const records=R.map(row=>[...row]),annotations=[...A],events=[...E],names=new Set([...records.map(r=>r[HDR.indexOf('image')]),...annotations.map(a=>a.image),...events.map(e=>e.image)].filter(Boolean));let images=[...I].filter(([n])=>names.has(n));
  if(CAP.dir){images=[];for(const name of names){let directory=CAP.dir;const parts=name.split('/');for(const part of parts.slice(0,-1))directory=await directory.getDirectoryHandle(part);images.push([name,await(await directory.getFileHandle(parts.at(-1))).getFile()]);}}
  const metadata=META(),csv=csvText(HDR,records),extras=[...await LAB.extras(),...await VIS.extras(),['track/terrain-tests.json',JSON.stringify(TESTS.metadata())]],audit=Object.fromEntries([...names].filter(n=>LAB.audit[n]).map(n=>[n,LAB.audit[n]]));
  $('rst').textContent='Checking samples and images…';const bundle=await datasetFiles({csv,columns:HDR,rows:records,metadata,annotations,events,eventCSV:evCsv(events),images,imageAudit:audit,extras,onProgress:p=>$('rst').textContent='Checking '+p.toFixed(0)+'%'});
  if(CAP.dir){for(const[name,value]of bundle.files)if(!name.startsWith('images/'))await writeFile(name,new Blob([value]));$('rst').textContent='Folder saved · quality '+bundle.quality.status+' · see quality.json';}
  else{const bytes=await datasetZip({files:bundle.files,onProgress:p=>$('rst').textContent='Packaging ZIP '+p.toFixed(0)+'%'});$('rst').textContent='Verifying ZIP integrity…';const verification=await verifyDatasetZip(bytes);const saved=await save(fn,new Blob([bytes],{type:'application/zip'}),verification);$('rst').textContent='ZIP verified · quality '+bundle.quality.status+' · '+records.length+' rows / '+images.length+' images. Download ZIP below.'+(saved.backedUp?' Saved for recovery after reload.':'');}
 return true;}catch(error){$('rst').textContent='Export failed: '+error.message;console.error(error);return false}finally{exportBusy=false;finishExport();$('bExp').disabled=$('bRec').disabled=$('bClr').disabled=false}
}
function setRecording(on){
 if(recOn===on)return;try{LAB.onRecord(on)}catch(error){if(on)try{LAB.onRecord(false)}catch{}throw error}recOn=on;const button=$('bRec');button.classList.toggle('on',on);button.lastElementChild.textContent=on?'Stop & export':'Record';recStart=performance.now();EV.prev=null;acc=0;lastSampleClock=lastEmittedClock=PX.drive.time;if(on){recordRowStart=rows.length;nextImageClock=PX.drive.time};
}
$('bShot').title='Capture RGB + current object outline ZIP and compare';$('bShot').onclick=()=>{if(grabCb||snapshotBusy)return;snapshotBusy=true;$('bShot').disabled=true;snapshotRequest={image:'images/camera_'+Date.now()+'.'+CAP.ext};grabCb=async(b,task)=>{try{await saveCameraSnapshot(b,await task)}catch(error){toast('Snapshot failed: '+error.message)}finally{snapshotBusy=false;$('bShot').disabled=false;}}};
wireRecordingControls({record:$('bRec'),exportButton:$('bExp'),clear:$('bClr'),isRecording:()=>recOn,isBusy:()=>exportBusy,setRecording,exportData,onNewRecording:resetRecordingDownloads,clearData:async()=>{await LAB.busy();rows=[];imgs=[];anns=[];evts=[];annSet.clear();lastImg='';LAB.clear();stat()},onError:error=>{$('rst').textContent='Recording failed: '+error.message;console.error(error)}});
let t=0,last=performance.now();
const p=new THREE.Vector3(),tan=new THREE.Vector3();
// Body response runs at 120 Hz. Wheel compliance is visible without delaying the
// planar pose or adding a repeated, artificial speed penalty at pothole edges.
robot.rotation.order='YXZ';
let rideSettings={};try{rideSettings=JSON.parse(localStorage.getItem('dynora-terrain-ride-11')||'{}')}catch{}let ride;try{ride=new TerrainRide(rideSettings)}catch{ride=new TerrainRide()}
function settle(h=0,reset=h===0){const pose=ride.step(h,{x:robot.position.x,z:robot.position.z,yaw:robot.rotation.y,p:PX.drive.p,height:HT,reset});settle.wh=ride.support;robot.position.y=pose.y;robot.rotation.z=pose.pitch;robot.rotation.x=pose.roll;rover.wheels.forEach((wheel,i)=>wheel.position.y=WR+ride.wheelOffsets[i]);rover.updateWheelMounts?.();PX.drive.rideWheelOffsets=[...ride.wheelOffsets]}
let WH=null,inHole=null;
function potholeStep(){let hit=null;for(const o of TR.holes.filter(o=>o.enabled!==false))for(const[a,b]of WHEELS){const x=robot.position.x+Math.cos(robot.rotation.y)*a+Math.sin(robot.rotation.y)*b,z=robot.position.z-Math.sin(robot.rotation.y)*a+Math.cos(robot.rotation.y)*b;if(holeCoordinates(o,x,z).q<1)hit=o}if(hit&&hit!==inHole){const msg='Entered pothole: '+(hit.depth*100).toFixed(1)+' cm deep at '+Math.abs(DR.v).toFixed(2)+' m/s.';NR.say(msg,'info');if(recOn)ev('pothole',msg)}inHole=hit}
// ===== drive physics: 4 geared DC motors on a slope =====
// motor force falls linearly with speed (F = Fstall·(duty − v/Vnl)); gravity along the slope (−m·g·sin pitch); rolling resistance + gearbox drag oppose motion;
// tyre grip caps the drive force (μ·m·g·cos pitch, low on the slippery surface). Duty 0 = H-bridge off: the motors coast, so the robot can roll downhill.
// Path following uses the wheel encoders: a PI speed loop with flat-ground feed-forward, so slopes change the speed a little until the loop catches up.
// Soft ground (grass) and gravel add rolling resistance. A stair riser higher than CLIMB (half the 9 cm wheel radius) stops the robot.
const VNL=1.2,FST=30,CRR=.04,FGB=1.5,KP=2.5,KI=3,MU=.9,MU_SLIP=.15,MU_GRAVEL=.6,MU_GRASS=.5,CLIMB=.045;   // no-load speed at 100 % duty (m/s), stall force of 4 motors (N), rolling coeff., gearbox drag (N), PI gains, grip (dry, slippery, loose gravel, damp grass), highest step (m)
// extra rolling resistance: damp turf gives under small wheels (total coefficient 0.24, against 0.04 on a hard floor); loose gravel a little
const CRRZ={'soft surface (grass)':.2,'gravel patch':.03};
// Compatibility bridge: gate impacts and track height transitions act on the shared drive state.
const DR={get v(){return PX.drive.v},set v(v){PX.drive.v=v},i:0,get u(){return (PX.drive.duty[0]+PX.drive.duty[1])/2},get F(){return PX.drive.force[0]+PX.drive.force[1]},get slip(){return Math.max(...PX.drive.slip.map(Math.abs))},stuck:0};

// ----- track gates: rigid leaves, revolute hinges, spring closers and stops -----
// Mass and spring changes are applied to the same Rapier world as the robot.
const GP={m:2.5,k:.6,c:.25,max:105*D2R};   // leaf mass (kg), closer spring (N·m/rad), damping (N·m·s), stop angle
try{const s=JSON.parse(localStorage.getItem('rsw_gate')||'{}');if(s.m)GP.m=Math.min(10,Math.max(.5,+s.m));if(s.k!==undefined)GP.k=Math.min(3,Math.max(0,+s.k))}catch(e){}
// Gate leaves are Rapier bodies with a revolute joint, spring and hard stops.
// No second frame-rate contact response or static ghost boxes are applied.
function loop(now){
  frameProfiler.begin(now,!document.hidden);VIS.beginFrame?.(now);
  requestAnimationFrame(loop);
  const elapsed=Math.max(0,(now-last)/1000),dt=Math.min(elapsed,.05);last=now;PX.drive.droppedTime+=elapsed-dt;
  if(TOOLS.replayTick(now)){scene.updateMatrixWorld(true);VIS.updateDepth?.();frameProfiler.mark('Depth sampling');renderDisplayFrame({renderer,scene,camera:cam,robotCamera:rcam,robot,path:pathLine,lidar,fov,botView,width:innerWidth,height:innerHeight,matricesCurrent:true,cameraMode:VIS.cameraMode,primaryViewport:VIS.depthViewport?.(),preview:()=>VIS.previewViewport(),capture:()=>{}});frameProfiler.end(renderer);return;}

  LT.update(dt);PT.update();RL.update(dt);MV.update(dt);RT.update();TK.update(dt);PP.update(dt);CU.update(dt);tick(PX.drive.time);humanStep(dt);manualStep(dt);frameProfiler.mark('Actors and scene');
  spd+=((paused||fDyn||(!loopRoute&&t>=.999)?0:1)-spd)*Math.min(1,dt*3);
  if(!manualOn)PX.auto(dt,SPEED.target(dt,spd));
  frameProfiler.mark('Drive and contacts');
  CO.update(dt);VIS.update(elapsed);SPEED.update(dt,manualOn);TESTS?.update(dt);gravelStep(dt);grassStep(dt);PX.update(dt);frameProfiler.mark('Depth and controls');
  TOOLS.update(now);
  {
    scene.updateMatrixWorld();sensorIndex.update(obstacles);const o=new THREE.Vector3();
    for(let i=0;i<N;i++){
      const sensor=rover.sensor(i),d=sensor.direction;o.copy(sensor.origin);const axis=new THREE.Vector3(0,1,0).applyQuaternion(robot.quaternion);
      rc.far=RANGE;let h=null;for(let k=0;k<9;k++){const a=(k-4)*(12.5*Math.PI/180)/4,dk=d.clone().applyAxisAngle(axis,a);rc.set(o,dk);const hk=sensorIndex.nearest(rc);if(hk&&(!h||hk.distance<h.distance))h=hk;if(k%4==0){const Lk=hk?hk.distance:RANGE;lPos.set([o.x,o.y,o.z,o.x+dk.x*Lk,o.y+dk.y*Lk,o.z+dk.z*Lk],(i*3+k/4)*6)}}
      
      const L=h?h.distance:RANGE;tof[i]=L;tofReflectance[i]=h?.object.material?.color?Math.max(.05,h.object.material.color.getHSL({}).l):1;if(i==0)fHitObj=h?h.object:null;if(i==0)fDyn=!!(CAP.avoid&&h&&h.object.userData.dyn&&L<0.7&&TK.blocks(h.object));
      
    }
    lGeo.attributes.position.needsUpdate=true;if(now>=sensorPanelAt){sensorPanelAt=now+100;const f=v=>v>=RANGE-.001?'--':(v*100|0)+' cm';const sensorText='<b>ToF sensors</b> (2 m)<br>Front '+f(tof[0])+'<br>Left '+f(tof[1])+'<br>Right '+f(tof[2])+'<br>Back '+f(tof[3])+(fDyn?'<br><b style=color:#ef4444>Avoidance brake: front ToF below 70 cm</b>':'');if(sensorText!==sensorPanelText){$('tof').innerHTML=sensorText;sensorPanelText=sensorText}}
  }
  frameProfiler.mark('ToF rays');
  LAB.updateSensors(tof,PX.drive.time,tofReflectance);recTick(dt,PX.drive.time);placeCam();fpCam();if(!(humanOn&&fp))VIS.protectCamera(cam,tgt,dt,{occlusion:follow});wallFade();frameProfiler.mark('Telemetry and UI');
  VIS.updateDepth?.();frameProfiler.mark('Depth sampling');renderDisplayFrame({renderer,scene,camera:cam,robotCamera:rcam,robot,path:pathLine,lidar,fov,botView,width:innerWidth,height:innerHeight,matricesCurrent:true,cameraMode:VIS.cameraMode,primaryViewport:VIS.depthViewport?.(),preview:()=>VIS.previewViewport(),capture:vx=>{if(grabCb)doGrab(vx)}});
  frameProfiler.mark('Render submission');const frameReport=frameProfiler.end(renderer);if(frameReport)VIS.reportPerformance?.(frameReport);
}

const q=id=>document.getElementById(id);
q('sRes').onchange=e=>{const[a,b]=e.target.value.split('x');CAP.w=+a;CAP.h=+b};
q('sFmt').onchange=e=>{CAP.mime=e.target.value=='jpg'?'image/jpeg':'image/png';CAP.ext=e.target.value};
q('sEvery').onchange=e=>{CAP.img=+e.target.value};
q('sHz').onchange=e=>{CAP.sp=1/Number(e.target.value)};
q('nMax').onchange=e=>CAP.max=+e.target.value;
q('nBatch').onchange=e=>CAP.batch=+e.target.value;
q('sNoise').onchange=e=>CAP.noise=+e.target.value;
q('sSpeed').onchange=e=>CAP.speed=+e.target.value;
q('bDir').onclick=async()=>{if(!window.showDirectoryPicker){q('rst').textContent='folder save needs Chrome/Edge';return}try{CAP.dir=await showDirectoryPicker({mode:'readwrite'});q('bDir').textContent='\ud83d\udcc1 Folder \u2713'}catch(e){}};

$('bOut').onclick=()=>{sessionStorage.removeItem('rsw_user');location.reload()};$('uName').textContent=OP;

const H={v:[],pl:[],pr:[],f:[]},FPS={n:0,t:0};let LIVE=null,recStart=0;
const col=n=>LIVE[HDR.indexOf(n)]===''?NaN:+LIVE[HDR.indexOf(n)];
const wedge=(a,r)=>{const c=100,m=a*Math.PI/180,s=12.5*Math.PI/180;return `M${c} ${c}L${c+r*Math.cos(m-s)} ${c+r*Math.sin(m-s)}A${r} ${r} 0 0 1 ${c+r*Math.cos(m+s)} ${c+r*Math.sin(m+s)}Z`};
function spark(id,ser,mn,mx){const c=$(id),x=c.getContext('2d'),w=c.width,h=c.height;x.clearRect(0,0,w,h);x.strokeStyle='#ffffff14';for(let i=1;i<4;i++){x.beginPath();x.moveTo(0,h*i/4);x.lineTo(w,h*i/4);x.stroke()}
 ser.forEach(([d,k])=>{x.strokeStyle=k;x.lineWidth=1.6;x.beginPath();d.forEach((v,i)=>{const px=i/149*w,py=h-(v-mn)/(mx-mn)*h;i?x.lineTo(px,py):x.moveTo(px,py)});x.stroke()})}
function hist(){const v=col('v_mps'),pl=col('pwm_left'),pr=col('pwm_right'),T=['front','left','right','back'].map(n=>col('tof_'+n+'_m'));
 [[H.v,v],[H.pl,pl],[H.pr,pr],[H.f,T[0]]].forEach(([a,b])=>{a.push(b);if(a.length>150)a.shift()});
 $('gV').style.strokeDashoffset=157*(1-Math.min(1,Math.abs(v)/.8));$('gVt').textContent=Math.abs(v).toFixed(2);
 const md=LIVE[5];$('mode').textContent=md;$('modeChip').textContent=md;$('modeChip').dataset.m=md;
 const bp=col('batt_pct');$('batBar').style.width=bp+'%';$('batV').textContent=col('batt_v').toFixed(1)+' V';$('batChip').textContent='\u{1F50B} '+bp.toFixed(0)+'%';
 [['L',pl],['R',pr]].forEach(([k,p])=>{const b=$('pw'+k);b.style.left=p<0?(50+p/255*50)+'%':'50%';b.style.width=Math.abs(p)/255*50+'%';b.className=p<0?'rev':''});
 $('pwLt').textContent=pl;$('pwRt').textContent=pr;$('rpm').textContent=col('rpm_left').toFixed(0)+' / '+col('rpm_right').toFixed(0);$('dirs').textContent=LIVE[20]+' / '+LIVE[21];
 ['front','left','right','back'].forEach((n,i)=>{const valid=Number.isFinite(T[i]),d=valid?T[i]:RANGE,e=$('c_'+n);e.setAttribute('d',wedge([-90,180,0,90][i],18+d/2*72));e.style.fill='hsl('+Math.min(120,d*70)+' 85% 55%)';$('t_'+n).textContent=!valid||d>=RANGE-.001?'--':(d*100).toFixed(0)});
 $('sLap').textContent=LIVE[4];$('sDist').textContent=col('dist_travelled_m').toFixed(1)+' m';$('sHead').textContent=col('yaw_deg').toFixed(0)+'\u00b0';$('sPos').textContent=col('x_m').toFixed(1)+', '+col('y_m').toFixed(1);$('sGz').textContent=col('imu_gz_dps').toFixed(1)+' \u00b0/s';
 spark('chV',[[H.v,'#22d3ee']],-.1,.9);spark('chP',[[H.pl,'#fb923c'],[H.pr,'#a78bfa']],-255,255);spark('chT',[[H.f,'#4ade80']],0,2);
 if(recOn){const r=$('tbody');r.insertAdjacentHTML('afterbegin','<tr>'+[LIVE[1],LIVE[5],LIVE[9],LIVE[16],LIVE[17],LIVE[36],LIVE[37],LIVE[38],LIVE[39]].map(x=>'<td>'+x+'</td>').join('')+'</tr>');while(r.rows.length>10)r.deleteRow(-1)}
 const rt=recOn?(performance.now()-recStart)/1000:0;$('recChip').textContent=recOn?'\u25cf REC '+Math.floor(rt/60)+':'+String(Math.floor(rt%60)).padStart(2,'0'):'\u25cb idle';$('recChip').classList.toggle('on',recOn);$('camres').textContent=CAP.w+'\u00d7'+CAP.h}
$('bIso').onclick=()=>{follow=false;tgt.set(0,0,0);ph=.75;th=.35;rad=11};$('bTop').onclick=()=>{follow=false;tgt.set(0,0,0);ph=.05;th=0;rad=11};let botView=false;const botCam=on=>{botView=on;$('bCam').classList.toggle('on',on);document.body.classList.toggle('botview',on)};$('bCam').onclick=()=>botCam(!botView);
addEventListener('keydown',e=>{if(e.code==='KeyB'&&!/INPUT|SELECT/.test(document.activeElement.tagName))botCam(!botView)});
$('bFollow').onclick=e=>{follow=!follow;e.target.classList.toggle('on',follow);if(follow){ph=.8;rad=6}};
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tabs button,.pane').forEach(x=>x.classList.remove('on'));b.classList.add('on');$('t-'+b.dataset.t).classList.add('on')});


// ===== editing features (original look kept): move/rotate/spawn objects + draw your own path =====
let loopRoute=true,drawMode=false,wps=[],curveLen=curve.getLength(),lastG=null;let curve0=curve,len0=curveLen;const fixed=[P,cart,door,...FIXED0],spawned=[];
const movable=()=>MOV.filter(g=>!fixed.includes(g)&&g.parent===scene);
const flag=g=>g.traverse(c=>{if(c.isMesh)c.userData.pick=c.userData.dyn=true});
movable().forEach(flag);
const rc2=new THREE.Raycaster(),mv=new THREE.Vector2();let held=null,dpx=0,dpy=0;
const ndc=e=>{const r=cv.getBoundingClientRect();mv.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);rc2.setFromCamera(mv,cam)};
const floorPt=()=>rc2.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());
const hit=()=>{const h=rc2.intersectObjects(movable().flatMap(g=>g.children).filter(c=>c.isMesh))[0];return h&&h.object.parent};
const glow=(g,c)=>g.children.forEach(m=>m.material&&m.material.emissive&&m.material.emissive.setHex(c));
const toast=m=>{const e=$('toast');e.textContent=m;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),2200)};
function delG(g){if(fixed.includes(g))return;scene.remove(g);g.traverse(c=>{const i=obstacles.indexOf(c);if(i>=0)obstacles.splice(i,1)});MOV.splice(MOV.indexOf(g),1);if(lastG===g)lastG=null}
window.addEventListener('pointerdown',e=>{dpx=e.clientX;dpy=e.clientY;if(e.target!==cv||e.button!==0||drawMode)return;ndc(e);const g=hit(),p=floorPt();if(g&&p){held={g,dx:g.position.x-p.x,dz:g.position.z-p.z};lastG=g;glow(g,0x1d4ed8);cv.style.cursor='grabbing';e.stopImmediatePropagation()}},true);
window.addEventListener('pointermove',e=>{if(e.target!==cv&&!held)return;ndc(e);if(held){const p=floorPt();if(p){held.g.position.x=p.x+held.dx;held.g.position.z=p.z+held.dz}e.stopImmediatePropagation()}else cv.style.cursor=drawMode?'crosshair':hit()?'grab':'default'},true);
window.addEventListener('pointerup',e=>{if(held){glow(held.g,0);held=null;cv.style.cursor='default';return}if(!drawMode||e.target!==cv||Math.hypot(e.clientX-dpx,e.clientY-dpy)>5)return;ndc(e);const p=floorPt();if(p){wps.push(p);redrawWp()}},true);
window.addEventListener('wheel',e=>{if(!held)return;held.g.rotation.y+=Math.sign(e.deltaY)*Math.PI/12;e.preventDefault();e.stopImmediatePropagation()},{capture:true,passive:false});
window.addEventListener('keydown',e=>{if(/INPUT|SELECT/.test(document.activeElement.tagName))return;const g=held?held.g:lastG;if(!g)return;if(e.code=='KeyR'){if(g.userData.rot0===undefined)g.userData.rot0=g.rotation.y;g.rotation.y+=(e.shiftKey?-1:1)*Math.PI/12}if(e.key=='Delete'||e.key=='Backspace')delG(g)});
const SP={box:g=>part(g,.4,.4,.4,0,.2,0,0xc9a26b),crate:g=>{part(g,.5,.5,.5,0,.25,0,0x8d6e4b);part(g,.52,.05,.52,0,.5,0,0x6e5238)},ball:g=>part(g,.4,0,0,0,.2,0,0xdc2626,'s'),can:g=>part(g,.24,.35,0,0,.175,0,0xb8c2cc,.12)};
Object.entries(ROUND).forEach(([k,v])=>SP[k]=g=>v.build(g,part));
function spawn(ty){const f=follow?robot.position:tgt,g=grp(f.x+(random()-.5)*2,f.z+(random()-.5)*2);{const dx=g.position.x-robot.position.x,dz=g.position.z-robot.position.z,d=Math.hypot(dx,dz);if(d<.7){const a=d>.01?Math.atan2(dz,dx):random()*6.28;g.position.x=robot.position.x+Math.cos(a)*.7;g.position.z=robot.position.z+Math.sin(a)*.7}}   // never on top of the robot
 SP[ty](g);g.userData.label=ROUND[ty]?ROUND[ty].label:{box:'cardboard box',crate:'wooden crate'}[ty];g.userData.roll=ROUND[ty]&&ROUND[ty].roll;flag(g);spawned.push(g);lastG=g}
document.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>spawn(b.dataset.sp));
$('bDel').onclick=()=>lastG&&delG(lastG);$('bClrObj').onclick=()=>spawned.splice(0).forEach(delG);$('pAvoid').onchange=e=>CAP.avoid=e.target.checked;
// Build tab: in this room a Track card (choose / random track) and a Ramps card (angles of the current track) take the place of the Objects card
{const oc=document.querySelector('[data-sp]').closest('.card'),tc=document.createElement('div'),rc_=document.createElement('div');tc.className=rc_.className='card';oc.hidden=true;tc.id='trackCard';rc_.id='terrainLegacyControls';
 tc.innerHTML='<h3>Track <small>the room stays the same</small></h3><label class="pl">Track <select id="trkSel">'+PRESETS.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')+'<option value="random">🎲 Random</option></select></label>'+
  '<label class="pl" id="trkSeedL">Seed <input id="trkSeed" type="number" min="1" step="1" style="width:7em"></label><div class="btns"><button id="trkRand">🎲 New random track</button><button id="trkNext">⏭ Next track</button></div>'+
  '<label class="pl" id="trkRouteL">Route <select id="trkRoute"><option value="loop">Full loop</option><option value="shortcut">Shortcut loop (through the gate)</option></select></label>'+
  '<label class="chk"><input id="trkGuide" type="checkbox"> Blue dashed guide line</label><p class="mut" id="trkInfo"></p>';
 oc.before(tc);tc.after(rc_);
 const rises=()=>TR.feats.filter(f=>f.type==='rise'),rName=(f,i)=>(f.h<.15?'Hump ':'Bridge ')+(i+1);
 const stairsOf=()=>TR.feats.filter(f=>f.type==='stairs');
 function rampsUI(){const R=rises(),ST=stairsOf(),row=(id,lab,min,max,step)=>`<label class="pl">${lab} <input id="${id}" type="range" min="${min}" max="${max}" step="${step}"> <b id="${id}T"></b></label>`,hd=t=>`<p class="mut" style="margin:6px 0 0"><b>${t}</b></p>`;
  rc_.innerHTML='<h3>Ramps, stairs &amp; gate <small>this track</small></h3>'+
   (R.length?R.map((f,i)=>hd(rName(f,i)+' · '+(f.h*100).toFixed(0)+' cm high')+['up','down'].map(k=>row('rp_'+i+'_'+k,'Ramp '+k,4,30,.5)).join('')).join('')+'<p class="mut">Each ramp keeps its height, so a steeper ramp is shorter and the flat top gets longer (at least 0.3 m).</p>':'<p class="mut">This track has no ramps.</p>')+
   ST.map((f,i)=>hd('Stairs '+(i+1)+' · '+f.n+' steps up and down')+row('st_'+i,'Step height',2,8,.5)).join('')+(ST.length?'<p class="mut">The legacy step-height guide is '+(CLIMB*100).toFixed(1)+' cm; a higher step stops it.</p>':'')+
   (GATE?hd('Swing gate')+row('gm','Leaf mass',.5,10,.5)+row('gk','Closer spring',0,3,.1)+'<p class="mut">A heavier leaf takes more push; a stronger spring closes it faster. The robot opens it by ramming and pushing.</p>':'')+
   (R.length||ST.length?'<div class="btns"><button id="rpReset">↺ Defaults</button></div>':'');
  const show=()=>{R.forEach((f,i)=>['up','down'].forEach(k=>{$('rp_'+i+'_'+k).value=f[k];$('rp_'+i+'_'+k+'T').textContent=f[k].toFixed(1)+'° · '+f[k==='up'?'upL':'dnL'].toFixed(2)+' m'}));
   ST.forEach((f,i)=>{$('st_'+i).value=f.hs*100;$('st_'+i+'T').textContent=(f.hs*100).toFixed(1)+' cm'+(f.hs>CLIMB?' ⚠ too high':'')});
   if(GATE){$('gm').value=GP.m;$('gmT').textContent=GP.m.toFixed(1)+' kg';$('gk').value=GP.k;$('gkT').textContent=GP.k.toFixed(1)+' N·m/rad'}};
  R.forEach((f,i)=>['up','down'].forEach(k=>{const el=$('rp_'+i+'_'+k);el.oninput=e=>{f[k]=+e.target.value;fitRise(f);show()};el.onchange=()=>{relayout();show();toast(rName(f,i)+' ramp '+k+': '+f[k].toFixed(1)+'°, '+f[k==='up'?'upL':'dnL'].toFixed(2)+' m long')}}));
  ST.forEach((f,i)=>{const el=$('st_'+i);el.oninput=e=>{f.hs=+e.target.value/100;show()};el.onchange=()=>{relayout();rampsUI();toast('Stairs '+(i+1)+': '+(f.hs*100).toFixed(1)+' cm steps'+(f.hs>CLIMB?' (too high for this robot)':''))}});
  if(GATE){const sv=()=>{try{localStorage.setItem('rsw_gate',JSON.stringify({m:GP.m,k:GP.k}))}catch(e){}};$('gm').oninput=e=>{GP.m=+e.target.value;sv();show()};$('gk').oninput=e=>{GP.k=+e.target.value;sv();show()}}
  if(R.length||ST.length)$('rpReset').onclick=()=>{R.forEach(f=>{f.up=f.up0;f.down=f.down0});ST.forEach(f=>f.hs=f.hs0);relayout();rampsUI();toast('Default ramps and stairs restored')};show()}
 // after a ramp change: new height map + visuals; the route keeps its shape, only its height changes
 function relayout(){layout();saveAngles();pathLine.geometry.setFromPoints(curve.getPoints(Math.max(60,Math.round(curveLen*8))).map(lift))}
 function info(){$('trkSel').value=$('trkTop').value=TR.id;$('trkSeedL').style.display=TR.id==='random'?'':'none';$('trkSeed').value=TSEL.seed;
  $('trkRouteL').style.display=TR.shortcut?'':'none';$('trkRoute').value=TR.route;$('trkGuide').checked=guideOn;
  $('trkInfo').textContent=TR.name+' · '+TR.L.toFixed(1)+' m · '+([...TR.feats,...TR.surfs].sort((a,b)=>a.s0-b.s0).map(f=>({rise:'bridge',bumps:'bumps',gravel:'gravel',slip:'slippery',stairs:'stairs',grass:'grass',narrow:'narrow passage',gate:'gate'})[f.type]).join(', ')||'no features')+(TR.shortcut?' · shortcut lane with a swing gate':'')+(TR.island?' · centre island':'')}
 // the default route (full loop, or the shortcut loop through the gate): the robot goes back to the start line on it
 function useRoute(){curve=curve0=routeCurve();curveLen=len0=curve.getLength();loopRoute=true;t=0;DR.v=DR.i=0;kb=0;TM.init=false;pathLine.clear();pathLine.geometry.setFromPoints(curve.getPoints(900).map(lift))}
 $('trkRoute').onchange=e=>{TR.route=e.target.value;try{localStorage.setItem('rsw_route_'+TR.id,TR.route)}catch(x){}if(manualOn)$('bDrive').click();useRoute();
  curve.getPointAt(0,p);curve.getTangentAt(0,tan);robot.position.set(p.x,0,p.z);robot.rotation.y=Math.atan2(-tan.z,tan.x);settle();toast('Route: '+(TR.route==='shortcut'?'shortcut loop through the gate':'full loop')+' ('+curveLen.toFixed(1)+' m)')};
 $('trkGuide').onchange=e=>setGuide(e.target.checked);
 // switch track: rebuild the track, put the robot on the start line with its default route
 function useTrack(id,seed){TSEL={id,seed:seed||TSEL.seed};try{localStorage.setItem('rsw_track',JSON.stringify(TSEL))}catch(e){}
  TR=makeTrack(TSEL.id,TSEL.seed);loadAngles();layout();showIsland(TR.island);
  if(manualOn)$('bDrive').click();useRoute();
  curve.getPointAt(0,p);curve.getTangentAt(0,tan);robot.position.set(p.x,0,p.z);robot.rotation.y=Math.atan2(-tan.z,tan.x);settle();rampsUI();info();TESTS?.refresh();toast('Track: '+TR.name+' ('+TR.L.toFixed(1)+' m)');if(recOn)ev('track','The track changed to '+TR.name+', '+TR.L.toFixed(1)+' m long.')}
 applyLabTerrain=(settings,data)=>{localStorage.setItem('dynora-terrain-5-bench',JSON.stringify(data.terrain));localStorage.setItem('dynora-terrain-ride-11',JSON.stringify(data.ride));ride.configure(data.ride);paused=true;$('bPause').classList.add('on');useTrack('bench',1);WH=null;inHole=null;PX.reset();};
 $('trkSel').onchange=e=>useTrack(e.target.value);
 $('trkSeed').onchange=e=>{const s=Math.max(1,Math.round(+e.target.value)||1);useTrack('random',s)};
 $('trkRand').onclick=()=>useTrack('random',1+Math.floor(random()*99999));
 const order=[...PRESETS.map(p=>p.id),'random'];$('trkNext').onclick=()=>{const i=order.indexOf(TR.id),n=order[(i+1)%order.length];useTrack(n,n==='random'?1+Math.floor(random()*99999):TSEL.seed)};
 // top bar: a Track menu next to Environment (Random makes a new random track each time it is chosen)
 const top=document.createElement('select');top.id='trkTop';top.title='Choose a track';top.style.cssText='background:#1e293b;color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:4px 8px;margin-left:6px;font:inherit';
 top.innerHTML=$('trkSel').innerHTML;$('envSel').after(document.createTextNode('  Track'),top);
 top.onchange=e=>{const v=e.target.value;useTrack(v,v==='random'?1+Math.floor(random()*99999):TSEL.seed)};
 // dock button: opens Build → Track (near the top of the dock, so it is visible without scrolling)
 const db=document.createElement('button');db.id='bTrack';db.title='Choose a track: ready-made or random';db.innerHTML='<i>🏁</i><b>Tracks</b>';$('bTop').after(db);
 db.onclick=()=>{const b=document.querySelector('.tabs button[data-t="build"]');if(b)b.click();tc.scrollIntoView({behavior:'smooth',block:'start'})};
 rampsUI();info()}
// path editor
const wpG=new THREE.Group(),wLine=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xfacc15}));wpG.add(wLine);scene.add(wpG);
function redrawWp(){wpG.children.slice(1).forEach(c=>wpG.remove(c));wps.forEach((p,i)=>{const s=new THREE.Mesh(new THREE.SphereGeometry(.09),new THREE.MeshBasicMaterial({color:i?0xfacc15:0x4ade80}));s.position.set(p.x,.1,p.z);wpG.add(s)});wLine.geometry.setFromPoints(wps.map(p=>new THREE.Vector3(p.x,.06,p.z)));$('wpN').textContent=wps.length}
function applyPath(){if(wps.length<2){toast('Add at least 2 waypoints');return}loopRoute=$('pLoop').checked;curve=new THREE.CatmullRomCurve3(wps.map(p=>lift(new THREE.Vector3(p.x,0,p.z))),loopRoute,'centripetal');curveLen=curve.getLength();pathLine.clear();pathLine.geometry.setFromPoints(curve.getPoints(Math.max(60,Math.round(curveLen*8))).map(lift));t=0;toast('Path applied \u2013 '+curveLen.toFixed(1)+' m')}
$('bDraw').onclick=e=>{drawMode=!drawMode;e.target.classList.toggle('on',drawMode);toast(drawMode?'Click the floor to add waypoints (drag still orbits)':'Draw mode off')};
$('bUndo').onclick=()=>{wps.pop();redrawWp()};$('bFinish').onclick=applyPath;
$('bDefault').onclick=()=>{curve=curve0;curveLen=len0;loopRoute=true;pathLine.clear();pathLine.geometry.setFromPoints(curve.getPoints(900).map(lift));t=0;toast('Default route restored')};
$('bSavePath').onclick=()=>{localStorage.setItem('rsw_path_'+OP,JSON.stringify(wps.map(p=>[p.x,p.z])));toast('Path saved')};
$('bLoadPath').onclick=()=>{const d=JSON.parse(localStorage.getItem('rsw_path_'+OP)||'[]');wps=d.map(a=>new THREE.Vector3(a[0],0,a[1]));redrawWp();toast(d.length?'Path loaded \u2013 press Apply path':'No saved path')};

// ================= extra realism: textures, decor, detailed people, robot =================
const dg=(x,z,r=0)=>{const g=grp(x,z,r);fixed.push(g);return g};
const zWood=cx(512,512,(x,s)=>{x.fillStyle='#bbb';x.fillRect(0,0,s,s);for(let i=0;i<120;i++){x.strokeStyle='hsl(0,0%,'+rr(55,88)+'%)';x.lineWidth=rr(.6,3);x.beginPath();const y=rr(0,s);x.moveTo(0,y);x.bezierCurveTo(s*.3,y+rr(-9,9),s*.7,y+rr(-9,9),s,y+rr(-6,6));x.stroke()}});
const zWeave=cx(128,128,(x,s)=>{x.fillStyle='#ccc';x.fillRect(0,0,s,s);x.strokeStyle='#888';for(let i=0;i<s;i+=3){x.beginPath();x.moveTo(i,0);x.lineTo(i,s);x.stroke();x.beginPath();x.moveTo(0,i);x.lineTo(s,i);x.stroke()}},[2,2]);
const zPlaster=cx(256,256,(x,s)=>{x.fillStyle='#999';x.fillRect(0,0,s,s);for(let i=0;i<7000;i++){const v=rr(110,190)|0;x.fillStyle='rgb('+v+','+v+','+v+')';x.fillRect(rr(0,s),rr(0,s),2,2)}},[4,4]);
const zPlank=cx(1024,1024,(x,s)=>{const n=14,h=s/n;for(let r=0;r<n;r++){let px=-rr(0,300);while(px<s){const w=rr(380,640);x.fillStyle='hsl('+rr(24,32)+','+rr(34,46)+'%,'+rr(27,36)+'%)';x.fillRect(px,r*h,w,h);for(let g=0;g<14;g++){x.strokeStyle='rgba(0,0,0,'+rr(.03,.12)+')';x.lineWidth=rr(.5,1.6);x.beginPath();const y=r*h+rr(2,h-2);x.moveTo(px,y);x.bezierCurveTo(px+w*.3,y+rr(-3,3),px+w*.6,y+rr(-3,3),px+w,y+rr(-2,2));x.stroke()}x.fillStyle='rgba(0,0,0,.45)';x.fillRect(px,r*h,1.5,h);px+=w}x.fillStyle='rgba(0,0,0,.4)';x.fillRect(0,r*h,s,1.5)}},[5,4]);
// environment reflections (kept subtle)
const zpm=new THREE.PMREMGenerator(renderer),zes=new THREE.Scene();zes.add(new THREE.Mesh(new THREE.SphereGeometry(20,24,12),new THREE.MeshBasicMaterial({color:0x6b7a90,side:THREE.BackSide})));
[[0,10,0,12,.5,12],[-8,5,6,.5,6,10],[8,5,-6,.5,6,10]].forEach(a=>{const m=new THREE.Mesh(new THREE.BoxGeometry(a[3],a[4],a[5]),new THREE.MeshBasicMaterial({color:0xffffff}));m.position.set(a[0],a[1],a[2]);m.material.color.multiplyScalar(5);zes.add(m)});
scene.environment=zpm.fromScene(zes,.04).texture;
const skip=new Set();P.traverse(o=>skip.add(o));const hs={};
obstacles.forEach(m=>{const mt=m.material;if(!mt||!mt.isMeshStandardMaterial||skip.has(m))return;mt.color.getHSL(hs);
 if(mt.color.getHex()==0x6fb3d2){mt.roughness=.05;mt.envMapIntensity=.8}
 else if(mt.transparent&&mt.opacity<.5){mt.roughness=.9;mt.envMapIntensity=.08}
 else if(hs.s>.2&&hs.h>.04&&hs.h<.13){mt.roughness=.42;mt.envMapIntensity=.2}
 else if(hs.s<.2&&hs.l>.25&&hs.l<.9&&(hs.h>.5||hs.s<.03)){mt.metalness=.65;mt.roughness=.32;mt.envMapIntensity=.5}
 else{mt.roughness=.9;mt.envMapIntensity=.1}mt.needsUpdate=true});
P.traverse(o=>{if(o.isMesh)o.material.roughness=.6});
scene.traverse(o=>{if(o.isMesh&&o.material&&o.material.isMeshStandardMaterial&&o.material.envMapIntensity===1)o.material.envMapIntensity=.12});
sun.shadow.normalBias=.03;sun.shadow.bias=-.0003;
// walls: smooth paint, skirting + crown, outer walls fade when they face the camera (cut-away view)
const WALLCOL=0xe9e4da,WALLCOL2=0xe9e4da,BAND=0x3f7d6e,WALLS=[],wm=obstacles.filter(m=>m.geometry.parameters&&m.geometry.parameters.height===2.5);
const bx0=Math.min(...wm.map(m=>m.position.x)),bx1=Math.max(...wm.map(m=>m.position.x)),bz0=Math.min(...wm.map(m=>m.position.z)),bz1=Math.max(...wm.map(m=>m.position.z));
wm.forEach(m=>{const p=m.geometry.parameters,ax=p.width>p.depth?'z':'x',v=m.position[ax],lo=ax=='z'?bz0:bx0,hi=ax=='z'?bz1:bx1;let out=null;if(Math.abs(v-lo)<.3)out=ax=='z'?[0,-1]:[-1,0];else if(Math.abs(v-hi)<.3)out=ax=='z'?[0,1]:[1,0];
 m.material.color.setHex(m.position.z>4.5?WALLCOL2:WALLCOL);m.material.roughness=.9;m.material.envMapIntensity=.08;
 const ex=[[.12,.06,0xf3f3f1],[.06,2.47,0xf3f3f1]];const bc=BAND||(m.position.z>4.5?0x8fa3b8:null);if(bc)ex.unshift([1,.5,bc]);
 const exm=ex.map(([h,y,c])=>{const b=new THREE.Mesh(new THREE.BoxGeometry(p.width+(h==1?.012:.03),h,p.depth+(h==1?.012:.03)),new THREE.MeshStandardMaterial({color:c,roughness:.6,transparent:true}));b.position.set(m.position.x,y,m.position.z);scene.add(b);return b});
 WALLS.push({m,ex:exm,out,o:.97})});
function wallFade(){const dx=cam.position.x-tgt.x,dz=cam.position.z-tgt.z,l=Math.hypot(dx,dz)||1,ux=dx/l,uz=dz/l,top=ph<.25||fpOn||botView;
 WALLS.forEach(w=>{const tg=top?.9:w.out?(w.out[0]*ux+w.out[1]*uz>.2?.07:.97):.85;w.o+=(tg-w.o)*.15;[w.m,...w.ex].forEach(o=>{o.material.opacity=w.o;o.material.depthWrite=w.o>.9})})}
// signs and ceiling lights (no windows or curtains: nothing blocks the view)
const sign=(w,h,x,y,z,ry,txt,bg,fg)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:0xb8b8b8,map:cx(512,Math.round(512*h/w),(c,W,H)=>{c.fillStyle=bg;c.fillRect(0,0,W,H);c.fillStyle=fg;c.font='bold '+Math.round(H*.5)+'px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(txt,W/2,H/2)})}));m.position.set(x,y,z);m.rotation.y=ry;scene.add(m)};
sign(3.2,.5,-1.6,1.9,-2.99,0,'ROBOT TEST TRACK','#1e3a8a','#fff');sign(1,.28,-1.5,2.45,2.98,Math.PI,'EXIT','#16a34a','#fff');
[-3,0,3].forEach(x=>[-1.6,1.6].forEach(z=>{const f=new THREE.Mesh(new THREE.BoxGeometry(1.2,.05,.3),new THREE.MeshBasicMaterial({color:0xcfc8b4}));f.position.set(x,2.45,z);f.userData.fixture=true;scene.add(f)}));
// Driven robot geometry is created by robot-model.js in calibrated SI units.

// ===== controllable human (WASD) + contact shadows =====
const HSPAWN=[4.6,.9],HU=makeHuman({shirt:0x0ea5e9,pants:0x1f2937,hair:0x3b2a1e}),hg=new THREE.Group();hg.add(HU.g);hg.visible=false;hg.position.y=-100;scene.add(hg);   // parked below the floor while hidden, so sensors ignore it
HU.meshes.forEach(m=>{m.userData.dyn=true;obstacles.push(m)});
let humanOn=false,fp=false,fpOn=false,carried=null,hry=0,hph=0,FT=robot;const keys={},hset=new Set(HU.meshes),rc3=new THREE.Raycaster(),SHC=[0x0ea5e9,0xdc2626,0x16a34a,0xf59e0b,0x9333ea,0xe5e7eb];let shi=0;
function blocked(dx,dz){const l=Math.hypot(dx,dz);if(!l)return false;if(Math.hypot(hg.position.x+dx-robot.position.x,hg.position.z+dz-robot.position.z)<.5)return true;scene.updateMatrixWorld();const d=new THREE.Vector3(dx/l,0,dz/l);
 for(const y of[.25,.9,1.5]){rc3.set(new THREE.Vector3(hg.position.x,y,hg.position.z),d);rc3.far=rover.radius()+l;if(rc3.intersectObjects(obstacles,false).some(i=>!hset.has(i.object)&&!(carried&&i.object.parent===carried)))return true}return false}
function humanStep(dt){if(!humanOn)return;const run=keys.ShiftLeft||keys.ShiftRight,sp=run?3.2:1.5,fx_=-Math.sin(th),fz_=-Math.cos(th);let mx=0,mz=0;
 if(keys.KeyW||(keys.ArrowUp&&!manualOn)){mx+=fx_;mz+=fz_}if(keys.KeyS||(keys.ArrowDown&&!manualOn)){mx-=fx_;mz-=fz_}if(keys.KeyD||(keys.ArrowRight&&!manualOn)){mx-=fz_;mz+=fx_}if(keys.KeyA||(keys.ArrowLeft&&!manualOn)){mx+=fz_;mz-=fx_}
 const l=Math.hypot(mx,mz);
 if(l>0){mx/=l;mz/=l;const st=sp*dt;if(!blocked(mx*st,0))hg.position.x+=mx*st;if(!blocked(0,mz*st))hg.position.z+=mz*st;const ty=Math.atan2(-mz,mx);hry+=Math.atan2(Math.sin(ty-hry),Math.cos(ty-hry))*Math.min(1,dt*10);hph+=dt*sp*5.5}
 if(fp)hry=Math.atan2(Math.cos(th),-Math.sin(th));hg.rotation.y=hry;HU.pose(hph,l>0?(run?1.25:.8):0);
 if(carried){carried.position.set(hg.position.x+Math.cos(hry)*.75,.35,hg.position.z-Math.sin(hry)*.75);carried.rotation.y=hry}}
function fpCam(){if(!(humanOn&&fp))return;const p=1.1-ph,y=1.64;cam.position.set(hg.position.x+Math.cos(hry)*.1,y,hg.position.z-Math.sin(hry)*.1);cam.lookAt(cam.position.x-Math.sin(th)*Math.cos(p),y+Math.sin(p),cam.position.z-Math.cos(th)*Math.cos(p))}
function grab(){if(carried){carried.position.y=0;carried=null;toast('Dropped');return}let best=null,bd=1.6;movable().forEach(g=>{const d=Math.hypot(g.position.x-hg.position.x,g.position.z-hg.position.z);if(d<bd){bd=d;best=g}});
 if(!best)return toast('Nothing close enough to pick up');const s=new THREE.Box3().setFromObject(best).getSize(new THREE.Vector3());if(Math.max(s.x,s.z)>1.3)return toast('Too heavy to carry');carried=best;toast('Carrying \u2013 press E to drop')}
window.addEventListener('keydown',e=>{if(/INPUT|SELECT/.test(document.activeElement.tagName))return;keys[e.code]=true;if(e.code=='KeyH')return $('bHuman').click();if(e.code=='KeyM')return $('bDrive').click();if(manualOn&&e.code.startsWith('Arrow'))e.preventDefault();if(!humanOn)return;if(e.code.startsWith('Arrow'))e.preventDefault();
 if(e.code=='KeyE')grab();if(e.code=='KeyV'){fp=!fp;fpOn=fp;hg.visible=!fp;ph=fp?1.1:1.0}if(e.code=='KeyC'){shi=(shi+1)%SHC.length;HU.mats.sh.color.setHex(SHC[shi])}});
window.addEventListener('keyup',e=>{keys[e.code]=false});
$('bHuman').onclick=e=>{humanOn=!humanOn;$('bHuman').classList.toggle('on',humanOn);hg.visible=humanOn&&!fp;
 if(humanOn){hg.position.set(HSPAWN[0],0,HSPAWN[1]);follow=true;FT=hg;rad=5;ph=1.0;toast('WASD move \u00b7 Shift run \u00b7 E pick up/drop \u00b7 V first-person \u00b7 C shirt \u00b7 drag = look')}
 else{hg.position.y=-100;follow=false;FT=robot;fp=false;fpOn=false;carried=null}};
// soft contact shadows under every furniture group
const blobTex=cx(128,128,(c,s)=>{const g=c.createRadialGradient(64,64,4,64,64,64);g.addColorStop(0,'rgba(0,0,0,.5)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,s,s)});
MOV.slice().forEach(g=>{let dyn=false;g.traverse(o=>{if(o.userData&&o.userData.dyn&&!o.userData.pick)dyn=true});if(dyn||fixed.includes(g)&&g.children.length>40)return;const r=g.rotation.y;g.rotation.y=0;g.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(g);g.rotation.y=r;g.updateMatrixWorld(true);
 if(b.min.y>.25)return;const s=b.getSize(new THREE.Vector3());if(!isFinite(s.x)||s.y>2.3||s.x>6||s.z>6||s.x<.05)return;const c=b.getCenter(new THREE.Vector3());
 const m=new THREE.Mesh(new THREE.PlaneGeometry(s.x*1.35+.15,s.z*1.35+.15),new THREE.MeshBasicMaterial({map:blobTex,transparent:true,depthWrite:false,opacity:.75}));m.rotation.x=-Math.PI/2;m.position.set(c.x-g.position.x,.007,c.z-g.position.z);m.renderOrder=1;m.rotation.z=-r;m.userData={contactShadow:true,noContact:true,noDepth:true,editorAuxiliary:true};g.add(m)});

// ===== manual robot driving (arrow keys) =====
let manualOn=false,vcur=0,wcur=0;
function robBlocked(dx,dz){const l=Math.hypot(dx,dz);if(!l)return false;scene.updateMatrixWorld();const d=new THREE.Vector3(dx/l,0,dz/l),lat=new THREE.Vector3(-d.z,0,d.x);
 for(const off of[0,-TW/2,TW/2])for(const y of[WR,WR+.06]){rc3.set(new THREE.Vector3(robot.position.x,robot.position.y+y,robot.position.z).addScaledVector(lat,off),d);rc3.far=rover.radius()+l;if(rc3.intersectObjects(obstacles,false).some(i=>!(carried&&i.object.parent===carried)&&!i.object.userData.pick&&!i.object.userData.gate))return true}return false}   // the robot can push a gate leaf (gateStep), so it does not block
function manualStep(dt){if(!manualOn)return;const boost=(keys.ShiftLeft||keys.ShiftRight)?1.6:1,vt=(keys.ArrowUp?1:0)*VMAX*boost-(keys.ArrowDown?1:0)*VMAX*.7,wt=((keys.ArrowLeft?1:0)-(keys.ArrowRight?1:0))*1.8;
 PX.manual(dt,vt,wt);vcur=PX.drive.v;wcur=PX.drive.w;}
function resumePath(){let bi=0,bd=1e9;curve.getSpacedPoints(600).forEach((q,i)=>{const d=(q.x-robot.position.x)**2+(q.z-robot.position.z)**2;if(d<bd){bd=d;bi=i}});t=bi/600}
$('bDrive').onclick=()=>{manualOn=!manualOn;$('bDrive').classList.toggle('on',manualOn);vcur=wcur=0;
 if(manualOn){if(!humanOn){follow=true;FT=robot;rad=6;ph=.9}toast('Arrow keys: \u2191 forward \u00b7 \u2193 reverse \u00b7 \u2190 \u2192 turn \u00b7 Shift boost \u00b7 press Drive again to resume the path')}else{resumePath();if(!humanOn)follow=false}};

// ===== language annotations: captions, Q&A, action labels and event comments (ground truth from the simulator) =====
// zones: the track part under the point (from the height / zone raster), else the centre island (classic loop), else the room floor
const ENVNAME='obstacle track';
let anns=[],evts=[],lastImg='',fHitObj=null;
const zoneAt=(x,z)=>zoneCell(x,z)||(TR.island&&Math.abs(x)<3.2&&Math.abs(z)<1.55?'centre island':'room floor');
const ownerOf=o=>{while(o){if(o.userData&&o.userData.label)return o;o=o.parent}return null};
const nameOf=o=>{const r=ownerOf(o);if(r)return r.userData.label;const p=o&&o.geometry&&o.geometry.parameters;return p&&p.height===2.5?'wall':'obstacle'};
const rg=(row,n)=>row[HDR.indexOf(n)]===''?NaN:+row[HDR.indexOf(n)];
const where=a=>Math.abs(a)<12?'directly ahead':Math.abs(a)<40?(a>0?'ahead to the left':'ahead to the right'):(a>0?'to the left':'to the right');
function visible(){rcam.updateMatrixWorld(true);scene.updateMatrixWorld();const fr=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(rcam.projectionMatrix,rcam.matrixWorldInverse)),cp=new THREE.Vector3().setFromMatrixPosition(rcam.matrixWorld),ry=robot.rotation.y,fx_=Math.cos(ry),fz_=-Math.sin(ry),out=[],labs=[];
 scene.traverse(o=>{if(o.userData&&o.userData.label&&o.visible&&o.parent)labs.push(o)});
 labs.forEach(o=>{const b=new THREE.Box3().setFromObject(o);if(b.isEmpty())return;const c=b.getCenter(new THREE.Vector3()),d=cp.distanceTo(c);if(d>7||!fr.containsPoint(c))return;
  rc.set(cp,c.clone().sub(cp).normalize());rc.far=d+.2;const hh=rc.intersectObjects(obstacles,false)[0];if(hh&&hh.distance<d-.35){const r=ownerOf(hh.object);if(!(r&&(r===o||o.getObjectById(r.id))))return}
  const xs=[],ys=[];for(const X of[b.min.x,b.max.x])for(const Y of[b.min.y,b.max.y])for(const Z of[b.min.z,b.max.z]){const v=new THREE.Vector3(X,Y,Z).project(rcam);xs.push((v.x+1)/2);ys.push((1-v.y)/2)}
  const cl=v=>+Math.max(0,Math.min(1,v)).toFixed(3),dx=c.x-robot.position.x,dz=c.z-robot.position.z,ang=Math.atan2(dx*fz_-dz*fx_,dx*fx_+dz*fz_)*180/Math.PI;
  out.push({label:o.userData.label,dist_m:+d.toFixed(2),angle_deg:+ang.toFixed(1),where:where(ang),bbox_norm:[cl(Math.min(...xs)),cl(Math.min(...ys)),cl(Math.max(...xs)),cl(Math.max(...ys))]})});
 return out.sort((a,b)=>a.dist_m-b.dist_m)}
function stateText(row,blk){const m=row[5],v=rg(row,'v_mps'),w=rg(row,'omega_dps');
 if(m==='OBSTACLE_STOP')return'stopped because '+(blk||'an obstacle')+' is blocking its way';
 if(m==='TURNING')return'turning '+(w>0?'left':'right')+' while following its path';
 if(m==='MANUAL')return Math.abs(v)<.03?'stationary under manual control':'being driven manually by the operator at '+v.toFixed(2)+' m/s';
 if(m==='CRUISING')return'driving forward at '+v.toFixed(2)+' m/s along its patrol path';return'stationary'}
function annotate(row,nm){LAB.prepareCamera(CAP.w,CAP.h);if(annSet.has(nm))return;annSet.add(nm);
 const validity=Object.fromEntries(['front','left','right','back'].map(n=>[n,row[HDR.indexOf('tof_'+n+'_status')]]));
 if(Object.values(validity).some(v=>v!=='ok')){const obs=visible();anns.push({visual_objects:VIS.states(),id:nm.split('/').pop(),image:nm,run_id:row[HDR.indexOf('run_id')],frame_id:row[HDR.indexOf('frame_id')],sim_time_s:+row[1],environment:ENVNAME,zone:zoneAt(+row[6],-row[7]),pose:{x_m:+row[6],y_m:+row[7],yaw_deg:+row[8]},visible_objects:obs,sensor_status:validity,caption:'Simulator camera in '+zoneAt(+row[6],-row[7])+'. Projected visible labels: '+(obs.map(o=>o.label).join(', ')||'none detected by the visibility heuristic')+'. Some ToF readings are unavailable or out of range; no range-based safety answer is generated.',conversations:[],action:null});return;}
 const x=rg(row,'x_m'),z=-rg(row,'y_m'),zn=zoneAt(x,z),obs=visible(),blk=fHitObj?nameOf(fHitObj):null,cm=v=>(v*100).toFixed(0),
 tf={front:rg(row,'tof_front_m'),left:rg(row,'tof_left_m'),right:rg(row,'tof_right_m'),back:rg(row,'tof_back_m')},near=Object.entries(tf).sort((a,b)=>a[1]-b[1])[0],
 seen=obs.length?'sees '+obs.slice(0,5).map(o=>o.label+' '+o.where+' ('+o.dist_m.toFixed(1)+' m)').join(', '):'sees only an empty stretch of floor and wall',
 cap='In the '+zn+', the robot camera '+seen+'. The robot is '+stateText(row,blk)+'. '+(near[1]<1.999?'The closest obstacle is '+cm(near[1])+' cm to the '+near[0]+'.':'Nothing is within 2 m of the ToF sensors.'),
 ppl=obs.filter(o=>/person|cook|cashier/.test(o.label)).length,f=tf.front,
 safe=f>=.7?'Yes. The front ToF shows the way is clear for at least '+Math.min(2,f).toFixed(1)+' m.':f>.3?'Use caution. Something is '+cm(f)+' cm ahead, so the robot should slow down.':'No. An obstacle is only '+cm(f)+' cm ahead, so the robot should stop.',
 act=f<=.3?'stop and wait until the path is clear':tf.left>tf.right+.5&&f<1?'steer left where there is more space':tf.right>tf.left+.5&&f<1?'steer right where there is more space':'keep driving forward along its path',
 conv=[['<image>\nDescribe what the robot camera sees and what the robot is doing.',cap],['What is directly ahead of the robot?',f>=1.999?'Nothing within 2 m. The path ahead is open.':(blk||'An obstacle')+' is about '+cm(f)+' cm ahead.'],['Is it safe to keep moving forward?',safe],
  ['Where is the robot?','In the '+zn+', at x = '+x.toFixed(1)+' m, y = '+(-z).toFixed(1)+' m.'],['How many people can you see?',ppl?ppl+(ppl>1?' people are':' person is')+' visible.':'No people are visible.'],['What should the robot do next?','It should '+act+'.']];
 anns.push({visual_objects:VIS.states(),id:nm.replace(/.*\//,'').replace(/\.\w+$/,''),image:nm,sim_time_s:+row[1],operator:OP,environment:ENVNAME,zone:zn,pose:{x_m:x,y_m:-z,yaw_deg:rg(row,'yaw_deg')},
  state:{mode:row[5],v_mps:rg(row,'v_mps'),omega_dps:rg(row,'omega_dps'),pwm_left:rg(row,'pwm_left'),pwm_right:rg(row,'pwm_right'),battery_pct:rg(row,'batt_pct')},tof_m:tf,lighting:LT.info(),instruction:NR.last(),task:TK.info(),visible_objects:obs,
  action:{linear_mps:rg(row,'v_mps'),angular_dps:rg(row,'omega_dps'),text:act},caption:cap,conversations:conv.flatMap(([q,a])=>[{from:'human',value:q},{from:'gpt',value:a}])})}
const EV={prev:null,zone:'',door:false,lap:0,bat50:false,bat20:false,warn:{},pers:-9};
// each event gets a camera frame taken at that moment (events in the same frame share it)
let pendNm=null;const annSet=new Set();
function evImg(r){return pendNm||lastImg}

function ev(type,text,row){const r=row||LIVE;
 const el=$('evlog');if(el){el.insertAdjacentHTML('afterbegin','<div>['+(r?(+r[1]).toFixed(1):'0')+' s] '+text+'</div>');while(el.children&&el.children.length>14)el.removeChild(el.lastElementChild)}}
function detect(row){const g=n=>rg(row,n),t=+row[1],zn=zoneAt(g('x_m'),-g('y_m')),md=row[5],cm=v=>(v*100).toFixed(0);
 if(!EV.prev){EV.prev=md;EV.zone=zn;EV.lap=g('lap');EV.door=g('door_open_pct')>50;ev('start','Recording started. The robot is in the '+zn+' in '+md.toLowerCase().replace('_',' ')+' mode.',row);return}
 if(md!==EV.prev){const blk=fHitObj?nameOf(fHitObj):'an obstacle',w=g('omega_dps');
  if(md==='OBSTACLE_STOP')ev('obstacle_stop','Route avoidance (no contact required): the robot stopped because '+blk+' is only '+cm(g('tof_front_m'))+' cm ahead (front ToF), which would risk a collision.',row);
  else if(EV.prev==='OBSTACLE_STOP')ev('resume','The way ahead is clear again, so the robot resumed driving.',row);
  if(md==='TURNING')ev('turn','The robot started turning '+(w>0?'left':'right')+' to follow a bend in its path.',row);
  else if(EV.prev==='TURNING'&&md==='CRUISING')ev('turn_end','The robot finished the turn and is driving straight again.',row);
  if(md==='MANUAL')ev('manual','The operator took manual control of the robot.',row);else if(EV.prev==='MANUAL')ev('auto','The robot returned to autonomous path following.',row);
  if(md==='PAUSED')ev('pause','The robot was paused.',row);else if(EV.prev==='PAUSED')ev('unpause','The robot was resumed.',row);EV.prev=md}
 if(zn!==EV.zone){ev('zone','The robot moved from the '+EV.zone+' into the '+zn+'.',row);EV.zone=zn}
 const dopen=g('door_open_pct')>50;if(dopen!==EV.door){ev('door','The automatic door '+(dopen?'opened as someone approached it.':'closed again.'),row);EV.door=dopen}
 if(g('lap')>EV.lap){EV.lap=g('lap');ev('lap','The robot completed lap '+EV.lap+' of its route.',row)}
 const bp=g('batt_pct');if(bp<50&&!EV.bat50){EV.bat50=true;ev('battery','Battery dropped below 50% ('+bp.toFixed(0)+'%).',row)}if(bp<20&&!EV.bat20){EV.bat20=true;ev('battery','Battery is low ('+bp.toFixed(0)+'%); the robot should return to the charging dock.',row)}
 ['front','left','right','back'].forEach(k=>{const v=g('tof_'+k+'_m');if(v<.3&&t-(EV.warn[k]===undefined?-9:EV.warn[k])>4){EV.warn[k]=t;ev('proximity','Close obstacle: the '+k+' ToF sensor reads only '+cm(v)+' cm.',row)}});
 const pd=g('person_dist_m');if(pd<1.5&&t-EV.pers>5){EV.pers=t;ev('person_near','A person is '+pd.toFixed(1)+' m from the robot, so it should slow down and watch for movement.',row)}}
const evCsv=E=>'\ufeffsim_time_s,type,zone,x_m,y_m,text,image\n'+E.map(e=>[e.sim_time_s,e.type,e.zone,e.x_m,e.y_m,'"'+e.text.replace(/"/g,'""')+'"',e.image].join(',')).join('\n');
{const hb=$('bHuman').onclick;$('bHuman').onclick=e=>{hb(e);if(recOn)ev('human',humanOn?'A human operator entered the scene and can walk around the robot.':'The human operator left the scene.')};
 const ap=$('bFinish').onclick;$('bFinish').onclick=()=>{ap();if(recOn)ev('path','A custom path with '+wps.length+' waypoints was applied; the robot now follows the operator-drawn route.')}}
hg.userData.label='person (human player)';
// ===== time of day + switchable bulbs =====
const LT=initLighting({scene,renderer,cam,sun,envKey:ENVNAME,toast,actor:()=>humanOn?hg.position:robot.position,onToggle:b=>recOn&&ev('light','The '+b.name+' light was switched '+(b.on?'on':'off')+'.'),
 bulbs:[{name:'island west',x:-2,z:0},{name:'island east',x:2,z:0},{name:'start',x:-3.4,z:2.2},{name:'ramp',x:2.4,z:2.2},{name:'gravel corner',x:3.8,z:-2},{name:'bridge',x:0,z:-2.3},{name:'slope',x:-3.9,z:-.5}]});
const PT=initPaint({scene,renderer,cam,toast});
const RL=initRoll({obstacles,cam,toast,robot,target:Object.assign(()=>lastG,{all:movable}),human:()=>humanOn?hg:null});
const RT=initRotate({scene,cam,target:()=>lastG});
const MV=initMove({scene,cam,renderer,obstacles,target:()=>lastG,movable});
const NR=initNarrate({scene,robot,path:()=>({curve,t,len:curveLen,loop:loopRoute}),zone:zoneAt,blocker:()=>fHitObj?nameOf(fHitObj):null,manual:()=>manualOn,log:(ty,x)=>recOn&&ev(ty,x)});
const TK=initTask({scene,cam,renderer,obstacles,robot,zone:zoneAt,progress:()=>t,say:NR.say,log:(ty,x)=>recOn&&ev(ty,x),
 setRoute:pts=>{if(manualOn)$('bDrive').click();curve=new THREE.CatmullRomCurve3(pts,false,'centripetal');curveLen=curve.getLength();loopRoute=false;pathLine.clear();pathLine.geometry.setFromPoints(curve.getPoints(Math.max(60,Math.round(curveLen*8))).map(lift));t=0;TM.init=false;curve.getPointAt(0,p);robot.position.set(p.x,0,p.z)}});
// no walking people in this room, so no Build → People card
const PP={update(){},info:()=>[]};
[[cart,'tray trolley'],[door,'glass entrance door']].forEach(([g,l])=>{g.userData.label=l});
// robot ↔ object collisions (momentum): light objects are pushed, heavy ones push the robot back
let kb=0;const CO=initCollide({robot,movable,obstacles,roll:RL,radius:rover.radius,top:()=>robot.position.y+rover.bodyHeight(),say:NR.say,log:(ty,x)=>recOn&&ev(ty,x),bump:(dv,heavy)=>{PX.impulse(dv);if(heavy&&!manualOn)spd*=.3}});
// no windows in this room, so no curtains: CU keeps the same update / info shape for the loop and metadata
const CU={update(){},info:()=>({windows:0,closed:0})};
// Ordinary depth testing now handles the actual floor openings and cavity meshes.
initWheelErr({toast});   // Settings → Wheel speed error
// Build → Weights (kg): robot + every movable object, and the swing gate's leaf when the track has a gate
initWeights({envKey:ENVNAME,movable,select:g=>{lastG=g},spawned:()=>spawned,toast,
 extras:[{id:'gate',name:'🚪 Gate leaf (each)',get:()=>GP.m,set:m=>{GP.m=Math.min(10,Math.max(.5,m));try{localStorage.setItem('rsw_gate',JSON.stringify({m:GP.m,k:GP.k}))}catch(e){}},def:2.5,min:.5,max:10,show:()=>!!GATE}]});

// Shared fixed-step dynamics and calibration UI. Events run after module initialization.
const PX=initResearch({rover,scene,env:ENVNAME,blocked:robBlocked,zone:zoneAt,height:HT,pathState:()=>({curve,t,len:curveLen,loop:loopRoute}),setProgress:value=>t=value,isPaused:()=>paused,toast,canCalibrate:()=>!recOn,
 parametersChanged:parameters=>{TW=parameters.track;WR=parameters.radius;VMAX=parameters.rpm*Math.PI/30*WR;WHEELS.splice(0,4,[parameters.wheelbase/2,TW/2],[parameters.wheelbase/2,-TW/2],[-parameters.wheelbase/2,TW/2],[-parameters.wheelbase/2,-TW/2]);}});

const LAB=initLab({PX,rover,scene,env:ENVNAME,CAP,LT,PP,CU,recording:()=>recOn,getRows:()=>rows,getImages:()=>imgs,pathState:()=>({curve,t,len:curveLen,loop:loopRoute}),obstacles,movable,spawn,setSensorRange:range=>RANGE=range,
 restorePath:route=>{if(!Array.isArray(route.points)||route.points.length<2||route.points.length>1000||route.points.some(p=>!Array.isArray(p)||p.length!==3||p.some(v=>!Number.isFinite(v)||Math.abs(v)>100)))throw Error('Invalid saved route');curve=new THREE.CatmullRomCurve3(route.points.map(p=>new THREE.Vector3().fromArray(p)),false,'centripetal');curveLen=curve.getLength();loopRoute=!!route.loop;t=0;pathLine.geometry.setFromPoints(curve.getPoints(Math.max(60,Math.round(curveLen*8))));}});
const VIS=initVisualStudio({renderer,scene,cam,sun,rover,obstacles,walls:WALLS,floor,grid,ground:HT,env:ENVNAME,PX,recording:()=>recOn,toast,applyLabRide:settings=>ride.configure(settings),applyLabTerrain:(settings,data)=>applyLabTerrain(settings,data),contactObjects:movable,contactHinges:()=>GATE?GATE.leaves.map(leaf=>({object:leaf.piv,mass:GP.m,stiffness:GP.k,damping:GP.c,limit:GP.max})):[],onCollision:event=>{if(recOn)ev('collision','Contact with '+event.object+'; impulse '+event.net_robot_impulse_Ns.toFixed(3)+' N·s; forward speed '+event.forward_speed_after_mps.toFixed(3)+' m/s.')},layoutObjects:()=>MOV.filter(g=>g.parent===scene&&![P,cart,door].includes(g)&&!(()=>{let human=false;g.traverse(o=>{if(o.userData.human)human=true});return human})())});
resetDepthSelections=()=>VIS.resetDepthSelections();
terrainPhysics=VIS.physics;
const SPEED=initSpeedControl({env:ENVNAME,PX,CAP,robot,zone:zoneAt,log:(kind,message)=>{if(recOn)ev(kind,message)}});
TESTS=initTrackTests({getTrack:()=>TR,point:at,rebuild:()=>{layout();WH=null;inHole=null;pathLine.geometry.setFromPoints(curve.getPoints(900).map(lift));settle()},drive:()=>PX.drive,progress:()=>t,recording:()=>recOn,pause:()=>{paused=true},focus:c=>{follow=false;tgt.set(c.x,0,c.z);ph=.5;rad=4;th=.6},runRoute:(s0,s1,d)=>{if(manualOn)$('bDrive').click();const P=[];for(let s=s0;s<=s1;s+=.035){const c=at(s,d);P.push(new THREE.Vector3(c.x,0,c.z))}const c=at(s1,d);P.push(new THREE.Vector3(c.x,0,c.z));curve=new THREE.CatmullRomCurve3(P,false,'centripetal');curveLen=curve.getLength();loopRoute=false;t=0;pathLine.geometry.setFromPoints(curve.getPoints(250).map(lift));robot.position.copy(P[0]);const tangent=curve.getTangentAt(0);robot.rotation.y=Math.atan2(-tangent.z,tangent.x);paused=false;SPEED.reset();WH=null;inHole=null;settle();PX.reset();}});
PX.setTerrainStep((h,state)=>{settle(h,false);potholeStep();TESTS.sample(h,state,robot,settle.wh)});
const TOOLS=initRoverTools({renderer,scene,camera:cam,rover,PX,LAB,VIS,env:ENVNAME,settleSpawn:()=>{WH=null;inHole=null;settle();SPEED.reset();t=closestRouteProgress(curve,robot.position);},recording:()=>recOn,isPaused:()=>paused,setPaused:on=>{paused=on;$('bPause').classList.toggle('on',on)},notify:toast});
initStudioLayout();
$('bRec').disabled=true;VIS.ready.then(()=>{terrainPhysics.setTerrain(HT);$('bRec').disabled=false;last=performance.now();requestAnimationFrame(loop)}).catch(error=>{$('rst').textContent='Visual startup failed: '+error.message;console.error(error)});
