import fs from 'node:fs/promises';
import path from 'node:path';
const output=path.resolve('outputs/gray-diverse-20260916');
const cases=JSON.parse(await fs.readFile(new URL('./cases.json',import.meta.url),'utf8'));
const notes={
hierarchy:'语义审稿通过；排版阶段要求重新规划，首轮没有可渲染布局。该容量结论只针对本轮尝试，不能解释为内容客观无法放入页面。',
comparison:'语义审稿拒绝：将浅蓝制作说明中的实际承载内容一概视为未上屏。复核 visible-plan 可见三个方案取值和条件均在说明中，存在与当前灰稿约定冲突的误拒；尚未渲染，不能判视觉通过。',
parallel:'表达绑定失败：表达文案的来源引用缺失或超出所绑定组。尚未进入语义审阅和渲染，不能据此认定并行关系理解失败。',
conditions:'模型返回的 JSON 字符串含非法控制字符，解析失败。是输出格式问题，尚不能评价最终条件表达。',
data:'保真检查把中文数字转写的 100、80、150、90、60、10、20 判为无来源。原稿存在对应中文数值，说明数字规范化存在阻塞；检查中断，未证明所有数据口径均正确。',
evidence:'语义审稿通过；排版最终选择 single 承载多个内容组，被布局契约拒绝。事实与推测在计划中有区分，但未形成实际页面。',
uneven:'语义审稿通过；排版权重不符合逐组正数契约，被拒绝。小区域的可读性与实际容量尚未得到验证。',
'long-deck':'导出六页，原生文字检查通过，PPTX 重导入预览六页均已实际查看。主要事实与限定可见；仍有内容重复和页面组织问题，待用户审阅，不计为内容规划验收通过。'
};
const visuals=[
'第1页：范围、普通工具限制和模拟性质可读；“试点目标”和“定位说明”重复记录需求与归还问题。',
'第2页：两区做法及工时证据不足均保留；使用上下条目说明，未按共同维度展开直接比较。',
'第3页：物资与用户反馈均保留，但主题只概括物资；右栏较窄、文字换行密，左右空间分配欠均衡。',
'第4页：浅蓝说明保留两类异常、回退与不认定责任的限定；文字说明较长。按当前灰稿约定不要求绘制内部节点。',
'第5页：建议尚未批准、晚间与周末不同时试行、职责持续开展均可读；部分文字块内部留白较大。',
'第6页：继续条件、扩面需另评估和会议请求均可读；首个决策句跨越当前与下一轮结束两个时点，层级还可改进。'
];
const rows=[];
for(const c of cases){const r=JSON.parse(await fs.readFile(path.join(output,c.id+'.result.json'),'utf8'));rows.push({...c,...r,review:notes[c.id]});}
await fs.writeFile(path.join(output,'assessment.json'),JSON.stringify({scope:'8份合成稿的固定配置首轮诊断，不是稳定成功率或M1验收；未改核心代码、模型提示或规划答案。',model:'deepseek-v4-flash',thinking:'disabled',maxRevisions:0,visuals,results:rows},null,2));
const esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>八类模拟稿诊断</title><style>body{max-width:1250px;margin:32px auto;padding:0 24px;font:17px/1.65 system-ui;color:#20262d;background:#f5f6f7}h1{font-size:30px}h2{font-size:23px}section{background:white;padding:24px;margin:24px 0;border:1px solid #ddd}a{color:#126aa0}pre{white-space:pre-wrap;font:inherit}img{width:100%;border:1px solid #ddd}summary{cursor:pointer}small{color:#555}</style><h1>八类模拟稿：固定配置首轮诊断</h1><p>8份原稿，1份生成6页灰稿，7份在渲染前被拦下。导出不等于验收。模型为 deepseek-v4-flash，thinking关闭；每稿一次内容规划，不进行规划修订，保留运行器内置排版尝试。各稿测试重点未传给模型。</p><p>失败混合了格式、引用、检查误拒和布局问题，不能把7份失败都归因于内容理解。未开展新稿稳定性统计，未改核心生成代码。</p>${rows.map(c=>`<section><h2>${esc(c.name)} · ${c.pages?'已导出 '+c.pages+' 页':'未导出'}</h2><p>观察重点：${esc(c.focus)}</p><p>${esc(c.review)}</p><details><summary>展开模拟原稿</summary><pre>${esc(c.source)}</pre></details><p><a href="${c.id}/state.json">运行状态</a> · <a href="${c.id}/revision-0/content-plan.json">首轮内容计划（若阶段已完成）</a>${c.pages?` · <a href="${c.id}/gray-draft.pptx">可编辑PPT</a> · <a href="${c.id}/preview.html">六页预览</a>`:''}</p>${c.pages?visuals.map((v,i)=>`<p>${esc(v)}</p><img loading="lazy" src="${c.id}/preview/slide-0${i+1}.png" alt="第${i+1}页灰稿">`).join(''):''}</section>`).join('')}</html>`;
await fs.writeFile(path.join(output,'index.html'),html);
const md='# 八类模拟稿诊断（2026-09-16）\n\n当前 main 代码冻结，使用本地配置 deepseek-v4-flash / thinking disabled / 18000 tokens。每案例一次内容规划，无规划返工；沿用内置排版尝试。并发2。8份均为本次编写的模拟材料，观察重点未传给模型，无手写规划答案。\n\n结果：1份导出六页；7份在渲染前停止。失败不能统一解读为语义理解失败；导出不能计为M1通过。\n\n'+rows.map(c=>'## '+c.name+'\n\n'+c.review+'\n').join('\n')+'\n## 六页实际预览审阅\n\n'+visuals.join('\n\n')+'\n\n完整原稿、模型响应、状态、检查、提示及代码快照在 outputs/gray-diverse-20260916。该目录按项目约定被Git忽略；cases.json、run.mjs、report.mjs及本报告保留在experiments。本轮未修改核心生成器，未提交或推送。\n';
await fs.writeFile(new URL('./report.md',import.meta.url),md);
console.log(path.join(output,'index.html'));
