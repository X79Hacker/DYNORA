import * as THREE from 'three';

// Render-only shadows and editor helpers must not enlarge a prop's fallback
// collider or shift its body centre. Bounds include physical source meshes only.
export function contactBounds(root){
 const bounds=new THREE.Box3(),box=new THREE.Box3(),matrix=new THREE.Matrix4(),instance=new THREE.Matrix4();
 root.updateWorldMatrix(true,true);
 root.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.geometry?.attributes.position)return;
  for(let node=mesh;node;node=node.parent){if(node.userData.noContact||node.userData.renderProxy||node.userData.editorAuxiliary)return;if(node===root)break}
  mesh.geometry.computeBoundingBox();
  if(mesh.isInstancedMesh){for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,instance);matrix.multiplyMatrices(mesh.matrixWorld,instance);bounds.union(box.copy(mesh.geometry.boundingBox).applyMatrix4(matrix))}}
  else bounds.union(box.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld));
 });
 return bounds;
}

// Local-space triangle geometry. Static meshes retain holes, bends and thin rails;
// their bounds are only broad-phase acceleration, never a contact surface.
export function staticTriangles(mesh){
 const a=mesh.geometry?.attributes.position;if(!a)return null;
 const scale=mesh.getWorldScale(new THREE.Vector3()),vertices=new Float32Array(a.count*3);
 for(let i=0;i<a.count;i++){vertices[i*3]=a.getX(i)*scale.x;vertices[i*3+1]=a.getY(i)*scale.y;vertices[i*3+2]=a.getZ(i)*scale.z}
 const ix=mesh.geometry.index,indices=ix?Uint32Array.from(ix.array):Uint32Array.from({length:a.count},(_,i)=>i);
 return {vertices,indices};
}

// The same wheel profile, plates and components as populateRoverVisual. Small
// screw heads, wires and plate slots are omitted; there is no enclosing box.
export function roverContactParts(p){
 const parts=[],base=p.radius+.0680894;
 function vertices(name,points){parts.push({name,vertices:new Float32Array(points.flat())})}
 function box(name,x,y,z,w,h,d){vertices(name,[-1,1].flatMap(a=>[-1,1].flatMap(b=>[-1,1].map(c=>[x+a*w/2,y+b*h/2,z+c*d/2]))))}
 function plate(name,length,width,y){const points=[],r=.012;for(const sy of[-.0007,.0047])for(const[x,z,start]of[[length/2-r,width/2-r,0],[-length/2+r,width/2-r,90],[-length/2+r,-width/2+r,180],[length/2-r,-width/2+r,270]])for(let i=0;i<=6;i++){const a=(start+i*15)*Math.PI/180;points.push([x+(r+.0007)*Math.cos(a),y+sy,z+(r+.0007)*Math.sin(a)])}vertices(name,points)}
 plate('Lower chassis plate',p.length,p.width,base);plate('Upper chassis plate',p.length*.84,p.width*.78,base+.044);
 let wheelIndex=0;for(const x of[p.wheelbase/2,-p.wheelbase/2])for(const z of[-p.track/2,p.track/2]){
  const r=p.radius-.0015,profile=[[r*.55,-.0175],[r*.85,-.0175],[r*.98,-.013],[r,-.007],[r,.007],[r*.98,.013],[r*.85,.0175],[r*.55,.0175]],points=[];
  for(const[rad,side]of profile)for(let k=0;k<40;k++){const a=k*Math.PI/20;points.push([x+rad*Math.sin(a),p.radius+rad*Math.cos(a),z+side])}
  // Tread blocks match the rendered instanced tread, including its corners.
  for(let k=0;k<36;k++){const a=k*Math.PI/18;for(const u of[-.0055,.0055])for(const v of[-.001,.001])for(const side of[-.0165,.0165])points.push([x+(r+v)*Math.sin(a)+u*Math.cos(a),p.radius+(r+v)*Math.cos(a)-u*Math.sin(a),z+side])}
  vertices('Tyre',points);parts.at(-1).wheelIndex=wheelIndex++;box('Motor',x,base-.026,z-Math.sign(z)*.05,.028,.028,.042);box('Motor bracket',x,base-.025,z-Math.sign(z)*.021,.038,.026,.02);
 }
 box('Battery',-.033,base+.061,0,.077,.023,.048);box('Battery rails',-.033,base+.074,0,.081,.003,.03);
 box('Electronics',.04,base+.054,0,.07,.014,.044);box('Camera board',.112,base+.036,0,.015,.023,.026);box('Camera lens',.126,base+.037,0,.013,.012,.012);
 for(const[x,z]of[[.113,0],[.097,-.073],[.099,.0725],[-.113,0]])box('ToF board',x,base+.0064,z,Math.abs(z)>.01?.004:.022,.017,Math.abs(z)>.01?.022:.004);
 return parts;
}
