"""Check the actual editable marks in Luna's final PPTX against the input counts."""
import hashlib
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

root = Path(__file__).resolve().parent
deck = root / sys.argv[1]
receipt_path = root / sys.argv[2]
ns = {'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
      'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
expected = [24, 18, 12, 9, 6]
receipt = json.loads(receipt_path.read_text(encoding='utf-8-sig'))
digest = hashlib.sha256(deck.read_bytes()).hexdigest()
assert digest == receipt['finalSha256']
with zipfile.ZipFile(deck) as z:
    page = ET.fromstring(z.read('ppt/slides/slide1.xml'))
    names = [p.get('name') for p in page.findall('.//p:cNvPr', ns)]
    rows = [sum(bool(re.fullmatch(f'tick-{i}-[0-9]+', name or '')) for name in names) for i in range(5)]
    marks = [sum(bool(re.fullmatch(f'tick-mark-{i}-[0-9]+', name or '')) for name in names) for i in range(5)]
    assert rows == expected, rows
    assert marks == [v // 5 for v in expected], marks
    assert not page.findall('.//p:pic', ns)
    positions = []
    for i, count in enumerate(expected):
        xs = []
        for shape in page.findall('.//p:sp', ns):
            nv = shape.find('p:nvSpPr/p:cNvPr', ns)
            if nv is not None and re.fullmatch(f'tick-{i}-[0-9]+', nv.get('name', '')):
                xs.append(int(shape.find('p:spPr/a:xfrm/a:off', ns).get('x')))
        xs.sort()
        assert len(set(b-a for a,b in zip(xs,xs[1:]))) == 1
        positions.append(xs)
    assert len({xs[0] for xs in positions}) == 1
    text = ''.join(p.text or '' for p in page.findall('.//a:t', ns))
    assert '61%' in text and '模拟' in text
    count_shapes = len(page.findall('.//p:sp', ns))
result = {'status': 'passed', 'sha256': digest, 'ticksByCategory': rows,
          'fifthMarkersByCategory': marks, 'total': sum(rows),
          'topTwo': sum(rows[:2]), 'percentage': sum(rows[:2])/sum(rows)*100,
          'nativeShapes': count_shapes, 'pictures': 0,
          'scope': 'Editable shapes with countable units, not an Office chart with embedded workbook.'}
(root / 'parent-audit.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(result, ensure_ascii=False, indent=2))
