from pathlib import Path
from PIL import Image,ImageOps,ImageDraw,ImageFont
import json,html
E=Path(__file__).resolve().parents[1]
items=[
 dict(id='marp',title='Marp · Markdown＋主题',path='outputs/marp.png',scope='纯文字排版对照；双栏由作者指定。',source='src/marp/slides.md',pdf='outputs/marp.pdf'),
 dict(id='seaslides',title='SeaSlides HTML · 语义组件模板',path='outputs/seaslides.png',scope='图示完整；原模板＋原编译器，容量与结构扩展由作者补做。',source='src/seaslides/content.html',pdf='outputs/seaslides.pdf',pptx='outputs/seaslides.pptx',native='outputs/seaslides-native.png'),
 dict(id='yoga',title='Yoga · 测量＋Flexbox',path='outputs/yoga.png',scope='纯文字排版对照；真实中文测量与 Yoga 几何计算。',source='src/yoga.mjs'),
 dict(id='slidev',title='Slidev · 宿主 Agent 整页设计',path='outputs/slidev.png',scope='图示完整；作者设计，Slidev 编译／测量／原生导出。',source='src/slidev/slides.md',pdf='outputs/slidev.pdf',pptx='outputs/slidev.pptx',native='outputs/slidev-native.png'),
 dict(id='typst',title='Typst／Touying · 原生排版',path='outputs/typst.png',scope='纯文字排版对照；实际 SeaSlides Typst 模板编译，不经浏览器排版。',source='src/typst/main.typ',pdf='outputs/typst.pdf'),
 dict(id='gray',title='原灰稿',path='assets/gray.png',scope='历史输入，原图保留。'),
 dict(id='previous',title='旧原生美化稿',path='assets/previous-native.png',scope='旧样例 reference-02；不是 README 早期74形状样例。'),
 dict(id='generated',title='用户生图参照',path='assets/generated-reference.png',scope='只作视觉参照；其新增事实与关系未进入正文。'),
]
f=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',27)
sheet=Image.new('RGB',(3840,1280),'#eaf0f7')
draw=ImageDraw.Draw(sheet)
for i,item in enumerate(items):
 x=(i%4)*960;y=(i//4)*640
 draw.text((x+18,y+14),item['title'],font=f,fill='#1b3762')
 im=Image.open(E/item['path']).convert('RGB')
 thumb=ImageOps.contain(im,(936,526))
 sheet.paste(thumb,(x+12+(936-thumb.width)//2,y+67+(526-thumb.height)//2))
sheet.save(E/'outputs/overview.png')
card=lambda i:f'''<article><h3>{html.escape(i['title'])}</h3><button class="image" data-open="{i['id']}"><img src="{i['path']}" alt="{html.escape(i['title'])}"></button><p>{html.escape(i['scope'])}</p><div class="links"><a href="{i['path']}" target="_blank">完整 PNG</a>'''+''.join(f'<a href="{i[k]}" target="_blank">{label}</a>' for k,label in [('source','源码'),('pdf','PDF'),('pptx','PPTX'),('native','PPTX 实际渲染')] if i.get(k))+'''</div></article>'''
doc='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>同页内容的五种排版方法</title><style>
*{box-sizing:border-box}body{margin:0;background:#f0f4f8;color:#24364c;font:16px/1.65 'Microsoft YaHei',sans-serif}main{max-width:1540px;margin:auto;padding:28px 30px 55px}h1{font-size:29px;line-height:1.4;color:#1b3762;margin:0 0 10px}h2{font-size:23px;margin:32px 0 13px}h3{font-size:18px;line-height:1.5;margin:0 0 12px}p{margin:10px 0}.intro{max-width:1150px}.note{color:#53667e;font-size:15px}a{color:#2459a6;text-decoration:none}a:hover{text-decoration:underline}.controls{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:14px}select{font:inherit;max-width:40vw;padding:7px 10px;border:1px solid #b7c8df;border-radius:5px;background:white}.pair,.grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}figure{margin:0;background:white;padding:13px;border:1px solid #d7e0ed}figure img{display:block;width:100%;aspect-ratio:16/9;object-fit:contain;background:white}figcaption{font-weight:600;margin-bottom:10px}article{background:white;padding:19px;border:1px solid #d7e0ed;min-width:0}.image{padding:0;border:0;background:white;cursor:zoom-in;width:100%}.image img{display:block;width:100%;aspect-ratio:16/9;object-fit:contain}.links{display:flex;flex-wrap:wrap;gap:17px;font-size:14px}article p{font-size:14px;color:#53667e}.refs{grid-template-columns:repeat(3,1fr)}dialog{max-width:96vw;max-height:96vh;width:1450px;border:1px solid #b7c8df;padding:16px;background:white}dialog::backdrop{background:#17243dbb}dialog img{width:100%;display:block}dialog button{float:right;font:inherit;border:1px solid #b7c8df;background:white;padding:4px 15px;cursor:pointer}.dialog-title{font-size:19px;font-weight:700;margin-bottom:12px}@media(max-width:900px){main{padding:20px 14px}.pair,.grid,.refs{grid-template-columns:1fr}select{max-width:90vw}}
</style><main><h1>同一页内容，五种排版方法</h1><p class="intro">共同输入为“两点不足、四点感悟”，全部六块标签和正文保留。五法均有真实工具执行和 2560×1440 PNG；没有运行外部模型的自动生成链。两种图示样例落实“三项障碍 → 落地阻力”，三种文字对照只比较排版。</p><p class="note">完成于 2026-11-17 · 东北大学蓝白适配 · 当前只作方法探索，未选型、未进入生产实现。<a href="README.md">方法与复现说明</a> · <a href="outputs/overview.png" target="_blank">并排总览</a></p>
<h2>并排比较</h2><div class="controls"><label>左侧 <select id="left"></select></label><label>右侧 <select id="right"></select></label></div><div class="pair"><figure><figcaption id="leftTitle"></figcaption><img id="leftImage"></figure><figure><figcaption id="rightTitle"></figcaption><img id="rightImage"></figure></div><h2>五种实际方法</h2><div class="grid">METHODS</div><h2>历史参照</h2><div class="grid refs">REFS</div><p class="note">PPTX链接是框架的原生形状导出；“PPTX实际渲染”另列，便于区分网页图与 PowerPoint 中的外观。Slidev 原生版观察到标点孤行；SeaSlides 原生版存在字体映射差异。编辑覆盖与转换限制见说明。原灰稿、旧稿、生图均从历史文件原样复制。</p></main><dialog id="viewer"><button id="close">关闭</button><div class="dialog-title" id="dialogTitle"></div><img id="dialogImage"></dialog><script>
const items=ITEMS;for(const side of ['left','right']){const select=document.getElementById(side);for(const item of items){const o=document.createElement('option');o.value=item.id;o.textContent=item.title;select.append(o)}select.value=side==='left'?'previous':'slidev';select.onchange=()=>{const item=items.find(x=>x.id===select.value);document.getElementById(side+'Title').textContent=item.title;const img=document.getElementById(side+'Image');img.src=item.path;img.alt=item.title};select.onchange()}
const viewer=document.getElementById('viewer');document.querySelectorAll('[data-open]').forEach(button=>button.onclick=()=>{const item=items.find(x=>x.id===button.dataset.open);document.getElementById('dialogTitle').textContent=item.title;document.getElementById('dialogImage').src=item.path;viewer.showModal()});document.getElementById('close').onclick=()=>viewer.close();viewer.onclick=e=>{if(e.target===viewer)viewer.close()};
</script></html>'''.replace('METHODS',''.join(card(i) for i in items[:5])).replace('REFS',''.join(card(i) for i in items[5:])).replace('ITEMS',json.dumps(items,ensure_ascii=False))
(E/'index.html').write_text(doc,encoding='utf8')
(E/'evidence/gallery-items.json').write_text(json.dumps(items,ensure_ascii=False,indent=2),encoding='utf8')
print('Wrote gallery and 8-image overview.')
