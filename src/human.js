import * as THREE from 'three';
import {createRealisticHuman} from './realistic-human.js';
// Articulated, realistic-proportion human (~1.78 m): lathe torso, tapered limbs with knee/elbow joints, face details.
export function makeHuman(o = {}) {
  const realistic=createRealisticHuman(o);if(realistic)return realistic;
  const { skin = 0xe0ac69, shirt = 0x2563eb, pants = 0x1f2937, hair = 0x2b1d14, shoes = 0x1a1a1a, female = false, longSleeve = false } = o;
  const M = (c, r, role='paint') => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: r }); m.envMapIntensity = .7; m.userData.surface=role; return m };
  const mSk = M(skin, .72, 'skin'), mSh = M(shirt, .92, 'fabric'), mPa = M(pants, .93, 'fabric'), mHa = M(hair, .9, 'hair'), mSo = M(shoes, .85, 'rubber'), mW = M(0xf5f5f5, .3), mDk = M(0x151515, .4), mLip = M(0x8b3a3a, .6);
  const g = new THREE.Group(), meshes = [];g.userData.human=true;
  const add = (p, geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; p.add(m); meshes.push(m); return m };
  const cyl = (a, b, h) => new THREE.CylinderGeometry(a, b, h, 16), sph = r => new THREE.SphereGeometry(r, 20, 14);
  const hip = new THREE.Group(); hip.position.y = .95; g.add(hip);
  add(hip, sph(.17), mPa, 0, 0, 0, .8, .7, 1.15);
  const torso = new THREE.Group(); torso.position.y = .04; hip.add(torso);
  const prof = [[.14, 0], [.15, .1], [.14, .2], [.155, .32], [.17, .44], [.16, .52], [.07, .6]].map(p => new THREE.Vector2(p[0], p[1]));
  add(torso, new THREE.LatheGeometry(prof, 24), mSh, 0, 0, 0, .78, 1, 1.3);
  if (female) [-1, 1].forEach(s => add(torso, sph(.06), mSh, .09, .38, s * .055, 1, 1, .9));
  add(torso, cyl(.045, .05, .1), mSk, 0, .64, 0);
  add(torso, new THREE.TorusGeometry(.055, .012, 8, 16), mSh, 0, .6, 0).rotation.x = Math.PI / 2;
  const hd = new THREE.Group(); hd.position.set(0, .78, 0); torso.add(hd);
  add(hd, sph(.105), mSk, 0, 0, 0, .98, 1.18, .92);
  add(hd, sph(.017), mSk, .1, -.015, 0, 1.3, 1, .9);
  [-1, 1].forEach(s => {
    add(hd, sph(.014), mW, .088, .025, s * .04, .6, .8, 1); add(hd, sph(.008), mDk, .097, .025, s * .04);
    add(hd, new THREE.BoxGeometry(.01, .006, .035), mHa, .093, .052, s * .04); add(hd, sph(.02), mSk, 0, 0, s * .1, .6, 1.2, .6);
  });
  add(hd, new THREE.BoxGeometry(.008, .006, .04), mLip, .09, -.05, 0);
  add(hd, new THREE.SphereGeometry(.112, 20, 14, 0, Math.PI * 2, 0, Math.PI * .58), mHa, -.008, .012, 0, 1, 1.2, .96);
  add(hd, sph(.1), mHa, -.04, -.005, 0, .9, 1.1, .95);
  if (female) add(hd, cyl(.09, .06, .3), mHa, -.06, -.15, 0, .8, 1, 1.1);
  const belt=add(hip,new THREE.TorusGeometry(.135,.009,6,24),mSo,0,.025,0,.8,1,1.2);belt.rotation.x=Math.PI/2;
  for(let i=0;i<4;i++)add(torso,sph(.0035),mDk,.126,.13+i*.075,0);
  const pocket=add(torso,new THREE.BoxGeometry(.003,.075,.055),mSh,.134,.36,.063);pocket.rotation.z=.07;
  const arm = sd => { const sh = new THREE.Group(); sh.position.set(0, .52, sd * .2); torso.add(sh);
    add(sh, sph(.05), mSh); add(sh, cyl(.042, .036, .28), mSh, 0, -.14, 0);
    const el = new THREE.Group(); el.position.y = -.28; sh.add(el); const ms = longSleeve ? mSh : mSk;
    add(el, sph(.035), ms); add(el, cyl(.034, .026, .26), ms, 0, -.13, 0); add(el, sph(.03), mSk, 0, -.29, 0, .8, 1.3, 1); return { sh, el } };
  const leg = sd => { const hp = new THREE.Group(); hp.position.set(0, -.02, sd * .085); hip.add(hp);
    add(hp, cyl(.077, .058, .45), mPa, 0, -.225, 0);
    const kn = new THREE.Group(); kn.position.y = -.45; hp.add(kn);
    add(kn, sph(.054), mPa); add(kn, cyl(.055, .04, .43), mPa, 0, -.215, 0); add(kn, sph(.052), mSo, .05, -.45, 0, 2.1, .9, 1.1); return { hp, kn } };
  const L = leg(1), R = leg(-1), AL = arm(1), AR = arm(-1);
  function pose(p, a) { const s = Math.sin(p), c = Math.cos(p);
    L.hp.rotation.z = s * .55 * a; R.hp.rotation.z = -s * .55 * a; L.kn.rotation.z = -Math.max(0, c) * .9 * a; R.kn.rotation.z = -Math.max(0, -c) * .9 * a;
    AL.sh.rotation.z = -s * .5 * a; AR.sh.rotation.z = s * .5 * a; AL.el.rotation.z = (.15 + Math.max(0, -s) * .5) * a; AR.el.rotation.z = (.15 + Math.max(0, s) * .5) * a;
    torso.rotation.y = s * .1 * a; hip.position.y = .95 + Math.abs(c) * .025 * a }
  let phase=0;
  function action(t,h=.46,{footHeight=0,footAdvance=.54}={}){t=Math.max(0,Math.min(1,t));hip.position.set(.12*t,.95+(h+.105-.95)*t,0);torso.rotation.set(0,0,-.25*Math.sin(Math.PI*t));for(const l of[L,R]){const dx=.012+footAdvance*t-hip.position.x,dy=.07+footHeight*t-hip.position.y,d=Math.min(.8999,Math.hypot(dx,dy)),alpha=Math.atan2(dx,-dy),bend=Math.acos(Math.max(-1,Math.min(1,d/.9)));l.hp.rotation.z=alpha+bend;l.kn.rotation.z=-2*bend}for(const a of[AL,AR]){a.sh.rotation.z=.15+.4*t;a.el.rotation.z=.15+.9*t}}
  function stand(){action(0)}
  function sit(h=.46){action(1,h)}
  function animate({distance=0,speed=0}={}){phase+=distance/.85*Math.PI*2;pose(phase,Math.min(1,speed))}
  return {g,meshes,pose,sit,stand,action,animate,resetFeet:()=>{},mats:{sh:mSh,pa:mPa}};

}
