import json, pathlib, re, unicodedata, zipfile, xml.etree.ElementTree as ET

base = pathlib.Path(__file__).resolve().parent
run = base / 'run-02'
state = json.loads((run / 'state.json').read_text(encoding='utf-8'))
gray = json.loads((base / 'input/gray-state.json').read_text(encoding='utf-8'))['grayDraft']['semanticPlan']
pptx = pathlib.Path(state['candidate']['pptx'])
def norm(s):
    return ''.join(c for c in s if not c.isspace() and not unicodedata.category(c).startswith('P'))
ns = {'p':'http://schemas.openxmlformats.org/presentationml/2006/main', 'a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
with zipfile.ZipFile(pptx) as z:
    slides = [n for n in z.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml', n)]
    assert len(slides) == 1
    tree = ET.fromstring(z.read(slides[0]))
    texts = [e.text or '' for e in tree.findall('.//a:t', ns)]
    joined = norm(''.join(texts))
    checks = []
    for group in gray['pages'][0]['groups']:
        assert norm(group['heading']) in joined
        for block in group['blocks']:
            assert norm(block['label']) in joined, block['id']
            assert norm(block['text']) in joined, block['id']
            checks.append({'id':block['id'], 'labelAndBodyInExportedNativeText':True})
    images = len(tree.findall('.//p:pic', ns))
    assert images == 0
    assert not any(t in ''.join(texts) for t in ['表达作用','制作要求','灰稿','杂志风','左侧呈现'])
    result = {'pptx':str(pptx), 'slides':len(slides), 'nativeShapes':len(tree.findall('.//p:sp',ns)),
              'images':images, 'blocks':checks, 'notes':'Actual native text checked; semantic relations and image appearance reviewed separately.'}
(run / 'package-check.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
