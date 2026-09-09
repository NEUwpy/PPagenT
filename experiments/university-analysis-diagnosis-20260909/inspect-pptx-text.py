"""Read actual editable PPTX runs; evidence only, not an aesthetic verdict."""
import sys, json, zipfile, re, collections
import xml.etree.ElementTree as ET
from pathlib import Path
ns = {'a':'http://schemas.openxmlformats.org/drawingml/2006/main', 'p':'http://schemas.openxmlformats.org/presentationml/2006/main'}
rows = []
with zipfile.ZipFile(sys.argv[1]) as z:
    slides = sorted((p for p in z.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml',p)), key=lambda p:int(re.search(r'(\d+)\.xml',p).group(1)))
    for number, part in enumerate(slides, 1):
        tree = ET.fromstring(z.read(part))
        for sp in tree.findall('.//p:sp', ns):
            name = sp.find('p:nvSpPr/p:cNvPr', ns)
            for paragraph in sp.findall('p:txBody/a:p', ns):
                defaults = paragraph.find('a:pPr/a:defRPr',ns)
                for run in paragraph.findall('a:r', ns):
                    text = run.findtext('a:t',default='',namespaces=ns)
                    props = run.find('a:rPr',ns)
                    props = props if props is not None else defaults
                    size = props.get('sz') if props is not None else None
                    latin = props.find('a:latin',ns) if props is not None else None
                    rows.append({'page':number, 'shape':name.get('name') if name is not None else None, 'text':text, 'pt':float(size)/100 if size else None, 'designPx':float(size)/75 if size else None, 'font':latin.get('typeface') if latin is not None else None})
result = {'input':str(Path(sys.argv[1]).resolve()), 'slideCount':len(slides), 'runCount':len(rows), 'explicitSizeCounts':dict(collections.Counter(str(r['designPx']) for r in rows)), 'runs':rows, 'limit':'Explicit native text runs only; inherited styles, clipping and visual quality require separate inspection.'}
Path(sys.argv[2]).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in result.items() if k!='runs'},ensure_ascii=False))
