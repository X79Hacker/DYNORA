import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {DepthSnapshot,insidePolygon} from '../src/depth-core.js';
import {patchGrid,patchAt,fitImageViewport,regionPatchSelections,patchPositions,samplePatchBatch,patchCSV} from '../src/depth-patch-core.js';
import {boundarySegments,boundaryPaths} from '../src/depth-boundaries.js';
import {projectedBounds,followedRegionTest,partIds} from '../src/depth-region-core.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const camera=()=>{const c=new T.PerspectiveCamera(90,1,.01,50);c.updateMatrixWorld(true);return c;};
function plane(scene,z,material=new T.MeshBasicMaterial()){const m=new T.Mesh(new T.PlaneGeometry(10,10),material);m.position.z=z;scene.add(m);return m;}

test('fixed image grids have exactly 16 aligned rows and columns at 896, HD, 4K and odd resolutions',()=>{
 for(const [w,h]of [[896,896],[1920,1080],[3840,2160],[1001,777]]){
  const g=patchGrid(w,h);assert.equal(g.rows.length,16);assert.equal(g.cells.length,256);assert.ok(g.rows.every(r=>r.columns===16));
  assert.equal(g.cells.reduce((n,c)=>n+c.width_px*c.height_px,0),w*h);
  for(let row=0;row<16;row++)for(let col=0;col<16;col++){const c=g.cells[row*16+col];assert.equal(c.id,row*16+col+1);assert.equal(c.pixel_bounds[0],g.cells[col].pixel_bounds[0]);assert.equal(c.pixel_bounds[2],g.cells[col].pixel_bounds[2]);const [x0,y0,x1,y1]=c.pixel_bounds;assert.equal(patchAt(g,(x0+.5)/w,(y0+.5)/h).id,c.id);assert.equal(patchAt(g,(x1-.5)/w,(y1-.5)/h).id,c.id);}
  assert.ok(Math.max(...g.cells.map(c=>c.width_px))-Math.min(...g.cells.map(c=>c.width_px))<=1);assert.ok(Math.max(...g.cells.map(c=>c.height_px))-Math.min(...g.cells.map(c=>c.height_px))<=1);
 }
});
test('fitting the camera image preserves aspect and all image edges when the panel changes size',()=>{
 const a=fitImageViewport({left:100,top:80,width:800,height:700},1920,1080),b=fitImageViewport({left:80,top:90,width:350,height:500},1920,1080);
 near(a.width/a.height,16/9);near(b.width/b.height,16/9);near(a.left,100);near(a.top,205);assert.ok(b.top>=90&&b.bottom<=590);
 const before=patchGrid(1920,1080),after=patchGrid(1920,1080);assert.deepEqual(before.cells,after.cells);assert.equal(fitImageViewport({width:0,height:10},1920,1080),null);
});
test('polygon selection samples only the chosen portions of intersecting fixed image patches',async()=>{
 const g=patchGrid(896,896),polygon=[[.23,.21],[.63,.21],[.63,.4],[.4,.4],[.4,.71],[.23,.71]],chosen=regionPatchSelections(g,polygon);assert.ok(chosen.length>5&&chosen.length<100);
 for(const s of chosen)for(const p of patchPositions(g.cells[s.id-1],s,'25'))assert.ok(insidePolygon(p.u,p.v,polygon));
 const calls=[],q={point(_c,u,v){calls.push([u,v]);return null;}};await samplePatchBatch(q,camera(),g,chosen,{mode:'9',budgetMs:Infinity});assert.ok(calls.length);assert.ok(calls.every(p=>insidePolygon(...p,polygon)));
 const ids=new Set(chosen.slice(2,5).map(p=>p.id));assert.deepEqual(regionPatchSelections(g,polygon,ids).map(p=>p.id),[...ids]);
});
test('transparent cutout holes expose the background and do not produce fake leaf depth',()=>{
 const scene=new T.Scene(),back=plane(scene,-4),data=new Uint8Array([255,255,255,0,255,255,255,255]),texture=new T.DataTexture(data,2,1,T.RGBAFormat);texture.magFilter=T.NearestFilter;texture.needsUpdate=true;
 const leaf=new T.Mesh(new T.PlaneGeometry(2,2),new T.MeshBasicMaterial({map:texture,alphaTest:.5,transparent:true,depthWrite:false}));leaf.position.z=-2;scene.add(leaf);const q=new DepthSnapshot(scene,{indexed:true}),c=camera();
 const left=q.point(c,.4,.5),right=q.point(c,.6,.5);assert.equal(left.mesh_id,back.uuid);near(left.z_depth_m,4);assert.equal(right.mesh_id,leaf.uuid);near(right.z_depth_m,2);q.dispose();
});
test('cutout depth respects texture UV transforms',()=>{
 const scene=new T.Scene(),back=plane(scene,-4),texture=new T.DataTexture(new Uint8Array([255,255,255,0,255,255,255,255]),2,1,T.RGBAFormat);texture.magFilter=T.NearestFilter;texture.offset.x=.5;texture.wrapS=T.RepeatWrapping;
 const leaf=new T.Mesh(new T.PlaneGeometry(2,2),new T.MeshBasicMaterial({map:texture,alphaTest:.5}));leaf.position.z=-2;scene.add(leaf);const q=new DepthSnapshot(scene,{indexed:true});assert.equal(q.point(camera(),.4,.5).mesh_id,leaf.uuid);assert.equal(q.point(camera(),.6,.5).mesh_id,back.uuid);q.dispose();
});
test('dotted contour paths include holes, preserve part identity and cover every boundary segment',()=>{
 const pixels=new Uint32Array([1,1,1,1,0,1,1,1,1]),segments=boundarySegments(pixels,3,3);assert.equal(segments.get(1).length/4,16);const paths=boundaryPaths(segments.get(1));assert.equal(paths.reduce((n,p)=>n+p.length-1,0),16);assert.equal(paths.length,2);
 const parts=boundarySegments(new Uint32Array([1,2]),2,1,[.2,.3,.6,.7],new Set([2]));assert.deepEqual([...parts.keys()],[2]);assert.ok(parts.get(2).every((v,i)=>i%2?v>=.3&&v<=.7:v>=.4-1e-8&&v<=.6));
});
test('projected object bounds move with the object without changing global patch IDs',()=>{
 const scene=new T.Scene(),m=new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshBasicMaterial());m.position.z=-3;scene.add(m);const c=camera(),q=new DepthSnapshot(scene,{indexed:true}),p=projectedBounds(q,c,[m.uuid]);near(p[0][0],.4);near(p[2][0],.6);q.dispose();
 m.position.x=2;scene.updateMatrixWorld(true);const next=new DepthSnapshot(scene,{indexed:true}),shifted=projectedBounds(next,c,[m.uuid]);assert.ok(shifted[0][0]>.6);assert.equal(patchGrid(896,896).cells[119].id,120);next.dispose();
});
test('attached region filtering uses the original local surface coordinates and selected faces',()=>{
 const c=camera(),matrix=new T.Matrix4().makeTranslation(0,0,-3),localToClip=new T.Matrix4().multiplyMatrices(c.projectionMatrix,c.matrixWorldInverse).multiply(matrix).toArray(),context={follow:true,local_to_clip:localToClip,polygon:[[.4,.4],[.6,.4],[.6,.6],[.4,.6]],face_ids:[2]};
 const accept=followedRegionTest(context);assert.ok(accept({face_index:2,local_point_m:[0,0,.5]}));assert.equal(accept({face_index:3,local_point_m:[0,0,.5]}),false);assert.equal(accept({face_index:2,local_point_m:[4,0,.5]}),false);
});
test('whole-object selection includes its real mesh parts while individual-part selection stays specific',()=>{
 const scene=new T.Scene(),group=new T.Group();group.userData.label='Plant';const a=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial()),b=a.clone();group.add(a,b);scene.add(group);assert.deepEqual(partIds(scene,a.uuid),[a.uuid]);assert.deepEqual(partIds(scene,a.uuid,true),[a.uuid,b.uuid]);
});
test('training CSV carries fixed IDs, row/column, integer source bounds and full native resolution',async()=>{
 const scene=new T.Scene();plane(scene,-3);const g=patchGrid(1920,1080),q=new DepthSnapshot(scene,{indexed:true}),s=regionPatchSelections(g,[[0,0],[1,0],[1,1],[0,1]],new Set([17]));const r=await samplePatchBatch(q,camera(),g,s,{budgetMs:Infinity});const [header,row]=patchCSV(r).split('\n').map(s=>s.split(','));const get=n=>row[header.indexOf(n)];assert.equal(get('patch_id'),'17');assert.equal(get('row'),'2');assert.equal(get('column'),'1');assert.equal(get('x0_px'),'0');assert.equal(get('y0_px'),'67');assert.equal(get('x1_exclusive_px'),'120');assert.equal(get('y1_exclusive_px'),'135');assert.equal(get('source_width_px'),'1920');assert.equal(get('source_height_px'),'1080');q.dispose();
});
