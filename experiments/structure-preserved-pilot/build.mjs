import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { Presentation, PresentationFile, FileBlob } from '@oai/artifact-tool';
import { htmlComponentThemeCss, compileHtmlComponentTheme } from '../../src/visual-runtime/html-component-theme.mjs';
import { htmlTextFlowCss } from '../../src/visual-runtime/text-flow.mjs';
import { resolveHtmlComponent, compileResolvedVisualTree, closeHtmlComponentRuntime } from '../../src/visual-runtime/html-component-runtime.mjs';
import { preservedComponent } from '../../src/runtime/preserved-structure-build.mjs';
import { invokeStructure } from '../../.codex/skills/ppagent-structure/scripts/invoke.mjs';
const root=path.resolve(import.meta.dirname,'../..');
const sizePilot=process.argv.includes('--sizes');
const out=sizePilot?path.join(root,'experiments/structure-size-pilot'):import.meta.dirname;
const specs=[
  ['双排折角便签-002','parallel-folded-notes-grid-002','notes',4],
  ['简明转化漏斗-001','convergence-simple-funnel-001','funnel',4],
  ['成熟度阶梯-002','progression-maturity-steps-002','stairs',4],
];
const cases=sizePilot?[['L',1170,492],['M',994.5,418.2],['S',819,344.4],['skin-M',994.5,418.2]]:[['source',1170,492],['same',1170,492],['large',1404,590.4],['small',994.5,418.2],['narrow',900,600],['wide',1350,440],['more',1170,492],['content',1404,590.4]];
await fs.mkdir(path.join(out,'renders'),{recursive:true});
const only=process.argv.slice(2).find(a=>!a.startsWith('--'));
if(!only)await fs.writeFile(path.join(out,'invocations.ndjson'),'');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const report=only?JSON.parse(await fs.readFile(path.join(out,'report.json'),'utf8')).filter(r=>!r.key.startsWith(only)):[];
try{
 for(const [dir,id,slug,count] of specs){
  if(only&&slug!==only)continue;
  const assetDir=path.join(root,'assets/结构图',dir);
  const m=await import(pathToFileURL(path.join(assetDir,'review.mjs')).href);
  const css=await fs.readFile(path.join(assetDir,m.visualComponent.cssFile),'utf8');
  for(const [name,width,height] of cases){
   const theme=name==='skin-M'?{font:'Microsoft YaHei',primaryColor:'#345B63',background:'#F5F4EF',surface:'#EEECE5',typography:{componentItemTitle:17,componentBody:17,componentLabel:17,componentMeta:15}}:{font:'Microsoft YaHei'};
   const key=`${slug}-${name}`, frame={left:0,top:0,width,height};
   const parameters=structuredClone(m.previewParameters);
   if(slug==='notes')parameters.items=parameters.items.slice(0,name==='more'?8:count);
   if(slug==='funnel'){parameters.steps=parameters.steps.slice(0,name==='more'?6:count);parameters.inputs=parameters.inputs.slice(0,4);}
   if(slug==='stairs'){parameters.levels=parameters.levels.slice(0,name==='more'?6:count);parameters.showStatus=true;}
   if(name==='skin-M'){
    if(slug==='notes')parameters.items=parameters.items.map((item,i)=>({...item,points:[],body:['明确目标与关系','依据清楚可查','结果可以修改','支持后续复用'][i]}));
    if(slug==='stairs')parameters.levels=parameters.levels.map((item,i)=>({...item,body:['基础动作','统一标准','共享方法','稳定配合'][i]}));
   }
   if(name==='content'){
    if(slug==='notes')parameters.items=parameters.items.map((item,index)=>({...item,title:['目标明确','材料可查','责任清楚','反馈及时'][index],points:[],body:['先确认本次交付要解决的问题，再列出需要提供的材料与验收依据；各方使用同一份清单核对，并记录每一项的负责人和完成情况。','每项判断附上来源，后续接手者能找到材料并核对版本。','明确每项工作的负责人和需要配合的角色。','发现偏差后及时记录，并把处理结果反馈给相关人员。'][index]}));
    if(slug==='funnel')parameters.steps=parameters.steps.map((item,index)=>({...item,title:['收集想法','核对需求','小步验证','保留方案'][index]}));
    if(slug==='stairs')parameters.levels=parameters.levels.map((item,index)=>({...item,title:['基础操作','独立处理','团队协作','持续优化'][index],body:['按说明完成基础工作','独立定位并处理常见问题','明确交接与共同责任','根据复盘改进工作方法'][index]}));
   }
   const component=name==='source'?m.visualComponent:preservedComponent(m.visualComponent,frame,theme);
   const compiled=compileHtmlComponentTheme({markup:component.renderMarkup(parameters),css,theme});
   const html=`<!doctype html><meta charset="utf-8"><style>${htmlComponentThemeCss(theme)}${htmlTextFlowCss()}${compiled.css}</style>${compiled.markup}`;
   await fs.writeFile(path.join(out,'renders',`${key}.html`),html);
   const page=await browser.newPage({viewport:{width:Math.ceil(width),height:Math.ceil(height)}});
   await page.setContent(html);await page.evaluate(()=>document.fonts.ready);
   await page.screenshot({path:path.join(out,'renders',`${key}.png`)});
   const fonts=await page.locator('[data-ppt-kind="text"],[data-ppt-kind="shape-text"]').evaluateAll(els=>els.map(el=>({name:el.dataset.pptName,text:el.textContent.trim(),font:getComputedStyle(el).fontSize})));
   await page.close();
   const result={key,id,name,width,height,fonts,status:'pending'};
   try{
    const deck=Presentation.create({slideSize:{width,height}});const slide=deck.slides.add();
    if(name==='source'){
     const tree=await resolveHtmlComponent({component,parameters,assetDir,theme,targetFrame:frame});
     compileResolvedVisualTree(slide,tree,frame);
    }else{
     await invokeStructure({root,slide,skin:{...theme,bodyFrame:frame},targetFrame:frame,content:parameters,execution:'preserved-design',references:[{assetId:id,preservedFeatures:['原有完整造型和关系']}],evidencePath:path.join(out,'invocations.ndjson'),pageId:key,regionId:'body',reason:'核对原实现保真区域适配'});
    }
    const file=path.join(out,'renders',`${key}.pptx`);
    await(await PresentationFile.exportPptx(deck)).save(file);
    const imported=await PresentationFile.importPptx(await FileBlob.load(file));
    const png=await imported.export({slide:imported.slides.items[0],format:'png',scale:1});
    await fs.writeFile(path.join(out,'renders',`${key}-pptx.png`),new Uint8Array(await png.arrayBuffer()));
    const layout=await imported.slides.items[0].export({format:'layout'});
    await fs.writeFile(path.join(out,'renders',`${key}-layout.json`),await layout.text());
    result.status='rendered-unreviewed';result.shapes=slide.shapes.items.length;result.images=slide.images.items.length;
   }catch(error){result.status='rejected';result.error=error.message;}
   report.push(result);await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
   console.log(key,result.status,result.error?.slice(0,180)??'');
  }
 }
}finally{await browser.close();await closeHtmlComponentRuntime();}
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
await fs.writeFile(path.join(out,'index.html'),`<!doctype html><meta charset="utf-8"><title>保留造型：3 个结构适配</title><style>body{font:16px/1.6 system-ui;margin:24px;background:#f4f5f6;color:#24303a}article{background:white;padding:20px;margin:24px 0}section{display:grid;grid-template-columns:1fr 1fr;gap:20px}img{width:100%;border:1px solid #ddd}h2{margin:0}pre{white-space:pre-wrap}a{color:#245886}</style><h1>原造型上的区域适配</h1><p>source 为原实现；same 为相同尺寸新入口；其余改变占区或数量。左侧为实际 HTML，右侧为导出 PPTX 后重导入。拒绝项保留实际原因，不缩小文字隐藏失败。</p>${report.map(r=>`<article><h2>${r.key} · ${r.width} × ${r.height}</h2><p>${r.status}</p><section><div><p>HTML</p><a href="renders/${r.key}.html"><img src="renders/${r.key}.png"></a></div><div><p>PPTX 重导入</p>${r.status==='rejected'?`<pre>${esc(r.error)}</pre>`:`<a href="renders/${r.key}.pptx"><img src="renders/${r.key}-pptx.png"></a>`}</div></section></article>`).join('')}`);

if(sizePilot) await import("../structure-size-pilot/gallery.mjs");
