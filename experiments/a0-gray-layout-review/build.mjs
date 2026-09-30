// A0 controlled asset replay, using the actual measurement/binding/gray compiler.
// This does not test manuscript pagination, live models or end-to-end generation.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { GRAY_LAYOUT_PROGRAMS } from '../../src/runner/gray-layout-catalog.mjs';
import { measuredLayoutCandidates, bindLayoutSelection } from '../../src/runner/gray-layout-selection.mjs';
import { grayBodyLayout, fitGrayText, validateGrayPlan, renderGrayDraft } from '../../src/runner/gray-draft.mjs';
import { newRunState } from '../../src/runner/state.mjs';

const output=path.resolve(process.argv[2] ?? 'outputs/a0-gray-layout-review');
await fs.mkdir(output,{recursive:true});
const area={width:1170,height:492,label:'A0 固定输入版式回放'};
const metrics={measureBody:grayBodyLayout,fitText:fitGrayText};
const text=[
  ['咨询服务','管理员说明开放时间、申领材料和服务范围。'],
  ['借阅服务','借阅人先核对书目与馆藏位置；现场领取后登记借阅信息。续借须在到期前办理，遇到预约或缺失情况，应由管理员确认处理方式。'],
  ['预约服务','申请人填写日期和用途，管理员确认后安排使用时段。'],
  ['共同说明','上述服务仅在工作日开放；特殊情况需由管理员确认。'],
];
function fixture(count,support=false){
  const entries=text.slice(0,count);
  if(support) entries[entries.length-1]=text[3];
  const source=entries.map(([,body])=>body).join('\n\n');
  const plan={schemaVersion:'gray-plan-3',deckBrief:{title:'版式调用样例',audience:'建设者',objective:'检查固定内容的承载'},pages:[{
    pageId:'p1',title:'服务范围',claim:'各项服务按规定提供',pagePurpose:'说明服务内容及适用范围',narrative:support?'主体服务与共同说明':'可独立阅读的服务内容',
    groups:entries.map(([heading,body],i)=>({id:`g${i+1}`,role:support&&i===count-1?'共同说明':'服务内容',heading,importance:support&&i===count-1?'supporting':'primary',kind:'text',blocks:[{id:`b${i+1}`,text:body,sourceIds:[`s${i+1}`]}]})),
  }]};
  return {source,plan};
}
const cases=[];
for(const program of GRAY_LAYOUT_PROGRAMS){
  let found;
  for(const count of [3,2,4]){
    const input=fixture(count,program.direction==='support-band');
    const measured=measuredLayoutCandidates(input.plan,area,metrics);
    const candidate=measured[0].candidates.find(c=>c.id===program.id);
    if(candidate){found={...input,measured,candidate};break;}
  }
  assert(found,`没有找到 ${program.id} 的可测量固定样例`);
  const choice={pageId:'p1',candidateId:program.id,relation:program.direction==='support-band'?'support':'independent',reason:'固定输入回放指定本候选；不是模型自动选型结果'};
  const built=bindLayoutSelection(found.plan,found.measured,{pages:[choice]});
  const check=validateGrayPlan(newRunState(found.source,'simulated-source.md'),built.plan,area);
  assert(check.accepted,JSON.stringify(check.issues));
  const page=check.state.pages[0];page.pageId=`a0-${cases.length+1}`;
  cases.push({programId:program.id,name:program.name,origin:'simulated',source:found.source,input:found.plan,receipt:built.receipts[0],check:{accepted:check.accepted,issues:check.issues},page});
}
const refusal=[];
const sample=fixture(3),measured=measuredLayoutCandidates(sample.plan,area,metrics);
for(const relation of ['comparison','sequence','causal']){
  try{bindLayoutSelection(sample.plan,measured,{pages:[{pageId:'p1',candidateId:measured[0].candidates[0].id,relation,reason:'边界检查'}]});throw new Error('未拒绝');}
  catch(error){assert.notEqual(error.message,'未拒绝');refusal.push({input:relation,status:'refused',reason:error.message});}
}
const dense=fixture(3);dense.plan.pages[0].groups[0].blocks[0].text='需要完整保留的服务内容与适用条件。'.repeat(60);
const oversized=measuredLayoutCandidates(dense.plan,area,metrics)[0];
assert.equal(oversized.candidates.length,0);
refusal.push({input:'超容量正文',status:'refused',reason:oversized.rejected});
const report={kind:'controlled-asset-replay',milestone:'A0',status:'awaiting-user-review',area,cases,refusal,coverage:'测量、绑定与灰稿编译；不证明自动分页、模型理解/选择或完整灰稿里程碑'};
await fs.writeFile(path.join(output,'review.json'),JSON.stringify(report,null,2));
const state={...newRunState('固定输入版式回放','simulated-source.md'),deckBrief:{title:'A0 固定输入版式回放'},grayDraft:{area,status:'awaiting-user-review'},pages:cases.map(c=>c.page)};
await renderGrayDraft(state,output);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sections=cases.map((c,i)=>`<section><h2>${i+1}. ${esc(c.name)}</h2><code>${esc(c.programId)}</code><p>正文 ${c.receipt.fontSize}px · ${c.page.items.length} 个内容组 · 测量/引用检查通过</p><img src="preview/slide-${String(i+1).padStart(2,'0')}.png" alt="${esc(c.name)}"><details><summary>查看本例输入和检查回执</summary><pre>${esc(JSON.stringify({source:c.source,plan:c.input,receipt:c.receipt,check:c.check},null,2))}</pre></details></section>`).join('');
const refusalHtml=refusal.map(r=>`<li><strong>${esc(r.input)}</strong>：拒绝；${esc(typeof r.reason==='string'?r.reason:r.reason[0].reason)}</li>`).join('');
await fs.writeFile(path.join(output,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>A0 版式验收</title><style>body{font-family:'Microsoft YaHei',sans-serif;max-width:1250px;margin:32px auto;padding:0 24px;color:#20262d;background:#f4f5f6}section{background:white;padding:24px;margin:28px 0;border:1px solid #d5d9dd}img{width:100%;height:auto}pre{white-space:pre-wrap;overflow-wrap:anywhere}a{color:#17689a}li{margin:12px 0}</style><h1>A0 首批灰稿版式验收</h1><p><b>待你验收，尚未完成 A0。</b>以下是明确标记为模拟内容的固定输入回放。测量、绑定和编译调用现有生成线程序；本次未测试模型或自动分页。</p><p><a href="gray-draft.pptx">打开可编辑 PPT（7 页）</a> · <a href="review.json">查看完整输入/输出/拒绝记录</a></p><p>请检查：内容有没有被漏掉或改写；主辅关系和阅读顺序是否清楚；区域分配是否合适；文字是否可读。按页告诉我“通过”或具体问题。此处先验收版式承载能力，暂不进入 A1。</p>${sections}<section><h2>拒绝边界</h2><ul>${refusalHtml}</ul><p>需要跨组对齐/连线的比较、先后、因果，以及超容量正文不会被强行套入这些候选。</p></section></html>`);
const filenames=['index.html','gray-draft.pptx','review.json','editable-check.json'];
await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({status:'awaiting-user-review',origin:'simulated',files:await Promise.all(filenames.map(async file=>({file,sha256:createHash('sha256').update(await fs.readFile(path.join(output,file))).digest('hex')})))},null,2));
console.log(JSON.stringify({output,review:path.join(output,'index.html'),pages:cases.length,status:'awaiting-user-review'}));
