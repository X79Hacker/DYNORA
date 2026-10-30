import {MountedCameraClearance} from './camera-clearance.js';
import * as THREE from 'three';
import {DEFAULTS} from './dynamics.js';
import {STLLoader} from 'three/examples/jsm/loaders/STLLoader.js';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {profileHeight,profileRadius} from './robot-profiles.js';
import {populateRoverVisual,syncRoverWheelSupports} from './visual-models.js';
import {cadOverride} from './cad-assets.js';
import cadXML from '../robot.urdf?raw';
import roverXML from '../my_bot.urdf?raw';
const assets=import.meta.glob('../assets/*.stl',{eager:true,query:'?url',import:'default'});

// Sensor positions are from my_bot.urdf in the body frame (x forward, y left, z up).
export const MOUNTS=[[.113,0,.0064,0],[.097,.073,.0064,Math.PI/2],[.099,-.0725,.0064,-Math.PI/2],[-.113,0,.0064,Math.PI]];
export function createRover(scene,p) {
  const robot=new THREE.Group(),visual=new THREE.Group(),wheels=[];
  let measuredRadius=0,measuredHeight=0,cameraMount=null,tofMounts=MOUNTS.map(m=>[...m]);
  robot.add(visual);scene.add(robot);
  const rcam=new THREE.PerspectiveCamera(70,1.6,.0015,35);rcam.rotation.y=-Math.PI/2;robot.add(rcam);
  const fov=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x22d3ee}));robot.add(fov);
  const cameraClearance=new MountedCameraClearance(robot,rcam);
  function rebuild(params){
    p=params;measuredRadius=profileRadius(robot.userData.roverProfile||'research',p);measuredHeight=profileHeight(robot.userData.roverProfile||'research',p);const disposed=new Set();visual.traverse(o=>{for(const r of [o.geometry,o.material])if(r&&!disposed.has(r)){r.dispose();disposed.add(r)}});visual.clear();wheels.length=0;
    const base=p.radius+.0680894;populateRoverVisual(visual,p,wheels,robot.userData.roverProfile||'research');
    rcam.position.set(.133,base+.037,0);if(cameraMount)applyCamera();cameraClearance.setMount(rcam.position);
    fov.geometry.dispose();fov.geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(1.2,base+.037,-.65),rcam.position.clone(),new THREE.Vector3(1.2,base+.037,.65)]);

  }
  rebuild(p);
  function applyCamera(){const c=cameraMount,eye=new THREE.Vector3(c.x,c.z,-c.y),yaw=c.yaw*Math.PI/180,pitch=c.pitch*Math.PI/180,target=eye.clone().add(new THREE.Vector3(Math.cos(pitch)*Math.cos(yaw),Math.sin(pitch),-Math.cos(pitch)*Math.sin(yaw)));rcam.position.copy(eye);rcam.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(eye,target,new THREE.Vector3(0,1,0)));rcam.rotateZ(c.roll*Math.PI/180);rcam.fov=c.fov;rcam.updateProjectionMatrix();cameraClearance.setMount(rcam.position);}
  return {robot,visual,wheels,rcam,fov,rebuild,updateWheelMounts:()=>syncRoverWheelSupports(wheels),bodyHeight:()=>measuredHeight,radius:()=>measuredRadius,
    cameraState:()=>cameraClearance.metadata(),updateCameraClearance:physics=>cameraClearance.update(physics),
    setCamera(c){cameraMount={...c};applyCamera()},setToFMounts(m){tofMounts=m.map(v=>[...v])},
    mounts:()=>tofMounts.map(m=>[...m]),sensor(i){const [x,y,z,yaw]=tofMounts[i],origin=robot.localToWorld(new THREE.Vector3(x,p.radius+.0680894+z,-y)),direction=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw)).applyQuaternion(robot.quaternion).normalize();return{origin,direction};}};
}
const vec=(s,fallback=[0,0,0])=>s?s.trim().split(/\s+/).map(Number):fallback;
function transform(group,element){const o=element?.querySelector(':scope > origin');group.position.fromArray(vec(o?.getAttribute('xyz')));const [r,p,y]=vec(o?.getAttribute('rpy'));group.rotation.set(r,p,y,'ZYX');}
const cache=new Map();
async function geometry(filename){const base=filename.split('/').pop(),custom=await cadOverride(base);if(custom){if(!cache.has(custom.sha256)){const g=new STLLoader().parse(custom.bytes);g.scale(custom.scale,custom.scale,custom.scale);cache.set(custom.sha256,g)}return cache.get(custom.sha256)}const url=assets['../assets/'+base];if(!url)throw Error(base);if(!cache.has(url))cache.set(url,new STLLoader().loadAsync(url));return cache.get(url);}
export async function loadCAD(which='cad',showCollisions=false){
  const doc=new DOMParser().parseFromString(which==='cad'?cadXML:roverXML,'application/xml'),group=new THREE.Group(),links=new Map(),missing=new Set(),joints=[];
  if(doc.querySelector('parsererror'))throw Error('Invalid supplied URDF XML');
  const model=doc.querySelector('robot');let mass=0;const centres=[];
  for(const link of model.querySelectorAll(':scope > link')){
    const g=new THREE.Group();g.name=link.getAttribute('name');links.set(g.name,g);
    const inertial=link.querySelector(':scope > inertial');const m=Number(inertial?.querySelector('mass')?.getAttribute('value')||0);mass+=m;
    if(m){const com=new THREE.Object3D();transform(com,inertial);g.add(com);centres.push([com,m]);}
    for(const v of link.querySelectorAll(showCollisions?':scope > collision':':scope > visual')){
      const frame=new THREE.Group();transform(frame,v);g.add(frame);
      const mesh=v.querySelector('geometry > mesh');if(!mesh)continue;
      try{const geo=await geometry(mesh.getAttribute('filename')),rgba=vec(v.querySelector('material > color')?.getAttribute('rgba'),[.65,.72,.8,1]);
        const object=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:new THREE.Color(...rgba.slice(0,3)),metalness:.35,roughness:.55,wireframe:showCollisions}));object.scale.fromArray(vec(mesh.getAttribute('scale'),[1,1,1]));frame.add(object);
      }catch(e){missing.add(e.message);const placeholder=new THREE.Mesh(new THREE.BoxGeometry(.018,.018,.018),new THREE.MeshBasicMaterial({color:0xf5ad57,wireframe:true}));frame.add(placeholder);}
    }
  }
  const children=new Set();for(const j of model.querySelectorAll(':scope > joint')){
    const parent=links.get(j.querySelector('parent').getAttribute('link')),child=links.get(j.querySelector('child').getAttribute('link')),frame=new THREE.Group();transform(frame,j);parent.add(frame);frame.add(child);children.add(child.name);
    if(j.getAttribute('type')!=='fixed'){frame.add(new THREE.AxesHelper(.04));joints.push(j.getAttribute('name'));}
  }
  for(const [name,g] of links)if(!children.has(name))group.add(g);
  group.updateMatrixWorld(true);const com=new THREE.Vector3();for(const [g,m]of centres)com.addScaledVector(g.getWorldPosition(new THREE.Vector3()),m/mass);
  const marker=new THREE.Mesh(new THREE.SphereGeometry(.009,16,12),new THREE.MeshBasicMaterial({color:0xff5870}));marker.position.copy(com);group.add(marker);
  // URDF z-up to Three.js y-up. This is display framing, not an edit to the URDF.
  const view=new THREE.Group();view.add(group);group.rotation.x=-Math.PI/2;view.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(view),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());group.position.sub(center);group.position.y+=size.y/2;
  return {group:view,summary:{source:which==='cad'?'robot.urdf':'my_bot.urdf',links:links.size,mass_kg:mass,com_urdf_m:com.toArray(),bounds_m:size.toArray(),moving_joints:joints,missing_meshes:[...missing]}};
}
export function initCADInspector(getParameters=()=>DEFAULTS){
  const dialog=document.createElement('dialog');dialog.id='cadDialog';dialog.innerHTML='<div class="cad-head"><strong>Supplied URDF / STL inspector</strong><button id="cadClose">Close</button></div><div class="cad-controls"><select id="cadSource"><option value="driven">Driven rover · current calibration</option><option value="cad">robot.urdf · complete mesh set</option><option value="rover">my_bot.urdf · missing meshes marked</option></select><label><input id="cadCollision" type="checkbox"> Collision meshes</label></div><div id="cadView"></div><p id="cadInfo">Loading source geometry…</p><p class="mut">Drag to orbit · scroll to zoom · RGB axes = movable joints · red dot = URDF centre of mass · amber wire boxes = unavailable meshes. Driven rover uses replacement geometry; the two source URDF assemblies are separate reference models.</p>';document.body.append(dialog);
  let renderer,scene,camera,controls,current,loading=false;
  async function update(){if(loading)return;loading=true;document.getElementById('cadCollision').disabled=document.getElementById('cadSource').value==='driven';document.getElementById('cadInfo').textContent='Loading source geometry…';try{let result;if(document.getElementById('cadSource').value==='driven'){const params=getParameters(),rover=createRover(new THREE.Scene(),params);rover.robot.remove(rover.rcam,rover.fov);rover.robot.updateMatrixWorld(true);const size=new THREE.Box3().setFromObject(rover.visual).getSize(new THREE.Vector3());result={group:rover.robot,summary:{source:'Driven rover · parametric geometry',links:5,mass_kg:params.mass,bounds_m:size.toArray(),missing_meshes:[]}};}else result=await loadCAD(document.getElementById('cadSource').value,document.getElementById('cadCollision').checked);if(current)scene.remove(current);current=result.group;scene.add(current);const s=result.summary;camera.position.set(.65,.55,.65);controls.target.set(0,s.bounds_m[1]/2,0);controls.update();document.getElementById('cadInfo').textContent=`${s.source} · ${s.links} links · ${s.mass_kg.toFixed(4)} kg (profile or source) · bounds ${s.bounds_m.map(v=>(v*1000).toFixed(1)).join(' × ')} mm · missing meshes: ${s.missing_meshes.length?s.missing_meshes.join(', '):'none'}`;}catch(e){document.getElementById('cadInfo').textContent=e.message}finally{loading=false}}
  function render(){if(!dialog.open)return;const holder=document.getElementById('cadView');renderer.setSize(holder.clientWidth,holder.clientHeight,false);camera.aspect=holder.clientWidth/holder.clientHeight;camera.updateProjectionMatrix();controls.update();renderer.render(scene,camera);requestAnimationFrame(render);}
  document.getElementById('cadClose').onclick=()=>dialog.close();
  document.getElementById('cadSource').onchange=update;document.getElementById('cadCollision').onchange=update;
  return()=>{dialog.showModal();if(!renderer){renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));document.getElementById('cadView').append(renderer.domElement);scene=new THREE.Scene();scene.background=new THREE.Color(0x101a29);scene.add(new THREE.HemisphereLight(0xffffff,0x536679,1.3));const light=new THREE.DirectionalLight(0xffffff,1);light.position.set(2,3,1);scene.add(light);scene.add(new THREE.GridHelper(1,20,0x4d657b,0x26384c));camera=new THREE.PerspectiveCamera(45,1,.001,10);controls=new OrbitControls(camera,renderer.domElement);update()}render()};
}
