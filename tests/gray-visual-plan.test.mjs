import test from 'node:test';
import assert from 'node:assert/strict';
import {validateGrayRegionPlan} from '../src/runner/gray-expressions.mjs';
import {renderGrayVisualPlan,grayVisualTokens,grayTextSources} from '../src/render/gray-visual-plan.mjs';
import {northeasternUniversityTheme} from '../src/runtime/skins/northeastern-university-theme.mjs';
import {neutralEditorialTheme} from '../src/runtime/skins/neutral-editorial-theme.mjs';

const f=(x,y,width,height)=>({x,y,width,height});
const box=(frame)=>({frame,fontRole:'body',fontSize:20,colorRole:'ink'});
function fixture() {
 const page={items:[{id:'a',kind:'diagram',heading:'对应关系',text:'甲到乙'},
 {id:'b',kind:'text',heading:'核对',blocks:[{id:'b1',text:'原文必须保留。'}]}],grayComposition:{regions:[
 {itemId:'a',x:0,y:0,width:1170,height:290},{itemId:'b',x:0,y:315,width:1170,height:177}]}};
 const plan={compositionId:'component-gray-regions',textSlots:[],structure:{sourceItemIds:['a'],sourceLocation:'a'},
 grayRegions:page.grayComposition.regions,grayArea:{width:1170,height:492},regionVisuals:[
 {itemId:'a',reason:'上部关系',layout:{heading:box(f(.02,0,.6,.16)),blocks:[],structureFrame:f(.02,.2,.96,.7),decorations:[]}},
 {itemId:'b',reason:'下部实文',layout:{heading:box(f(.02,0,.4,.22)),blocks:[{sourceLocation:'b/b1',...box(f(.02,.3,.92,.5))}],decorations:[]}},
 ]};return {page,plan};
}
test('model layout preserves all source blocks and rejects ownership, overlap and boundary violations',()=>{
 const {page,plan}=fixture();assert.doesNotThrow(()=>validateGrayRegionPlan(page,plan));
 for(const [change,pattern] of [
 [p=>p.regionVisuals[1].layout.blocks=[],/逐块保留/],
 [p=>p.regionVisuals[1].layout.blocks[0].sourceLocation='a/b1',/逐块保留/],
 [p=>p.regionVisuals[0].layout.structureFrame=f(0,.1,1,.8),/重叠/],
 [p=>p.regionVisuals[1].layout.heading.frame=f(.9,0,.4,.1),/越过/],
 [p=>p.regionVisuals[1].layout.frame=f(0,0,1,.5),/互相侵占/],
 ]) {const p=structuredClone(plan);change(p);assert.throws(()=>validateGrayRegionPlan(page,p),pattern);}
});
function capture() {
 const shapes=[];return {shapes,slide:{shapes:{add(config){const s={...config,_text:{style:{}}};Object.defineProperty(s,'text',{get(){return this._text;},set(v){this._text.value=v;}});shapes.push(s);return s;}}}};
}
test('model positions, type, alignment and gradient stroke reach native shapes; content is source-bound',()=>{
 const {page,plan}=fixture();
 plan.regionVisuals[0].layout.heading={...box(f(.2,0,.6,.18)),fontRole:'heading',fontSize:28,colorRole:'accent',align:'center',lineHeight:1.1};
 plan.regionVisuals[0].layout.decorations=[{frame:f(0,.05,1,.9),geometry:'rect',fill:{kind:'none'},line:{width:1,dash:'dashed',fill:{kind:'linear',colorRole:'outline',endColorRole:'primary',angleDeg:90}}}];
 const c=capture();const result=renderGrayVisualPlan(c.slide,{items:page.items.map(i=>({id:i.id,grayItem:i}))},plan,{left:55,top:166,width:1170,height:492},{bodyTypeface:'Microsoft YaHei'},northeasternUniversityTheme);
 const heading=c.shapes.find(s=>s.name==='region-a-heading');
 assert.equal(heading.position.left,289);assert.equal(heading.text.style.typeface,'汉仪粗宋简');assert.equal(heading.text.style.fontSize,28);assert.equal(heading.text.style.alignment,'center');
 assert.equal(c.shapes[0].fill,'none');assert.equal(c.shapes[0].line.fill.type,'gradient');
 assert.equal(c.shapes.find(s=>s.name==='region-b-body-0').text.value,'原文必须保留。');
 assert.equal(result.componentFrame.top,224);
});
test('Skin roles stay Skin-specific and insufficient frames fail instead of silently shrinking',()=>{
 assert.notEqual(grayVisualTokens(northeasternUniversityTheme).colors.accent,grayVisualTokens(neutralEditorialTheme).colors.accent);
 const {page,plan}=fixture();plan.regionVisuals[1].layout.blocks[0].frame=f(0,.3,.02,.1);
 assert.throws(()=>renderGrayVisualPlan(capture().slide,{items:page.items.map(i=>({id:i.id,grayItem:i}))},plan,{left:0,top:0,width:1170,height:492},{},northeasternUniversityTheme),/空间不足/);
});

test('shared title pair fixes English offset and leaves a native border gap without masking blocks',()=>{
 const {page,plan}=fixture();const l=plan.regionVisuals[0].layout;
 l.titlePair='skin-overlap';l.heading={...box(f(.02,0,.6,.16)),fontRole:'heading'};
 l.english={...box(f(.4,0,.5,.16)),fontRole:'english',text:'relation'};
 l.decorations=[{frame:f(0,.05,1,.9),geometry:'rect',titleGap:true,fill:{kind:'solid',colorRole:'paper'},line:{width:1,dash:'dashed',fill:{kind:'solid',colorRole:'outline'}}}];
 const c=capture();renderGrayVisualPlan(c.slide,{items:page.items.map(i=>({id:i.id,grayItem:i}))},plan,{left:0,top:0,width:1170,height:492},{},northeasternUniversityTheme);
 const h=c.shapes.find(s=>s.name==='region-a-heading'),e=c.shapes.find(s=>s.name==='region-a-english');
 assert.equal(e.position.left,h.position.left);assert.equal(e.position.top-h.position.top,6);assert.equal(e.text.style.fontSize,h.text.style.fontSize);
 assert.equal(c.shapes.filter(s=>s.name?.startsWith('region-a-decoration')).length,6);
 assert.equal(c.shapes.filter(s=>s.name?.includes('-edge-')).length,5);
});

test('beauty source binding keeps labels and attached notes as visible text sources',()=>{
 const item={id:'t',kind:'text',heading:'条件',blocks:[
  {id:'b',label:'适用范围',text:'正文'},
  {id:'n',kind:'note',text:'共同限定'},
  {id:'d',kind:'diagram',text:'图示说明'},
 ]};
 assert.deepEqual(grayTextSources(item).map(x=>({location:x.sourceLocation,text:x.displayText,kind:x.kind})),[
  {location:'t/b',text:'适用范围\n正文',kind:'text'},
  {location:'t/n',text:'共同限定',kind:'note'},
 ]);
});

test('pure text with labels and notes validates and reaches native shapes without a structure frame',()=>{
 const {page,plan}=fixture();page.items=page.items.slice(1);page.grayComposition.regions=page.grayComposition.regions.slice(1);
 page.items[0].blocks=[{id:'b1',label:'适用范围',text:'原文必须保留。'},{id:'n',kind:'note',text:'限定条件不得丢失。'}];
 delete plan.structure;plan.grayRegions=page.grayComposition.regions;plan.regionVisuals=plan.regionVisuals.slice(1);
 plan.regionVisuals[0].layout.blocks=[{sourceLocation:'b/b1',...box(f(0,.28,.48,.7))},{sourceLocation:'b/n',...box(f(.52,.28,.48,.7))}];
 assert.doesNotThrow(()=>validateGrayRegionPlan(page,plan));
 const c=capture(),result=renderGrayVisualPlan(c.slide,{items:page.items.map(i=>({id:i.id,grayItem:i}))},plan,{left:0,top:0,width:1170,height:492},{},neutralEditorialTheme);
 assert.equal(result.componentFrame,undefined);
 assert(c.shapes.some(s=>s.name==='PPAGENT_QA|parent=gray-region-b|domains=gray-regions'));
 assert(c.shapes.some(s=>s.name.includes('within=gray-region-b')));
 assert.equal(c.shapes.find(s=>s.name==='region-b-body-0').text.value,'适用范围\n原文必须保留。');
 assert.equal(c.shapes.find(s=>s.name==='region-b-body-1').text.value,'限定条件不得丢失。');
});
