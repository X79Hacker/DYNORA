import test from 'node:test';import assert from 'node:assert/strict';
import * as T from 'three';
import {objectFootprint,regionObjectMesh,shapeTop} from '../src/depth-snap-object.js';
import {DepthSnapshot,cameraForViewport} from '../src/depth-core.js';
import {patchGrid} from '../src/depth-patch-core.js';
import {drawDepthSnap} from '../src/depth-snap-image.js';
const grid=patchGrid(640,480);
function scene(){
 const s=new T.Scene(),wall=new T.Mesh(new T.PlaneGeometry(30,30),new T.MeshBasicMaterial());wall.position.z=-6;s.add(wall);
 const cabinet=new T.Group();cabinet.userData.label='cabinet';const body=new T.Mesh(new T.BoxGeometry(1,1,.4),new T.MeshBasicMaterial()),top=new T.Mesh(new T.BoxGeometry(1,.1,.4),new T.MeshBasicMaterial());top.position.y=.55;cabinet.add(body,top);cabinet.position.z=-3;s.add(cabinet);s.updateMatrixWorld(true);
 const camera=new T.PerspectiveCamera(60,4/3,.01,50);camera.updateMatrixWorld(true);return{s,cabinet,body,top,camera,ids:[body.uuid,top.uuid]};
}
const bounds=paths=>{const p=paths.flat();return[Math.min(...p.map(a=>a[0])),Math.min(...p.map(a=>a[1])),Math.max(...p.map(a=>a[0])),Math.max(...p.map(a=>a[1]))]};
function projected(f,camera){const b=new T.Box3().setFromObject(f.cabinet),u=[],v=[];for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const p=new T.Vector3(x,y,z).project(camera);u.push((p.x+1)/2);v.push((1-p.y)/2)}return[Math.min(...u),Math.min(...v),Math.max(...u),Math.max(...v)]}

test('whole-object footprint: outline and patches cover all of the object, in every camera pose',async()=>{
 const f=scene();for(const x of [0,.6,-.9]){f.camera.position.x=x;f.camera.updateMatrixWorld(true);const cam=cameraForViewport(f.camera,640,480),q=new DepthSnapshot(f.s,{indexed:true});
  const fp=await objectFootprint(q,cam,f.ids,grid);q.dispose();assert.equal(fp.outline.length,1,'one visible piece');
  const got=bounds(fp.outline),want=projected(f,cam),tol=[(want[2]-want[0])/fp.lattice[0],(want[3]-want[1])/fp.lattice[1]];
  for(let i=0;i<4;i++)assert.ok(Math.abs(got[i]-want[i])<=tol[i%2]*1.01,`camera x=${x}: edge ${i} ${got[i].toFixed(3)} vs ${want[i].toFixed(3)}`);
  const cells=new Set(fp.cells);for(const c of grid.cells){const[a,b,cc,d]=c.bounds,inside=a+1e-9<want[2]&&cc-1e-9>want[0]&&b+1e-9<want[3]&&d-1e-9>want[1],core=a>want[0]+tol[0]&&cc<want[2]-tol[0]&&b>want[1]+tol[1]&&d<want[3]-tol[1];if(core)assert.ok(cells.has(c.id),'patch '+c.id+' inside the object');if(!inside)assert.ok(!cells.has(c.id),'patch '+c.id+' outside the object');}
 }
});

test('an occluder splits the outline into the visible pieces and removes covered patches',async()=>{
 const f=scene(),pole=new T.Mesh(new T.BoxGeometry(.5,4,.1),new T.MeshBasicMaterial());pole.position.z=-2;f.s.add(pole);f.s.updateMatrixWorld(true);
 const cam=cameraForViewport(f.camera,640,480),q=new DepthSnapshot(f.s,{indexed:true}),fp=await objectFootprint(q,cam,f.ids,grid);q.dispose();
 assert.equal(fp.outline.length,2);const centre=grid.cells.find(c=>c.bounds[0]<=.5&&c.bounds[2]>.5&&c.bounds[1]<=.5&&c.bounds[3]>.5);assert.ok(!fp.cells.includes(centre.id),'the pole hides the centre patch');
});

test('the object behind a region is its own mesh, else the mesh most samples hit; the snap draws the object',()=>{
 assert.equal(regionObjectMesh({mesh_ids:['a']},{samples:[{mesh_id:'b'}]}),'a');assert.equal(regionObjectMesh({},{samples:[{mesh_id:'b'},{mesh_id:'c'},{mesh_id:'c'}]}),'c');assert.equal(regionObjectMesh({},{samples:[]}),null);
 const calls=[],ctx=new Proxy({},{get:(t,k)=>k in t?t[k]:(...a)=>calls.push([k,...a]),set:(t,k,v)=>{t[k]=v;return true}});
 const reading={projected_region_polygon:[[.4,.4],[.6,.4],[.6,.6],[.4,.6]],patches:[{pixel_bounds:[0,0,40,30]}],snap_object:{cells_px:[[40,30,80,60],[80,30,120,60]],outline:[[[.1,.1],[.2,.1],[.2,.2]],[[.5,.5],[.6,.5],[.6,.6]]]}};
 drawDepthSnap(ctx,reading,{width:640,height:480,showGrid:true,geometry:'surface',scope:'object'});assert.deepEqual(calls.filter(c=>c[0]==='strokeRect').map(c=>c[1]),[40.5,80.5]);assert.deepEqual(calls.filter(c=>c[0]==='moveTo').map(c=>c.slice(1)),[[64,48],[320,240]]);
 calls.length=0;drawDepthSnap(ctx,reading,{width:640,height:480,scope:'region',showGrid:true,geometry:'surface'});assert.deepEqual(calls.filter(c=>c[0]==='strokeRect').map(c=>c[1]),[.5]);assert.deepEqual(calls.filter(c=>c[0]==='moveTo').map(c=>c.slice(1)),[[256,192]]);
});

test('the snap object stops at the top of the drawn shape: the pot, never the leaves above it',async()=>{
 const s=new T.Scene(),plant=new T.Group();plant.userData.label='potted plant';const pot=new T.Mesh(new T.BoxGeometry(.6,.5,.4),new T.MeshBasicMaterial()),leaves=new T.Mesh(new T.BoxGeometry(1.2,.7,.3),new T.MeshBasicMaterial());pot.position.y=-.25;leaves.position.y=.35;plant.add(pot,leaves);plant.position.z=-3;s.add(plant);s.updateMatrixWorld(true);
 const camera=new T.PerspectiveCamera(60,4/3,.01,50);camera.position.y=.2;camera.updateMatrixWorld(true);const cam=cameraForViewport(camera,640,480),ids=[pot.uuid,leaves.uuid];
 // The shape was drawn on the pot, its top 5 cm under the rim; a sample on the wall does not count.
 const top=shapeTop({samples:[{mesh_id:pot.uuid,world_xyz_m:[0,-.05,-2.8]},{mesh_id:pot.uuid,world_xyz_m:[.1,-.3,-2.8]},{mesh_id:'wall',world_xyz_m:[0,3,-6]}]},ids);assert.equal(top,-.05);
 assert.equal(shapeTop({samples:[{mesh_id:'wall',world_xyz_m:[0,1,-6]}]},ids),null,'a shape off the object has no top');
 const q=new DepthSnapshot(s,{indexed:true}),whole=await objectFootprint(q,cam,ids,grid),cut=await objectFootprint(q,cam,ids,grid,{maxY:top});q.dispose();
 const vAt=y=>{const p=new T.Vector3(0,y,-2.8).project(cam);return(1-p.y)/2},rim=vAt(-.05),below=bounds(cut.outline),all=bounds(whole.outline);
 assert.ok(all[1]<vAt(.6),'without the cut the leaves are in');assert.ok(Math.abs(below[1]-rim)<.02,`outline top ${below[1].toFixed(3)} at the shape top ${rim.toFixed(3)}`);
 assert.ok(Math.abs(below[3]-all[3])<.01,'the bottom of the pot stays');assert.equal(cut.outline.length,1);
 for(const id of cut.cells){const c=grid.cells[id-1];assert.ok(c.bounds[3]>rim-1e-9,'patch '+id+' lies above the shape');}
 assert.ok(cut.cells.length<whole.cells.length);
});
