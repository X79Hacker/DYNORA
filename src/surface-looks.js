import * as T from 'three';
// Canvas textures for the test-lab lane, one per LAB_SURFACES id. Asphalt and
// oak follow the obstacle track's own asphalt and plank floor. Fixed seed, so
// a surface looks the same every time.
const size=512;
function random(seed){return()=>(seed=(seed*1664525+1013904223)>>>0)/4294967296}
const paint={
 dry(x,r){x.fillStyle='#4d5d68';x.fillRect(0,0,size,size);for(let i=0;i<1500;i++){const v=70+r()*30|0;x.fillStyle=`rgb(${v},${v+12},${v+22})`;x.fillRect(r()*size,r()*size,2,2)}},
 asphalt(x,r){x.fillStyle='#4a4f57';x.fillRect(0,0,size,size);for(let i=0;i<9000;i++){const v=55+r()*55|0;x.fillStyle=`rgb(${v},${v},${v+4})`;x.fillRect(r()*size,r()*size,1.5,1.5)}x.fillStyle='#e5e7eb';x.fillRect(0,10,size,8);x.fillRect(0,size-18,size,8)},
 oak(x,r){for(let row=0;row<8;row++){let px=-r()*200;while(px<size){const w=180+r()*160;x.fillStyle=`hsl(${30+r()*6},${32+r()*10}%,${58+r()*10}%)`;x.fillRect(px,row*64,w,64);x.strokeStyle='rgba(90,60,30,.18)';for(let g=0;g<6;g++){x.beginPath();const y=row*64+6+r()*52;x.moveTo(px,y);x.bezierCurveTo(px+w/3,y+r()*6-3,px+2*w/3,y+r()*6-3,px+w,y);x.stroke()}x.fillStyle='#6b4a2b';x.fillRect(px,row*64,2,64);px+=w}x.fillStyle='#6b4a2b';x.fillRect(0,row*64,size,2)}},
 tiles(x,r){x.fillStyle='#e9eef0';x.fillRect(0,0,size,size);for(let i=0;i<4;i++)for(let j=0;j<4;j++){x.fillStyle=`hsl(200,30%,${82+r()*6}%)`;x.fillRect(i*128+3,j*128+3,122,122)}},
 concrete(x,r){x.fillStyle='#a8a29e';x.fillRect(0,0,size,size);for(let i=0;i<6000;i++){const v=130+r()*60|0;x.fillStyle=`rgb(${v},${v-3},${v-6})`;x.fillRect(r()*size,r()*size,r()*3,r()*3)}x.fillStyle='#7d7873';x.fillRect(0,size/2,size,2)},
 wet(x,r){x.fillStyle='#b9e2f5';x.fillRect(0,0,size,size);for(let i=0;i<4;i++)for(let j=0;j<4;j++){x.fillStyle=`hsl(200,60%,${80+r()*8}%)`;x.fillRect(i*128+3,j*128+3,122,122)}x.fillStyle='rgba(60,140,200,.25)';for(let i=0;i<14;i++){x.beginPath();x.ellipse(r()*size,r()*size,20+r()*50,8+r()*20,r()*3,0,7);x.fill()}},
 gravel(x,r){x.fillStyle='#6c6255';x.fillRect(0,0,size,size);for(let i=0;i<7000;i++){const v=75+r()*90|0;x.fillStyle=`rgb(${v},${v-6},${v-12})`;x.beginPath();x.arc(r()*size,r()*size,.8+r()*2.6,0,7);x.fill()}},
 grass(x,r){x.fillStyle='#2c4f1c';x.fillRect(0,0,size,size);for(let i=0;i<9000;i++){x.strokeStyle=`hsl(${80+r()*35},${35+r()*25}%,${14+r()*20}%)`;x.lineWidth=.6+r()*.8;x.beginPath();const a=r()*size,b=r()*size;x.moveTo(a,b);x.lineTo(a+r()*6-3,b-2-r()*4);x.stroke()}},
};
// Repeats over the lane (u along x, 8 m; v across, 3 m). Asphalt: one tile
// across, so its two edge lines mark the lane sides. Oak planks are 12 cm wide.
const repeat={asphalt:[3,1],oak:[8,3],tiles:[8,3],concrete:[4,1.5],wet:[8,3]};
export function surfaceMaterial(id){
 const fill=paint[id];if(!fill)return new T.MeshStandardMaterial({color:0x354d5a,roughness:1,side:T.DoubleSide});
 const canvas=document.createElement('canvas');canvas.width=canvas.height=size;fill(canvas.getContext('2d'),random(id.length*7919+11));
 const map=new T.CanvasTexture(canvas);map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(...(repeat[id]||[6,2.25]));map.encoding=T.sRGBEncoding;map.anisotropy=4;
 // The lab lights the lane brightly (exposure 1.15); the grey tint keeps
 // asphalt dark and wood its colour instead of washing them out.
 return new T.MeshStandardMaterial({map,color:0x6e6e6e,roughness:{tiles:.25,wet:.08,oak:.6}[id]??.95,side:T.DoubleSide});
}
