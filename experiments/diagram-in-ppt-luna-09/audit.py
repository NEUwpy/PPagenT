"""Independent checks of the delivered PPTX and its Archify source mapping."""
import hashlib
import json
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

root = Path(__file__).resolve().parent
deck = root / 'run/deliverables/预约服务改进方案-luna09-v2.pptx'
spec = json.loads((root / 'run/archify-candidate.json').read_text(encoding='utf-8-sig'))
receipt = json.loads((root / 'run/.finalizer/receipt-v2.json').read_text(encoding='utf-8-sig'))
ns = {'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
      'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
digest = hashlib.sha256(deck.read_bytes()).hexdigest()
assert digest == receipt['finalSha256']
with zipfile.ZipFile(deck) as package:
    pages = [ET.fromstring(package.read(f'ppt/slides/slide{i}.xml')) for i in range(1, 4)]
    counts = [{'slide': i + 1, 'shapes': len(page.findall('.//p:sp', ns)),
               'connectors': len(page.findall('.//p:cxnSp', ns)),
               'pictures': len(page.findall('.//p:pic', ns))} for i, page in enumerate(pages)]
    assert counts[0]['pictures'] == counts[1]['pictures'] == 0
    # The existing parallel-card component includes small icon images.
    # Verify these are local icons, not a flattened diagram or slide.
    for pic in pages[2].findall('.//p:pic', ns):
        size = pic.find('p:spPr/a:xfrm/a:ext', ns)
        assert int(size.get('cx')) < 952500 and int(size.get('cy')) < 952500
    names = {e.attrib['name'] for e in pages[0].findall('.//p:cNvPr', ns)}
    mapping = []
    for message in spec['messages']:
        expected = [f'message-line-{message["id"]}', f'message-label-{message["id"]}']
        assert all(name in names for name in expected), expected
        mapping.append({'message': message['id'], 'from': message['from'], 'to': message['to'], 'objects': expected})
    text = ''.join(e.text or '' for e in pages[0].findall('.//a:t', ns))
    assert all(m['label'] in text for m in spec['messages'])
    arrow_count = sum(1 for e in pages[0].iter() if e.tag in
                      (f'{{{ns["a"]}}}headEnd', f'{{{ns["a"]}}}tailEnd')
                      and e.get('type') == 'triangle')
    assert arrow_count == 7, arrow_count
result = {'status': 'passed', 'deck': str(deck), 'sha256': digest,
          'nativeObjects': counts, 'messageMapping': mapping, 'arrowCount': arrow_count,
          'visualReview': 'Parent inspected all 3 final PPTX import renders; no visible clipping or text overlap; message arrow directions checked.',
          'limits': ['Single supervised Luna High trial, not an autonomous stability benchmark.',
                     'Slide 3 contains three small icon images; diagram shapes and text remain native editable objects.',
                     'Type-specific adapted-native reconstruction, not a universal Archify converter.',
                     'No native PowerPoint or WPS application rendering performed.']}
(root / 'parent-audit.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(result, ensure_ascii=False, indent=2))
