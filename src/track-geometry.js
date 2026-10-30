import * as THREE from 'three';
import {holePoint,holeDepth,outlineHole} from './track-surface.js';
export function floorWithHoles(holes,width=10,depth=6){
 const s=new THREE.Shape();s.moveTo(-width/2,-depth/2);s.lineTo(width/2,-depth/2);s.lineTo(width/2,depth/2);s.lineTo(-width/2,depth/2);s.closePath();
 for(const o of holes){if((o.base||0)-o.depth>.001)continue;const path=new THREE.Path(),points=outlineHole(o);points.forEach((p,i)=>i?path.lineTo(p.x,-p.z):path.moveTo(p.x,-p.z));path.closePath();s.holes.push(path)}
 const g=new THREE.ShapeGeometry(s);const pos=g.attributes.position,uv=g.attributes.uv;for(let i=0;i<pos.count;i++)uv.setXY(i,(pos.getX(i)+width/2)/2,(pos.getY(i)+depth/2)/2);return g;
}
export function potholeGeometry(o,surface=()=>o.base||0){
 const rings=24,segs=96,p=[],uv=[],colors=[],idx=[];
 const put=(x,z,f)=>{p.push(x,surface(x,z)-holeDepth(o,x,z)+.0015,z);uv.push(x*3,z*3);const shade=.58+.28*f;colors.push(shade,shade*.96,shade*.89)};
 put(o.x,o.z,0);
 for(let r=1;r<=rings;r++)for(let j=0;j<=segs;j++){const v=holePoint(o,j/segs*Math.PI*2,r/rings);put(v.x,v.z,r/rings)}
 for(let j=0;j<segs;j++)idx.push(0,1+j+1,1+j);
 for(let r=0;r<rings-1;r++)for(let j=0;j<segs;j++){const a=1+r*(segs+1)+j,b=a+segs+1;idx.push(a,b+1,b,a,a+1,b+1)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(idx);g.computeVertexNormals();g.computeBoundingBox();return g;
}
