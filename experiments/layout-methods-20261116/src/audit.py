from pathlib import Path
import json,re,zipfile,xml.etree.ElementTree as X,hashlib
import fitz
from PIL import Image
E=Path(__file__).resolve().parents[1]
D=json.loads((E/'content.json').read_text(encoding='utf8'))
norm=lambda s: re.sub(r'\s+','',s)
blocks=[b for g in D['groups'] for b in g['blocks']]
result={'completion_date':'2026-11-17','tip':'acaf72e306db0b6f16b5a50b12cf92816f00a789','images':{},'pdf':{},'pptx':{}}
for method in ['marp','seaslides','yoga','slidev','typst']:
    p=E/f'outputs/{method}.png'
    im=Image.open(p)
    result['images'][method]={'size':list(im.size),'aspect_ratio':im.width/im.height,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
for method in ['marp','seaslides','slidev','typst']:
    doc=fitz.open(E/f'outputs/{method}.pdf')
    page=doc[0]
    txt=norm(page.get_text())
    spans=[s for b in page.get_text('dict')['blocks'] if 'lines' in b for line in b['lines'] for s in line['spans']]
    outside=[{'text':s['text'],'bbox':s['bbox']} for s in spans if not page.rect.contains(fitz.Rect(s['bbox']))]
    result['pdf'][method]={'pages':len(doc),'canvas_pt':list(page.rect),'coverage':[{'id':b['id'],'label':norm(b['label']) in txt,'body':norm(b['text']) in txt} for b in blocks],
        'outside_spans':outside,'fonts':[list(f) for f in page.get_fonts()],'min_text_pt':min(s['size'] for s in spans)}
ns={'p':'http://schemas.openxmlformats.org/presentationml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
for method in ['seaslides','slidev']:
    p=E/f'outputs/{method}.pptx'
    with zipfile.ZipFile(p) as z:
        slide_files=[n for n in z.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml',n)]
        slide=X.fromstring(z.read('ppt/slides/slide1.xml'))
        pres=X.fromstring(z.read('ppt/presentation.xml'))
        texts=[t.text or '' for t in slide.findall('.//a:t',ns)]
        txt=norm(''.join(texts))
        shape_texts=[''.join(n.itertext()) for n in slide.findall('.//p:sp',ns)]
        shape_text=''.join(texts)
        size=pres.find('p:sldSz',ns)
        fonts=sorted(set(n.get('typeface') for tag in ['latin','ea','cs'] for n in slide.findall(f'.//a:{tag}',ns)))
        pts=sorted(set(int(n.get('sz'))/100 for n in slide.findall('.//a:rPr',ns) if n.get('sz')))
        result['pptx'][method]={'slides':len(slide_files),'size_emu':dict(size.attrib),'native_shapes':len(slide.findall('.//p:sp',ns)),
            'pictures':len(slide.findall('.//p:pic',ns)),'text_characters':len(shape_text),'font_families':fonts,'text_sizes_pt':pts,
            'coverage':[{'id':b['id'],'label':norm(b['label']) in txt,'body':norm(b['text']) in txt} for b in blocks],
            'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'powerpoint_rendered':(E/f'outputs/{method}-native.png').exists(),
            'manual_visual_observations':('Latin font maps to Segoe UI; CJK uses local fallback. Browser and native appearance are close, not pixel-identical.' if method=='seaslides' else 'Native PowerPoint rendering has isolated punctuation and changed line wrapping compared with browser PNG.')}
checks=[]
for m,a in result['images'].items(): checks.append(a['size']==[2560,1440])
for group in ['pdf','pptx']:
    for m,a in result[group].items(): checks.extend(c['label'] and c['body'] for c in a['coverage'])
result['coverage_and_size_pass']=all(checks)
(E/'evidence/output-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({g:{m:({'coverage':all(x['label'] and x['body'] for x in a['coverage']),'outside':len(a.get('outside_spans',[]))} if 'coverage' in a else a['size']) for m,a in result[g].items()} for g in ['images','pdf','pptx']},ensure_ascii=False))
if not result['coverage_and_size_pass']: raise SystemExit('Output audit failed')
