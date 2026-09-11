"""Read-only check for text autofit settings omitted by the experimental size gate."""
import json
import hashlib
import sys
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET

ns = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
      'p': 'http://schemas.openxmlformats.org/presentationml/2006/main'}
src, target = map(Path, sys.argv[1:3])
rows = []
with ZipFile(src) as archive:
    for name in archive.namelist():
        if not (name.startswith('ppt/slides/slide') and name.endswith('.xml')):
            continue
        for shape in ET.fromstring(archive.read(name)).findall('.//p:sp', ns):
            body = shape.find('p:txBody/a:bodyPr', ns)
            if body is None:
                continue
            settings = [el for el in body if el.tag.split('}')[-1] in
                        ('normAutofit', 'spAutoFit', 'noAutofit')]
            for el in settings:
                rows.append({'slide': name, 'mode': el.tag.split('}')[-1],
                             'attributes': el.attrib,
                             'text': ''.join(t.text or '' for t in shape.findall('.//a:t', ns))})
scaled = [row for row in rows if row['mode'] == 'normAutofit' and
          int(row['attributes'].get('fontScale', '100000')) < 100000]
result = {'sha256': hashlib.sha256(src.read_bytes()).hexdigest(),
          'explicitAutofitSettings': len(rows), 'scaledTextBodies': len(scaled),
          'scaledBodies': scaled,
          'limits': 'Reads explicit slide text-body settings only; not a rendered effective-font-size or inheritance audit.'}
target.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'sha256': result['sha256'], 'scaledTextBodies': len(scaled)}))
