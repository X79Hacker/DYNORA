import * as T from 'three';
// A narrow lateral shoulder joins a bump to the road; the central tyre path
// retains the configured longitudinal bump profile.
export function bumpTaper(offset,halfWidth,shoulder=.08){const t=Math.max(0,Math.min(1,(halfWidth-Math.abs(offset))/Math.min(shoulder,halfWidth*.4)));return t*t*(3-2*t);}
export function closedBumpGeometry({start,width,halfWidth,point,top,bottom,segments=32,crossSegments=24}){
 const positions=[],colors=[],indices=[],row=crossSegments+1,layer=(segments+1)*row;
 for(let side=0;side<2;side++)for(let i=0;i<=segments;i++)for(let j=0;j<=crossSegments;j++){const s=start+width*i/segments,d=-halfWidth+2*halfWidth*j/crossSegments,p=point(s,d);positions.push(p.x,side?bottom(s,d,p):top(s,d,p),p.z);const yellow=Math.floor((d+halfWidth)/.15)%2===0;colors.push(...(yellow?[.96,.69,.08]:[.025,.035,.045]));}
 for(let i=0;i<segments;i++)for(let j=0;j<crossSegments;j++){const k=i*row+j;indices.push(k,k+1,k+row,k+1,k+row+1,k+row);const b=k+layer;indices.push(b,b+row,b+1,b+1,b+row,b+row+1);}
 const wall=(a,b)=>indices.push(a,b,a+layer,b,b+layer,a+layer);
 for(let i=0;i<segments;i++){wall((i+1)*row,i*row);wall(i*row+crossSegments,(i+1)*row+crossSegments);}
 for(let j=0;j<crossSegments;j++){wall(j,j+1);wall(segments*row+j+1,segments*row+j);}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
export function bridgeSupportStations(start,length,maxSpacing=.9){const inset=Math.min(.12,length/4),span=Math.max(0,length-2*inset),n=Math.max(1,Math.ceil(span/maxSpacing));return Array.from({length:n+1},(_,i)=>start+inset+span*i/n);}
