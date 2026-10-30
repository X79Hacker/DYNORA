import {addCaster} from './caster-model.js';
import {EXTRA_CATALOG,buildExtraFurniture} from './room-models.js';
import * as THREE from 'three';
import {decorateRover} from './robot-profile-visual.js';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {BufferGeometryUtils} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Original, dimensioned meshes authored for DYNORA. No external calls or random geometry.
export const MODEL_CATALOG=[
 {id:'dining-chair',name:'Moulded dining chair',dimensions:[.45,.92,.48],material:'fabric',mass:5},
 {id:'office-chair',name:'Ergonomic office chair',dimensions:[.61,1.13,.61],material:'fabric',mass:10},
 {id:'sofa',name:'Upholstered two-seat sofa',dimensions:[2.08,.96,.9],material:'fabric',mass:45},
 {id:'coffee-table',name:'Oak coffee table',dimensions:[1,.43,.55],material:'wood',mass:15},
 {id:'sideboard',name:'Oak storage cabinet',dimensions:[1.2,.84,.42],material:'wood',mass:28},
 {id:'plant',name:'Ceramic planter with leaves',dimensions:[.55,1.05,.55],material:'ceramic',mass:6},
 {id:'delivery-cart',name:'Stainless service trolley',dimensions:[.65,.86,.46],material:'metal',mass:12},
 {id:'crate',name:'Slatted timber crate',dimensions:[.5,.46,.4],material:'wood',mass:4},
 ...EXTRA_CATALOG,
];
const geoCache=new Map();
function geo(key,build){if(!geoCache.has(key))geoCache.set(key,build());return geoCache.get(key)}
export function material(color=0xffffff,roughness=.55,metalness=0,role='paint'){const m=new THREE.MeshStandardMaterial({color,roughness,metalness});m.userData.surface=role;return m}
function builder(root){const mats=new Map();
 const mat=(c,r=.55,m=0,role='paint')=>{const key=[c,r,m,role].join('|');if(!mats.has(key))mats.set(key,material(c,r,m,role));return mats.get(key)};
 const add=(geometry,material,x=0,y=0,z=0,parent=root)=>{const o=new THREE.Mesh(geometry,material);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o};
 const box=(w,h,d,m,x=0,y=0,z=0,r=.012,parent=root)=>add(geo(['box',w,h,d,r].join(','),()=>new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3))),m,x,y,z,parent);
 const cylinder=(a,b,h,m,x=0,y=0,z=0,parent=root,n=20)=>add(geo(['cyl',a,b,h,n].join(','),()=>new THREE.CylinderGeometry(a,b,h,n)),m,x,y,z,parent);
 const tube=(points,r,m,parent=root)=>add(geo(['tube',r,JSON.stringify(points)].join('|'),()=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),Math.max(8,points.length*5),r,8,false)),m,0,0,0,parent);
 return{mat,add,box,cylinder,tube};
}
export function batchModel(root,exclude=new Set()){root.updateWorldMatrix(true,true);const inverse=new THREE.Matrix4().copy(root.matrixWorld).invert();const byMaterial=new Map(),remove=[];root.traverse(o=>{if(!o.isMesh||o.isInstancedMesh)return;for(let n=o;n&&n!==root;n=n.parent)if(exclude.has(n))return;let g=o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));if(g.index){const indexed=g;g=g.toNonIndexed();indexed.dispose()}if(!byMaterial.has(o.material))byMaterial.set(o.material,[]);byMaterial.get(o.material).push(g);remove.push(o)});remove.forEach(o=>o.parent.remove(o));for(const[m,geometries]of byMaterial){const merged=BufferGeometryUtils.mergeBufferGeometries(geometries,false);geometries.forEach(g=>g.dispose());const o=new THREE.Mesh(merged,m);o.castShadow=o.receiveShadow=true;root.add(o)}return root}
export function createFurniture(id,{batchMeshes=true}={}){
 const root=new THREE.Group(),b=builder(root),steel=b.mat(0x9aa6af,.27,.82,'metal'),black=b.mat(0x202830,.52,.3,'paint'),rubber=b.mat(0x171b20,.92,0,'rubber'),oak=b.mat(0xb99a70,.56,0,'wood'),fabric=b.mat(0x547081,.92,0,'fabric'),ivory=b.mat(0xcfc9ba,.75,0,'fabric');
 if(id==='dining-chair'){
  b.box(.435,.055,.42,fabric,0,.445,.01,.025);const back=b.box(.42,.34,.045,fabric,0,.7,-.19,.035);back.rotation.x=-.13;
  for(const x of[-.17,.17])for(const z of[-.16,.17]){b.tube([[x*1.1,.025,z*1.12],[x,.22,z],[x,.44,z*.9]],.013,steel);b.cylinder(.018,.018,.024,rubber,x*1.1,.012,z*1.12)}
  for(const x of[-.17,.17])b.tube([[x,.4,-.15],[x,.6,-.19],[x,.87,-.23]],.011,steel);
  for(const x of[-.14,.14])b.box(.01,.005,.23,black,x,.415,.015,.002);
 }else if(id==='office-chair'){
  for(let k=0;k<5;k++){const a=k*Math.PI*2/5,x=Math.sin(a)*.24,z=Math.cos(a)*.24;b.tube([[0,.16,0],[x*.5,.12,z*.5],[x,.08,z]],.018,black);addCaster(root,{x,z,radius:.025,width:.045,mountTop:.083,yaw:a,dual:true,rubber,metal:steel,frame:black});}
  b.cylinder(.025,.03,.29,steel,0,.29,0);b.box(.48,.075,.45,fabric,0,.47,.015,.035);const back=b.box(.43,.48,.055,fabric,0,.8,-.205,.035);back.rotation.x=-.15;
  b.tube([[0,.43,-.14],[0,.57,-.22],[0,.81,-.27]],.025,black);
  for(const x of[-.27,.27]){b.tube([[x*.8,.46,-.12],[x,.61,-.1],[x,.66,.08]],.012,black);b.box(.045,.025,.25,black,x,.66,.015,.015)}
  b.box(.23,.11,.06,fabric,0,1.07,-.25,.03);
 }else if(id==='sofa'){
  for(const x of[-.87,.87])for(const z of[-.3,.3])b.cylinder(.023,.016,.13,oak,x,.065,z);
  b.box(1.96,.24,.85,fabric,0,.23,0,.055);b.box(1.92,.48,.16,fabric,0,.6,-.33,.055);
  for(const x of[-.47,.47]){b.box(.9,.16,.68,ivory,x,.425,.015,.045);const cushion=b.box(.87,.4,.14,fabric,x,.66,-.245,.055);cushion.rotation.x=-.1;}
  for(const x of[-.97,.97])b.box(.14,.49,.86,fabric,x,.45,0,.045);
  for(const[x,c]of[[-.68,0xb58e59],[.67,0x9a6658]]){const pillow=b.box(.3,.3,.11,b.mat(c,.95,0,'fabric'),x,.65,-.14,.07);pillow.rotation.z=x>0?-.17:.17;}
  for(const x of[-.47,.47])b.tube([[x-.41,.475,.33],[x,.48,.35],[x+.41,.475,.33]],.0025,ivory);
 }else if(id==='coffee-table'){
  b.box(1,.035,.55,oak,0,.405,0,.018);b.box(.83,.025,.4,oak,0,.13,0,.008);
  for(const x of[-.41,.41])for(const z of[-.185,.185])b.tube([[x*1.08,.01,z*1.08],[x,.2,z],[x*.94,.39,z*.94]],.018,black);
 }else if(id==='sideboard'){
  b.box(1.2,.035,.42,oak,0,.82,0,.012);b.box(1.16,.55,.38,oak,0,.515,0,.012);
  for(const x of[-.385,0,.385]){b.box(.37,.53,.025,oak,x,.515,.207,.006);b.box(.14,.008,.018,black,x,.73,.226,.004)}
  for(const x of[-.5,.5])for(const z of[-.14,.14])b.cylinder(.02,.015,.24,black,x,.12,z);
 }else if(id==='plant'){
  const ceramic=b.mat(0xc2b49c,.38,0,'ceramic'),soil=b.mat(0x31241a,1,0,'soil');b.add(geo('pot-lathe',()=>new THREE.LatheGeometry([[.12,0],[.13,.015],[.17,.27],[.175,.3],[.16,.305],[.155,.28]].map(p=>new THREE.Vector2(...p)),32)),ceramic,0,.01,0);b.cylinder(.153,.153,.012,soil,0,.286,0);
  const leaf=new THREE.BufferGeometry(),pos=[],uv=[],indices=[];for(let j=0;j<=12;j++){const t=j/12,w=Math.sin(Math.PI*t)*.055;for(const s of[-1,1]){pos.push(s*w,t*.26,Math.sin(t*Math.PI)*.025);uv.push((s+1)/2,t)}if(j<12){const k=j*2;indices.push(k,k+1,k+2,k+1,k+3,k+2)}}leaf.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));leaf.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));leaf.setIndex(indices);leaf.computeVertexNormals();
  const green=b.mat(0x47764e,.8,0,'leaf');green.side=THREE.DoubleSide;for(let k=0;k<14;k++){const a=k*2.399963,h=.4+(k%5)*.1,reach=.12+(k%3)*.025;b.tube([[0,.28,0],[Math.cos(a)*reach*.45,h-.04,Math.sin(a)*reach*.45],[Math.cos(a)*reach,h,Math.sin(a)*reach]],.0035,b.mat(0x4a6542,.95,0,'leaf'));const l=b.add(leaf,green,Math.cos(a)*reach,h,Math.sin(a)*reach);l.rotation.set(.45+Math.sin(a)*.25,a,.45*Math.cos(a));}
 }else if(id==='delivery-cart'){
  for(const y of[.2,.73]){b.box(.62,.018,.42,steel,0,y,0,.014);for(const z of[-.21,.21])b.box(.62,.035,.012,steel,0,y+.019,z,.005)}
  for(const x of[-.29,.29])for(const z of[-.18,.18]){b.cylinder(.012,.012,.635,steel,x,.4175,z);addCaster(root,{x,z,radius:.045,width:.024,mountTop:.115,rubber,metal:steel});}
  b.tube([[-.3,.65,-.18],[-.3,.84,-.18],[-.3,.84,.18],[-.3,.65,.18]],.013,steel);
 }else if(id==='crate'){
  for(const z of[-.195,.195])for(const y of[.09,.22,.35])b.box(.49,.105,.018,oak,0,y,z,.003);
  for(const x of[-.24,.24])for(const y of[.09,.22,.35])b.box(.018,.105,.38,oak,x,y,0,.003);
  for(const x of[-.22,.22])for(const z of[-.17,.17])b.box(.025,.43,.025,oak,x,.215,z,.003);
  b.box(.45,.018,.35,oak,0,.025,0,.002);
 }else if(!buildExtraFurniture(id,root,b))throw Error('Unknown furniture model: '+id);
 root.name=id;root.userData.catalog_id=id;const keep=new Set();root.traverse(o=>{if(o.userData.mirrorPlane)keep.add(o)});return batchMeshes?batchModel(root,keep):root;
}
const wheelSupports=new WeakMap(),supportA=new THREE.Vector3(),supportB=new THREE.Vector3(),supportDirection=new THREE.Vector3(),supportUp=new THREE.Vector3(0,1,0),supportMatrix=new THREE.Matrix4();
export function syncRoverWheelSupports(wheels){
 for(const wheel of wheels){const s=wheelSupports.get(wheel);if(!s||s.lastY===wheel.position.y)continue;s.lastY=wheel.position.y;s.carrier.position.y=wheel.position.y;for(const link of s.links){supportA.fromArray(link.userData.upper);supportB.fromArray(link.userData.lower);supportB.y+=wheel.position.y-s.radius;supportDirection.subVectors(supportB,supportA);const length=supportDirection.length();link.position.addVectors(supportA,supportB).multiplyScalar(.5);link.quaternion.setFromUnitVectors(supportUp,supportDirection.normalize());link.scale.y=length/.01;link.updateMatrix();supportMatrix.copy(link.matrix);supportMatrix.elements[13]-=s.mesh.position.y;s.mesh.setMatrixAt(link.userData.supportIndex,supportMatrix);}s.mesh.instanceMatrix.needsUpdate=true;}
}
export function populateRoverVisual(visual,p,wheels,profileId='research'){
 const movingParts=[],b=builder(visual),aluminium=b.mat(0xb5bec5,.28,.85,'metal'),dark=b.mat(0x222d35,.5,.3,'paint'),rubber=b.mat(0x171c21,.95,0,'rubber'),pcb=b.mat(0x246247,.6,.15,'pcb'),brass=b.mat(0xb2a16a,.32,.72,'metal'),base=p.radius+.0680894;
 const plate=(length,width,y)=>{const shape=new THREE.Shape(),r=.012;shape.moveTo(-length/2+r,-width/2);shape.lineTo(length/2-r,-width/2);shape.quadraticCurveTo(length/2,-width/2,length/2,-width/2+r);shape.lineTo(length/2,width/2-r);shape.quadraticCurveTo(length/2,width/2,length/2-r,width/2);shape.lineTo(-length/2+r,width/2);shape.quadraticCurveTo(-length/2,width/2,-length/2,width/2-r);shape.lineTo(-length/2,-width/2+r);shape.quadraticCurveTo(-length/2,-width/2,-length/2+r,-width/2);
  for(const x of[-length*.33,0,length*.33])for(const z of[-width*.28,width*.28]){const hole=new THREE.Path();hole.absellipse(x,z,.016,.004,0,Math.PI*2,true);shape.holes.push(hole)}const g=new THREE.ExtrudeGeometry(shape,{depth:.004,bevelEnabled:true,bevelSize:.0007,bevelThickness:.0007,bevelSegments:1,curveSegments:6});g.rotateX(-Math.PI/2);b.add(g,aluminium,0,y,0);};
 plate(p.length,p.width,base);plate(p.length*.84,p.width*.78,base+.044);
 for(const x of[-p.length*.34,p.length*.34])for(const z of[-p.width*.32,p.width*.32]){b.cylinder(.0035,.0035,.04,brass,x,base+.024,z);b.cylinder(.004,.004,.002,aluminium,x,base+.05,z,visual,6);b.box(.001,.0005,.005,dark,x,base+.051,z,.0001)}
 const supportMesh=new THREE.InstancedMesh(geo('wheel-support-link',()=>new THREE.CylinderGeometry(.004,.004,.01,10)),aluminium,8);supportMesh.name='Wheel support links';supportMesh.position.y=p.radius;supportMesh.castShadow=supportMesh.receiveShadow=true;supportMesh.frustumCulled=false;supportMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);visual.add(supportMesh);let supportIndex=0;
 for(const x of[p.wheelbase/2,-p.wheelbase/2])for(const z of[-p.track/2,p.track/2]){
  const wheel=new THREE.Group();wheel.position.set(x,p.radius,z);visual.add(wheel);wheels.push(wheel);const r=p.radius-.0015;
  const profile=[[r*.55,-.0175],[r*.85,-.0175],[r*.98,-.013],[r,-.007],[r,.007],[r*.98,.013],[r*.85,.0175],[r*.55,.0175]].map(a=>new THREE.Vector2(...a));const tyre=b.add(new THREE.LatheGeometry(profile,40),rubber,0,0,0,wheel);tyre.rotation.x=Math.PI/2;
  const hub=b.cylinder(p.radius*.58,p.radius*.58,.033,aluminium,0,0,0,wheel,24);hub.rotation.x=Math.PI/2;
  const treadGeo=new THREE.BoxGeometry(.011,.002,.033),treads=new THREE.InstancedMesh(treadGeo,rubber,36),dummy=new THREE.Object3D();for(let k=0;k<36;k++){const a=k*Math.PI/18;dummy.position.set(Math.sin(a)*(p.radius-.0015),Math.cos(a)*(p.radius-.0015),0);dummy.rotation.set(0,0,-a);dummy.updateMatrix();treads.setMatrixAt(k,dummy.matrix)}treads.castShadow=treads.receiveShadow=true;wheel.add(treads);
  for(const side of[-1,1])for(let k=0;k<6;k++){const a=k*Math.PI/3,bolt=b.cylinder(.002,.002,.0025,dark,Math.cos(a)*p.radius*.3,Math.sin(a)*p.radius*.3,side*.018,wheel,6);bolt.rotation.x=Math.PI/2;}
  const carrier=new THREE.Group();carrier.name='Wheel axle and motor carrier';carrier.position.set(x,p.radius,z);visual.add(carrier);movingParts.push(carrier);
  const axle=b.cylinder(.004,.004,.08,aluminium,0,0,-Math.sign(z)*.04,carrier);axle.rotation.x=Math.PI/2;const motor=b.cylinder(.014,.014,.042,aluminium,0,0,-Math.sign(z)*.05,carrier);motor.rotation.x=Math.PI/2;b.box(.038,.026,.02,dark,0,.004,-Math.sign(z)*.026,.003,carrier);
  b.box(.05,.006,.035,dark,x,base-.003,z-Math.sign(z)*.045,.002);
  const links=[];for(const dx of[-.016,.016]){const link=new THREE.Object3D();visual.add(link);link.name='Articulated wheel support';link.userData.upper=[x+dx,base-.005,z-Math.sign(z)*.045];link.userData.lower=[x+dx,p.radius+.008,z-Math.sign(z)*.045];link.userData.supportIndex=supportIndex++;links.push(link);}
  batchModel(carrier);wheelSupports.set(wheel,{carrier,links,radius:p.radius,mesh:supportMesh,lastY:NaN});
 }
 b.box(.077,.023,.048,dark,-.033,base+.061,0,.006);for(const z of[-.013,.013])b.box(.081,.003,.004,b.mat(0x5f6d72,.7),-.033,base+.074,z,.001);
 b.box(.055,.002,.044,pcb,.037,base+.05,0,.003);b.box(.019,.007,.019,dark,.033,base+.055,0,.001);for(let i=0;i<8;i++)b.box(.0013,.006,.019,aluminium,.025+i*.0022,base+.06,0,.0003);
 for(const z of[-.015,.015])for(let i=0;i<10;i++)b.box(.001,.006,.001,brass,.015+i*.004,base+.055,z,.0001);
 for(const z of[-.012,.012])b.box(.013,.008,.011,aluminium,.068,base+.056,z,.0015);
 for(const[x,y,z,yaw]of[[.113,0,.0064,0],[.097,.073,.0064,Math.PI/2],[.099,-.0725,.0064,-Math.PI/2],[-.113,0,.0064,Math.PI]]){const board=b.box(.022,.017,.004,pcb,x,base+z,-y,.002);board.rotation.y=yaw;const housing=b.box(.01,.007,.008,dark,x+.003*Math.cos(yaw),base+z,-y-.003*Math.sin(yaw),.001);housing.rotation.y=yaw;for(const s of[-1,1]){const lens=b.cylinder(.0018,.0018,.003,b.mat(0x4e1c36,.2,.1),x+.007*Math.cos(yaw)+s*.003*Math.sin(yaw),base+z,-y-.007*Math.sin(yaw)+s*.003*Math.cos(yaw));lens.rotation.z=Math.PI/2;lens.rotation.y=yaw;}}
 b.box(.015,.023,.026,pcb,.112,base+.036,0,.002);const lens=b.cylinder(.006,.006,.012,dark,.125,base+.037,0);lens.rotation.z=Math.PI/2;const glass=b.cylinder(.0045,.0045,.001,b.mat(0x548696,.12,.35),.132,base+.037,0);glass.rotation.z=Math.PI/2;
 for(const[z,c]of[[-.035,0x912f2e],[.035,0x20232a]])b.tube([[-.06,base+.07,z*.3],[-.08,base+.06,z],[-.045,base+.035,z],[.035,base+.035,z],[.055,base+.049,z*.5]],.0015,b.mat(c,.5,0,'rubber'));
 for(const wheel of wheels)batchModel(wheel);syncRoverWheelSupports(wheels);batchModel(visual,new Set([...wheels,...movingParts]));
 decorateRover(visual,profileId,p);
 visual.name='Detailed parametric rover · measured joint layout, illustrative components';
}
