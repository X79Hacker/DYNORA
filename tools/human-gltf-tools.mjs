// Node-side geometry/rig inspection. Textures remain in the real GLB; only this
// inspection copy omits material texture references to avoid requiring a DOM.
import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
export function glbParts(path){const b=readFileSync(path),length=b.readUInt32LE(12);return {doc:JSON.parse(b.subarray(20,20+length)),binary:b.subarray(28+length),bytes:b}}
export async function parseGeometry(path){
  const {doc,binary}=glbParts(path);
  for(const material of doc.materials||[]){for(const k of Object.keys(material))if(/Texture$/.test(k))delete material[k];for(const k of Object.keys(material.pbrMetallicRoughness||{}))if(/Texture$/.test(k))delete material.pbrMetallicRoughness[k]}
  delete doc.images;delete doc.textures;
  let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
  const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
  const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length);binHeader.writeUInt32LE(0x004e4942,4);
  const b=Buffer.concat([header,json,binHeader,binary]);
  return new Promise((resolve,reject)=>new GLTFLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.length),'',resolve,reject));
}
