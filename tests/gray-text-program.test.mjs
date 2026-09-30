import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import {semanticPages} from '../src/runner/gray-semantics.mjs';
import {resolveTextProgram,TEXT_PROGRAM} from '../src/render/gray-text-program.mjs';
import {validateGrayRegionPlan} from '../src/runner/gray-expressions.mjs';
import {regionVisualSchema} from '../src/render/gray-visual-plan.mjs';
import {renderGrayRegions} from '../src/render/gray-regions.mjs';
import {neutralEditorialTheme} from '../src/runtime/skins/neutral-editorial-theme.mjs';
import {plan as fixture} from '../experiments/visual-block-mapping-20260929/fixtures.mjs';

const area={width:1170,height:492};
function input(index=0){
 const page=semanticPages(fixture)[index];
 page.grayComposition={regions:[{itemId:page.items[0].id,x:0,y:0,width:area.width,height:area.height,fontSize:22}]};
 const plan={compositionId:'component-gray-regions',textSlots:[],regionVisuals:page.items.map(i=>({itemId:i.id,reason:'原文绑定',program:TEXT_PROGRAM}))};
 return {page,plan};
}
test('bounded program preserves horizontal/vertical mapping and shared bands without authored coordinates',()=>{
 for(const index of [0,1]) {
  const {page,plan}=input(index),copy=structuredClone(page);
  assert.doesNotThrow(()=>validateGrayRegionPlan(page,plan,area));
  const built=resolveTextProgram(page,plan,area);
  assert.deepEqual(built,resolveTextProgram(page,plan,area));
  const g=built.groups[0],mapping=page.items[0].visualMapping;
  const shared=mapping.blocks.find(b=>b.role==='shared');
  const section=g.body.sections.find(s=>s.visualBlockId===shared.id);
  assert.equal(section.width,area.width-32);
  if(index===0){
   const note=g.body.runs.find(r=>r.kind==='note');assert.equal(note.fontSize,16);assert.equal(note.visualBlockId,'advice-area');
   assert.equal(g.body.sections[0].top,g.body.sections[1].top);
  }else assert.equal(section.top,0);
  assert.deepEqual(page,copy);
 }
});

test('program rejects injected geometry, unsupported media, stale bindings and insufficient capacity',()=>{
 const {page,plan}=input();
 const accepts=new Ajv2020({strict:false}).compile(regionVisualSchema);
 assert(accepts(plan.regionVisuals[0]));
 assert(!accepts({...plan.regionVisuals[0],frame:{x:0,y:0,width:1,height:1}}));
 for(const [change,pattern] of [
  [(p,v)=>v.regionVisuals[0].layout={},/仅接受/],
  [(p,v)=>v.regionVisuals[0].program='invented',/仅接受/],
  [(p)=>p.items[0].blocks[0].kind='chart',/不支持图示/],
  [(p)=>p.items[0].visualMapping.blocks[0].blocks[0].text='悄悄改写',/绑定与原始/],
  [(p)=>p.grayComposition.regions[0].height=80,/容量不足/],
  [(p)=>p.grayComposition.regions[0].x=-1,/越界/],
 ]){const p=structuredClone(page),v=structuredClone(plan);change(p,v);assert.throws(()=>resolveTextProgram(p,v,area),pattern);}
});

test('multiple original groups remain separate, long copy fails, and scaling remeasures instead of clipping',()=>{
 const {page,plan}=input();
 delete page.semantics.visualMapping;delete page.items[0].visualMapping;
 page.items[0].blocks=page.items[0].blocks.slice(0,1);
 page.items.push({...structuredClone(page.items[0]),id:'other',heading:'另一职责'});
 page.grayComposition.regions=[{itemId:'service',x:0,y:0,width:573,height:492},{itemId:'other',x:597,y:0,width:573,height:492}];
 plan.regionVisuals=page.items.map(i=>({itemId:i.id,program:TEXT_PROGRAM,reason:'各自作用范围'}));
 const built=resolveTextProgram(page,plan,area);
 assert.deepEqual(built.groups.map(g=>g.frame.left),[0,597]);
 assert(built.groups.every(g=>g.fontSize===built.fontSize));
 const small=resolveTextProgram(page,plan,area,{left:55,top:166,width:1000,height:492});
 assert.equal(small.groups[0].frame.left,55);assert(small.groups[0].frame.width<573);
 page.items[0].blocks[0].text='必须完整保留的正文。'.repeat(150);
 assert.throws(()=>resolveTextProgram(page,plan,area),/容量不足/);
});

test('native renderer uses Skin roles and emits original label/body/note as measured native runs',()=>{
 const {page,plan}=input(),shapes=[];
 const slide={shapes:{add(config){const s={...config,_text:{style:{}}};Object.defineProperty(s,'text',{get(){return this._text;},set(v){this._text.value=v;}});shapes.push(s);return s;}}};
 renderGrayRegions(slide,{pageId:page.pageId,items:page.items.map(i=>({id:i.id,grayItem:i}))},
  {...plan,grayArea:area,grayRegions:page.grayComposition.regions,graySemantics:page.semantics},
  {left:55,top:166,...area},{bodyTypeface:'Noto Sans SC'},neutralEditorialTheme);
 const texts=shapes.filter(s=>s.text?.value);
 assert(texts.some(s=>s.text.value==='一 咨询'));
 assert(texts.some(s=>s.text.value==='咨询需要提前预约。'&&s.text.style.fontSize===16));
 assert(texts.some(s=>s.text.value==='两项服务均在工作日提供。'));
 assert(texts.every(s=>s.text.style.typeface));
 assert(shapes.some(s=>s.name.includes('parent=text-program-service')));
});
