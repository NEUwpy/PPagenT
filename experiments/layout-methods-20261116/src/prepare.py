"""Snapshot the authorized common input and unmodified comparison references."""
from pathlib import Path
from PIL import Image
import json, shutil, hashlib, zipfile, io

EXP = Path(__file__).resolve().parents[1]
ROOT = EXP.parents[1]
SOURCE = ROOT/'experiments/home-gray-magazine-20260919/input/gray-state.json'
gray = json.loads(SOURCE.read_text(encoding='utf-8-sig'))
page = gray['pages'][0]
data = {
    'title': page['title'], 'claim': page['claim'],
    'source': str(SOURCE.relative_to(ROOT)),
    'source_sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    'relationship_policy': page['semantics']['narrative'],
    'groups': [dict(id=g['id'], heading=g['heading'], blocks=g['blocks']) for g in page['items']],
}
(EXP/'content.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
refs = {
    'gray.png': ROOT/'experiments/home-gray-magazine-20260919/input/gray.png',
    'previous-native.png': ROOT/'experiments/home-mckinsey-style-20260920/gray-to-mckinsey-reference.png',
    'generated-reference.png': ROOT/'Pasted image 20260920005649.png',
}
manifest = []
for name, source in refs.items():
    shutil.copy2(source, EXP/'assets'/name)
    manifest.append(dict(file='assets/'+name, source=str(source.relative_to(ROOT)),
                         sha256=hashlib.sha256(source.read_bytes()).hexdigest()))
# The template media contains light and dark variants. Retain the light variant's
# original pixels and aspect ratio; no tracing, recoloring, or generated logo.
pptx = ROOT/'assets/主题/东北大学-001/runtime-template.pptx'
with zipfile.ZipFile(pptx) as z:
    original = z.read('ppt/media/image3.png')
    (EXP/'assets/logo-source.png').write_bytes(original)
    im = Image.open(io.BytesIO(original))
    im.crop((0,0,644,165)).save(EXP/'assets/neu-logo.png')
manifest.append(dict(file='assets/neu-logo.png', source=str(pptx.relative_to(ROOT))+'!ppt/media/image3.png',
                     source_sha256=hashlib.sha256(original).hexdigest(), crop=[0,0,644,165],
                     note='Original light-variant pixels; all renderers use width only and preserve aspect ratio.'))
(EXP/'evidence/input-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print('Prepared common content:', sum(len(g['blocks']) for g in data['groups']), 'blocks')
