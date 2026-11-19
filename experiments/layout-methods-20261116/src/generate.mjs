import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const E=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=JSON.parse(await fs.readFile(path.join(E,'content.json'),'utf8'));
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const out=async(p,s)=>{await fs.mkdir(path.dirname(path.join(E,p)),{recursive:true});await fs.writeFile(path.join(E,p),s)};
const logo='<img class="neu-logo" src="../../assets/neu-logo.png" alt="东北大学校标" />';
const all=data.groups.flatMap(g=>g.blocks);

// A: Markdown owns content order. Marp owns Markdown compilation, theme application,
// browser typography and export; this experiment supplies a two-column theme.
const embeddedLogo=logo.replace('../../assets/neu-logo.png','data:image/png;base64,'+(await fs.readFile(path.join(E,'assets/neu-logo.png'))).toString('base64'));
const md=`---\nmarp: true\ntheme: neu-report\nsize: 16:9\n---\n\n# ${data.title}\n\n${embeddedLogo}\n\n`+data.groups.map((g,gi)=>`<div class="report-col col-${gi}">\n\n## ${g.heading}\n\n`+g.blocks.map((b,i)=>`### ${String(i+1).padStart(2,'0')}　${b.label}\n\n${b.text}\n`).join('\n')+'\n</div>\n').join('\n');
await out('src/marp/slides.md',md);
await out('src/marp/theme.css',`/* @theme neu-report */
@import 'default';
section { width:1280px;height:720px;padding:43px 48px 38px;background:white;color:#24364c;
 font-family:'Microsoft YaHei',sans-serif; font-size:22px;line-height:1.52;
 display:grid;grid-template-columns: .94fr 1.16fr;grid-template-rows:70px 1fr;gap:26px 44px;align-content:stretch }
h1 {grid-column:1/-1;margin:0;padding:0 0 14px;border-bottom:4px solid #3361ae;color:#1b3762;font-size:36px;line-height:1.4}
.neu-logo{position:absolute;right:48px;top:28px;width:240px;height:auto;object-fit:contain}
.report-col{min-width:0;align-self:stretch}
.col-0{padding-right:25px;border-right:1px solid #c8d5e7}
h2{font-size:26px;line-height:1.2;color:#3361ae;margin:0 0 21px;padding:0 0 11px;border-bottom:1px solid #c8d5e7}
h3{color:#1b3762;font-size:23px;line-height:1.42;margin:22px 0 9px;letter-spacing:0;font-weight:700}
p{margin:0;font-size:22px;line-height:1.52;color:#334155}
.col-0 h3{margin-top:26px}.col-0 p{margin-bottom:42px}
.col-1 h3{margin-top:17px}.col-1 p{margin-bottom:13px}
section::after{content:'';position:absolute;left:48px;right:48px;bottom:27px;height:3px;background:#3361ae}
`);

// B: Run the actual SeaSlides template and assembly/DOM export scripts. Keep TCS.
const sea=path.join(E,'vendor/seaslides/skills/seaslides-html-slides-skill');
const base=await fs.readFile(path.join(sea,'templates/mckinsey-minimal/template.css'),'utf8');
let shell=await fs.readFile(path.join(sea,'templates/mckinsey-minimal/index-template.html'),'utf8');
// This source has no math/code/charts. Remove unused network assets for an offline run.
shell=shell.replace(/<link[^>]+href="https:[^>]+>/g,'').replace(/<script[^>]+src="https:[^>]*><\/script>/g,'');
await out('src/seaslides/index-template.html',shell);
await out('src/seaslides/template.css',base+`\n/* PPagenT adaptation: color/font/capacity and a reusable 2+4 composition. */
:root{--accent:#3361ae;--accent-rgb:51,97,174;--ink:#1b3762;--grey-3:#465569;--sans:'Microsoft YaHei',sans-serif;--sans-zh:'Microsoft YaHei',sans-serif}
.slide{padding:40px 48px 36px;gap:0}.light{background:#fff;color:var(--ink)}
.page-header{margin-bottom:18px;min-height:56px;align-items:center;letter-spacing:0;font-family:var(--sans);font-size:34px;font-weight:700;color:var(--ink)}
.neu-logo{width:240px;height:auto;object-fit:contain}
.pp-two-groups{display:flex;gap:28px;flex:1;min-height:0}
.pp-issues{width:38%;display:flex;flex-direction:column;gap:18px}
.pp-insights{flex:1;display:flex;flex-direction:column;gap:18px;min-width:0}
.pp-group-heading{font-size:25px;border-bottom:2px solid var(--accent);padding-bottom:10px}
.pp-issue-stack{display:flex;flex-direction:column;gap:18px;flex:1}
.pp-insight-grid{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:18px;flex:1}
.insight-card{padding:19px 20px 19px;border-top:3px solid var(--accent);gap:0}
.pp-issue-stack .insight-card{flex:1}.insight-card .card-nb{font-size:19px;letter-spacing:0;color:var(--accent);margin-bottom:9px;font-family:var(--sans)}
.insight-card .card-title{font-size:23px;line-height:1.42;margin-bottom:11px;color:var(--ink)}
.insight-card .card-desc{font-size:22px;line-height:1.48;color:#344356}
.pp-insight-grid .insight-card{padding:15px 17px}.pp-insight-grid .card-nb{margin-bottom:5px}
.pp-insight-grid .card-title{font-size:22px;margin-bottom:8px}.pp-insight-grid .card-desc{font-size:21px;line-height:1.45}
#hud,#nav,#hint,#nav-bottom,#progress,#progress-bar,.nav-arrow,.nav-zone,.keyboard-hint,.slide-counter{display:none!important}
`);
const cards=g=>g.blocks.map((b,i)=>`<div class="insight-card" data-block="${b.id}"><div class="card-nb">${String(i+1).padStart(2,'0')}</div><h3 class="card-title" data-label="${b.id}">${esc(b.label)}</h3><p class="card-desc" data-body="${b.id}">${esc(b.text)}</p></div>`).join('\n');
await out('src/seaslides/content.html',`<section class="slide light" data-notes="两点不足与四点感悟分别成组，没有跨组逐一对应关系。按灰稿保留全部六块内容。"><div class="page-header"><h2>${data.title}</h2>${logo}</div><div class="pp-two-groups"><div class="pp-issues"><h3 class="pp-group-heading">两点不足</h3><div class="pp-issue-stack">${cards(data.groups[0])}</div></div><div class="pp-insights"><h3 class="pp-group-heading">四点感悟</h3><div class="pp-insight-grid">${cards(data.groups[1])}</div></div></div></section>`);
await out('src/seaslides/content_design_spec.md',`# Content Design Specification\n\n## Project Settings\n- 一页，1280×720，中文，受众为人力资源与业务管理人员。\n- Theme: mckinsey-minimal，源 commit dcde5bf6c6875b300e2999fc7766f369a13a67ac。\n- 风格：白底、东北大学蓝 #3361AE；Microsoft YaHei；正文21—22px。\n- 原图仅用原校标。无新图像，无模型调用。\n\n## Narrative\n两点不足与四点感悟各自成组，不增加逐一因果。\n\n## Per-slide Plan\n1. 标题“存在的不足与感悟”；左侧 .insight-card 垂直两项，右侧 .insight-card 2×2四项；平分右侧行列不是重要度编码。\n- 模板已有 insight-card、card-nb、card-title、card-desc；新增 pp-two-groups 等容量组合类。\n- 组件选择与比例由本次作者决定，编译器不自动决定布局。\n\n## Excluded Assets\n原生旧稿、生图参照只进对照 gallery，不进入当前内容或充当事实。\n`);
await fs.mkdir(path.join(E,'src/seaslides/assets'),{recursive:true});
await fs.copyFile(path.join(E,'assets/neu-logo.png'),path.join(E,'src/seaslides/assets/neu-logo.png'));
// content image paths conform to the original TCS contract.
const sc=await fs.readFile(path.join(E,'src/seaslides/content.html'),'utf8');
await out('src/seaslides/content.html',sc.replace('../../assets/neu-logo.png','assets/neu-logo.png'));

// D: Host-authored whole-page graphic design compiled by Slidev/Vue.
// Typography, grouping, native-friendly rules and the valid 3-obstacle relation
// are author decisions. Slidev handles Vue/Markdown compilation and export.
const [issues,insights]=data.groups;
const impl=issues.blocks[0], comp=issues.blocks[1];
const implparts=['顶层设计已完成；','公司内部人力资源变革氛围尚未完全形成，','信息系统支撑能力仍有差距，','缺乏市场化管理机制。'];
if(implparts.join('')!==impl.text)throw new Error('Implementation segmentation drift');
const compparts=['2017年巡视整改取得一定成效，也暴露人力条线基础管理薄弱：','认识待提升、','作风待转变、','能力待增强、','协同待深化。'];
if(compparts.join('')!==comp.text)throw new Error('Compliance segmentation drift');
await out('src/slidev/slides.md',`---\ntheme: default\nlayout: none\ncanvasWidth: 1280\naspectRatio: 16/9\nfonts:\n  sans: Microsoft YaHei\n  provider: none\ndrawings:\n  enabled: false\n---\n\n<div class="free-page">\n<header><div class="title">${data.title}</div>${logo}</header>\n<div class="free-columns">\n<div class="free-issues"><h2>两点不足</h2>\n<article data-block="implementation"><div class="free-label"><span>01</span><h3 data-label="implementation">${impl.label}</h3></div>\n<div class="implementation-body" data-body="implementation"><p class="context">${implparts[0]}</p><div class="obstacle-list">${implparts.slice(1).map((t,i)=>`<p class="obstacle obstacle-${i}">${t}</p>`).join('')}</div></div></article>\n<article class="compliance" data-block="compliance"><div class="free-label"><span>02</span><h3 data-label="compliance">${comp.label}</h3></div><div data-body="compliance"><p>${compparts[0]}</p><div class="compliance-parts">${compparts.slice(1).map(t=>`<p>${t}</p>`).join('')}</div></div></article>\n</div>\n<div class="free-insights"><h2>四点感悟</h2>${insights.blocks.map((b,i)=>`<article data-block="${b.id}"><div class="insight-index">${String(i+1).padStart(2,'0')}</div><div class="insight-copy"><h3 data-label="${b.id}">${b.label}</h3><p data-body="${b.id}">${b.text}</p></div></article>`).join('\n')}</div>\n</div></div>\n\n<style>\n.slidev-layout{padding:0!important;margin:0;color:#25374e;font-family:'Microsoft YaHei',sans-serif;background:white;font-size:22px;line-height:1.45}\n.free-page{width:1280px;height:720px;padding:34px 42px 28px;box-sizing:border-box;background:white;overflow:hidden}\nheader{height:78px;display:flex;align-items:center;justify-content:space-between;border-bottom:4px solid #3361ae;padding-bottom:15px;margin-bottom:23px}.title{font-size:36px;font-weight:700;line-height:1.2;color:#1b3762}.neu-logo{width:240px;height:auto;object-fit:contain}\n.free-columns{display:grid;grid-template-columns:470px 1fr;gap:35px;height:544px}.free-columns h2{font-size:25px;color:#3361ae;margin:0 0 17px;font-weight:700;line-height:1.3;border:none}.free-columns h3{font-size:23px;line-height:1.4;font-weight:700;color:#1b3762;margin:0}.free-columns p{font-size:22px;line-height:1.45;margin:0;color:#344356}.free-label{display:flex;align-items:baseline;gap:14px;margin-bottom:11px}.free-label span{font-family:Arial,sans-serif;font-size:30px;font-weight:700;color:#7c9bc9}.context{padding-left:50px;margin-bottom:11px!important}.obstacle-list{display:flex;flex-direction:column;gap:7px;padding-left:50px}.obstacle{padding:8px 12px;border-left:4px solid #3361ae;background:#eef3fa}.compliance{margin-top:22px;padding-top:18px;border-top:1px solid #c6d5eb}.compliance>div[data-body]{padding-left:50px}.compliance-parts{display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;margin-top:12px}.compliance-parts p{background:#e8eff9;text-align:center;padding:7px 3px;font-weight:600;color:#274f8f}.free-insights{border-left:1px solid #c6d5eb;padding-left:27px}.free-insights article{display:flex;gap:17px;padding:0 0 16px;margin:0 0 15px;border-bottom:1px solid #d5dfed}.insight-index{font-size:30px;font-weight:700;color:#3361ae;font-family:Arial,sans-serif;line-height:1.3;flex:0 0 43px}.insight-copy{min-width:0}.insight-copy p{margin-top:8px}.free-insights article:last-child{border:0;margin:0;padding:0}\n</style>\n`);
await out('src/slidev/package.json',JSON.stringify({type:'module',private:true},null,2));
// Slidev/Vite serves assets from public without reaching outside its root.
await fs.mkdir(path.join(E,'src/slidev/public'),{recursive:true});
await fs.copyFile(path.join(E,'assets/neu-logo.png'),path.join(E,'src/slidev/public/neu-logo.png'));
let slidev=await fs.readFile(path.join(E,'src/slidev/slides.md'),'utf8');
await out('src/slidev/slides.md',slidev.replace('../../assets/neu-logo.png','/neu-logo.png'));
console.log('Generated Marp Markdown/theme, SeaSlides template/content and Slidev source.');
