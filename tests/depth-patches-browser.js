// Real WebGL and the production depth UI. This test-only observation object
// is not imported by the simulator and does not replace physics or raycasts.
import * as T from 'three';
import {initDepthTool} from '../src/depth-tool.js';
import {DepthSnapshot} from '../src/depth-core.js';
const scene=new T.Scene();scene.background=new T.Color(0x102735);
const camera=new T.PerspectiveCamera(65,1,.01,50);camera.position.set(0,1,0);camera.updateMatrixWorld(true);
const renderer=new T.WebGLRenderer({antialias:false,preserveDrawingBuffer:false});renderer.setPixelRatio(1);document.body.append(renderer.domElement);
const material=color=>new T.MeshBasicMaterial({color});
const wall=new T.Mesh(new T.PlaneGeometry(30,20),material(0x365d73));wall.position.set(0,1,-6);wall.userData.label='Wall';scene.add(wall);
const sphere=new T.Mesh(new T.SphereGeometry(.7,48,32),material(0x31c9a6));sphere.position.set(-.65,1,-3);sphere.userData.label='Curved surface';scene.add(sphere);
const leg=new T.Mesh(new T.BoxGeometry(.15,1.5,.15),material(0xe8ad6e));leg.position.set(.55,.75,-2.6);leg.userData.label='Table leg';scene.add(leg);
const rgba=new Uint8Array(64*64*4);for(let y=0;y<64;y++)for(let x=0;x<64;x++){const i=(y*64+x)*4;rgba.set([90,240,110,((x-31.5)/22)**2+((y-31.5)/29)**2<=1?255:0],i);}const leafTexture=new T.DataTexture(rgba,64,64,T.RGBAFormat);leafTexture.magFilter=T.NearestFilter;leafTexture.minFilter=T.NearestFilter;leafTexture.needsUpdate=true;const leaf=new T.Mesh(new T.PlaneGeometry(.6,.7),new T.MeshBasicMaterial({map:leafTexture,alphaTest:.5,transparent:true,depthWrite:false,side:T.DoubleSide}));leaf.position.set(1.2,1.4,-3.2);leaf.userData.label='Leaf cutout';scene.add(leaf);
const blocker=new T.Mesh(new T.BoxGeometry(2.5,3,.1),material(0xd96b72));blocker.position.set(0,1,-1.5);blocker.userData.label='Occluder';
const stats={frames:0,rays:0,feed_probe_checks:0,feed_probe_failures:0,frame_ms:[],last:performance.now()},point=DepthSnapshot.prototype.point;
DepthSnapshot.prototype.point=function(...args){stats.rays++;return point.apply(this,args)};
const depth=initDepthTool({scene,camera,renderer,clock:()=>stats.frames/60});
document.getElementById('bCam').onclick=e=>e.currentTarget.classList.toggle('on');document.getElementById('bPause').onclick=e=>e.currentTarget.classList.toggle('on');document.getElementById('bIso').onclick=()=>{};
document.getElementById('qaMove').onclick=()=>{camera.position.z-=.25;camera.updateMatrixWorld(true)};
document.getElementById('qaOcclude').onclick=()=>{blocker.parent?scene.remove(blocker):scene.add(blocker)};
window.PATCH_QA={sourceState:()=>scene.children.filter(o=>o.isMesh).map(o=>[o.uuid,o.material.uuid,o.visible,o.layers.mask]),metadata:()=>depth.metadata(),files:()=>depth.files(),stats,camera,scene};
let size='';function frame(){const now=performance.now();stats.frame_ms.push(now-stats.last);stats.last=now;if(stats.frame_ms.length>600)stats.frame_ms.shift();depth.beginFrame();depth.update();const r=depth.cameraViewport(),key=innerWidth+','+innerHeight;if(size!==key){size=key;renderer.setSize(innerWidth,innerHeight)}renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);renderer.clear();if(r){renderer.setViewport(r.left,innerHeight-r.bottom,r.width,r.height);renderer.setScissor(r.left,innerHeight-r.bottom,r.width,r.height);renderer.setScissorTest(true);camera.aspect=r.width/r.height;}else camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.render(scene,camera);if(r&&stats.frames%10===0){const gl=renderer.getContext(),pixel=new Uint8Array(4);gl.readPixels(Math.floor(r.left+r.width*.1),Math.floor(innerHeight-r.top-r.height*.2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);stats.feed_probe_checks++;if(pixel[0]+pixel[1]+pixel[2]<3)stats.feed_probe_failures++;}renderer.setScissorTest(false);if(++stats.frames%15===0)document.getElementById('qaInfo').textContent=stats.frames+' rendered frames · '+stats.rays+' measured rays';requestAnimationFrame(frame)}frame();
