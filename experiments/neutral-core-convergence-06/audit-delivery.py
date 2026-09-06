import json, zipfile, hashlib
from pathlib import Path
from xml.etree import ElementTree as ET
root = Path(__file__).resolve().parent
pptx = root / 'outputs/deck.pptx'
ns = {'p':'http://schemas.openxmlformats.org/presentationml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
result = {'sha256': hashlib.sha256(pptx.read_bytes()).hexdigest(), 'slides': []}
with zipfile.ZipFile(pptx) as z:
    for i in range(1,4):
        xml = ET.fromstring(z.read(f'ppt/slides/slide{i}.xml'))
        item = {'slide':i,'nativeShapes':len(xml.findall('.//p:sp',ns)), 'pictures':len(xml.findall('.//p:pic',ns))}
        assert item['pictures'] == 0
        layout = json.loads((root / f'final-render/slide-{i:02}.layout.json').read_text(encoding='utf-8'))
        outside = []
        for el in layout.get('elements',[]):
            box = el.get('bbox')
            if box:
                x,y,w,h=box
                if x < -1 or y < -1 or x+w > 1281 or y+h > 721: outside.append(el.get('name'))
        item['outsideSlide']=outside
        assert not outside, outside
        result['slides'].append(item)
result['coreSha256'] = hashlib.sha256((root/'core.mjs').read_bytes()).hexdigest()
(root/'delivery-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
