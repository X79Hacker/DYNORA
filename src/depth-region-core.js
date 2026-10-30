import * as T from 'three';
import {insidePolygon} from './depth-core.js';
import {projectSelectionOutline,selectedSurfaceParts} from './depth-selection-outline.js';

export function projectedBounds(query,camera,ids){
 const points=[],p=new T.Vector3();let crossesNear=false;
 for(const mesh of query.meshes){if(!ids.includes(mesh.userData.original.uuid))continue;const box=mesh.userData.frozenWorldBounds;if(!box)continue;
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){p.set(x,y,z);const local=p.clone().applyMatrix4(camera.matrixWorldInverse);if(-local.z<=camera.near){crossesNear=true;continue;}p.project(camera);points.push([(p.x+1)/2,(1-p.y)/2]);}
 }
 if(!points.length)return null;
 const x0=crossesNear?0:Math.max(0,Math.min(...points.map(p=>p[0]))),y0=crossesNear?0:Math.max(0,Math.min(...points.map(p=>p[1]))),x1=crossesNear?1:Math.min(1,Math.max(...points.map(p=>p[0]))),y1=crossesNear?1:Math.min(1,Math.max(...points.map(p=>p[1])));
 return x1>x0&&y1>y0?[[x0,y0],[x1,y0],[x1,y1],[x0,y1]]:null;
}
export function followedRegionTest(context){
 if(!context.follow||!context.local_to_clip)return()=>true;
 const p=new T.Vector4(),entries=new Map(selectedSurfaceParts(context).filter(s=>s.local_to_clip).map(s=>[s.mesh_id,{matrix:new T.Matrix4().fromArray(s.local_to_clip),faces:s.face_ids?new Set(s.face_ids):null}])),fallback={matrix:new T.Matrix4().fromArray(context.local_to_clip),faces:context.face_ids?new Set(context.face_ids):null};
 return hit=>{const item=entries.size?entries.get(hit.mesh_id):fallback;if(!item||item.faces&&!item.faces.has(hit.face_index))return false;p.set(...hit.local_point_m,1).applyMatrix4(item.matrix);if(p.w<=0||p.z < -p.w||p.z>p.w)return false;return insidePolygon((p.x/p.w+1)/2,(1-p.y/p.w)/2,context.polygon);};
}
export function projectedSurfacePolygon(query,camera,context){return projectSelectionOutline(query,camera,context).coverage_polygon;}
export function partIds(scene,meshId,wholeObject=false){
 const mesh=scene.getObjectByProperty('uuid',meshId);if(!mesh)return[];let root=mesh;
 if(wholeObject)for(let p=mesh;p&&!p.isScene;p=p.parent)if(p.userData.label||p.userData.visualAsset||p.userData.human){root=p;break;}
 const ids=[];root.traverse(o=>{if(o.isMesh&&!o.userData.renderProxy)ids.push(o.uuid)});return ids;
}
export function heatColor(t){t=Math.max(0,Math.min(1,t));const hue=(1-t)*240/60,x=1-Math.abs(hue%2-1);let rgb=hue<1?[1,x,0]:hue<2?[x,1,0]:hue<3?[0,1,x]:[0,x,1];return rgb.map(v=>Math.round(v*255));}
