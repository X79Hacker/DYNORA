import {depthStatistics,insidePolygon} from './depth-core.js';
import * as T from 'three';

export const PATCH_COUNT=256;
const clamp=n=>Math.max(0,Math.min(1,n));
const intersect=(a,b)=>{const r=[Math.max(a[0],b[0]),Math.max(a[1],b[1]),Math.min(a[2],b[2]),Math.min(a[3],b[3])];return r[2]>r[0]+1e-12&&r[3]>r[1]+1e-12?r:null};
const area=r=>(r[2]-r[0])*(r[3]-r[1]);

// Fixed source-pixel partition. Boundaries are half-open integer pixel ranges;
// every source pixel belongs to exactly one cell, with no crop or row offsets.
export function patchGrid(width,height){
 width=Math.round(width);height=Math.round(height);
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<16||height<16)throw Error('Camera image must be at least 16 × 16 pixels');
 const cells=[],rows=[];
 for(let row=0;row<16;row++){
  const ids=[];
  for(let col=0;col<16;col++){
   const id=row*16+col+1,x0=Math.floor(col*width/16),x1=Math.floor((col+1)*width/16),y0=Math.floor(row*height/16),y1=Math.floor((row+1)*height/16);
   cells.push({id,row:row+1,column:col+1,columns:16,bounds:[x0/width,y0/height,x1/width,y1/height],pixel_bounds:[x0,y0,x1,y1],width_px:x1-x0,height_px:y1-y0});ids.push(id);
  }
  rows.push({columns:16,ids});
 }
 return{count:256,width,height,rows,cells,key:'16x16',coordinate_system:'source image pixels; half-open [x0,y0,x1,y1)'};
}
export function patchAt(grid,u,v){
 if(!Number.isFinite(u)||!Number.isFinite(v)||u<0||u>1||v<0||v>1)return null;
 const x=Math.min(grid.width-1,Math.floor(u*grid.width)),y=Math.min(grid.height-1,Math.floor(v*grid.height));
 const col=Math.min(15,Math.floor(((x+1)*16-1)/grid.width)),row=Math.min(15,Math.floor(((y+1)*16-1)/grid.height));
 return grid.cells[row*16+col];
}
export function fitImageViewport(rect,width,height){
 if(!(rect.width>0&&rect.height>0&&width>0&&height>0))return null;
 const scale=Math.min(rect.width/width,rect.height/height),w=width*scale,h=height*scale,left=rect.left+(rect.width-w)/2,top=rect.top+(rect.height-h)/2;
 return{...rect,left,top,width:w,height:h,bottom:top+h,source_width:width,source_height:height};
}
export function parsePatchIds(text){
 if(!String(text).trim())return[];
 const ids=new Set();
 for(const term of String(text).trim().split(/[\s,;]+/)){
  const m=/^(\d+)(?:-(\d+))?$/.exec(term);if(!m)throw Error('Use patch IDs such as 1, 4, 20-40');
  const a=Number(m[1]),b=Number(m[2]||a);if(a<1||b>PATCH_COUNT||b<a)throw Error('Patch IDs must be 1–256, with ascending ranges');
  for(let id=a;id<=b;id++)ids.add(id);
 }
 return[...ids].sort((a,b)=>a-b);
}
export class PatchSelection{
 constructor(grid){this.grid=grid;this.items=new Map();this.version=0;}
 clear(){this.items.clear();this.version++;}
 setIds(ids){const next=new Map();for(const id of ids){if(!Number.isInteger(id)||id<1||id>PATCH_COUNT)throw Error('Unknown patch ID');next.set(id,{full:true,rects:[]})}this.items=next;this.version++;}
 toggle(id){if(this.items.has(id))this.items.delete(id);else this.items.set(id,{full:true,rects:[]});this.version++;}
 selectRectangle(bounds,operation='add'){
  const box=[clamp(Math.min(bounds[0],bounds[2])),clamp(Math.min(bounds[1],bounds[3])),clamp(Math.max(bounds[0],bounds[2])),clamp(Math.max(bounds[1],bounds[3]))];
  if(operation==='replace')this.items.clear();
  for(const cell of this.grid.cells){const clipped=intersect(cell.bounds,box);if(!clipped)continue;
   if(operation==='remove'){this.items.delete(cell.id);continue;}
   const old=this.items.get(cell.id);if(old?.full)continue;
   const rects=old?.rects||[];
   if(!rects.some(r=>r.every((v,i)=>Math.abs(v-clipped[i])<1e-12)))rects.push(clipped);
   this.items.set(cell.id,{full:area(clipped)>=area(cell.bounds)-1e-12,rects});
  }
  this.version++;
 }
 reflow(grid){
  if(this.grid.key===grid.key){this.grid=grid;return;}
  const regions=[];for(const [id,item]of this.items)regions.push(...(item.full?[this.grid.cells[id-1].bounds]:item.rects));
  this.grid=grid;this.items.clear();for(const region of regions)this.selectRectangle(region);this.version++;
 }
 snapshot(){return[...this.items].sort((a,b)=>a[0]-b[0]).map(([id,item])=>({id,full:item.full,rects:item.rects.map(r=>[...r])}));}
}
export function patchCalibration(input={}){
 const s={enabled:false,width_cm:54.4,height_cm:54.4,...input};
 if(typeof s.enabled!=='boolean'||![s.width_cm,s.height_cm].every(v=>Number.isFinite(v)&&v>0&&v<=1e7))throw Error('Reference plane width and height must be positive centimetre values');
 return s;
}
export function patchReference(cell,calibration){return calibration.enabled?{reference_width_cm:(cell.bounds[2]-cell.bounds[0])*calibration.width_cm,reference_height_cm:(cell.bounds[3]-cell.bounds[1])*calibration.height_cm}:{};}
export function patchPositions(cell,selection,mode){
 const regions=selection.full?[cell.bounds]:selection.rects.map(r=>intersect(cell.bounds,r)).filter(Boolean);if(!regions.length)return[];
 const bounds=[Math.min(...regions.map(r=>r[0])),Math.min(...regions.map(r=>r[1])),Math.max(...regions.map(r=>r[2])),Math.max(...regions.map(r=>r[3]))];
 const count=mode==='adaptive'?25:Number(mode),n=Math.ceil(Math.sqrt(count)),positions=[];
 let pattern=Array.from({length:n*n},(_,i)=>[i%n,Math.floor(i/n)]);
 if(count<n*n){const chosen=[];while(chosen.length<count){let best=-1,score=-Infinity;for(let i=0;i<pattern.length;i++){const [x,y]=pattern[i],d=chosen.length?Math.min(...chosen.map(p=>(p[0]-x)**2+(p[1]-y)**2)):-((x-(n-1)/2)**2+(y-(n-1)/2)**2);if(d>score){score=d;best=i;}}chosen.push(pattern.splice(best,1)[0]);}pattern=chosen;}
 for(const [x,y]of pattern){
  const u=bounds[0]+(x+.5)/n*(bounds[2]-bounds[0]),v=bounds[1]+(y+.5)/n*(bounds[3]-bounds[1]);
  if(!regions.some(r=>u>=r[0]&&u<=r[2]&&v>=r[1]&&v<=r[3])||selection.polygon&&!insidePolygon(u,v,selection.polygon))continue;
  const priority=n===5&&x%2===0&&y%2===0?0:1;
  positions.push({u,v,priority,centrality:Math.abs(x-(n-1)/2)+Math.abs(y-(n-1)/2)});
 }
 positions.sort((a,b)=>a.priority-b.priority||a.centrality-b.centrality);
 return positions;
}
const defaultYield=()=>new Promise(resolve=>setTimeout(resolve,0));
// One query and camera must remain frozen for the entire batch, including
// yields. Values are actual triangle hits; patch-wide statistics are sampled
// estimates, never copied from neighbours or inferred from reference cm.
export async function samplePatchBatch(query,camera,grid,selections,{mode='9',targetMeshId=null,targetMeshIds=null,acceptHit=()=>true,simTime=0,calibration=patchCalibration(),cancelled=()=>false,onProgress=()=>{},budgetMs=2,yieldFrame=defaultYield,now=()=>performance.now()}={}){
 if(mode!=='adaptive'&&(!Number.isInteger(Number(mode))||Number(mode)<1||Number(mode)>64))throw Error('Unknown patch sample mode; use 1–64 samples or adaptive');
 const started=now(),patches=[],samples=[];let attempted=0,slice=started,queryMs=0;
 const check=()=>{if(cancelled())throw new DOMException('Patch selection changed','AbortError');};
 for(const selection of selections){
  check();const cell=grid.cells[selection.id-1];if(!cell)throw Error('Unknown patch ID');
  const positions=patchPositions(cell,selection,mode),hits=[],groups=new Map();let tries=0,excluded=0,missed=0;
  for(const position of positions){
   check();const t=now(),hit=query.point(camera,position.u,position.v);queryMs+=now()-t;attempted++;tries++;
   if(!hit)missed++;else if(targetMeshId&&hit.mesh_id!==targetMeshId||targetMeshIds&&!targetMeshIds.includes(hit.mesh_id)||!acceptHit(hit))excluded++;else{hits.push(hit);let group=groups.get(hit.mesh_id);if(!group){group={mesh_id:hit.mesh_id,surface:hit.surface,samples:[]};groups.set(hit.mesh_id,group)}group.samples.push(hit);samples.push({patch_id:cell.id,...hit});}
   if(mode==='adaptive'&&tries===9&&groups.size===1&&hits.length===9){
    const depths=hits.map(h=>h.z_depth_m),low=Math.min(...depths),high=Math.max(...depths);
    if(high-low<=Math.max(.005,(high+low)*.005))break;
   }
   if(now()-slice>=budgetMs){onProgress({completed:patches.length,total:selections.length,attempted});await yieldFrame();slice=now();check();}
  }
  const surfaces=[...groups.values()].map(g=>({mesh_id:g.mesh_id,surface:g.surface,...depthStatistics(g.samples)}));
  const status=!tries?'no_samples':surfaces.length>1?'mixed':surfaces.length?'valid':targetMeshId||targetMeshIds?'no_target_samples':'no_hit';
  patches.push({patch_id:cell.id,row:cell.row,column:cell.column,bounds:cell.bounds,pixel_bounds:cell.pixel_bounds,selected_regions:selection.full?[cell.bounds]:selection.rects,attempted_samples:tries,valid_samples:hits.length,excluded_surface_samples:excluded,no_hit_samples:missed,sample_support:tries?hits.length/tries:0,status,surfaces,range:surfaces.length===1?surfaces[0].range:null,z_depth:surfaces.length===1?surfaces[0].z_depth:null,...patchReference(cell,calibration)});
 }
 check();onProgress({completed:patches.length,total:selections.length,attempted});
 return{schema:'dynora-depth-patches-2',sim_time_s:simTime,viewport_px:[grid.width,grid.height],grid_count:PATCH_COUNT,grid_rows:grid.rows.map(r=>r.columns),selected_patch_ids:selections.map(s=>s.id),sample_mode:mode,method:'Frozen visible-triangle samples; per-mesh sampled statistics',coordinate_image:'Undistorted camera render before RGB lens distortion, blur and camera-freeze effects',target_mesh_id:targetMeshId,target_mesh_ids:targetMeshIds,source_image_px:[grid.width,grid.height],calibration,attempted_samples:attempted,valid_samples:samples.length,query_ms:queryMs,elapsed_ms:now()-started,statistics_are_estimates:true,patches,samples};
}
const quote=value=>'"'+String(value??'').replaceAll('"','""')+'"';
export function patchCSV(batch){
 const header='batch_id,region_id,region_label,sim_time_s,sampled_at_iso,patch_id,row,column,status,mesh_id,surface,attempted_samples,valid_samples,patch_sample_support,surface_sample_support,range_median_m,z_median_m,range_min_sample_m,range_max_sample_m,z_min_sample_m,z_max_sample_m,reference_width_cm,reference_height_cm,statistics_are_estimates,x0_px,y0_px,x1_exclusive_px,y1_exclusive_px,source_width_px,source_height_px,source_frame_index';
 return[header,...(batch?.patches||[]).flatMap(p=>(p.surfaces.length?p.surfaces:[{}]).map(s=>[batch.id??'',p.region_id??batch.region_id??'',quote(p.region_label??batch.region_label),batch.sim_time_s,quote(batch.sampled_at_iso),p.patch_id,p.row,p.column,p.status,quote(s.mesh_id),quote(s.surface),p.attempted_samples,s.count??0,p.sample_support,p.attempted_samples?(s.count||0)/p.attempted_samples:0,s.range?.median_m??'',s.z_depth?.median_m??'',s.range?.min_m??'',s.range?.max_m??'',s.z_depth?.min_m??'',s.z_depth?.max_m??'',p.reference_width_cm??'',p.reference_height_cm??'',true,...(p.pixel_bounds||['','','','']),batch.viewport_px[0],batch.viewport_px[1],batch.source_frame_index??''].join(',')))].join('\n');
}
export function patchSamplesCSV(batch){return['batch_id,region_id,region_label,sim_time_s,patch_id,u,v,range_m,z_depth_m,mesh_id,surface,world_x_m,world_y_m,world_z_m,source_frame_index,source_width_px,source_height_px,image_x_continuous_px,image_y_continuous_px',...(batch?.samples||[]).map(s=>[batch.id,s.region_id??batch.region_id??'',quote(s.region_label??batch.region_label),batch.sim_time_s,s.patch_id,s.u,s.v,s.range_m,s.z_depth_m,quote(s.mesh_id),quote(s.surface),...s.world_xyz_m,batch.source_frame_index??'',batch.viewport_px[0],batch.viewport_px[1],s.u*batch.viewport_px[0],s.v*batch.viewport_px[1]].join(','))].join('\n');}

export function regionPatchSelections(grid,polygon,ids=null){
 if(!Array.isArray(polygon)||polygon.length<3)return[];
 const poly=polygon.map(p=>new T.Vector2(...p)),triangles=T.ShapeUtils.triangulateShape(poly,[]),out=[];
 const clip=(points,axis,limit,greater)=>{const result=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],da=(a[axis]-limit)*(greater?1:-1),db=(b[axis]-limit)*(greater?1:-1);if(da>=-1e-12)result.push(a);if((da<0)!==(db<0)){const t=da/(da-db);result.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t])}}return result;};
 for(const cell of grid.cells){
  if(ids&&!ids.has(cell.id))continue;const pieces=[];
  for(const tri of triangles){let p=tri.map(i=>polygon[i]);for(const[axis,limit,greater]of [[0,cell.bounds[0],true],[0,cell.bounds[2],false],[1,cell.bounds[1],true],[1,cell.bounds[3],false]])p=clip(p,axis,limit,greater);
   const signed=p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+a[0]*b[1]-b[0]*a[1]},0);if(p.length>2&&Math.abs(signed)>1e-12)pieces.push(p);
  }
  if(pieces.length){const pts=pieces.flat(),rect=[Math.min(...pts.map(p=>p[0])),Math.min(...pts.map(p=>p[1])),Math.max(...pts.map(p=>p[0])),Math.max(...pts.map(p=>p[1]))];out.push({id:cell.id,full:false,rects:[rect],polygon});}
 }
 return out;
}
