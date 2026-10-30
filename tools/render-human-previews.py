"""CPU rasterization of the actual human geometry, UVs and embedded textures.
These static previews do not validate browser WebGL performance or shadows.
Run node tools/bake-human-previews.mjs first. Requires numpy and Pillow.
"""
from pathlib import Path
import json, numpy as np
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'work-assets/previews'
OUT=ROOT/'public/visual/previews'
W,H=640,512
view=np.array([1.4,.3,1.1]);view/=np.linalg.norm(view)
right=np.cross([0,1,0],view);right/=np.linalg.norm(right);up=np.cross(view,right)
light=np.array([1.,1.5,1.]);light/=np.linalg.norm(light)
for name in ['sam','maya','researcher']:
    d=json.loads((CACHE/(name+'.json')).read_text())
    allv=np.concatenate([np.array(m['positions']).reshape(-1,3) for m in d['meshes']])
    projected=np.stack([allv@right,allv@up],axis=1);lo=projected.min(0);hi=projected.max(0);center=(lo+hi)/2
    scale=min((W-150)/(hi[0]-lo[0]),(H-70)/(hi[1]-lo[1]))
    pixels=np.full((H,W,3),(229,234,233),dtype=np.uint8);depth=np.full((H,W),-np.inf)
    textures={k:np.asarray(Image.open(CACHE/m['image']).convert('RGBA')) if m['image'] else None for k,m in d['materials'].items()}
    for mesh in d['meshes']:
        v=np.array(mesh['positions']).reshape(-1,3);uv=np.array(mesh['uvs']).reshape(-1,2);ix=np.array(mesh['indices']);pr=np.stack([v@right,v@up,v@view],axis=1)
        screen=pr.copy();screen[:,0]=(pr[:,0]-center[0])*scale+W/2;screen[:,1]=H*.48-(pr[:,1]-center[1])*scale
        for group in mesh['groups']:
            matname=mesh['materials'][group['materialIndex']];mat=d['materials'][matname];texture=textures[matname];factor=np.array(mat['color'])
            for indices in ix[group['start']:group['start']+group['count']].reshape(-1,3):
                world=v[indices];normal=np.cross(world[1]-world[0],world[2]-world[0]);norm=np.linalg.norm(normal)
                if norm<1e-12:continue
                normal/=norm
                if not mat['doubleSided'] and normal@view<0:continue
                q=screen[indices];x0=max(0,int(np.floor(q[:,0].min())));x1=min(W-1,int(np.ceil(q[:,0].max())));y0=max(0,int(np.floor(q[:,1].min())));y1=min(H-1,int(np.ceil(q[:,1].max())))
                if x0>x1 or y0>y1:continue
                den=(q[1,1]-q[2,1])*(q[0,0]-q[2,0])+(q[2,0]-q[1,0])*(q[0,1]-q[2,1])
                if abs(den)<1e-10:continue
                xx,yy=np.meshgrid(np.arange(x0,x1+1)+.5,np.arange(y0,y1+1)+.5)
                a=((q[1,1]-q[2,1])*(xx-q[2,0])+(q[2,0]-q[1,0])*(yy-q[2,1]))/den
                b=((q[2,1]-q[0,1])*(xx-q[2,0])+(q[0,0]-q[2,0])*(yy-q[2,1]))/den;c=1-a-b;z=a*q[0,2]+b*q[1,2]+c*q[2,2]
                target=depth[y0:y1+1,x0:x1+1];mask=(a>=-1e-7)&(b>=-1e-7)&(c>=-1e-7)&(z>target)
                if not np.any(mask):continue
                if texture is not None and len(uv):
                    coord=a[...,None]*uv[indices[0]]+b[...,None]*uv[indices[1]]+c[...,None]*uv[indices[2]]
                    tx=np.clip((coord[...,0]*texture.shape[1]).astype(int),0,texture.shape[1]-1);ty=np.clip((coord[...,1]*texture.shape[0]).astype(int),0,texture.shape[0]-1)
                    rgba=texture[ty,tx]/255*factor
                else:rgba=np.broadcast_to(factor,(*a.shape,4))
                mask&=rgba[...,3]>.4
                shade=.68+.32*max(0,float(normal@light));rgb=np.clip(rgba[...,:3]*shade*255,0,255).astype('uint8')
                target[mask]=z[mask];pixels[y0:y1+1,x0:x1+1][mask]=rgb[mask]
    im=Image.fromarray(pixels);draw=ImageDraw.Draw(im);draw.text((18,H-24),'ACTUAL MODEL / '+name.upper()+' / CPU PREVIEW',fill=(60,80,85));path=OUT/('human-'+name+'.png');im.save(path,optimize=True)
    if name=='researcher':im.save(OUT/'human-researcher.png')
    print(name,flush=True)
