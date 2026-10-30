import {projectedBounds} from './depth-region-core.js';
import {boundaryPaths} from './depth-boundaries.js';
import {patchAt} from './depth-patch-core.js';

// Where one whole object is in one frame, from the same frozen snapshot as the
// image: rays on a lattice over the object's projected box mark the pixels
// whose first visible surface belongs to the object. Returns the 16 × 16
// patches it covers and its outline (marching squares), both in image terms.
// Occluded parts are not the object's pixels, so the outline is what the
// camera sees of it. maxY (world metres, y up) keeps only the object at or
// below that height: the top of the shape the user drew, so the snap never
// reaches above the shape (a pot's rim, not the plant's leaves).
// Index = top-left·8 + top-right·4 + bottom-right·2 + bottom-left·1.
const CASES=[[],[['L','B']],[['B','R']],[['L','R']],[['T','R']],[['T','R'],['L','B']],[['T','B']],[['L','T']],[['L','T']],[['T','B']],[['L','T'],['B','R']],[['T','R']],[['L','R']],[['B','R']],[['L','B']],[]];

export async function objectFootprint(query,camera,ids,grid,{maxY=Infinity,columns=72,yieldEvery=600,cancelled=()=>false}={}){
 const set=new Set(ids),box=projectedBounds(query,camera,ids);if(!box)return null;
 const[u0,v0]=box[0],[u1,v1]=box[2],wide=(u1-u0)*grid.width,tall=(v1-v0)*grid.height,nx=Math.max(2,Math.min(columns,Math.ceil(wide))),ny=Math.max(2,Math.min(columns*2,Math.ceil(tall),Math.round(nx*tall/Math.max(1e-9,wide)))),du=(u1-u0)/nx,dv=(v1-v0)/ny;
 const mask=new Uint8Array((nx+2)*(ny+2)),cells=new Set();let hits=0,rays=0;
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
  const u=u0+(i+.5)*du,v=v0+(j+.5)*dv,hit=query.point(camera,u,v);
  if(hit&&set.has(hit.mesh_id)&&hit.world_xyz_m[1]<=maxY+1e-3){mask[(j+1)*(nx+2)+i+1]=1;hits++;const cell=patchAt(grid,u,v);if(cell)cells.add(cell.id);}
  if(++rays%yieldEvery===0){await new Promise(r=>setTimeout(r,0));if(cancelled())throw new DOMException('Selection changed','AbortError');}
 }
 if(!hits)return{cells:[],outline:[],lattice:[nx,ny],rays};
 // Padded lattice: corner (x, y) is the centre of cell (x - 1, y - 1).
 const at=(x,y)=>[Math.max(0,Math.min(1,u0+(x-.5)*du)),Math.max(0,Math.min(1,v0+(y-.5)*dv))],segments=[];
 for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){
  const m=(a,b)=>mask[(y+b)*(nx+2)+x+a],index=m(0,0)*8+m(1,0)*4+m(1,1)*2+m(0,1);
  const edge={T:at(x+.5,y),R:at(x+1,y+.5),B:at(x+.5,y+1),L:at(x,y+.5)};
  for(const[a,b]of CASES[index])segments.push(...edge[a],...edge[b]);
 }
 const area=p=>Math.abs(p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+a[0]*b[1]-b[0]*a[1]},0))/2,minArea=4*du*dv;
 const outline=boundaryPaths(segments).filter(p=>p.length>3&&area(p)>=minArea).map(p=>p.slice(0,-1));
 return{cells:[...cells].sort((a,b)=>a-b),outline,lattice:[nx,ny],rays};
}

// The whole labelled object behind a region: its own mesh ids, else the mesh
// most of the region's samples hit.
export function regionObjectMesh(region,reading){
 if(region?.mesh_ids?.length)return region.mesh_ids[0];
 const count=new Map();for(const s of reading?.samples||[])count.set(s.mesh_id,(count.get(s.mesh_id)||0)+1);
 let best=null,n=0;for(const[id,c]of count)if(c>n){best=id;n=c}return best;
}

// The top of the shape in this frame: the highest point the shape's own
// samples hit on the object. null when the shape is not on the object.
export function shapeTop(reading,ids){const set=new Set(ids);let top=-Infinity;for(const s of reading?.samples||[])if(set.has(s.mesh_id)&&s.world_xyz_m)top=Math.max(top,s.world_xyz_m[1]);return Number.isFinite(top)?top:null}
