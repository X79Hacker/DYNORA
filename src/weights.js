// ===== Build → Weights (kg): the mass of the robot and of every movable object, saved per room (shared by all environments) =====
// Masses feed the physics: collisions (robot ↔ object momentum), pushing, rolling, falling, and in the obstacle track the drive
// physics and the swing gate. Objects are saved by label and number (the 2nd "wooden crate" is "wooden crate#2"), so a saved
// weight comes back after a reload; spawned objects are listed and can be changed, but they are gone after a reload.
import {props} from './physics.js';
import {ROBOT_KG,setRobotKg} from './collide.js';

const $=id=>document.getElementById(id);
const ROBOT_DEF=3.5;

// extras: [{id, name, get(), set(kg), def, min, max, show()}] for other masses a room has (the gate leaves in the obstacle track)
export function initWeights({envKey,movable,select,spawned=()=>[],extras=[],toast}){
 const KEY='rsw_kg_'+envKey;let saved={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){}
 saved.obj=saved.obj||{};saved.x=saved.x||{};
 const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(saved))}catch(e){}};
 // save keys for the room's own objects (not spawned ones), given when an object first shows up (creation order is the same on every
 // load); its saved weight goes back on at that moment (an object that only appears with some tracks gets its key when it appears)
 const keyOf=new Map(),count={},seen=new Set();
 function keyNew(){const sp=new Set(spawned());movable().forEach(g=>{if(seen.has(g))return;seen.add(g);if(sp.has(g))return;const l=g.userData.label||'object';count[l]=(count[l]||0)+1;const k=count[l]>1?l+'#'+count[l]:l;keyOf.set(g,k);if(saved.obj[k]>0)props(g).m=saved.obj[k]})}
 if(saved.robot>0)setRobotKg(saved.robot);keyNew();
 extras.forEach(x=>{if(saved.x[x.id]>0)x.set(saved.x[x.id])});

 const card=document.createElement('div');card.className='card';card.id='wtCard';
 card.innerHTML=`<h3>Weights <small>kg · saved for this room</small></h3>
<label class="pl">🤖 Robot <input id="wtRobot" type="number" min="0.5" max="50" step="0.1" style="width:6em"> kg</label>
<div id="wtX"></div><div id="wtList" style="max-height:260px;overflow:auto"></div>
<div class="btns"><button id="wtReset">↺ Default weights</button></div>
<p class="mut">Click a name to select that object. A heavier object needs more push and moves the robot back more when it is hit; a heavier robot pushes harder but speeds up and climbs more slowly.</p>`;
 const anchor=document.querySelector('[data-sp]').closest('.card');anchor.after(card);

 const fmt=m=>m<10?m.toFixed(2):m.toFixed(1);
 let shown=[],sig='';
 function list(){keyNew();const sp=new Set(spawned()),gs=movable();shown=gs;sig=gs.map(g=>g.id).join(',');
  $('wtList').innerHTML=gs.length?gs.map((g,i)=>`<label class="pl"><a href="#" data-sel="${i}" title="Select">${(keyOf.get(g)||g.userData.label||'object').replace('#',' #')}${sp.has(g)?' <small>(spawned)</small>':''}</a> <input data-i="${i}" type="number" min="0.01" max="500" step="0.01" style="width:6em"> kg</label>`).join(''):'<p class="mut">No movable objects in this room.</p>';
  $('wtList').querySelectorAll('[data-sel]').forEach(a=>a.onclick=e=>{e.preventDefault();const g=shown[+a.dataset.sel];if(g&&select)select(g)});
  $('wtList').querySelectorAll('input[data-i]').forEach(inp=>inp.onchange=e=>{const g=shown[+inp.dataset.i],m=+e.target.value;if(!g||!(m>0))return;props(g).m=m;const k=keyOf.get(g);if(k){saved.obj[k]=m;save()}
   toast&&toast((g.userData.label||'object')+': '+fmt(m)+' kg')});
  values()}
 function xrows(){$('wtX').innerHTML=extras.filter(x=>!x.show||x.show()).map(x=>`<label class="pl">${x.name} <input id="wtx_${x.id}" type="number" min="${x.min||.01}" max="${x.max||500}" step="0.1" style="width:6em"> kg</label>`).join('');
  extras.forEach(x=>{const el=$('wtx_'+x.id);if(el)el.onchange=e=>{const m=+e.target.value;if(!(m>0))return;x.set(m);saved.x[x.id]=m;save();toast&&toast(x.name+': '+fmt(m)+' kg')}})}
 // values change elsewhere too (the Mass box under the selected object, the gate slider), so they are refreshed here
 function values(){const act=document.activeElement;if(act!==$('wtRobot'))$('wtRobot').value=fmt(ROBOT_KG);
  $('wtList').querySelectorAll('input[data-i]').forEach(inp=>{const g=shown[+inp.dataset.i];if(g&&inp!==act)inp.value=fmt(props(g).m)});
  extras.forEach(x=>{const el=$('wtx_'+x.id);if(el&&el!==act)el.value=fmt(x.get())})}
 $('wtRobot').onchange=e=>{const m=+e.target.value;if(!(m>=.5))return;setRobotKg(Math.min(50,m));saved.robot=ROBOT_KG;save();toast&&toast('Robot: '+fmt(ROBOT_KG)+' kg')};
 $('wtReset').onclick=()=>{setRobotKg(ROBOT_DEF);movable().forEach(g=>{delete g.userData.phys});extras.forEach(x=>x.set(x.def));saved={obj:{},x:{}};save();xrows();list();toast&&toast('Default weights restored')};
 list();xrows();
 // keep the list in step with the room: spawned or deleted objects, a rebuilt track (new gate)
 let xs='';setInterval(()=>{const gs=movable(),s=gs.map(g=>g.id).join(',');if(s!==sig)list();const nx=extras.map(x=>!x.show||x.show()?1:0).join('');if(nx!==xs){xs=nx;xrows()}values()},700);
 return{robotKg:()=>ROBOT_KG}}
