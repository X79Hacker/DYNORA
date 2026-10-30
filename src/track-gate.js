import * as T from 'three';
export const GATE_DIMENSIONS=Object.freeze({postWidth:.09,postHeight:.75,leafHeight:.46,leafBottom:.06,thickness:.03,hingeClearance:.075,meetingGap:.04});
// Clear the square post's diagonal throughout the swing. The same construction
// is used by the track and regression fixtures; visual/contact dimensions agree.
export function createSwingGate({parent,frame:c,halfWidth:H,leafMaterial,postMaterial,onObstacle=()=>{}}){
 const d=GATE_DIMENSIONS,end=H-d.meetingGap/2,length=end-d.hingeClearance;if(!Number.isFinite(length)||length<=.05)throw Error('Gate passage is too narrow');
 const g={x:c.x,z:c.z,tx:c.tx,tz:c.tz,nx:c.nx,nz:c.nz,H,L:end,leaves:[],posts:[]};
 for(const sd of [-1,1]){const px=c.x+c.nx*sd*H,pz=c.z+c.nz*sd*H,post=new T.Mesh(new T.BoxGeometry(d.postWidth,d.postHeight,d.postWidth),postMaterial);post.position.set(px,d.postHeight/2,pz);post.castShadow=post.receiveShadow=true;post.userData.label='gate post';parent.add(post);g.posts.push(post);onObstacle(post);
  const pivot=new T.Group();pivot.position.set(px,0,pz);pivot.rotation.y=Math.atan2(sd*c.nz,-sd*c.nx);pivot.userData.label='swing gate door';pivot.userData.gate=true;parent.add(pivot);
  const leaf=new T.Mesh(new T.BoxGeometry(length,d.leafHeight,d.thickness),leafMaterial);leaf.position.set((end+d.hingeClearance)/2,d.leafBottom+d.leafHeight/2,0);leaf.castShadow=leaf.receiveShadow=true;leaf.userData.gate=true;pivot.add(leaf);onObstacle(leaf);
  const metal=new T.MeshStandardMaterial({color:0x606b77,metalness:.8,roughness:.35});for(const y of [.14,.44]){const strap=new T.Mesh(new T.BoxGeometry(.11,.025,.042),metal);strap.position.set(.055,y,0);strap.userData.noContact=true;strap.castShadow=true;pivot.add(strap)}
  g.leaves.push({sd,phi:0,w:0,piv:pivot,mesh:leaf,restQuaternion:pivot.quaternion.clone()});
 }return g;
}
