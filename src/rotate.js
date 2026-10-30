// ===== rotate the selected object: buttons, angle slider, R / Shift+R, outline (shared by both environments) =====
import * as THREE from 'three';

const $=id=>document.getElementById(id);
const deg=r=>((Math.round(r*180/Math.PI)%360)+360)%360;

// target() = the selected (last clicked or spawned) object, null when none
export function initRotate({scene,cam,target}){
 const box=new THREE.Box3Helper(new THREE.Box3(),0x22d3ee);box.visible=false;box.layers.set(1);cam.layers.enable(1);scene.add(box);   // main view only
 const ui=document.createElement('div');ui.className='rot';
 ui.innerHTML=`<div class="kv"><span>Selected</span><b id="rName">none · click an object</b></div>
<div class="rotb"><button id="rL" title="Turn left 15° (R)">⟲ 15°</button><button id="rR" title="Turn right 15° (Shift+R)">⟳ 15°</button><button id="r90" title="Turn 90°">↻ 90°</button><button id="r0" title="Back to the original angle">Reset</button></div>
<label>Angle <input id="rAng" type="range" min="0" max="359" step="1" value="0"> <b id="rAngT">0°</b></label>`;
 $('bRoll').closest('.roll').before(ui);
 const g=()=>{const o=target();return o&&o.parent?o:null};
 function turn(o,a){if(!o)return;if(o.userData.rot0===undefined)o.userData.rot0=o.rotation.y;o.rotation.y=a}
 $('rL').onclick=()=>{const o=g();o&&turn(o,o.rotation.y+Math.PI/12)};
 $('rR').onclick=()=>{const o=g();o&&turn(o,o.rotation.y-Math.PI/12)};
 $('r90').onclick=()=>{const o=g();o&&turn(o,o.rotation.y-Math.PI/2)};
 $('r0').onclick=()=>{const o=g();if(o&&o.userData.rot0!==undefined)o.rotation.y=o.userData.rot0};
 $('rAng').oninput=e=>{const o=g();o&&turn(o,+e.target.value*Math.PI/180)};
 let was=null;
 function update(){if(document.body.classList.contains('scene-editing')){box.visible=false;return}const o=g(),on=!!o;ui.classList.toggle('off',!on);
  if(o!==was){was=o;$('rName').textContent=o?(o.userData.label||'object'):'none · click an object'}
  if(!o){box.visible=false;return}
  box.box.setFromObject(o);box.visible=true;
  const d=deg(o.rotation.y);$('rAngT').textContent=d+'°';if(document.activeElement!==$('rAng'))$('rAng').value=d}
 return{update};
}
