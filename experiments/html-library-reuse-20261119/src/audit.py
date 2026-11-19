from pathlib import Path
import json,re,hashlib,difflib,zipfile,xml.etree.ElementTree as X
from PIL import Image
import fitz
E=Path(__file__).resolve().parents[1]
R=E.parents[1]
H=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
D=json.loads((E/'content.json').read_text(encoding='utf8'))
norm=lambda s:re.sub(r'\s','',s)
source=R/'assets/结构图/多路汇聚结果-003/review.mjs'
local=E/'src/convergence-local.mjs'
original=source.read_text(encoding='utf8');adapted=local.read_text(encoding='utf8')
(E/'evidence/convergence-local.diff').write_text(''.join(difflib.unified_diff(original.splitlines(True),adapted.splitlines(True),fromfile=str(source.relative_to(R)),tofile='src/convergence-local.mjs')),encoding='utf8')
preserved={}
for start,end in [('function normalize(', 'function clamp('),('function pathMarkup(', 'function inputMarkup('),('function inputMarkup(', 'function resultMarkup('),('function resultMarkup(', 'export const visualComponent'),('export function renderAdaptiveMarkup(', 'export const previewParameters')]:
 a=original[original.index(start):original.index(end)]
 b=adapted[adapted.index(start):adapted.index(end)]
 preserved[start]={'identical':a==b,'sha256':hashlib.sha256(a.encode()).hexdigest()}
ns={'p':'http://schemas.openxmlformats.org/presentationml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
result={'tip':'acaf72e306db0b6f16b5a50b12cf92816f00a789','preservedFunctions':preserved,'pages':{},'nativeCandidates':{}}
calls=json.loads((E/'evidence/structure-calls.json').read_text(encoding='utf8'))
for mode in ['a','b']:
 png=E/f'outputs/page-{mode}.png'
 im=Image.open(png)
 html=(E/f'outputs/page-{mode}.html').read_text(encoding='utf8')
 dom=json.loads((E/f'evidence/page-{mode}-audit.json').read_text(encoding='utf8'))
 pdf=fitz.open(E/f'outputs/page-{mode}.pdf')
 txt=norm(pdf[0].get_text())
 # Segmented implementation uses exactly the original title+body sequence.
 fragments=[calls['context']]+[x['title']+x['body'] for x in calls['parameters']['inputs']]
 coverage=[{'id':b['id'],'label':norm(b['label']) in txt,'body':all(norm(s) in txt for s in fragments) if b['id']=='implementation' else norm(b['text']) in txt} for g in D['groups'] for b in g['blocks']]
 result['pages'][mode]={'size':list(im.size),'sha256':H(png),'htmlSha256':hashlib.sha256(html.encode()).hexdigest(),'pdfPages':len(pdf),'pdfCoverage':coverage,'domBlockers':dom['blockers'],'endpointErrors':[[p['startError'],p['endError']] for p in dom['paths']],'bodyAndHeadingMinimumPx':dom['minimumBodySize'],'containsSourcePreview':any(x in html for x in ['source-convergence.png','source-folded-notes.png']),'htmlRasterImages':re.findall(r'<img\b[^>]*src="([^"]+)"',html)}
 p=E/f'outputs/page-{mode}-native-candidate.pptx'
 with zipfile.ZipFile(p) as z:
  tree=X.fromstring(z.read('ppt/slides/slide1.xml'))
  texts=[n.text or '' for n in tree.findall('.//a:t',ns)]
  s=norm(''.join(texts))
  shapeText=[]
  for sp in tree.findall('.//p:sp',ns):
   ts=[t.text or '' for t in sp.findall('.//a:t',ns)]
   if ts:
    shapeText.append({'name':sp.find('p:nvSpPr/p:cNvPr',ns).get('name'),'text':''.join(ts),'paragraphs':len(sp.findall('.//a:p',ns))})
  coverage=[{'id':b['id'],'label':norm(b['label']) in s,'body':all(norm(f) in s for f in fragments) if b['id']=='implementation' else norm(b['text']) in s} for g in D['groups'] for b in g['blocks']]
  result['nativeCandidates'][mode]={'file':str(p.relative_to(E)).replace('\\','/'),'sha256':H(p),'nativeShapes':len(tree.findall('.//p:sp',ns)),'pictures':len(tree.findall('.//p:pic',ns)),'customPaths':len(tree.findall('.//a:custGeom',ns)),'coverage':coverage,'textShapes':shapeText,'powerPointRender':f'outputs/page-{mode}-native.png','visualStatus':'not faithful enough to HTML: one-sided borders, inline/hidden indexes, gradient direction and text wrapping differ; retained as candidate evidence only'}
manifest=json.loads((E/'evidence/input-manifest.json').read_text(encoding='utf8'))
unchanged=[]
for s in manifest['sources']:unchanged.append({'file':s['file'],'unchanged':H(R/s['file'])==s['sha256']})
old=R/'experiments/layout-methods-20261116'
oldmanifest=json.loads((old/'evidence/delivery-manifest.json').read_text(encoding='utf8'))
oldchecks=[{'file':f['path'],'unchanged':(old/f['path']).stat().st_size==f['bytes'] and H(old/f['path'])==f['sha256']} for f in oldmanifest['files']]
result['libraryAndRuntimeSourcesUnchanged']=unchanged
result['previous44FrozenFilesUnchanged']=oldchecks
result['htmlScopePass']=all(v['identical'] for v in preserved.values()) and all(not v['containsSourcePreview'] and not v['domBlockers'] and all(c['label'] and c['body'] for c in v['pdfCoverage']) for v in result['pages'].values()) and all(v['unchanged'] for v in unchanged+oldchecks)
(E/'evidence/final-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'htmlScopePass':result['htmlScopePass'],'pages':{k:{'size':v['size'],'coverage':all(c['label'] and c['body'] for c in v['pdfCoverage']),'blockers':len(v['domBlockers'])} for k,v in result['pages'].items()},'native':{k:{'shapes':v['nativeShapes'],'pictures':v['pictures'],'paths':v['customPaths'],'coverage':all(c['label'] and c['body'] for c in v['coverage'])} for k,v in result['nativeCandidates'].items()}},ensure_ascii=False))
if not result['htmlScopePass']:raise SystemExit('HTML source/content/geometry or unchanged-source checks failed')
