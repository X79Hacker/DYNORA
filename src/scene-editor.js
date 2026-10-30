import * as THREE from 'three';
import {TransformControls} from 'three/examples/jsm/controls/TransformControls.js';
import {readTransform,writeTransform,validateTransform,TransformHistory} from './scene-transform.js';

// Registered before the old room handlers. Only an explicitly enabled editor
// intercepts selection/gizmo gestures; orbit drags on empty space still work.
let active=null;
if(typeof window!=='undefined')for(const type of ['pointerdown','pointermove','pointerup','click','keydown'])
  window.addEventListener(type,event=>active?.handle(type,event),{capture:true,passive:false});

export function initSceneEditor({scene,cam,renderer,panel,entries,onCommit,guard,status,onSelect=()=>{},onRemove=null,onUndoRemove=null,canUndoRemove=()=>false,ground=()=>0,previewOnly=false}){
  const ui=document.createElement('div');ui.className='card scene-editor';
  ui.innerHTML=`<h3>Arrange your scene <span class="chip">NEW</span></h3>
  <button id="sceneEdit" type="button" aria-pressed="false">Enable scene editing</button>
  <p class="mut">Edit existing furniture and added models. Enable, click a model, then drag a coloured handle. Drag empty space to orbit.</p>
  <label>Editable scene object<select id="sceneObject"></select></label>
  <div class="scene-tools" role="group" aria-label="Transform mode"><button data-scene-mode="translate" type="button">Move</button><button data-scene-mode="rotate" type="button">Rotate</button><button data-scene-mode="scale" type="button">Scale</button></div>
  <div class="btns"><button id="sceneUndo" type="button">Undo</button><button id="sceneRedo" type="button">Redo</button><button id="sceneGround" type="button">Place on floor</button><button id="sceneReset" type="button">Reset transform</button><button id="sceneRemove" type="button">Remove selected model</button><button id="sceneUndoRemove" type="button">Undo removal</button></div>
  <label class="chk"><input id="sceneSnap" type="checkbox" checked> Snap: 10 cm / 15° / 0.1 scale</label>
  <details><summary>Exact position, angles and scale</summary><form id="sceneNumbers"><div class="visual-inputs">${[['x','X east · m'],['y','Up · m'],['z','Z south · m'],['rx','Tilt X · °'],['ry','Yaw Y · °'],['rz','Tilt Z · °'],['sx','Scale X'],['sy','Scale Y'],['sz','Scale Z']].map(([id,label])=>`<label>${label}<input data-scene-value="${id}" type="number" step="any" required></label>`).join('')}</div><button type="submit">Apply transform</button></form></details>
  <p class="mut">Transforms save automatically per room. Export scene ZIP for a backup. Delete: remove selected model. Undo removal restores it. Ctrl+Z / Ctrl+Shift+Z: undo / redo transforms. Esc: cancel a drag or finish editing. Room walls, scripted doors and walking routes stay in their existing controls.</p>`;
  panel.children[1].before(ui);
  const $=id=>ui.querySelector('#'+id),cv=renderer.domElement;
  const tc=new TransformControls(cam,cv);tc.enabled=false;tc.setSize(.9);tc.userData.editorAuxiliary=true;tc.userData.noPaint=true;scene.add(tc);
  for(const kind of ['gizmo','helper'])for(const group of Object.values(tc._gizmo[kind]))group.traverse(o=>o.layers.set(1));
  cam.layers.enable(1);
  const outline=new THREE.BoxHelper(new THREE.Object3D(),0x66d9bd);outline.layers.set(1);outline.userData.editorAuxiliary=true;outline.visible=false;scene.add(outline);
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),history=new TransformHistory(),initial=new WeakMap();
  let enabled=false,selected=null,before=null,consumed=false,busy=false,lastIds='';
  const find=id=>entries().find(e=>e.id===id);
  const protect=event=>{event.preventDefault();event.stopImmediatePropagation()};
  const typed=event=>/INPUT|SELECT|TEXTAREA/.test(event.target?.tagName)||event.target?.isContentEditable;
  const attempt=fn=>async event=>{event?.preventDefault();try{guard();if(busy)throw Error('Wait for the previous edit to finish');await fn()}catch(error){status(error.message)}};
  function form(){if(!selected)return;const o=selected.object,e=new THREE.Euler().setFromQuaternion(o.quaternion,'XYZ');const values={x:o.position.x,y:o.position.y,z:o.position.z,rx:e.x*180/Math.PI,ry:e.y*180/Math.PI,rz:e.z*180/Math.PI,sx:o.scale.x,sy:o.scale.y,sz:o.scale.z};for(const input of ui.querySelectorAll('[data-scene-value]'))if(document.activeElement!==input)input.value=values[input.dataset.sceneValue].toFixed(4)}
  function select(id){if(tc.dragging)cancel();selected=find(id)||null;if(selected){if(!initial.has(selected.object))initial.set(selected.object,readTransform(selected.object));$('sceneObject').value=id;if(enabled)tc.attach(selected.object);outline.setFromObject(selected.object);form()}else tc.detach();outline.visible=enabled&&!!selected;onSelect(selected)}
  function refresh(){const list=entries(),ids=list.map(e=>e.id+'|'+e.name).join(';');if(ids===lastIds)return;lastIds=ids;const previous=selected?.id;$('sceneObject').replaceChildren(new Option('Select a model in this room',''),...list.map(e=>new Option(e.name,e.id)));select(previous)}
  function mode(value){tc.setMode(value);tc.setSpace(value==='translate'?'world':'local');for(const b of ui.querySelectorAll('[data-scene-mode]'))b.classList.toggle('on',b.dataset.sceneMode===value)}
  function snap(){const on=$('sceneSnap').checked;tc.setTranslationSnap(on?.1:null);tc.setRotationSnap(on?Math.PI/12:null);tc.setScaleSnap(on?.1:null)}
  function enable(on){if(tc.dragging)cancel();enabled=on;tc.enabled=on;$('sceneEdit').textContent=on?'Finish scene editing':'Enable scene editing';$('sceneEdit').classList.toggle('on',on);$('sceneEdit').setAttribute('aria-pressed',String(on));document.body.classList.toggle('scene-editing',on);if(on){const pause=document.getElementById('bPause');if(pause&&!pause.classList.contains('on'))pause.click();document.getElementById('bIso')?.click();if(selected)tc.attach(selected.object);status(previewOnly?'Model editing enabled. Drag a coloured handle or use the number fields.':'Scene editing enabled. Robot paused. Click a model and use Move / Rotate / Scale.')}else{tc.detach();status(previewOnly?'Model editing finished.':'Scene editing finished. Press Pause to resume the robot when ready.')}outline.visible=on&&!!selected}
  function cancel(){if(before&&selected)writeTransform(selected.object,before);tc.pointerUp({button:0});before=null;consumed=false;form()}
  async function commit(entry,old){const next=readTransform(entry.object);try{validateTransform(next);busy=true;await onCommit(entry);history.record(entry.id,old,next);status(entry.name+' saved. Undo is available.')}catch(error){writeTransform(entry.object,old);status(error.message)}finally{busy=false;before=null;form()}}
  async function change(action){if(!selected)throw Error('Select a model first');const old=readTransform(selected.object);try{action(selected.object);validateTransform(readTransform(selected.object))}catch(error){writeTransform(selected.object,old);throw error}await commit(selected,old)}
  async function historyApply(id,t){const e=find(id);if(!e)throw Error('That object was removed; no transform was changed');const old=readTransform(e.object);try{writeTransform(e.object,t);await onCommit(e);select(id)}catch(error){writeTransform(e.object,old);throw error}}
  async function removeSelected(){if(!selected||!onRemove)throw Error('Select a removable scene model');const entry=selected;tc.detach();busy=true;try{await onRemove(entry);selected=null;lastIds='';refresh();outline.visible=false}catch(error){select(entry.id);throw error}finally{busy=false}}
  $('sceneRemove').onclick=attempt(removeSelected);$('sceneUndoRemove').onclick=attempt(async()=>{await onUndoRemove?.();lastIds='';refresh()});
  $('sceneEdit').onclick=attempt(()=>enable(!enabled));$('sceneObject').onchange=()=>select($('sceneObject').value);
  for(const b of ui.querySelectorAll('[data-scene-mode]'))b.onclick=()=>mode(b.dataset.sceneMode);
  $('sceneSnap').onchange=snap;
  $('sceneUndo').onclick=attempt(()=>history.move('undo',historyApply));$('sceneRedo').onclick=attempt(()=>history.move('redo',historyApply));
  $('sceneGround').onclick=attempt(()=>change(o=>{o.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(o);o.position.y+=ground(o.position.x,o.position.z)-b.min.y}));
  $('sceneReset').onclick=attempt(()=>change(o=>writeTransform(o,initial.get(o))));
  $('sceneNumbers').onsubmit=attempt(()=>change(o=>{const v=Object.fromEntries([...ui.querySelectorAll('[data-scene-value]')].map(i=>[i.dataset.sceneValue,Number(i.value)]));if(Object.values(v).some(n=>!Number.isFinite(n)))throw Error('Enter finite numbers');o.position.set(v.x,v.y,v.z);o.rotation.set(v.rx*Math.PI/180,v.ry*Math.PI/180,v.rz*Math.PI/180,'XYZ');o.scale.set(v.sx,v.sy,v.sz)}));
  function handle(type,event){if(!enabled)return;
    if(type==='keydown'){if(typed(event))return;if(event.key==='Escape'){protect(event);if(tc.dragging)cancel();else enable(false);return}if(!event.ctrlKey&&!event.metaKey&&['r','t','s'].includes(event.key.toLowerCase())){protect(event);mode({r:'rotate',t:'translate',s:'scale'}[event.key.toLowerCase()]);return}if(['Delete','Backspace'].includes(event.key)){protect(event);attempt(removeSelected)();return}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){protect(event);attempt(()=>history.move(event.shiftKey?'redo':'undo',historyApply))();return}return}
    if(type==='click'&&consumed){protect(event);consumed=false;return}
    if(type==='pointermove'&&tc.dragging){protect(event);tc.pointerMove({...tc._getPointer(event),button:-1});form();return}
    if(type==='pointerup'&&tc.dragging){protect(event);const entry=selected,old=before;tc.pointerUp({button:0});if(entry&&old)commit(entry,old);consumed=true;return}
    if(type!=='pointerdown'||event.target!==cv||event.button!==0)return;
    try{guard();if(busy){protect(event);return}scene.updateMatrixWorld(true);tc.updateMatrixWorld(true);if(tc.object){tc.pointerHover(tc._getPointer(event));if(tc.axis){before=readTransform(tc.object);tc.pointerDown(tc._getPointer(event));protect(event);consumed=true;return}}
      const rect=cv.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,cam);const list=entries(),hit=ray.intersectObjects(list.map(e=>e.object),true).find(h=>h.object.visible&&h.object.material?.depthWrite!==false);if(hit){const entry=list.find(e=>{let o=hit.object;while(o){if(o===e.object)return true;o=o.parent}return false});if(entry){select(entry.id);protect(event);consumed=true}}else consumed=false;
    }catch(error){protect(event);status(error.message)}
  }
  active={handle};refresh();mode('translate');snap();
  return {update(){refresh();if(selected&&enabled)outline.setFromObject(selected.object);$('sceneUndo').disabled=busy||!history.undoStack.length;$('sceneRedo').disabled=busy||!history.redoStack.length;$('sceneRemove').disabled=busy||!selected||!onRemove;$('sceneUndoRemove').disabled=busy||!onUndoRemove||!canUndoRemove()},
    cancel:()=>{if(enabled)enable(false)},isEditing:()=>enabled,start:()=>enable(true),select,history};
}
