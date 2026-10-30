import {boundaryPaths} from './depth-boundaries.js';
// All rays use the SAME frozen query as the RGB-linked patch batch. Visibility
// never reads the current display camera after asynchronous work has started.
export async function visibleSelectionOutline(query,camera,region,outline,{width=640,height=480,stepPx=4,maxSamples=512,budgetMs=3,cache=new Map(),yieldWork=()=>new Promise(r=>setTimeout(r,0)),cancelled=()=>false}={}){
 const segments=outline._depth_segments||[];if(!region?.follow||!segments.length)return outline;
 const total=segments.reduce((n,s)=>n+Math.hypot((s.uv[2]-s.uv[0])*width,(s.uv[3]-s.uv[1])*height),0),spacing=Math.max(stepPx,total/maxSamples),lines=[],parts=new Map();let checked=0,hidden=0,since=performance.now();
 for(const part of region.surface_parts||[])parts.set(part.mesh_id,{...part,boundary:[]});
 const at=(s,t)=>[s.uv[0]+(s.uv[2]-s.uv[0])*t,s.uv[1]+(s.uv[3]-s.uv[1])*t];
 const visible=(s,t)=>{const [u,v]=at(s,t),key=Math.round(u*1e8)+','+Math.round(v*1e8);let hit;if(cache.has(key))hit=cache.get(key);else{hit=query.point(camera,Math.max(0,Math.min(1,u)),Math.max(0,Math.min(1,v)));cache.set(key,hit);checked++;}const expected=1/((1-t)/s.za+t/s.zb);return !hit||hit.z_depth_m>=expected-Math.max(.0015,expected*.0003);};
 const local=(s,t)=>{const f=t*s.za/(s.zb*(1-t)+t*s.za);return s.a.map((v,i)=>v+(s.b[i]-v)*f);};
 const add=(s,a,b)=>{if(b-a<1e-10)return;lines.push(...at(s,a),...at(s,b));let part=parts.get(s.part.mesh_id);if(!part){part={...s.part,boundary:[]};parts.set(s.part.mesh_id,part);}part.boundary.push(...local(s,a),...local(s,b));};
 for(const s of segments){if(cancelled())throw new DOMException('Selection superseded','AbortError');const n=Math.max(1,Math.ceil(Math.hypot((s.uv[2]-s.uv[0])*width,(s.uv[3]-s.uv[1])*height)/spacing));let previous=visible(s,0),start=previous?0:null;
  for(let i=1;i<=n;i++){const t=i/n,state=visible(s,t);if(state!==previous){let lo=(i-1)/n,hi=t;for(let k=0;k<6;k++){const mid=(lo+hi)/2;if(visible(s,mid)===previous)lo=mid;else hi=mid;}const edge=(lo+hi)/2;if(previous){add(s,start,edge);start=null;}else start=edge;}if(!state)hidden++;previous=state;
   if(performance.now()-since>budgetMs){await yieldWork();since=performance.now();if(cancelled())throw new DOMException('Selection superseded','AbortError');}
  }if(previous)add(s,start,1);
 }
 const paths=boundaryPaths(lines),result={...outline,paths,segments:lines.length/4,status:!paths.length&&outline.paths.length?'occluded':hidden?'partially_occluded':outline.status,visibility:{method:'First visible triangle optical depth vs projected selected surface depth',checked_rays:checked,spacing_px:spacing,transition_refinement_steps:6}};
 Object.defineProperty(result,'visible_parts',{value:[...parts.values()]});return result;
}
