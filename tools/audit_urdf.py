"""Read-only source audit. Missing meshes are reported, never invented."""
import json, xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def audit(name):
 root=ET.parse(ROOT/name).getroot();links=root.findall('link');joints=root.findall('joint')
 names=sorted({Path(m.attrib['filename']).name for m in root.findall('.//mesh')})
 return {'file':name,'links':len(links),'joints':len(joints),'mass_kg':sum(float(m.get('value')) for m in root.findall('./link/inertial/mass')),'mesh_files':names,'missing_meshes':[n for n in names if not (ROOT/'assets'/n).exists()], 'wheel_joints':{j.get('name'):j.find('origin').attrib for j in joints if j.get('name') in ('left_front','left_back','right_front','right_back')}}
if __name__=='__main__':print(json.dumps([audit('robot.urdf'),audit('my_bot.urdf')],indent=2))
