import {saveCameraSnapshot} from './camera-snapshot.js';
import {addCaster} from './caster-model.js';
import {initRoverTools} from './rover-tools.js';
import {SensorRayIndex} from './sensor-ray-index.js';
import {FrameProfiler} from './frame-budget.js';
import {wireRecordingControls} from './recording-controls.js';
import {renderDisplayFrame} from './render-frame.js';
import {HumanController,HumanNavigation,sceneSeats} from './human-actions.js';
import {publishRecording,restoreRecordingDownloads,resetRecordingDownloads} from './recording-download.js';
import {initStudioLayout} from './studio-layout.js';
import {initSpeedControl} from './speed-control.js';
import {initVisualStudio} from './visual-studio.js';
import {createFurniture} from './visual-models.js';
import {initLab,LAB_COLUMNS} from './lab.js';
import {randomStream} from './app-random.js';
const random=randomStream('main');
import {DEFAULTS} from './dynamics.js';
import {createRover} from './robot-model.js';
import {initResearch,PHYSICS_COLUMNS} from './research.js';
import {makeHuman} from './human.js';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as THREE from 'three';
import {csvText,datasetZip,datasetFiles,verifyDatasetZip} from './dataset-export.js';
import {initMove} from './move3d.js';
import {initLighting} from './lighting.js';
import {initPaint} from './paint.js';
import {initRoll,ROUND} from './roll.js';
import {initNarrate} from './narrate.js';
import {initRotate} from './rotate.js';
import {initTask} from './task.js';
import {initPeople} from './people.js';
import {initCollide,ROBOT_KG} from './collide.js';
import {initWeights} from './weights.js';
import {initWheelErr,sideErr,wheelErrInfo} from './wheelerr.js';
import {initCurtains} from './curtains.js';
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
sun.shadow.camera.left=-18;sun.shadow.camera.right=18;sun.shadow.camera.top=18;sun.shadow.camera.bottom=-18;sun.shadow.mapSize.set(2048,2048);
scene.add(sun);

// floor + grid
const floor=new THREE.Mesh(new THREE.PlaneGeometry(10,8),new THREE.MeshStandardMaterial({map:(()=>{const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');for(let i=0;i<16;i++){x.fillStyle='hsl(30,'+(35+random()*10)+'%,'+((dark?28:58)+random()*8)+'%)';x.fillRect(0,i*32,512,31);for(let j=0;j<3;j++){x.fillStyle='#0003';x.fillRect(random()*512,i*32,2,31)}}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(5,4);return t})()}));
floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const grid=new THREE.GridHelper(10,10,0x888888,0x888888);grid.scale.z=0.8;grid.position.y=0.005;
grid.material.opacity=0.35;grid.material.transparent=true;scene.add(grid);

const obstacles=[],FIXED0=[];
function box(w,h,d,x,z,color,solid=true){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color}));
  m.position.set(x,h/2,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);
  if(solid)obstacles.push(m);return m;
}
// walls (height 2.5, semi-transparent so you can see in)
const wallMat=0xb9c2cf;
function wall(w,d,x,z){const m=box(w,2.5,d,x,z,wallMat);m.material.transparent=true;m.material.opacity=0.45;}
wall(10.2,0.2,0,-4.1);wall(6.4,0.2,-1.9,4.1);wall(2.4,0.2,3.9,4.1);wall(0.2,8,-5.1,0);wall(0.2,8,5.1,0);
wall(0.2,3.5,1,-2.25);wall(0.2,3.5,1,2.25); // doorway at z -0.5..0.5

// furniture
function part(g,w,h,d,x,y,z,c,s){const geo=s==='s'?new THREE.SphereGeometry(w/2,28,18):s?new THREE.CylinderGeometry(w/2,s,h,28):new RoundedBoxGeometry(w,h,d,3,Math.min(.05,Math.min(w,h,d)/2.5));const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:c,roughness:0.7}));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;g.add(m);obstacles.push(m);return m}
const MOV=[];function grp(x,z,r=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=r;scene.add(g);MOV.push(g);return g}
function chair(x,z,r,c){const g=grp(x,z,r);g.userData.label='chair';part(g,.42,.05,.42,0,.45,0,c);part(g,.42,.42,.04,0,.7,-.19,c);[[-.18,-.18],[.18,-.18],[-.18,.18],[.18,.18]].forEach(p=>part(g,.04,.45,.04,p[0],.22,p[1],0x3a2a1c))}
function officeChair(x,z,r){const g=grp(x,z,r);g.userData.label='office chair';part(g,.55,.04,0,0,.07,0,0x222222,.27);part(g,.06,.4,0,0,.28,0,0x888888,.06);part(g,.5,.08,.5,0,.5,0,0x2d3748);part(g,.46,.5,.07,0,.8,-.24,0x2d3748);part(g,.05,.04,.3,.27,.62,0,0x222222);part(g,.05,.04,.3,-.27,.62,0,0x222222);for(const x of[-.27,.27])part(g,.05,.16,.04,x,.56,0,0x222222);part(g,.05,.16,.045,0,.56,-.215,0x222222)}
const tb=grp(-3,-2);part(tb,1.6,.05,.9,0,.75,0,0x8d6e4b);[[-.72,-.38],[.72,-.38],[-.72,.38],[.72,.38]].forEach(p=>part(tb,.07,.73,.07,p[0],.37,p[1],0x6e5238));part(tb,.12,.25,0,0,.9,0,0x3b8ea5,.08);
chair(-3.4,-1.3,Math.PI,0xb5651d);chair(-2.6,-1.3,Math.PI,0xb5651d);chair(-3.4,-2.7,0,0xb5651d);chair(-2.6,-2.7,0,0xb5651d);      // table
const rug=new THREE.Mesh(new THREE.PlaneGeometry(3,2),new THREE.MeshStandardMaterial({color:0x9b4d5a}));rug.rotation.x=-Math.PI/2;rug.position.set(-3.5,0.012,2.0);rug.receiveShadow=true;scene.add(rug);
const sf=grp(-3.5,2.8);part(sf,2,.3,.9,0,.25,0,0x3d5a8c);part(sf,.9,.14,.7,-.45,.47,-.08,0x4a6fa5);part(sf,.9,.14,.7,.45,.47,-.08,0x4a6fa5);part(sf,2,.55,.2,0,.7,.35,0x3d5a8c);part(sf,.18,.5,.9,-.95,.5,0,0x34507c);part(sf,.18,.5,.9,.95,.5,0,0x34507c);part(sf,.4,.35,.12,-.6,.75,.2,0xe9c46a);part(sf,.4,.35,.12,.6,.75,.2,0xe76f51);
const ct=grp(-3.5,1.5);part(ct,1,.04,.5,0,.42,0,0xdcc7a1);[[-.45,-.2],[.45,-.2],[-.45,.2],[.45,.2]].forEach(p=>part(ct,.05,.4,.05,p[0],.2,p[1],0x333333));part(ct,.3,.04,.22,.1,.46,0,0xc0392b);    // sofa
const sh=grp(3.5,-3.6);part(sh,.05,1.8,.4,-.98,.9,0,0x6b4f3a);part(sh,.05,1.8,.4,.98,.9,0,0x6b4f3a);part(sh,2,1.8,.03,0,.9,-.19,0x5a4130);[.02,.45,.9,1.35,1.78].forEach(y=>part(sh,1.92,.04,.4,0,y,0,0x6b4f3a));
[.47,.92,1.37].forEach(y=>{let x=-.88;while(x<.85){const w=.04+random()*.05,h=.2+random()*.12;part(sh,w,h,.22,x+w/2,y+h/2+.02,0,random()*0xffffff);x+=w+.01}});    // shelf
const cb=grp(3.7,2);part(cb,1,1,1,0,.5,0,0xc9a26b);part(cb,1.02,.01,.18,0,1.0,0,0xe9d8b4);         // box obstacle
const bn=grp(-1.2,-3.0);part(bn,.38,.62,0,0,.31,0,0x5b6670,.26);part(bn,.4,.05,0,0,.64,0,0x2b8a3e,.2);part(bn,.1,.04,.04,0,.69,0,0x1d1d1d);
const b2=grp(-0.5,-3.5);part(b2,.26,.4,0,0,.2,0,0x2b6cb0,.18);part(b2,.28,.04,0,0,.42,0,0x1e4e8c,.14);
const pl=grp(-4.5,-3.5);part(pl,.4,.4,0,0,.2,0,0xb5523b,.28);part(pl,.34,.03,0,0,.41,0,0x3b2a1e,.17);for(let i=0;i<16;i++){const a=i/16*Math.PI*2,m=part(pl,.012,.6,0,Math.cos(a)*.1,.7,Math.sin(a)*.1,i%2?0x2e8b57:0x3aa76d,.06);m.rotation.z=-Math.cos(a)*.55;m.rotation.x=Math.sin(a)*.55}
const tv=grp(-4.75,0);part(tv,.45,.5,1.6,0,.25,0,0x3a2f2a);part(tv,.05,.65,1.1,.1,.85,0,0x111111);
const dk=grp(4.4,3.1);part(dk,.8,.04,1.6,0,.74,0,0xd8c3a5);[[-.35,-.7],[.35,-.7],[-.35,.7],[.35,.7]].forEach(p=>part(dk,.05,.72,.05,p[0],.36,p[1],0x444444));part(dk,.04,.35,.55,.2,.94,0,0x111111);part(dk,.15,.03,.15,.2,.78,0,0x222222);
officeChair(3.6,3.1,Math.PI/2);   // plant/bin
const cr=grp(4.2,0.9);part(cr,.6,.6,.6,0,.3,0,0xa0763f);part(cr,.62,.04,.62,0,.3,0,0x6e4e24);part(cr,.4,.35,.4,0,.78,0,0x7d5ba6);
const rr=(a,b)=>a+random()*(b-a);
function cx(w,h,draw,rep){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;if(rep)t.repeat.set(rep[0],rep[1]);t.anisotropy=8;return t}
let tileBase=null;function tileTex(w,d){if(!tileBase)tileBase=cx(256,256,(x,s)=>{x.fillStyle='#4b5563';x.fillRect(0,0,s,s);for(let i=0;i<4;i++)for(let j=0;j<4;j++){x.fillStyle='hsl(215,12%,'+(60+rr(-5,5))+'%)';x.fillRect(i*64+2,j*64+2,60,60)}});const t=tileBase.clone();t.needsUpdate=true;t.repeat.set(w/2.4,d/2.4);return t}
function fl(w,d,x,z,c){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshStandardMaterial({color:0xffffff,map:tileTex(w,d),roughness:.4}));m.rotation.x=-Math.PI/2;m.position.set(x,0.004,z);m.receiveShadow=true;scene.add(m)}
// corridor wing: S-shaped, 1.4 m wide, 3 turns, chicane, charging dock
wall(0.2,3.3,1.3,5.65);wall(0.2,4.8,2.7,6.4);wall(6.2,0.2,-1.7,7.3);wall(6.0,0.2,-0.3,8.7);wall(0.2,4.5,-4.7,9.55);wall(0.2,1.6,-3.3,9.5);wall(7.3,0.2,0.35,10.3);wall(8.8,0.2,-0.4,11.8);wall(0.2,1.5,4.0,11.05);
wall(0.2,0.5,-1.5,10.65);wall(0.2,0.5,0.2,11.35);wall(0.2,0.5,1.9,10.65);
const cf=0x8b95a1;fl(1.4,4.8,2,6.4,cf);fl(7.4,1.4,-1,8,cf);fl(1.4,3.2,-4,10.1,cf);fl(7.7,1.4,0,11,cf);fl(1.2,1.0,2,4,cf);
fl(0.9,0.9,3.3,11,0x2ecc71);const dc=grp(3.83,11);part(dc,.14,.55,.5,0,.28,0,0x2f9e44);part(dc,.04,.08,.3,-.09,.35,0,0xffd43b);
// moving objects
const SK=0xe0ac69,PANT=0x2d3a4f,SHIRT=0xe67e22;
const ell=(g,r,sx,sy,sz,x,y,z,c)=>{const m=part(g,r*2,0,0,x,y,z,c,'s');m.scale.set(sx,sy,sz);return m};
const P=grp(-1.5,-2.4),HP=makeHuman({shirt:0xd97706,pants:0x2d3a4f,hair:0x2b1d14});P.add(HP.g);HP.meshes.forEach(m=>obstacles.push(m));
const cart=grp(2.85,-2.9);part(cart,.6,.1,.42,0,.18,0,0x3d4a5c);[[-.22,-.17],[.22,-.17],[-.22,.17],[.22,.17]].forEach(p=>{const caster=addCaster(cart,{x:p[0],z:p[1],radius:0.07,width:0.06,mountTop:0.15,rubber:new THREE.MeshStandardMaterial({color:0x171b20,roughness:.9}),metal:new THREE.MeshStandardMaterial({color:0x8e9aa3,metalness:.65,roughness:.35})});caster.traverse(o=>{if(o.isMesh)obstacles.push(o)})});part(cart,.04,.04,.4,-.28,.76,0,0x999999);part(cart,.4,.3,.3,0,.38,0,0xc9a26b);part(cart,.04,.5,.04,-.28,.5,0,0x999999);
const door=grp(1.15,0);const dm=part(door,.04,2.3,1,0,1.15,0,0x6fb3d2);dm.material.transparent=true;dm.material.opacity=.55;door.userData.o=0;
[P,cart].forEach(g=>g.traverse(m=>{m.userData.dyn=true}));
function tick(s){
 const c=(s*.5)%12.2;cart.position.z=c<6.1?-2.9+c:3.2-(c-6.1);
 const dd=Math.min(Math.hypot(robot.position.x-1,robot.position.z),humanOn?Math.hypot(hg.position.x-1,hg.position.z):99);door.userData.o+=((dd<2.4?1:0)-door.userData.o)*.05;door.position.z=door.userData.o*1.05;
}
const cbx=grp(-1,7.6);part(cbx,.35,.35,.35,0,.18,0,0xc9a26b);const sb=grp(1.6,5.2);part(sb,.3,.45,0,0,.22,0,0x5b6670,.2);     // crate

// path
const O=[[-3.2,0.7],[-1.5,0.1],[0.2,0],[1,0],[1.7,0.5],[2,1.3],[2,2.6],[2,4],[2,5.5],[2,6.9],[1.8,7.7],[1.2,8.1],[0.2,8.1],[-1.5,8.1],[-3,8],[-3.8,8.7],[-4,9.5],[-3.95,10.4],[-3.5,11],[-2.5,11.05],[-1.5,11.25],[-0.65,11],[0.2,10.65],[1.05,11],[1.9,11.25],[2.7,11.05],[3.3,10.8]];
const pts=O.concat([[3.45,11.05],[3.3,11.35]],O.slice(1,-1).reverse()).map(p=>new THREE.Vector3(p[0],0.03,p[1]));
let curve=new THREE.CatmullRomCurve3(pts,true,'centripetal');
const pathLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(900)),new THREE.LineBasicMaterial({color:0xe8590c}));
scene.add(pathLine);
pts.forEach(p=>{const s=new THREE.Mesh(new THREE.SphereGeometry(0.07),new THREE.MeshBasicMaterial({color:0xe8590c}));s.position.copy(p);pathLine.add(s)});

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
let th=0.9,ph=0.9,rad=24;const tgt=new THREE.Vector3(0,0,4);
function placeCam(){if(chase)return chaseCam();if(follow)tgt.lerp(FT.position,.1);cam.position.set(tgt.x+rad*Math.sin(ph)*Math.sin(th),tgt.y+rad*Math.cos(ph),tgt.z+rad*Math.sin(ph)*Math.cos(th));cam.lookAt(tgt)}
// Chase view: the camera stays behind the robot and turns with it; a wall between the robot and the camera pulls the camera in front of the wall
let chase=false,lookT=0,cpv=.85;const crc=new THREE.Raycaster(),cdir=new THREE.Vector3(),cgo=new THREE.Vector3();
function chaseCam(){const yaw=robot.rotation.y,want=Math.atan2(-Math.cos(yaw),Math.sin(yaw));
 if(performance.now()-lookT>2000){th+=Math.atan2(Math.sin(want-th),Math.cos(want-th))*.06;ph+=(.85-ph)*.05}   // after the user looks around, swing back behind the robot
 tgt.lerp(cgo.set(robot.position.x,robot.position.y+.3,robot.position.z),.25);
 // Full-volume clearance against the shared physics world is applied after camera placement.
 cpv=ph;cdir.set(Math.sin(cpv)*Math.sin(th),Math.cos(cpv),Math.sin(cpv)*Math.cos(th));cam.position.copy(tgt).addScaledVector(cdir,rad);cam.lookAt(tgt)}
let drag=false,lx=0,ly=0;
const cv=renderer.domElement;
cv.addEventListener('pointerdown',e=>{drag=true;lx=e.clientX;ly=e.clientY;cv.setPointerCapture(e.pointerId)});
cv.addEventListener('pointerup',()=>drag=false);
cv.addEventListener('pointermove',e=>{if(!drag)return;lookT=performance.now();th-=(e.clientX-lx)*0.006;ph=Math.min(1.55,Math.max(0.05,ph-(e.clientY-ly)*0.006));lx=e.clientX;ly=e.clientY});
cv.addEventListener('wheel',e=>{e.preventDefault();rad=Math.min(45,Math.max(chase?6:4,rad+e.deltaY*0.01))},{passive:false});

// buttons
const $=id=>document.getElementById(id);
let paused=false;
$('bPath').onclick=e=>{pathLine.visible=!pathLine.visible;e.target.classList.toggle('on')};
$('bLidar').onclick=e=>{lidar.visible=!lidar.visible;fov.visible=lidar.visible;e.target.classList.toggle('on')};
$('bPause').onclick=()=>{paused=!paused;$('bPause').classList.toggle('on',paused)};
$('bTop').onclick=()=>{ph=0.05;th=0;rad=26};
$('bIso').onclick=()=>{ph=0.9;th=0.9;rad=24};

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
 const ds=Math.hypot(dx,dy)*(Math.cos(Math.atan2(dy,dx)-yaw)>=0?1:-1);
 const v=TM.v*.3+(ds/dt)*.7,w=TM.w*.3+(dyaw/dt)*.7,a=(v-TM.v)/dt;TM.v=v;TM.w=w;
 const vl=v-w*TW/2,vr=v+w*TW/2,rpm=u=>u/(2*Math.PI*WR)*60;
 const pwm=u=>Math.abs(u)<.005?0:Math.round(Math.sign(u)*Math.min(255,35+220*Math.abs(u)/VMAX)),dir=u=>u>.005?'FWD':u<-.005?'REV':'STOP';
 const[eL,eR]=sideErr(),pl=pwm(vl/(1+eL)),pr=pwm(vr/(1+eR));   // the command each side needs for its real speed (wheel speed error)
 TM.eL+=Math.round(vl*dt/(2*Math.PI*WR)*TPR*(1+.004*gs()));TM.eR+=Math.round(vr*dt/(2*Math.PI*WR)*TPR*(1+.004*gs()));
 const vo=(vl*(1+.01*gs())+vr*(1+.01*gs()))/2,gz=w*180/Math.PI+.4+.25*gs();
 TM.oyaw+=((vr-vl)/TW+.002*gs())*dt;TM.ox+=vo*Math.cos(TM.oyaw)*dt;TM.oy+=vo*Math.sin(TM.oyaw)*dt;TM.iy+=gz*Math.PI/180*dt;TM.dist+=Math.abs(ds);
 const il=Math.max(0,.2+1.6*Math.abs(pl)/255+.5*Math.abs(a)+.03*gs()),ir=Math.max(0,.2+1.6*Math.abs(pr)/255+.5*Math.abs(a)+.03*gs());
 TM.E+=(il+ir)*12*dt/3600;const pct=Math.max(0,100-TM.E/44*100),bv=9.6+3*pct/100-.15*(il+ir);
 if(t<TM.pt-.5)TM.lap++;TM.pt=t;
 const px=P.position.x,py=-P.position.z,mode=manualOn?'MANUAL':paused?'PAUSED':fDyn?'OBSTACLE_STOP':Math.abs(w)>.3?'TURNING':spd<.05?'IDLE':'CRUISING';
 const r=(q,d=3)=>(+q).toFixed(d),ok=q=>q<1.999?1:0;
 return LAB.enrich(PX.enrich([new Date().toISOString(),r(s,2),TM.n++,OP,TM.lap,mode,r(x),r(y),r(yaw*180/Math.PI,2),r(v),r(w*180/Math.PI,2),r(a),r(vl),r(vr),r(rpm(vl),1),r(rpm(vr),1),pl,pr,r(Math.abs(pl)/2.55,1),r(Math.abs(pr)/2.55,1),dir(vl),dir(vr),TM.eL,TM.eR,r(TM.ox),r(TM.oy),r(TM.oyaw*180/Math.PI,2),r(TM.dist),r(a+.05*gs()),r(v*w+.05*gs()),r(gz,2),r(TM.iy*180/Math.PI,2),r(il),r(ir),r(bv,2),r(pct,1),nz(tof[0]),nz(tof[1]),nz(tof[2]),nz(tof[3]),ok(tof[0]),ok(tof[1]),ok(tof[2]),ok(tof[3]),r(Math.min(...tof)),fDyn?1:0,r(px),r(py),r(Math.hypot(px-x,py-y)),r(cart.position.x),r(-cart.position.z),r(door.userData.o*100,0),nm,CAP.w,CAP.h,...LT.row()],HDR),HDR,dt)}
function META(){const vf=70*Math.PI/180,fy=CAP.h/2/Math.tan(vf/2);return{...PX.metadata(),...LAB.metadata(),visuals:VIS.metadata(),speed_control:SPEED.metadata(),rover_tools:TOOLS.metadata(),operator:OP,created:new Date().toISOString(),sample_rate_hz:+(1/CAP.sp).toFixed(2),image_interval_s:CAP.img,language:{recorded:false,note:'Captions and event logs omitted from lean datasets'},units:'SI (m, s, deg, A, V); tof in metres, pwm 8-bit signed',columns:HDR,lighting:LT.meta(),people:PP.info(),curtains:CU.info(),
 environment:{name:'Apartment + S-corridor v1',size_m:'10x8 rooms + 1.4 m corridor, chicane, dock',dynamic:['person','trolley','automatic door'],coords:'x east, y north (gazebo-style), yaw 0 = +x'},
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
  const metadata=META(),csv=csvText(HDR,records),extras=[...await LAB.extras(),...await VIS.extras()],audit=Object.fromEntries([...names].filter(n=>LAB.audit[n]).map(n=>[n,LAB.audit[n]]));
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
function loop(now){
  frameProfiler.begin(now,!document.hidden);VIS.beginFrame?.(now);
  requestAnimationFrame(loop);
  const elapsed=Math.max(0,(now-last)/1000),dt=Math.min(elapsed,.05);last=now;PX.drive.droppedTime+=elapsed-dt;
  if(TOOLS.replayTick(now)){scene.updateMatrixWorld(true);VIS.updateDepth?.();frameProfiler.mark('Depth sampling');renderDisplayFrame({renderer,scene,camera:cam,robotCamera:rcam,robot,path:pathLine,lidar,fov,botView,width:innerWidth,height:innerHeight,matricesCurrent:true,cameraMode:VIS.cameraMode,primaryViewport:VIS.depthViewport?.(),preview:()=>VIS.previewViewport(),capture:()=>{}});frameProfiler.end(renderer);return;}

  LT.update(dt);PT.update();RL.update(dt);MV.update(dt);RT.update();TK.update(dt);PP.update(dt);CU.update(dt);tick(PX.drive.time);humanStep(dt);manualStep(dt);frameProfiler.mark('Actors and scene');
  spd+=((paused||fDyn||(!loopRoute&&t>=.999)?0:1)-spd)*Math.min(1,dt*3);
  if(!manualOn)PX.auto(dt,SPEED.target(dt,spd));
  frameProfiler.mark('Drive and contacts');
  CO.update(dt);VIS.update(elapsed);SPEED.update(dt,manualOn);PX.update(dt);frameProfiler.mark('Depth and controls');
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
  LAB.updateSensors(tof,PX.drive.time,tofReflectance);recTick(dt,PX.drive.time);placeCam();fpCam();if(!(humanOn&&fp))VIS.protectCamera(cam,tgt,dt,{occlusion:follow||chase});wallFade();frameProfiler.mark('Telemetry and UI');
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
$('bIso').onclick=()=>{follow=false;tgt.set(0,0,4);ph=.9;th=.9;rad=24};$('bTop').onclick=()=>{follow=false;tgt.set(0,0,4);ph=.05;th=0;rad=26};let botView=false;const botCam=on=>{botView=on;$('bCam').classList.toggle('on',on);document.body.classList.toggle('botview',on)};$('bCam').onclick=()=>botCam(!botView);
addEventListener('keydown',e=>{if(e.code==='KeyB'&&!/INPUT|SELECT/.test(document.activeElement.tagName))botCam(!botView)});
const chaseOn=on=>{chase=on;$('bChase').classList.toggle('on',on);if(on){follow=false;$('bFollow').classList.remove('on');rad=7.5;ph=cpv=.85;lookT=0}else rad=Math.max(rad,6)};
$('bChase').onclick=()=>chaseOn(!chase);['bIso','bTop','bFollow'].forEach(id=>$(id).addEventListener('click',()=>{if(chase)chaseOn(false)}));
addEventListener('keydown',e=>{if(e.code==='KeyG'&&!/INPUT|SELECT/.test(document.activeElement.tagName))chaseOn(!chase)});
// the view turns with the robot by default; starting Drive mode switches it on again
$('bDrive').addEventListener('click',()=>setTimeout(()=>{if(manualOn&&!chase)chaseOn(true)}));chaseOn(true);
$('bFollow').onclick=e=>{follow=!follow;e.target.classList.toggle('on',follow);if(follow){ph=.8;rad=6}};
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tabs button,.pane').forEach(x=>x.classList.remove('on'));b.classList.add('on');$('t-'+b.dataset.t).classList.add('on')});


// ===== editing features (original look kept): move/rotate/spawn objects + draw your own path =====
let loopRoute=true,drawMode=false,wps=[],curveLen=curve.getLength(),lastG=null;const curve0=curve,len0=curveLen,fixed=[P,cart,door,...FIXED0],spawned=[];
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
// path editor
const wpG=new THREE.Group(),wLine=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xfacc15}));wpG.add(wLine);scene.add(wpG);
function redrawWp(){wpG.children.slice(1).forEach(c=>wpG.remove(c));wps.forEach((p,i)=>{const s=new THREE.Mesh(new THREE.SphereGeometry(.09),new THREE.MeshBasicMaterial({color:i?0xfacc15:0x4ade80}));s.position.set(p.x,.1,p.z);wpG.add(s)});wLine.geometry.setFromPoints(wps.map(p=>new THREE.Vector3(p.x,.06,p.z)));$('wpN').textContent=wps.length}
function applyPath(){if(wps.length<2){toast('Add at least 2 waypoints');return}loopRoute=$('pLoop').checked;curve=new THREE.CatmullRomCurve3(wps.map(p=>new THREE.Vector3(p.x,.03,p.z)),loopRoute,'centripetal');curveLen=curve.getLength();pathLine.clear();pathLine.geometry.setFromPoints(curve.getPoints(Math.max(60,Math.round(curveLen*8))));t=0;toast('Path applied \u2013 '+curveLen.toFixed(1)+' m')}
$('bDraw').onclick=e=>{drawMode=!drawMode;e.target.classList.toggle('on',drawMode);toast(drawMode?'Click the floor to add waypoints (drag still orbits)':'Draw mode off')};
$('bUndo').onclick=()=>{wps.pop();redrawWp()};$('bFinish').onclick=applyPath;
$('bDefault').onclick=()=>{curve=curve0;curveLen=len0;loopRoute=true;pathLine.clear();pathLine.geometry.setFromPoints(curve.getPoints(900));t=0;toast('Default route restored')};
$('bSavePath').onclick=()=>{localStorage.setItem('rsw_path_'+OP,JSON.stringify(wps.map(p=>[p.x,p.z])));toast('Path saved')};
$('bLoadPath').onclick=()=>{const d=JSON.parse(localStorage.getItem('rsw_path_'+OP)||'[]');wps=d.map(a=>new THREE.Vector3(a[0],0,a[1]));redrawWp();toast(d.length?'Path loaded \u2013 press Apply path':'No saved path')};

// ================= extra realism: textures, decor, detailed people, robot =================
const dg=(x,z,r=0)=>{const g=grp(x,z,r);fixed.push(g);return g};
const zWood=cx(512,512,(x,s)=>{x.fillStyle='#bbb';x.fillRect(0,0,s,s);for(let i=0;i<120;i++){x.strokeStyle='hsl(0,0%,'+rr(55,88)+'%)';x.lineWidth=rr(.6,3);x.beginPath();const y=rr(0,s);x.moveTo(0,y);x.bezierCurveTo(s*.3,y+rr(-9,9),s*.7,y+rr(-9,9),s,y+rr(-6,6));x.stroke()}});
const zWeave=cx(128,128,(x,s)=>{x.fillStyle='#ccc';x.fillRect(0,0,s,s);x.strokeStyle='#888';for(let i=0;i<s;i+=3){x.beginPath();x.moveTo(i,0);x.lineTo(i,s);x.stroke();x.beginPath();x.moveTo(0,i);x.lineTo(s,i);x.stroke()}},[2,2]);
const zPlaster=cx(256,256,(x,s)=>{x.fillStyle='#999';x.fillRect(0,0,s,s);for(let i=0;i<7000;i++){const v=rr(110,190)|0;x.fillStyle='rgb('+v+','+v+','+v+')';x.fillRect(rr(0,s),rr(0,s),2,2)}},[4,4]);
const zPlank=cx(1024,1024,(x,s)=>{const n=14,h=s/n;for(let r=0;r<n;r++){let px=-rr(0,300);while(px<s){const w=rr(380,640);x.fillStyle='hsl('+rr(24,32)+','+rr(34,46)+'%,'+rr(27,36)+'%)';x.fillRect(px,r*h,w,h);for(let g=0;g<14;g++){x.strokeStyle='rgba(0,0,0,'+rr(.03,.12)+')';x.lineWidth=rr(.5,1.6);x.beginPath();const y=r*h+rr(2,h-2);x.moveTo(px,y);x.bezierCurveTo(px+w*.3,y+rr(-3,3),px+w*.6,y+rr(-3,3),px+w,y+rr(-2,2));x.stroke()}x.fillStyle='rgba(0,0,0,.45)';x.fillRect(px,r*h,1.5,h);px+=w}x.fillStyle='rgba(0,0,0,.4)';x.fillRect(0,r*h,s,1.5)}},[5,4]);
floor.material.map=zPlank;floor.material.roughness=.5;floor.material.needsUpdate=true;
rug.material.color.setHex(0xffffff);rug.material.roughness=.95;rug.material.map=cx(256,256,(x,s)=>{x.fillStyle='#8f3d4c';x.fillRect(0,0,s,s);x.strokeStyle='#e9d8b4';x.lineWidth=6;x.strokeRect(10,10,s-20,s-20);x.lineWidth=2;x.strokeRect(22,22,s-44,s-44);for(let i=0;i<5;i++)for(let j=0;j<3;j++){x.fillStyle=(i+j)%2?'#d9b26f':'#2f4b6e';x.beginPath();x.moveTo(40+i*35,60+j*55);x.lineTo(58+i*35,80+j*55);x.lineTo(40+i*35,100+j*55);x.lineTo(22+i*35,80+j*55);x.fill()}});rug.material.needsUpdate=true;
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
const WALLCOL=0xe9e4da,WALLCOL2=0xcdd6e0,BAND=null,WALLS=[],wm=obstacles.filter(m=>m.geometry.parameters&&m.geometry.parameters.height===2.5);
const bx0=Math.min(...wm.map(m=>m.position.x)),bx1=Math.max(...wm.map(m=>m.position.x)),bz0=Math.min(...wm.map(m=>m.position.z)),bz1=Math.max(...wm.map(m=>m.position.z));
wm.forEach(m=>{const p=m.geometry.parameters,ax=p.width>p.depth?'z':'x',v=m.position[ax],lo=ax=='z'?bz0:bx0,hi=ax=='z'?bz1:bx1;let out=null;if(Math.abs(v-lo)<.3)out=ax=='z'?[0,-1]:[-1,0];else if(Math.abs(v-hi)<.3)out=ax=='z'?[0,1]:[1,0];
 m.material.color.setHex(m.position.z>4.5?WALLCOL2:WALLCOL);m.material.roughness=.9;m.material.envMapIntensity=.08;
 const ex=[[.12,.06,0xf3f3f1],[.06,2.47,0xf3f3f1]];const bc=BAND||(m.position.z>4.5?0x8fa3b8:null);if(bc)ex.unshift([1,.5,bc]);
 const exm=ex.map(([h,y,c])=>{const b=new THREE.Mesh(new THREE.BoxGeometry(p.width+(h==1?.012:.03),h,p.depth+(h==1?.012:.03)),new THREE.MeshStandardMaterial({color:c,roughness:.6,transparent:true}));b.position.set(m.position.x,y,m.position.z);scene.add(b);return b});
 WALLS.push({m,ex:exm,out,o:.97})});
function wallFade(){const dx=cam.position.x-tgt.x,dz=cam.position.z-tgt.z,l=Math.hypot(dx,dz)||1,ux=dx/l,uz=dz/l,top=ph<.25||fpOn||botView;
 WALLS.forEach(w=>{const tg=chase?1:top?.9:w.out?(w.out[0]*ux+w.out[1]*uz>.2?.07:.97):.85;w.o+=(tg-w.o)*.15;[w.m,...w.ex].forEach(o=>{o.material.opacity=w.o;o.material.depthWrite=w.o>.9})})}
// door frame at the doorway
const zd=dg(1,0);part(zd,.26,2.2,.08,0,1.1,.54,0xf4f4f4);part(zd,.26,2.2,.08,0,1.1,-.54,0xf4f4f4);part(zd,.26,.1,1.16,0,2.15,0,0xf4f4f4);
const CURT=[];   // curtain panels [mesh, tie-back], opened / closed by curtains.js
function curt(g,s,col){const W=.55,H=1.95,N=44;
 const mk=xc=>{const geo=new THREE.PlaneGeometry(W,H,N,1),p=geo.attributes.position;for(let i=0;i<p.count;i++){let x=p.getX(i);const y=p.getY(i),f=1-.5*Math.exp(-Math.pow((y+H/2-.95)/.2,2));x*=f;p.setX(i,x);p.setZ(i,Math.sin(x/W*Math.PI*2*5)*(.035+.02*(1-(y+H/2)/H)))}
  geo.rotateY(Math.PI/2);geo.computeVertexNormals();const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:col,roughness:.95,side:THREE.DoubleSide}));m.material.envMapIntensity=.08;m.position.set(s*.1,1.3,xc);m.castShadow=true;g.add(m);return[m,part(g,.1,.05,.1,s*.1,1.275,xc,0xc9a227)]};
 CURT.push(mk(-.78),mk(.78));const sg=new THREE.PlaneGeometry(1.2,1.9);sg.rotateY(Math.PI/2);const sh=new THREE.Mesh(sg,new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,opacity:.2,side:THREE.DoubleSide,roughness:1,depthWrite:false}));sh.position.set(s*.04,1.4,0);g.add(sh);
 const r=part(g,.03,1.9,0,s*.12,2.3,0,0x333333,.015);r.rotation.x=Math.PI/2;[-.95,.95].forEach(z=>part(g,.07,0,0,s*.12,2.3,z,0x222222,'s'))}
// windows with curtains (glow = daylight)
function zWin(x,z,s){const g=dg(x,z);part(g,.08,.08,1.3,0,2.12,0,0xf2f2f2);part(g,.18,.06,1.4,s*.04,.9,0,0xf2f2f2);[-.62,.62].forEach(q=>part(g,.08,1.2,.08,0,1.5,q,0xf2f2f2));part(g,.05,1.2,.04,0,1.5,0,0xf2f2f2);part(g,.05,.04,1.2,0,1.5,0,0xf2f2f2);
 const gl=new THREE.Mesh(new THREE.PlaneGeometry(1.2,1.2),new THREE.MeshBasicMaterial({color:0x7e9fbd,transparent:true,opacity:.55,side:THREE.DoubleSide}));gl.rotation.y=Math.PI/2;gl.position.set(0,1.5,0);gl.userData.glass=true;g.add(gl);
 
 curt(g,s,0x5b7c8d)}
zWin(4.97,.6,-1);zWin(4.97,3.1,-1);zWin(-4.97,-2.4,1);zWin(-4.97,2.6,1);
// wall art
function zArt(x,w,h){const g=dg(x,-3.97);part(g,w+.08,h+.08,.04,0,1.5,0,0x2b2b2b);const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({roughness:.5,map:cx(256,256,(c,s)=>{const gr=c.createLinearGradient(0,0,s,s);gr.addColorStop(0,'hsl('+rr(0,360)+',55%,55%)');gr.addColorStop(1,'hsl('+rr(0,360)+',60%,35%)');c.fillStyle=gr;c.fillRect(0,0,s,s);for(let i=0;i<8;i++){c.fillStyle='hsla('+rr(0,360)+',70%,60%,.5)';c.beginPath();c.arc(rr(0,s),rr(0,s),rr(15,70),0,7);c.fill()}})}));m.position.set(0,1.5,.025);g.add(m)}
zArt(-3,.9,.6);zArt(-.8,.6,.8);zArt(1.8,.8,.55);
// TV screen
const zt=new THREE.Mesh(new THREE.PlaneGeometry(1.05,.58),new THREE.MeshBasicMaterial({color:0xb8b8b8,map:cx(256,128,(c,w,h)=>{const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'#1e3a8a');g.addColorStop(1,'#0ea5e9');c.fillStyle=g;c.fillRect(0,0,w,h);c.fillStyle='#fff8';c.fillRect(20,20,90,10);c.fillRect(20,40,140,6)})}));zt.rotation.y=Math.PI/2;zt.position.set(-4.62,1.37,0);scene.add(zt);
// lamps
const zl=dg(-2.1,3.6);part(zl,.28,.03,0,0,.015,0,0x222222,.14);part(zl,.03,1.5,0,0,.78,0,0x888888,.015);const zls=part(zl,.3,.28,0,0,1.6,0,0xf5e6c8,.2);zls.material.emissive.setHex(0x3a3018);
const zll=new THREE.PointLight(0xffe2b0,.35,5,2);zll.position.set(-2.1,1.5,3.6);scene.add(zll);
// table setting + fruit bowl
const zs=dg(0,0);[[-3.4,-1.75],[-2.6,-1.75],[-3.4,-2.25],[-2.6,-2.25]].forEach(([x,z])=>{part(zs,.26,.015,0,x,.79,z,0xffffff,.13);part(zs,.07,.09,0,x+.15,.83,z,0x3b82f6,.05)});
part(zs,.3,.1,0,-3,.82,-2,0xe5e7eb,.1);[[0xdc2626,-.05,0],[0xfacc15,.05,.04],[0x65a30d,0,-.06]].forEach(([c,x,z])=>part(zs,.09,0,0,-3+x,.89,-2+z,c,'s'));
// desk setup + seated person
const zk=dg(0,0);part(zk,.34,.02,.22,4.35,.775,2.9,0x222222);part(zk,.01,.2,.3,4.19,.88,2.9,0x222222);part(zk,.14,.012,.4,4.2,.77,3.35,0x333333);part(zk,.07,.09,0,4.3,.82,3.7,0xdc2626,.05);
const zp=dg(3.55,3.1),HD=makeHuman({shirt:0x3b6ea5,pants:0x2d3a4f,hair:0x2b1d14,longSleeve:true});HD.sit(.54);zp.add(HD.g);HD.meshes.forEach(m=>obstacles.push(m));
// kitchen counter, sink, hob, wall cabinets
const zc=dg(0,0);part(zc,.66,.84,1.8,4.65,.42,-2,0xf1f1f1);part(zc,.72,.05,1.86,4.65,.865,-2,0x2b2f36);part(zc,.4,.02,.5,4.65,.895,-2.4,0x9aa3ad);part(zc,.03,.25,0,4.85,1.02,-2.4,0xc0c0c0,.015);part(zc,.15,.03,.03,4.78,1.14,-2.4,0xc0c0c0);
[[4.55,-1.5],[4.8,-1.5],[4.55,-1.2],[4.8,-1.2]].forEach(([x,z])=>part(zc,.2,.012,0,x,.895,z,0x1a1a1a,.1));[-1.6,-2,-2.4].forEach(z=>part(zc,.01,.7,.02,4.31,.42,z,0x999999));part(zc,.35,.7,1.8,4.82,1.75,-2,0xe5e7eb);
// Driven robot geometry is created by robot-model.js in calibrated SI units.


// ===== corridor upgrade: light panels, doors, art, sconces, runners, extinguisher, sign =====
[[2,5.5],[2,7.4],[-.5,8],[-3,8],[-4,9.6],[-4,11],[-1.5,11],[1.5,11]].forEach(([x,z])=>{const f=new THREE.Mesh(new THREE.BoxGeometry(.5,.04,.2),new THREE.MeshBasicMaterial({color:0xcfc8b4}));f.position.set(x,2.46,z);f.userData.fixture=true;scene.add(f)});
const rugMat=new THREE.MeshStandardMaterial({roughness:.95,map:cx(256,64,(c,w,h)=>{c.fillStyle='#7a2f3a';c.fillRect(0,0,w,h);c.fillStyle='#d9b26f';c.fillRect(0,6,w,4);c.fillRect(0,h-10,w,4);for(let i=0;i<8;i++){c.fillStyle='#2f4b6e';c.fillRect(14+i*30,22,18,20)}})});
[[4.6,.8,-1.2,8],[.8,3.4,2,5.7],[.8,2.4,-4,10.1]].forEach(([w,d,x,z])=>{const r=new THREE.Mesh(new THREE.PlaneGeometry(w,d),rugMat);r.rotation.x=-Math.PI/2;r.position.set(x,.014,z);r.receiveShadow=true;scene.add(r)});
function door2(x,z,ry){const g=dg(x,z,ry);part(g,.05,2.05,.9,0,1.025,0,0x8b5a2b);[.55,1.5].forEach(y=>part(g,.02,y==.55?.7:.6,.3,.03,y+.1,0,0x7a4d24));[-.2,.2].forEach(q=>part(g,.02,.7,.3,.03,.65,q,0x7a4d24));part(g,.12,.03,.03,.06,1.0,.35,0xc0c0c0);part(g,.02,.08,.12,.03,1.75,0,0xc9a227);part(g,.08,2.1,.06,0,1.05,.48,0xf4f4f4);part(g,.08,2.1,.06,0,1.05,-.48,0xf4f4f4);part(g,.08,.06,1,0,2.1,0,0xf4f4f4)}
[[1.4,5,0],[2.6,6.2,Math.PI],[-2.6,7.4,-Math.PI/2],[.2,7.4,-Math.PI/2],[-4.6,10,0],[-2.5,11.6,Math.PI/2]].forEach(a=>door2(...a));
function art2(x,y,z,ry,w,h){const g=dg(x,z,ry);part(g,.04,h+.08,w+.08,0,y,0,0x2b2b2b);const pg=new THREE.PlaneGeometry(w,h);pg.rotateY(Math.PI/2);const pm2=new THREE.Mesh(pg,new THREE.MeshStandardMaterial({roughness:.5,map:cx(256,256,(c,s)=>{const gr=c.createLinearGradient(0,0,s,s);gr.addColorStop(0,'hsl('+rr(0,360)+',55%,55%)');gr.addColorStop(1,'hsl('+rr(0,360)+',60%,35%)');c.fillStyle=gr;c.fillRect(0,0,s,s);for(let i=0;i<8;i++){c.fillStyle='hsla('+rr(0,360)+',70%,60%,.5)';c.beginPath();c.arc(rr(0,s),rr(0,s),rr(15,70),0,7);c.fill()}})}));pm2.position.set(.025,y,0);g.add(pm2)}
[[2.6,1.5,4.9,Math.PI,.5,.7],[1.4,1.5,6.5,0,.6,.45],[-1.2,1.5,7.4,-Math.PI/2,.7,.5],[-3.4,1.5,9.5,Math.PI,.5,.6],[.6,1.5,11.6,Math.PI/2,.8,.5],[2.8,1.5,11.6,Math.PI/2,.6,.5]].forEach(a=>art2(...a));
function sconce(x,z,ry){const g=dg(x,z,ry);part(g,.03,.16,.08,0,1.7,0,0x8b95a1);part(g,.08,.1,0,.06,1.75,0,0xf5e6c8,.05).material.emissive.setHex(0x3a3018)}
[[1.4,5.8,0],[2.6,7,Math.PI],[-1.8,7.4,-Math.PI/2],[-4.6,10.8,0],[0,11.6,Math.PI/2],[3,11.6,Math.PI/2]].forEach(a=>sconce(...a));
const fe=dg(1.4,6.9);part(fe,.03,.3,.1,0,1.1,0,0x555555);part(fe,.12,.4,0,.08,1.2,0,0xdc2626,.06);part(fe,.04,.08,0,.08,1.45,0,0x222222,.03);
const dsg=new THREE.PlaneGeometry(1.3,.3);dsg.rotateY(-Math.PI/2);const dsn=new THREE.Mesh(dsg,new THREE.MeshBasicMaterial({color:0xb8b8b8,map:cx(512,120,(c,w,h)=>{c.fillStyle='#14532d';c.fillRect(0,0,w,h);c.fillStyle='#fff';c.font='bold 54px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('CHARGING DOCK',w/2,h/2)})}));dsn.position.set(3.92,1.9,11.05);scene.add(dsn);

// ===== controllable human (WASD) + contact shadows =====
const HSPAWN=[-1.2,2.2],HU=makeHuman({shirt:0x0ea5e9,pants:0x1f2937,hair:0x3b2a1e}),hg=new THREE.Group();hg.add(HU.g);hg.visible=false;hg.position.y=-100;scene.add(hg);   // parked below the floor while hidden, so sensors ignore it
HU.meshes.forEach(m=>{m.userData.dyn=true;obstacles.push(m)});
let humanOn=false,fp=false,fpOn=false,carried=null,hry=0,hph=0,FT=robot;const keys={},hset=new Set(HU.meshes),rc3=new THREE.Raycaster(),SHC=[0x0ea5e9,0xdc2626,0x16a34a,0xf59e0b,0x9333ea,0xe5e7eb];let shi=0;
const humanNav=new HumanNavigation(obstacles,scene),humanController=new HumanController({object:hg,rig:HU,navigation:humanNav,seats:()=>sceneSeats(scene),others:()=>[robot,...scene.children.filter(o=>o.userData.human)],onStatus:text=>toast(text)});
window.addEventListener('keydown',e=>{if(e.code!=='KeyF'||e.repeat||!humanOn||/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))return;if(carried){toast('Put down the carried object before sitting.');return}if(humanController.seat){humanController.stand();return}const nearest=sceneSeats(scene).filter(s=>!s.occupied&&s.approach.distanceTo(hg.position)<2).sort((a,b)=>a.approach.distanceTo(hg.position)-b.approach.distanceTo(hg.position))[0];if(nearest)humanController.sit(nearest.id);else toast('Move within 2 m of the front of an available seat, then press F.');});
function blocked(dx,dz){if(!humanNav.segment(hg.position,hg.position.clone().add(new THREE.Vector3(dx,0,dz))))return true;const l=Math.hypot(dx,dz);if(!l)return false;if(Math.hypot(hg.position.x+dx-robot.position.x,hg.position.z+dz-robot.position.z)<.5)return true;scene.updateMatrixWorld();const d=new THREE.Vector3(dx/l,0,dz/l);
 for(const y of[.25,.9,1.5]){rc3.set(new THREE.Vector3(hg.position.x,y,hg.position.z),d);rc3.far=rover.radius()+l;if(rc3.intersectObjects(obstacles,false).some(i=>!hset.has(i.object)&&!(carried&&i.object.parent===carried)))return true}return false}
function humanStep(dt){if(!humanOn)return;humanNav.update(dt);if(humanController.seat||humanController.state==='walking'){humanController.step(dt);hry=humanController.yaw;return}const run=keys.ShiftLeft||keys.ShiftRight,sp=run?3.2:1.5,fx_=-Math.sin(th),fz_=-Math.cos(th);let mx=0,mz=0;
 if(keys.KeyW||(keys.ArrowUp&&!manualOn)){mx+=fx_;mz+=fz_}if(keys.KeyS||(keys.ArrowDown&&!manualOn)){mx-=fx_;mz-=fz_}if(keys.KeyD||(keys.ArrowRight&&!manualOn)){mx-=fz_;mz+=fx_}if(keys.KeyA||(keys.ArrowLeft&&!manualOn)){mx+=fz_;mz-=fx_}
 const l=Math.hypot(mx,mz),before=hg.position.clone();
 if(l>0){mx/=l;mz/=l;const st=sp*dt;if(!blocked(mx*st,0))hg.position.x+=mx*st;if(!blocked(0,mz*st))hg.position.z+=mz*st;const ty=Math.atan2(-mz,mx);hry+=Math.atan2(Math.sin(ty-hry),Math.cos(ty-hry))*Math.min(1,dt*10);hph+=dt*sp*5.5}
 if(fp)hry=Math.atan2(Math.cos(th),-Math.sin(th));hg.rotation.y=hry;const moved=hg.position.distanceTo(before);if(HU.animate)HU.animate({dt,distance:moved,speed:dt?moved/dt:0});else HU.pose(hph,moved?1:0);humanController.yaw=hry;
 if(carried){carried.position.set(hg.position.x+Math.cos(hry)*.75,.35,hg.position.z-Math.sin(hry)*.75);carried.rotation.y=hry}}
function fpCam(){if(!(humanOn&&fp))return;const p=1.1-ph,y=1.64;cam.position.set(hg.position.x+Math.cos(hry)*.1,y,hg.position.z-Math.sin(hry)*.1);cam.lookAt(cam.position.x-Math.sin(th)*Math.cos(p),y+Math.sin(p),cam.position.z-Math.cos(th)*Math.cos(p))}
function grab(){if(carried){carried.position.y=0;carried=null;toast('Dropped');return}let best=null,bd=1.6;movable().forEach(g=>{const d=Math.hypot(g.position.x-hg.position.x,g.position.z-hg.position.z);if(d<bd){bd=d;best=g}});
 if(!best)return toast('Nothing close enough to pick up');const s=new THREE.Box3().setFromObject(best).getSize(new THREE.Vector3());if(Math.max(s.x,s.z)>1.3)return toast('Too heavy to carry');carried=best;toast('Carrying \u2013 press E to drop')}
window.addEventListener('keydown',e=>{if(/INPUT|SELECT/.test(document.activeElement.tagName))return;keys[e.code]=true;if(e.code=='KeyH')return $('bHuman').click();if(e.code=='KeyM')return $('bDrive').click();if(manualOn&&e.code.startsWith('Arrow'))e.preventDefault();if(!humanOn)return;if(e.code.startsWith('Arrow'))e.preventDefault();
 if(e.code=='KeyE')grab();if(e.code=='KeyV'){fp=!fp;fpOn=fp;hg.visible=!fp;ph=fp?1.1:1.0}if(e.code=='KeyC'){shi=(shi+1)%SHC.length;HU.mats.sh.color.setHex(SHC[shi])}});
window.addEventListener('keyup',e=>{keys[e.code]=false});
$('bHuman').onclick=e=>{humanOn=!humanOn;$('bHuman').classList.toggle('on',humanOn);hg.visible=humanOn&&!fp;
 if(humanOn){hg.position.set(HSPAWN[0],0,HSPAWN[1]);follow=true;FT=hg;rad=5;ph=1.0;toast('F sit/stand \u00b7 WASD move \u00b7 Shift run \u00b7 E pick up/drop \u00b7 V first-person \u00b7 C shirt \u00b7 drag = look')}
 else{humanController.dispose();humanController.state='idle';HU.stand?.();hg.position.y=-100;follow=false;FT=robot;fp=false;fpOn=false;carried=null}};
// soft contact shadows under every furniture group
const blobTex=cx(128,128,(c,s)=>{const g=c.createRadialGradient(64,64,4,64,64,64);g.addColorStop(0,'rgba(0,0,0,.5)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,s,s)});
MOV.slice().forEach(g=>{let dyn=false;g.traverse(o=>{if(o.userData&&o.userData.dyn&&!o.userData.pick)dyn=true});if(dyn||fixed.includes(g)&&g.children.length>40)return;const r=g.rotation.y;g.rotation.y=0;g.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(g);g.rotation.y=r;g.updateMatrixWorld(true);
 if(b.min.y>.25)return;const s=b.getSize(new THREE.Vector3());if(!isFinite(s.x)||s.y>2.3||s.x>6||s.z>6||s.x<.05)return;const c=b.getCenter(new THREE.Vector3());
 const m=new THREE.Mesh(new THREE.PlaneGeometry(s.x*1.35+.15,s.z*1.35+.15),new THREE.MeshBasicMaterial({map:blobTex,transparent:true,depthWrite:false,opacity:.75}));m.rotation.x=-Math.PI/2;m.position.set(c.x-g.position.x,.007,c.z-g.position.z);m.renderOrder=1;m.rotation.z=-r;m.userData={contactShadow:true,noContact:true,noDepth:true,editorAuxiliary:true};g.add(m)});

// ===== manual robot driving (arrow keys) =====
let manualOn=false,vcur=0,wcur=0;
function robBlocked(dx,dz){const l=Math.hypot(dx,dz);if(!l)return false;scene.updateMatrixWorld();const d=new THREE.Vector3(dx/l,0,dz/l),lat=new THREE.Vector3(-d.z,0,d.x);
 for(const off of[0,-TW/2,TW/2])for(const y of[WR,WR+.06]){rc3.set(new THREE.Vector3(robot.position.x,robot.position.y+y,robot.position.z).addScaledVector(lat,off),d);rc3.far=rover.radius()+l;if(rc3.intersectObjects(obstacles,false).some(i=>!(carried&&i.object.parent===carried)&&!i.object.userData.pick))return true}return false}
function manualStep(dt){if(!manualOn)return;const boost=(keys.ShiftLeft||keys.ShiftRight)?1.6:1,vt=(keys.ArrowUp?1:0)*VMAX*boost-(keys.ArrowDown?1:0)*VMAX*.7,wt=((keys.ArrowLeft?1:0)-(keys.ArrowRight?1:0))*1.8;
 PX.manual(dt,vt,wt);vcur=PX.drive.v;wcur=PX.drive.w;}
function resumePath(){let bi=0,bd=1e9;curve.getSpacedPoints(600).forEach((q,i)=>{const d=(q.x-robot.position.x)**2+(q.z-robot.position.z)**2;if(d<bd){bd=d;bi=i}});t=bi/600}
$('bDrive').onclick=()=>{manualOn=!manualOn;$('bDrive').classList.toggle('on',manualOn);vcur=wcur=0;
 if(manualOn){if(!humanOn){follow=true;FT=robot;rad=6;ph=.9}toast('Arrow keys: \u2191 forward \u00b7 \u2193 reverse \u00b7 \u2190 \u2192 turn \u00b7 Shift boost \u00b7 press Drive again to resume the path')}else{resumePath();if(!humanOn)follow=false}};

// ===== language annotations: captions, Q&A, action labels and event comments (ground truth from the simulator) =====
const ENVNAME='apartment',ZONES=[['charging dock',[2.8,4.1,10.3,11.8]],['chicane',[-1.8,2.4,10.3,11.8]],['S-corridor',[-5,4.1,4.05,11.9]],['living room',[-5,1,-4,4.05]],['right room',[1,5,-4,4.05]]];
let anns=[],evts=[],lastImg='',fHitObj=null;
const zoneAt=(x,z)=>{for(const[n,r]of ZONES)if(x>=r[0]&&x<=r[1]&&z>=r[2]&&z<=r[3])return n;return ENVNAME};
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
 bulbs:[{name:'dining table',x:-3,z:-2,y:1.85},{name:'living room',x:-3,z:1.8},{name:'right room',x:3,z:0},{name:'kitchen',x:3.9,z:-2},{name:'floor lamp',x:-2.1,z:3.6,light:zll,shade:zls},
  {name:'corridor 1',x:2,z:6},{name:'corridor 2',x:-1,z:8},{name:'corridor 3',x:-4,z:10},{name:'corridor 4',x:0,z:11}]});
const PT=initPaint({scene,renderer,cam,toast});
const RL=initRoll({obstacles,cam,toast,robot,target:Object.assign(()=>lastG,{all:movable}),human:()=>humanOn?hg:null});
const RT=initRotate({scene,cam,target:()=>lastG});
const MV=initMove({scene,cam,renderer,obstacles,target:()=>lastG,movable});
const NR=initNarrate({scene,robot,path:()=>({curve,t,len:curveLen,loop:loopRoute}),zone:zoneAt,blocker:()=>fHitObj?nameOf(fHitObj):null,manual:()=>manualOn,log:(ty,x)=>recOn&&ev(ty,x)});
const TK=initTask({scene,cam,renderer,obstacles,robot,zone:zoneAt,progress:()=>t,say:NR.say,log:(ty,x)=>recOn&&ev(ty,x),
 setRoute:pts=>{if(manualOn)$('bDrive').click();curve=new THREE.CatmullRomCurve3(pts,false,'centripetal');curveLen=curve.getLength();loopRoute=false;pathLine.clear();pathLine.geometry.setFromPoints(curve.getPoints(Math.max(60,Math.round(curveLen*8))));t=0;TM.init=false;curve.getPointAt(0,p);robot.position.set(p.x,0,p.z)}});
// walking people: route / random / walk to / stand, speed and position set in Build → People
const PP=initPeople({scene,cam,renderer,obstacles,plan:TK.plan,randomPoint:TK.randomPoint,robot,human:()=>humanOn?hg:null,say:NR.say,walkers:[{g:P,H:HP,name:'Walking person',a:[-1.5,-2.4],b:[-1.5,3.3],v:.6}]});
HP.g.userData.label='person';HD.g.userData.label='seated person at desk';[[tb,'dining table'],[sf,'sofa'],[ct,'coffee table'],[sh,'bookshelf'],[cb,'cardboard box'],[bn,'dustbin'],[b2,'small bin'],[pl,'potted plant'],[tv,'TV unit'],[dk,'desk'],[cr,'wooden crate'],[cbx,'small box'],[sb,'bin'],[cart,'trolley'],[door,'sliding glass door'],[zl,'floor lamp'],[zd,'door frame']].forEach(([g,l])=>{g.userData.label=l});
// robot ↔ object collisions (momentum): light objects are pushed, heavy ones push the robot back
let kb=0;const CO=initCollide({robot,movable,obstacles,roll:RL,radius:rover.radius,top:()=>robot.position.y+rover.bodyHeight(),say:NR.say,log:(ty,x)=>recOn&&ev(ty,x),bump:(dv,heavy)=>{PX.impulse(dv);if(heavy&&!manualOn)spd*=.3}});
// curtains: Lights tab / dock button / click a curtain; closed curtains keep daylight out
const CU=initCurtains({panels:CURT,cam,renderer,envKey:ENVNAME,setShade:LT.setShade,say:NR.say,log:(ty,x)=>recOn&&ev(ty,x)});
// Build → Weights (kg): robot + every movable object (after all labels are set, so the saved names are right)
initWeights({envKey:ENVNAME,movable,select:g=>{lastG=g},spawned:()=>spawned,toast});
initWheelErr({toast});   // Settings → Wheel speed error

// Shared fixed-step dynamics and calibration UI. Events run after module initialization.
const PX=initResearch({rover,scene,env:ENVNAME,blocked:robBlocked,zone:zoneAt,pathState:()=>({curve,t,len:curveLen,loop:loopRoute}),setProgress:value=>t=value,isPaused:()=>paused,toast,canCalibrate:()=>!recOn,
 parametersChanged:parameters=>{TW=parameters.track;WR=parameters.radius;VMAX=parameters.rpm*Math.PI/30*WR;}});

const LAB=initLab({PX,rover,scene,env:ENVNAME,CAP,LT,PP,CU,recording:()=>recOn,getRows:()=>rows,getImages:()=>imgs,pathState:()=>({curve,t,len:curveLen,loop:loopRoute}),obstacles,movable,spawn,setSensorRange:range=>RANGE=range,
 restorePath:route=>{if(!Array.isArray(route.points)||route.points.length<2||route.points.length>1000||route.points.some(p=>!Array.isArray(p)||p.length!==3||p.some(v=>!Number.isFinite(v)||Math.abs(v)>100)))throw Error('Invalid saved route');curve=new THREE.CatmullRomCurve3(route.points.map(p=>new THREE.Vector3().fromArray(p)),false,'centripetal');curveLen=curve.getLength();loopRoute=!!route.loop;t=0;pathLine.geometry.setFromPoints(curve.getPoints(Math.max(60,Math.round(curveLen*8))));}});
const VIS=initVisualStudio({renderer,scene,cam,sun,rover,obstacles,walls:WALLS,floor,grid,env:ENVNAME,PX,recording:()=>recOn,toast,contactObjects:movable,onCollision:event=>{if(recOn)ev('collision','Contact with '+event.object+'; impulse '+event.net_robot_impulse_Ns.toFixed(3)+' N·s; forward speed '+event.forward_speed_after_mps.toFixed(3)+' m/s.')},layoutObjects:()=>MOV.filter(g=>g.parent===scene&&![P,cart,door].includes(g)&&!(()=>{let human=false;g.traverse(o=>{if(o.userData.human)human=true});return human})())});
const SPEED=initSpeedControl({env:ENVNAME,PX,CAP,robot,zone:zoneAt,log:(kind,message)=>{if(recOn)ev(kind,message)}});
const TOOLS=initRoverTools({renderer,scene,camera:cam,rover,PX,LAB,VIS,env:ENVNAME,recording:()=>recOn,isPaused:()=>paused,setPaused:on=>{paused=on;$('bPause').classList.toggle('on',on)},notify:toast});
initStudioLayout();
$('bRec').disabled=true;VIS.ready.then(()=>{$('bRec').disabled=false;last=performance.now();requestAnimationFrame(loop)}).catch(error=>{$('rst').textContent='Visual startup failed: '+error.message;console.error(error)});
