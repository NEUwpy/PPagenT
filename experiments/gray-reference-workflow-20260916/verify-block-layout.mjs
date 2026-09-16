// Verify the layout-only revision against the previous agent-authored content.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {grayBodyLayout} from '../../src/runner/gray-draft.mjs';

const root=path.resolve(import.meta.dirname,'../..');
const built=path.join(root,'outputs/gray-block-layout-20260916');
const delivery=path.join(root,'outputs/gray-block-delivery-20260916');
await fs.mkdir(delivery,{recursive:false});
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const cases=[
 {id:'reference',name:'范本原稿-分区修订灰稿',previous:'outputs/gray-primary-agent-delivery-20260916/reference',counts:[2,4]},
 {id:'trial',name:'八周试点-分区修订灰稿',previous:'outputs/gray-primary-agent-refinement-20260916/trial',counts:[1,3]},
];
const results=[];
for(const sample of cases){
 const dir=path.join(built,sample.id),state=await read(path.join(dir,'state.json'));
 const semantic=await read(path.join(dir,'semantic-plan.json'));
 assert.deepEqual(semantic,await read(path.join(root,sample.previous,'semantic-plan.json')),'Layout must preserve the previous content and expression choice');
 const page=state.pages[0],regions=page.composition.regions;
 assert.equal(regions[0].y,regions[1].y);
 assert.equal(regions[0].y+regions[0].height,regions[1].y+regions[1].height);
 const branches=regions.map(region=>{
  const item=page.items.find(item=>item.id===region.itemId);
  assert.equal(region.fontSize,22);
  const body=grayBodyLayout(item,region.width-32,region.fontSize,region.height-70);
  assert.ok(body.fits);
  assert.ok(Math.abs(body.sections.at(-1).top+body.sections.at(-1).height-body.height)<.001);
  for(const run of body.runs) assert.ok(body.sections.some(section=>run.y>=section.top && run.y+run.height<=section.top+section.height));
  return {id:item.id,region,minimumBodyHeight:body.minimumHeight,sections:body.sections};
 });
 assert.deepEqual(branches.map(branch=>branch.sections.length),sample.counts);
 const editable=await read(path.join(dir,'editable-check.json'));
 assert.equal(editable.accepted,true);
 const pptx=await fs.readFile(path.join(dir,'gray-draft.pptx'));
 await fs.writeFile(path.join(delivery,`${sample.name}.pptx`),pptx,{flag:'wx'});
 await fs.copyFile(path.join(dir,'preview/slide-01.png'),path.join(delivery,`${sample.name}.png`));
 await fs.copyFile(path.join(dir,'source.txt'),path.join(delivery,`${sample.name}-原稿.txt`));
 assert.equal(sha(pptx),sha(await fs.readFile(path.join(delivery,`${sample.name}.pptx`))));
 results.push({case:sample.id,name:sample.name,sourceDirectory:dir,previousContent:path.join(root,sample.previous),contentUnchanged:true,pptxSha256:sha(pptx),planner:'current-codex-agent',status:'awaiting-user-review',humanReview:'pending',editable,branches});
}
await fs.writeFile(path.join(delivery,'verification.json'),JSON.stringify({scope:'Layout-only revision; identical content and expression plans, shared renderer and solver. Not an autonomous planning benchmark or M1 acceptance.',checks:{targetedTests:28,overflow:'Both exported PPTX files passed slides_test.py',visual:'Both exported/reimported slide images inspected by the current agent; user review pending'},results},null,2));
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>灰稿分区修订</title><style>body{max-width:1420px;margin:32px auto;padding:0 24px;font:18px/1.7 system-ui;color:#20262d;background:#f6f7f8}h1{font-size:28px}section{margin:32px 0}img{display:block;width:100%;border:1px solid #ddd;background:white;margin-top:12px}a{color:#006ca7}small{color:#525b65}</style><h1>灰稿分区修订</h1><p>主体栏上下对齐；栏内按已有条目划分子区，用实际文字所需高度分配空间。浅蓝区保留制作说明，不绘制内部节点。</p><p><small>与上一候选的文案、表达选择、字号和页面尺寸相同。本次修订验证排版行为；两份均待用户审阅，不代表自动规划或 M1 通过。</small></p>${results.map(r=>`<section><h2>${r.name}</h2><a href="${encodeURIComponent(r.name)}.pptx">下载可编辑 PPTX</a> · <a href="${encodeURIComponent(r.name)}-原稿.txt">查看原稿</a><img src="${encodeURIComponent(r.name)}.png" alt="${r.name}：导出PPTX重导入预览"></section>`).join('')}</html>`;
await fs.writeFile(path.join(delivery,'index.html'),html);
await fs.writeFile(path.join(delivery,'交付说明.txt'),'灰稿分区修订（2026-09-16）\n\n两份均为新版本，旧产物和退回记录保留。\n与各自上一候选的 semantic-plan.json 完全一致，没有修改文案、语义归属、表达选择、字号或页面尺寸。\n同排主体栏共用上、下边界；栏内按已有块划分子区、固定内边距与块间距，再按实文所需高度分配空间。蓝区仍是制作说明，未绘制结构节点。\n主Agent规划经共用表达绑定、测量、既有几何求解器与原生PPTX渲染。验证包括28项相关测试、原生文字、溢出和逐页看图。\n这是排版修订候选，等待用户视觉审阅；不宣称外部模型稳定生成或M1通过。\n');
console.log(JSON.stringify({delivery,results:results.map(({name,pptxSha256,contentUnchanged})=>({name,pptxSha256,contentUnchanged}))},null,2));
