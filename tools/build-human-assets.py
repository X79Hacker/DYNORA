"""Build offline CC0 people from pinned source downloads. Requires Pillow.

Embeds resized textures, retains source geometry/skin weights, and copies the
matching Sam sit animation without duplicating the second model's textures.
No network connection is used by the finished app.
"""
from pathlib import Path
from urllib.request import urlopen, Request
from PIL import Image
import copy, hashlib, io, json, struct

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'work-assets'
OUT = ROOT / 'public/visual/humans'
SOURCES = {
    'sam': 'walk-carrying-phone-sam-3d-person-animated-241a2abe',
    'maya': 'walk-carrying-phone-maya-3d-person-animated-06ba936a',
    'sit': 'sit-down-and-stand-up-sam-3d-person-animated-66ca6c29',
    'researcher': 'laboratory-researcher-3d-person-healthcare-7a3ceb81',
}

def read_glb(data):
    magic, version, total = struct.unpack_from('<III', data)
    assert magic == 0x46546C67 and version == 2 and total == len(data)
    n = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20+n])
    offset = 20+n
    length, kind = struct.unpack_from('<II', data, offset)
    assert kind == 0x004E4942
    return doc, data[offset+8:offset+8+length]

def source(name):
    CACHE.mkdir(exist_ok=True)
    p = CACHE / (name + '.glb')
    if not p.exists():
        req = Request('https://www.innerscene.com/api/library/' + SOURCES[name] + '/download',
                      headers={'User-Agent': 'DYNORA-offline-asset-build/7.0'})
        p.write_bytes(urlopen(req, timeout=90).read())
    return p.read_bytes()

def append_bytes(binary, data):
    binary.extend(b'\0' * (-len(binary) % 4))
    offset = len(binary)
    binary.extend(data)
    return offset

def merge_sit(doc, binary):
    other, other_binary = read_glb(source('sit'))
    clip = copy.deepcopy(other['animations'][0])
    nodes = {n.get('name'): i for i, n in enumerate(doc['nodes'])}
    for channel in clip['channels']:
        old = channel['target']['node']
        channel['target']['node'] = nodes[other['nodes'][old]['name']]
    remapped = {}
    for sampler in clip['samplers']:
        for field in ['input', 'output']:
            old = sampler[field]
            if old not in remapped:
                accessor = copy.deepcopy(other['accessors'][old])
                view = other['bufferViews'][accessor['bufferView']]
                start = view.get('byteOffset', 0)
                payload = other_binary[start:start+view['byteLength']]
                new_view = dict(view, buffer=0, byteOffset=append_bytes(binary, payload))
                accessor['bufferView'] = len(doc['bufferViews'])
                doc['bufferViews'].append(new_view)
                remapped[old] = len(doc['accessors'])
                doc['accessors'].append(accessor)
            sampler[field] = remapped[old]
    clip['name'] = 'Sit_Stand'
    doc['animations'].append(clip)

def optimize(name):
    raw = source(name)
    doc, original_binary = read_glb(raw)
    binary = bytearray(original_binary)
    if name == 'sam':
        merge_sit(doc, binary)
    # Replace image payloads. Repack every view so old large textures disappear.
    replacements = {}
    image_sizes = []
    for image in doc.get('images', []):
        view = doc['bufferViews'][image['bufferView']]
        start = view.get('byteOffset', 0)
        im = Image.open(io.BytesIO(binary[start:start+view['byteLength']]))
        im.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
        alpha = im.mode in ('RGBA', 'LA') or 'transparency' in im.info
        out = io.BytesIO()
        if alpha:
            im.convert('RGBA').save(out, format='PNG', optimize=True)
            image['mimeType'] = 'image/png'
        else:
            im.convert('RGB').save(out, format='JPEG', quality=88, optimize=True)
            image['mimeType'] = 'image/jpeg'
        image_sizes.append(list(im.size))
        replacements[image['bufferView']] = out.getvalue()
    packed = bytearray()
    for i, view in enumerate(doc['bufferViews']):
        start = view.get('byteOffset', 0)
        payload = replacements.get(i, binary[start:start+view['byteLength']])
        view['byteOffset'] = append_bytes(packed, payload)
        view['byteLength'] = len(payload)
        view['buffer'] = 0
    doc['buffers'] = [{'byteLength': len(packed)}]
    doc['asset']['extras'] = {'source': 'https://www.innerscene.com/tools/library/3d-parts/' + SOURCES[name],
                            'license': 'CC0-1.0', 'modification': 'DYNORA: embedded textures resized to 1K; Sam receives matching sit clip.'}
    header = json.dumps(doc, separators=(',', ':')).encode()
    header += b' ' * (-len(header) % 4)
    packed.extend(b'\0' * (-len(packed) % 4))
    result = struct.pack('<III', 0x46546C67, 2, 28+len(header)+len(packed))
    result += struct.pack('<II', len(header), 0x4E4F534A) + header
    result += struct.pack('<II', len(packed), 0x004E4942) + packed
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / (name + '.glb')).write_bytes(result)
    print(name, len(raw), '->', len(result), flush=True)
    return {'id': name, 'file': name + '.glb', 'source_url': doc['asset']['extras']['source'],
            'license': 'CC0-1.0', 'author': 'Innerscene; MakeHuman / MPFB CC0 assets',
            'source_sha256': hashlib.sha256(raw).hexdigest(),
            'sha256': hashlib.sha256(result).hexdigest(), 'bytes': len(result),
            'clips': [a.get('name') for a in doc.get('animations', [])],
            'texture_sizes': image_sizes}

if __name__ == '__main__':
    records = [optimize(name) for name in ['sam', 'maya', 'researcher']]
    (OUT / 'sources.json').write_text(json.dumps(records, indent=2))
    (OUT / 'CREDITS.md').write_text('# Offline human assets\n\n'
        'Models and authored animation: Innerscene, using MakeHuman / MPFB CC0 assets.\n'
        'Source pages explicitly dedicate the downloaded assets to CC0 1.0.\n'
        'License: https://creativecommons.org/publicdomain/zero/1.0/\n\n'
        'DYNORA modifications: textures resized to 1K; matching Sam sit animation merged.\n'
        'These are textured anatomical character meshes, not scans of real people or motion capture.\n'
        'Source geometry, rig and skin weights are retained.\n\n' +
        '\n'.join('- ' + r['id'] + ': ' + r['source_url'] for r in records) + '\n')
