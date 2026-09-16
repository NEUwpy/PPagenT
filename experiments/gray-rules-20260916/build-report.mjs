import fs from 'node:fs/promises';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import {profiles} from './prompts.mjs';
const root=process.cwd(),output=path.resolve('outputs/gray-rules-report-20260916');
const records=JSON.parse(await fs.readFile(path.join(output,'records.json'),'utf8')).filter(r=>r.profile!=='replay');
const labels={historical:'历史基线',original:'原版重跑',positive:'精简正向',guarded:'正向＋反向',focused:'局部替换',compact:'进一步精简',replay:'仅排版：原内容回放'};
const audit={
'focused--hierarchy':'三类及3/2/1条目归属可读，压成一页；缺少模拟性质，仍有短内容占整栏。',
'focused--conditions':'两页均已看图：普通流程和例外范围保留，缺少模拟声明；例外的短句拆成多个大块。',
'focused--evidence':'一页已看图：模拟性质、观察与推测、条件性验证、本周不做的动作均可见；未作用户验收。',
'focused--long-deck':'八页均已看图：主题对应有所改善，短内容拆页增多；第六页主题“先统一记录再择一试行”增加了原稿未给出的先后关系。',
'compact--hierarchy':'三页均已看图：分类被摊成多页，最后一页仅一句工单安排；缺少模拟性质。',
'compact--comparison':'两页均已看图：三个方案取值、条件建议和未知项可读；缺少模拟性质，短正文占用大栏。',
'compact--parallel':'两页均已看图：并行、汇合、返修与预约/开幕区分可见；缺模拟性质，主题“均通过”可能强化“审核完成”的条件。',
'compact--conditions':'两页均已看图：流程与例外条件基本保留，缺模拟性质，文字分块仍偏机械。',
'positive--conditions':'两页均已看图：规则主体可读，缺模拟性质；第二页网格留空，短限制独占区域。',
'positive--data':'两页均已看图：中文数字与百分点保持，缺模拟性质；第二页很稀疏。',
'positive--evidence':'两页均已看图：事实、推测和后续区分，但短限制独占栏；缺模拟性质。',
'original--plain':'一页已看图：内容对应可读，模拟性质缺失，短共同要求占大栏。',
'focused--plain':'一页已看图：模拟性质缺失，共同要求仍占半页。',
'compact--plain':'一页已看图：可见文本计划及原生文字含“模拟资料”，重导入图片标题起首“模拟”未显示，不能用文字检索当像素通过。',
'compact--independent':'一页已看图：没有新增共同完成门槛，发布、制作与正式开始区分可见；模拟范围独占一区。',
'focused--numbers-new':'一页已看图：混合数字与不同周期保留；主题“回收份数接近”缺乏来源依据，需修订。',
'compact--numbers-new':'三页均已看图：内容保留，但同一短稿拆为三页，第二页两句且重复口径限定，明显稀疏。'
};
for(const r of records)r.audit=audit[r.profile+'--'+r.case]||(r.profile==='historical'&&r.case==='long-deck'?'历史六页已在前轮逐页查看：主题覆盖、重复及疏密问题保留。':r.pages?'本次未逐页重新审阅此早期候选；不得计为视觉通过。':'未导出PPT，不提供虚构的页面预览。');
for(const id of ['hierarchy','long-deck']){
 const dir=path.resolve('outputs/gray-rules-layout-replay-20260916',id),v=JSON.parse(await fs.readFile(path.join(dir,'verification.json'),'utf8'));
 const old=records.find(r=>r.case===id&&r.profile==='historical');records.push({...old,batch:'gray-rules-layout-replay-20260916',profile:'replay',pages:v.pages,status:'awaiting-user-review',run:path.relative(output,dir).replaceAll('\\','/'),audit:'历史模型内容逐字不变；使用固定计划对照中第二次可渲染选择回放，非独立首轮成功。'+(id==='long-deck'?'第三、五页栏宽改善；主题覆盖缺陷保留。':'同一内容原先未导出，此次能排成一页；原稿模拟性质仍缺失。')});
}
const report=await fs.readFile(new URL('./report.md',import.meta.url),'utf8');await fs.writeFile(path.join(output,'report.md'),report);
const esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const compactJSON=x=>JSON.stringify(x).replaceAll('<','\\u003c');
const stats=Object.entries(labels).filter(([n])=>n!=='replay').map(([n,label])=>{
 const old=records.filter(r=>r.profile===n&&!r.batch.includes('holdout')),fresh=records.filter(r=>r.profile===n&&r.batch.includes('holdout'));
 return `<tr><td>${label}</td><td>${old.filter(r=>r.pages).length}/${old.length}</td><td>${fresh.length?fresh.filter(r=>r.pages).length+'/'+fresh.length:'未运行'}</td><td>${Object.values(profiles[n==='historical'?'original':n]).reduce((s,v)=>s+v.length,0)}</td></tr>`;
}).join('');
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>通用规则实验 · 修改前后对照</title><style>
:root{color-scheme:light;font-family:system-ui,"Microsoft YaHei",sans-serif;color:#202b36;background:#f5f6f8}body{max-width:1660px;margin:0 auto;padding:28px}h1{font-size:32px;margin-bottom:8px}h2{font-size:23px}h3{font-size:19px}p,li{line-height:1.75}a{color:#166b97}button,select{font:inherit;padding:8px 12px;border:1px solid #bac6cf;border-radius:5px;background:white;color:inherit;max-width:100%}button{cursor:pointer}button:disabled{opacity:.35;cursor:default}section{margin:24px 0;padding:24px;background:white;border:1px solid #dce1e5}.pair{display:grid;grid-template-columns:1fr 1fr;gap:22px}.panel{min-width:0;background:#f7f8fa;padding:16px;border:1px solid #dce1e5}.panel img{width:100%;height:auto;display:block;border:1px solid #dce1e5;background:white}.controls{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:12px 0}.note{padding:12px 16px;background:#edf3f7;border-left:3px solid #3d7191}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.7 ui-monospace,Consolas,monospace;max-height:450px;overflow:auto}.error{min-height:280px;padding:18px;background:#f9f1e9}.status{font-weight:600}.subtle{font-size:14px;color:#526473}.prompt{max-height:430px;overflow:auto}table{border-collapse:collapse;width:100%;font-size:15px}td,th{text-align:left;padding:9px;border-bottom:1px solid #dde2e6}summary{cursor:pointer;padding:8px 0}#full-report{max-width:1050px}#full-report h1{font-size:25px}#full-report h2{margin-top:32px}code{overflow-wrap:anywhere}@media(max-width:950px){body{padding:14px}.pair{grid-template-columns:1fr}section{padding:14px}}
</style><h1>通用规则实验：改了什么，结果怎样</h1><p>完成52次生成运行、32次审稿对照、16次固定内容排版选择。找到局部收益，也保留了副作用；<b>本轮没有把候选替换到生产规则。</b></p><p class="note">较明确的收益：排版契约改为互斥合法形状后，同内容选择的非法字段错误由5/8降到1/8。仍未证明整套规则不退步：存在声明遗漏、标题引入关系、过度分页和审稿漏检。</p>
<section><h2>实验结果概览</h2><p class="subtle">以下仅为实际导出稿件数，不是语义正确率或用户验收。原稿和全部失败均保留。字符数仅计算四阶段契约，共享规则未变。</p><table><thead><tr><th>版本</th><th>原八稿导出</th><th>四份新稿导出</th><th>契约字符数</th></tr></thead><tbody>${stats}</tbody></table></section>
<section><h2>修改前后：直接看实际页面</h2><div class="controls"><label>稿件 <select id="case"></select></label><button id="same-content">看六页长稿的同内容排版对照</button><button id="whole-change">看六页与八页的整体规则对照</button></div><details><summary>展开本稿原文</summary><pre id="source"></pre></details><p class="subtle">左右可独立选版本、翻页。点击图片查看原尺寸；只有导出的PPT才有图。整体改写的页码不表示内容一一对应。</p><div class="pair"><div class="panel" id="left"></div><div class="panel" id="right"></div></div></section>
<section><h2>往规则里增添或替换了什么</h2><p>规则按通用职责改写，没有加入八个案例的专稿答案。局部替换版保留原内容规划，替换表达、审稿、排版契约；进一步精简版再替换内容规划。正反向版的附加禁令没有被采纳。</p><div class="controls"><label>对照版本 <select id="profile">${Object.keys(profiles).filter(n=>n!=='original').map(n=>`<option value="${n}" ${n==='focused'?'selected':''}>${labels[n]}</option>`).join('')}</select></label><span id="length"></span></div><div id="prompt-diff"></div></section>
<section><h2>结论、证据边界与完整说明</h2><p><a href="report.md">打开完整Markdown报告</a> · <a href="records.json">逐次结果记录</a> · <a href="../../experiments/gray-rules-20260916/prompts.mjs">可复现的全部规则版本</a></p><div id="full-report">${new MarkdownIt().render(report)}</div></section>
<script>
const records=${compactJSON(records)},labels=${compactJSON(labels)},profiles=${compactJSON(profiles)};
const $=id=>document.getElementById(id),esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const ids=[...new Set(records.map(r=>r.case))],state={case:'long-deck',left:'historical',right:'focused',leftPage:1,rightPage:1};
$('case').innerHTML=ids.map(id=>'<option value="'+id+'">'+esc(records.find(r=>r.case===id).name)+'</option>').join('');
function available(){return records.filter(r=>r.case===state.case)}
function panel(side){const list=available();let r=list.find(r=>r.profile===state[side]);if(!r){r=list.find(x=>x.profile===(side==='left'?'original':'focused'))||list[side==='left'?0:list.length-1];state[side]=r.profile}state[side+'Page']=Math.max(1,Math.min(state[side+'Page'],r.pages||1));const p=state[side+'Page'];
 let body='<div class="controls"><label>'+ (side==='left'?'左侧':'右侧')+' <select data-side="'+side+'">'+list.map(x=>'<option value="'+x.profile+'" '+(x.profile===r.profile?'selected':'')+'>'+labels[x.profile]+'</option>').join('')+'</select></label></div><p class="status">'+(r.pages?'已导出 '+r.pages+' 页 · 待审':'未导出 · 保留失败记录')+'</p><p>'+esc(r.audit)+'</p>';
 if(r.pages){const img=r.run+'/preview/slide-'+String(p).padStart(2,'0')+'.png';body+='<div class="controls"><button data-step="-1" data-side="'+side+'" '+(p===1?'disabled':'')+'>上一页</button><span>'+p+' / '+r.pages+'</span><button data-step="1" data-side="'+side+'" '+(p===r.pages?'disabled':'')+'>下一页</button><a href="'+r.run+'/gray-draft.pptx">可编辑PPT</a></div><a href="'+img+'" target="_blank"><img src="'+img+'" alt="'+esc(labels[r.profile])+' 第'+p+'页"></a>'}
 else{body+='<div class="error"><b>没有实际PPT，不以规划文本假扮页面</b><pre>'+esc(JSON.stringify({program:r.programIssues,semantic:r.semanticIssues},null,2))+'</pre></div>'}
 body+='<p class="subtle">机器状态与实验审阅分开记录；所有产物均未获用户验收。</p><a href="'+r.run+'/state.json">运行状态</a>';$ (side).innerHTML=body;
}
function render(){ $('case').value=state.case;$('source').textContent=available()[0].source;panel('left');panel('right') }
document.addEventListener('change',e=>{if(e.target.id==='case'){state.case=e.target.value;state.leftPage=state.rightPage=1;render()}else if(e.target.dataset.side){state[e.target.dataset.side]=e.target.value;state[e.target.dataset.side+'Page']=1;render()}else if(e.target.id==='profile')prompts()});
document.addEventListener('click',e=>{if(e.target.dataset.step){state[e.target.dataset.side+'Page']+=Number(e.target.dataset.step);render()}});
$('same-content').onclick=()=>{Object.assign(state,{case:'long-deck',left:'historical',right:'replay',leftPage:3,rightPage:3});render()};
$('whole-change').onclick=()=>{Object.assign(state,{case:'long-deck',left:'historical',right:'focused',leftPage:1,rightPage:1});render()};
function prompts(){const name=$('profile').value||'focused',stages={content:'内容规划',expression:'表达选择',review:'语义审稿',layout:'基础排版'},sum=p=>Object.values(p).reduce((s,t)=>s+t.length,0);$('length').textContent='原版 '+sum(profiles.original)+' 字符 → '+sum(profiles[name])+' 字符（共享规则另计）';$('prompt-diff').innerHTML=Object.entries(stages).map(([k,title])=>'<details '+(k==='layout'?'open':'')+'><summary>'+title+' · '+(profiles.original[k]===profiles[name][k]?'完全保留':'替换重写')+'</summary><div class="pair"><div><h3>原版</h3><pre class="prompt">'+esc(profiles.original[k])+'</pre></div><div><h3>'+labels[name]+'</h3><pre class="prompt">'+esc(profiles[name][k])+'</pre></div></div></details>').join('')}
render();prompts();
</script></html>`;
await fs.writeFile(path.join(output,'index.html'),html);await fs.writeFile(path.join(output,'records.json'),JSON.stringify(records,null,2));console.log(output);
