import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {newRunState, renderContentMarkdown} from '../../src/runner/state.mjs';
import {validateGrayPlan, renderGrayDraft, grayBodyLayout, fitGrayText} from '../../src/runner/gray-draft.mjs';
import {resolveGrayLayout} from '../../src/runner/gray-layout.mjs';

// Authored simulation fixtures for user review, not an automatic planning benchmark.
const root=path.dirname(fileURLToPath(import.meta.url));
const output=path.join(root,'artifacts');
const text=(heading, ...blocks)=>({heading,kind:'text',blocks:blocks.map(([label,text])=>({label,text}))});
const blue=(heading,kind,content,expression,relationship,production)=>({heading,kind,
  blocks:[{text:content}],expression,relationship,production});
const cases=[
  {title:'项目优先级',claim:'优先推进价值高、实施难度低的事项',size:'medium',layout:{type:'row',weights:[3,2]},
    purpose:'在资源有限时确定先做哪些事项',narrative:'先依据价值和难度定位，再说明推进边界。',groups:[
      blue('组合定位','diagram','统一入口：高价值、低难度；数据平台：高价值、高难度；报表美化：低价值、低难度；全量迁移：低价值、高难度。','定位优先级。','业务价值与实施难度交叉。','四象限各放一项，轴向明确。'),
      text('推进边界',['先做统一入口','模拟评估中，统一入口的业务价值高、实施难度低，可先在单个服务场景试用。'],['保留评估条件','数据平台需先核对数据权限；全量迁移须完成回退方案。两项均暂不进入实施。'])]},
  {title:'阶段准入',claim:'试点通过验收后再扩大覆盖范围',size:'medium',layout:{type:'row',weights:[2,3]},
    purpose:'区分试点步骤和扩大覆盖的条件',narrative:'左侧说明验收规则，右侧呈现步骤与未通过的回流。',groups:[
      text('验收与责任',['业务验收','服务负责人逐项核对办理结果；异常记录必须有对应处理人。'],['扩大范围','试点达到验收要求后再纳入更多部门。未通过的事项返回整改，不能带缺陷直接推广。']),
      blue('推进与回流','flow','准备 → 试点 → 验收 → 推广。','说明准入路径。','验收未通过则返回试点。','门禁条件靠近验收，回流单独标识。')]},
  {title:'需求筛选',claim:'先确认真实需求，再投入方案设计',size:'medium',layout:{type:'column'},
    purpose:'展示需求逐步筛选而非无差别立项',narrative:'上方给筛选依据，下方呈现从需求到试点的转化。',groups:[
      text('筛选依据',['保留的问题','用户能描述具体受阻环节，且服务记录中能找到对应案例。只有工具偏好、没有业务问题的建议先补充调研。']),
      blue('需求到试点','flow','需求收集 → 场景核实 → 方案试点。','呈现逐阶段筛选。','前一阶段通过后才进入下一阶段。','保留阶段名称，筛选条件贴近转换处。')]},
  {title:'服务改进',claim:'统一入口需要同时打通分派和反馈',size:'medium',layout:{type:'row',weights:[3,2]},
    purpose:'将问题、对应措施和预期结果串起来',narrative:'对应关系在图区，结果验证方式在文字区。',groups:[
      blue('问题与措施','diagram','入口分散 → 统一受理；流转不明 → 明确分派。','说明改进逻辑。','措施分别对应问题，结果为预期。','按对应关系排布，不写成已实现成效。'),
      text('如何验证',['观察办理过程','试点记录从受理到分派的等待时间，并核对跨部门事项是否有明确接收人。'],['确认反馈闭合','用户能够看到当前进度和办理结果。试点结束后再判断措施是否有效，目前没有实际成效数据。'])]},
  {title:'职责协同',claim:'每个交接点都要有明确的接收人',size:'medium',layout:{type:'row',weights:[2,3]},
    purpose:'说明业务与技术团队的交接责任',narrative:'文字约定交接标准，图区表达角色和阶段的对应。',groups:[
      text('交接约定',['业务侧负责确认','需求进入开发前，由业务负责人确认范围、办理规则和验收方式。'],['技术侧负责回传','联调完成后回传测试记录与遗留问题；业务侧确认接收后再安排上线验收。']),
      blue('阶段与角色','diagram','业务组确认需求；技术组开发联调；业务组验收上线。','展示分工与交接。','技术回传测试记录，由业务组接收。','阶段横排、角色分行，突出交接点。')]},
  {title:'异常闭环',claim:'异常必须回到规则修订才算闭环',size:'small',layout:{type:'row',weights:[2,1]},
    purpose:'补足异常处理之后的规则改进',narrative:'主体说明处理和复查，局部图示呈现闭环。',groups:[
      text('从处理到预防',['先恢复服务','受理人记录异常场景和影响范围，责任人采取临时措施，并向用户说明当前进展。'],['再修订规则','复盘时区分偶发操作与重复缺陷。重复缺陷进入规则修订，下一次抽查检查是否仍然出现。']),
      blue('反馈闭环','flow','发现、处理、复查、修订。','追踪闭合。','修订反馈至后续执行。','闭环保留方向，节点仅短标题。')]},
  {title:'推广安排',claim:'先验证一个场景，再逐步复制经验',size:'small',layout:{type:'row',weights:[1,2]},
    purpose:'将近期动作与长期扩展区别开',narrative:'局部路线图给先后，主体解释当下任务与后续条件。',groups:[
      blue('推广节奏','flow','单点试用 → 部门扩展 → 跨部门推广。','呈现先后。','后一阶段依赖前期验收。','每阶段一个短标题，条件外置。'),
      text('当前工作与后续条件',['本轮只验证单点','选择业务边界清楚的服务事项，记录入口、处理人和反馈方式，完成一轮完整办理。'],['验收后再复制','部门扩展前补齐培训与支持渠道；跨部门推广前确认交接规则。各阶段由对应负责人确认后启动。'])]},
  {title:'能力建设',claim:'基础数据可靠后，分析能力才有用',size:'small',layout:{type:'row',weights:[1,1,1]},
    purpose:'区分当前基础任务和后续分析场景',narrative:'左侧基础任务支撑中间层级，右侧给应用范围。',groups:[
      text('当前基础',['先统一口径','明确事项编码、状态含义和责任部门，抽查实际记录是否一致。'],['再补齐记录','缺失信息由业务侧确认，不能用推测值填补。']),
      blue('能力层级','diagram','数据基础 → 过程可见 → 分析辅助。','表达支撑。','上层依赖下层。','三层短标题，底层作为基础。'),
      text('应用范围',['过程可见','先展示在办状态和积压位置，帮助定位需要处理的环节。'],['辅助分析','口径稳定后再分析趋势；分析提示需结合业务核查。'])]},
  {title:'方案权衡',claim:'先用轻量方案验证，保留升级条件',size:'small',layout:{type:'row',weights:[2,1]},
    purpose:'表达两种方案的取舍及结论成立条件',narrative:'左侧展开适用边界，右侧用相同口径比较。',groups:[
      text('选择及适用条件',['当前选择轻量接入','当试点范围较小、现有系统能提供必要接口时，先验证业务流程，降低初期改造负担。'],['何时升级平台','若试点出现持续的跨系统协作需求，再评估统一平台。需同时核算迁移工作、维护责任与长期投入。']),
      blue('两方案对照','diagram','轻量：投入低、扩展受限；平台：投入高、扩展较强。','辅助权衡。','比较启动投入与扩展能力。','同口径对齐，适用条件见正文。')]},
  {title:'成效观察',claim:'结果指标与过程记录需要一起看',size:'small',layout:{type:'row',weights:[1,1,1]},
    purpose:'避免把过程动作直接当作最终成效',narrative:'目标关联观察维度，左右分别展开结果和过程。',groups:[
      text('结果观察',['办理是否改善','比较办理时长与退回情况，并注明观察范围和样本口径。'],['解释变化','业务类型变化可能影响结果，分析时需分场景核对。']),
      blue('观察框架','diagram','服务改善：办理时长、退回情况、流转记录。','组织观察项。','结果与过程共同围绕目标。','区分两类指标，不画虚假因果。'),
      text('过程记录',['定位等待环节','记录受理、分派、处理与反馈的时间，检查交接是否停滞。'],['结合结果解释','过程变化用于解释结果；完成一次培训本身不能证明服务改善。'])]},
];

const sources=[];
const semanticPlan={schemaVersion:'gray-plan-3',deckBrief:{title:'服务改进模拟灰稿',audience:'灰稿审阅人',objective:'验收信息组织与局部结构区域，随后再套用结构'},planningNotes:'人工编写的十页模拟样例；未调用自动规划模型，未套用结构。',pages:cases.map((c,i)=>({
  pageId:`p${i+1}`,title:c.title,claim:`模拟｜${c.claim}`,pagePurpose:c.purpose,narrative:c.narrative,
  groups:c.groups.map((g,j)=>({...g,id:`p${i+1}-g${j+1}`,role:g.kind==='text'?'展开条件与行动':'承载局部信息关系',importance:g.kind==='text'?'primary':'supporting',blocks:g.blocks.map((b,k)=>{
    const id=`s${sources.length+1}`;
    sources.push({id,heading:c.title,text:[b.label,b.text].filter(Boolean).join('\n')});
    return {...b,id:`b${k+1}`,sourceIds:[id]};
  })}))
}))};
const area={width:1170,height:492,label:'10 页模拟灰稿 · 等待用户验收'};
const selection={pages:cases.map((c,i)=>({pageId:`p${i+1}`,layout:c.layout}))};
const resolved=resolveGrayLayout(semanticPlan,selection,area,{measureBody:grayBodyLayout,fitText:fitGrayText});
const base={...newRunState('',path.join(output,'source.md')),sources,grayDraft:{version:'gray-draft-3',area}};
const check=validateGrayPlan(base,resolved.plan,area);
if(!check.accepted) throw new Error(JSON.stringify(check.issues,null,2));
console.log('10 页内容、引用、文字容量、区域边界检查通过。');
if(!process.argv.includes('--check-only')) {
  await fs.mkdir(output,{recursive:true});
  try{await fs.access(path.join(output,'state.json'));throw new Error('已有 state.json；请使用灰稿 replay 输出到新目录，不覆盖审阅版本。');}catch(error){if(error.code!=='ENOENT')throw error;}
  const state={...check.state,grayDraft:{...base.grayDraft,status:'awaiting-user-review',humanReview:'pending',artifactDirectory:output,
    authoredSimulation:true,semanticPlan,reviewCases:cases.map((c,i)=>({pageId:`p${i+1}`,targetSize:c.size,title:c.title})),structureApplied:false}};
  const write=(file,value)=>fs.writeFile(path.join(output,file),JSON.stringify(value,null,2)+'\n');
  await write('state.json',state);
  await write('layout-check.json',{accepted:check.accepted,issues:check.issues,coverage:check.coverage,receipts:resolved.receipts});
  await fs.writeFile(path.join(output,'source.md'),'# 人工编写的模拟素材\n\n'+sources.map(s=>`## ${s.id} ${s.heading}\n${s.text}`).join('\n\n'));
  await fs.writeFile(path.join(output,'content.md'),renderContentMarkdown(state).trimEnd()+'\n');
  await renderGrayDraft(state,output);
  console.log(`生成完成：${output}`);
}
