// ===== move the selected object in 3D (X/Y/Z arrows + number boxes) and let gravity act on it (shared by both environments) =====
import * as THREE from 'three';
import {TransformControls} from 'three/examples/jsm/controls/TransformControls.js';
import {G,props,drag} from './physics.js';
import {fallingStep} from './dynamics.js';

const $=id=>document.getElementById(id);
// arrow handles are caught at import time, before the scene's drag/orbit/bulb/paint handlers
let tcRef=null;
addEventListener('pointerdown',e=>{const tc=tcRef;if(!tc||!tc.object||!tc.visible||e.button!==0||e.target!==tc.domElement||document.body.classList.contains('picking'))return;
 tc.pointerHover(tc._getPointer(e));if(tc.axis){tc._onPointerDown(e);e.stopImmediatePropagation()}},true);

// target() = selected object; movable() = all objects that can be moved
export function initMove({scene,cam,renderer,obstacles,target,movable}){
 const tc=new TransformControls(cam,renderer.domElement);tc.setMode('translate');tc.setSize(.75);tc.userData.noPaint=true;scene.add(tc);tcRef=tc;
 // visible arrows only in the main view, never in robot camera images (the hidden pickers stay clickable on layer 0)
 ['gizmo','helper'].forEach(k=>Object.values(tc._gizmo[k]).forEach(o=>o.traverse(c=>c.layers.set(1))));
 let axes=true;try{axes=localStorage.getItem('rsw_axes')!=='0'}catch(e){}
 tc.addEventListener('objectChange',()=>{const o=tc.object;if(!o)return;o.position.y=Math.min(2.4,Math.max(0,o.position.y));if($('mHold').checked&&o.position.y>.001)o.userData.hold=true;air.delete(o)});

 // UI under the rotate controls
 const ui=document.createElement('div');ui.className='pos';
 ui.innerHTML=`<div class="xyz"><label><i class="ax x">X</i><input id="mX" type="number" step="0.1"></label><label><i class="ax y">Y ↑</i><input id="mY" type="number" step="0.1" min="0" max="2.4"></label><label><i class="ax z">Z</i><input id="mZ" type="number" step="0.1"></label></div>
<label class="mass">Mass <input id="mM" type="number" step="0.01" min="0.01"> kg <small>gravity 9.8 m/s²</small></label>
<div class="posb"><label class="chk"><input id="mHold" type="checkbox"> Hold in air</label><button id="mDrop" title="Let the selected object fall">▼ Drop</button><label class="chk"><input id="mAxes" type="checkbox"> X/Y/Z arrows</label></div>`;
 document.querySelector('.rot').after(ui);$('mAxes').checked=axes;
 const sel=()=>{const o=target();return o&&o.parent?o:null};
 ['mX','mY','mZ'].forEach((id,i)=>$(id).onchange=e=>{const o=sel();if(!o)return;let v=+e.target.value;if(!isFinite(v))return;if(i===1){v=Math.min(2.4,Math.max(0,v));if($('mHold').checked&&v>0)o.userData.hold=true}
  o.position[['x','y','z'][i]]=v;air.delete(o)});
 $('mM').onchange=e=>{const o=sel(),m=+e.target.value;if(o&&m>0)props(o).m=m};
 $('mDrop').onclick=()=>{const o=sel();if(o){delete o.userData.hold;air.delete(o)}};
 $('mHold').onchange=e=>{const o=sel();if(o&&!e.target.checked)delete o.userData.hold};
 $('mAxes').onchange=e=>{axes=e.target.checked;try{localStorage.setItem('rsw_axes',axes?'1':'0')}catch(x){}};
 // rolling a held object throws it from that height
 $('bRoll').addEventListener('click',()=>{const o=sel();if(o)delete o.userData.hold});

 // ----- gravity: fall, bounce (balls more than boxes), land on furniture, fall off edges -----
 const air=new Map(),rc=new THREE.Raycaster(),DOWN=new THREE.Vector3(0,-1,0),org=new THREE.Vector3();
 function ground(o){const own=new Set();o.traverse(c=>own.add(c));org.set(o.position.x,o.position.y+.05,o.position.z);rc.set(org,DOWN);rc.far=o.position.y+.06;
  const h=rc.intersectObjects(obstacles,false).find(i=>!own.has(i.object));return h?Math.max(0,h.point.y):0}
 function update(dt){if(document.body.classList.contains('scene-editing')){tc.enabled=false;tc.detach();return}tc.enabled=true;if(!dt)return;
  const o=sel(),show=axes&&!!o;if(show&&tc.object!==o)tc.attach(o);else if(!show&&tc.object)tc.detach();
  if(o&&$('mHold').checked!==!!o.userData.hold&&document.activeElement!==$('mHold'))$('mHold').checked=!!o.userData.hold;
  movable().forEach(g=>{if(g.userData.contactManaged||tc.dragging&&tc.object===g||g.userData.hold)return;const y=g.position.y;let s=air.get(g);if(y<=1e-4&&!s)return;
   if(s&&Math.abs(y-s.y)>1e-4)s.vy=0;   // moved by something else (carried, dragged): start again from rest
   if(!s){s={vy:0,y};air.set(g,s)}
   const gr=ground(g),p=props(g);
   // free fall: a = −g − drag (drag opposes the motion); 4 small steps per frame; never below the surface under it
   if(y>gr+1e-4||s.vy>0){let ny=y;for(let i=0;i<4;i++){const h=dt/4,fall=fallingStep(ny,s.vy,h,{g:G+Math.sign(s.vy)*drag(p,Math.abs(s.vy)),restitution:Math.abs(s.vy)>.6?p.e:0,floor:gr});ny=fall.y;s.vy=fall.v;}g.position.y=ny;s.y=ny}
   else{g.position.y=gr;s.y=gr;s.vy=0}
   g.userData.airborne=g.position.y>gr+1e-3;
   if(g.position.y<=1e-4&&s.vy===0){g.position.y=0;g.userData.airborne=false;air.delete(g)}});
  if(o){const p=o.position;[['mX',p.x],['mY',p.y],['mZ',p.z],['mM',props(o).m]].forEach(([id,v])=>{if(document.activeElement!==$(id))$(id).value=v.toFixed(2)})}
  ui.classList.toggle('off',!o)}
 return{update};
}
