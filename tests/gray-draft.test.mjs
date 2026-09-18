import test from 'node:test';
import assert from 'node:assert/strict';
import { newRunState } from '../src/runner/state.mjs';
import { validateGrayArea, validateGrayPlan, regionBody, fitGrayText, runGrayDraft } from '../src/runner/gray-draft.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

const base = () => newRunState('模拟。先核验，再开放；不合格暂停。\n\n预算上限 10 万元。', 'source.md');
const plan = () => ({deckBrief:{title:'试点',audience:'负责人',objective:'验证'},pages:[{pageId:'p1',title:'试点',claim:'先核验再开放，异常暂停',relation:'sequence',items:[{id:'a',sourceIds:['s1'],heading:'开放条件',text:'模拟。先核验，再开放；不合格暂停。',kind:'text'},{id:'b',sourceIds:['s2'],heading:'预算边界',text:'预算上限 10 万元。',kind:'text'}],composition:{regions:[{itemId:'a',x:0,y:0,width:550,height:300,fontSize:22},{itemId:'b',x:580,y:0,width:550,height:300,fontSize:22}]}}]});
const area={width:1170,height:492};
test('retains source evidence while mapping actual text once',()=>{
 const report=validateGrayPlan(base(),plan(),area);assert.equal(report.accepted,true);assert.equal(report.state.pages[0].items[1].sourceText,'预算上限 10 万元。');
});
test('arbitrary area changes capacity; same geometry rejected in smaller area',()=>{
 assert.equal(validateGrayPlan(base(),plan(),{width:780,height:328}).accepted,false);
 assert.throws(()=>validateGrayArea({width:NaN,height:328}));
});
test('rejects dropped source, unrendered item, overlap and invented number',()=>{
 for(const mutate of [p=>p.pages[0].items.pop(),p=>p.pages[0].composition.regions.pop(),p=>p.pages[0].composition.regions[1].x=500,p=>p.pages[0].items[1].text='预算 99 万元。']) {
 const p=plan();mutate(p);assert.equal(validateGrayPlan(base(),p,area).accepted,false);
 }
});
test('blue regions include four specification fields in capacity',()=>{
 const p=plan();Object.assign(p.pages[0].items[0],{kind:'flow',expression:'说明顺序',relationship:'核验后开放',production:'明确异常回路'});
  assert.match(regionBody(p.pages[0].items[0]),/节点文案/);
 p.pages[0].items[0].production='很长的制作要求'.repeat(150);
 assert.ok(validateGrayPlan(base(),p,area).issues.some(i=>i.code==='text-capacity'));
});

test('rewrapping retains text and font instead of shrinking or dropping conditions',()=>{
 const text='系统能检查字段完整性，但样品是否适合仪器、培训是否有效等判断仍由管理员负责。若不明确责任，统一入口也可能只是把原来的混乱集中展示。';
 const fit=fitGrayText(text,568,250,24);
 assert.equal(fit.fits,true);assert.equal(fit.fontSize,24);
 assert.equal(fit.text.replace(/\s/gu,''),text.replace(/\s/gu,''));
 assert.equal(fitGrayText(text,568,20,24).fits,false);
});

test('resume mismatch preserves saved manuscript before any provider call',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'gray-resume-'));
 try {
  const source=path.join(dir,'new.md'),output=path.join(dir,'run');await fs.mkdir(output);
  await fs.writeFile(source,'不同原稿');await fs.writeFile(path.join(output,'source.md'),'旧原稿');
  const state=newRunState('旧原稿','old.md');state.grayDraft={sourceHash:createHash('sha256').update('旧原稿').digest('hex'),area:{width:780,height:328}};
  await fs.writeFile(path.join(output,'state.json'),JSON.stringify(state));
  await assert.rejects(runGrayDraft({source,output,area:{width:780,height:328},resume:true}),/不匹配/);
  assert.equal(await fs.readFile(path.join(output,'source.md'),'utf8'),'旧原稿');
 } finally {assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('gray-resume-'));await fs.rm(dir,{recursive:true,force:true});}
});
