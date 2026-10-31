import unittest,json,hashlib
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
class VisualAssets(unittest.TestCase):
 def test_complete_local_pbr_sets_and_hashes(self):
  root=ROOT/'public/visual';manifest=json.loads((root/'materials.json').read_text())
  self.assertEqual({m['id'] for m in manifest['materials']},{'wood','plaster','fabric','metal','tile'})
  for m in manifest['materials']:
   self.assertEqual(m['license'],'CC0-1.0')
   for role in ['color','normal','roughness']:
    path=root/m[role];self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),m[role+'_sha256'])
    with Image.open(path) as im:self.assertLessEqual(max(im.size),1024);self.assertGreaterEqual(min(im.size),256);im.verify()
 def test_real_hdr_environment_is_bundled(self):
  root=ROOT/'public/visual';m=json.loads((root/'materials.json').read_text());data=(root/m['environment']).read_bytes();self.assertTrue(data.startswith((b'#?RADIANCE',b'#?RGBE')));self.assertEqual(hashlib.sha256(data).hexdigest(),m['environment_source']['sha256'])
 def test_geometry_previews_exist_and_decode(self):
  root=ROOT/'public/visual';models=json.loads((root/'original-models.json').read_text())['models'];self.assertEqual(len(models),28)
  for name in ['rover']+[m['id'] for m in models]:
   with Image.open(root/'previews'/(name+'.png')) as im:self.assertEqual(im.size,(640,512));im.verify()
 def test_visual_assets_have_a_practical_download_budget(self):
  root=ROOT/'public/visual';self.assertLess(sum(p.stat().st_size for p in root.rglob('*') if p.is_file()),64*1024*1024)
if __name__=='__main__':unittest.main()
