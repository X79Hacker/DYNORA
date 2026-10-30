import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {SkeletonUtils} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {createHumanRig} from './human-rig.js';

const templates = new Map();
let ready;
export const HUMAN_CATALOG = Object.freeze([
  {id:'human-sam', name:'Sam · realistic person', category:'People', human:'sam', height:1.79, mass:75},
  {id:'human-maya', name:'Maya · realistic person', category:'People', human:'maya', height:1.67, mass:62},
  {id:'human-sam-walk', name:'Sam · person with walking controls', category:'People', human:'sam', pose:'walk', height:1.79, mass:75},
  {id:'human-maya-walk', name:'Maya · person with walking controls', category:'People', human:'maya', pose:'walk', height:1.67, mass:62},
  {id:'human-seated', name:'Sam · person for seat actions', category:'People', human:'sam', pose:'sit', height:1.79, mass:75},
  {id:'human-researcher', name:'Laboratory researcher · detailed figure', category:'People',
    url:'humans/researcher.glb', height:1.79, mass:75, builtin:false}
]);

export function prepareHumans({loader=new GLTFLoader(),baseURL=new URL('visual/humans/',document.baseURI).href}={}) {
  if (!ready) ready = Promise.all(['sam','maya'].map(async id => {
    const gltf = await loader.loadAsync(new URL(id+'.glb',baseURL).href);
    templates.set(id, gltf);
  })).then(() => true);
  return ready;
}

// Each instance owns its bones, joint controller and materials. Geometry and
// immutable textures are shared, keeping several walkers practical on a laptop.
export function createRealisticHuman(options = {}) {
  const id = options.character || (options.female ? 'maya' : 'sam');
  const template = templates.get(id);
  if (!template) return null;
  const model = SkeletonUtils.clone(template.scene);
  const g = new THREE.Group(), facing = new THREE.Group();
  g.userData.human = true;
  g.userData.humanSource = 'CC0 MakeHuman / MPFB character by Innerscene';
  facing.rotation.y = Math.PI/2; // source +Z forward -> rover-world +X forward
  facing.add(model); g.add(facing);
  const meshes = [], materials = new Map();
  let shirt = null, pants = null;
  model.traverse(o => {
    if (!o.isMesh) return;
    meshes.push(o);
    const own = m => {
      if (!materials.has(m)) materials.set(m,m.clone());
      const clone = materials.get(m);
      clone.userData.surface = /body|eyebrow|teeth|lash/.test(m.name) ? 'skin' : 'fabric';
      clone.userData.humanMaterial = true;
      return clone;
    };
    o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material);
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    shirt ||= mats.find(m => /top|casual.*diffuse/i.test(m.name));
    pants ||= mats.find(m => /bottom/i.test(m.name));
    o.castShadow = o.receiveShadow = true;
    o.frustumCulled = false; // Three r128 bind-pose bounds omit moving limbs
    o.userData.fromGLB = true;
    o.userData.human = true;
    if (o.isSkinnedMesh) o.skeleton.update();
  });
  shirt ||= meshes.find(o=>/casual/i.test(o.name))?.material;
  if (Array.isArray(shirt)) shirt=shirt[0];
  shirt ||= meshes[0].material;
  pants ||= shirt;
  const rig=createHumanRig(g,model,meshes);
  /* Original clips remain embedded for asset export. Runtime locomotion uses
     the metre-scale rig and independent ankle IK for both characters. */
  return {g,meshes,...rig,mats:{sh:shirt,pa:pants},character:id,realistic:true};

}

export function humanAssetsInfo(){return {loaded:[...templates.keys()],offline:true,
  geometry:'Textured anatomical meshes with original skin weights; 1K embedded textures',
  animation:'Distance-driven foot planting, two-bone leg/arm IK, timed approach/turn/sit/stand actions for both rigs; kinematic characters, not a muscle or ragdoll simulation'};}
