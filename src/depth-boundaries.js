import * as T from 'three';
import {visibleInScene} from './depth-core.js';
import {SOURCE_RENDER_MASK} from './rigid-render-batches.js';

export function boundarySegments(ids,width,height,bounds=[0,0,1,1],allowed=null){
 const groups=new Map(),add=(id,x0,y0,x1,y1)=>{if(!id||allowed&&!allowed.has(id))return;let points=groups.get(id);if(!points){points=[];groups.set(id,points)}points.push(bounds[0]+x0/width*(bounds[2]-bounds[0]),bounds[1]+y0/height*(bounds[3]-bounds[1]),bounds[0]+x1/width*(bounds[2]-bounds[0]),bounds[1]+y1/height*(bounds[3]-bounds[1]));};
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const id=ids[y*width+x];if(!id)continue;if(!x||ids[y*width+x-1]!==id)add(id,x,y,x,y+1);if(x===width-1||ids[y*width+x+1]!==id)add(id,x+1,y,x+1,y+1);if(!y||ids[(y-1)*width+x]!==id)add(id,x,y,x+1,y);if(y===height-1||ids[(y+1)*width+x]!==id)add(id,x,y+1,x+1,y+1);}
 return groups;
}
export function boundaryPaths(segments){
 const edges=[],nodes=new Map(),key=(x,y)=>Math.round(x*1e9)+','+Math.round(y*1e9);
 for(let i=0;i<segments.length;i+=4){const a=key(segments[i],segments[i+1]),b=key(segments[i+2],segments[i+3]),edge={a,b,pa:[segments[i],segments[i+1]],pb:[segments[i+2],segments[i+3]],used:false};edges.push(edge);for(const n of [a,b]){if(!nodes.has(n))nodes.set(n,[]);nodes.get(n).push(edge);}}
 const paths=[];for(const first of edges){if(first.used)continue;let node=first.a,edge=first;const path=[first.pa];while(edge&&!edge.used){edge.used=true;const forward=edge.a===node;node=forward?edge.b:edge.a;path.push(forward?edge.pb:edge.pa);edge=nodes.get(node)?.find(e=>!e.used);}paths.push(path);}return paths;
}
export function reducedBoundaryPreview(source,maxEdge=256,targetIds=null){
 if(!source)return null;const scale=maxEdge>0?Math.min(1,maxEdge/Math.max(source.width,source.height)):1,w=Math.max(1,Math.round(source.width*scale)),h=Math.max(1,Math.round(source.height*scale)),ids=new Uint32Array(w*h),z=new Float32Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,j=Math.min(source.height-1,Math.floor((y+.5)/h*source.height))*source.width+Math.min(source.width-1,Math.floor((x+.5)/w*source.width));ids[i]=source.ids[j];z[i]=source.z[j];}
 const allowed=targetIds?new Set([...source.parts].filter(([,p])=>targetIds.includes(p.mesh_id)).map(([id])=>id)):null,segments=boundarySegments(ids,w,h,source.bounds,allowed),paths=new Map([...segments].map(([id,lines])=>[id,boundaryPaths(lines)]));return{...source,width:w,height:h,ids,z,segments,paths};
}
const vertex=`
 #include <common>
 #include <uv_pars_vertex>
 #include <morphtarget_pars_vertex>
 #include <skinning_pars_vertex>
 varying float maskZ;
 void main(){
 #include <uv_vertex>
 #include <skinbase_vertex>
 #include <begin_vertex>
 #include <morphtarget_vertex>
 #include <skinning_vertex>
 vec4 p=vec4(transformed,1.0);
 #ifdef USE_INSTANCING
 p=instanceMatrix*p;
 #endif
 vec4 mv=modelViewMatrix*p;maskZ=-mv.z;gl_Position=projectionMatrix*mv;
 }`;
const fragment=`
 precision highp float;
 #include <uv_pars_fragment>
 #ifdef USE_MAP
 uniform sampler2D map;
 #endif
 #ifdef USE_ALPHAMAP
 uniform sampler2D alphaMap;
 #endif
 uniform float partId;uniform float farZ;uniform float cutout;uniform float opacity;varying float maskZ;
 void main(){float alpha=opacity;
 #ifdef USE_MAP
 alpha*=texture2D(map,vUv).a;
 #endif
 #ifdef USE_ALPHAMAP
 alpha*=texture2D(alphaMap,vUv).g;
 #endif
 if(alpha<cutout)discard;
 float z=floor(clamp(maskZ/farZ,0.0,1.0)*65534.0+.5)+1.0;
 gl_FragColor=vec4(floor(partId/256.0),mod(partId,256.0),floor(z/256.0),mod(z,256.0))/255.0;
 }`;
export class DepthBoundaryRenderer{
 constructor(renderer,scene,{exclude=[]}={}){this.renderer=renderer;this.scene=scene;this.exclude=exclude;this.cache=new WeakMap();this.materials=new Set();this.partIds=new WeakMap();this.serial=0;this.renders=0;this.maskScene=new T.Scene();this.maskScene.autoUpdate=false;this.proxies=new WeakMap();this.active=[];}
 material(source,object){
  let variants=this.cache.get(source);if(!variants){variants=new Map();this.cache.set(source,variants)}
  const key=[!!object.isSkinnedMesh,object.skeleton?.bones.length||0,!!object.geometry.morphAttributes?.position?.length,!!object.isInstancedMesh].join(':');
  let m=variants.get(key);if(!m){m=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms:{partId:{value:0},farZ:{value:50},cutout:{value:0},opacity:{value:1},map:{value:null},alphaMap:{value:null},uvTransform:{value:new T.Matrix3()}},depthTest:true,depthWrite:true});m.skinning=!!object.isSkinnedMesh;m.morphTargets=!!object.geometry.morphAttributes?.position?.length;m.toneMapped=false;variants.set(key,m);this.materials.add(m)}
  m.visible=source.visible;m.side=source.side;m.map=source.map||null;m.alphaMap=source.alphaMap||null;m.uniforms.map.value=m.map;m.uniforms.alphaMap.value=m.alphaMap;
  const map=m.map||m.alphaMap;if(map){if(map.matrixAutoUpdate)map.updateMatrix();m.uniforms.uvTransform.value.copy(map.matrix)}
  m.uniforms.opacity.value=source.opacity??1;m.uniforms.cutout.value=Math.max(source.alphaTest||0,source.transparent?.05:.001);return m;
 }
 render(camera,sourceWidth,sourceHeight,{bounds=[0,0,1,1],maxEdge=384,targetIds=null,contours=true,pixelBounds=null}={}){
  const r=this.renderer,s=this.scene;if(!r?.readRenderTargetPixels||!r?.getRenderTarget)return null;
  const spanX=bounds[2]-bounds[0],spanY=bounds[3]-bounds[1];if(spanX<=0||spanY<=0)return null;
  const pixelW=pixelBounds?pixelBounds[2]-pixelBounds[0]:sourceWidth*spanX,pixelH=pixelBounds?pixelBounds[3]-pixelBounds[1]:sourceHeight*spanY,scale=maxEdge>0?Math.min(1,maxEdge/Math.max(pixelW,pixelH)):1,w=Math.max(1,Math.ceil(pixelW*scale)),h=Math.max(1,Math.ceil(pixelH*scale));
  const c=camera.clone();c.parent=null;c.matrixAutoUpdate=false;c.matrix.copy(camera.matrixWorld);c.matrixWorld.copy(camera.matrixWorld);c.matrixWorldInverse.copy(camera.matrixWorldInverse);
  const sx=1/spanX,sy=1/spanY,cx=bounds[0]+bounds[2]-1,cy=1-bounds[1]-bounds[3],crop=new T.Matrix4().set(sx,0,0,-cx*sx,0,sy,0,-cy*sy,0,0,1,0,0,0,0,1);
  c.projectionMatrix.multiplyMatrices(crop,camera.projectionMatrix);c.projectionMatrixInverse.copy(c.projectionMatrix).invert();c.layers.set(0);
  if(!this.target||this.target.width!==w||this.target.height!==h){this.target?.dispose();this.target=new T.WebGLRenderTarget(w,h,{minFilter:T.NearestFilter,magFilter:T.NearestFilter,depthBuffer:true,stencilBuffer:false});this.target.texture.encoding=T.LinearEncoding;this.target.texture.generateMipmaps=false;}
  const parts=new Map(),skipped=new Set();for(const object of this.exclude)object?.traverse(n=>skipped.add(n));
  const old={target:r.getRenderTarget(),viewport:r.getViewport(new T.Vector4()),scissor:r.getScissor(new T.Vector4()),scissorTest:r.getScissorTest(),clear:r.getClearColor(new T.Color()).clone(),alpha:r.getClearAlpha(),tone:r.toneMapping,encoding:r.outputEncoding,auto:r.autoClear,shadow:r.shadowMap.enabled};
  try{
   s.updateMatrixWorld();for(const proxy of this.active)proxy.visible=false;this.active=[];
   s.traverse(o=>{
    if(!o.isMesh||o.userData.renderProxy||skipped.has(o)||!visibleInScene(o)||(o.layers.mask&(1|SOURCE_RENDER_MASK))===0)return;
    const originals=Array.isArray(o.material)?o.material:[o.material];if(originals.every(m=>!m.visible||m.opacity<.03||m.depthWrite===false&&!m.alphaTest&&!o.userData.cameraSolid))return;
    let id=this.partIds.get(o);if(!id){id=++this.serial;if(id>65534)throw Error('Too many boundary parts');this.partIds.set(o,id)}
    let label=o.name||'Surface part';for(let p=o;p&&!p.isScene;p=p.parent)if(p.userData.label){label=String(p.userData.label);break;}
    parts.set(id,{id,mesh_id:o.uuid,geometry_id:o.geometry.uuid,label,matrix_world:o.matrixWorld.toArray()});
    let proxy=this.proxies.get(o);if(!proxy){proxy=o.isSkinnedMesh?new T.SkinnedMesh(o.geometry,o.material):o.isInstancedMesh?new T.InstancedMesh(o.geometry,o.material,o.count):new T.Mesh(o.geometry,o.material);proxy.userData={};proxy.matrixAutoUpdate=false;proxy.layers.set(0);this.proxies.set(o,proxy);this.maskScene.add(proxy);}
    proxy.visible=true;proxy.geometry=o.geometry;proxy.matrix.copy(o.matrixWorld);proxy.matrixWorld.copy(o.matrixWorld);proxy.frustumCulled=o.isSkinnedMesh?false:o.frustumCulled;
    if(o.isSkinnedMesh){proxy.skeleton=o.skeleton;proxy.bindMode=o.bindMode;proxy.bindMatrix.copy(o.bindMatrix);proxy.bindMatrixInverse.copy(o.bindMatrixInverse);}
    if(o.isInstancedMesh){proxy.instanceMatrix=o.instanceMatrix;proxy.instanceColor=o.instanceColor;proxy.count=o.count;}
    if(o.morphTargetInfluences)proxy.morphTargetInfluences=o.morphTargetInfluences;
    proxy.material=Array.isArray(o.material)?originals.map(m=>this.material(m,o)):this.material(o.material,o);
    proxy.onBeforeRender=(_r,_s,_c,_g,m)=>{m.uniforms.partId.value=id;m.uniforms.farZ.value=camera.far;m.uniformsNeedUpdate=true;};this.active.push(proxy);
   });
   r.toneMapping=T.NoToneMapping;r.outputEncoding=T.LinearEncoding;r.autoClear=true;r.shadowMap.enabled=false;r.setClearColor(0,0);r.setRenderTarget(this.target);r.setViewport(0,0,w,h);r.setScissorTest(false);
   const bytes=new Uint8Array(w*h*4);r.render(this.maskScene,c);r.readRenderTargetPixels(this.target,0,0,w,h,bytes);this.renders++;
   const ids=new Uint32Array(w*h),z=new Float32Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,j=((h-1-y)*w+x)*4;ids[i]=bytes[j]*256+bytes[j+1];const code=bytes[j+2]*256+bytes[j+3];z[i]=code?(code-1)*camera.far/65534:NaN;}
   const visibleIds=new Set(ids);for(const id of parts.keys())if(!visibleIds.has(id))parts.delete(id);
   const allowed=targetIds?new Set([...parts].filter(([,p])=>targetIds.includes(p.mesh_id)).map(([id])=>id)):null,segments=contours?boundarySegments(ids,w,h,bounds,allowed):new Map(),paths=new Map([...segments].map(([id,lines])=>[id,boundaryPaths(lines)]));
   return{width:w,height:h,bounds,ids,z,parts,segments,paths,far_z:camera.far,source_image_px:[sourceWidth,sourceHeight],camera_world_matrix:camera.matrixWorld.toArray(),projection_matrix:camera.projectionMatrix.toArray(),precision:'Preview raster contours; alpha cutouts evaluated. Preview Z is quantized to far/65534 metres and is not a training depth measurement.'};
  }finally{
   r.toneMapping=old.tone;r.outputEncoding=old.encoding;r.autoClear=old.auto;r.shadowMap.enabled=old.shadow;r.setClearColor(old.clear,old.alpha);r.setRenderTarget(old.target);r.setViewport(old.viewport);r.setScissor(old.scissor);r.setScissorTest(old.scissorTest);
  }
 }
 dispose(){this.target?.dispose();for(const material of this.materials)material.dispose();this.materials.clear();}
}
