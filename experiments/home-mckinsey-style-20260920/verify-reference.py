from pathlib import Path
import json, zipfile, xml.etree.ElementTree as E, unicodedata, posixpath, hashlib
from PIL import Image, ImageChops

base=Path(__file__).resolve().parent
candidate=base/'reference-02/candidate-1'
oldfile=base/'gray-to-mckinsey-refined.pptx'
newfile=candidate/'deck.pptx'
gray=json.loads((base/'reference-02/input.json').read_text(encoding='utf-8'))
ns={'a':'http://schemas.openxmlformats.org/drawingml/2006/main','p':'http://schemas.openxmlformats.org/presentationml/2006/main'}
rns='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
def norm(s):return ''.join(c for c in s if not c.isspace() and not unicodedata.category(c).startswith('P'))
def canonical(z,p):
    root=E.fromstring(z.read(p));folder,name=posixpath.split(p);rp=folder+'/_rels/'+name+'.rels'
    rels={v.get('Id'):(v.get('Type'),v.get('Target')) for v in E.fromstring(z.read(rp))} if rp in z.namelist() else {}
    for e in root.iter():
        for k,v in list(e.attrib.items()):
            if k.startswith(rns):e.set(k,str(rels[v]))
    return E.tostring(root)
with zipfile.ZipFile(oldfile) as old, zipfile.ZipFile(newfile) as new:
    tree=E.fromstring(new.read('ppt/slides/slide1.xml'))
    texts=[];captions=[]
    for shape in tree.findall('.//p:sp',ns):
        name=shape.find('./p:nvSpPr/p:cNvPr',ns).get('name','')
        text=''.join(t.text or '' for t in shape.findall('.//a:t',ns))
        if '-detail-lead-' in name and text:
            assert text=='主要表现';captions.append(text)
        else:texts.append(text)
    joined=norm(''.join(texts));coverage=[]
    for g in gray['pages'][0]['groups']:
        assert norm(g['heading']) in joined
        for b in g['blocks']:
            assert norm(b['label']) in joined,b['id']
            assert norm(b['text']) in joined,b['id']
            coverage.append(b['id'])
    assert captions==['主要表现']
    for p in old.namelist():
        if p.startswith(('ppt/media/','ppt/theme/')):assert old.read(p)==new.read(p),p
        if p.startswith(('ppt/slideMasters/','ppt/slideLayouts/')) and p.endswith('.xml'):assert canonical(old,p)==canonical(new,p),p
    count=len(tree.findall('.//p:sp',ns));assert len(tree.findall('.//p:pic',ns))==0
oldimg=Image.open(base/'gray-to-mckinsey-refined.png').convert('RGB')
newimg=Image.open(candidate/'slide-01.png').convert('RGB')
assert oldimg.size==newimg.size==(1280,720)
for rect in [(0,0,1280,166),(0,658,1280,720),(0,166,55,658),(1225,166,1280,658),(55,166,598,496)]:
    assert ImageChops.difference(oldimg.crop(rect),newimg.crop(rect)).getbbox() is None,rect
oldqa=json.loads((base/'final/build-check.json').read_text(encoding='utf-8'))
newqa=json.loads((candidate/'build-check.json').read_text(encoding='utf-8'))
assert oldqa['geometry']==newqa['geometry']
assert not newqa['overlaps']
report={'nativeShapes':count,'grayBlocksCoveredInNativeText':coverage,'structuralCaptionsAdded':captions,'inheritedMediaAndThemeIdentical':True,'masterAndLayoutEquivalent':True,'outsideBodyPixelIdentical':True,'leftStructureAndUpperBlockPixelIdentical':True,'structureGeometryIdentical':True,'textRectangleOverlaps':newqa['overlaps'],'humanReview':'pending','pptxSha256':hashlib.sha256(newfile.read_bytes()).hexdigest()}
(candidate/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
