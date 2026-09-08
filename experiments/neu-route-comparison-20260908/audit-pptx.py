"""Read-only parent audit of final PPTX objects, text styles and chart data."""
import collections
import hashlib
import json
import pathlib
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
      'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
      'c': 'http://schemas.openxmlformats.org/drawingml/2006/chart'}

def inspect(file):
    result = {'file': str(file), 'sha256': hashlib.sha256(file.read_bytes()).hexdigest(), 'slides': [], 'charts': []}
    with zipfile.ZipFile(file) as z:
        slides = sorted((n for n in z.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml', n)),
                        key=lambda n: int(re.search(r'slide(\d+)', n).group(1)))
        for name in slides:
            root = ET.fromstring(z.read(name))
            texts, sizes, faces = [], collections.Counter(), collections.Counter()
            for sp in root.findall('.//p:sp', NS):
                value = ''.join(t.text or '' for t in sp.findall('.//a:t', NS))
                if value:
                    texts.append(value)
                for r in sp.findall('.//a:rPr', NS):
                    if 'sz' in r.attrib:
                        sizes[str(int(r.attrib['sz']) / 100)] += 1
                    for tag in ['latin', 'ea']:
                        f = r.find('a:' + tag, NS)
                        if f is not None and f.get('typeface'):
                            faces[f.get('typeface')] += 1
            result['slides'].append({'part': name, 'nativeShapes': len(root.findall('.//p:sp', NS)),
                'pictures': len(root.findall('.//p:pic', NS)), 'chartFrames': len(root.findall('.//c:chart', NS)),
                'explicitRunSizesPt': dict(sizes), 'explicitTypefaces': dict(faces), 'texts': texts})
        for name in z.namelist():
            if re.fullmatch(r'ppt/(?:slides/)?charts/chart\d+\.xml', name):
                root = ET.fromstring(z.read(name))
                result['charts'].append({'part': name, 'cachedValues': [x.text for x in root.findall('.//c:v', NS)]})
    return result

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps([inspect(pathlib.Path(p)) for p in sys.argv[1:]], ensure_ascii=False, indent=2))

