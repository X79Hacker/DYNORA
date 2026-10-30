import * as T from 'three';
const cache=new WeakMap();
const component=(a,i,k)=>k===0?a.getX(i):k===1?a.getY(i):k===2?a.getZ(i):a.getW(i);
// Per-bone influence radii are computed once. The union of transformed bone
// spheres bounds every weighted vertex, so distant people need no skin bake.
export function captureSkin(mesh){
 mesh.skeleton.update();const g=mesh.geometry,p=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
 let c=cache.get(mesh);if(!c||c.geometry!==g||c.version!==p.version){
  const radii=new Float32Array(mesh.skeleton.bones.length),v=new T.Vector3(),u=new T.Vector3();
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(mesh.bindMatrix);for(let k=0;k<4;k++){const weight=component(sw,i,k),bone=component(si,i,k);if(weight>0&&mesh.skeleton.boneInverses[bone])radii[bone]=Math.max(radii[bone],u.copy(v).applyMatrix4(mesh.skeleton.boneInverses[bone]).length())}}
  c={geometry:g,version:p.version,radii};cache.set(mesh,c);
 }
 const inverse=mesh.bindMatrixInverse.clone(),bind=mesh.bindMatrix.clone(),boneMatrices=mesh.skeleton.boneMatrices.slice(),bounds=new T.Box3(),m=new T.Matrix4(),point=new T.Vector3(),scale=new T.Vector3(),sphere=new T.Sphere(),box=new T.Box3();
 for(let i=0;i<c.radii.length;i++){m.multiplyMatrices(mesh.matrixWorld,inverse).multiply(mesh.skeleton.bones[i].matrixWorld);point.set(0,0,0).applyMatrix4(m);scale.setFromMatrixScale(m);sphere.set(point,c.radii[i]*Math.max(scale.x,scale.y,scale.z)+.001);bounds.union(sphere.getBoundingBox(box))}
 return {bounds,pose:Array.from(boneMatrices),bake(target=null){const geo=target||g.clone(),out=geo.attributes.position,base=new T.Vector3(),result=new T.Vector3(),temp=new T.Vector3(),matrix=new T.Matrix4();for(let i=0;i<p.count;i++){base.fromBufferAttribute(p,i).applyMatrix4(bind);result.set(0,0,0);for(let k=0;k<4;k++){const weight=component(sw,i,k);if(weight){matrix.fromArray(boneMatrices,component(si,i,k)*16);result.addScaledVector(temp.copy(base).applyMatrix4(matrix),weight)}}result.applyMatrix4(inverse);out.setXYZ(i,result.x,result.y,result.z)}out.needsUpdate=true;geo.computeBoundingSphere();geo.computeBoundingBox();return geo}};
}
