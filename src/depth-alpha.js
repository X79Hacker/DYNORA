import * as T from 'three';
const pixels=new WeakMap();
export function freezeAlphaMaterial(material){
 const texture=t=>{if(!t)return null;if(t.matrixAutoUpdate)t.updateMatrix();return{image:t.image,version:t.version,mapping:t.mapping,matrix:t.matrix.clone(),matrixAutoUpdate:false,wrapS:t.wrapS,wrapT:t.wrapT,flipY:t.flipY,magFilter:t.magFilter,transformUv:T.Texture.prototype.transformUv};};
 return{opacity:material.opacity,transparent:material.transparent,alphaTest:material.alphaTest,map:texture(material.map),alphaMap:texture(material.alphaMap)};
}
function imagePixels(texture){
 const image=texture.image;if(!image)return null;let cached=pixels.get(image);if(cached?.version===texture.version)return cached;
 const width=image.width||image.videoWidth,height=image.height||image.videoHeight;if(!width||!height)return null;
 let data=image.data;
 if(!data&&typeof document!=='undefined'){try{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);data=ctx.getImageData(0,0,width,height).data;}catch{return null;}}
 if(!data)return null;cached={width,height,data,channels:data.length/(width*height),version:texture.version};pixels.set(image,cached);return cached;
}
export function surfaceAlphaVisible(original,hit){
 const material=Array.isArray(original.material)?original.material[hit.face?.materialIndex||0]:original.material;
 if(!material)return false;const threshold=Math.max(material.alphaTest||0,material.transparent?.03:0);
 if(!threshold||!hit.uv||!material.map&&!material.alphaMap)return (material.opacity??1)>=threshold;
 let alpha=material.opacity??1;
 for(const [texture,channel]of [[material.map,3],[material.alphaMap,1]]){
  if(!texture)continue;const p=imagePixels(texture);if(!p)return false;
  if(channel>=p.channels)continue;const uv=hit.uv.clone();if(texture.matrixAutoUpdate)texture.updateMatrix();texture.transformUv(uv);
  const sample=(x,y)=>p.data[(Math.max(0,Math.min(p.height-1,y))*p.width+Math.max(0,Math.min(p.width-1,x)))*p.channels+channel]/(p.data instanceof Float32Array?1:255);
  if(texture.magFilter===T.NearestFilter)alpha*=sample(Math.floor(uv.x*p.width),Math.floor(uv.y*p.height));
  else{const x=uv.x*p.width-.5,y=uv.y*p.height-.5,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;alpha*=(1-fy)*((1-fx)*sample(ix,iy)+fx*sample(ix+1,iy))+fy*((1-fx)*sample(ix,iy+1)+fx*sample(ix+1,iy+1));}
 }
 return alpha>=threshold;
}
