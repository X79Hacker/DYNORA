"""Download the pinned CC0 material selection; runtime itself stays offline."""
from pathlib import Path
import urllib.request,json,zipfile,io,hashlib,concurrent.futures
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/visual';OUT.mkdir(parents=True,exist_ok=True)
SPECS=[('wood','WoodFloor051',1.8),('plaster','PaintedPlaster017',2),('fabric','Fabric030',.35),('metal','Metal032',1),('tile','Tiles107',2)]
def fetch(url):
 req=urllib.request.Request(url,headers={'User-Agent':'DYNORA-local-asset-build/4.0'})
 with urllib.request.urlopen(req,timeout=40) as r:return r.read()
def build(spec):
 role,asset,repeat=spec
 metadata=json.loads(fetch('https://ambientcg.com/api/v2/full_json?id='+asset+'&include=downloadData,displayData,dimensionsData'))
 found=[v for v in metadata.get('foundAssets',[]) if v['assetId']==asset]
 if not found:raise RuntimeError('Asset not found: '+asset)
 item=found[0];downloads=item['downloadFolders']['default']['downloadFiletypeCategories']['zip']['downloads']
 download=next(v for v in downloads if v['attribute']=='1K-JPG')
 cache=ROOT.parent.parent/'asset-download-cache';cache.mkdir(exist_ok=True);cached=cache/download['fileName'];payload=cached.read_bytes() if cached.exists() else fetch(download['downloadLink']);cached.write_bytes(payload);archive=zipfile.ZipFile(io.BytesIO(payload));assert archive.testzip() is None
 folder=OUT/'materials'/role;folder.mkdir(parents=True,exist_ok=True)
 data={'id':role,'name':item['displayName'],'asset_id':asset,'source':'https://ambientcg.com/a/'+asset,'author':'Lennart Demes / ambientCG','license':'CC0-1.0','license_url':'https://docs.ambientcg.com/license/','repeat_m':repeat,'normalScale':.35,'download_sha256':hashlib.sha256(payload).hexdigest()}
 for key,suffix in [('color','Color.jpg'),('normal','NormalGL.jpg'),('roughness','Roughness.jpg'),('metalness','Metalness.jpg')]:
  names=[n for n in archive.namelist() if n.endswith('_'+suffix)]
  if not names:continue
  raw=archive.read(names[0]);target=folder/(key+'.jpg');target.write_bytes(raw)
  with Image.open(target) as im:assert max(im.size)==1024 and min(im.size)>=256;im.verify()
  data[key]=str(target.relative_to(OUT));data[key+'_sha256']=hashlib.sha256(raw).hexdigest()
 assert 'color' in data and 'normal' in data and 'roughness' in data
 print(asset+' ready',flush=True)
 return data
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 materials=list(pool.map(build,SPECS))
manifest={'materials':materials}
try:
 info=json.loads(fetch('https://api.polyhaven.com/files/studio_small_09'))
 url=info['hdri']['1k']['hdr']['url'];payload=fetch(url)
 (OUT/'environment').mkdir(exist_ok=True);(OUT/'environment/studio_small_09_1k.hdr').write_bytes(payload)
 manifest['environment']='environment/studio_small_09_1k.hdr'
 manifest['environment_source']={'name':'Studio Small 09','source':'https://polyhaven.com/a/studio_small_09','license':'CC0-1.0','license_url':'https://polyhaven.com/license','sha256':hashlib.sha256(payload).hexdigest()}
except Exception as e:manifest['environment_warning']=str(e)
(OUT/'materials.json').write_text(json.dumps(manifest,indent=2))
credits=['# Bundled visual assets','', 'Original dimensioned model source and GLBs: DYNORA, MIT (project LICENSE).','', 'PBR textures by Lennart Demes / ambientCG, CC0 1.0. Raw texture files may be redistributed. License: https://docs.ambientcg.com/license/','']
for m in materials:credits.append('- '+m['name']+' — '+m['source']+' — 1K JPG color, OpenGL normal and roughness maps; metalness where supplied.')
if 'environment_source' in manifest:credits.extend(['','Studio Small 09 HDRI by Poly Haven, CC0 1.0. https://polyhaven.com/a/studio_small_09 . License: https://polyhaven.com/license . Powered by Poly Haven (build-time API discovery only; no runtime API requests).'])
(OUT/'ASSET_CREDITS.md').write_text('\n'.join(credits)+'\n')
print(json.dumps({'material_sets':len(materials),'environment':manifest.get('environment'),'bytes':sum(p.stat().st_size for p in OUT.rglob('*') if p.is_file())}))
