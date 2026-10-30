// Both visible cameras observe the same simulation instant. Update directional
// shadow maps once for that instant, and reuse current object matrices for the
// second view and any capture. Neither geometry nor resolution is reduced.
export function renderDisplayFrame({renderer,scene,camera,robotCamera,robot,path,lidar,fov,botView=false,primaryViewport=null,preview,width,height,cameraMode=()=>{},capture=()=>{},matricesCurrent=false}){
 const auto=scene.autoUpdate,shadowAuto=renderer.shadowMap.autoUpdate,target=renderer.getRenderTarget(),infoAuto=renderer.info?.autoReset;
 if(!matricesCurrent)scene.updateMatrixWorld();scene.autoUpdate=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
 const objects=[path,lidar,fov,robot],visibility=objects.map(o=>o.visible);
 const cameraPass=fn=>{cameraMode(true);objects.forEach(o=>o.visible=false);try{fn()}finally{objects.forEach((o,i)=>o.visible=visibility[i]);cameraMode(false)}};
 try{
  if(renderer.info){renderer.info.autoReset=false;renderer.info.reset()}
  cameraPass(()=>{const aspect=robotCamera.aspect;try{capture()}finally{robotCamera.aspect=aspect;robotCamera.updateProjectionMatrix();if(renderer.getRenderTarget()!==target)renderer.setRenderTarget(target);renderer.setScissorTest(false);renderer.setViewport(0,0,width,height)}});
  const main=primaryViewport&&primaryViewport.width>0&&primaryViewport.height>0?primaryViewport:null;
  if(main){renderer.setScissorTest(false);renderer.setViewport(0,0,width,height);renderer.clear();renderer.setScissorTest(true);renderer.setViewport(main.left,height-main.bottom,main.width,main.height);renderer.setScissor(main.left,height-main.bottom,main.width,main.height)}
  if(botView)cameraPass(()=>{robotCamera.aspect=main?main.width/main.height:width/height;robotCamera.updateProjectionMatrix();renderer.render(scene,robotCamera)});else renderer.render(scene,camera);
  renderer.setScissorTest(false);renderer.setViewport(0,0,width,height);
  const r=preview();if(r&&r.width>0&&r.height>0)cameraPass(()=>{const w=Math.max(r.width,16),h=Math.max(r.height,9),y=height-r.bottom;renderer.setScissorTest(true);renderer.setViewport(r.left,y,w,h);renderer.setScissor(r.left,y,w,h);robotCamera.aspect=w/h;robotCamera.updateProjectionMatrix();renderer.render(scene,robotCamera);renderer.setScissorTest(false);renderer.setViewport(0,0,width,height);robotCamera.aspect=w/h;robotCamera.updateProjectionMatrix()});
 }finally{objects.forEach((o,i)=>o.visible=visibility[i]);if(renderer.getRenderTarget()!==target)renderer.setRenderTarget(target);renderer.setScissorTest(false);renderer.setViewport(0,0,width,height);renderer.shadowMap.autoUpdate=shadowAuto;if(renderer.info)renderer.info.autoReset=infoAuto;scene.autoUpdate=auto}
}
