import * as T from 'three';
import {boundaryPaths} from './depth-boundaries.js';

// Clip BEFORE perspective division. Keep the visible portion of a selected
// border even when an endpoint crosses the eye or leaves the camera frame.
const planes=[p=>p.w+p.x,p=>p.w-p.x,p=>p.w+p.y,p=>p.w-p.y,p=>p.w+p.z,p=>p.w-p.z];
const uv=p=>[(p.x/p.w+1)/2,(1-p.y/p.w)/2];
function clipOutlineData(a,b){
 let lo=0,hi=1;
 for(const plane of planes){const fa=plane(a),fb=plane(b);if(fa<0&&fb<0)return null;if(fa<0)lo=Math.max(lo,fa/(fa-fb));else if(fb<0)hi=Math.min(hi,fa/(fa-fb));if(lo>hi)return null;}
 const p=a.clone().lerp(b,lo),q=a.clone().lerp(b,hi);if(p.w<=0||q.w<=0)return null;
 const x=uv(p),y=uv(q);return x.every(Number.isFinite)&&y.every(Number.isFinite)&&Math.hypot(x[0]-y[0],x[1]-y[1])>1e-10?{uv:[...x,...y],za:p.w,zb:q.w,lo,hi}:null;
}
export function clipOutlineSegment(a,b){return clipOutlineData(a,b)?.uv||null;}
export function projectLocalBoundary(boundary,matrix,camera,details=null,part=null){
 const vp=new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(matrix),out=[],a=new T.Vector4(),b=new T.Vector4();
 for(const points of localPaths(boundary))for(let i=1;i<points.length;i++){const pa=points[i-1],pb=points[i];a.set(...pa,1).applyMatrix4(vp);b.set(...pb,1).applyMatrix4(vp);const data=clipOutlineData(a,b);if(data){out.push(data.uv);if(details)details.push({...data,part,a:pa.map((v,k)=>v+(pb[k]-v)*data.lo),b:pa.map((v,k)=>v+(pb[k]-v)*data.hi)});}}
 return out;
}

// Coverage is for depth sampling ONLY. Clipped frame edges are never stroked.
function clipPolygon(points){
 let out=points;
 for(const plane of planes){const input=out;out=[];for(let i=0;i<input.length;i++){const a=input[i],b=input[(i+1)%input.length],fa=plane(a),fb=plane(b);if(fa>=0)out.push(a);if((fa<0)!==(fb<0))out.push(a.clone().lerp(b,fa/(fa-fb)));}}
 return out.filter(p=>p.w>0).map(uv);
}
const loopsCache=new WeakMap();
function localPaths(boundary){
 let paths=loopsCache.get(boundary);if(paths)return paths;
 const nodes=new Map(),edges=[],key=p=>p.map(v=>Math.round(v*1e5)).join(',');
 for(let i=0;i+5<boundary.length;i+=6){const pa=boundary.slice(i,i+3),pb=boundary.slice(i+3,i+6),a=key(pa),b=key(pb);if(a===b)continue;const e={a,b,used:false};edges.push(e);for(const [k,p]of [[a,pa],[b,pb]]){if(!nodes.has(k))nodes.set(k,{point:p,edges:[]});nodes.get(k).edges.push(e);}}
 paths=[];const walk=(first,start)=>{let edge=first,node=start;const points=[nodes.get(node).point];while(edge&&!edge.used){edge.used=true;node=edge.a===node?edge.b:edge.a;points.push(nodes.get(node).point);edge=nodes.get(node).edges.find(e=>!e.used);}paths.push(points);};
 for(const [key,node]of nodes)if(node.edges.length!==2)for(const edge of node.edges)if(!edge.used)walk(edge,key);
 for(const edge of edges)if(!edge.used)walk(edge,edge.a);
 loopsCache.set(boundary,paths);return paths;
}
function resolvePart(source,part){
 const frozen=Array.isArray(source?.meshes),mesh=frozen?source.meshes.find(m=>m.userData.original?.uuid===part.mesh_id):source?.getObjectByProperty('uuid',part.mesh_id);
 if(!mesh)return null;const original=frozen?mesh.userData.original:mesh;
 if(part.geometry_id&&part.geometry_id!==(mesh.userData.geometryId||original.geometry?.uuid))return null;
 if(!frozen){let node=mesh,attached=false;while(node){if(!node.visible)return null;if(node===source)attached=true;node=node.parent;}if(!attached)return null;mesh.updateWorldMatrix(true,false);}
 if(part.skinned){const pose=frozen?mesh.userData.skinPose:(original.skeleton.update(),original.skeleton.boneMatrices);if(!pose||!part.skin_pose?.every((v,i)=>Math.abs(v-pose[i])<1e-6))return null;}
 return mesh;
}
export function selectedSurfaceParts(region){return region?.surface_parts?.length?region.surface_parts:region?.local_boundary?.length?[{mesh_id:region.mesh_ids?.[0],boundary:region.local_boundary}]:[];}
export function projectSelectionOutline(source,camera,region){
 if(region?.kind==='object'){
  const points=[],p=new T.Vector3();let crossesNear=false;
  for(const id of region.mesh_ids||[]){const mesh=resolvePart(source,{mesh_id:id});if(!mesh)continue;if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
   for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){p.set(x,y,z);if(-p.clone().applyMatrix4(camera.matrixWorldInverse).z<=camera.near){crossesNear=true;continue;}p.project(camera);points.push([(p.x+1)/2,(1-p.y)/2]);}
  }
  let polygon=null;if(points.length){let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const [u,v]of points){x0=Math.min(x0,u);y0=Math.min(y0,v);x1=Math.max(x1,u);y1=Math.max(y1,v);}if(crossesNear){x0=y0=0;x1=y1=1;}if(x1>x0&&y1>y0)polygon=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];}region={...region,polygon};
 }
 const lines=[],coverage=[],parts=selectedSurfaceParts(region),depthSegments=[];let found=0;
 if(region?.follow&&parts.length){
  for(const part of parts){const mesh=resolvePart(source,part);if(!mesh)continue;found++;const boundary=part.boundary||[];lines.push(...projectLocalBoundary(boundary,mesh.matrixWorld,camera,depthSegments,part));const vp=new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(mesh.matrixWorld);
   for(const loop of localPaths(boundary)){if(loop.length<4||loop[0]!==loop.at(-1))continue;const p=clipPolygon(loop.slice(0,-1).map(p=>new T.Vector4(...p,1).applyMatrix4(vp)));if(p.length>2)coverage.push(p);}
  }
 }else if(region?.polygon?.length>2){
  const points=region.polygon.map(p=>new T.Vector4(p[0]*2-1,1-p[1]*2,0,1));for(let i=0;i<points.length;i++){const s=clipOutlineSegment(points[i],points[(i+1)%points.length]);if(s)lines.push(s);}const p=clipPolygon(points);if(p.length>2)coverage.push(p);found=1;
 }
 const paths=boundaryPaths(lines.flat()),all=coverage.flat();let coveragePolygon=null;
 if(coverage.length===1)coveragePolygon=coverage[0];else if(all.length){let x0=1,y0=1,x1=0,y1=0;for(const [u,v]of all){x0=Math.min(x0,u);y0=Math.min(y0,v);x1=Math.max(x1,u);y1=Math.max(y1,v);}coveragePolygon=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];}
 const result={schema:'dynora-selection-outline-1',source:region?.follow?'Selected surface boundary in mesh-local coordinates':'Selected image boundary',space:'normalized undistorted camera UV',paths,segments:lines.length,coverage_polygon:coveragePolygon,status:!region?'no_region':paths.length?'complete':coveragePolygon?'boundary_outside_view':found?'outside_view':'target_unavailable',precision:'Projected selected boundary; homogeneous near/far/frame clipping; no object-edge detection'};
 Object.defineProperty(result,'_depth_segments',{value:depthSegments});return result;
}
