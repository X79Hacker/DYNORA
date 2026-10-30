import {distortPoint} from './camera-model.js';
export const snapName=image=>'snaps/'+image.replace(/^images\//,'').replace(/[^a-zA-Z0-9_./-]/g,'_').replace(/\.[a-zA-Z0-9]+$/,'')+'.png';
export const SNAP_DEFAULTS={background:'#ffffff',grid:'#8ca5b4',outline:'#000000',showGrid:false,showOutline:true,scope:'region',geometry:'selection',dashed:true,showSelection:false,lineWidth:1,depthEdges:false,clipPatches:false};
export const validColor=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
export function snapOptions(value={}){const s={...SNAP_DEFAULTS,...value};for(const k of ['background','grid','outline'])if(!validColor(s[k]))throw Error('Snap '+k+' must be a #rrggbb colour');for(const k of ['showGrid','showOutline','dashed','showSelection','depthEdges','clipPatches'])if(typeof s[k]!=='boolean')throw Error('Snap '+k+' must be true or false');if(!['object','region'].includes(s.scope)||!['surface','selection'].includes(s.geometry)||![1,2,3,4].includes(Number(s.lineWidth)))throw Error('Invalid snap scope, geometry or line width');s.lineWidth=Number(s.lineWidth);return s;}
export function snapPoint(p,width,height,camera={}){const D=camera.D||[];if(!D.some(v=>v))return[p[0]*width,p[1]*height];const a=distortPoint((p[0]*width-camera.cx)/camera.fx,(p[1]*height-camera.cy)/camera.fy,{k1:D[0]||0,k2:D[1]||0,p1:D[2]||0,p2:D[3]||0});return[a[0]*camera.fx+camera.cx,a[1]*camera.fy+camera.cy];}
export function snapPath(ctx,points,W,H,camera={},forceClosed=false){if(!points?.length)return;const [x,y]=snapPoint(points[0],W,H,camera);ctx.moveTo(x,y);for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],D=camera.D||[],n=D.some(v=>v)?Math.max(1,Math.ceil(Math.hypot((a[0]-b[0])*W,(a[1]-b[1])*H)/4)):1;for(let k=1;k<=n;k++)ctx.lineTo(...snapPoint([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n],W,H,camera));}const a=points[0],b=points.at(-1);if(forceClosed||Math.hypot(a[0]-b[0],a[1]-b[1])<1e-8)ctx.closePath();}
export function snapSelectionPaths(reading){if(reading.selection_outline)return reading.selection_outline.paths;const p=reading.projected_region_polygon;return p?.length>2?[[...p,p[0]]]:[];}
export function drawDepthSnap(ctx,reading,{width,height,...options}){
 const o=snapOptions(options),camera=reading.snap_camera||{};ctx.fillStyle=o.background;ctx.fillRect(0,0,width,height);
 const contours=reading.snap_contours,legacy=o.scope==='object'&&reading.snap_object?.cells_px?.length?reading.snap_object:null,cells=contours?.cells_px||legacy?.cells_px||(reading.patches||[]).map(p=>p.pixel_bounds);
 if(o.showGrid){ctx.strokeStyle=o.grid;ctx.lineWidth=Math.max(.5,o.lineWidth*.5);if(!camera.D?.some(v=>v)){for(const[x0,y0,x1,y1]of cells)ctx.strokeRect(x0+.5,y0+.5,x1-x0-1,y1-y0-1);}else{ctx.beginPath();for(const[x0,y0,x1,y1]of cells)snapPath(ctx,[[x0/width,y0/height],[x1/width,y0/height],[x1/width,y1/height],[x0/width,y1/height]],width,height,camera,true);ctx.stroke();}}
 if(o.showOutline){let paths=o.geometry==='selection'?snapSelectionPaths(reading):contours?.paths;
  // Old readings remain readable, but new surface captures NEVER fall back to
  // a projected box or the selection rectangle when a contour is unavailable.
  if(!contours&&o.geometry==='surface')paths=legacy?.outline||[reading.projected_region_polygon].filter(p=>p?.length>2);
  if(paths?.length){ctx.beginPath();for(const points of paths)snapPath(ctx,points,width,height,camera,o.geometry==='surface'&&!contours);ctx.strokeStyle=o.outline;ctx.lineWidth=o.lineWidth;ctx.lineJoin='round';ctx.setLineDash(o.dashed?[6,4]:[]);ctx.stroke();ctx.setLineDash([]);}
 }
 if(o.showSelection&&o.geometry!=='selection'){ctx.beginPath();for(const points of snapSelectionPaths(reading))snapPath(ctx,points,width,height,camera);ctx.strokeStyle=o.outline;ctx.lineWidth=o.lineWidth;ctx.setLineDash([6,4]);ctx.stroke();ctx.setLineDash([]);}
}
export function depthSnapPNG(reading,options){const canvas=document.createElement('canvas');canvas.width=options.width;canvas.height=options.height;drawDepthSnap(canvas.getContext('2d'),reading,options);return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Snap image encoding failed')),'image/png'));}
