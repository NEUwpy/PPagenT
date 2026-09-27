import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { buildChatProviderFromEnv } from '../../src/runner/chat-provider.mjs';
import { runToolLoop, transcriptSummary } from '../../src/runner/loop.mjs';
import { createToolRegistry, defineTool } from '../../src/runner/tools/index.mjs';
import { listStructureSkills, loadStructureSkill } from '../../src/runtime/structure-skills.mjs';
import { validateBlueprint, SUPPORTED_STRUCTURE } from './visual-contract.mjs';
import { renderMckinsey } from './render-mckinsey.mjs';

const root=path.resolve(import.meta.dirname,'../..');
const args=process.argv.slice(2);
const runDir=path.resolve(args[0]??path.join(import.meta.dirname,'run-01'));
const input=path.resolve(args[1]??path.join(import.meta.dirname,'../home-gray-magazine-20260919/input/gray-state.json'));
const raw=await fs.readFile(input,'utf8'),source=JSON.parse(raw),gray=source.grayDraft?.semanticPlan;
if(!gray)throw new Error('Missing grayDraft.semanticPlan; no reconstructed handwritten content fallback');
if(!args.includes('--replay') && await fs.stat(path.join(runDir,'state.json')).then(()=>true,()=>false))throw new Error('Run exists; choose another directory or --replay');
await fs.mkdir(runDir,{recursive:true});
const write=(name,value)=>fs.writeFile(path.join(runDir,name),typeof value==='string'?value:JSON.stringify(value,null,2));
const statePath=path.join(runDir,'state.json');
if(args.includes('--replay')) {
  const saved=JSON.parse(await fs.readFile(statePath,'utf8'));
  if(saved.inputHash!==crypto.createHash('sha256').update(raw).digest('hex'))throw new Error('Frozen input hash changed');
  const result=await renderMckinsey(gray,saved.blueprint,path.join(runDir,'replay'));
  console.log(JSON.stringify(result));
} else {
  const state={phase:'visual',input,inputHash:crypto.createHash('sha256').update(raw).digest('hex'),skin:'northeastern-university-001',
    grayAuthor:source.grayDraft.planner,grayHumanReview:source.grayDraft.humanReview,attempt:0,blueprint:null,candidate:null,readGuides:[]};
  await write('input-snapshot.json',source);await write('state.json',state);
  const paths=['rules/skins/东北大学.md','rules/排版体系/麦肯锡式.md','rules/页面组合.md','skills/references/selection.md'];
  const rules=(await Promise.all(paths.map(async f=>`\n${f}\n${await fs.readFile(path.join(root,f),'utf8')}`))).join('\n');
  const system=`你是灰稿之后的视觉执行者。输入已冻结灰稿计划；不再做稿件分页提炼。用工具读取灰稿，检索结构及guide，再提交可构建的麦肯锡式方案。\n本轮实验执行器只支持一页、并排灰稿组、普通文字和多路汇聚结构的局部原生适配；它不是通用自由编排器。\n已有灰稿groups/blocks全部保持，普通文案逐字来自灰稿。只有图示块需要你决定原文怎样分成图外context与图内inputs；按原文顺序精确摘引，context+inputs必须覆盖整个块正文。结果用block.label。context用于前提/已完成背景，不应进入原因输入；inputs必须是真正共同导致结果的因素。关系不适合时报告能力缺口，不伪造因果。\n可调groupWeights给真实图文足够面积；首次从1:1.1附近试排。正文18px，局部标题21px，固定模板主旨32px，结构标签18px，程序测量换行，不能縮字硬塞。\nbuild_candidate失败会返回容量问题，请调整后重试，最多3次。成功后finish_visual进入awaiting-human-review；工具没有看图能力，不能宣称视觉通过。\n先给结论、一页一事、标题即观点：headline用一句不超过32字的判断概括本页，保留待提升、需改进语气，不能把目标写成已达成成果。headlineEvidence填写提供依据的现有block id；不要强造四点感悟和两点不足的一对一映射。headline仅用于模板蓝条，sectionTitle用不超过4个汉字概括章节，原模板章节位宽178px，不能照搬长页名导致换行；蓝条观点标题headline保持一行。结构入口本轮仍是任务局部迁移适配，并非大学专用preserved-design登记能力。默认不要增加照片/图表：只制作灰稿已选定的媒介。${rules}`;
  await write('system-prompt.txt',system);
  const schema={type:'object',properties:{sectionTitle:{type:'string',minLength:1,maxLength:4},headline:{type:'string',minLength:8,maxLength:32},headlineEvidence:{type:'array',items:{type:'string'},minItems:2},groupWeights:{type:'array',items:{type:'number',minimum:.1}},diagrams:{type:'array',items:{type:'object',properties:{groupId:{type:'string'},blockId:{type:'string'},assetId:{type:'string'},context:{type:'string'},inputs:{type:'array',items:{type:'string'},minItems:3,maxItems:6},result:{type:'string'},reason:{type:'string'}},required:['groupId','blockId','assetId','context','inputs','result','reason'],additionalProperties:false}}},required:['sectionTitle','headline','headlineEvidence','groupWeights','diagrams'],additionalProperties:false};
  const empty={type:'object',properties:{},additionalProperties:false};
  const tools=[
    defineTool({name:'read_gray',description:'读取冻结灰稿、实际媒介职责与原稿，先读此项',inputSchema:empty,handler:async()=>({gray,sources:source.sources,limits:{onePage:true,frame:{width:1170,height:492},layout:'existing groups as adjacent columns'}})}),
    defineTool({name:'list_structures',description:'按英文logic检索结构；all返回全部概览，causal=因果、convergence=多路汇聚',inputSchema:{type:'object',properties:{logic:{type:'string',enum:['all','causal','convergence','sequence','parallel','hierarchy','comparison']}},required:['logic']},handler:async({logic})=>(await listStructureSkills(root)).filter(x=>logic==='all'||x.runtime.logicId===logic).map(x=>({id:x.assetId,name:x.asset.name,logic:x.runtime.logicId,semantic:x.asset.semanticContract,localAdapter:x.assetId===SUPPORTED_STRUCTURE}))}),
    defineTool({name:'read_guide',description:'读取具体结构语义、不变量和实现证据',inputSchema:{type:'object',properties:{assetId:{type:'string'}},required:['assetId']},handler:async({assetId})=>{const d=await loadStructureSkill(assetId,root);state.readGuides.push(assetId);await write('state.json',state);return {assetId,skill:d.skill,sourcePath:path.relative(root,d.assetDir),localAdapter:assetId===SUPPORTED_STRUCTURE?'task-local native adaptation, sampled cubic curves from review.mjs (.4/.32), shared university theme and type roles':'not implemented in this pilot'};}}),
    defineTool({name:'build_candidate',description:'提交媒介分解和区域比例，实际生成并重导入PPT；返回容量/覆盖等问题',inputSchema:schema,handler:async blueprint=>{
      if(state.attempt>=3)return {accepted:false,error:'3 build attempts exhausted; preserve failure and stop'};
      const issues=validateBlueprint(gray,blueprint);if(issues.length)return{accepted:false,issues};
      if(blueprint.diagrams.some(d=>!state.readGuides.includes(d.assetId)))return{accepted:false,error:'Read selected guide before build'};
      state.attempt++;state.blueprint=blueprint;state.candidate=null;await write('state.json',state);
      const candidateDir=path.join(runDir,`candidate-${state.attempt}`);
      await fs.mkdir(candidateDir,{recursive:true});await fs.writeFile(path.join(candidateDir,'blueprint.json'),JSON.stringify(blueprint,null,2));
      const result=await renderMckinsey(gray,blueprint,candidateDir);state.candidate=result;await write('state.json',state);return result;
    }}),
    defineTool({name:'finish_visual',description:'结束制作并等待实际图片审阅，不能以此判为视觉验收通过',inputSchema:empty,handler:async()=>{
      if(!state.candidate?.accepted)return {accepted:false,error:'No built candidate'};
      state.phase='awaiting-human-review';await write('state.json',state);return{accepted:true,status:state.phase,candidate:state.candidate};
    }})];
  const provider=await buildChatProviderFromEnv({root,maxTokens:7000,observer:async e=>{await fs.appendFile(path.join(runDir,'provider-events.ndjson'),JSON.stringify(e)+'\n');console.log(JSON.stringify({type:e.type,status:e.status,model:e.model,durationMs:e.durationMs}));}});
  state.provider=provider.identity;await write('state.json',state);
  const registry=createToolRegistry({tools,runDir});
  const result=await runToolLoop({provider,systemPrompt:system,userMessage:'将已冻结的一张范本灰稿制作为一张麦肯锡式PPT。读取灰稿并检索局部结构后开始。',registry,maxTurns:10,
    onTurn:async turn=>{await fs.appendFile(path.join(runDir,'turns.ndjson'),JSON.stringify(turn)+'\n');console.log('turn',turn.turn,turn.toolCalls.map(x=>x.name).join(','));},
    shouldStop:async()=>state.phase==='awaiting-human-review'?{reason:state.phase}:state.attempt>=3&&!state.candidate?{reason:'build-budget-exhausted'}:null});
  await write('transcript.json',result);await write('summary.json',transcriptSummary(result));
  console.log(JSON.stringify({phase:state.phase,candidate:state.candidate,summary:transcriptSummary(result)}));
  if(state.phase!=='awaiting-human-review')process.exitCode=1;
}
