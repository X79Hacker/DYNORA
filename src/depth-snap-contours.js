import {boundaryPaths} from './depth-boundaries.js';
import {insidePolygon} from './depth-core.js';
import {patchAt} from './depth-patch-core.js';

export function snapPixelBounds(polygon,width,height,halo=1){
 if(!polygon?.length)return null;
 let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const p of polygon){x0=Math.min(x0,p[0]*width);x1=Math.max(x1,p[0]*width);y0=Math.min(y0,p[1]*height);y1=Math.max(y1,p[1]*height);}
 const box=[Math.max(0,Math.floor(x0)-halo),Math.max(0,Math.floor(y0)-halo),Math.min(width,Math.ceil(x1)+halo),Math.min(height,Math.ceil(y1)+halo)];
 return box[2]>box[0]&&box[3]>box[1]?box:null;
}
function spans(polygon,y){const xs=[];for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[j],b=polygon[i];if((a[1]>y)!==(b[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}return xs.sort((a,b)=>a-b);}
const wait=()=>new Promise(r=>setTimeout(r,0));

// Consumes ONLY the native mask frozen at RGB acquisition. No later scene,
// camera, samples or UI settings are read. The preview lattice is never used.
export async function visibleSnapContours(mask,{polygon,scope='region',targetIds=null,grid=null,patchIds=null,depthEdges=true,budgetMs=4,yieldWork=wait}={}){
 const empty={paths:[],cells:[],status:'empty_visible_region',scope,precision:'Native source-pixel visible surfaces; no bounding-box fallback',native_image_px:mask?.source_image_px||null};
 if(!mask||!polygon?.length)return{...empty,status:polygon?'mask_unavailable':'outside_view'};
 const {width:w,height:h,ids,z,bounds,parts,source_image_px:[W,H]}=mask;
 const allowed=targetIds?new Set([...parts].filter(([,p])=>targetIds.includes(p.mesh_id)).map(([id])=>id)):new Set(parts.keys());
 const selected=patchIds?new Set(patchIds):null,clip=new Uint8Array(w*h),keep=new Uint8Array(w*h),cells=new Set(),xs=new Float64Array(w),ys=new Float64Array(h);
 const xy=(x,y)=>[bounds[0]+x/w*(bounds[2]-bounds[0]),bounds[1]+y/h*(bounds[3]-bounds[1])];
 for(let x=0;x<w;x++)xs[x]=bounds[0]+(x+.5)/w*(bounds[2]-bounds[0]);for(let y=0;y<h;y++)ys[y]=bounds[1]+(y+.5)/h*(bounds[3]-bounds[1]);
 const P=mask.projection_matrix,M=mask.camera_world_matrix,A=M[1]/P[0],B=M[5]/P[5],C=A*P[8]+B*P[9]-M[9];
 const worldY=(i,x,y)=>z[i]*(A*(2*xs[x]-1)+B*(1-2*ys[y])+C)+M[13];
 let top=-Infinity,since=performance.now();
 for(let y=0;y<h;y++){const xx=spans(polygon,ys[y]);let span=0;for(let x=0;x<w;x++){while(span+1<xx.length&&xs[x]>xx[span+1])span+=2;const i=y*w+x;clip[i]=span+1<xx.length&&xs[x]>=xx[span]&&xs[x]<=xx[span+1]?1:0;if(scope==='object'&&clip[i]&&allowed.has(ids[i])&&Number.isFinite(z[i]))top=Math.max(top,worldY(i,x,y));}if(performance.now()-since>budgetMs){await yieldWork();since=performance.now();}}
 if(scope==='object'&&!Number.isFinite(top))return empty;
 const topTolerance=Number.isFinite(mask.far_z)?mask.far_z/65534*2:.001;
 for(let y=0;y<h;y++){for(let x=0;x<w;x++){const i=y*w+x;if(!allowed.has(ids[i])||scope==='region'&&!clip[i]||scope==='object'&&worldY(i,x,y)>top+topTolerance)continue;const cell=grid?patchAt(grid,xs[x],ys[y]):null;if(selected&&(!cell||!selected.has(cell.id)))continue;keep[i]=1;if(cell)cells.add(cell.id);}if(performance.now()-since>budgetMs){await yieldWork();since=performance.now();}}
 const edges=[],line=(x0,y0,x1,y1)=>edges.push(...xy(x0,y0),...xy(x1,y1));
 const jump=(a,b,before,after)=>{if(!depthEdges||!Number.isFinite(z[a])||!Number.isFinite(z[b]))return false;const d=Math.abs(z[a]-z[b]),base=Math.max(.003,Math.min(z[a],z[b])*.01),slope=Math.max(before>=0&&ids[before]===ids[a]?Math.abs(z[a]-z[before]):0,after>=0&&ids[after]===ids[b]?Math.abs(z[b]-z[after]):0);return d>Math.max(base,4*slope);};
 for(let y=0;y<h;y++){for(let x=0;x<w;x++){const i=y*w+x;if(!keep[i])continue;
  // Image/ROI clipping is not an object edge. Compare original IDs before
  // selection clipping, keep open ends open, and never close across the view.
  if(x>0&&ids[i-1]!==ids[i])line(x,y,x,y+1);
  if(x<w-1&&ids[i+1]!==ids[i])line(x+1,y,x+1,y+1);
  if(y>0&&ids[i-w]!==ids[i])line(x,y,x+1,y);
  if(y<h-1&&ids[i+w]!==ids[i])line(x,y+1,x+1,y+1);
  if(x<w-1&&keep[i+1]&&ids[i+1]===ids[i]&&jump(i,i+1,x>0?i-1:-1,x+2<w?i+2:-1))line(x+1,y,x+1,y+1);
  if(y<h-1&&keep[i+w]&&ids[i+w]===ids[i]&&jump(i,i+w,y>0?i-w:-1,y+2<h?i+2*w:-1))line(x,y+1,x+1,y+1);
 }if(performance.now()-since>budgetMs){await yieldWork();since=performance.now();}}
 // Shared part edges occur twice; remove duplicates before path stitching.
 const unique=new Map();for(let i=0;i<edges.length;i+=4){const a=edges.slice(i,i+2),b=edges.slice(i+2,i+4),ka=a.map(v=>Math.round(v*1e9)).join(','),kb=b.map(v=>Math.round(v*1e9)).join(',');unique.set(ka<kb?ka+':'+kb:kb+':'+ka,[...a,...b]);}
 const paths=boundaryPaths([...unique.values()].flat()).filter(p=>p.length>1);
 return{...empty,paths,cells:[...cells].sort((a,b)=>a-b),status:paths.length?'complete':keep.some(v=>v)?'visible_surface_without_in_frame_edges':'empty_visible_region',source_image_px:[W,H],native_mask_px:[w,h],native_bounds:bounds,source:'same-frame native object-ID/depth pass',top_y_m:Number.isFinite(top)?top:null,top_precision_m:topTolerance,depth_edges:depthEdges,artificial_crop_edges:false,segments:unique.size};
}

// A few native pixels choose the visible mesh behind a drawn region; this is
// independent of the sparse depth sampling pattern and cannot follow a new pose.
export function dominantSnapPart(mask,polygon){
 if(!mask||!polygon?.length)return null;const box=snapPixelBounds(polygon,mask.width,mask.height,0);if(!box)return null;const votes=new Map(),step=Math.max(1,Math.ceil(Math.sqrt((box[2]-box[0])*(box[3]-box[1])/1024)));
 for(let y=box[1];y<box[3];y+=step)for(let x=box[0];x<box[2];x+=step){const u=(x+.5)/mask.width,v=(y+.5)/mask.height;if(!insidePolygon(u,v,polygon))continue;const id=mask.ids[y*mask.width+x];if(id)votes.set(id,(votes.get(id)||0)+1);}
 const best=[...votes].sort((a,b)=>b[1]-a[1])[0];return best?mask.parts.get(best[0])?.mesh_id||null:null;
}
