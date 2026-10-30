// ===== real-world physics numbers shared by rolling and falling: mass, air drag, rolling resistance, bounce =====
import * as THREE from 'three';
import {GRAVITY} from './dynamics.js';

export const G=GRAVITY,RHO=1.2;   // gravity 9.8 m/s² (always), air density kg/m³
// by label: mass kg, restitution e (bounce), rolling resistance crr, inertia factor k = I/(m r²)
const TABLE=[[/tennis/,{m:.058,e:.72,crr:.03,k:2/3}],[/football/,{m:.43,e:.65,crr:.025,k:2/3}],[/red ball/,{m:.35,e:.6,crr:.02,k:2/3}],   // 40 cm playground ball
 [/water bottle/,{m:.3,e:.25,crr:.04,k:1}],[/glass bottle/,{m:.5,e:.2,crr:.04,k:1}],[/metal can/,{m:.35,e:.3,crr:.03,k:1}],   // half-full / empty
 [/cardboard box/,{m:1.5,e:.1}],[/small box/,{m:.8,e:.1}],[/crate/,{m:8,e:.1}],[/table with chairs/,{m:55,e:.05}]/* 25 kg table + 6 chairs */,[/chair/,{m:5,e:.1}],[/dining table/,{m:25,e:.05}],[/coffee table/,{m:15,e:.05}],[/TV unit/,{m:30,e:.05}],[/^desk/,{m:30,e:.05}],[/sofa/,{m:45,e:.05}],
 [/bookshelf/,{m:40,e:.05}],[/bin/,{m:3,e:.15}],[/plant/,{m:6,e:.1}],[/trolley|cart/,{m:15,e:.1}]];
const box=new THREE.Box3(),sz=new THREE.Vector3();
// physical properties of an object (worked out once, then kept in userData.phys; mass can be edited)
export function props(o){if(o.userData.phys)return o.userData.phys;const l=o.userData.label||'',r=o.userData.roll,t=(TABLE.find(([re])=>re.test(l))||[,{}])[1];
 box.setFromObject(o);box.getSize(sz);
 const p={m:t.m??Math.min(60,Math.max(.2,sz.x*sz.y*sz.z*150)),e:t.e??.1,crr:t.crr??.3,k:t.k??.5};
 if(r&&r.kind==='sphere'){p.cd=.47;p.A=Math.PI*r.r*r.r}else if(r){p.cd=.82;p.A=2*r.r*r.h}else{p.cd=1.05;p.A=Math.max(.01,sz.x*sz.y)}
 return o.userData.phys=p}
// deceleration from air drag at speed v (m/s²)
export const drag=(p,v)=>.5*RHO*p.cd*p.A*v*v/p.m;
// a push makes the object slide, then friction makes it roll; the speed left once it rolls without slipping
export const rollKeep=p=>1/(1+p.k);
