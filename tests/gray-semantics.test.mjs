import test from 'node:test';
import assert from 'node:assert/strict';
import { newRunState } from '../src/runner/state.mjs';
import { validateSemanticPlan, bindSemanticLayout, bindGrayExpressions, semanticReviewInput, grayDisplayBlocks, semanticPages, regionBody } from '../src/runner/gray-semantics.mjs';
import { grayBodyLayout, validateGrayPlan } from '../src/runner/gray-draft.mjs';
import { runGrayDraft } from '../src/runner/gray-draft.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const base=()=>newRunState('模拟内容。建议先核验再开放，不合格则暂停。','fixture');
const architecture=()=>({deckBrief:{title:'试点',audience:'负责人',objective:'确认条件'},pages:[{
  pageId:'p1',title:'开放条件',claim:'核验通过后开放',pagePurpose:'理解开放的前提',narrative:'行动与条件',
  groups:[{id:'g1',role:'implementation_plan',heading:'开放安排',importance:'primary',kind:'text',blocks:[
    {id:'a',role:'action',label:'核验与开放',text:'模拟内容。建议先核验再开放。',sourceIds:['s1']},
    {id:'c',role:'condition',label:'暂停条件',text:'不合格则暂停。',sourceIds:['s1']},
  ]}],relations:[{from:'g1',to:'$claim',type:'implementation',meaning:'落实开放建议'},{from:'c',to:'a',type:'condition',meaning:'核验不合格不得开放'}],readingOrder:['g1'],
}]});
const layout=()=>({pages:[{pageId:'p1',regions:[{itemId:'g1',x:0,y:0,width:600,height:350,fontSize:22}]}]});

test('a local expression stays inside its branch and is visible to review and measurement',()=>{
  const p=architecture();p.schemaVersion='gray-plan-3';delete p.pages[0].relations;
  Object.assign(p.pages[0].groups[0].blocks[0],{kind:'flow',expression:'说明核验与开放',relationship:'先核验再开放',production:'按真实先后组织'});
  const selection={pages:[{pageId:'p1',expressions:[{groupIds:['g1'],heading:'开放安排',kind:'text'}]}]};
  const bound=bindGrayExpressions(p,selection),item=semanticPages(bound)[0].items[0];
  assert.equal(validateSemanticPlan(base(),bound).accepted,true);
  assert.equal(item.kind,'text');
  assert.equal(item.blocks.length,2);
  const display=grayDisplayBlocks(item),body=grayBodyLayout(item,568,22);
  // 唯一带标签正文条目只有一条，且另一块是附注——按 #71 语义不编号。
  assert.deepEqual(display.filter(run=>run.bold).map(run=>run.text),['核验与开放','暂停条件']);
  assert.equal(display.filter(run=>run.kind==='flow').length,1);
  assert.match(display[1].text,/本条建议画结构图：说明核验与开放；节点短语（摘引）：模拟内容/u);
  assert.equal(display[3].text,'不合格则暂停。');
  assert.equal(body.sections.filter(section=>section.kind==='flow').length,1);
  assert.equal(body.runs.map(run=>run.text).join('').replace(/\s/gu,''),regionBody(item).replace(/\s/gu,''));
  const review=semanticReviewInput({source:base().sources,area:{width:600,height:600,label:'BACKSTAGE_CASE_NAME'},plan:bound});
  assert.deepEqual(review.area,{width:600,height:600});
  assert.doesNotMatch(JSON.stringify(review),/BACKSTAGE_CASE_NAME/);
  assert.deepEqual(review.visiblePages[0].regions[0].body,grayDisplayBlocks(item));
  assert.match(review.visiblePages[0].regions[0].surface,/块内浅蓝/);
  for(const mutate of [b=>delete b.production,b=>b.kind='unknown']) {
    const invalid=structuredClone(bound);mutate(invalid.pages[0].groups[0].blocks[0]);
    assert.equal(validateSemanticPlan(base(),invalid).accepted,false);
  }
  const nested=structuredClone(bound);
  Object.assign(nested.pages[0].groups[0],{kind:'flow',expression:'整体流程',relationship:'先后',production:'顺序组织'});
  assert.equal(validateSemanticPlan(base(),nested).accepted,false);
});

test('semantic plan requires grounded internal relations before layout',()=>{
  assert.equal(validateSemanticPlan(base(),architecture()).accepted,true);
  for (const mutate of [p=>p.pages[0].pagePurpose='',p=>p.pages[0].relations.pop(),p=>p.pages[0].relations[1].to='missing',p=>p.pages[0].groups[0].blocks[1].sourceIds=['unknown'],p=>p.pages[0].readingOrder=['a']]) {
    const p=architecture();mutate(p);assert.equal(validateSemanticPlan(base(),p).accepted,false);
  }
});
test('geometry cannot rewrite content, reorder or silently drop groups',()=>{
  const p=architecture(),snapshot=structuredClone(p);
  const bound=bindSemanticLayout(p,layout());
  assert.deepEqual(p,snapshot);
  assert.equal(bound.pages[0].items[0].semanticRole,'implementation_plan');
  for (const mutate of [l=>l.pages[0].text='改写',l=>l.pages[0].regions[0].text='改写',l=>l.pages[0].regions[0].itemId='c',l=>l.pages[0].regions=[]]) {
    const l=layout();mutate(l);assert.throws(()=>bindSemanticLayout(p,l));
  }
  assert.throws(()=>bindSemanticLayout(p,{needsReplan:true,reason:'面积不够'}),/重新组织/);
});
test('nested copy measures each label/body and preserves condition in rendering data',()=>{
  const plan=bindSemanticLayout(architecture(),layout());
  const item=plan.pages[0].items[0],body=grayBodyLayout(item,568,22);
  assert.equal(body.runs.length,4);
  assert.deepEqual(body.runs.map(r=>r.bold),[true,false,true,false]);
  assert.equal(body.runs.map(r=>r.text).join('').replace(/\s/gu,''),grayDisplayBlocks(item).map(r=>r.text).join('').replace(/\s/gu,''));
  assert.ok(body.runs.map(r=>r.text).join('').includes('核验与开放')&&body.runs.map(r=>r.text).join('').includes('不合格则暂停'));
  assert.equal(validateGrayPlan(base(),plan,{width:600,height:350}).accepted,true);
  plan.pages[0].composition.regions[0].height=150;
  assert.ok(validateGrayPlan(base(),plan,{width:600,height:350}).issues.some(i=>i.code==='text-capacity'));
  item.text='篡改';
  assert.equal(validateGrayPlan(base(),plan,{width:600,height:350}).accepted,false);
});

test('semantic rejection stops before any geometry or PPT call and preserves evidence',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'gray-semantic-gate-'));
  try {
    const source=path.join(dir,'source.txt'),output=path.join(dir,'run');
    await fs.writeFile(source,'模拟内容。建议先核验再开放，不合格则暂停。');
    let calls=0;
    const provider={identity:'test',complete:async({messages})=>{
      calls++;
      assert.doesNotMatch(messages[0].content,/你是灰稿区域排版者/);
      assert.doesNotMatch(JSON.stringify(messages),/BACKSTAGE_CASE_NAME/);
      return {content:JSON.stringify(calls===1?architecture():{accepted:false,issues:[{pageId:'p1',problem:'条件失去归属',requiredRevision:'关联对应动作'}]}),finishReason:'stop'};
    }};
    await assert.rejects(runGrayDraft({source,output,area:{width:600,height:350,label:'BACKSTAGE_CASE_NAME'},provider,maxRevisions:0}),/预算耗尽/);
    assert.equal(calls,2);
    const state=JSON.parse(await fs.readFile(path.join(output,'state.json'),'utf8'));
    assert.equal(state.grayDraft.status,'blocked');
    assert.equal(state.grayDraft.history[0].semantic,false);
    assert.equal(JSON.parse(await fs.readFile(path.join(output,'revision-0','semantic-plan.json'),'utf8')).pages[0].pageId,'p1');
    await assert.rejects(fs.access(path.join(output,'gray-draft.pptx')));
    let resumedCalls=0;
    const feedback='模拟声明不能成为主要对象';
    const resumedProvider={identity:'test',complete:async({messages})=>{
      resumedCalls++;
      if(resumedCalls===1) {
        assert.match(messages.at(-1).content,/模拟声明不能成为主要对象/);
        assert.equal(messages.at(-2).role,'user'); // preceding history check, not the new feedback
        return {content:JSON.stringify(architecture()),finishReason:'stop'};
      }
      assert.equal(JSON.parse(messages.at(-1).content).reviewFeedback,feedback);
      const input=JSON.parse(messages.at(-1).content);
      assert.equal(input.plan,undefined);
      assert.equal(input.visiblePages[0].regions[0].body[3].text,'不合格则暂停。');
      assert.equal(input.requirements[0].groups[0].role,'implementation_plan');
      return {content:JSON.stringify({accepted:false,issues:[{problem:'未解决反馈'}]}),finishReason:'stop'};
    }};
    await assert.rejects(runGrayDraft({source,output,area:{width:600,height:350},provider:resumedProvider,maxRevisions:0,resume:true,feedback}),/预算耗尽/);
    assert.equal(resumedCalls,2);
  } finally {
    assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith('gray-semantic-gate-'));
    await fs.rm(dir,{recursive:true,force:true});
  }
});

test('visible review cannot use backstage narrative, roles or notes as displayed evidence',()=>{
  const p=architecture();
  p.planningNotes='伪造修复承诺';p.pages[0].planningNotes='只有后台的限定';
  p.pages[0].narrative='只有后台的并行安排';
  p.pages[0].groups[0].role='只有后台的角色';
  const snapshot=structuredClone(p),input=semanticReviewInput({source:'原稿',area:{width:600,height:350},plan:p});
  assert.deepEqual(p,snapshot);
  assert.doesNotMatch(JSON.stringify(input.visiblePages),/只有后台|伪造修复|sourceIds|pagePurpose|planningNotes/);
  assert.match(JSON.stringify(input.requirements),/只有后台的并行安排/);
  assert.doesNotMatch(JSON.stringify(input),/伪造修复承诺|只有后台的限定/);
  p.pages[0].groups[0].blocks[1].text='允许直接开放。';
  const changed=semanticReviewInput({source:'原稿',area:{width:600,height:350},plan:p});
  assert.deepEqual(changed.requirements,input.requirements);
  assert.notDeepEqual(changed.visiblePages,input.visiblePages);
});

test('review display and measured renderer share actual copy and hierarchy for every medium',()=>{
  for (const kind of ['text','diagram','flow','chart','table','image']) {
    const p=architecture();Object.assign(p.pages[0].groups[0],{
      kind,expression:'说明进入条件',relationship:'核验通过后开放，不合格暂停',production:'条件附着于开放动作',
    });
    const item=semanticPages(p)[0].items[0];
    const input=semanticReviewInput({source:'原稿',area:{width:600,height:350},plan:p});
    const displayed=input.visiblePages[0].regions[0].body;
    const measured=grayBodyLayout(item,568,22).runs;
    assert.deepEqual(displayed,grayDisplayBlocks(item));
    assert.deepEqual(measured.map(r=>r.bold),displayed.map(r=>r.bold));
    assert.equal(measured.map(r=>r.text).join('').replace(/\s/gu,''),displayed.map(r=>r.text).join('').replace(/\s/gu,''));
    // 结构草图（diagram/flow/table）上屏的是实际文案；chart/image 仍是蓝区制作说明（紧凑格式）。
    const sketch=['diagram','flow','table'].includes(kind);
    if(kind==='text'||sketch) assert.doesNotMatch(JSON.stringify(displayed),/本条建议画|节点短语/);
    else {
      const lead=kind==='chart'?'本条建议画数据图':'本条建议配图';
      assert.match(JSON.stringify(displayed),new RegExp(`${lead}：说明进入条件；要点（摘引）：[\\s\\S]*。`));
    }
    if(sketch) assert.match(input.visiblePages[0].regions[0].surface,/结构草图/);
  }
});

test('expression binding joins related content and keeps the default copy without losing its origin',()=>{
  const p=architecture();p.schemaVersion='gray-plan-3';delete p.pages[0].relations;
  const group=p.pages[0].groups[0];
  p.pages[0].groups=[{...group,blocks:[group.blocks[0]]},{...group,id:'g2',role:'保留开放限制',importance:'supporting',heading:'限制',blocks:[group.blocks[1]]}];
  const snapshot=structuredClone(p);
  const select={pages:[{pageId:'p1',expressions:[{groupIds:['g1','g2'],heading:'条件与行动',kind:'diagram',expression:'明确条件对应的行动',relationship:'通过开放，未通过暂停',production:'条件紧邻对应行动'}]}]};
  const bound=bindGrayExpressions(p,select);
  assert.deepEqual(p,snapshot);
  assert.equal(bound.pages[0].groups.length,1);
  assert.deepEqual(bound.pages[0].groups[0].blocks,snapshot.pages[0].groups.flatMap(g=>g.blocks.map(b=>({...b,id:`${g.id}/${b.id}`}))));
  assert.equal(bound.pages[0].groups[0].role,'implementation_plan；保留开放限制');
  assert.equal(bound.pages[0].claim,p.pages[0].claim);
  assert.equal(validateSemanticPlan(base(),bound).accepted,true);
  for(const mutate of [s=>s.pages[0].expressions[0].groupIds.pop(),s=>s.pages[0].expressions[0].groupIds.push('g1'),s=>s.pages[0].expressions[0].groupIds[1]='missing',s=>s.pages[0].expressions[0].text='替换正文',s=>s.pages[0].expressions[0].role='替换角色',s=>s.pages[0].pageId='p2',s=>s.pages[0].expressions[0].relationship='']) {
    const bad=structuredClone(select);mutate(bad);assert.throws(()=>bindGrayExpressions(p,bad));
  }
  p.pages[0].relations=[{from:'g2',to:'g1',type:'condition',meaning:'限制开放'}];
  assert.throws(()=>bindGrayExpressions(p,select),/端点/);
});

test('expression-aware copy may condense source wording while keeping conditions and cited scope',()=>{
  const p=architecture();p.schemaVersion='gray-plan-3';delete p.pages[0].relations;
  const choice={pages:[{pageId:'p1',expressions:[{groupIds:['g1'],kind:'text',heading:'开放条件',blocks:[
    {id:'brief',text:'模拟：核验通过后开放；不合格则暂停。',sourceIds:['s1']},
  ]}]}]};
  const condensed=bindGrayExpressions(p,choice);
  assert.equal(condensed.pages[0].groups[0].blocks.length,1);
  assert.equal(condensed.pages[0].groups[0].blocks[0].text,choice.pages[0].expressions[0].blocks[0].text);
  assert.equal(validateSemanticPlan(base(),condensed).accepted,true);
  assert.equal(p.pages[0].groups[0].blocks.length,2);
  const bad=structuredClone(choice);bad.pages[0].expressions[0].blocks[0].sourceIds=['other-page'];
  assert.throws(()=>bindGrayExpressions(p,bad),/来源|越界/);
  bad.pages[0].expressions[0].blocks[0].sourceIds=['s1'];
  bad.pages[0].expressions[0].blocks[0].text='核验通过后 99 天开放。';
  assert.equal(validateSemanticPlan(base(),bindGrayExpressions(p,bad)).accepted,false);
});

test('simple plans scope block IDs to their group; explicit relation plans keep unambiguous endpoints',()=>{
  const p=architecture();p.schemaVersion='gray-plan-3';delete p.pages[0].relations;
  p.pages[0].groups.push({...structuredClone(p.pages[0].groups[0]),id:'g2'});
  p.pages[0].readingOrder=['g1','g2'];
  assert.equal(validateSemanticPlan(base(),p).accepted,true);
  p.pages[0].groups[0].blocks[1].id='a';
  assert.equal(validateSemanticPlan(base(),p).accepted,false);
});

test('runner commits expression choice before visible review, never geometry rewriting the content',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'gray-expression-gate-'));
  try {
    const source=path.join(dir,'source.txt'),output=path.join(dir,'run');
    await fs.writeFile(source,'模拟内容。建议先核验再开放，不合格则暂停。');
    const p=architecture();p.schemaVersion='gray-plan-3';delete p.pages[0].relations;
    let calls=0;
    const provider={identity:'test',complete:async({messages})=>{
      calls++;
      if(calls===1) return {content:JSON.stringify(p),finishReason:'stop'};
      if(calls===2) {
        assert.equal(JSON.parse(messages[1].content).plan.pages[0].groups[0].role,'implementation_plan');
        return {content:JSON.stringify({pages:[{pageId:'p1',expressions:[{groupIds:['g1'],heading:'开放条件',kind:'diagram',expression:'条件与行动',relationship:'通过才开放，未通过暂停',production:'分支对应动作'}]}]}),finishReason:'stop'};
      }
      assert.equal(calls,3);
      const input=JSON.parse(messages[1].content);
      assert.equal(input.visiblePages[0].regions[0].kind,'diagram');
      assert.match(input.visiblePages[0].regions[0].body[0].text,/核验与开放/);
      assert.equal(input.plan,undefined);
      return {content:JSON.stringify({accepted:false,issues:[{problem:'保留审阅退回'}]}),finishReason:'stop'};
    }};
    await assert.rejects(runGrayDraft({source,output,area:{width:600,height:350},provider,maxRevisions:0}),/预算耗尽/);
    assert.equal(calls,3);
    const read=async name=>JSON.parse(await fs.readFile(path.join(output,'revision-0',name),'utf8'));
    assert.equal((await read('content-plan.json')).pages[0].groups[0].kind,'text');
    assert.equal((await read('semantic-plan.json')).pages[0].groups[0].kind,'diagram');
    await assert.rejects(fs.access(path.join(output,'revision-0','layout-response-0.json')));
  } finally {
    assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith('gray-expression-gate-'));
    await fs.rm(dir,{recursive:true,force:true});
  }
});

test('replay validation cannot accept a disconnected condition or stripped v2 semantics',()=>{
  const plan=bindSemanticLayout(architecture(),layout());
  plan.pages[0].semantics.relations.pop();
  assert.equal(validateGrayPlan(base(),plan,{width:600,height:350}).accepted,false);
  delete plan.pages[0].semantics;
  assert.equal(validateGrayPlan({...base(),grayDraft:{version:'gray-draft-2'}},plan,{width:600,height:350}).accepted,false);
});

test('topic overflow returns to semantic planning without wasting geometry repairs',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'gray-topic-gate-'));
  try {
    const source=path.join(dir,'source.txt'),output=path.join(dir,'run');
    await fs.writeFile(source,'模拟内容。建议先核验再开放，不合格则暂停。');
    const p=architecture();p.pages[0].claim='核验通过后才能开放，异常需要暂停。'.repeat(20);
    let calls=0;
    const provider={identity:'test',complete:async()=>{
      calls++;
      if(calls>3) throw new Error('不应继续几何修订');
      return {content:JSON.stringify([p,{accepted:true,issues:[]},layout()][calls-1]),finishReason:'stop'};
    }};
    await assert.rejects(runGrayDraft({source,output,area:{width:600,height:350},provider,maxRevisions:0}),/预算耗尽/);
    assert.equal(calls,3);
    const report=JSON.parse(await fs.readFile(path.join(output,'revision-0','program-check.json'),'utf8'));
    assert.ok(report.issues.some(i=>i.code==='topic-overflow'));
  } finally {
    assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith('gray-topic-gate-'));
    await fs.rm(dir,{recursive:true,force:true});
  }
});
