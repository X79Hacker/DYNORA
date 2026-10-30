// ===== curtains: open / close one window (click its curtain) or all at once; closed curtains keep daylight out =====
import * as THREE from 'three';

const $=id=>document.getElementById(id);
const H=1.95,gather=y=>1-.5*Math.exp(-Math.pow((y+H/2-.95)/.2,2));   // same tie-back gather as curt() in the scenes
const WIDE=1.18,CLOSED_Z=.33,T=1.2;   // closed panel width factor, panel centre when closed (m from the window middle), seconds to open / close
const ease=k=>k*k*(3-2*k);

// panels: [[mesh, tieBack], ...] in pairs (left, right) per window; setShade(0..1) dims the daylight
export function initCurtains({panels,cam,renderer,envKey,setShade,say,log}){
 const P=panels.map(([m,tie])=>{m.userData.noBatch=true;m.userData.depthDeforming=true;tie.userData.noBatch=true;const a=m.geometry.attributes.position,open=a.array.slice(),closed=a.array.slice();
  for(let i=0;i<a.count;i++)closed[i*3+2]=open[i*3+2]/gather(open[i*3+1])*WIDE;   // closed: the gathered width spread out flat
  return{m,tie,open,closed,z0:m.position.z,k:0}});
 const N=P.length/2,goal=new Array(N).fill(0),KEY='rsw_curt_'+envKey;
 try{const s=JSON.parse(localStorage.getItem(KEY)||'[]');s.forEach((v,i)=>{if(i<N)goal[i]=v?1:0})}catch(e){}
 P.forEach((p,i)=>{p.k=goal[i>>1];apply(p)});
 const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(goal))}catch(e){}};
 function apply(p){const e=ease(p.k),a=p.m.geometry.attributes.position;for(let j=0;j<a.array.length;j++)a.array[j]=p.open[j]+(p.closed[j]-p.open[j])*e;
  a.needsUpdate=true;p.m.geometry.computeVertexNormals();p.m.position.z=p.z0+(Math.sign(p.z0)*CLOSED_Z-p.z0)*e;p.tie.visible=e<.5}
 const closedN=()=>goal.filter(Boolean).length;
 function set(w,v,quiet){if(goal[w]===v)return;goal[w]=v;save();show();if(!quiet){const t='Curtains '+(v?'closed':'opened')+' at window '+(w+1)+'.';say&&say(t,'info');log&&log('curtains',t)}}
 function all(v){for(let w=0;w<N;w++)set(w,v,true);const t='All curtains '+(v?'closed':'opened')+'.';say&&say(t,'info');log&&log('curtains',t)}

 // UI: card in the Lights tab + dock button
 const card=document.createElement('div');card.className='card';
 card.innerHTML=`<h3>Curtains <small>click a curtain to open / close it</small></h3><div class="btns"><button id="cuOpen">☀ Open all</button><button id="cuClose">🌙 Close all</button></div><div class="kv"><span>Closed</span><b id="cuN"></b></div>`;
 $('t-light').firstElementChild.after(card);
 const btn=document.createElement('button');btn.id='bCurt';btn.title='Open / close all curtains';btn.innerHTML='<i>🪟</i><b>Curtains</b>';$('bCam').after(btn);
 function show(){const n=closedN();$('cuN').textContent=n+' of '+N+' windows';btn.classList.toggle('on',n>0);btn.lastElementChild.textContent=n?'Open':'Close'}
 $('cuOpen').onclick=()=>all(0);$('cuClose').onclick=()=>all(1);btn.onclick=()=>all(closedN()?0:1);show();

 // a short click on a curtain toggles that window (not while a point is being picked on the map)
 const cv=renderer.domElement,rc=new THREE.Raycaster(),mv=new THREE.Vector2();let dx=0,dy=0;
 cv.addEventListener('pointerdown',e=>{dx=e.clientX;dy=e.clientY});
 cv.addEventListener('pointerup',e=>{if(e.button!==0||Math.hypot(e.clientX-dx,e.clientY-dy)>5||document.body.classList.contains('picking'))return;
  const r=cv.getBoundingClientRect();mv.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);rc.setFromCamera(mv,cam);
  const h=rc.intersectObjects(P.map(p=>p.m),false)[0];if(h){const w=P.findIndex(p=>p.m===h.object)>>1;set(w,goal[w]?0:1)}});

 function update(dt){let s=0;P.forEach((p,i)=>{const g=goal[i>>1];if(p.k!==g){p.k+=Math.sign(g-p.k)*Math.min(Math.abs(g-p.k),dt/T);apply(p)}s+=p.k});setShade(N?s/P.length:0)}
 return{update,snapshot:()=>({goals:[...goal],positions:P.map(p=>p.k)}),restore:data=>{if(!Array.isArray(data.goals)||data.goals.length!==N||!Array.isArray(data.positions)||data.positions.length!==P.length)throw Error('Curtain state differs');data.goals.forEach((v,i)=>goal[i]=v?1:0);P.forEach((p,i)=>{p.k=Math.max(0,Math.min(1,data.positions[i]));apply(p)});show();update(0)},info:()=>({windows:N,closed:closedN()})};
}
