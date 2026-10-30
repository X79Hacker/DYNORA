export const CAMERA_DEFAULTS=Object.freeze({fov:70,x:.133,y:0,z:.1725894,yaw:0,pitch:0,roll:0,cx:.5,cy:.5,k1:0,k2:0,p1:0,p2:0,exposure:1,readNoise:0,blur:0});
export function cameraParameters(input={}){const p={...CAMERA_DEFAULTS,...input},ranges={fov:[15,140],x:[-1,1],y:[-1,1],z:[.02,2],yaw:[-180,180],pitch:[-80,80],roll:[-180,180],cx:[.1,.9],cy:[.1,.9],k1:[-1,1],k2:[-1,1],p1:[-.1,.1],p2:[-.1,.1],exposure:[.1,4],readNoise:[0,30],blur:[0,.9]};for(const[k,[a,b]]of Object.entries(ranges))if(!Number.isFinite(p[k])||p[k]<a||p[k]>b)throw Error(`Camera ${k} must be ${a} to ${b}`);return p;}
export function intrinsics(p,width,height){const fy=height/2/Math.tan(p.fov*Math.PI/360);return{width,height,fx:fy,fy,cx:p.cx*width,cy:p.cy*height,distortion_model:'plumb_bob',D:[p.k1,p.k2,p.p1,p.p2,0],K:[fy,0,p.cx*width,0,fy,p.cy*height,0,0,1],frame_id:'camera_optical',optical_axes:'x right, y down, z forward',mount_body_xyz_m:[p.x,p.y,p.z],mount_yaw_pitch_roll_deg:[p.yaw,p.pitch,p.roll]};}
export function distortPoint(x,y,p){const r2=x*x+y*y,s=1+p.k1*r2+p.k2*r2*r2;return[x*s+2*p.p1*x*y+p.p2*(r2+2*x*x),y*s+p.p1*(r2+2*y*y)+2*p.p2*x*y];}
export class CameraEffects{
 constructor(){this.previous=null;this.map=null;this.key='';}
 reset(){this.previous=null;}
 apply(image,p,rng){const{width:w,height:h,data}=image,distorted=p.k1||p.k2||p.p1||p.p2,active=distorted||p.exposure!==1||p.readNoise||p.blur;
  if(!active)return image;
  const src=new Uint8ClampedArray(data),cam=intrinsics(p,w,h),key=[w,h,p.fov,p.cx,p.cy,p.k1,p.k2,p.p1,p.p2].join('|');
  if(distorted&&this.key!==key){this.key=key;this.map=new Float32Array(w*h*2);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const xd=(x-cam.cx)/cam.fx,yd=(y-cam.cy)/cam.fy;let u=xd,v=yd;for(let k=0;k<8;k++){const[a,b]=distortPoint(u,v,p);u+=xd-a;v+=yd-b}const j=(y*w+x)*2;this.map[j]=u*cam.fx+cam.cx;this.map[j+1]=v*cam.fy+cam.cy;}}
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;let sx=x,sy=y;if(distorted){sx=this.map[(y*w+x)*2];sy=this.map[(y*w+x)*2+1]}if(distorted&&(!Number.isFinite(sx)||!Number.isFinite(sy)||sx<0||sy<0||sx>w-1||sy>h-1)){data[i]=data[i+1]=data[i+2]=0;data[i+3]=255;continue}const ix=Math.min(w-2,Math.floor(sx)),iy=Math.min(h-2,Math.floor(sy)),dx=sx-ix,dy=sy-iy,j=(iy*w+ix)*4;
   for(let c=0;c<3;c++){let value=distorted?src[j+c]*(1-dx)*(1-dy)+src[j+4+c]*dx*(1-dy)+src[j+w*4+c]*(1-dx)*dy+src[j+w*4+4+c]*dx*dy:src[i+c];value*=p.exposure;if(p.readNoise)value+=(rng()+rng()+rng()+rng()-2)*p.readNoise*Math.sqrt(3);if(p.blur&&this.previous?.length===data.length)value=value*(1-p.blur)+this.previous[i+c]*p.blur;data[i+c]=value;}data[i+3]=255;}
  if(p.blur)this.previous=new Uint8ClampedArray(data);return image;
 }
}
