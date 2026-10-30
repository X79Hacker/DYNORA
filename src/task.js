import {randomStream} from './app-random.js';
const random=randomStream('task');
// ===== random navigation subtask: robot spawns at a random source and drives a planned path to a random destination =====
import * as THREE from 'three';
import {makeDirections} from './directions.js';

const $=id=>document.getElementById(id);
const CELL=.1,INFL=.28,TALL=.5;   // grid size, robot half-width + margin, highest thing the robot can drive under
const N8=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
// map picking: a short click (not an orbit drag) goes to the picker while one is waiting
let picker=null,dx0=0,dy0=0;
addEventListener('pointerdown',e=>{dx0=e.clientX;dy0=e.clientY},true);
addEventListener('pointerup',e=>{if(picker&&e.button===0&&Math.hypot(e.clientX-dx0,e.clientY-dy0)<5)picker(e)},true);

// setRoute(points) puts the robot on a one-way path from points[0]; progress() is 0..1 along it
export function initTask({scene,cam,renderer,obstacles,robot,zone,setRoute,progress,say,log}){
 let G=null,task=null,chainT=0,snap=new Map();const DIR=makeDirections({scene,zone});const box=new THREE.Box3(),pt=new THREE.Vector3();
 // ----- occupancy grid: floor planes are walkable, obstacles (inflated) are not; people, carts and doors are ignored -----
 function grid(){scene.updateMatrixWorld(true);const floors=[];
  // real floors are planes placed straight in the scene (not the shadow patches under movable objects, which can be pushed anywhere)
  scene.children.forEach(o=>{const p=o.isMesh&&o.geometry.type==='PlaneGeometry'&&o.geometry.parameters;if(p&&Math.abs(o.rotation.x+Math.PI/2)<.01&&o.position.y<.02&&p.width*p.height>.9){box.setFromObject(o);if(isFinite(box.min.x)&&isFinite(box.max.z))floors.push(box.clone())}});
  const W=new THREE.Box3();floors.forEach(b=>W.union(b));if(W.isEmpty())W.set(new THREE.Vector3(-1,0,-1),new THREE.Vector3(1,0,1));
  const x0=W.min.x,z0=W.min.z,nx=Math.min(1200,Math.ceil((W.max.x-x0)/CELL)),nz=Math.min(1200,Math.ceil((W.max.z-z0)/CELL)),c=new Uint8Array(nx*nz);   // 0 out, 1 free, 2 blocked; at most 120 × 120 m
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const x=x0+(i+.5)*CELL,z=z0+(j+.5)*CELL;if(floors.some(b=>x>b.min.x+.05&&x<b.max.x-.05&&z>b.min.z+.05&&z<b.max.z-.05))c[j*nx+i]=1}
  const skip=m=>{for(let p=m;p;p=p.parent){const u=p.userData;if(u.dyn&&!u.pick||/door$/.test(u.label||''))return true}return false};
  obstacles.forEach(m=>{if(skip(m))return;
   // a merged mesh along a curve (a fence in the obstacle track): block around its own points, not its whole bounding box
   if(m.userData.fine){const a=m.geometry.attributes.position,e=Math.ceil(INFL/CELL);m.updateMatrixWorld();for(let v=0;v<a.count;v++){pt.fromBufferAttribute(a,v).applyMatrix4(m.matrixWorld);if(pt.y>TALL)continue;
     const ci=Math.floor((pt.x-x0)/CELL),cj=Math.floor((pt.z-z0)/CELL);for(let j=cj-e;j<=cj+e;j++)for(let i=ci-e;i<=ci+e;i++){if(i<0||j<0||i>=nx||j>=nz||!c[j*nx+i])continue;   // a circle of INFL around the point (a square would close a diagonal lane)
      if(Math.hypot(x0+(i+.5)*CELL-pt.x,z0+(j+.5)*CELL-pt.z)<=INFL)c[j*nx+i]=2}}return}
   box.setFromObject(m);if(box.isEmpty()||box.min.y>TALL)return;
   const i0=Math.max(0,Math.floor((box.min.x-INFL-x0)/CELL)),i1=Math.min(nx-1,Math.floor((box.max.x+INFL-x0)/CELL)),j0=Math.max(0,Math.floor((box.min.z-INFL-z0)/CELL)),j1=Math.min(nz-1,Math.floor((box.max.z+INFL-z0)/CELL));
   for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)if(c[j*nx+i])c[j*nx+i]=2});
  // the floor edge is a wall too
  const e=Math.ceil(INFL/CELL),c2=c.slice();for(let j=0;j<nz;j++)for(let i=0;i<nx;i++)if(c[j*nx+i]===1){for(let dj=-e;dj<=e;dj++)for(let di=-e;di<=e;di++){const a=i+di,b=j+dj;if(a<0||b<0||a>=nx||b>=nz||!c[b*nx+a]){c2[j*nx+i]=2;dj=e+1;break}}}
  return{x0,z0,nx,nz,c:c2}}
 const free=(g,i,j)=>i>=0&&j>=0&&i<g.nx&&j<g.nz&&g.c[j*g.nx+i]===1;
 const wpos=(g,k)=>[g.x0+((k%g.nx)+.5)*CELL,g.z0+(Math.floor(k/g.nx)+.5)*CELL];
 function reach(g,s){const seen=new Int32Array(g.nx*g.nz).fill(-1),q=[s];seen[s]=s;for(let h=0;h<q.length;h++){const k=q[h],i=k%g.nx,j=(k-i)/g.nx;for(const[di,dj]of N8){const a=i+di,b=j+dj;if(free(g,a,b)&&seen[b*g.nx+a]<0&&free(g,i+di,j)&&free(g,i,j+dj)){seen[b*g.nx+a]=k;q.push(b*g.nx+a)}}}return q}
 // A* (8-neighbour, no corner cutting)
 function astar(g,s,t){const n=g.nx*g.nz,gs=new Float32Array(n).fill(1e9),from=new Int32Array(n).fill(-1),open=[[0,s]],tx=t%g.nx,tz=(t-tx)/g.nx,h=k=>{const i=k%g.nx,j=(k-i)/g.nx,dx=Math.abs(i-tx),dz=Math.abs(j-tz);return Math.max(dx,dz)+.414*Math.min(dx,dz)};gs[s]=0;
  while(open.length){let bi=0;for(let q=1;q<open.length;q++)if(open[q][0]<open[bi][0])bi=q;const[,k]=open[bi];open[bi]=open[open.length-1];open.pop();if(k===t)break;const i=k%g.nx,j=(k-i)/g.nx;
   for(const[di,dj,w]of N8){const a=i+di,b=j+dj,m=b*g.nx+a;if(!free(g,a,b)||!free(g,i+di,j)||!free(g,i,j+dj))continue;const ng=gs[k]+w;if(ng<gs[m]){gs[m]=ng;from[m]=k;open.push([ng+h(m),m])}}}
  if(from[t]<0)return null;const p=[t];while(p[0]!==s)p.unshift(from[p[0]]);return p}
 // straight-line check on the grid, used to drop needless waypoints
 function los(g,a,b){const[ax,az]=wpos(g,a),[bx,bz]=wpos(g,b),L=Math.hypot(bx-ax,bz-az),n=Math.ceil(L/(CELL/2));for(let s=0;s<=n;s++){const x=ax+(bx-ax)*s/n,z=az+(bz-az)*s/n;if(!free(g,Math.floor((x-g.x0)/CELL),Math.floor((z-g.z0)/CELL)))return false}return true}
 function smooth(g,p){const out=[p[0]];let a=0;while(a<p.length-1){let b=p.length-1;while(b>a+1&&!los(g,p[a],p[b]))b--;out.push(p[b]);a=b}
  // dense points keep the smooth curve close to the planned straight lines
  const pts=[];for(let q=0;q<out.length-1;q++){const[ax,az]=wpos(g,out[q]),[bx,bz]=wpos(g,out[q+1]),n=Math.max(1,Math.round(Math.hypot(bx-ax,bz-az)/.4));for(let s=0;s<n;s++)pts.push(new THREE.Vector3(ax+(bx-ax)*s/n,.03,az+(bz-az)*s/n))}
  const[ex,ez]=wpos(g,out[out.length-1]);pts.push(new THREE.Vector3(ex,.03,ez));pts.corners=out.map(k=>wpos(g,k));return pts}
 // ----- place names: nearest labelled object + zone -----
 function place(x,z){let best=null,bd=2;pt.set(x,.4,z);scene.traverse(o=>{if(!o.userData.label||!o.parent||o.userData.dyn&&!o.userData.pick)return;for(let p=o;p;p=p.parent)if(!p.visible)return;box.setFromObject(o);if(box.isEmpty())return;const d=box.distanceToPoint(pt);if(d<bd){bd=d;best=o.userData.label}});
  const zn=zone(x,z);return{zone:zn,object:best,text:best?'the '+best+' ('+zn+')':'the '+zn}}
 // ----- markers (main view only, never in robot camera images or sensor rays) -----
 const mk=(col,flag)=>{const g=new THREE.Group(),m=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.85,side:THREE.DoubleSide,depthWrite:false});
  const r=new THREE.Mesh(new THREE.RingGeometry(.22,.32,40),m);r.rotation.x=-Math.PI/2;r.position.y=.02;g.add(r);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,1.1,8),new THREE.MeshBasicMaterial({color:0xe5e7eb}));pole.position.y=.55;g.add(pole);
  const f=new THREE.Mesh(flag?new THREE.PlaneGeometry(.3,.2):new THREE.CircleGeometry(.1,24),m);f.position.set(flag?.15:0,flag?1:1.15,0);g.add(f);
  g.traverse(o=>o.layers.set(1));g.visible=false;g.userData.noPaint=true;scene.add(g);return g};
 const S=mk(0x22c55e,false),D=mk(0xef4444,true);

 // sp / dp: grid cells the user picked on the map or wrote, or null for a random choice; names: {s, d} the written names
 function newTask(sp=null,dp=null,g=grid(),names={}){G=g;const frees=[];for(let k=0;k<g.c.length;k++)if(g.c[k]===1)frees.push(k);if(!frees.length){say('No free floor for a task.','info');return false}
  for(let tries=0;tries<40;tries++){const s=sp??frees[Math.floor(random()*frees.length)],R=reach(g,s);if(sp===null&&R.length<300)continue;
   const[sx,sz]=wpos(g,s);let d=dp;
   if(d===null){const far=R.filter(k=>{const[x,z]=wpos(g,k);return Math.hypot(x-sx,z-sz)>3});if(!far.length){if(sp!==null)break;continue}d=far[Math.floor(random()*far.length)]}
   else if(!R.includes(d)){if(sp===null)continue;newTask.why='The robot cannot reach that destination from that source. Choose again.';say(newTask.why,'info');return false}
   if(d===s){newTask.why='Source and destination are the same spot. Choose again.';say(newTask.why,'info');return false}
   const p=astar(g,s,d);if(!p){if(sp!==null&&dp!==null)break;continue}const pts=smooth(g,p);if(pts.length<2)continue;
   const[dx,dz]=wpos(g,d),named=(p,n)=>n?{...p,text:n+(n.endsWith(p.zone)?'':' ('+p.zone+')')}:p,from=named(place(sx,sz),sp!==null&&names.s),to=named(place(dx,dz),dp!==null&&names.d),len=pts.reduce((a,v,i)=>i?a+v.distanceTo(pts[i-1]):0,0);
   task={id:(task?task.id:0)+1,source:{x_m:+sx.toFixed(2),y_m:+(-sz).toFixed(2),...from},destination:{x_m:+dx.toFixed(2),y_m:+(-dz).toFixed(2),...to},path_m:+len.toFixed(1),done:false};
   task.instruction='Go from '+from.text+' to '+to.text+'.';
   S.position.set(sx,0,sz);D.position.set(dx,0,dz);D.rotation.y=Math.atan2(-(pts[pts.length-1].z-pts[pts.length-2].z),pts[pts.length-1].x-pts[pts.length-2].x);S.visible=D.visible=true;
   // remember where movable things were when the path was planned
   snap=new Map();obstacles.forEach(m=>{if(m.userData.pick&&m.parent)snap.set(m.parent,[m.parent.position.x,m.parent.position.z,m.parent.rotation.y])});
   // landmark directions, as a person would give them on the phone
   task.dir=DIR.describe(pts.corners);task.directions=task.dir.text;
   setRoute(pts);show();say('New task '+task.id+': '+task.instruction+' Path '+task.path_m+' m.','start');say('Directions: '+task.directions,'info');log('task','Task '+task.id+' started. '+task.instruction+' Directions: '+task.directions);return true}
  newTask.why=sp!==null||dp!==null?'No path found for that choice (the place may be fenced off from the rest). Choose other places.':'Could not find a reachable destination. Try again.';say(newTask.why,'info');return false}

 // ----- picking points on the map: click the floor; the click snaps to the nearest free spot -----
 const rc=new THREE.Raycaster(),mv=new THREE.Vector2(),FLOOR=new THREE.Plane(new THREE.Vector3(0,1,0),0);let pk=null;
 function snapCell(g,x,z,maxR=8){const ci=Math.floor((x-g.x0)/CELL),cj=Math.floor((z-g.z0)/CELL);for(let r=0;r<=maxR;r++){let best=-1,bd=1e9;
  for(let dj=-r;dj<=r;dj++)for(let di=-r;di<=r;di++){if(Math.max(Math.abs(di),Math.abs(dj))!==r||!free(g,ci+di,cj+dj))continue;const d=di*di+dj*dj;if(d<bd){bd=d;best=(cj+dj)*g.nx+ci+di}}if(best>=0)return best}return -1}
 // ----- written places: an object's name ("sofa"), an area's name ("kitchen"), or "x, y" in metres (x east, y north, as in the CSV) -----
 const norm=s=>(s||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\b(the|a|an|to|at|near|next|by|go|from)\b/g,' ').replace(/\s+/g,' ').trim();
 const score=(name,q)=>{const n=norm(name);return !q?0:n===q?3:n.includes(q)?2:q.split(' ').every(w=>n.includes(w))?1:0};   // exact, part of the name, all words
 function labelled(){const L=[];scene.traverse(o=>{const l=o.userData.label;if(!l||!o.parent||/person|human/.test(l)||o.userData.dyn&&!o.userData.pick)return;for(let p=o;p;p=p.parent)if(!p.visible)return;if(L.some(x=>x.o.getObjectById(o.id)))return;L.push({o,label:l})});return L}
 function zonesOf(g){const Z=new Map();for(let k=0;k<g.c.length;k++)if(g.c[k]===1){const[x,z]=wpos(g,k),n=zone(x,z);if(!Z.has(n))Z.set(n,[]);Z.get(n).push(k)}return Z}
 function placeNames(){const g=grid(),n=new Set();labelled().forEach(c=>n.add(c.label));zonesOf(g).forEach((v,k)=>n.add(k));return[...n].sort()}
 // → {k: the free floor cell to use, text} or {err}; several matching objects (four "chair"s): the one nearest to `near` [x, z]
 function resolve(txt,g,near){const raw=(txt||'').trim();if(!raw)return{err:'write a place first (an object, an area, or x, y in metres).'};
  const m=raw.match(/^\(?\s*(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)\s*\)?$/);
  if(m){const k=snapCell(g,+m[1],-m[2],12);return k<0?{err:'the robot cannot stand at '+raw+' (no free floor within 1.2 m).'}:{k,text:'the point ('+(+m[1])+', '+(+m[2])+')'}}
  const q=norm(raw);let best=null;
  labelled().forEach(c=>{const s=score(c.label,q);if(!s)return;box.setFromObject(c.o);if(box.isEmpty())return;const ctr=box.getCenter(new THREE.Vector3()),d=near?Math.hypot(ctr.x-near[0],ctr.z-near[1]):0;
   if(!best||s>best.s||s===best.s&&d<best.d)best={s,d,x:ctr.x,z:ctr.z,text:'the '+c.label}});
  zonesOf(g).forEach((cells,n)=>{const s=score(n,q);if(!s||best&&s<best.s)return;let cx=0,cz=0;cells.forEach(k=>{const[x,z]=wpos(g,k);cx+=x;cz+=z});cx/=cells.length;cz/=cells.length;   // an area: its middle (areas win a tie with objects)
   let bk=cells[0],bd=1e9;cells.forEach(k=>{const[x,z]=wpos(g,k),d=(x-cx)**2+(z-cz)**2;if(d<bd){bd=d;bk=k}});best={s,d:0,k:bk,text:'the '+n}});
  if(!best){const all=placeNames();return{err:'no place called "'+raw+'" here. Try: '+all.slice(0,8).join(', ')+(all.length>8?' …':'')+'.'}}
  if(best.k===undefined){best.k=snapCell(g,best.x,best.z,30);if(best.k<0)return{err:'there is no free floor next to '+best.text+'.'}}   // an object: the nearest free floor beside it
  return{k:best.k,text:best.text}}
 // pre: written choices already resolved, {s, d, g, ns, nd} (cells and their names)
 function startPick(wantS,wantD,pre={}){if(!wantS&&!wantD)return newTask();pk={wantS,wantD,s:pre.s??null,d:pre.d??null,R:null,g:pre.g||grid(),ns:pre.ns,nd:pre.nd};S.visible=D.visible=false;
  if(pk.s!==null){pk.R=new Set(reach(pk.g,pk.s));const[x,z]=wpos(pk.g,pk.s);S.position.set(x,0,z);S.visible=true}document.body.classList.add('picking');ask()}
 function ask(){const src=pk.wantS&&pk.s===null;say('Click the floor to set the '+(src?'SOURCE (green ring)':'DESTINATION (red flag)')+'. Esc cancels.','info');$('tkPick').textContent=src?'📍 Click the floor: source':'📍 Click the floor: destination';$('tkPick').hidden=false}
 function endPick(){pk=null;document.body.classList.remove('picking');$('tkPick').hidden=true}
 picker=e=>{if(!pk||e.target!==renderer.domElement)return;const r=e.target.getBoundingClientRect();mv.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);rc.setFromCamera(mv,cam);
  const hit=rc.ray.intersectPlane(FLOOR,new THREE.Vector3());const g=pk.g,k=hit?snapCell(g,hit.x,hit.z):-1;if(k<0){say('The robot cannot stand there. Click open floor.','info');return}
  const[x,z]=wpos(g,k);
  if(pk.wantS&&pk.s===null){pk.s=k;pk.R=new Set(reach(g,k));S.position.set(x,0,z);S.visible=true;if(pk.wantD)return ask();const p=pk;endPick();if(!newTask(p.s,p.d,p.g,{d:p.nd}))startPick(true,false,{d:p.d,g:p.g,nd:p.nd});return}
  if(pk.R&&!pk.R.has(k)){say('The robot cannot reach that spot from the source. Pick another destination.','info');return}
  const p=pk;endPick();if(!newTask(p.s,k,p.g,{s:p.ns}))startPick(p.wantS,true,p.wantS?{g:p.g}:{s:p.s,g:p.g,ns:p.ns})};
 function clear(){task=null;S.visible=D.visible=false;show()}
 function show(){$('tkInfo').innerHTML=task?`<div class="kv"><span>Task</span><b>#${task.id} · ${task.done?'done ✓':'running'}</b></div><div class="kv"><span>From</span><b>${task.source.text}</b></div><div class="kv"><span>To</span><b>${task.destination.text}</b></div><div class="kv"><span>Path</span><b>${task.path_m} m</b></div><p class="mut dirs">🧭 ${task.directions||''}</p>`:'<p class="mut">No task. The robot follows its normal route.</p>'}

 // UI: dock button + card in the Build tab; drawing a path or restoring the default route ends the task
 const btn=document.createElement('button');btn.id='bTask';btn.title='New task: spawn the robot at a source and drive to a destination: random, picked on the map or written (T)';btn.innerHTML='<i>🚩</i><b>Task</b>';$('bDrive').before(btn);
 const card=document.createElement('div');card.className='card';card.innerHTML='<h3>Task <small>source → destination</small></h3><div class="btns"><button id="tkGo">🚩 New task…</button><button id="tkEnd">✖ End task</button></div><label class="chk"><input id="tkChain" type="checkbox"> Start the next (random) task on arrival</label><div id="tkInfo"></div>';
 $('bDraw').closest('.card').before(card);
 // dialog: random, picked on the map or written, separately for source and destination (last choices and texts are remembered)
 let C={src:'random',dst:'random',srcTxt:'',dstTxt:''};try{Object.assign(C,JSON.parse(localStorage.getItem('rsw_task_pick')||'{}'))}catch(e){}
 const saveC=()=>{try{localStorage.setItem('rsw_task_pick',JSON.stringify(C))}catch(x){}};
 const pop=document.createElement('div');pop.id='taskPop';pop.className='card';pop.hidden=true;
 const seg=k=>`<div class="seg pm" data-k="${k}"><button data-v="random">🎲 Random</button><button data-v="pick">📍 Pick on map</button><button data-v="text">✍ Write</button></div>
<input id="tp_${k}" list="tpList" autocomplete="off" placeholder="e.g. sofa · kitchen · 2.5, -1" style="width:100%;box-sizing:border-box;margin:2px 0 6px" hidden>`;
 pop.innerHTML=`<h3>New task <button id="tpX" class="ghost" title="Close (Esc)">✕</button></h3><div class="tpl">Source <small>(robot starts here)</small></div>${seg('src')}<div class="tpl">Destination <small>(robot drives here)</small></div>${seg('dst')}
<datalist id="tpList"></datalist><p class="mut" id="tpHint" style="margin:4px 0 0;font-size:11px">✍ Write: an object (sofa, swing gate), an area (kitchen, gravel patch) or x, y in metres (x east, y north).</p><p id="tpErr" style="margin:4px 0 0;font-size:12px;color:#f87171" hidden></p><button id="tpGo">▶ Start task</button>`;
 document.body.append(pop);
 const tip=document.createElement('div');tip.id='tkPick';tip.hidden=true;document.body.append(tip);
 const paintSeg=()=>pop.querySelectorAll('.seg').forEach(s=>{const k=s.dataset.k;s.querySelectorAll('button').forEach(b=>b.classList.toggle('on',C[k]===b.dataset.v));$('tp_'+k).hidden=C[k]!=='text'});
 pop.onclick=e=>{const b=e.target.closest('.seg button');if(b){const k=b.parentNode.dataset.k;C[k]=b.dataset.v;paintSeg();saveC();if(C[k]==='text')$('tp_'+k).focus()}};
 ['src','dst'].forEach(k=>{const el=$('tp_'+k);el.value=C[k+'Txt']||'';el.oninput=()=>{C[k+'Txt']=el.value;saveC();$('tpErr').hidden=true};el.onkeydown=e=>{if(e.key==='Enter')$('tpGo').click();if(e.key==='Escape')pop.hidden=true}});
 const open=()=>{if(pk)endPick();$('tpList').innerHTML=placeNames().map(n=>`<option value="${n}">`).join('');$('tpErr').hidden=true;paintSeg();pop.hidden=false;$('tpGo').focus()};
 const fail=t=>{$('tpErr').textContent=t;$('tpErr').hidden=false;say(t,'info')};
 $('tpX').onclick=()=>{pop.hidden=true};
 $('tpGo').onclick=()=>{const g=grid();let s=null,d=null,ns,nd;
  if(C.src==='text'){const r=resolve($('tp_src').value,g,[robot.position.x,robot.position.z]);if(r.err)return fail('Source: '+r.err);s=r.k;ns=r.text}
  if(C.dst==='text'){const r=resolve($('tp_dst').value,g,s!==null?wpos(g,s):[robot.position.x,robot.position.z]);if(r.err)return fail('Destination: '+r.err);d=r.k;nd=r.text}
  if(s!==null&&d!==null&&!reach(g,s).includes(d))return fail('The robot cannot drive from '+ns+' to '+nd+' (no free way between them).');
  pop.hidden=true;const wantS=C.src==='pick',wantD=C.dst==='pick';
  if(wantS||wantD)startPick(wantS,wantD,{s,d,g,ns,nd});else if(!newTask(s,d,g,{s:ns,d:nd})){open();fail(newTask.why||'No path found for that choice.')}};   // failed: the dialog comes back with the reason
 btn.onclick=$('tkGo').onclick=open;$('tkEnd').onclick=()=>{if(pk)endPick();if(task){clear();$('bDefault').click()}};
 ['bDefault','bFinish'].forEach(id=>$(id).addEventListener('click',()=>{if(task)clear()}));
 addEventListener('keydown',e=>{if(/INPUT|SELECT/.test(document.activeElement.tagName))return;if(e.code==='KeyT')pop.hidden?open():pop.hidden=true;
  if(e.code==='Escape'){if(!pop.hidden)pop.hidden=true;else if(pk){endPick();if(task){S.visible=D.visible=true}say('Picking cancelled.','info')}}});
 show();

 function update(dt){if(!task)return;
  // say each landmark from the directions as the robot passes it
  if(!task.done&&task.dir)task.dir.passing.forEach(p=>{if(p.done)return;const b=p.m.box;pt.set(robot.position.x,(b.min.y+b.max.y)/2,robot.position.z);if(b.distanceToPoint(pt)<.9){p.done=true;say('Passing '+p.name+' on the '+p.side+'.','info')}});
  if(!task.done&&progress()>=.999){task.done=true;show();say('Task '+task.id+' complete: the bot reached '+task.destination.text+'. '+(task.dir?task.dir.arrive.replace('The destination is','It is now'):''),'end');log('task_done','Task '+task.id+' complete. The robot reached '+task.destination.text+'.');chainT=2.5}
  if(task.done&&$('tkChain').checked&&(chainT-=dt)<=0)newTask()}
 // during a task the path already keeps clear of furniture, so only things moved or added since planning block it
 const blocks=m=>{if(!task||!m.userData.pick)return true;const s=snap.get(m.parent),g=m.parent;return !s||Math.hypot(g.position.x-s[0],g.position.z-s[1])>.05||Math.abs(g.rotation.y-s[2])>.05};
 // path planning for others (walking people): the grid is rebuilt at most every 3 s
 let GC=null,GT=0;const gridC=()=>{const now=performance.now();if(!GC||now-GT>3000){GC=grid();GT=now}return GC};
 function plan(x0,z0,x1,z1){const g=gridC(),s=snapCell(g,x0,z0),d=snapCell(g,x1,z1);if(s<0||d<0||s===d)return null;const p=astar(g,s,d);return p?smooth(g,p):null}
 function randomPoint(x,z,lo=2,hi=8){const g=gridC(),s=snapCell(g,x,z);if(s<0)return null;const R=reach(g,s).filter(k=>{const[a,b]=wpos(g,k),d=Math.hypot(a-x,b-z);return d>lo&&d<hi});return R.length?wpos(g,R[Math.floor(random()*R.length)]):null}
 return{update,blocks,plan,randomPoint,info:()=>task&&{id:task.id,instruction:task.instruction,source:task.source,destination:task.destination,path_m:task.path_m,done:task.done,directions:task.directions,directions_steps:task.dir&&task.dir.steps}};
}
