import * as THREE from 'three';
// Connected triangle islands preserve empty space between disconnected furniture legs.
// This is bounded convexification, not automatic concave mesh decomposition.
export function colliderParts(root,centre,{mode='parts',maxParts=48,maxVertices=6000}={}){
 const parts=[],v=new THREE.Vector3();let exceeded=false;
 root.updateMatrixWorld(true);
 root.traverse(mesh=>{if(!mesh.isMesh||mesh.isInstancedMesh||mesh.userData.noContact||mesh.userData.renderProxy||exceeded)return;const a=mesh.geometry.attributes.position,index=mesh.geometry.index;if(!a)return;
  const n=index?index.count:a.count;if(n/3>80000){exceeded=true;return}
  const vertices=[],ids=[],keys=new Map(),parent=[];
  const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i]}return i};
  for(let i=0;i<n;i++){const j=index?index.getX(i):i;v.fromBufferAttribute(a,j).applyMatrix4(mesh.matrixWorld).sub(centre);const k=[v.x,v.y,v.z].map(x=>Math.round(x*1e5)).join(',');let id=keys.get(k);if(id===undefined){id=vertices.length;keys.set(k,id);vertices.push(v.toArray());parent.push(id)}ids.push(id)}
  for(let i=0;i+2<ids.length;i+=3){const p=find(ids[i]);parent[find(ids[i+1])]=p;parent[find(ids[i+2])]=p}
  const groups=new Map();vertices.forEach((p,i)=>{const k=mode==='convex'?0:find(i);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(...p)});
  for(const p of groups.values()){if(p.length<12)continue;if(p.length/3>maxVertices||parts.length>=maxParts){exceeded=true;break}parts.push(new Float32Array(p))}
 });
 if(mode==='convex'&&!exceeded){const merged=new Float32Array(parts.reduce((s,p)=>s+p.length,0));let i=0;for(const p of parts){merged.set(p,i);i+=p.length}return merged.length/3<=maxVertices?[merged]:[]}
 return exceeded?[]:parts;
}
