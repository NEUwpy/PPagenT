// Consume the gray block's existing diagram requirement in the two visual routes.
// Marp/Yoga/Typst remain explicitly labeled text-typesetting controls.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const E=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const D=JSON.parse(await fs.readFile(path.join(E,'content.json'),'utf8'));
const b=D.groups[0].blocks[0];
const parts=['顶层设计已完成；','公司内部人力资源变革氛围尚未完全形成，','信息系统支撑能力仍有差距，','缺乏市场化管理机制。'];
if(parts.join('')!==b.text)throw new Error('Diagram content differs from common body');
const flow=(prefix)=>`<div class="${prefix}-body" data-body="implementation"><p class="${prefix}-context">${parts[0]}</p><div class="${prefix}-flow"><div class="${prefix}-obstacles">${parts.slice(1).map(t=>`<p class="${prefix}-obstacle">${t}</p>`).join('')}</div><span class="${prefix}-arrow">→</span><div class="${prefix}-outcome">变革落地<br>阻力重重</div></div></div>`;
let sea=await fs.readFile(path.join(E,'src/seaslides/content.html'),'utf8');
sea=sea.replace(`<p class="card-desc" data-body="implementation">${b.text}</p>`,flow('pp'));
await fs.writeFile(path.join(E,'src/seaslides/content.html'),sea);
await fs.appendFile(path.join(E,'src/seaslides/template.css'),`\n/* Diagram-capacity adaptation, consuming implementation.kind=diagram. */
.pp-issues{width:51%}.pp-insight-grid{display:flex;flex-direction:column;gap:12px}.pp-issue-stack .insight-card{flex:0 0 auto}
.pp-insight-grid .insight-card{padding:11px 14px 11px 52px;position:relative}.pp-insight-grid .card-nb{position:absolute;left:14px;top:12px;margin:0}.pp-insight-grid .card-title{font-size:22px;margin-bottom:7px}.pp-insight-grid .card-desc{font-size:21px;line-height:1.4}
.pp-context{font-size:21px;line-height:1.4;color:#344356;margin-bottom:9px}.pp-flow{display:grid;grid-template-columns:1fr 32px 126px;gap:6px;align-items:center}.pp-obstacles{display:flex;flex-direction:column;gap:6px}.pp-obstacle{font-size:21px;line-height:1.35;padding:6px 9px;background:white;border-left:3px solid #8ca7ce;color:#344356}.pp-arrow{font-size:32px;color:var(--accent);text-align:center}.pp-outcome{background:var(--accent);color:white;font-size:22px;font-weight:700;line-height:1.4;padding:19px 10px;text-align:center}
.slide{padding:34px 48px 28px}.page-header h2{font-size:36px;line-height:1.2;margin:0}.pp-issues{width:47%}.pp-issue-stack .card-nb{display:none}.pp-insight-grid{gap:9px}.pp-insight-grid .insight-card{padding:6px 14px 6px 52px}.pp-insight-grid .card-nb{top:7px}
.pp-body{display:block}
`);
let slidev=await fs.readFile(path.join(E,'src/slidev/slides.md'),'utf8');
slidev=slidev.replace(/<div class="implementation-body"[\s\S]*?<\/div><\/div><\/article>/,flow('free')+'</article>');
slidev=slidev.replace('</style>',`
.free-context{padding-left:50px;margin-bottom:9px!important}.free-flow{display:grid;grid-template-columns:1fr 30px 100px;gap:6px;padding-left:50px;align-items:center}.free-obstacles{display:flex;flex-direction:column;gap:6px}.free-columns .free-obstacle{padding:5px 8px;border-left:4px solid #3361ae;background:#eef3fa;font-size:21px;line-height:1.35}.free-arrow{font-size:30px;color:#3361ae}.free-outcome{padding:18px 7px;background:#3361ae;color:white;font-size:22px;line-height:1.4;font-weight:700;text-align:center}.compliance{margin-top:17px;padding-top:14px}
.free-flow{grid-template-columns:1fr 30px 112px}.compliance-parts{grid-template-columns:repeat(4,1fr);gap:7px}.compliance-parts p{font-size:21px;line-height:1.35;padding:6px 3px}
</style>`);
for(const phrase of ['认识待提升、','作风待转变、','能力待增强、','协同待深化。']) slidev=slidev.replace(`<p>${phrase}</p>`,`<p>${phrase.slice(0,2)}<br>${phrase.slice(2)}</p>`);
await fs.writeFile(path.join(E,'src/slidev/slides.md'),slidev);
let spec=await fs.readFile(path.join(E,'src/seaslides/content_design_spec.md'),'utf8');
spec=spec.replace('右侧 .insight-card 2×2四项；平分右侧行列不是重要度编码。','右侧 .insight-card 纵向四项；纵向顺序为阅读顺序，非工作步骤。');
await fs.writeFile(path.join(E,'src/seaslides/content_design_spec.md'),spec+'\n## Diagram Capacity Update\nimplementation 按灰稿要求显示已完成设计、三项障碍和向落地阻力汇聚的关系。为容纳图示，问题区47%，感悟区四行卡片；不建立两组之间的解决或因果关系。\n');
console.log('Applied the source-backed 3-obstacle → implementation-resistance structure in SeaSlides and Slidev.');
