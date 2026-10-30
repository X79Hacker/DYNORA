import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {makeHuman} from '../src/human.js';
import {populateRoverVisual} from '../src/visual-models.js';
import {SensorRayIndex} from '../src/sensor-ray-index.js';
import {DEFAULTS} from '../src/dynamics.js';
import {FrameProfiler} from '../src/frame-budget.js';
import {createFurniture} from '../src/visual-models.js';
import {measureObject,setDimensions,physicalUV,GRAPHICS_PRESETS} from '../src/visual-core.js';

// Runs the actual apartment construction sections with a canvas drawing stub.
// Geometry, posed people, transforms and PBR roles are real. No GPU/DOM timing.
function createRover(scene,p){const robot=new THREE.Group(),visual=new THREE.Group(),wheels=[];robot.add(visual);scene.add(robot);populateRoverVisual(visual,p,wheels);const rcam=new THREE.PerspectiveCamera(70,1.6,.0015,35),fov=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial());rcam.rotation.y=-Math.PI/2;rcam.position.set(.133,p.radius+.0680894+.037,0);robot.add(rcam,fov);return{robot,visual,wheels,rcam,fov};}
export async function apartmentCPUFixture({legacyShadows=false}={}) {
  const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  const visual = await readFile(new URL('../src/visual-studio.js', import.meta.url), 'utf8');
  const noop = () => {};
  const context = new Proxy({}, {get: (_, name) => name.startsWith('create') ? () => ({addColorStop: noop}) : noop, set: () => true});
  const canvas = () => ({width: 1, height: 1, getContext: () => context});
  const document = {createElement: canvas, body: {prepend: noop}};
  class Renderer {constructor(){this.shadowMap={};this.domElement=canvas()}setSize(){}setPixelRatio(){}}
  class PMREM {fromScene(){return {texture:new THREE.Texture()}}}
  let seed=42;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const a=source.slice(source.indexOf('const dark=true;'),source.indexOf('// orbit camera'));
  const b=source.slice(source.indexOf('// ================= extra realism'),source.indexOf('// ===== controllable human'));
  const c=source.slice(source.indexOf('const HSPAWN='),source.indexOf('let humanOn='));
  const d=source.slice(source.indexOf('// soft contact shadows'),source.indexOf('// ===== manual robot'));
  const body=a+'\nconst fixed=[P,cart,door,...FIXED0];\n'+b+'\n'+c+'\n'+d+`\n
    [[tb,'dining table'],[sf,'sofa'],[ct,'coffee table'],[sh,'bookshelf'],[cb,'cardboard box'],[bn,'dustbin'],[b2,'small bin'],[pl,'potted plant'],[tv,'TV unit'],[dk,'desk'],[cr,'wooden crate'],[cbx,'small box'],[sb,'bin'],[cart,'trolley'],[door,'sliding glass door'],[zl,'floor lamp'],[zd,'door frame']].forEach(([g,l])=>g.userData.label=l);
    CURT.forEach(pair=>pair.forEach(m=>m.userData.noBatch=true));
    return {scene,obstacles,MOV,fixed,P,cart,door,floor,grid,rover,HP,HD,hg};`;
  const scope=new Function('THREE','document','devicePixelRatio','innerWidth','innerHeight','addEventListener','makeHuman','createRover','DEFAULTS','RoundedBoxGeometry','FrameProfiler','SensorRayIndex','random',body);
  const f=scope({...THREE,WebGLRenderer:Renderer,PMREMGenerator:PMREM},document,1,1280,720,noop,makeHuman,createRover,DEFAULTS,RoundedBoxGeometry,FrameProfiler,SensorRayIndex,random);
  const materials=new Map();
  const manifest=JSON.parse(await readFile(new URL('../public/visual/materials.json',import.meta.url),'utf8'));
  for(const spec of manifest.materials)materials.set(spec.id,{repeat_m:spec.repeat_m||1,normalScale:spec.normalScale||.45,...Object.fromEntries(['color','normal','roughness','metalness'].filter(k=>spec[k]).map(k=>[k,new THREE.Texture()]))});
  const styling=visual.slice(visual.indexOf('const materialStyles='),visual.indexOf('async function loadMaterials'));
  const upgrade=visual.slice(visual.indexOf('function upgradeFurniture'),visual.indexOf('async function parseGLB'));
  new Function('THREE','scene','obstacles','floor','env','materials','normalMaps','config','GRAPHICS_PRESETS','physicalUV','createFurniture','setDimensions','measureObject','enableAnimatedCulling',styling+'\n'+upgrade+'\nupgradeFurniture();style(scene);')
    (THREE,f.scene,f.obstacles,f.floor,'apartment',materials,new WeakMap(),{preset:'balanced',environment:1},GRAPHICS_PRESETS,physicalUV,createFurniture,setDimensions,measureObject,noop);
  if(legacyShadows)f.scene.traverse(o=>{if(o.userData.contactShadow){delete o.userData.noContact;delete o.userData.noDepth;delete o.userData.editorAuxiliary}});
  f.scene.updateMatrixWorld(true);
  f.layout=f.MOV.filter(o=>![f.P,f.cart,f.door].includes(o)&&!(()=>{let human=false;o.traverse(n=>{if(n.userData.human)human=true});return human})());
  f.movable=f.MOV.filter(o=>!f.fixed.includes(o));
  return f;
}
