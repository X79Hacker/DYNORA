import {captureSkin} from './skin-snapshot.js';
import {SOURCE_RENDER_MASK} from './rigid-render-batches.js';
import {prepareSkinnedRaycast,raycastSkinned,rayIntersectsRangeBox,skinnedWorldBounds} from './skinned-raycast.js';
import * as T from 'three';
// Shared immutable-geometry BVHs. They preserve Three's face/material/UV hits;
// skinned and morphed meshes retain their own raycast implementation.
const trees=new WeakMap(),original=T.Mesh.prototype.raycast;
let installed=false,frame=0;const skins=new WeakMap();
export function beginRaycastFrame(){frame++}
export function posedWorldBounds(mesh){return skinnedWorldBounds(mesh,frame)}
export function enableAnimatedCulling(root){root.traverse(o=>{if(o.isSkinnedMesh){o.userData.posedFrustum=true;o.frustumCulled=true}})}
const vA=new T.Vector3(),vB=new T.Vector3(),vC=new T.Vector3(),localHit=new T.Vector3(),worldHit=new T.Vector3(),inverse=new T.Matrix4(),ray=new T.Ray(),rangeStep=new T.Vector3(),bary=new T.Vector3(),uvA=new T.Vector2(),uvB=new T.Vector2(),uvC=new T.Vector2();
function treeFor(g){
 const p=g.attributes.position,ix=g.index,n=Math.floor((ix?.count||p?.count||0)/3);if(!p||p.isInterleavedBufferAttribute||n<256||n>150000)return null;
 let cached=trees.get(g);if(cached&&cached.version===p.version&&cached.indexVersion===ix?.version)return cached;
 if(cached&&cached.faces===n&&cached.indexVersion===ix?.version&&cached.positionCount===p.count){const refit=node=>{node.box.makeEmpty();if(node.faces){for(const f of node.faces)for(let k=0;k<3;k++){const i=ix?ix.getX(f*3+k):f*3+k;node.box.expandByPoint(vA.fromBufferAttribute(p,i))}}else{refit(node.left);refit(node.right);node.box.copy(node.left.box).union(node.right.box)}};refit(cached.root);cached.version=p.version;return cached;}
 const bounds=new Float32Array(n*6),centres=new Float32Array(n*3);
 for(let f=0;f<n;f++){const i=f*3,a=ix?ix.getX(i):i,b=ix?ix.getX(i+1):i+1,c=ix?ix.getX(i+2):i+2;for(let k=0;k<3;k++){const x=p.array[a*p.itemSize+k],y=p.array[b*p.itemSize+k],z=p.array[c*p.itemSize+k];bounds[f*6+k]=Math.min(x,y,z);bounds[f*6+k+3]=Math.max(x,y,z);centres[f*3+k]=(x+y+z)/3}}
 const build=faces=>{const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const f of faces)for(let k=0;k<3;k++){min[k]=Math.min(min[k],bounds[f*6+k]);max[k]=Math.max(max[k],bounds[f*6+k+3])}const box=new T.Box3(new T.Vector3(...min),new T.Vector3(...max));if(faces.length<=12)return {box,faces};let axis=0;for(let k=1;k<3;k++)if(max[k]-min[k]>max[axis]-min[axis])axis=k;faces.sort((a,b)=>centres[a*3+axis]-centres[b*3+axis]);const half=faces.length>>1;return {box,left:build(faces.slice(0,half)),right:build(faces.slice(half))}};
 if(!g.boundingBox)g.computeBoundingBox();if(!g.boundingSphere)g.computeBoundingSphere();cached={version:p.version,indexVersion:ix?.version,positionCount:p.count,faces:n,root:build(Array.from({length:n},(_,i)=>i))};trees.set(g,cached);return cached;
}
export function prepareRaycastGeometry(g){return treeFor(g)}
export function installRaycastAcceleration(){
 if(installed)return;installed=true;
 const intersects=T.Frustum.prototype.intersectsObject;
 T.Frustum.prototype.intersectsObject=function(object){if(object.isSkinnedMesh&&object.userData.posedFrustum){const box=skinnedWorldBounds(object,frame);return box?this.intersectsBox(box):true}return intersects.call(this,object)};
 for(const name of ['intersectObject','intersectObjects']){const fn=T.Raycaster.prototype[name];T.Raycaster.prototype[name]=function(...args){const mask=this.layers.mask;if(mask&1)this.layers.mask|=SOURCE_RENDER_MASK;try{return fn.apply(this,args)}finally{this.layers.mask=mask}}}
 T.Mesh.prototype.raycast=function(rc,hits){
  if(this.morphTargetInfluences?.some(v=>v!==0))return original.call(this,rc,hits);
  if(this.isSkinnedMesh){if(raycastSkinned(this,rc,hits,frame))return;let cached=skins.get(this);if(!cached||cached.frame!==frame||cached.source!==this.geometry){const skin=captureSkin(this);cached={frame,source:this.geometry,skin,geometry:cached?.source===this.geometry?cached.geometry:null,posed:null};skins.set(this,cached)}if(!rayIntersectsRangeBox(rc.ray,cached.skin.bounds,rc.near,rc.far))return;if(!cached.posed){cached.geometry=cached.skin.bake(cached.geometry);cached.posed=new T.Mesh(cached.geometry,this.material);cached.posed.matrixAutoUpdate=false;cached.posed.matrixWorld.copy(this.matrixWorld)}const first=hits.length;cached.posed.raycast(rc,hits);for(let i=first;i<hits.length;i++)hits[i].object=this;return;}
  const g=this.geometry,tree=treeFor(g);if(!tree)return original.call(this,rc,hits);
  inverse.copy(this.matrixWorld).invert();ray.copy(rc.ray).applyMatrix4(inverse);rangeStep.copy(rc.ray.origin).add(rc.ray.direction).applyMatrix4(inverse).sub(ray.origin);const scale=rangeStep.length(),near=rc.near*scale,far=rc.far*scale;if(!rayIntersectsRangeBox(ray,tree.root.box,near,far))return;
  const p=g.attributes.position,ix=g.index,uv=g.attributes.uv,start=g.drawRange.start,end=Math.min(ix?.count||p.count,start+g.drawRange.count),groups=g.groups,mats=this.material,array=Array.isArray(mats);
  const visit=node=>{if(!rayIntersectsRangeBox(ray,node.box,near,far))return;if(!node.faces){visit(node.left);visit(node.right);return}for(const f of node.faces){const i=f*3;if(i<start||i+2>=end)continue;let mi=0;if(array){const group=groups.find(s=>i>=s.start&&i+2<s.start+s.count);if(!group)continue;mi=group.materialIndex}const material=array?mats[mi]:mats;if(!material)continue;
   const a=ix?ix.getX(i):i,b=ix?ix.getX(i+1):i+1,c=ix?ix.getX(i+2):i+2;vA.fromBufferAttribute(p,a);vB.fromBufferAttribute(p,b);vC.fromBufferAttribute(p,c);
   const hit=material.side===T.BackSide?ray.intersectTriangle(vC,vB,vA,true,localHit):ray.intersectTriangle(vA,vB,vC,material.side!==T.DoubleSide,localHit);if(!hit)continue;worldHit.copy(localHit).applyMatrix4(this.matrixWorld);const distance=worldHit.distanceTo(rc.ray.origin);if(distance<rc.near||distance>rc.far)continue;
   const result={distance,point:worldHit.clone(),object:this,faceIndex:f,face:{a,b,c,normal:T.Triangle.getNormal(vA,vB,vC,new T.Vector3()),materialIndex:mi}};
   if(uv){T.Triangle.getBarycoord(localHit,vA,vB,vC,bary);uvA.fromBufferAttribute(uv,a);uvB.fromBufferAttribute(uv,b);uvC.fromBufferAttribute(uv,c);result.uv=uvA.clone().multiplyScalar(bary.x).addScaledVector(uvB,bary.y).addScaledVector(uvC,bary.z)}hits.push(result);
  }};visit(tree.root);
 };
}
export async function warmRaycasts(scene,{budgetMs=5}={}){const geometry=new Set(),skins=[];scene.traverse(o=>{if(o.userData.renderProxy)return;if(o.isSkinnedMesh)skins.push(o);else if(o.isMesh&&o.geometry)geometry.add(o.geometry)});let since=performance.now();for(const g of geometry){prepareRaycastGeometry(g);if(performance.now()-since>budgetMs){await new Promise(r=>setTimeout(r,0));since=performance.now()}}for(const mesh of skins){prepareSkinnedRaycast(mesh);if(performance.now()-since>budgetMs){await new Promise(r=>setTimeout(r,0));since=performance.now()}}}
export function originalMeshRaycast(){return original}
installRaycastAcceleration();
