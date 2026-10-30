import {mkdirSync,writeFileSync} from 'node:fs';
import * as THREE from 'three';
import {parseGeometry,glbParts} from './human-gltf-tools.mjs';
import {prepareHumans,createRealisticHuman} from '../src/realistic-human.js';
const out=new URL('../work-assets/previews/',import.meta.url);mkdirSync(out,{recursive:true});
const parsed={};for(const id of ['sam','maya'])parsed[id]=await parseGeometry(new URL('../public/visual/humans/'+id+'.glb',import.meta.url));
await prepareHumans({baseURL:'https://offline.test/',loader:{loadAsync:async url=>parsed[url.includes('maya')?'maya':'sam']}});
for(const id of ['sam','maya','researcher']){
  const source=new URL('../public/visual/humans/'+id+'.glb',import.meta.url),{doc,binary}=glbParts(source),root=id==='researcher'?(await parseGeometry(source)).scene:createRealisticHuman({character:id}).g;
  root.updateMatrixWorld(true);
  const materials={};for(const m of doc.materials||[]){let image=null;const ti=m.pbrMetallicRoughness?.baseColorTexture?.index;if(ti!==undefined){const img=doc.images[doc.textures[ti].source],v=doc.bufferViews[img.bufferView];image=id+'-image-'+doc.textures[ti].source+'.'+(img.mimeType==='image/png'?'png':'jpg');writeFileSync(new URL(image,out),binary.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength));}materials[m.name]={image,color:m.pbrMetallicRoughness?.baseColorFactor||[1,1,1,1],doubleSided:!!m.doubleSided,alpha:m.alphaMode||'OPAQUE'};}
  const meshes=[];root.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry,p=geo.attributes.position,uv=geo.attributes.uv,positions=[],uvs=[];for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i);if(o.isSkinnedMesh)o.boneTransform(i,v);v.applyMatrix4(o.matrixWorld);positions.push(v.x,v.y,v.z);if(uv)uvs.push(uv.getX(i),uv.getY(i))}const mats=Array.isArray(o.material)?o.material:[o.material],groups=geo.groups.length?geo.groups:[{start:0,count:geo.index?.count||p.count,materialIndex:0}];meshes.push({positions,uvs,indices:geo.index?Array.from(geo.index.array):Array.from({length:p.count},(_,i)=>i),groups,materials:mats.map(m=>m.name)});});
  writeFileSync(new URL(id+'.json',out),JSON.stringify({meshes,materials}));console.log(id,meshes.length);
}
