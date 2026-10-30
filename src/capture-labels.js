import * as T from 'three';
export function npy(array,shape){const types=new Map([[Float32Array,'<f4'],[Uint32Array,'<u4'],[Uint8Array,'|u1']]),descr=types.get(array.constructor);if(!descr||shape.reduce((a,b)=>a*b,1)!==array.length)throw Error('Unsupported NumPy shape/type');let header=`{'descr': '${descr}', 'fortran_order': False, 'shape': (${shape.join(', ')}${shape.length===1?',':''}), }`;header+=' '.repeat((16-(10+header.length+1)%16)%16)+'\n';const out=new Uint8Array(10+header.length+array.byteLength);out.set([147,78,85,77,80,89,1,0,header.length&255,header.length>>8]);out.set(new TextEncoder().encode(header),10);out.set(new Uint8Array(array.buffer,array.byteOffset,array.byteLength),10+header.length);return out}
export function decodeLabelPixels(depth,ids,w,h,far){const z=new Float32Array(w*h),instance=new Uint32Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x),j=((h-1-y)*w+x)*4,code=depth[j]*65536+depth[j+1]*256+depth[j+2];z[i]=code?(code-1)*far/16777214:NaN;instance[i]=ids[j]*65536+ids[j+1]*256+ids[j+2]}return{z,instance}}
export function radialDepth(z,w,h,cam){return Float32Array.from(z,(v,i)=>v*Math.hypot((i%w+.5-cam.cx)/cam.fx,(Math.floor(i/w)+.5-cam.cy)/cam.fy,1))}
const vertex=`
 #include <common>
 #include <morphtarget_pars_vertex>
 #include <skinning_pars_vertex>
 varying float cameraZ;
 void main(){
 #include <skinbase_vertex>
 #include <begin_vertex>
 #include <morphtarget_vertex>
 #include <skinning_vertex>
 vec4 p=vec4(transformed,1.0);
 #ifdef USE_INSTANCING
 p=instanceMatrix*p;
 #endif
 vec4 mv=modelViewMatrix*p;cameraZ=-mv.z;gl_Position=projectionMatrix*mv;
 }`;
const fragment=`precision highp float;uniform float farZ;uniform float instanceId;uniform float mode;varying float cameraZ;void main(){float q=mode>0.5?instanceId:floor(clamp(cameraZ/farZ,0.0,1.0)*16777214.0+0.5)+1.0;vec3 bytes=vec3(floor(q/65536.0),floor(mod(q,65536.0)/256.0),mod(q,256.0));gl_FragColor=vec4(bytes/255.0,1.0);}`;
export class GroundTruthCapture{
 constructor(renderer,scene,camera,robot,{maxBytes=96*1024*1024}={}){Object.assign(this,{renderer,scene,camera,robot,maxBytes});this.enabled=false;this.range=false;this.files=[];this.bytes=0;this.frames=0;this.dropped=0;this.errors=[];this.instances=new Map();this.ownerIds=new WeakMap();this.materials=new Map()}
 material(o){const morph=!!o.geometry.morphAttributes?.position?.length,key=[!!o.isSkinnedMesh,o.skeleton?.bones.length||0,morph,!!o.isInstancedMesh].join(':');if(!this.materials.has(key)){const m=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms:{farZ:{value:this.camera.far},instanceId:{value:0},mode:{value:0}},side:T.DoubleSide,depthTest:true,depthWrite:true});m.skinning=!!o.isSkinnedMesh;m.morphTargets=morph;m.toneMapped=false;this.materials.set(key,m)}return this.materials.get(key)}
 owner(o){let root=o;for(let p=o;p&&!p.isScene;p=p.parent)if(p.userData.label||p.userData.human||p.userData.visualAsset)root=p;let id=this.ownerIds.get(root);if(!id){id=this.instances.size+1;this.ownerIds.set(root,id);this.instances.set(id,{id,label:String(root.userData.label||root.name||root.type),uuid:root.uuid})}return id}
 capture(name,w,h,metadata){if(!this.enabled||!name)return;const estimate=w*h*(this.range?12:8);if(this.bytes+estimate>this.maxBytes){this.dropped++;return}try{const {z,instance}=this.render(w,h),stem=name.replace(/^images\//,'').replace(/\.[^.]+$/,''),prefix='ground_truth/'+stem,files=[[prefix+'_z_m.npy',npy(z,[h,w])],[prefix+'_instance.npy',npy(instance,[h,w])]];if(this.range)files.push([prefix+'_range_m.npy',npy(radialDepth(z,w,h,metadata),[h,w])]);files.push([prefix+'_camera.json',JSON.stringify(metadata)]);for(const[n,b]of files){this.bytes+=typeof b==='string'?b.length*2:b.byteLength;this.files.push([n,b])}this.frames++}catch(e){this.dropped++;if(this.errors.length<10)this.errors.push(e.message)}}
 render(w,h){
 const {renderer:r,scene:s,camera:c}=this,old={target:r.getRenderTarget(),viewport:r.getViewport(new T.Vector4()),scissor:r.getScissor(new T.Vector4()),scissorTest:r.getScissorTest(),clear:r.getClearColor(new T.Color()).clone(),alpha:r.getClearAlpha(),background:s.background,override:s.overrideMaterial,tone:r.toneMapping,encoding:r.outputEncoding,auto:r.autoClear,shadow:r.shadowMap.enabled,aspect:c.aspect,layer:c.layers.mask},saved=[];
 if(!this.target||this.target.width!==w||this.target.height!==h){this.target?.dispose();this.target=new T.WebGLRenderTarget(w,h,{minFilter:T.NearestFilter,magFilter:T.NearestFilter,format:T.RGBAFormat,type:T.UnsignedByteType,depthBuffer:true,stencilBuffer:false});this.target.texture.encoding=T.LinearEncoding;this.target.texture.generateMipmaps=false}
 try{
 s.overrideMaterial=null;s.background=null;r.toneMapping=T.NoToneMapping;r.outputEncoding=T.LinearEncoding;r.autoClear=true;r.shadowMap.enabled=false;r.setClearColor(0,0);r.setRenderTarget(this.target);r.setScissorTest(false);r.setViewport(0,0,w,h);c.aspect=w/h;c.layers.set(0);c.updateProjectionMatrix();
 s.traverse(o=>{const record={o,visible:o.visible,layer:o.layers.mask,material:o.material,before:o.onBeforeRender};saved.push(record);let auxiliary=o===this.robot;for(let p=o;p&&!p.isScene;p=p.parent)if(p===this.robot||p.userData.renderProxy||p.userData.editorAuxiliary||p.userData.noDepth)auxiliary=true;
  if(auxiliary||o.isLine||o.isPoints||o.isSprite){o.visible=false;return}if(!o.isMesh)return;
  // Source geometry hidden from normal passes by batching lives on layer 2.
  if(o.layers.mask&4)o.layers.enable(0);const m=this.material(o),id=this.owner(o);o.material=m;o.onBeforeRender=()=>{m.uniforms.farZ.value=c.far;m.uniforms.instanceId.value=id;m.uniformsNeedUpdate=true};
 });
 const depth=new Uint8Array(w*h*4),ids=new Uint8Array(w*h*4);for(const m of this.materials.values())m.uniforms.mode.value=0;r.render(s,c);r.readRenderTargetPixels(this.target,0,0,w,h,depth);for(const m of this.materials.values())m.uniforms.mode.value=1;r.render(s,c);r.readRenderTargetPixels(this.target,0,0,w,h,ids);return decodeLabelPixels(depth,ids,w,h,c.far);
 }finally{for(const a of saved){a.o.visible=a.visible;a.o.layers.mask=a.layer;if(a.material)a.o.material=a.material;a.o.onBeforeRender=a.before}s.background=old.background;s.overrideMaterial=old.override;r.toneMapping=old.tone;r.outputEncoding=old.encoding;r.autoClear=old.auto;r.shadowMap.enabled=old.shadow;r.setClearColor(old.clear,old.alpha);r.setRenderTarget(old.target);r.setViewport(old.viewport);r.setScissor(old.scissor);r.setScissorTest(old.scissorTest);c.aspect=old.aspect;c.layers.mask=old.layer;c.updateProjectionMatrix()}
 }
 metadata(){return{enabled:this.enabled,frames:this.frames,dropped_frames:this.dropped,bytes:this.bytes,cap_bytes:this.maxBytes,errors:this.errors,format:'NumPy v1: float32 metric optical-Z (NaN background), uint32 instance ID (0 background), optional float32 radial range',limits:'First geometric triangle surface, including transparent surfaces. Alpha cutouts are not evaluated. No labels for distorted, frame-blended or injected frozen RGB frames.'}}
 extras(){return[...this.files,['ground_truth/instances.json',JSON.stringify([...this.instances.values()])],['ground_truth/metadata.json',JSON.stringify(this.metadata())]]}
 clear(){this.files=[];this.bytes=0;this.frames=0;this.dropped=0;this.errors=[];this.instances.clear();this.ownerIds=new WeakMap()}
}
