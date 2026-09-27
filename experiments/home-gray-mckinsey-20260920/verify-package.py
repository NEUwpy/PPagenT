from pathlib import Path
import json, re, unicodedata, zipfile, xml.etree.ElementTree as ET, hashlib
base=Path(__file__).resolve().parent
root=base.parents[1]
run=base/'run-02'
state=json.loads((run/'state.json').read_text(encoding='utf-8'))
gray=json.loads(Path(state['input']).read_text(encoding='utf-8'))['grayDraft']['semanticPlan']
ns={'p':'http://schemas.openxmlformats.org/presentationml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
def norm(s):return ''.join(c for c in s if not c.isspace() and not unicodedata.category(c).startswith('P'))
with zipfile.ZipFile(state['candidate']['pptx']) as z, zipfile.ZipFile(root/'assets/主题/东北大学-001/runtime-template.pptx') as source:
    slides=[n for n in z.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml',n)]
    assert len(slides)==1
    tree=ET.fromstring(z.read(slides[0]))
    texts=[e.text or '' for e in tree.findall('.//a:t',ns)]
    joined=norm(''.join(texts))
    checks=[]
    for g in gray['pages'][0]['groups']:
        assert norm(g['heading']) in joined
        for b in g['blocks']:
            assert norm(b['label']) in joined,b['id']
            assert norm(b['text']) in joined,b['id']
            checks.append({'block':b['id'],'nativeLabelAndBody':True})
    assert norm(state['blueprint']['headline']) in joined
    assert not any(t in ''.join(texts) for t in ['主旨句','正文页','制作要求','灰稿','左侧呈现'])
    for ph in tree.findall('.//p:ph',ns):
        assert ph.get('type') not in ['dt','ftr','sldNum'], 'Unresolved inherited placeholder'
    themes=[n for n in z.namelist() if n.startswith('ppt/theme/') and n.endswith('.xml')]
    assert themes and all(z.read(n)==source.read(n) for n in themes)
    assert any(n.startswith('ppt/slideMasters/') and n.endswith('.xml') for n in z.namelist())
    assert any(n.startswith('ppt/slideLayouts/') and n.endswith('.xml') for n in z.namelist())
    images=len(tree.findall('.//p:pic',ns))
    assert images==0, 'Body should remain native; identity artwork stays inherited'
    check={'slides':1,'nativeShapes':len(tree.findall('.//p:sp',ns)),'slideImages':images,'sourceThemeByteIdentical':True,'masterAndLayoutRetained':True,'contentCoverage':checks,'humanReview':'pending'}
(run/'package-check.json').write_text(json.dumps(check,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(check,ensure_ascii=False,indent=2))
