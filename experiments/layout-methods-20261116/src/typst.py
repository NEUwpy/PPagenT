"""Real SeaSlides/Touying/Typst authoring and compilation; no browser layout."""
from pathlib import Path
import json,sys,hashlib
E=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(E/'vendor/python'))
import typst
D=json.loads((E/'content.json').read_text(encoding='utf-8'))
P=E/'src/typst'
P.mkdir(exist_ok=True)
original=E/'vendor/seaslides/skills/seaslides-typst-slides-skill/templates/themes/custom-rich/navy-formal/template.typ'
theme=original.read_text(encoding='utf-8')
# Keep theme ownership and semantic method-card API. Adapt palette, readable
# Chinese card sizes and white header to use the supplied original light logo.
theme=theme.replace('rgb("#003366")','rgb("#1B3762")').replace('rgb("#0066CC")','rgb("#3361AE")').replace('rgb("#CC0000")','rgb("#3361AE")')
theme=theme.replace('block(width: 100%, height: 3.2em, fill: palette.primary)[','block(width: 100%, height: 3.2em, fill: palette.white)[')
theme=theme.replace('set text(fill: white, size: 1.2em, weight: "medium")','set text(fill: palette.primary, size: 32pt, weight: "bold")')
theme=theme.replace('text(weight: "semibold", fill: palette.primary, size: 0.9em, title)','text(weight: "semibold", fill: palette.primary, size: 23pt, title)')
theme=theme.replace('set text(fill: palette.text-body, size: 0.8em)','set text(fill: palette.text-body, size: 22pt)')
theme=theme.replace('spacing: .8em,\n      grid(', 'spacing: .45em,\n      grid(')
old='''#if self.store.title != none {
            utils.call-or-display(self, self.store.title)
          } else {
            utils.display-current-heading(level: 2)
          }'''
new='''#grid(columns: (1fr, 220pt), column-gutter: 24pt, align: horizon,
            [#if self.store.title != none {
              utils.call-or-display(self, self.store.title)
            } else { utils.display-current-heading(level: 2) }],
            image("../../assets/neu-logo.png", width: 220pt),
          )'''
assert old in theme
theme=theme.replace(old,new).replace('footer: footer,','footer: none,').replace('    _content-atmosphere()','    // Omit decoration for this institutional one-page comparison.')
(P/'template.typ').write_text(theme,encoding='utf-8')
def content(s): return s.replace('#',r'\#').replace('[',r'\[').replace(']',r'\]')
def card(b,i):
    return f'#method-card({i+1}, [{content(b["label"])}], [{content(b["text"])}])'
left='\n#v(12pt)\n'.join(card(b,i) for i,b in enumerate(D['groups'][0]['blocks']))
right='\n#v(10pt)\n'.join(card(b,i) for i,b in enumerate(D['groups'][1]['blocks']))
main='''#import "@preview/touying:0.7.4": *
#import "template.typ": *
#show: navy-formal-theme.with(
  aspect-ratio: "16-9",
  align: top,
  config-common(breakable: false),
  config-page(width: 1280pt, height: 720pt, margin: (top: 105pt, bottom: 38pt, x: 44pt)),
  config-info(title: [存在的不足与感悟], institution: none),
)
#set text(font: "Microsoft YaHei", size: 22pt, lang: "zh")
#set par(leading: .32em, spacing: 0pt)
#slide(title: [存在的不足与感悟])[
  #cols(columns: (0.94fr, 1.16fr), gutter: 30pt)[
    #text(size: 26pt, weight: "bold", fill: palette.accent-blue)[两点不足]
    #v(16pt)
LEFT
  ][
    #text(size: 26pt, weight: "bold", fill: palette.accent-blue)[四点感悟]
    #v(16pt)
RIGHT
  ]
]
'''.replace('LEFT',left).replace('RIGHT',right)
(P/'main.typ').write_text(main,encoding='utf-8')
cache=E/'.cache/typst-packages'
cache.mkdir(parents=True,exist_ok=True)
for fmt in ['pdf','png','svg']:
    out=E/f'outputs/typst.{fmt}'
    result=typst.compile(str(P/'main.typ'), output=str(out), root=str(E),format=fmt,ppi=144,package_cache_path=str(cache))
    print('Compiled',out.name)
(E/'evidence/typst-build.json').write_text(json.dumps(dict(compiler=typst.__version__,template_source=str(original.relative_to(E)),template_source_sha256=hashlib.sha256(original.read_bytes()).hexdigest(),package='@preview/touying:0.7.4',canvas_pt=[1280,720],png_ppi=144),indent=2),encoding='utf-8')
