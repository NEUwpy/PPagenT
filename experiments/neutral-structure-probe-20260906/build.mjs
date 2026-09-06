import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { visualComponent, previewParameters, resolvePreviewParameters } from '../../assets/结构图/中心辐射-001/review.mjs';
import { compileHtmlComponentTheme, htmlComponentThemeCss, resolveStructureTheme } from '../../src/visual-runtime/html-component-theme.mjs';
import { htmlTextFlowCss } from '../../src/visual-runtime/text-flow.mjs';
import { resolveHtmlComponent, closeHtmlComponentRuntime } from '../../src/visual-runtime/html-component-runtime.mjs';

const output = import.meta.dirname;
const assetDir = path.resolve(output, '../../assets/结构图/中心辐射-001');
const css = await fs.readFile(path.join(assetDir, 'component.css'), 'utf8');
const theme = { primaryColor: '#A35D4F', background: '#F5F4EF', surface: '#EEECE5', dark: '#20201D', body: '#4B4A45', muted: '#85837B', line: '#D8D5CC', font: 'Noto Sans SC' };
// This is a local HTML style study of an existing component, not a core theme implementation.
const common = `
html,body{background:#F5F4EF!important}
.hub-center-halo,.hub-center-ring,.hub-icon-halo{background:#F5F4EF;border-color:#D8D5CC;box-shadow:none}
.hub-center-core,.hub-icon-core{background:#EEECE5;box-shadow:none}
.hub-item-surface{background:#EEECE5;border-color:#D8D5CC;box-shadow:none}
.hub-item-underlay{background:transparent}
.hub-orbit-dot{background:#D8D5CC}
.hub-center-content,.hub-item-content{color:#20201D;--ppagent-heading-color:#20201D;--ppagent-text-color:#4B4A45}
.hub-icon-slot,.hub-icon-svg{color:#A35D4F}
.hub-icon-fallback{border-color:#A35D4F}
`;
const outline = `
.hub-center-core{background:#F5F4EF;box-shadow:inset 0 0 0 1.5px #85837B}
.hub-icon-core{background:#F5F4EF;box-shadow:inset 0 0 0 1px #85837B}
.hub-item-surface{background:#F5F4EF;border-color:#D8D5CC;border-radius:0}
`;
const variants = [
  { id:'current', title:'A · 当前主色换色', note:'调用合并后的主题入口，保留原组件的色块、阴影与白色。', extra:'' },
  { id:'soft', title:'B · 近背景浅承载', note:'独立样式试验：纸色背景、浅承载面、深色文字，图标少量砖红。', extra:common },
  { id:'outline', title:'C · 同背景线框', note:'独立样式试验：承载面融入背景，以轮廓和深色文字保留层级。', extra:common+outline },
];
const audit = { assetId:'hub-radial-001', mode:'existing-component-html-style-probe', inputTheme:theme, actualResolvedTheme:resolveStructureTheme(theme), paperAsPrimary:resolveStructureTheme({...theme,primaryColor:'#F5F4EF'}), states:[], limits:['HTML-only; no invokeStructure or PPTX export', 'asset example text, not manuscript validation', 'local selectors are not a generic role adapter', 'not Luna high execution or stability evidence'] };
let browser;
try {
  const executablePath = [process.env.ProgramFiles,process.env['ProgramFiles(x86)']].filter(Boolean).map(p=>path.join(p,'Microsoft/Edge/Application/msedge.exe'));
  let exe;
  for(const candidate of executablePath) { try { await fs.access(candidate); exe=candidate; break; } catch {} }
  if(!exe) throw new Error('Edge not found');
  browser = await chromium.launch({headless:true,executablePath:exe});
  const page = await browser.newPage({viewport:{width:1170,height:492}});
  for(const count of [4,6,8]) {
    const parameters = resolvePreviewParameters(structuredClone(previewParameters),{itemCount:count});
    const tree = await resolveHtmlComponent({component:visualComponent,parameters,assetDir,theme});
    await fs.writeFile(path.join(output,`resolved-current-${count}.json`),JSON.stringify(tree,null,2));
    const compiled = compileHtmlComponentTheme({markup:visualComponent.renderMarkup(parameters),css,theme});
    let baseline;
    for(const variant of variants) {
      const html = `<!doctype html><meta charset="utf-8"><style>${htmlComponentThemeCss(theme)}${htmlTextFlowCss()}${compiled.css}html,body{width:1170px;height:492px}${variant.extra}</style>${compiled.markup}`;
      await fs.writeFile(path.join(output,`${variant.id}-${count}.html`),html);
      await page.setContent(html);
      await page.evaluate(()=>document.fonts.ready);
      const geometry = await page.evaluate(()=>[...document.querySelectorAll('[data-ppt-root],.hub-item,.hub-center-content,.hub-item-content,.hub-icon-slot')].map(e=>{const r=e.getBoundingClientRect();return {class:e.className,text:e.textContent,x:r.x,y:r.y,width:r.width,height:r.height};}));
      baseline ??= JSON.stringify(geometry);
      const sameTextAndFrames = JSON.stringify(geometry)===baseline;
      if(!sameTextAndFrames) throw new Error(`Unexpected text/geometry change: ${variant.id}-${count}`);
      audit.states.push({count,variant:variant.id,sameTextAndFrames});
      await page.screenshot({path:path.join(output,`${variant.id}-${count}.png`)});
    }
  }
  const cards=variants.map(v=>`<section><h2>${v.title}</h2><p>${v.note}</p><img src="${v.id}-6.png" width="1170" height="492"></section>`).join('');
  const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>中性 Skin · 结构配色试验</title><style>body{margin:0;background:#F5F4EF;color:#20201D;font-family:'Noto Sans SC',sans-serif}main{width:1170px;margin:40px auto}h1{font-family:'Noto Serif SC',serif;font-size:32px}h2{font-size:22px;margin:0}p{font-size:15px;color:#4B4A45}section{padding:24px 0;border-top:1px solid #D8D5CC}img{display:block}a{color:#A35D4F}</style><main><h1>中性 Skin：色块、浅承载与线框</h1><p>同一核心结构、同一文字、同一位置。B/C 是局部 HTML 样式候选，未修改核心资产，未生成 PPTX，也不是 Luna 稳定性验收。</p>${cards}<p>数量状态检查：${[4,8].map(n=>variants.map(v=>`<a href="${v.id}-${n}.html">${v.title} / ${n} 项</a>`).join(' · ')).join(' / ')}</p></main></html>`;
  await fs.writeFile(path.join(output,'review.html'),html);
  await fs.writeFile(path.join(output,'audit.json'),JSON.stringify(audit,null,2));
  console.log(JSON.stringify({output,rendered:audit.states.length,allSelectedFramesUnchanged:audit.states.every(s=>s.sameTextAndFrames),actualResolvedTheme:audit.actualResolvedTheme},null,2));
} finally { await browser?.close(); await closeHtmlComponentRuntime(); }
