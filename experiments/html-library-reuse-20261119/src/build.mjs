import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {compileHtmlComponentTheme,htmlComponentThemeCss} from '../../../src/visual-runtime/html-component-theme.mjs';
import {htmlTextFlowCss} from '../../../src/visual-runtime/text-flow.mjs';
import {universityMckinseySkin} from '../../../src/runtime/skins/university-mckinsey.mjs';
import {academicReportShell} from '../../../src/runtime/shells/academic-report.mjs';
const E=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),R=path.resolve(E,'../..');
const D=JSON.parse(await fs.readFile(path.join(E,'content.json'),'utf8'));
const hash=s=>createHash('sha256').update(s).digest('hex');
const original=await fs.readFile(path.join(R,'assets/结构图/多路汇聚结果-003/review.mjs'),'utf8');
// Task-local capacity adjustment only. Keep normalize, pathMarkup, inputMarkup,
// resultMarkup and all Bézier equations from the actual asset implementation.
const adapted=original
 .replace('clamp(width * 0.265, 190, 310)','clamp(width * 0.265, 240, 310)')
 .replace('clamp(height * (count >= 6 ? 0.135 : 0.16), 58, 78)','clamp(height * (count >= 6 ? 0.135 : 0.16), 64, 78)');
if(adapted===original)throw new Error('Expected source expressions were not found');
await fs.writeFile(path.join(E,'src/convergence-local.mjs'),adapted);
const module=await import(pathToFileURL(path.join(E,'src/convergence-local.mjs')).href+'?'+hash(adapted).slice(0,12));
const sourceCss=await fs.readFile(path.join(R,'assets/结构图/多路汇聚结果-003/component.css'),'utf8');
const parameters={inputs:[{key:'atmosphere',title:'公司内部人力资源',body:'变革氛围尚未完全形成，'},{key:'system',title:'信息系统支撑',body:'能力仍有差距，'},{key:'mechanism',title:'缺乏市场化',body:'管理机制。'}],result:{title:'变革落地阻力重重',body:''}};
const implementation=D.groups[0].blocks[0];
const context='顶层设计已完成；';
if(context+parameters.inputs.map(x=>x.title+x.body).join('')!==implementation.text)throw new Error('Source content segmentation changed');
const theme={...universityMckinseySkin,font:'Microsoft YaHei',typography:{...universityMckinseySkin.typography,componentItemTitle:15.75,componentBody:13.5}};
const adapterCss=`
/* Task-local binding repair. The asset's own SVG/path generator is untouched. */
.merge>svg{width:var(--merge-frame-width);height:var(--merge-frame-height)}
.merge>.input{left:var(--input-left);width:var(--input-width);height:var(--input-height);padding:5px 12px}
.merge>.result{right:var(--result-right);top:var(--result-top);width:var(--result-width);height:var(--result-height);padding:18px 20px;border-width:7px;border-radius:24px}
.merge .ppagent-text-layout{padding:0;gap:2px;background:transparent;justify-content:center}
.merge .input-content .ppagent-text-primitive--heading{font-size:15.75pt;line-height:1.15;color:#244A73}
.merge .input-content .ppagent-text-primitive--body{font-size:13.5pt;line-height:1.24;color:#404040}
.merge .result-content .ppagent-text-layout{gap:10px}
.merge .result-content .ppagent-text-primitive--label{font-size:12pt;line-height:1.25;color:#e3edf8;letter-spacing:1px}
.merge .result-content .ppagent-text-primitive--heading{font-size:18pt;line-height:1.3;color:#fff}
`;
const style=`
*{box-sizing:border-box}html,body{margin:0;padding:0;background:white;font-family:'Microsoft YaHei',sans-serif;color:#404040}
.slide{position:relative;width:1280px;height:720px;overflow:hidden;background:white}
.shell-section{position:absolute;left:55px;top:34px;font:700 31px/1.25 'HYWenRunSongYun U','Microsoft YaHei',sans-serif;color:#414141}
.shell-logo{position:absolute;left:984.21px;top:20.82px;width:260px;height:auto;object-fit:contain}
.shell-band{position:absolute;left:35.17px;top:87.55px;width:1209.67px;height:52.42px;background:linear-gradient(100deg,#315495,#3b82ee 76%,#73a6fc);padding:5px 20px;color:white;font:700 29px/1.4 'HYWenRunSongYun U','Microsoft YaHei',sans-serif}
.shell-rule{position:absolute;left:35.17px;right:35.16px;top:147.22px;height:2px;background:#aac2e7}
.shell-bottom{position:absolute;left:35.17px;right:35.16px;top:689.24px;height:4px;background:#4b77c3}
.page-a .content{position:absolute;left:55px;top:166px;width:1170px;height:492px;display:grid;grid-template-columns:624px 514px;gap:32px}
.group-title{font-size:21px;line-height:28px;font-weight:700;color:#244A73;margin:0 0 11px;padding:0 0 8px;border-bottom:1px solid #c9d7ed}
.block-title{font-size:21px;line-height:1.3;color:#244A73;font-weight:700;margin:0}
.block-title .index{display:inline-block;min-width:38px;color:#6f91c4;font-size:25px;line-height:1.1;font-family:Arial,sans-serif;vertical-align:baseline}
.body-text,.context{font-size:18px;line-height:1.4;margin:7px 0 0;color:#404040}
.context{margin-left:38px}.structure-host{position:relative;width:100%;margin:2px 0 0}
.compliance{margin-top:10px;padding-top:9px;border-top:1px solid #d3def0}.compliance .body-text{margin-left:38px}
.insights{padding-left:0}.insight{position:relative;margin:0 0 16px;padding:0 0 14px;border-bottom:1px solid #d5e0ee}
.insight:last-child{margin-bottom:0;border:0;padding-bottom:0}.insight .copy{padding-left:43px}.insight .block-title .index{position:absolute;left:0;top:0}.insight .body-text{margin-top:8px}
.page-b .shell-section{top:29px;font-size:32px;color:#244A73}.page-b .shell-logo{top:16px}.page-b .shell-rule{top:99px;height:4px;background:#3361ae}
.page-b .content{position:absolute;left:55px;top:120px;width:1170px;height:550px}
.page-b .issues-row{display:grid;grid-template-columns:758px 380px;gap:32px}
.page-b .group-title{margin-bottom:8px;padding-bottom:6px}
.page-b .context{margin-top:6px}.page-b .structure-host{margin-top:0}.page-b .compliance{margin:0;padding:0;border:0}
.page-b .compliance .body-text{margin-left:38px;margin-top:9px}
.page-b .insights{margin-top:13px}.page-b .insights-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:22px}
.page-b .insight{margin:0;padding:0 15px 0 0;border:0;border-right:1px solid #d5e0ee}.page-b .insight:last-child{padding-right:0;border:0}
.page-b .insight .copy{padding-left:0}.page-b .insight .block-title{font-size:19px;line-height:1.3;min-height:50px;text-wrap:balance}.page-b .insight .block-title .index{display:none}
.page-b .insight .body-text{font-size:18px;line-height:1.4;margin-top:8px}
`;
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function shell(mode){return `<div class="shell-section">${mode==='a'?'01｜不足感悟':D.title}</div><img class="shell-logo" src="../assets/neu-logo.png" alt="东北大学"><div class="shell-rule"></div><div class="shell-bottom"></div>`+(mode==='a'?`<div class="shell-band">${D.claim}</div>`:'');}
function insight(b,i){return `<article class="insight" data-block="${b.id}"><div class="copy"><h3 class="block-title" data-label="${b.id}"><span class="index">${String(i+1).padStart(2,'0')}</span>${esc(b.label)}</h3><p class="body-text" data-body="${b.id}">${esc(b.text)}</p></div></article>`;}
function compliance(){const b=D.groups[0].blocks[1];return `<article class="compliance" data-block="compliance"><h3 class="block-title" data-label="compliance"><span class="index">02</span>${esc(b.label)}</h3><p class="body-text" data-body="compliance">${esc(b.text)}</p></article>`;}
const calls=[];
for(const [mode,frame] of [['a',{width:624,height:240}],['b',{width:758,height:232}]]){
 const markup=module.renderAdaptiveMarkup(parameters,{frame});
 const c=compileHtmlComponentTheme({markup,css:sourceCss+adapterCss,theme});
 const graph=`<div class="structure-host" data-asset="convergence-many-to-one-003" data-frame="${frame.width}x${frame.height}" style="height:${frame.height}px">${c.markup}</div>`;
 const impl=`<article class="implementation" data-block="implementation"><h3 class="block-title" data-label="implementation"><span class="index">01</span>${implementation.label}</h3><div data-source-body="implementation"><p class="context">${context}</p>${graph}</div></article>`;
 const body=mode==='a'?`<main class="content"><section class="issues"><h2 class="group-title">两点不足</h2>${impl}${compliance()}</section><section class="insights"><h2 class="group-title">四点感悟</h2>${D.groups[1].blocks.map(insight).join('')}</section></main>`:
 `<main class="content"><section class="issues"><h2 class="group-title">两点不足</h2><div class="issues-row">${impl}${compliance()}</div></section><section class="insights"><h2 class="group-title">四点感悟</h2><div class="insights-grid">${D.groups[1].blocks.map(insight).join('')}</div></section></main>`;
 const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>结构库接入 · ${mode.toUpperCase()}</title><style>${htmlComponentThemeCss(theme)}${htmlTextFlowCss()}${c.css}${style}</style><div class="slide page-${mode}">${shell(mode)}${body}</div></html>`;
 await fs.writeFile(path.join(E,`outputs/page-${mode}.html`),html);
 calls.push({page:mode,assetId:'convergence-many-to-one-003',source:'assets/结构图/多路汇聚结果-003/review.mjs',sourceHash:hash(original),localSourceHash:hash(adapted),call:'renderAdaptiveMarkup(parameters,{frame})',frame,layout:module.resolveConvergenceLayout(frame,3),parameters,themeModule:'src/runtime/skins/university-mckinsey.mjs',themeOverrides:theme.typography,
  unchangedFunctions:['normalize','pathMarkup','inputMarkup','resultMarkup','visualComponent.renderMarkup','renderAdaptiveMarkup'],localChanges:['resolveConvergenceLayout: inputWidth clamp minimum190→240','resolveConvergenceLayout: inputHeight clamp minimum58→64','CSS: consume generated frame/input/result variables','CSS: fix legacy text-region padding/gap and map Skin font roles'],invariants:['separate inputs','smooth thick cubic curves','one result','all paths meet result boundary']});
}
await fs.writeFile(path.join(E,'evidence/structure-calls.json'),JSON.stringify({shell:academicReportShell,parameters,context,sourceReconstruction:context+parameters.inputs.map(x=>x.title+x.body).join(''),calls},null,2));
await fs.writeFile(path.join(E,'src/asset-adapter.css'),adapterCss);
console.log('Built two whole pages from the original asset implementation with explicit local capacity/binding fixes.');
