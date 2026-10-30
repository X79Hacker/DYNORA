// ===== time-of-day lighting + switchable ceiling bulbs (shared by both environments) =====
import * as THREE from 'three';

const $=id=>document.getElementById(id);
const sm=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
// sky colour key frames over 24 h
const SKY=[[0,0x03060d],[4.8,0x060b18],[6,0x3a3550],[6.8,0xc98a6a],[8,0x7da3cc],[12,0x9cc3ea],[16.5,0x88aed6],[18,0xe08a55],[19,0x4a3a5a],[20,0x0b1226],[24,0x03060d]];
const skyAt=(h,out)=>{for(let i=1;i<SKY.length;i++)if(h<=SKY[i][0]){const[a,ca]=SKY[i-1],[b,cb]=SKY[i];return out.setHex(ca).lerp(new THREE.Color(cb),(h-a)/(b-a))}return out.setHex(SKY[0][1])};
const PERIOD=h=>h<5?'night':h<7?'dawn':h<11?'morning':h<14?'midday':h<17?'afternoon':h<19.5?'evening':'night';
const hhmm=h=>String(Math.floor(h)%24).padStart(2,'0')+':'+String(Math.floor(h%1*60)).padStart(2,'0');
// bulb clicks are caught here, at import time, so they run before the scene's drag/orbit/path handlers
let pick=null,eat=false;
addEventListener('pointerdown',e=>{eat=false;if(document.body.classList.contains('picking'))return;   // a task point is being picked on the map
 if(e.button===0&&pick&&pick(e)){eat=true;e.stopImmediatePropagation()}},true);
addEventListener('pointerup',e=>{if(eat){eat=false;e.stopImmediatePropagation()}},true);
const UNIT={s:1,min:60,h:3600};   // fast mode: one sim day lasts S.day × UNIT[S.unit] real seconds

// bulbs: [{name,x,z,y?,light?,shade?}] -- light/shade reuse an existing lamp, otherwise a pendant bulb is built
// glass meshes have userData.glass, ceiling panels userData.fixture (panels follow their nearest bulb)
export function initLighting({scene,renderer,cam,sun,bulbs,envKey,toast,actor,onToggle}){
 const hemi=scene.children.find(o=>o.isHemisphereLight),bg0=scene.background.clone(),sky=new THREE.Color(),tmp=new THREE.Color();
 const warm=new THREE.Color(0xffb27a),white=new THREE.Color(0xffffff),moon=new THREE.Color(0x6f7fae),gDay=new THREE.Color(0x667788),gNight=new THREE.Color(0x1b2130);
 const bulbMat=()=>new THREE.MeshStandardMaterial({color:0xf4f1ea,roughness:.2,emissive:0xffd9a0,emissiveIntensity:1});
 const cordMat=new THREE.MeshStandardMaterial({color:0x222222,roughness:.8}),capMat=new THREE.MeshStandardMaterial({color:0x8b95a1,metalness:.7,roughness:.35});
 const hitMat=new THREE.MeshBasicMaterial({visible:false}),hits=[];
 const hc=document.createElement('canvas');hc.width=hc.height=64;{const x=hc.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,236,200,1)');g.addColorStop(.25,'rgba(255,214,150,.45)');g.addColorStop(1,'rgba(255,200,120,0)');x.fillStyle=g;x.fillRect(0,0,64,64)}
 const haloMat=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(hc),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true});
 const B=bulbs.map((d,i)=>{const y=d.y??2.15,b={id:i,name:d.name,on:true,x:d.x,z:d.z,light:d.light,shade:d.shade};
  if(!b.light){const g=new THREE.Group();g.position.set(d.x,0,d.z);g.userData.noPaint=true;scene.add(g);
   const cord=new THREE.Mesh(new THREE.CylinderGeometry(.006,.006,2.5-y-.08,6),cordMat);cord.position.y=(2.5+y+.08)/2;g.add(cord);
   const cap=new THREE.Mesh(new THREE.CylinderGeometry(.025,.03,.05,12),capMat);cap.position.y=y+.07;g.add(cap);
   const rose=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.02,16),capMat);rose.position.y=2.49;g.add(rose);
   b.shade=new THREE.Mesh(new THREE.SphereGeometry(.07,20,14),bulbMat());b.shade.position.y=y;g.add(b.shade);
   b.halo=new THREE.Sprite(haloMat.clone());b.halo.scale.setScalar(.55);b.halo.position.y=y;g.add(b.halo);
   b.light=new THREE.PointLight(0xffe2b8,1,8,2);b.light.position.set(d.x,y-.05,d.z);scene.add(b.light)}
  b.base=b.light.intensity;b.glow=b.shade&&b.shade.material.emissive.clone();
  const hit=new THREE.Mesh(new THREE.SphereGeometry(.4,8,6),hitMat);hit.position.copy(b.light.position);hit.userData.bulb=b;scene.add(hit);hits.push(hit);return b});
 const glass=[],fix=[];scene.traverse(o=>{if(o.userData.glass)glass.push(o);if(o.userData.fixture)fix.push({m:o,c:o.material.color.clone(),b:null})});
 const wp=new THREE.Vector3();fix.forEach(f=>{f.m.getWorldPosition(wp);let bd=1e9;B.forEach(b=>{const d=(b.x-wp.x)**2+(b.z-wp.z)**2;if(d<bd){bd=d;f.b=b}})});
 // saved per viewer: clock mode, manual time, brightness, auto switch, bulb states
 const KEY='rsw_light_'+envKey;let S={mode:'real',min:720,gain:1,auto:true,on:{},day:4,unit:'min'};
 try{Object.assign(S,JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(e){}
 if(/^fast\d/.test(S.mode)){S.day=S.mode==='fast1'?1:4;S.unit='min';S.mode='fast'}   // settings saved by the older fixed speeds
 B.forEach(b=>{if(b.name in S.on)b.on=!!S.on[b.name]});
 const save=()=>{S.on=Object.fromEntries(B.map(b=>[b.name,b.on]));try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}};
 let hour=S.min/60,day=1,dark=null,envT=0,shade=0;const envMats=new Set();

 // ----- UI: Lights tab + header chip -----
 $('t-light').innerHTML=`<div class="card"><h3>Time of day <span class="chip" id="lPer">--</span></h3><div class="tod"><b id="lTime">--:--</b><input id="lSlide" type="range" min="0" max="1439" step="5"></div>
<label>Clock <select id="lMode"><option value="real">Real time (this device)</option><option value="manual">Manual (use the slider)</option><option value="fast">Fast (set your own speed)</option></select></label>
<div id="lFast" class="lfast">1 day lasts <input id="lDayN" type="number" min="0.1" step="0.5"> <select id="lDayU"><option value="s">seconds</option><option value="min">minutes</option><option value="h">hours</option></select></div>
<div class="kv"><span>Daylight</span><b id="lDay">--</b></div><div class="kv"><span>Sun elevation</span><b id="lSun">--</b></div></div>
<div class="card"><h3>Bulbs <small>click a bulb in 3D · L = nearest</small></h3><div class="btns"><button id="lAll">💡 All on</button><button id="lNone">⚫ All off</button></div>
<label>Brightness <input id="lGain" type="range" min="0.2" max="2" step="0.05"></label><label class="chk"><input id="lAuto" type="checkbox"> Turn on at dusk, off at dawn</label><div id="lList"></div></div>`;
 $('lMode').value=S.mode;$('lGain').value=S.gain;$('lAuto').checked=S.auto;
 const chip=document.createElement('span');chip.className='chip';chip.id='todChip';$('batChip').before(chip);
 $('lList').innerHTML=B.map(b=>`<div class="kv bulb"><span>${b.name}</span><button data-bulb="${b.id}"></button></div>`).join('');
 const paint=()=>B.forEach(b=>{const e=document.querySelector(`[data-bulb="${b.id}"]`);e.textContent=b.on?'💡 On':'Off';e.classList.toggle('on',b.on)});
 function set(b,on,quiet){if(b.on===on)return;b.on=on;paint();save();if(!quiet){toast&&toast(b.name+' light '+(on?'on':'off'));onToggle&&onToggle(b)}}
 $('lList').onclick=e=>{const id=e.target.dataset.bulb;if(id!==undefined)set(B[+id],!B[+id].on)};
 $('lAll').onclick=()=>B.forEach(b=>set(b,true,true));$('lNone').onclick=()=>B.forEach(b=>set(b,false,true));
 $('lGain').oninput=e=>{S.gain=+e.target.value;save()};$('lAuto').onchange=e=>{S.auto=e.target.checked;dark=null;save()};
 const fastUI=()=>{$('lFast').hidden=S.mode!=='fast'};$('lDayN').value=S.day;$('lDayU').value=S.unit;fastUI();
 $('lMode').onchange=e=>{S.mode=e.target.value;if(S.mode==='real')hour=nowH();fastUI();save()};
 $('lDayN').onchange=e=>{const v=+e.target.value;if(v>0){S.day=v;save()}else e.target.value=S.day};
 $('lDayU').onchange=e=>{S.unit=e.target.value;save()};
 $('lSlide').oninput=e=>{hour=+e.target.value/60;S.min=+e.target.value;if(S.mode==='real'){S.mode='manual';$('lMode').value='manual'}save()};
 paint();
 // click a bulb in 3D or press L to switch the nearest one
 const cv=renderer.domElement,rc=new THREE.Raycaster(),mv=new THREE.Vector2();
 pick=e=>{if(e.target!==cv)return false;const r=cv.getBoundingClientRect();mv.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);rc.setFromCamera(mv,cam);const h=rc.intersectObjects(hits,false)[0];if(!h)return false;const b=h.object.userData.bulb;set(b,!b.on);return true};
 addEventListener('keydown',e=>{if(e.code!=='KeyL'||/INPUT|SELECT/.test(document.activeElement.tagName))return;const p=actor();let best=null,bd=1e9;B.forEach(b=>{const d=(b.x-p.x)**2+(b.z-p.z)**2;if(d<bd){bd=d;best=b}});if(best)set(best,!best.on)});

 function nowH(){const d=new Date();return d.getHours()+d.getMinutes()/60+d.getSeconds()/3600}
 function update(dt){
  if(S.mode==='real')hour=nowH();else if(S.mode==='fast'){hour=(hour+dt*24/(S.day*UNIT[S.unit]))%24;S.min=Math.round(hour*60)}
  const a=Math.PI*(hour-6)/12,el=Math.sin(a);day=sm(-.1,.3,el);
  // sun travels east (+x) to west (-x) over the south side; warm and weak near the horizon
  // closed curtains (shade 0..1) keep part of the daylight out
  sun.position.set(14*Math.cos(a),3+12*Math.max(el,0),8);sun.intensity=.7*sm(0,.22,el)*(1-.6*shade);sun.visible=sun.castShadow=sun.intensity>0;sun.color.copy(warm).lerp(white,sm(.05,.45,el));
  hemi.intensity=.05+.45*day*(1-.4*shade);hemi.color.copy(moon).lerp(white,day);hemi.groundColor.copy(gNight).lerp(gDay,day);
  skyAt(hour,sky);scene.background.copy(sky).multiplyScalar(.55).lerp(bg0,.25);
  glass.forEach(g=>g.material.color.copy(sky));
  if(S.auto){const dk=day<.4;if(dk!==dark){if(dark!==null||!Object.keys(S.on).length)B.forEach(b=>set(b,dk,true));dark=dk}}
  B.forEach(b=>{b.light.intensity=b.on?b.base*S.gain:0;b.light.visible=b.light.intensity>0;if(b.glow)b.shade.material.emissive.copy(b.glow).multiplyScalar(b.on?Math.min(1.4,S.gain):0);if(b.halo){b.halo.visible=b.on;b.halo.material.opacity=Math.min(1,.35+.5*S.gain)*(1-.6*day)}});
  fix.forEach(f=>f.m.material.color.copy(f.c).multiplyScalar(f.b&&f.b.on?1:.28+.45*day));
  // reflections follow daylight; rescan now and then so spawned objects are included
  // the base value lives in userData so a cloned (repainted) material keeps it
  if((envT-=dt)<=0){envT=1;envMats.clear();scene.traverse(o=>{const m=o.isMesh&&o.material;if(m&&m.isMeshStandardMaterial){if(m.userData.env0===undefined)m.userData.env0=m.envMapIntensity;envMats.add(m)}})}
  const k=.15+.85*day;envMats.forEach(m=>{m.envMapIntensity=m.userData.env0*k});
  $('todChip').textContent=(day>.5?'☀ ':day>.1?'🌅 ':'🌙 ')+hhmm(hour);
  if($('t-light').classList.contains('on')){$('lTime').textContent=hhmm(hour);$('lPer').textContent=PERIOD(hour);$('lDay').textContent=(day*100).toFixed(0)+'%';$('lSun').textContent=(Math.asin(el)*180/Math.PI).toFixed(0)+'°';if(document.activeElement!==$('lSlide'))$('lSlide').value=Math.round(hour*60)%1440}
 }
 const onNames=()=>B.filter(b=>b.on).map(b=>b.name);
 return{update,freezeHour:value=>{S.mode='manual';hour=value;S.min=Math.round(value*60);$('lMode').value='manual';$('lFast').hidden=true;$('lSlide').value=S.min;dark=null;update(0)},setShade:f=>{shade=Math.max(0,Math.min(1,f))},setGain:factor=>{S.gain=Math.max(.1,Math.min(4,S.gain*factor));$('lGain').value=S.gain;update(0)},snapshot:()=>({settings:JSON.parse(JSON.stringify(S)),hour,bulbs:B.map(b=>b.on)}),restore:data=>{if(!data?.settings||!Number.isFinite(data.hour)||data.hour<0||data.hour>24)throw Error('Invalid lighting state');Object.assign(S,data.settings);hour=data.hour;if(Array.isArray(data.bulbs))data.bulbs.forEach((on,i)=>{if(B[i])B[i].on=!!on});paint();$('lMode').value=S.mode;$('lGain').value=S.gain;$('lAuto').checked=S.auto;update(0)},
  cols:['time_of_day','daylight_pct','bulbs_on'],
  row:()=>[hhmm(hour),(day*100).toFixed(0),B.filter(b=>b.on).length],
  info:()=>({time_of_day:hhmm(hour),period:PERIOD(hour),daylight_pct:+(day*100).toFixed(0),bulbs_on:onNames(),bulbs_total:B.length}),
  meta:()=>({clock:S.mode,...(S.mode==='fast'?{day_length:S.day+' '+S.unit}:{}),time_of_day:hhmm(hour),daylight:'0-100 %, from sun elevation (sunrise 06:00, sunset 18:00)',bulbs:B.map(b=>({name:b.name,x_m:b.x,y_m:-b.z,on:b.on})),brightness_gain:S.gain,auto_switch:S.auto})}
}
