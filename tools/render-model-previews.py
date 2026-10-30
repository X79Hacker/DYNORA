"""Deterministic CPU geometry previews, not browser screenshots or camera validation."""
from pathlib import Path
import sys
import trimesh,numpy as np
from PIL import Image,ImageDraw,ImageFilter
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'public/visual/previews';OUT.mkdir(parents=True,exist_ok=True)
W,H=640,512
view=np.array([1.1,.85,1.35]);view/=np.linalg.norm(view);right=np.cross(np.array([0.,1.,0.]),view);right/=np.linalg.norm(right);up=np.cross(view,right)
light=np.array([-.1,1,.6]);light/=np.linalg.norm(light)
selected=set(sys.argv[1:])
for path in sorted((ROOT/'public/visual/models').glob('*.glb')):
 if selected and path.stem not in selected:continue
 scene=trimesh.load(path,force='scene',process=False);faces=[];allpts=[]
 for node in scene.graph.nodes_geometry:
  transform,geometry=scene.graph[node];mesh=scene.geometry[geometry];v=trimesh.transform_points(mesh.vertices,transform);tri=v[mesh.faces];n=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);n/=np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-12)
  color=np.array(getattr(mesh.visual.material,'baseColorFactor',[150,160,170,255]))[:3]/255
  metal=getattr(mesh.visual.material,'metallicFactor',0) or 0;rough=getattr(mesh.visual.material,'roughnessFactor',.7) or .7
  diffuse=np.maximum(n@light,0);half=light+view;half/=np.linalg.norm(half);spec=np.maximum(n@half,0)**(4+48*(1-rough));rgb=color[None,:]*(.3+.82*diffuse[:,None])+(0.08+.25*metal)*spec[:,None];rgb=np.clip(rgb,0,1)**(1/2.2)*255
  projected=np.stack((v@right,v@up,v@view),axis=1);allpts.append(projected)
  for p,c,norm in zip(projected[mesh.faces],rgb,n):
   if norm@view>=-.01:faces.append((p[:,2].mean(),p,tuple(c.astype('uint8'))))
 pts=np.concatenate(allpts);lo=pts[:,:2].min(0);hi=pts[:,:2].max(0);scale=min((W-90)/(hi[0]-lo[0]),(H-85)/(hi[1]-lo[1]));center=(lo+hi)/2
 def screen(p):q=(p-center)*scale;return[(float(x+W/2),float(H*.48-y)) for x,y in q]
 image=Image.new('RGB',(W,H),(229,234,233));shadow=Image.new('RGBA',(W,H));sd=ImageDraw.Draw(shadow);bottom=screen(np.array([[0,lo[1]]]))[0][1];sd.ellipse((W*.2,bottom-18,W*.8,bottom+20),fill=(30,45,45,65));shadow=shadow.filter(ImageFilter.GaussianBlur(14));image=Image.alpha_composite(image.convert('RGBA'),shadow).convert('RGB');draw=ImageDraw.Draw(image)
 # Orthographic per-pixel depth testing avoids painter-order artifacts at large faces.
 pixels=np.asarray(image).copy();depth_buffer=np.full((H,W),-np.inf,dtype=np.float32)
 for _,p,c in faces:
  q=np.array(screen(p[:,:2]));x0=max(0,int(np.floor(q[:,0].min())));x1=min(W-1,int(np.ceil(q[:,0].max())));y0=max(0,int(np.floor(q[:,1].min())));y1=min(H-1,int(np.ceil(q[:,1].max())))
  if x0>x1 or y0>y1:continue
  den=(q[1,1]-q[2,1])*(q[0,0]-q[2,0])+(q[2,0]-q[1,0])*(q[0,1]-q[2,1])
  if abs(den)<1e-8:continue
  xx,yy=np.meshgrid(np.arange(x0,x1+1)+.5,np.arange(y0,y1+1)+.5)
  a=((q[1,1]-q[2,1])*(xx-q[2,0])+(q[2,0]-q[1,0])*(yy-q[2,1]))/den
  b=((q[2,1]-q[0,1])*(xx-q[2,0])+(q[0,0]-q[2,0])*(yy-q[2,1]))/den;d=1-a-b;z=a*p[0,2]+b*p[1,2]+d*p[2,2]
  target=depth_buffer[y0:y1+1,x0:x1+1];mask=(a>=-1e-7)&(b>=-1e-7)&(d>=-1e-7)&(z>target);target[mask]=z[mask];pixels[y0:y1+1,x0:x1+1][mask]=c
 image=Image.fromarray(pixels);draw=ImageDraw.Draw(image)
 draw.text((18,H-25),'GLB GEOMETRY PREVIEW / '+path.stem,fill=(70,86,91));temp=OUT/(path.stem+'.tmp.png');image.save(temp,optimize=True)
 with Image.open(temp) as check:check.verify()
 assert temp.stat().st_size>100
 temp.replace(OUT/(path.stem+'.png'))
 print(path.stem,len(faces),flush=True)
