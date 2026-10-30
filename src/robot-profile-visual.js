import * as T from 'three';
import {profileBoxes,robotProfile} from './robot-profiles.js';
export function decorateRover(root,id,p){for(const b of profileBoxes(id,p)){const mesh=new T.Mesh(new T.BoxGeometry(b.w,b.h,b.d),new T.MeshStandardMaterial({color:/Camera|ToF/.test(b.name)?0x243b4b:robotProfile(id).color,roughness:.48,metalness:.15}));mesh.position.set(b.x,b.y,b.z);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.contactPart=b.name;root.add(mesh)}}
