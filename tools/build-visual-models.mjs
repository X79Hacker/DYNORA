// Rebuild original, self-contained GLB assets from the shipped modelling source.
import fs from 'node:fs/promises';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import * as THREE from 'three';
import {MODEL_CATALOG,createFurniture,populateRoverVisual,batchModel} from '../src/visual-models.js';
import {DEFAULTS} from '../src/dynamics.js';
import {normalizeModel,setDimensions,validateGLB,geometryStatistics} from '../src/visual-core.js';
class FileReader {readAsArrayBuffer(blob){blob.arrayBuffer().then(value=>{this.result=value;this.onloadend?.()})}}
globalThis.window={FileReader};
const folder=new URL('../public/visual/models/',import.meta.url);await fs.mkdir(folder,{recursive:true});
const manifest=[];
for(const spec of MODEL_CATALOG){const root=normalizeModel(createFurniture(spec.id),spec.dimensions[1]);setDimensions(root,spec.dimensions);await new Promise((resolve,reject)=>{try{new GLTFExporter().parse(root,async bytes=>{try{validateGLB(bytes);await fs.writeFile(new URL(spec.id+'.glb',folder),new Uint8Array(bytes));manifest.push({...spec,url:'models/'+spec.id+'.glb',source:'Original DYNORA modelling source: src/visual-models.js and src/room-models.js',license:'MIT',...geometryStatistics(root)});resolve()}catch(e){reject(e)}},{binary:true,onlyVisible:true})}catch(e){reject(e)}})}
const rover=new THREE.Group(),wheels=[];populateRoverVisual(rover,DEFAULTS,wheels);const instances=[];rover.traverse(o=>{if(o.isInstancedMesh)instances.push(o)});for(const o of instances){const m=new THREE.Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);const mesh=new THREE.Mesh(o.geometry,o.material);mesh.applyMatrix4(m);o.parent.add(mesh)}o.parent.remove(o)}batchModel(rover);
await new Promise(resolve=>new GLTFExporter().parse(rover,async bytes=>{validateGLB(bytes);await fs.writeFile(new URL('rover.glb',folder),new Uint8Array(bytes));resolve()},{binary:true}));
await fs.writeFile(new URL('../public/visual/original-models.json',import.meta.url),JSON.stringify({models:manifest},null,2));
console.log('Built '+manifest.length+' furniture GLBs plus the detailed rover.');
