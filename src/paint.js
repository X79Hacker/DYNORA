// ===== paint mode: click any object to change its colour (shared by both environments) =====
import * as THREE from 'three';

const $=id=>document.getElementById(id);
const SW=[0xffffff,0xd1d5db,0x6b7280,0x1f2937,0xdc2626,0xf97316,0xfacc15,0x84cc16,0x16a34a,0x0ea5e9,0x2563eb,0x7c3aed,0xdb2777,0x8d6e4b,0xe9d8b4,0x3d5a8c];
const hex=c=>'#'+c.toString(16).padStart(6,'0');
// clicks are caught at import time, before the scene's drag/orbit/path handlers (bulb clicks still win: lighting.js loads first)
let pick=null,eat=false;
addEventListener('pointerdown',e=>{eat=false;if(document.body.classList.contains('picking'))return;   // a task point is being picked on the map
 if(e.button===0&&pick&&pick(e)){eat=true;e.stopImmediatePropagation()}},true);
addEventListener('pointerup',e=>{if(eat){eat=false;e.stopImmediatePropagation()}},true);

export function initPaint({scene,renderer,cam,toast}){
 const cv=renderer.domElement,rc=new THREE.Raycaster(),mv=new THREE.Vector2(),painted=new Set();
 let on=false,sel=null,part=null,whole=true;
 const box=new THREE.Box3Helper(new THREE.Box3(),0xfacc15);box.visible=false;scene.add(box);
 box.layers.set(1);cam.layers.enable(1);   // outline shows in the main view only, never in robot camera images
 // the object a mesh belongs to: nearest labelled ancestor, else the top group under the scene
 const top=m=>{let o=m;while(o.parent&&o.parent!==scene){if(o.userData.label)return o;o=o.parent}return o};
 const skip=o=>{for(let p=o;p;p=p.parent)if(p.isLine||p.userData.noPaint||p.userData.glass||p.userData.fixture)return true;return false};
 const ok=o=>o.isMesh&&o.visible&&o.material&&o.material.visible!==false&&o.material.color&&!(o.material.transparent&&o.material.opacity<.2)&&!skip(o);
 const nameOf=(o,m)=>o.userData.label||(m.geometry.parameters&&m.geometry.parameters.height===2.5?'wall':m.geometry.type==='PlaneGeometry'&&Math.abs(m.rotation.x+Math.PI/2)<.01?'floor':'object');
 const meshes=()=>{const a=[];(whole?sel:part).traverse(o=>{if(ok(o))a.push(o)});if(!whole&&!a.length&&ok(part))a.push(part);return a};
 // clone a shared material once, so painting one object never recolours another
 function own(m){if(!m.userData.mat0){m.userData.mat0=m.material;m.material=m.material.clone();painted.add(m)}}
 function paint(c){if(!sel)return;meshes().forEach(m=>{own(m);m.material.color.setHex(c)});$('pCol').value=hex(c)}
 function reset(list){list.forEach(m=>{if(m.userData.mat0){m.material.dispose();m.material=m.userData.mat0;delete m.userData.mat0;painted.delete(m)}})}
 function frame(){if(!sel){box.visible=false;return}box.box.setFromObject(whole?sel:part);box.visible=true}

 // UI: dock button + floating palette
 const btn=document.createElement('button');btn.id='bPaint';btn.title='Paint objects: click any object to change its colour (P)';btn.innerHTML='<i>🎨</i><b>Paint</b>';$('bHuman').after(btn);
 const pop=document.createElement('div');pop.id='paintPop';pop.className='card';pop.hidden=true;
 pop.innerHTML=`<h3><span id="pName">object</span><button id="pX" class="ghost" title="Close (Esc)">✕</button></h3>
<div class="seg"><button id="pWhole" class="on">Whole object</button><button id="pPart">This part</button></div>
<div class="sw">${SW.map(c=>`<button data-c="${c}" style="background:${hex(c)}" title="${hex(c)}"></button>`).join('')}</div>
<label class="pc">Custom <input id="pCol" type="color" value="#ffffff"></label>
<div class="btns"><button id="pReset">↺ Reset object</button><button id="pAll">↺ Reset all</button></div>`;
 document.body.append(pop);
 function setOn(v){on=v;btn.classList.toggle('on',on);document.body.classList.toggle('painting',on);if(!on){sel=part=null;pop.hidden=true;frame()}else toast&&toast('Paint mode: click any object to change its colour · Esc closes')}
 function scope(w){whole=w;$('pWhole').classList.toggle('on',w);$('pPart').classList.toggle('on',!w);frame()}
 btn.onclick=()=>setOn(!on);
 $('pX').onclick=()=>{sel=part=null;pop.hidden=true;frame()};
 $('pWhole').onclick=()=>scope(true);$('pPart').onclick=()=>scope(false);
 pop.querySelector('.sw').onclick=e=>{if(e.target.dataset.c)paint(+e.target.dataset.c)};
 $('pCol').oninput=e=>paint(parseInt(e.target.value.slice(1),16));
 $('pReset').onclick=()=>{if(sel)reset((whole?[sel]:[part]).flatMap(o=>{const a=[];o.traverse(m=>a.push(m));return a}))};
 $('pAll').onclick=()=>{reset([...painted]);toast&&toast('All colours reset')};
 addEventListener('keydown',e=>{if(/INPUT|SELECT/.test(document.activeElement.tagName))return;if(e.code==='KeyP')setOn(!on);if(e.code==='Escape'&&on){if(sel)$('pX').click();else setOn(false)}});

 pick=e=>{if(!on||e.target!==cv)return false;const r=cv.getBoundingClientRect();mv.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);rc.setFromCamera(mv,cam);
  const list=[];scene.traverse(o=>{if(ok(o))list.push(o)});const h=rc.intersectObjects(list,false)[0];if(!h)return false;
  part=h.object;sel=top(part);$('pName').textContent=nameOf(sel,part);$('pCol').value=hex(part.material.color.getHex());
  pop.hidden=false;const pw=pop.offsetWidth,ph=pop.offsetHeight;pop.style.left=Math.min(innerWidth-pw-10,e.clientX+14)+'px';pop.style.top=Math.max(70,Math.min(innerHeight-ph-10,e.clientY-ph/2))+'px';
  frame();return true};
 return{update:()=>{if(sel&&box.visible)box.box.setFromObject(whole?sel:part)}};
}
