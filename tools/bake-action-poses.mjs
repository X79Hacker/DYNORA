// Offline pose inspection: export the actual skinned vertices, never proxy limbs.
import {mkdirSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import * as THREE from 'three';
import {glbParts,parseGeometry} from './human-gltf-tools.mjs';
import {prepareHumans,createRealisticHuman} from '../src/realistic-human.js';
import {createFurniture} from '../src/visual-models.js';
const out=process.argv[2]||'work-assets/action-poses';mkdirSync(out,{recursive:true});
const loaded={},materials={};
for(const id of ['sam','maya']){
 loaded[id]=await parseGeometry('public/visual/humans/'+id+'.glb');const {doc,binary}=glbParts('public/visual/humans/'+id+'.glb');
 for(const m of doc.materials||[]){let image=null;const ti=m.pbrMetallicRoughness?.baseColorTexture?.index;if(ti!==undefined){const n=doc.textures[ti].source,img=doc.images[n],v=doc.bufferViews[img.bufferView];image=id+'-'+n+'.'+(img.mimeType==='image/png'?'png':'jpg');writeFileSync(out+'/'+image,binary.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength))}materials[m.name]={image,color:m.pbrMetallicRoughness?.baseColorFactor||[1,1,1,1]}}
}
await prepareHumans({baseURL:'https://offline.test/',loader:{loadAsync:async url=>loaded[url.includes('maya')?'maya':'sam']}});
for(const pose of ['standing','walking','seated','half-sit']){
 const scene=new THREE.Scene(),sofa=createFurniture('sofa');scene.add(sofa);
 for(const[id,i]of [['sam',0],['maya',1]]){const h=createRealisticHuman({character:id});scene.add(h.g);h.g.rotation.y=-Math.PI/2;h.g.position.set(i?.47:-.47,0,pose==='seated'?.095:pose==='half-sit'?.365:1.15);if(pose==='seated')h.sit(.505);if(pose==='half-sit')h.action(.5,.505);if(pose==='walking')h.pose(i?1.2:3.5,1)}
 scene.updateMatrixWorld(true);const meshes=[];
 scene.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry,p=geo.attributes.position,uv=geo.attributes.uv,vertices=[],uvs=[];for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i);if(o.isSkinnedMesh)o.boneTransform(i,v);v.applyMatrix4(o.matrixWorld);vertices.push(v.x,v.y,v.z);if(uv)uvs.push(uv.getX(i),uv.getY(i))}const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats)if(!materials[m.name])materials[m.name||m.uuid]={color:[m.color.r,m.color.g,m.color.b,m.opacity]};meshes.push({vertices,uvs,indices:geo.index?Array.from(geo.index.array):Array.from({length:p.count},(_,i)=>i),groups:geo.groups.length?geo.groups:[{start:0,count:geo.index?.count||p.count,materialIndex:0}],materials:mats.map(m=>m.name||m.uuid)})});
 writeFileSync(out+'/'+pose+'.json.gz',gzipSync(JSON.stringify({meshes,materials})));console.log(pose,meshes.reduce((s,m)=>s+m.indices.length/3,0),'triangles');
}
