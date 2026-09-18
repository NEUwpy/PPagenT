import test from 'node:test';
import assert from 'node:assert/strict';
import { newRunState } from '../src/runner/state.mjs';
import { validateSemanticPlan } from '../src/runner/gray-semantics.mjs';
import { resolveGrayLayout } from '../src/runner/gray-layout.mjs';
import { grayBodyLayout, fitGrayText, validateGrayPlan } from '../src/runner/gray-draft.mjs';

const base=()=>newRunState('模拟：核验后开放，异常暂停。','fixture');
const plan=()=>({schemaVersion:'gray-plan-3',deckBrief:{title:'开放安排',audience:'管理员',objective:'理解条件'},pages:[{
  pageId:'p1',title:'开放安排',claim:'核验通过后开放',pagePurpose:'说明安排与例外',narrative:'异常处置附属于开放规则',
  groups:[{id:'a',role:'行动',heading:'开放安排',importance:'primary',kind:'text',blocks:[{id:'b1',text:'模拟：核验后开放。',sourceIds:['s1']}]},
    {id:'b',role:'条件',heading:'例外处置',importance:'supporting',kind:'text',blocks:[{id:'b2',text:'异常暂停。',sourceIds:['s1']}]}],
}]});
const metrics={measureBody:grayBodyLayout,fitText:fitGrayText};
const select=layout=>({pages:[{pageId:'p1',layout}]});
const area={width:1170,height:492};

test('simple content accepts necessary relations in prose without mandatory per-sentence edges',()=>{
  const p=plan();assert.equal(validateSemanticPlan(base(),p).accepted,true);
  p.pages[0].groups[1].blocks[0].sourceIds=['unknown'];
  assert.equal(validateSemanticPlan(base(),p).accepted,false);
});
test('row uses supplied weights and shared outer bounds while preserving copy',()=>{
  const p=plan(),snapshot=structuredClone(p);
  const result=resolveGrayLayout(p,select({type:'row',weights:[2,1]}),area,metrics);
  assert.deepEqual(p,snapshot);
  assert.deepEqual(result,resolveGrayLayout(p,select({type:'row',weights:[2,1]}),area,metrics));
  const [a,b]=result.plan.pages[0].composition.regions;
  assert.equal(a.width,2*b.width);assert.equal(b.x,a.width+24);
  assert.equal(a.height,b.height);assert.equal(a.y,b.y);assert.equal(a.y+a.height,b.y+b.height);
  assert.ok(a.height<area.height); // 内容稀疏：不拉到满高，空框不再自己声明"这里该有内容"
  assert.equal(validateGrayPlan(base(),result.plan,area).accepted,true);
  assert.equal(result.plan.pages[0].items[0].text,'模拟：核验后开放。');
});
test('column, grid and single use existing solver without inventing semantic relations',()=>{
  for (const layout of [{type:'column'},{type:'grid',columns:2}]) {
    const result=resolveGrayLayout(plan(),select(layout),area,metrics);
    assert.equal(validateGrayPlan(base(),result.plan,area).accepted,true);
    assert.deepEqual(result.plan.pages[0].semantics.relations,[]);
  }
  const p=plan();p.pages[0].groups.pop();
  assert.equal(resolveGrayLayout(p,select({type:'single'}),area,metrics).plan.pages[0].composition.regions.length,1);
});
test('sparse pages stop stretching groups; rich pages still fill the frame',()=>{
  const sparse=resolveGrayLayout(plan(),select({type:'row',weights:[2,1]}),area,metrics).plan.pages[0].composition.regions;
  assert.ok(sparse[0].height>=96 && sparse[0].height<area.height);
  const p=plan();
  p.pages[0].groups.forEach(g=>{g.blocks[0].text='重要条件必须保留，异常暂停并复核记录。'.repeat(6);});
  const rich=resolveGrayLayout(p,select({type:'row',weights:[2,1]}),area,metrics).plan.pages[0].composition.regions;
  assert.equal(rich[0].height,area.height);
});

test('selection cannot inject coordinates, skip groups or misuse structure names',()=>{
  for(const layout of [{type:'flow'},{type:'single'},{type:'row',x:0},{type:'row',weights:[1]},{type:'column',weights:[1,1]},{type:'grid',columns:3}]) {
    assert.throws(()=>resolveGrayLayout(plan(),select(layout),area,metrics));
  }
});
test('layouts 条目只接受 {pageId, layout}：多余字段（如 override）给出可操作报错',()=>{
  assert.throws(()=>resolveGrayLayout(plan(),{pages:[{pageId:'p1',layout:{type:'single'},override:{reason:'x'}}]},area,metrics),/override\.reason/);
});
test('capacity failure reports measured requirements, never shrinks or drops copy',()=>{
  const p=plan();p.pages[0].groups[0].blocks[0].text='重要条件必须保留。'.repeat(15);
  assert.throws(()=>resolveGrayLayout(p,select({type:'row'}),{width:600,height:240},metrics),error=>error.code==='COMPOSITION_RECOMPOSE_REQUIRED' && error.details.minimum.height>240);
  assert.equal(p.pages[0].groups[0].blocks[0].text,'重要条件必须保留。'.repeat(15));
});
test('nested layout expresses layered pages: a main row above a full-width note',()=>{
  const p=plan();
  p.pages[0].groups.push({id:'c',role:'收尾',heading:'收尾',importance:'supporting',kind:'text',blocks:[{id:'b3',text:'核验后开放。',sourceIds:['s1']}]});
  assert.equal(validateSemanticPlan(base(),p).accepted,true);
  const nested={type:'column',children:[{type:'row',weights:[2,1],children:[{groupId:'a'},{groupId:'b'}]},{groupId:'c'}]};
  const result=resolveGrayLayout(p,select(nested),area,metrics);
  const [a,b,c]=result.plan.pages[0].composition.regions;
  assert.equal(a.y,b.y);            // a、b 同排
  assert.equal(a.height,b.height);
  assert.equal(c.x,0);              // c 横贯下方
  assert.equal(c.width,area.width);
  assert.ok(c.y>a.y+a.height);
  assert.equal(a.width,2*b.width);  // 嵌套 row 的 weights 生效
  assert.equal(validateGrayPlan(base(),result.plan,area).accepted,true);
});
test('nested layout rejects missing, reordered or duplicated groups',()=>{
  const p=plan();
  p.pages[0].groups.push({id:'c',role:'收尾',heading:'收尾',importance:'supporting',kind:'text',blocks:[{id:'b3',text:'核验后开放。',sourceIds:['s1']}]});
  assert.throws(()=>resolveGrayLayout(p,select({type:'column',children:[{type:'row',children:[{groupId:'a'},{groupId:'b'}]}]}),area,metrics),/缺失：c/);
  assert.throws(()=>resolveGrayLayout(p,select({type:'row',children:[{groupId:'b'},{groupId:'a'},{groupId:'c'}]}),area,metrics),/按阅读顺序/);
  assert.throws(()=>resolveGrayLayout(p,select({type:'column',children:[{type:'row',children:[{groupId:'a'},{groupId:'b'}]},{groupId:'b'}]}),area,metrics),/重复：b/);
  assert.throws(()=>resolveGrayLayout(p,select({type:'column',children:[{type:'column',children:[{type:'column',children:[{type:'column',children:[{groupId:'a'},{groupId:'b'}]}]},{groupId:'c'}]}]}),area,metrics),/嵌套超过 3 层/);
});
test('non-text medium still requires four-part gray specification, not a structure invocation',()=>{
  const p=plan(),group=p.pages[0].groups[0];group.kind='flow';
  assert.equal(validateSemanticPlan(base(),p).accepted,false);
  Object.assign(group,{expression:'说明开放条件',relationship:'核验后开放，异常暂停',production:'区分前提与例外，不编造步骤'});
  assert.equal(validateSemanticPlan(base(),p).accepted,true);
  const result=resolveGrayLayout(p,select({type:'column'}),{width:1170,height:720},metrics);
  assert.equal(result.plan.pages[0].items[0].kind,'flow');
  assert.equal(validateGrayPlan(base(),result.plan,{width:1170,height:720}).accepted,true);
});

test('row separates aligned outer frames from the unequal text capacity of each branch',()=>{
  const p=plan();p.pages[0].groups[0].blocks[0].text='核验记录及必要条件。'.repeat(10);
  const result=resolveGrayLayout(p,select({type:'row',weights:[2,1]}),area,metrics);
  const [primary,note]=result.plan.pages[0].composition.regions;
  assert.equal(primary.y,note.y);
  assert.equal(primary.height,note.height);
  assert.ok(result.receipts[0].contentMinimums.a.minHeight>result.receipts[0].contentMinimums.b.minHeight);
  const body=grayBodyLayout(result.plan.pages[0].items[1],note.width-32,22,note.height-70);
  assert.ok(body.sections[0].height<=note.height-70);
  assert.equal(body.sections[0].height,body.minimumHeight); // 容器富余不拉满：条目按内容高度
  // 文字块内顶格排字（块顶 + 内边距）：内容少时不再悬在块中下部、看起来像说明。
  assert.equal(body.runs[0].y,8);
  assert.equal(validateGrayPlan(base(),result.plan,area).accepted,true);
});

test('block areas size to content and keep every text run inside its assigned block',()=>{
  const p=plan();
  p.pages[0].groups[0].blocks.push({id:'c',label:'复核',text:'确认核验记录。',sourceIds:['s1']});
  const result=resolveGrayLayout(p,select({type:'row'}),area,metrics);
  for(const region of result.plan.pages[0].composition.regions){
    const item=result.plan.pages[0].items.find(item=>item.id===region.itemId);
    const body=grayBodyLayout(item,region.width-32,22,region.height-70);
    assert.equal(body.sections[0].top,0);
    const spare=body.height-body.minimumHeight;
    if(spare>80){
      // 容器明显富余：条目按内容高度，间距被封顶，余额留在容器底部
      assert.ok(body.sections.at(-1).top+body.sections.at(-1).height<body.height);
      for(let i=1;i<body.sections.length;i++){const current=body.sections[i].top-(body.sections[i-1].top+body.sections[i-1].height);assert.ok(current>=12&&current<=60);}
    }else{
      assert.ok(Math.abs(body.sections.at(-1).top+body.sections.at(-1).height-body.height)<.001);
      for(let i=1;i<body.sections.length;i++) assert.ok(Math.abs(body.sections[i].top-body.sections[i-1].top-body.sections[i-1].height-12)<.001);
    }
    for(const run of body.runs) assert.ok(body.sections.some(section=>run.y>=section.top && run.y+run.height<=section.top+section.height));
  }
});

test('unequal branch counts and a local blue block preserve membership, copy and fixed type size',()=>{
  for(const counts of [[2,4],[3,2]]) {
    const p=plan();
    p.pages[0].groups.forEach((group,g)=>{
      group.blocks=Array.from({length:counts[g]},(_,i)=>({id:`b${i}`,label:['要点甲','要点乙','要点丙','要点丁'][i],text:'模拟：核验后开放，异常暂停。',sourceIds:['s1']}));
    });
    Object.assign(p.pages[0].groups[0].blocks[0],{kind:'flow',expression:'说明开放安排',relationship:'核验后开放，异常暂停',production:'条件附着于对应行动'});
    const snapshot=structuredClone(p);
    const result=resolveGrayLayout(p,select({type:'row',weights:[1,1]}),{width:1400,height:1000},metrics);
    assert.deepEqual(p,snapshot);
    assert.equal(result.plan.pages[0].items.length,2);
    assert.deepEqual(result.plan.pages[0].items.map(item=>item.blocks.length),counts);
    assert.deepEqual(result.plan.pages[0].items.map(item=>item.blocks),p.pages[0].groups.map(group=>group.blocks));
    assert.ok(result.plan.pages[0].composition.regions.every(region=>region.fontSize===22));
    assert.equal(validateGrayPlan(base(),result.plan,{width:1400,height:1000}).accepted,true);
    const first=result.plan.pages[0].items[0],region=result.plan.pages[0].composition.regions[0];
    const body=grayBodyLayout(first,region.width-32,22);
    assert.equal(body.runs.filter(run=>run.kind==='flow').length,1);
    assert.ok(body.height+70<=region.height);
  }
});
