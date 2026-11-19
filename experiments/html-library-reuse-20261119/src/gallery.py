from pathlib import Path
import json,html
from PIL import Image,ImageOps,ImageDraw,ImageFont
E=Path(__file__).resolve().parents[1]
items=[
 dict(id='a',title='结构库稿 A · 左右分组',path='outputs/page-a.png',scope='真实汇聚源设计＋任务局部容量/CSS适配，大学原外壳区域。',source='outputs/page-a.html',pdf='outputs/page-a.pdf'),
 dict(id='b',title='结构库稿 B · 上下分带',path='outputs/page-b.png',scope='相同汇聚源设计，宽图与合规并排，四点感悟在下方；同时调整页头/分配。',source='outputs/page-b.html',pdf='outputs/page-b.pdf'),
 dict(id='old-slidev',title='上一轮 Slidev 临时图',path='assets/previous-slidev.png',scope='历史基线：手工矩形和箭头，没有使用本项目汇聚结构。'),
 dict(id='old-seaslides',title='上一轮 SeaSlides 临时图',path='assets/previous-seaslides.png',scope='历史基线：模板卡片＋手工箭头，没有使用本项目汇聚结构。'),
 dict(id='old-native',title='旧原生美化稿',path='assets/previous-native.png',scope='历史 reference-02，曾以任务局部原生几何适配此汇聚设计。'),
 dict(id='generated',title='用户生图参照',path='assets/generated-reference.png',scope='只作视觉参照；新增原因文字未进入当前稿件。'),
 dict(id='native-a',title='A · PowerPoint 候选重渲染',path='outputs/page-a-native.png',scope='38个原生形状＋1校标，存在边线、编号、渐变与网页差异。',pptx='outputs/page-a-native-candidate.pptx'),
 dict(id='native-b',title='B · PowerPoint 候选重渲染',path='outputs/page-b-native.png',scope='37个原生形状＋1校标，隐藏编号重现、单侧线与网页差异。',pptx='outputs/page-b-native-candidate.pptx'),
]
preview=[dict(title='原资产：多路汇聚结果',path='assets/source-convergence.png',scope='仅作原造型参照，不是本次生成结果，未嵌入本次整页。'),dict(title='原资产：双排折角便签',path='assets/source-folded-notes.png',scope='仅作来源参照；本稿全文试排未通过，未进入最终整页。')]
def card(i):
 links='<a href="'+i['path']+'" target="_blank">完整 PNG</a>'
 for key,label in [('source','整页 HTML'),('pdf','PDF'),('pptx','候选 PPTX')]:
  if key in i: links+=f'<a href="{i[key]}" target="_blank">{label}</a>'
 return f'''<article><h3>{html.escape(i['title'])}</h3><button class="image" data-path="{i['path']}" data-title="{html.escape(i['title'])}"><img src="{i['path']}" alt="{html.escape(i['title'])}"></button><p>{html.escape(i['scope'])}</p><div class="links">{links}</div></article>'''
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',27)
sheet=Image.new('RGB',(2880,1280),'#eaf0f7');draw=ImageDraw.Draw(sheet)
for i,item in enumerate(items[:6]):
 x=(i%3)*960;y=(i//3)*640
 draw.text((x+16,y+14),item['title'],font=font,fill='#244a73')
 im=ImageOps.contain(Image.open(E/item['path']).convert('RGB'),(936,526))
 sheet.paste(im,(x+12+(936-im.width)//2,y+67+(526-im.height)//2))
sheet.save(E/'outputs/overview.png')
doc='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HTML 实际接入项目结构库</title><style>
*{box-sizing:border-box}body{margin:0;background:#f0f4f8;color:#26384e;font:16px/1.65 'Microsoft YaHei',sans-serif}main{max-width:1540px;margin:auto;padding:26px 30px 54px}h1{font-size:29px;line-height:1.4;color:#244a73;margin:0 0 9px}h2{font-size:23px;margin:29px 0 13px}h3{font-size:18px;margin:0 0 11px}p{margin:9px 0}.intro{max-width:1200px}.note{font-size:14px;color:#52677f}a{color:#2459a6;text-decoration:none}a:hover{text-decoration:underline}.controls{display:flex;gap:18px;flex-wrap:wrap;margin-bottom:13px}select{font:inherit;padding:7px 10px;border:1px solid #b9c9de;border-radius:4px;max-width:45vw;background:white}.grid,.pair{display:grid;grid-template-columns:1fr 1fr;gap:22px}.refs{grid-template-columns:repeat(2,1fr)}article,figure{margin:0;background:white;border:1px solid #d7e1ed;padding:17px;min-width:0}figure img,.image img{display:block;width:100%;aspect-ratio:16/9;object-fit:contain;background:white}figcaption{font-weight:600;margin-bottom:9px}.image{border:0;background:white;padding:0;width:100%;cursor:zoom-in}article p{font-size:14px;color:#53667d}.links{display:flex;gap:16px;flex-wrap:wrap;font-size:14px}details{margin-top:25px}summary{cursor:pointer;font-size:19px;font-weight:700;color:#244a73;margin-bottom:13px}.failures img{max-height:430px;object-fit:contain}dialog{max-width:96vw;max-height:96vh;width:1450px;padding:16px;background:white;border:1px solid #b9c9de}dialog::backdrop{background:#1b2e48bb}dialog img{width:100%;display:block}dialog button{float:right;font:inherit;padding:4px 14px;border:1px solid #b9c9de;background:white;cursor:pointer}#dialogTitle{font-weight:700;font-size:19px;margin-bottom:12px}@media(max-width:900px){main{padding:20px 14px}.grid,.pair,.refs{grid-template-columns:1fr}select{max-width:90vw}}
</style><main><h1>HTML 实际接入项目结构库</h1><p class="intro">同一页两组六块全文，实际复用 <strong>convergence-many-to-one-003</strong> 的输入、结果和三次贝塞尔汇聚实现。两版都保留分离输入、平滑粗曲线和唯一结果，没有把资产预览截图贴进页面。</p><p class="note">原共享入口在本次小区域出现裁切／变量绑定问题；当前是有明确任务局部适配的源设计复用。第二资产全文试排失败后，B改用同一汇聚结构的另一种整页分配。<a href="README.md">接入与边界说明</a> · <a href="outputs/overview.png" target="_blank">六图总览</a></p>
<h2>并排比较</h2><div class="controls"><label>左侧 <select id="left"></select></label><label>右侧 <select id="right"></select></label></div><div class="pair"><figure><figcaption id="leftTitle"></figcaption><img id="leftImage"></figure><figure><figcaption id="rightTitle"></figcaption><img id="rightImage"></figure></div>
<h2>两张新整页</h2><div class="grid">NEW</div><h2>历史基线</h2><div class="grid refs">BASELINES</div>
<details><summary>原资产造型参照</summary><div class="grid">PREVIEWS</div></details>
<details><summary>原生导出候选及实际差异</summary><p class="note">本机PowerPoint实际重渲染；全文和路径是原生对象，但输入单侧强调边、分隔线、内嵌/隐藏编号和A页渐变方向未完整对应网页。两份保留为候选证据，未宣称完成成品一致性检查。</p><div class="grid">NATIVE</div></details>
<details><summary>未通过的库内接口／第二资产试排</summary><p class="note">原文未删。共享汇聚适配裁切首输入；直接自适应HTML与原CSS错位；折角便签／等权卡片在本页已试区域出现裁切。原始记录见 <a href="evidence/library-probes.json">测量与调用</a>，并非否定这些资产在所有区域的能力。</p><div class="grid failures"><article><h3>共享汇聚适配</h3><img src="evidence/convergence-shared-adapter.png" width="100%"></article><article><h3>折角便签：全文试排</h3><img src="evidence/folded-notes-adaptive-514x430.png" width="100%"></article><article><h3>等权卡片：全文试排</h3><img src="evidence/equal-cards-shared-1170x230.png" width="100%"></article></div></details>
<p class="note">本轮是有界整页探索；原资产、生产代码、上一轮冻结44项文件保持不变。调用成功或局部审查不代表用户验收。</p></main><dialog id="viewer"><button id="close">关闭</button><div id="dialogTitle"></div><img id="dialogImage"></dialog><script>
const items=ITEMS;for(const side of ['left','right']){const s=document.getElementById(side);for(const i of items){const o=document.createElement('option');o.value=i.id;o.textContent=i.title;s.append(o)}s.value=side==='left'?'old-slidev':'a';s.onchange=()=>{const i=items.find(x=>x.id===s.value);document.getElementById(side+'Title').textContent=i.title;const image=document.getElementById(side+'Image');image.src=i.path;image.alt=i.title};s.onchange()}
const dialog=document.getElementById('viewer');document.querySelectorAll('[data-path]').forEach(b=>b.onclick=()=>{document.getElementById('dialogTitle').textContent=b.dataset.title;document.getElementById('dialogImage').src=b.dataset.path;dialog.showModal()});document.getElementById('close').onclick=()=>dialog.close();dialog.onclick=e=>{if(e.target===dialog)dialog.close()};
</script></html>'''.replace('BASELINES',''.join(card(i) for i in items[2:6])).replace('PREVIEWS',''.join(card(i) for i in preview)).replace('NATIVE',''.join(card(i) for i in items[6:])).replace('NEW',''.join(card(i) for i in items[:2])).replace('ITEMS',json.dumps(items,ensure_ascii=False))
(E/'index.html').write_text(doc,encoding='utf8')
(E/'evidence/gallery-items.json').write_text(json.dumps(items,ensure_ascii=False,indent=2),encoding='utf8')
print('Wrote gallery and six-image overview.')
