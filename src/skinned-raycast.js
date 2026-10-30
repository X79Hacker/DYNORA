import * as T from 'three';

// A shared bind-space triangle tree stores a conservative box for each bone
// influencing a node. Only intersected leaves skin actual vertices. The GPU
// still renders the original mesh, materials, weights and animation unchanged.
const trees=new WeakMap(),queries=new WeakMap();
const component=(a,i,k)=>k===0?a.getX(i):k===1?a.getY(i):k===2?a.getZ(i):a.getW(i);
const point=new T.Vector3(),scratchBox=new T.Box3(),localRay=new T.Ray(),inverseWorld=new T.Matrix4(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),hit=new T.Vector3(),worldHit=new T.Vector3(),bary=new T.Vector3(),uvA=new T.Vector2(),uvB=new T.Vector2(),uvC=new T.Vector2();

export function rayIntersectsRangeBox(ray,box,near=0,far=Infinity){
 if(box.isEmpty())return false;let lo=Math.max(0,near),hi=far;
 for(const key of ['x','y','z']){const d=ray.direction[key],o=ray.origin[key];if(Math.abs(d)<1e-15){if(o<box.min[key]||o>box.max[key])return false;continue}let x=(box.min[key]-o)/d,y=(box.max[key]-o)/d;if(x>y)[x,y]=[y,x];lo=Math.max(lo,x);hi=Math.min(hi,y);if(hi<lo)return false}return true;
}

export function prepareSkinnedRaycast(mesh){
 const g=mesh.geometry,p=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight,ix=g.index;
 if(!p||!si||!sw)return null;
 let tree=trees.get(g);const version=[p.version,si.version,sw.version,ix?.version,p.count,ix?.count].join(':');if(tree?.version===version&&tree.position===p&&tree.index===ix&&tree.skinIndex===si&&tree.skinWeight===sw)return tree.supported?tree:null;
 const n=Math.floor((ix?.count||p.count)/3);if(!n||n>300000)return null;
 // Convex bounds require nonnegative normalized weights, as in the bundled
 // glTF rigs. Unusual edited weights retain the full snapshot fallback.
 const unsupported=()=>{trees.set(g,{version,position:p,index:ix,skinIndex:si,skinWeight:sw,supported:false});return null};
 for(let i=0;i<p.count;i++){let sum=0;for(let k=0;k<4;k++){const w=component(sw,i,k);if(w<0||!Number.isFinite(w))return unsupported();sum+=w}if(Math.abs(sum-1)>1e-5)return unsupported()}
 const centres=new Float64Array(n*3);for(let f=0;f<n;f++)for(let k=0;k<3;k++){const v=ix?ix.getX(f*3+k):f*3+k;centres[f*3]+=p.getX(v)/3;centres[f*3+1]+=p.getY(v)/3;centres[f*3+2]+=p.getZ(v)/3}
 let nextId=0;
 const build=faces=>{const id=nextId++,extent=new T.Box3();for(const f of faces)extent.expandByPoint(point.fromArray(centres,f*3));const size=extent.getSize(new T.Vector3()),axis=size.y>size.x?(size.z>size.y?2:1):(size.z>size.x?2:0),bones=new Map();let left,right;
  const include=(bone,box)=>{if(bones.has(bone))bones.get(bone).union(box);else bones.set(bone,box.clone())};
  if(faces.length<=12){for(const f of faces)for(let k=0;k<3;k++){const v=ix?ix.getX(f*3+k):f*3+k;point.fromBufferAttribute(p,v);for(let j=0;j<4;j++)if(component(sw,v,j)>0){const bone=component(si,v,j);let box=bones.get(bone);if(!box){box=new T.Box3();bones.set(bone,box)}box.expandByPoint(point)}}}
  else{faces.sort((a,b)=>centres[a*3+axis]-centres[b*3+axis]);const half=faces.length>>1;left=build(faces.slice(0,half));right=build(faces.slice(half));for(const [bone,box]of left.bones)include(bone,box);for(const [bone,box]of right.bones)include(bone,box)}
  return{id,bones:[...bones],left,right,faces:left?null:faces};
 };
 tree={version,position:p,index:ix,skinIndex:si,skinWeight:sw,supported:true,root:build(Array.from({length:n},(_,i)=>i)),nodes:nextId};trees.set(g,tree);return tree;
}

export function skinnedRayStatistics(mesh){const q=queries.get(mesh);return q?{posed_vertices:q.posedCount,box_tests:q.boxTests,total_vertices:mesh.geometry.attributes.position.count}:null}

function skinQuery(mesh,frame){
 if(mesh.morphTargetInfluences?.some(v=>v!==0))return null;
 const tree=prepareSkinnedRaycast(mesh);if(!tree)return null;
 if(tree.root.bones.some(([bone])=>bone>=mesh.skeleton.bones.length))return null;
 let q=queries.get(mesh);if(!q||q.tree!==tree){q={tree,frame:null,stamp:0,boxes:[],vertices:new Float64Array(mesh.geometry.attributes.position.count*3),vertexStamp:new Uint32Array(mesh.geometry.attributes.position.count),matrices:[],worldMatrices:[]};queries.set(mesh,q)}
 if(q.frame!==frame){mesh.skeleton.update();q.frame=frame;q.stamp=(q.stamp+1)>>>0;if(!q.stamp){q.vertexStamp.fill(0);q.boxes=[];q.stamp=1}q.posedCount=q.boxTests=0;
  for(const[bone]of tree.root.bones){if(bone>=mesh.skeleton.bones.length)return null;const m=q.matrices[bone]||(q.matrices[bone]=new T.Matrix4()),world=q.worldMatrices[bone]||(q.worldMatrices[bone]=new T.Matrix4());m.fromArray(mesh.skeleton.boneMatrices,bone*16);m.premultiply(mesh.bindMatrixInverse).multiply(mesh.bindMatrix);world.multiplyMatrices(mesh.matrixWorld,m)}
 }
 return q;
}
function nodeBounds(q,node){
 let item=q.boxes[node.id];if(!item){item={stamp:0,box:new T.Box3()};q.boxes[node.id]=item}
 if(item.stamp!==q.stamp){item.box.makeEmpty();for(const[bone,box]of node.bones)item.box.union(scratchBox.copy(box).applyMatrix4(q.worldMatrices[bone]));item.box.expandByScalar(1e-5);item.stamp=q.stamp}
 return item.box;
}
// Conservative posed bounds are shared by exact rays and both the camera and
// shadow frustums. They never use an animated person's undeformed bind pose.
export function skinnedWorldBounds(mesh,frame){const q=skinQuery(mesh,frame);return q?nodeBounds(q,q.tree.root):null}
export function raycastSkinned(mesh,rc,hits,frame){
 const q=skinQuery(mesh,frame);if(!q)return false;const tree=q.tree;
 const bounds=node=>{q.boxTests++;return rayIntersectsRangeBox(rc.ray,nodeBounds(q,node),rc.near,rc.far)};
 if(!bounds(tree.root))return true;
 inverseWorld.copy(mesh.matrixWorld).invert();localRay.copy(rc.ray).applyMatrix4(inverseWorld);
 const g=mesh.geometry,p=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight,ix=g.index,uv=g.attributes.uv,uv2=g.attributes.uv2,start=g.drawRange.start,end=Math.min(ix?.count||p.count,start+g.drawRange.count),materials=mesh.material,array=Array.isArray(materials);
 const vertex=(i,out)=>{if(q.vertexStamp[i]!==q.stamp){out.set(0,0,0);for(let k=0;k<4;k++){const weight=component(sw,i,k);if(weight)out.addScaledVector(point.fromBufferAttribute(p,i).applyMatrix4(q.matrices[component(si,i,k)]),weight)}out.toArray(q.vertices,i*3);q.vertexStamp[i]=q.stamp;q.posedCount++;return out}return out.fromArray(q.vertices,i*3)};
 const interpolate=attr=>{uvA.fromBufferAttribute(attr,aIndex);uvB.fromBufferAttribute(attr,bIndex);uvC.fromBufferAttribute(attr,cIndex);return uvA.clone().multiplyScalar(bary.x).addScaledVector(uvB,bary.y).addScaledVector(uvC,bary.z)};
 let aIndex,bIndex,cIndex;
 const visit=node=>{if(!node.faces){if(bounds(node.left))visit(node.left);if(bounds(node.right))visit(node.right);return}for(const f of node.faces){const i=f*3;if(i<start||i+2>=end)continue;let mi=0;if(array){const group=g.groups.find(s=>i>=s.start&&i+2<s.start+s.count);if(!group)continue;mi=group.materialIndex}const material=array?materials[mi]:materials;if(!material)continue;
   aIndex=ix?ix.getX(i):i;bIndex=ix?ix.getX(i+1):i+1;cIndex=ix?ix.getX(i+2):i+2;vertex(aIndex,a);vertex(bIndex,b);vertex(cIndex,c);
   const found=material.side===T.BackSide?localRay.intersectTriangle(c,b,a,true,hit):localRay.intersectTriangle(a,b,c,material.side!==T.DoubleSide,hit);if(!found)continue;worldHit.copy(hit).applyMatrix4(mesh.matrixWorld);const distance=worldHit.distanceTo(rc.ray.origin);if(distance<rc.near||distance>rc.far)continue;
   const result={distance,point:worldHit.clone(),object:mesh,faceIndex:f,face:{a:aIndex,b:bIndex,c:cIndex,normal:T.Triangle.getNormal(a,b,c,new T.Vector3()),materialIndex:mi}};if(uv||uv2){T.Triangle.getBarycoord(hit,a,b,c,bary);if(uv)result.uv=interpolate(uv);if(uv2)result.uv2=interpolate(uv2)}hits.push(result);
  }};
 visit(tree.root);return true;
}
