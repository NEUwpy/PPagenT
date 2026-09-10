"""Read final PPTX objects independently of the maker's role registry; no visual verdict."""
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as E

src, dst = map(Path, sys.argv[1:3])
ns = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
      'p': 'http://schemas.openxmlformats.org/presentationml/2006/main'}
pages = []
with zipfile.ZipFile(src) as z:
    pres = E.fromstring(z.read('ppt/presentation.xml'))
    size = pres.find('p:sldSz', ns).attrib
    unit = int(size['cx']) / 1280 / 12700
    names = sorted((n for n in z.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml', n)),
                   key=lambda n: int(re.search(r'slide(\d+)\.xml', n)[1]))
    for name in names:
        root = E.fromstring(z.read(name))
        objects = []
        for obj in root.findall('.//p:spTree/*', ns):
            text = '\n'.join(''.join(p.itertext()) for p in obj.findall('.//a:t', ns))
            runs = []
            for p in obj.findall('.//a:p', ns):
                default = p.find('a:pPr/a:defRPr', ns)
                for r in p.findall('a:r', ns):
                    props = r.find('a:rPr', ns)
                    attrs = {**(default.attrib if default is not None else {}),
                             **(props.attrib if props is not None else {})}
                    fonts = []
                    for node in [default, props]:
                        if node is not None:
                            fonts += [f.attrib for f in list(node) if f.tag.rsplit('}', 1)[-1] in ['latin','ea','cs']]
                    sz = float(attrs['sz']) / 100 if 'sz' in attrs else None
                    runs.append({'text': ''.join(r.find('a:t', ns).itertext()) if r.find('a:t', ns) is not None else '',
                                 'pt': sz, 'designSize': round(sz / unit, 3) if sz is not None else None,
                                 'properties': attrs, 'fonts': fonts})
            if text:
                ident = obj.find('.//p:cNvPr', ns)
                xfrm = obj.find('.//a:xfrm', ns)
                autofit = [e.tag.rsplit('}',1)[-1] for e in obj.findall('.//a:bodyPr/*', ns)]
                objects.append({'identity': ident.attrib if ident is not None else {}, 'text': text,
                                'runs': runs, 'textSettings': autofit,
                                'transform': E.tostring(xfrm, encoding='unicode') if xfrm is not None else None})
        pages.append({'slide': name, 'textObjects': objects,
                      'pictures': len(root.findall('.//p:pic', ns)),
                      'connectors': len(root.findall('.//p:cxnSp', ns))})
result = {'file': str(src.resolve()), 'sha256': hashlib.sha256(src.read_bytes()).hexdigest(),
          'slideSize': size, 'ptPerDesignPixel': unit, 'pages': pages,
          'limits': 'Inherited master/theme formatting may require additional resolution. Numeric inventory is not semantic role or visual acceptance.'}
dst.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'pages': len(pages), 'sha256': result['sha256']}))
