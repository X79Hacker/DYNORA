// ===== landmark directions, like a person on the phone: "go past the blue sofa on your left, turn right at the white door frame,
//       it is next to the crate, opposite the bookshelf" =====
import * as THREE from 'three';

const ang=a=>Math.atan2(Math.sin(a),Math.cos(a));
const COLOR=/\b(red|orange|yellow|green|blue|purple|pink|white|grey|gray|black|brown|wooden|metal|glass)\b/;
// colour word for an object, from its biggest coloured part (so a painted object is described in its new colour)
function colourOf(o){let best=null,bv=0;const b=new THREE.Box3(),s=new THREE.Vector3();
 o.traverse(m=>{if(!m.isMesh||!m.material||!m.material.color||m.material.transparent&&m.material.opacity<.5)return;b.setFromObject(m);if(b.isEmpty())return;b.getSize(s);const v=s.x*s.y*s.z;if(v>bv){bv=v;best=m.material.color}});
 if(!best)return'';const h={};best.getHSL(h);const H=h.h*360,S=h.s,L=h.l;
 if(L<.12)return'black';if(L>.86)return'white';if(S<.14)return L>.6?'light grey':'grey';
 if(H<15||H>=345)return L>.65?'pink':'red';if(H<45)return L<.42?'brown':'orange';if(H<68)return L<.35?'brown':'yellow';
 if(H<165)return'green';if(H<200)return'teal';if(H<255)return'blue';if(H<290)return'purple';return'pink'}

// zone(x,z) names the area; people and other moving things are never used as landmarks
export function makeDirections({scene,zone:zoneOf}){
 const zone=(x,z)=>{const n=zoneOf(x,z);return /^(cashier|serving line)$/.test(n)?n+' area':n};   // "into the cashier area", not "into the cashier"
 const box=new THREE.Box3(),c=new THREE.Vector3(),q=new THREE.Vector3(),rc=new THREE.Raycaster();let walls=null;
 // a landmark only counts if no wall is between it and the point (you can see it from there)
 function seen(m,x,z){if(!walls){walls=[];scene.traverse(o=>{const p=o.isMesh&&o.geometry.parameters;if(p&&p.height===2.5)walls.push(o)})}
  const from=new THREE.Vector3(x,1,z),to=new THREE.Vector3(m.x,1,m.z),d=from.distanceTo(to);if(d<.05)return true;rc.set(from,to.sub(from).normalize());rc.far=d;
  const h=rc.intersectObjects(walls,false)[0];return!h||h.distance>=dist(m,x,z)-.05}   // a wall hit before the landmark's near side blocks the view
 function landmarks(){const L=[];scene.traverse(o=>{const l=o.userData.label;if(!l||!o.parent||/person|cook|cashier|human/.test(l)||o.userData.dyn&&!o.userData.pick)return;
   for(let p=o;p;p=p.parent)if(!p.visible)return;if(L.some(x=>x.o.getObjectById(o.id)))return;   // a labelled part inside a labelled object
   box.setFromObject(o);if(box.isEmpty()||box.max.y<.05)return;box.getCenter(c);const col=COLOR.test(l)?'':colourOf(o);
   const sz=/^(small|big|large|tall|low)\s/.exec(l);   // "the small orange box", not "the orange small box"
   L.push({o,label:l,name:'the '+(col?(sz?sz[0]+col+' '+l.slice(sz[0].length):col+' '+l):l),x:c.x,z:c.z,box:box.clone()})});return L}
 const dist=(m,x,z)=>{q.set(x,(m.box.min.y+m.box.max.y)/2,z);return m.box.distanceToPoint(q)};
 const nearest=(L,x,z,max,skip)=>{let b=null,bd=max;L.forEach(m=>{if(skip&&skip.has(m))return;const d=dist(m,x,z);if(d<bd&&seen(m,x,z)){bd=d;b=m}});return b};
 const side=(fx,fz,x,z,px,pz)=>((x-px)*fz-(z-pz)*fx)>0?'left':'right';   // left of the heading (fx,fz), seen from above
 const metres=d=>{const r=Math.max(.5,Math.round(d*2)/2);return'about '+(r%1?r.toFixed(1):r)+' m'};

 // corners: the path's turning points [[x,z], ...] from source to destination
 function describe(corners){const L=landmarks(),used=new Set();
  // drop corners where the path hardly bends or only wiggles (legs under 0.8 m), so "straight on" is one step
  const C=[corners[0]];for(let i=1;i<corners.length-1;i++){const a=C[C.length-1],b=corners[i],n=corners[i+1];
   if(Math.hypot(n[0]-b[0],n[1]-b[1])<.8||Math.hypot(b[0]-a[0],b[1]-a[1])<.8)continue;
   const d=ang(Math.atan2(-(n[1]-b[1]),n[0]-b[0])-Math.atan2(-(b[1]-a[1]),b[0]-a[0]));if(Math.abs(d)>.35)C.push(b)}C.push(corners[corners.length-1]);
  const [sx,sz]=C[0],[dx,dz]=C[C.length-1],steps=[],passing=[],said=new Set();
  // a name said before becomes "another …", so two brown chairs are not confused
  const nm=m=>{const n=m.name;if(said.has(n))return n.replace(/^the /,'another ');said.add(n);return n};
  // arrival landmarks first, so they are kept for the last sentence: right next to the nearest, opposite one across the arrival direction
  const[px,pz]=C[C.length-2],al=Math.hypot(dx-px,dz-pz)||1,afx=(dx-px)/al,afz=(dz-pz)/al,nx=nearest(L,dx,dz,1.2);
  let opp=null,od=4;L.forEach(m=>{if(m===nx)return;const vx=m.x-dx,vz=m.z-dz,v=Math.hypot(vx,vz),d=dist(m,dx,dz);if(d<.6||d>od||Math.abs((vx*afx+vz*afz)/v)>.55||!seen(m,dx,dz))return;
   if(nx&&side(afx,afz,m.x,m.z,dx,dz)===side(afx,afz,nx.x,nx.z,dx,dz))return;od=d;opp=m});
  if(nx)used.add(nx);if(opp)used.add(opp);
  const st=nearest(L,sx,sz,1.6,used);if(st)used.add(st);
  steps.push('Start '+(st?'next to '+nm(st)+' ':'')+'in the '+zone(sx,sz)+'.');
  for(let i=0;i<C.length-1;i++){const[ax,az]=C[i],[bx,bz]=C[i+1],len=Math.hypot(bx-ax,bz-az)||1,fx=(bx-ax)/len,fz=(bz-az)/len;
   // landmarks passed on this stretch (beside it, not at its ends)
   const pass=L.filter(m=>!used.has(m)).map(m=>{const t=((m.x-ax)*fx+(m.z-az)*fz)/len,px=ax+fx*len*Math.max(0,Math.min(1,t)),pz=az+fz*len*Math.max(0,Math.min(1,t));return{m,t,d:dist(m,px,pz),px,pz}})
    .filter(e=>e.t>.15&&e.t<.9&&e.d<1.2&&seen(e.m,e.px,e.pz)).sort((a,b)=>a.d-b.d).slice(0,len>3?2:1);
   pass.forEach(e=>{used.add(e.m);passing.push({name:e.m.name,side:side(fx,fz,e.m.x,e.m.z,ax,az),m:e.m,done:false})});
   const zn=zone(bx,bz),into=zn!==zone(ax,az)?' into the '+zn:'';
   steps.push((i?'Then go':'Go')+' straight for '+metres(len)+into+(pass.length?', passing '+pass.map(e=>nm(e.m)+' on your '+side(fx,fz,e.m.x,e.m.z,ax,az)).join(' and '):'')+'.');
   if(i<C.length-2){const[nx,nz]=C[i+2],d=ang(Math.atan2(-(nz-bz),nx-bx)-Math.atan2(-fz,fx)),deg=Math.abs(d)*180/Math.PI,lr=d>0?'left':'right';
    const verb=deg>140?'turn around to the '+lr:deg<55?'bear '+lr:'turn '+lr,at=nearest(L,bx,bz,1.5,used);if(at)used.add(at);
    steps.push(at?'At '+nm(at)+', '+verb+'.':verb[0].toUpperCase()+verb.slice(1)+'.')}}
  const parts=[nx&&'right next to '+nm(nx),opp&&'opposite '+nm(opp)].filter(Boolean);
  const arrive='The destination is '+(parts.length?parts.join(', ')+', ':'')+'in the '+zone(dx,dz)+'.';steps.push(arrive);
  return{text:steps.join(' '),steps,passing,arrive}}
 return{describe};
}
