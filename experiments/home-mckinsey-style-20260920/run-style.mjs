import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {buildChatProviderFromEnv} from '../../src/runner/chat-provider.mjs';
import {runToolLoop,transcriptSummary} from '../../src/runner/loop.mjs';
import {createToolRegistry,defineTool} from '../../src/runner/tools/index.mjs';
import {listStructureSkills,loadStructureSkill} from '../../src/runtime/structure-skills.mjs';
import {renderMckinsey} from '../home-gray-mckinsey-20260920/render-mckinsey.mjs';
import {renderStyled} from './render-body.mjs';
import {validateBlueprint} from './style-contract.mjs';

const root=path.resolve(import.meta.dirname,'../..'),[dest,promptFile,...flags]=process.argv.slice(2);
if(!dest||!promptFile)throw new Error('Usage: run-style.mjs run-directory prompt-file [--control]');
const runDir=path.resolve(dest),control=flags.includes('--control');
if(await fs.stat(path.join(runDir,'state.json')).then(()=>true,()=>false))throw new Error('Run exists; preserve it and choose a new directory');
await fs.mkdir(runDir,{recursive:true});
const write=(name,v)=>fs.writeFile(path.join(runDir,name),typeof v==='string'?v:JSON.stringify(v,null,2));
const input=path.join(root,'experiments/home-gray-magazine-20260919/input/gray-state.json');
const raw=await fs.readFile(input,'utf8'),gray=JSON.parse(raw).grayDraft.semanticPlan;
const refineFlag=flags.find(f=>f.startsWith('--refine='));
const prior=refineFlag?JSON.parse(await fs.readFile(path.resolve(refineFlag.slice(9),'state.json'),'utf8')):null;
const frozen=prior?.blueprint??JSON.parse(await fs.readFile(path.join(root,'experiments/home-gray-mckinsey-20260920/run-02/candidate-1/blueprint.json'),'utf8'));
const prompt=await fs.readFile(promptFile,'utf8');
const paths=['rules/skins/东北大学.md','rules/排版体系/麦肯锡式.md','skills/references/selection.md'];
const rules=(await Promise.all(paths.map(async p=>p+'\n'+await fs.readFile(path.join(root,p),'utf8')))).join('\n');
const system=`你是冻结灰稿之后的正文视觉执行者。仅制作一张代表页。Skin与全部文字、分组、结构分解、主旨句固定，不重新提炼事实或补充解释。读取输入并检索/读取结构guide后构建。先执行通用风格规则，再通过已有工具表达，不以一次程序成功宣称审美通过。\n正文18px、局部标题21px，编号用既有small/large/rail角色，不能缩字。主体区域1170×492，柱间距可选24/32/40。仅支持已有并列内容组、文字以及已绑定汇聚图；结构本身沿用源设计局部原生适配，不改为参考图的另一种造型。\n${control?'当前执行器仅能改变groupWeights；没有正文视觉配置能力。':'visual.groups给每组绑定index（small=辅助编号，large=清楚的列首编号，rail=以无箭头细线贯穿文字列表的阅读编号）、heading（plain=纯文字，wash=白色向主题浅色过渡的连续条目底面）、rhythm（natural=固定条目间距并将余量留在组尾，distributed=保持文字与条目自然高度不变，仅将余量分配到条目之间）。rail不表达步骤或因果；图示组不能设置rail。detailStrips可把原文内同口径短项变成同行对象—状态；intro和parts的label/body须按原文顺序逐字摘引，label仅对象短名、body仅余下状态，两者必须互不重叠，不能把整项同时放入两个字段；将intro+每项label+body依次拼接须恰好覆盖整个块，未使用时为空数组。所有字段都需表达理由，不为调用而添加内容。'}\n至多3次构建。构建失败按容量反馈调整；成功后finish_visual等待主Agent看图。\n${rules}\n本轮补充的通用风格提示（优先于旧风格的冲突装饰限制）：\n${prompt}`;
const state={input,inputHash:crypto.createHash('sha256').update(raw).digest('hex'),control,promptFile:path.resolve(promptFile),phase:'visual',attempt:0,candidate:null,blueprint:null,guides:[]};
await write('state.json',state);await write('system-prompt.txt',system);await write('input.json',gray);await write('frozen-content-blueprint.json',frozen);
const groupWeights={type:'array',items:{type:'number',minimum:.1}};
const str={type:'string'};
const schema=control?{type:'object',properties:{groupWeights},required:['groupWeights'],additionalProperties:false}:{type:'object',properties:{groupWeights,visual:{type:'object',properties:{groupGap:{type:'integer',enum:[24,32,40]},sectionDivider:{type:'boolean'},groups:{type:'array',items:{type:'object',properties:{id:str,index:{type:'string',enum:['small','large','rail']},heading:{type:'string',enum:['plain','wash']},rhythm:{type:'string',enum:['natural','distributed']}},required:['id','index','heading','rhythm'],additionalProperties:false}}},required:['groupGap','sectionDivider','groups'],additionalProperties:false},detailStrips:{type:'array',items:{type:'object',properties:{groupId:str,blockId:str,intro:str,parts:{type:'array',items:{type:'object',properties:{label:str,body:str},required:['label','body'],additionalProperties:false}}},required:['groupId','blockId','intro','parts'],additionalProperties:false}},reason:str},required:['groupWeights','visual','detailStrips','reason'],additionalProperties:false};
const empty={type:'object',properties:{},additionalProperties:false};
const tools=[
 defineTool({name:'read_inputs',description:'读取冻结灰稿与上轮已确定的内容蓝图',inputSchema:empty,handler:async()=>({gray,frozenContent:frozen,visualFrame:{left:55,top:166,width:1170,height:492},referenceBoundary:'参考图片只用于审美评估，不能引入其额外事实。'})}),
 defineTool({name:'list_structures',description:'查询与固定关系对应的结构，保留结构库调用原则',inputSchema:empty,handler:async()=> (await listStructureSkills(root)).filter(s=>s.assetId===frozen.diagrams[0].assetId).map(s=>({assetId:s.assetId,semantic:s.asset.semanticContract}))}),
 defineTool({name:'read_guide',description:'读取结构语义与不变量',inputSchema:{type:'object',properties:{assetId:str},required:['assetId']},handler:async({assetId})=>{const d=await loadStructureSkill(assetId,root);state.guides.push(assetId);return d.skill;}}),
 defineTool({name:'build_body',description:'提交可执行视觉选择，实际构建PPT并重导入；不会自动判定视觉通过',inputSchema:schema,handler:async proposal=>{
  if(state.attempt>=3)return {accepted:false,error:'build budget exhausted'};
  if(frozen.diagrams.some(d=>!state.guides.includes(d.assetId)))return {accepted:false,error:'Read the structure guide first'};
  const bp={...frozen,...proposal};
  if(!control){const errors=validateBlueprint(gray,bp);if(errors.length)return {accepted:false,errors};}
  state.attempt++;state.blueprint=bp;state.candidate=null;await write('state.json',state);
  const out=path.join(runDir,`candidate-${state.attempt}`);await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'blueprint.json'),JSON.stringify(bp,null,2));
  try{state.candidate=await (control?renderMckinsey:renderStyled)(gray,bp,out);await write('state.json',state);return state.candidate;}
  catch(e){await write('state.json',state);return {accepted:false,error:e.message};}
 }}),
 defineTool({name:'finish_visual',description:'候选完成后提交主Agent图像审阅',inputSchema:empty,handler:async()=>{if(!state.candidate?.accepted)return{accepted:false,error:'No candidate'};state.phase='awaiting-human-review';await write('state.json',state);return{accepted:true,phase:state.phase};}}),
];
const provider=await buildChatProviderFromEnv({root,maxTokens:6000,observer:async e=>fs.appendFile(path.join(runDir,'provider-events.ndjson'),JSON.stringify(e)+'\n')});
state.provider=provider.identity;await write('state.json',state);
const registry=createToolRegistry({tools,runDir});
const result=await runToolLoop({provider,systemPrompt:system,userMessage:'按本轮通用正文风格提示，处理冻结灰稿。保持事实、归属、主旨和结构关系。',registry,maxTurns:9,shouldStop:async()=>state.phase==='awaiting-human-review'?{reason:state.phase}:state.attempt>=3?{reason:'build-budget-exhausted'}:null,onTurn:async t=>{await fs.appendFile(path.join(runDir,'turns.ndjson'),JSON.stringify(t)+'\n');console.log('turn',t.turn,t.toolCalls.map(c=>c.name).join(','));}});
await write('transcript.json',result);await write('summary.json',transcriptSummary(result));console.log(JSON.stringify({phase:state.phase,candidate:state.candidate}));
if(state.phase!=='awaiting-human-review')process.exitCode=1;
