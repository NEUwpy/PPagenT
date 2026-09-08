import {neutralPaint} from '../src/visual-runtime/neutral-structure-theme.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveHtmlComponent, closeHtmlComponentRuntime } from '../src/visual-runtime/html-component-runtime.mjs';
import { preservedComponent } from '../src/runtime/preserved-structure-build.mjs';
import { preservedTypography } from '../src/visual-runtime/preserved-design-layout.mjs';
const root=path.resolve(import.meta.dirname,'..');
const frame={left:0,top:0,width:1170,height:492};

test('three preserved builds keep original geometry and use bounded typography when shrinking',async()=>{
 try{
  for(const dir of ['双排折角便签-002','简明转化漏斗-001','成熟度阶梯-002']){
   const assetDir=path.join(root,'assets/结构图',dir);
   const m=await import(pathToFileURL(path.join(assetDir,'review.mjs')).href);
   const parameters=structuredClone(m.previewParameters);
   if(parameters.items)parameters.items=parameters.items.slice(0,4);
   if(parameters.steps){parameters.steps=parameters.steps.slice(0,4);parameters.inputs=parameters.inputs.slice(0,4);}
   if(parameters.levels)parameters.levels=parameters.levels.slice(0,4);
   const original=await resolveHtmlComponent({component:m.visualComponent,parameters,assetDir,targetFrame:frame});
   const same=await resolveHtmlComponent({component:preservedComponent(m.visualComponent,frame),parameters,assetDir,targetFrame:frame});
   const art=t=>t.nodes.filter(n=>!['text','shape-text'].includes(n.kind)).map(n=>({name:n.name,kind:n.kind,frame:n.frame,points:n.points,fill:n.fill}));
   assert.deepEqual(art(same),art(original),`${dir}: original art must remain identical`);
   const small={...frame,width:994.5,height:418.2};
   const adapted=await resolveHtmlComponent({component:preservedComponent(m.visualComponent,small),parameters,assetDir,targetFrame:small});
   for(const node of adapted.nodes.filter(n=>n.style?.fontSize)){
    const before=same.nodes.find(n=>n.name===node.name)?.style.fontSize;
    assert.ok(node.style.fontSize <= before + 0.05,`${dir}/${node.name}: never enlarge type when shrinking`);
    assert.ok(node.style.fontSize >= 16 - 0.05,`${dir}/${node.name}: keep 12 pt floor in CSS px`);
   }
  }
 }finally{await closeHtmlComponentRuntime();}
});

test('preserved text overflow is rejected and SVG opacity gradient uses native offset units',async()=>{
 const assetDir=path.join(root,'assets/结构图/简明转化漏斗-001');
 const m=await import(pathToFileURL(path.join(assetDir,'review.mjs')).href);
 try{
  const content={inputs:[],steps:[{title:'第一层'},{title:'第二层'},{title:'第三层'}]};
  const component=preservedComponent(m.visualComponent,frame);
  const tree=await resolveHtmlComponent({component,parameters:content,assetDir,targetFrame:frame});
  const fill=tree.nodes.find(n=>n.name==='simple-flow-arrow').fill;
  assert.deepEqual(fill.stops.map(s=>s.offset),[0,42000,76000,100000]);
  assert.equal(fill.angleDeg,90);
  assert.equal(fill.stops[0].color,'#D9EBFA/0');
  const tooLong={...content,steps:content.steps.map(s=>({title:s.title.repeat(40)}))};
  await assert.rejects(resolveHtmlComponent({component,parameters:tooLong,assetDir,targetFrame:frame}),/允许字号/);
 }finally{await closeHtmlComponentRuntime();}
});

test('size policy keeps approved tiers and obeys explicit Skin typography',()=>{
 const medium=preservedTypography(.85),small=preservedTypography(.7);
 assert.equal(medium.sizes.componentItemTitle,16);
 assert.equal(small.sizes.componentItemTitle,14);
 assert.equal(small.sizes.componentBody,12);
 assert.equal(small.sizes.componentMeta,12);
 assert.equal(preservedTypography(.7,{typography:{componentBody:17}}).sizes.componentBody,17);
 assert.equal(preservedTypography(.7,{typography:{componentBody:17},typographyTiers:{componentBody:[17,15]}}).sizes.componentBody,15);
 assert.equal(preservedTypography(.7,{typography:{componentMeta:15*.75}}).sizes.componentMeta,11.25);
 assert.throws(()=>preservedTypography(.7,{typographyTiers:{componentBody:[10]}}),/至少 12/);
});

test('neutral Skin preserves design-pixel typography and semantic surfaces in the actual renderer',async()=>{
 const assetDir=path.join(root,'assets/结构图/双排折角便签-002');
 const m=await import(pathToFileURL(path.join(assetDir,'review.mjs')).href);
 const theme={id:'neutral-editorial-001',font:'Noto Sans SC',fonts:{display:'Noto Serif SC',body:'Noto Sans SC'},primaryColor:'#A35D4F',background:'#F5F4EF',surface:'#EEECE5',dark:'#20201D',body:'#4B4A45',line:'#D8D5CC',muted:'#85837B',typography:{componentItemTitle:12.75,componentBody:12.75,componentMeta:11.25}};
 try{
  const tree=await resolveHtmlComponent({component:preservedComponent(m.visualComponent,frame,theme),parameters:{items:m.previewParameters.items.slice(0,4)},assetDir,theme,targetFrame:frame});
  const texts=tree.nodes.filter(n=>n.kind==='text');
  assert.ok(texts.length>=8);
  assert.ok(texts.every(n=>Math.abs(n.style.fontSize-17)<.05));
  const serialized=JSON.stringify(tree);
  assert.ok(serialized.includes(neutralPaint('#FFFFFF','surface',theme)));

  assert.ok(serialized.includes('Noto Serif SC'));
 }finally{await closeHtmlComponentRuntime();}
});
