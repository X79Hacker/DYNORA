import {posedWorldBounds} from './raycast-acceleration.js';
import {SOURCE_RENDER_MASK} from './rigid-render-batches.js';
import {captureSkin} from './skin-snapshot.js';
import {rayIntersectsRangeBox,raycastSkinned} from './skinned-raycast.js';
import {SensorRayIndex} from './sensor-ray-index.js';
import {surfaceAlphaVisible,freezeAlphaMaterial} from './depth-alpha.js';
import * as THREE from 'three';
const V=()=>new THREE.Vector3();
const frozenBoundsCache=new WeakMap();
// Only one indexed measurement reuses a scene's private proxy pool at a time.
// Concurrent queries get their own proxies, preserving the in-flight snapshot.
const snapshotPools=new WeakMap();let snapshotSerial=0;
export function visibleInScene(object){let root=object;while(root){if(!root.visible||root.userData.noDepth||root.userData.editorAuxiliary)return false;root=root.parent}return true}
export function cameraForViewport(source,width,height){
 if(!(width>0&&height>0))throw Error('Camera viewport has no area');
 source.updateWorldMatrix(true,false);const camera=source.clone();camera.parent=null;source.matrixWorld.decompose(camera.position,camera.quaternion,camera.scale);camera.aspect=width/height;camera.updateProjectionMatrix();
 camera.projectionMatrix.elements[8]=source.projectionMatrix.elements[8];camera.projectionMatrix.elements[9]=source.projectionMatrix.elements[9];camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();camera.updateMatrixWorld(true);return camera;
}
export function depthAtPoint(camera,worldPoint){camera.updateMatrixWorld(true);const origin=camera.getWorldPosition(V()),local=worldPoint.clone().applyMatrix4(camera.matrixWorldInverse);return {range_m:origin.distanceTo(worldPoint),z_depth_m:-local.z,camera_xyz_m:[local.x,-local.y,-local.z],world_xyz_m:worldPoint.toArray(),camera_origin_m:origin.toArray()}}
export function insidePolygon(x,y,polygon){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside}
export function depthStatistics(samples){const stat=key=>{const values=samples.map(s=>s[key]).sort((a,b)=>a-b);if(!values.length)return null;return{min_m:values[0],mean_m:values.reduce((s,v)=>s+v,0)/values.length,median_m:values.length%2?values[(values.length-1)/2]:(values[values.length/2-1]+values[values.length/2])/2,max_m:values.at(-1)}};return {count:samples.length,range:stat('range_m'),z_depth:stat('z_depth_m')}}
function label(mesh){let o=mesh;while(o){if(o.userData.label)return String(o.userData.label);o=o.parent}return mesh.name||'surface'}

// Freeze deformed skin vertices as well as object transforms for one measurement.
// Three r128's default skinned-mesh raycast tests the undeformed bind geometry.
export class DepthSnapshot{
 constructor(scene,{exclude=[],maxRange=Infinity,indexed=false}={}){
  this.maxRange=maxRange;
  this.stamp=++snapshotSerial;this.pool=null;
  if(indexed){let pool=snapshotPools.get(scene);if(!pool){pool={busy:false,meshes:new WeakMap(),index:new SensorRayIndex({boundsFor:mesh=>mesh.userData.frozenWorldBounds})};snapshotPools.set(scene,pool)}if(!pool.busy){pool.busy=true;this.pool=pool}}
  this.meshes=[];this.owned=[];const alphaMaterials=new WeakMap(),frozen=m=>{let copy=alphaMaterials.get(m);if(!copy){copy=freezeAlphaMaterial(m);alphaMaterials.set(m,copy)}return copy;};const skipped=new Set();for(const o of exclude)o?.traverse(n=>skipped.add(n));scene.updateMatrixWorld();
  scene.traverse(original=>{
   if(!original.isMesh||original.isInstancedMesh||skipped.has(original)||!visibleInScene(original)||(original.layers.mask&(1|SOURCE_RENDER_MASK))===0)return;
   const mats=Array.isArray(original.material)?original.material:[original.material];if(!original.userData.cameraSolid&&mats.every(m=>!m.visible||m.opacity<.03||m.depthWrite===false&&!m.alphaTest))return;
   let mesh=this.pool?.meshes.get(original);if(!mesh){mesh=new THREE.Mesh(original.geometry,original.material);this.pool?.meshes.set(original,mesh)}mesh.geometry=original.geometry;mesh.material=original.material;mesh.raycast=THREE.Mesh.prototype.raycast;mesh.matrixAutoUpdate=false;mesh.matrix.copy(original.matrixWorld);mesh.matrixWorld.copy(original.matrixWorld);mesh.userData.original=original;mesh.userData.geometryId=original.geometry.uuid;
   mesh.morphTargetInfluences=original.morphTargetInfluences?[...original.morphTargetInfluences]:undefined;mesh.userData.frozenGeometry=false;if(!original.isSkinnedMesh&&(original.userData.depthDeforming||original.geometry.attributes.position.usage!==THREE.StaticDrawUsage)){mesh.geometry=original.geometry.clone();mesh.geometry.computeBoundingSphere();mesh.geometry.computeBoundingBox();this.owned.push(mesh.geometry);mesh.userData.frozenGeometry=true;}mesh.userData.alphaSource={material:Array.isArray(original.material)?original.material.map(frozen):frozen(original.material)};
   if(indexed&&!original.isSkinnedMesh){const g=original.geometry,p=g.attributes.position;let bounds=frozenBoundsCache.get(g);if(!bounds||bounds.position!==p||bounds.version!==p.version){g.computeBoundingBox();bounds={position:p,version:p.version,box:g.boundingBox.clone()};frozenBoundsCache.set(g,bounds)}mesh.userData.frozenWorldBounds=bounds.box.clone().applyMatrix4(mesh.matrixWorld).expandByScalar(1e-7)}
   if(original.isSkinnedMesh){
    const sharedBounds=indexed?posedWorldBounds(original):null;
    const skin=sharedBounds?{bounds:sharedBounds.clone(),pose:Array.from(original.skeleton.boneMatrices),bake:()=>captureSkin(mesh).bake()}:captureSkin(original),raycast=mesh.raycast;mesh.userData.skinPose=skin.pose;mesh.userData.frozenWorldBounds=skin.bounds;
    if(indexed){mesh.skeleton={bones:original.skeleton.bones.map(b=>({matrixWorld:b.matrixWorld.clone()})),boneInverses:original.skeleton.boneInverses.map(m=>m.clone()),boneMatrices:new Float32Array(skin.pose),update(){}};mesh.bindMatrix=original.bindMatrix.clone();mesh.bindMatrixInverse=original.bindMatrixInverse.clone();}
    let baked=false;mesh.raycast=(raycaster,hits)=>{if(!rayIntersectsRangeBox(raycaster.ray,skin.bounds,raycaster.near,raycaster.far))return;if(indexed&&!baked&&raycastSkinned(mesh,raycaster,hits,this.stamp))return;if(!baked){mesh.geometry=skin.bake();this.owned.push(mesh.geometry);baked=true}raycast.call(mesh,raycaster,hits)};mesh.userData.bakeSkin=()=>{if(!baked){mesh.geometry=skin.bake();this.owned.push(mesh.geometry);baked=true}return mesh.geometry}}
   this.meshes.push(mesh);
  });
  this.raycaster=new THREE.Raycaster();
  this.index=indexed?(this.pool?.index||new SensorRayIndex({boundsFor:mesh=>mesh.userData.frozenWorldBounds})).update(this.meshes):null;
 }
 point(camera,u,v){
  if(!Number.isFinite(u)||!Number.isFinite(v)||u<0||u>1||v<0||v>1)throw Error('Choose a pixel inside the camera view');
  this.raycaster.near=camera.near;this.raycaster.far=Math.min(camera.far,this.maxRange);this.raycaster.setFromCamera(new THREE.Vector2(u*2-1,1-v*2),camera);
  let hit;for(let pass=0;pass<64;pass++){hit=this.index?this.index.nearest(this.raycaster):this.raycaster.intersectObjects(this.meshes,false)[0];if(!hit||surfaceAlphaVisible(hit.object.userData.alphaSource,hit))break;this.raycaster.near=hit.distance+1e-6;hit=null;}if(!hit)return null;
  const original=hit.object.userData.original;return {u,v,...depthAtPoint(camera,hit.point),surface:label(original),mesh_id:original.uuid,geometry_id:hit.object.userData.geometryId,local_point_m:hit.point.clone().applyMatrix4(new THREE.Matrix4().copy(hit.object.matrixWorld).invert()).toArray(),face_index:hit.faceIndex,normal_world:hit.face?.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize().toArray()||null};
 }
 region(camera,{polygon,width,height,dense=false,surfaceOnly=true,grid=48,maxDensePixels=100000}={}){
  if(!Array.isArray(polygon)||polygon.length<3||polygon.some(p=>p.length!==2||p.some(n=>!Number.isFinite(n)||n<0||n>1)))throw Error('Draw a closed region inside the camera view');
  width=Math.max(1,Math.round(width));height=Math.max(1,Math.round(height));
  const xs=polygon.map(p=>p[0]),ys=polygon.map(p=>p[1]),x0=Math.max(0,Math.floor(Math.min(...xs)*width)),x1=Math.min(width,Math.ceil(Math.max(...xs)*width)),y0=Math.max(0,Math.floor(Math.min(...ys)*height)),y1=Math.min(height,Math.ceil(Math.max(...ys)*height));
  if(x0===x1||y0===y1)throw Error('Draw a region with visible area');if(dense&&(x1-x0)*(y1-y0)>maxDensePixels)throw Error('Dense region exceeds 100,000 pixels. Draw a smaller region or use the sampled grid.');
  const step=dense?1:Math.max(1,Math.ceil(Math.max(x1-x0,y1-y0)/grid)),hits=[];let sampled=0;
  for(let y=y0;y<y1;y+=step)for(let x=x0;x<x1;x+=step){const u=(x+.5)/width,v=(y+.5)/height;if(!insidePolygon(u,v,polygon))continue;sampled++;const hit=this.point(camera,u,v);if(hit)hits.push({...hit,x_px:x,y_px:y})}
  const cx=xs.reduce((a,b)=>a+b,0)/xs.length,cy=ys.reduce((a,b)=>a+b,0)/ys.length;
  const anchor=this.point(camera,cx,cy)||hits.slice().sort((a,b)=>(a.u-cx)**2+(a.v-cy)**2-((b.u-cx)**2+(b.v-cy)**2))[0];
  const samples=surfaceOnly&&anchor?hits.filter(h=>h.mesh_id===anchor.mesh_id):hits;
  return{kind:'region',method:dense?'every display pixel':'sampled display-pixel grid',sampling_step_px:step,viewport_px:[width,height],polygon,surface_only:surfaceOnly,surface:surfaceOnly?anchor?.surface||null:'all visible surfaces',anchor:anchor||null,attempted_samples:sampled,background_or_excluded:sampled-samples.length,...depthStatistics(samples),samples};
 }
 async regionAsync(camera,{polygon,width,height,dense=false,surfaceOnly=true,grid=48,maxDensePixels=100000,cancelled=()=>false,onProgress=()=>{},budgetMs=5}={}){
  if(!Array.isArray(polygon)||polygon.length<3||polygon.some(p=>p.length!==2||p.some(n=>!Number.isFinite(n)||n<0||n>1)))throw Error('Draw a closed region inside the camera view');
  width=Math.max(1,Math.round(width));height=Math.max(1,Math.round(height));
  const xs=polygon.map(p=>p[0]),ys=polygon.map(p=>p[1]),x0=Math.max(0,Math.floor(Math.min(...xs)*width)),x1=Math.min(width,Math.ceil(Math.max(...xs)*width)),y0=Math.max(0,Math.floor(Math.min(...ys)*height)),y1=Math.min(height,Math.ceil(Math.max(...ys)*height));
  if(x0===x1||y0===y1)throw Error('Draw a region with visible area');if(dense&&(x1-x0)*(y1-y0)>maxDensePixels)throw Error('Dense region exceeds 100,000 pixels. Draw a smaller region or use the sampled grid.');
  const step=dense?1:Math.max(1,Math.ceil(Math.max(x1-x0,y1-y0)/grid)),hits=[];let sampled=0;
  let since=performance.now();for(let y=y0;y<y1;y+=step){for(let x=x0;x<x1;x+=step){const u=(x+.5)/width,v=(y+.5)/height;if(!insidePolygon(u,v,polygon))continue;sampled++;const hit=this.point(camera,u,v);if(hit)hits.push({...hit,x_px:x,y_px:y})}if(cancelled())throw new DOMException('Selection superseded','AbortError');if(performance.now()-since>budgetMs){onProgress((y-y0)/Math.max(1,y1-y0));await new Promise(r=>setTimeout(r,0));since=performance.now()}}
  const cx=xs.reduce((a,b)=>a+b,0)/xs.length,cy=ys.reduce((a,b)=>a+b,0)/ys.length;
  const anchor=this.point(camera,cx,cy)||hits.slice().sort((a,b)=>(a.u-cx)**2+(a.v-cy)**2-((b.u-cx)**2+(b.v-cy)**2))[0];
  const samples=surfaceOnly&&anchor?hits.filter(h=>h.mesh_id===anchor.mesh_id):hits;
  return{kind:'region',method:dense?'every display pixel':'sampled display-pixel grid',sampling_step_px:step,viewport_px:[width,height],polygon,surface_only:surfaceOnly,surface:surfaceOnly?anchor?.surface||null:'all visible surfaces',anchor:anchor||null,attempted_samples:sampled,background_or_excluded:sampled-samples.length,...depthStatistics(samples),samples};
 }
 dispose(){for(const geometry of this.owned)geometry.dispose();this.meshes=[];this.owned=[];this.index=null;if(this.pool){this.pool.busy=false;this.pool=null}}
}
export function depthCSV(reading){const samples=reading.samples||[reading],quote=s=>'"'+String(s??'').replaceAll('"','""')+'"';return ['u,v,range_m,z_depth_m,world_x_m,world_y_m,world_z_m,surface,sim_time_s,measurement_state',...samples.map(s=>[s.u,s.v,s.range_m,s.z_depth_m,...s.world_xyz_m,quote(s.surface),reading.sim_time_s??'',quote(reading.visibility||'snapshot')].join(','))].join('\n')}

// Live point checks share the normal posed-triangle query cache. They do not
// clone the room or bake every animated vertex for each 5 Hz visibility check.
export class LiveDepthQuery{
 constructor(scene,{exclude=[],maxRange=Infinity}={}){this.maxRange=maxRange;this.meshes=[];this.raycaster=new THREE.Raycaster();const skipped=new Set();for(const o of exclude)o?.traverse(n=>skipped.add(n));scene.updateMatrixWorld();scene.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||skipped.has(o)||!visibleInScene(o)||(o.layers.mask&(1|SOURCE_RENDER_MASK))===0)return;const mats=Array.isArray(o.material)?o.material:[o.material];if(!o.userData.cameraSolid&&mats.every(m=>!m.visible||m.opacity<.03||m.depthWrite===false&&!m.alphaTest))return;this.meshes.push(o)})}
 point(camera,u,v){if(!Number.isFinite(u)||!Number.isFinite(v)||u<0||u>1||v<0||v>1)throw Error('Choose a pixel inside the camera view');this.raycaster.near=camera.near;this.raycaster.far=Math.min(camera.far,this.maxRange);this.raycaster.setFromCamera(new THREE.Vector2(u*2-1,1-v*2),camera);const hit=this.raycaster.intersectObjects(this.meshes,false).find(h=>surfaceAlphaVisible(h.object,h));if(!hit)return null;const o=hit.object;return{u,v,...depthAtPoint(camera,hit.point),surface:label(o),mesh_id:o.uuid,geometry_id:o.geometry.uuid,local_point_m:hit.point.clone().applyMatrix4(new THREE.Matrix4().copy(o.matrixWorld).invert()).toArray(),face_index:hit.faceIndex,normal_world:hit.face?.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(o.matrixWorld)).normalize().toArray()||null}}
 dispose(){this.meshes=[]}
}
