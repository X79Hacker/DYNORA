import * as T from 'three';
import {BufferGeometryUtils} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
export const SOURCE_RENDER_LAYER=2,SOURCE_RENDER_MASK=1<<SOURCE_RENDER_LAYER;
const originals=new WeakMap(),batchSources=new WeakMap(),textureFields=['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap','alphaMap','lightMap','envMap','bumpMap','displacementMap'];
const properties=['type','side','shadowSide','roughness','metalness','flatShading','wireframe','depthTest','depthWrite','colorWrite','polygonOffset','polygonOffsetFactor','polygonOffsetUnits','normalMapType','normalScale','aoMapIntensity','lightMapIntensity','bumpScale','displacementScale','displacementBias','emissive','emissiveIntensity','fog','toneMapped','premultipliedAlpha','dithering'];
const value=v=>v?.isColor?v.toArray().join(','):v?.isVector2?v.toArray().join(','):String(v);
function materialKey(m){return properties.map(k=>value(m[k])).concat(textureFields.map(k=>m[k]?.uuid||''),m.userData?.env0??m.envMapIntensity).join('|')}
function eligible(o){return !!(o.isMesh&&!o.isSkinnedMesh&&!o.isInstancedMesh&&!o.userData.renderProxy&&!o.userData.noBatch&&!o.userData.editorAuxiliary&&!o.userData.mirrorPlane&&o.renderOrder===0&&!Array.isArray(o.material)&&o.material?.isMeshStandardMaterial&&!o.material.transparent&&o.material.opacity===1&&!o.material.skinning&&!o.material.morphTargets&&!(o.material.vertexColors&&(o.geometry.attributes.color?.normalized||o.geometry.attributes.color?.itemSize!==3))&&!o.material.clippingPlanes?.length&&o.material.onBeforeCompile===T.Material.prototype.onBeforeCompile&&o.geometry.drawRange.start===0&&o.geometry.drawRange.count===Infinity&&(o.layers.mask&1||originals.has(o)))}

// Sensors, selection and contacts keep the original objects. Only the draw
// representation is merged, with all original positions, normals, UVs and RGB.
export class RigidRenderBatches{
 constructor({validationMs=0}={}){this.roots=new Map();this.rebuilds=0;this.validationMs=validationMs;this.dirty=true;this.selectedRoot=null}
 track(root){if(root.userData.human||root.userData.humanController||root.userData.animatedVisual)return;let skinned=false;root.traverse(o=>{if(o.isSkinnedMesh)skinned=true});if(skinned)return;if(!this.roots.has(root))this.roots.set(root,{nodes:[],sources:[],proxies:[],signature:null});this.syncRoot(root,this.roots.get(root))}
 // Fixed room details can share a draw even when they belong to different
 // editable models. Sources keep their original parents and identities.
 trackEnvironment(scene,roots,moving=[]){
  const mobile=new Set(moving),regions=new Map(),box=new T.Box3(),centre=new T.Vector3();
  for(const root of roots){if(mobile.has(root)){this.track(root);continue}box.setFromObject(root);if(box.isEmpty())continue;box.getCenter(centre);const key=Math.floor(centre.x/4)+':'+Math.floor(centre.z/4);if(!regions.has(key))regions.set(key,[]);regions.get(key).push(root)}
  for(const scopes of regions.values()){
   if(scopes.length===1){this.track(scopes[0]);continue}
   const root=new T.Group();root.name='Fixed room render cluster';root.userData={renderProxy:true,noDepth:true,noContact:true,editorAuxiliary:true};scene.add(root);
   const state={collection:scopes,nodes:[],sources:[],proxies:[],signature:null};this.roots.set(root,state);this.syncRoot(root,state);
  }
 }
 select(root){if(this.selectedRoot===root)return;this.selectedRoot=root;for(const [batch,state]of this.roots)if(state.collection)this.syncRoot(batch,state)}
 // A fixed room model made movable from Test Lab must leave the shared static
 // cluster. Its own proxy then follows its rigid-body root every rendered frame.
 makeMovable(root){for(const [batch,state]of this.roots)if(state.collection?.includes(root)){this.clear(state);state.collection=state.collection.filter(o=>o!==root);if(state.collection.length)this.syncRoot(batch,state);else{this.roots.delete(batch);batch.parent?.remove(batch)}}this.track(root);this.invalidate()}
 release(root){const state=this.roots.get(root);if(state){this.clear(state);this.roots.delete(root)}}
 clear(state){for(const p of state.proxies){p.parent?.remove(p);p.geometry.dispose();p.material.dispose()}for(const m of state.sources){const mask=originals.get(m);if(mask!==undefined){m.layers.mask=mask;originals.delete(m)}}state.proxies=[];state.sources=[];state.signature=null}
 syncRoot(root,state,matricesCurrent=false){
  const nodes=[],sources=[],scopes=state.collection?state.collection.filter(o=>o.parent&&o!==this.selectedRoot):[root];for(const scope of scopes){if(state.collection)scope.updateWorldMatrix(true,true);scope.traverse(o=>{if(!state.collection&&o===root||o.userData.renderProxy)return;if(!matricesCurrent&&o.matrixAutoUpdate)o.updateMatrix();nodes.push(o);if(eligible(o))sources.push(o)})}
  const visible=o=>{for(let n=o;n&&n!==root;n=n.parent)if(!n.visible)return false;return true};
  const signature=nodes.map(o=>[o.id,o.parent?.id,o.visible,...(state.collection?o.matrixWorld:o.matrix).elements,o.geometry?.uuid,o.geometry?.attributes.position?.version,o.geometry?.attributes.normal?.version,o.geometry?.attributes.uv?.version,o.geometry?.index?.version,o.isMesh?materialKey(o.material||{}):'',o.material?.color?.getHex(),o.material?.vertexColors,o.castShadow,o.receiveShadow,eligible(o)].join(':')).join('|');
  if(signature===state.signature){for(const p of state.proxies)p.material.envMapIntensity=batchSources.get(p).material.envMapIntensity;return}
  this.clear(state);state.signature=signature;state.nodes=nodes;
  const groups=new Map();for(const m of sources){if(!visible(m))continue;const attributes=Object.keys(m.geometry.attributes).filter(k=>k!=='color').sort().map(k=>k+':'+m.geometry.attributes[k].itemSize).join(',');const key=[materialKey(m.material),attributes,m.castShadow,m.receiveShadow,m.layers.mask].join(';');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(m)}
  root.updateWorldMatrix(true,!state.collection);const inverse=new T.Matrix4().copy(root.matrixWorld).invert();
  for(const meshes of groups.values()){
   if(meshes.length<2)continue;const geometries=[];
   for(const m of meshes){let g=m.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,m.matrixWorld));if(g.index){const old=g;g=g.toNonIndexed();old.dispose()}const count=g.attributes.position.count,prior=g.attributes.color,colors=new Float32Array(count*3),c=m.material.color;for(let i=0;i<count;i++){colors[i*3]=c.r*(m.material.vertexColors&&prior?prior.getX(i):1);colors[i*3+1]=c.g*(m.material.vertexColors&&prior?prior.getY(i):1);colors[i*3+2]=c.b*(m.material.vertexColors&&prior?prior.getZ(i):1)}g.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometries.push(g)}
   const geometry=BufferGeometryUtils.mergeBufferGeometries(geometries,false);geometries.forEach(g=>g.dispose());if(!geometry)continue;
   geometry.computeBoundingBox();geometry.computeBoundingSphere();const material=meshes[0].material.clone();material.color.setHex(0xffffff);material.vertexColors=true;const proxy=new T.Mesh(geometry,material);proxy.castShadow=meshes[0].castShadow;proxy.receiveShadow=meshes[0].receiveShadow;proxy.layers.mask=meshes[0].layers.mask;proxy.userData={renderProxy:true,noDepth:true,noContact:true,editorAuxiliary:true};proxy.raycast=()=>{};proxy.name='Rigid render batch';batchSources.set(proxy,meshes[0]);root.add(proxy);state.proxies.push(proxy);
   for(const m of meshes){originals.set(m,m.layers.mask);m.layers.set(SOURCE_RENDER_LAYER);state.sources.push(m)}
  }
  this.rebuilds++;
 }
 invalidate(){this.dirty=true}
 update({matricesCurrent=false}={}){const now=performance.now();for(const [root,state]of this.roots)if(root.parent){if(this.dirty||now>=(state.checkAt||0)){this.syncRoot(root,state,matricesCurrent);state.checkAt=now+this.validationMs}else for(const p of state.proxies)p.material.envMapIntensity=batchSources.get(p).material.envMapIntensity}this.dirty=false}
 info(){let sources=0,draws=0,triangles=0;for(const s of this.roots.values()){sources+=s.sources.length;draws+=s.proxies.length;for(const p of s.proxies)triangles+=(p.geometry.index?.count||p.geometry.attributes.position.count)/3}return{source_meshes:sources,submitted_batches:draws,saved_draws_per_view:sources-draws,triangles_unchanged:Math.round(triangles),rebuilds:this.rebuilds}}
 dispose(){for(const [root,s] of this.roots){this.clear(s);if(s.collection)root.parent?.remove(root)}this.roots.clear()}
}

// Export source geometry once, with its original camera layers. Runtime-only
// merged buffers and object references never enter a dataset's scene JSON.
export function sourceSceneJSON(scene){const removed=[],restored=[];scene.traverse(o=>{if(o.userData.renderProxy)removed.push([o,o.parent,o.parent.children.indexOf(o)]);else if(originals.has(o)){restored.push([o,o.layers.mask]);o.layers.mask=originals.get(o)}});for(const[o,p]of removed)p.remove(o);try{return scene.toJSON()}finally{for(const[o,mask]of restored)o.layers.mask=mask;for(const[o,p,index]of removed){p.add(o);p.children.splice(p.children.indexOf(o),1);p.children.splice(index,0,o)}}}
