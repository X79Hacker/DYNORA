import * as T from 'three';
const geometry=new Map();
const cached=(key,create)=>{if(!geometry.has(key))geometry.set(key,create());return geometry.get(key);};

// Dimensions are metres. A caster is a connected axle/fork/stem/plate assembly;
// its tyre stays tangent to the ground rather than hanging below the frame.
export function addCaster(parent,{x=0,z=0,radius=.045,width=.024,mountTop=.12,yaw=0,dual=false,rubber,metal,frame=metal}={}){
 if(!(radius>0&&width>0&&mountTop>radius*1.5))throw Error('Caster dimensions do not leave room for its fork');
 rubber.userData.surface||='rubber';metal.userData.surface||='metal';
 const root=new T.Group();root.name='Connected caster assembly';root.position.set(x,0,z);root.rotation.y=yaw;root.userData.caster={radius,width,mount_top_m:mountTop,dual};parent.add(root);
 const add=(g,m,role,px,py,pz)=>{const o=new T.Mesh(g,m);o.position.set(px,py,pz);o.castShadow=o.receiveShadow=true;o.name=role;o.userData.casterRole=role;root.add(o);return o;};
 const cyl=(r,h,m,role,px,py,pz,axle=false)=>{const o=add(cached(`c:${r}:${h}`,()=>new T.CylinderGeometry(r,r,h,16)),m,role,px,py,pz);if(axle)o.rotation.x=Math.PI/2;return o;};
 const box=(w,h,d,m,role,px,py,pz)=>add(cached(`b:${w}:${h}:${d}`,()=>new T.BoxGeometry(w,h,d)),m,role,px,py,pz);
 const forkThickness=Math.max(.003,radius*.095),forkTop=Math.min(mountTop-.008,radius*2+.012),forkWidth=Math.max(.013,radius*.42),plateWidth=Math.max(.025,radius*.75),plateDepth=width+forkThickness*4;
 if(dual){const tread=width*.28;for(const side of[-1,1])cyl(radius,tread,rubber,'tyre',0,radius,side*(width/2-tread/2),true);}else cyl(radius,width,rubber,'tyre',0,radius,0,true);
 cyl(radius*.25,width+forkThickness*4,metal,'axle',0,radius,0,true);
 for(const side of[-1,1])box(forkWidth,forkTop-radius+forkThickness,forkThickness,frame,'fork',0,(forkTop+radius)/2,side*(width/2+forkThickness/2));
 box(forkWidth,forkThickness,width+forkThickness*2,frame,'fork bridge',0,forkTop,0);
 const plateY=mountTop-.003,stemBottom=forkTop-forkThickness/2;
 cyl(Math.max(.005,radius*.16),plateY-stemBottom,metal,'kingpin',0,(plateY+stemBottom)/2,0);
 cyl(Math.max(.01,radius*.3),.006,metal,'swivel bearing',0,forkTop+.004,0);
 box(plateWidth,.006,plateDepth,metal,'mounting plate',0,plateY,0);
 return root;
}
