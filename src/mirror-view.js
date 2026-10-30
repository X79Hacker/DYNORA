import * as THREE from 'three';
import {Reflector} from 'three/examples/jsm/objects/Reflector.js';
export function mirrorSurface(object){let surface=null;object.traverse(o=>{if(!surface&&o.isMesh&&o.userData.mirrorPlane)surface=o});return surface}
// One optional planar mirror bounds the extra rendering/texture cost.
export class MirrorView{
 constructor(){this.active=null;this.preset='balanced';this.reflector=null}
 disposeSurface(){if(this.reflector){this.reflector.parent?.remove(this.reflector);this.reflector.getRenderTarget().dispose();this.reflector.material.dispose();this.reflector.geometry.dispose();this.reflector=null}}
 rebuild(){this.disposeSurface();if(!this.active||this.preset==='low')return;const surface=mirrorSurface(this.active.object);if(!surface)return;const p=surface.userData.mirrorPlane,size=this.preset==='high'?1024:512;const reflector=new Reflector(new THREE.PlaneGeometry(p.width,p.height),{textureWidth:size,textureHeight:size,color:0xf0f3f4,clipBias:.003});reflector.position.z=p.offset||.006;reflector.userData.editorAuxiliary=true;reflector.castShadow=false;reflector.receiveShadow=false;reflector.layers.set(0);surface.add(reflector);this.reflector=reflector}
 set(record,enabled){if(!enabled){record.liveMirror=false;if(this.active===record){this.disposeSurface();this.active=null}return[record]}if(!mirrorSurface(record.object))throw Error('Select a model with a mirror surface');const changed=[];if(this.active&&this.active!==record){this.active.liveMirror=false;changed.push(this.active)}this.disposeSurface();this.active=record;record.liveMirror=true;this.rebuild();changed.push(record);return changed}
 quality(preset){if(preset!==this.preset){this.preset=preset;this.rebuild()}}
 remove(record){if(this.active===record){this.disposeSurface();this.active=null}record.liveMirror=false}
 info(){return{requested_object:this.active?.id||null,active:!!this.reflector,resolution:this.reflector?(this.preset==='high'?1024:512):0,limit:1,notes:'Optional planar room reflection; disabled on Low. ToF remains geometric and does not model reflected light paths.'}}
}
