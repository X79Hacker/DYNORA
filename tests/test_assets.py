import sys,unittest,math,xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
from audit_urdf import audit
class GeometryAudit(unittest.TestCase):
 def test_complete_reference_meshes(self):
  a=audit('robot.urdf');self.assertEqual(a['missing_meshes'],[]);self.assertAlmostEqual(a['mass_kg'],2.29797)
 def test_missing_rover_meshes_are_explicit(self):
  a=audit('my_bot.urdf');self.assertEqual(len(a['missing_meshes']),6);self.assertIn('wheel.stl',a['missing_meshes']);self.assertAlmostEqual(a['mass_kg'],3.99822528)
 def test_rover_wheel_spacing_matches_profile(self):
  joints=audit('my_bot.urdf')['wheel_joints'];v={k:list(map(float,x['xyz'].split())) for k,x in joints.items()};self.assertAlmostEqual(v['left_front'][1]-v['right_front'][1],.251018,places=6);self.assertAlmostEqual(v['right_front'][0]-v['right_back'][0],.1510219)
 def test_source_inertias_positive_definite(self):
  # Sylvester's criterion for each symmetric inertia tensor.
  for name in ['robot.urdf','my_bot.urdf']:
   for link in ET.parse(ROOT/name).findall('link'):
    inertia=link.find('inertial/inertia')
    if inertia is None:continue
    q={k:float(v) for k,v in inertia.attrib.items()};a,b,c=q['ixx'],q['iyy'],q['izz'];d,e,f=q['ixy'],q['ixz'],q['iyz'];self.assertTrue(a>0 and a*b-d*d>0 and a*b*c+2*d*e*f-a*f*f-b*e*e-c*d*d>0,(name,link.get('name')))
if __name__=='__main__':unittest.main()
