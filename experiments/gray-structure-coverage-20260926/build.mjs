import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {cases} from './cases.mjs';
import {newRunState,renderContentMarkdown} from '../../src/runner/state.mjs';
import {grayBodyLayout,fitGrayText,validateGrayPlan,renderGrayDraft} from '../../src/runner/gray-draft.mjs';
import {semanticPages,bindSemanticLayout} from '../../src/runner/gray-semantics.mjs';
import {resolveLayoutTree} from '../../src/composition/resolve.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const output=path.join(root,'artifacts');
const area={width:1170,height:492,label:'24 页多版式模拟灰稿 · 待验收'};
const sources=[];
const semanticPlan={schemaVersion:'gray-plan-3',deckBrief:{title:'多版式模拟灰稿',audience:'灰稿审阅人',objective:'审阅布局、信息关系和局部结构使用场景'},
 planningNotes:'人工编写的覆盖样例；复用既有组合树求解器，不改变正式自动规划入口。',pages:cases.map((c,i)=>({
 pageId:`p${i+1}`,title:c.title,claim:`模拟｜${c.claim}`,pagePurpose:c.title,narrative:c.narrative,
 groups:c.groups.map((g,j)=>({...g,id:`p${i+1}-g${j+1}`,role:g.heading,importance:j===0?'primary':'supporting',blocks:g.blocks.map((block,k)=>{
  const id=`s${sources.length+1}`;
  sources.push({id,heading:c.title,text:[block.label,block.text].filter(Boolean).join('\n')});
  return {...block,id:`b${k+1}`,sourceIds:[id]};
 })}))}))};
const pages=semanticPages(semanticPlan);
const receipts=[];
const layouts=pages.map((page,i)=>{
 const tree=node=>typeof node==='number'?{groupId:page.items[node].id}:{...node,children:node.children.map(tree)};
 const composition=tree(cases[i].tree);
 const frame={left:0,top:0,width:area.width,height:area.height};
 // First resolve establishes authored horizontal proportions. Then measured copy
 // supplies real minimum heights; the same existing solver allocates whitespace.
 const estimate=resolveLayoutTree({composition,bodyFrame:frame,contracts:Object.fromEntries(page.items.map(item=>[item.id,{minWidth:1,minHeight:1}])),style:{gap:24}});
 const contracts=Object.fromEntries(page.items.map(item=>{
  const width=estimate.regions[item.id].width;
  const body=grayBodyLayout(item,width-32,22);
  if(!body.fits || !fitGrayText(item.heading,width-32,40,26).fits) throw new Error(`${page.pageId}/${item.heading}: text cannot fit width`);
  return [item.id,{minWidth:width,minHeight:Math.ceil(70+body.height)}];
 }));
 let result;
 try{result=resolveLayoutTree({composition,bodyFrame:frame,contracts,style:{gap:24}});}
 catch(e){throw new Error(`${page.pageId} ${page.title}: ${e.message} ${JSON.stringify(e.details)}`);}
 receipts.push({pageId:page.pageId,composition,...result});
 return {pageId:page.pageId,regions:page.items.map(item=>{const f=result.regions[item.id];return {itemId:item.id,x:f.left,y:f.top,width:f.width,height:f.height,fontSize:22};})};
});
const bound=bindSemanticLayout(semanticPlan,{pages:layouts});
const base={...newRunState('',path.join(output,'source.md')),sources,grayDraft:{version:'gray-draft-3',area}};
const checked=validateGrayPlan(base,bound,area);
if(!checked.accepted) throw new Error(JSON.stringify(checked.issues,null,2));
const coverage=cases.map((c,i)=>({page:i+1,title:c.title,family:c.family,pattern:c.pattern,logic:c.logic,size:c.size}));
const catalog=JSON.parse(execFileSync(process.execPath,[path.resolve(root,'../../.codex/skills/ppagent-structure/scripts/catalog.mjs'),'list'],{encoding:'utf8'}));
const relationCoverage=Object.keys(catalog.logics).map(logic=>({logic,pages:coverage.filter(c=>c.logic===logic).map(c=>c.page)}));
if(relationCoverage.some(c=>!c.pages.length)) throw new Error('存在未覆盖的结构关系类型');
console.log(`${cases.length} 页容量、引用和边界检查通过；${new Set(cases.map(c=>c.pattern)).size} 种编排场景。`);
if(!process.argv.includes('--check-only')) {
 await fs.mkdir(output,{recursive:true});
 try{await fs.access(path.join(output,'state.json'));throw new Error('审阅版已存在，请另存新目录。');}catch(e){if(e.code!=='ENOENT')throw e;}
 const state={...checked.state,grayDraft:{...base.grayDraft,status:'awaiting-user-review',humanReview:'pending',artifactDirectory:output,authoredSimulation:true,semanticPlan,coverage,structureApplied:false,skinApplied:false}};
 const write=(name,value)=>fs.writeFile(path.join(output,name),JSON.stringify(value,null,2)+'\n');
 await write('state.json',state);
 await write('layout-check.json',{accepted:true,issues:[],coverage:checked.coverage,receipts});
 await write('coverage.json',coverage);
 await write('relation-coverage.json',{catalogAssets:catalog.total,relationTypes:relationCoverage.length,relations:relationCoverage,limits:'关系场景覆盖，不代表逐资产调用或验收。'});
 await fs.writeFile(path.join(output,'source.md'),'# 模拟素材\n\n'+sources.map(s=>`## ${s.id} ${s.heading}\n${s.text}`).join('\n\n')+'\n');
 await fs.writeFile(path.join(output,'content.md'),renderContentMarkdown(state).trimEnd()+'\n');
 await renderGrayDraft(state,output);
 const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 const options=key=>[...new Set(coverage.map(c=>c[key]))].map(s=>`<option>${escape(s)}</option>`).join('');
 const preview=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>24 页多版式灰稿</title>
 <style>*{box-sizing:border-box}body{margin:0;background:#eef0f2;color:#20262d;font:16px system-ui}header{padding:24px max(24px,calc((100% - 1250px)/2));background:white;border-bottom:1px solid #d4d8dc}h1{font-size:26px;margin:0 0 12px}p{line-height:1.6;margin:8px 0}a{color:#146091}nav{position:sticky;top:0;z-index:2;padding:12px 24px;background:#ffffffed;display:flex;gap:16px;flex-wrap:wrap;border-bottom:1px solid #d4d8dc}select{padding:7px;border:1px solid #bfc5ca;border-radius:4px;font:inherit}main{max-width:1300px;margin:auto;padding:24px}#index{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:32px}.thumb{background:white;padding:8px;text-decoration:none;font-size:13px}.thumb img{width:100%}figure{margin:0 0 32px;scroll-margin-top:85px}figcaption{padding:12px 0;font-weight:600}.tags{font-weight:400;color:#53606b;font-size:14px;margin-left:12px}.page{width:100%;display:block;border:1px solid #d4d8dc;background:white}[hidden]{display:none!important}@media(max-width:700px){#index{grid-template-columns:repeat(2,1fr)}main{padding:12px}.tags{display:block;margin:6px 0}}</style>
 <header><h1>24 页多版式模拟灰稿</h1><p>覆盖 18 类结构关系，以及趋势图、表格、场景图和纯文字场景。灰色为实文，浅蓝为制作说明；尚未套用结构或 Skin。</p><p><a href="gray-draft.pptx">下载可编辑 PPT</a> · <a href="content.md">内容提纲</a> · <a href="../../gray-structure-review-20260926/artifacts/preview.html">原 10 页</a></p><p>请按页码审阅分组、阅读顺序和空间安排。全部为模拟内容，待用户验收；当前页面只读取已生成快照。</p></header>
 <nav><label>布局 <select id="family"><option value="">全部</option>${options('family')}</select></label><label>后续结构参考 <select id="size"><option value="">全部</option>${options('size')}</select></label><span id="count"></span></nav><main><div id="index">${coverage.map(c=>`<a class="thumb" href="#p${c.page}" data-family="${c.family}" data-size="${c.size}"><img loading="lazy" src="preview/slide-${String(c.page).padStart(2,'0')}.png" alt="第 ${c.page} 页缩略图">${String(c.page).padStart(2,'0')} · ${escape(c.pattern)}</a>`).join('')}</div>${coverage.map(c=>`<figure id="p${c.page}" data-family="${c.family}" data-size="${c.size}"><figcaption>${String(c.page).padStart(2,'0')} · ${escape(c.title)}<span class="tags">${escape(c.pattern)} / ${c.logic} / ${c.size==='无'?'纯文字':`参考${c.size}版`}</span></figcaption><img class="page" loading="lazy" src="preview/slide-${String(c.page).padStart(2,'0')}.png" alt="${escape(c.title)}"></figure>`).join('')}</main><script>const family=document.querySelector('#family'),size=document.querySelector('#size');function filter(){let count=0;document.querySelectorAll('[data-family]').forEach(e=>{e.hidden=!!((family.value&&e.dataset.family!==family.value)||(size.value&&e.dataset.size!==size.value));if(e.tagName==='FIGURE'&&!e.hidden)count++});document.querySelector('#count').textContent=count+' / 24 页'}family.onchange=size.onchange=filter;filter();</script></html>`;
 await fs.writeFile(path.join(output,'preview.html'),preview);
 console.log(output);
}
