import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {listStructureSkins} from '../src/runtime/skins/structure-skin-registry.mjs';
import {loadStructureSkill} from '../src/runtime/structure-skills.mjs';
import {resolveStructureSizeFrame,loadPreservedComponent} from '../src/runtime/preserved-structure-build.mjs';
import {resolveHtmlComponent,closeHtmlComponentRuntime} from '../src/visual-runtime/html-component-runtime.mjs';
const root=path.resolve(import.meta.dirname,'..');

test('Noto multiline ink fits tight natural line boxes, while clipped text still fails',async()=>{
  const fixture=(height,text='协同过程\n更清晰')=>({
    id:'font-ink-capacity', designFrame:{width:220,height:120}, cssText:'*{box-sizing:border-box}',
    renderMarkup:()=>`<section data-ppt-root data-ppt-preserve-font="true" style="width:220px;height:120px">
      <div data-ppt-kind="text" data-ppt-name="label" data-slot-max-lines="2"
        style="width:190px;height:${height};overflow:hidden;font:700 21px/1.13 'Noto Sans SC';white-space:pre-line">${text}</div></section>`,
  });
  try{
    const tree=await resolveHtmlComponent({component:fixture('auto'),parameters:{},assetDir:root});
    assert.equal(tree.nodes.find(n=>n.name==='label').text,'协同过程\n更清晰');
    assert.equal(tree.nodes.find(n=>n.name==='label').style.fontSizePt,15.75);
    await assert.rejects(resolveHtmlComponent({component:fixture('20px'),parameters:{},assetDir:root}),/无法.*容纳文字/);
    await assert.rejects(resolveHtmlComponent({component:fixture('auto','第一行\n第二行\n第三行'),parameters:{},assetDir:root}),/无法.*容纳文字/);
    const clippedFlow={...fixture('auto'),renderMarkup:()=>`<section data-ppt-root data-ppt-preserve-font="true" style="width:220px;height:120px">
      <div data-ppagent-text-flow data-text-flow-composition="body-only" style="width:190px;height:100px">
        <div data-text-flow-part="body" data-ppt-kind="text" style="width:190px;height:20px;overflow:hidden;font:16px/1.2 'Noto Sans SC';white-space:pre-line">第一行\n第二行</div>
      </div></section>`};
    await assert.rejects(resolveHtmlComponent({component:clippedFlow,parameters:{},assetDir:root}),/文字容器无法/);
  }finally{await closeHtmlComponentRuntime();}
});

test('problem solution result keeps both Skin fonts and complete text at all three sizes',async()=>{
  const ref=await loadStructureSkill('problem-solution-outcome-001',root);
  const module=await import(pathToFileURL(path.join(ref.assetDir,ref.guide.exampleImplementation)).href);
  const skins=(await listStructureSkins(root)).filter(s=>['university','neutral'].includes(s.id));
  try{
    for(const skin of skins) for(const size of ['large','medium','small']){
      const selection=Object.fromEntries(ref.runtime.review.controls.map(c=>[c.key,c.default]));
      const content=module.resolvePreviewParameters(structuredClone(module.previewParameters),selection);
      const frame=await resolveStructureSizeFrame(ref,size,content,skin.theme);
      const component=await loadPreservedComponent(ref,frame,skin.theme,content);
      const tree=await resolveHtmlComponent({component,parameters:content,assetDir:ref.assetDir,theme:skin.theme});
      const title=tree.nodes.find(n=>n.name==='outcome-title');
      assert.equal(title.text.replace(/\s/g,''),content.outcome.title);
      assert.ok(JSON.stringify(title).includes(skin.id==='neutral'?'Noto Sans SC':'Microsoft YaHei'));
      assert.ok(title.style.fontSizePt>=12);
    }
  }finally{await closeHtmlComponentRuntime();}
});

test('list factors and vertical phase labels retain their painted text across sizes',async()=>{
  const skins=(await listStructureSkins(root)).filter(s=>['university','neutral'].includes(s.id));
  try{
    for(const id of ['causal-fishbone-attribution-001','convergence-funnel-001']){
      const ref=await loadStructureSkill(id,root);
      const module=await import(pathToFileURL(path.join(ref.assetDir,ref.guide.exampleImplementation)).href);
      const selection=Object.fromEntries(ref.runtime.review.controls.map(c=>[c.key,c.default]));
      const content=module.resolvePreviewParameters(structuredClone(module.previewParameters),selection);
      for(const skin of skins) for(const size of ['large','medium','small']){
        const frame=await resolveStructureSizeFrame(ref,size,content,skin.theme);
        const component=await loadPreservedComponent(ref,frame,skin.theme,content);
        const tree=await resolveHtmlComponent({component,parameters:content,assetDir:ref.assetDir,theme:skin.theme});
        assert.ok(tree.nodes.some(n=>n.name===('causal-fishbone-attribution-001'===id?'cause-body-0':'phase-label-0')));
      }
    }
  }finally{await closeHtmlComponentRuntime();}
});

test('small staged funnel keeps phase and action titles while omitting optional notes',async()=>{
  const ref=await loadStructureSkill('convergence-funnel-001',root);
  const module=await import(pathToFileURL(path.join(ref.assetDir,ref.guide.exampleImplementation)).href);
  const skins=(await listStructureSkins(root)).filter(s=>['university','neutral'].includes(s.id));
  try{
    for(const skin of skins) for(const size of ['large','medium','small']){
      const content=module.resolvePreviewParameters(structuredClone(module.previewParameters),{stepCount:4,phaseCount:3,inputCount:5});
      const frame=await resolveStructureSizeFrame(ref,size,content,skin.theme);
      const component=await loadPreservedComponent(ref,frame,skin.theme,content);
      const tree=await resolveHtmlComponent({component,parameters:content,assetDir:ref.assetDir,theme:skin.theme});
      const names=new Set(tree.nodes.map(n=>n.name));
      for(const name of ['phase-label-0','phase-title-0','funnel-step-title-0','action-title-0-0']) assert.ok(names.has(name),`${size} ${skin.id}: missing ${name}`);
      for(const name of ['phase-body-0','action-body-0-0']) assert.equal(names.has(name),size!=='small',`${size} ${skin.id}: ${name}`);
    }
    const skin=skins.find(s=>s.id==='neutral');
    const noInput=module.resolvePreviewParameters(structuredClone(module.previewParameters),{stepCount:4,phaseCount:3,inputCount:0});
    const frame=await resolveStructureSizeFrame(ref,'small',noInput,skin.theme);
    const component=await loadPreservedComponent(ref,frame,skin.theme,noInput);
    const tree=await resolveHtmlComponent({component,parameters:noInput,assetDir:ref.assetDir,theme:skin.theme});
    assert.ok(tree.nodes.some(n=>n.name==='phase-content-body-0'));
  }finally{await closeHtmlComponentRuntime();}
});

test('phase gates keep three and five stage small variants within their text regions',async()=>{
  const ref=await loadStructureSkill('sequence-phase-gates-004',root);
  const module=await import(pathToFileURL(path.join(ref.assetDir,ref.guide.exampleImplementation)).href);
  const skins=(await listStructureSkins(root)).filter(s=>['university','neutral'].includes(s.id));
  try{
    for(const count of [3,5]) for(const skin of skins){
      const content=module.resolvePreviewParameters(structuredClone(module.previewParameters),{phaseCount:count});
      const frame=await resolveStructureSizeFrame(ref,'small',content,skin.theme);
      const component=await loadPreservedComponent(ref,frame,skin.theme,content);
      const tree=await resolveHtmlComponent({component,parameters:content,assetDir:ref.assetDir,theme:skin.theme});
      assert.equal(tree.nodes.filter(n=>/^phase-\d+-index$/.test(n.name)).length,count);
      assert.equal(tree.nodes.filter(n=>/^gate-\d+-tag$/.test(n.name)).length,count-1);
    }
  }finally{await closeHtmlComponentRuntime();}
});

test('compact matrix axis labels and growth endpoint leave adjacent text clear',async()=>{
  const skins=(await listStructureSkins(root)).filter(s=>['university','neutral'].includes(s.id));
  const cases=[
    {id:'matrix-quadrant-priority-001',selection:{itemsPerQuadrant:2},pairs:[['axis-x-low','matrix-detail-title-2'],['axis-x-high','matrix-detail-title-3']]},
    {id:'progression-growth-curve-004',selection:{pointCount:5},pairs:[['p5-text-body','mountain-milestone-5']]},
  ];
  const overlap=(a,b)=>Math.max(0,Math.min(a.left+a.width,b.left+b.width)-Math.max(a.left,b.left))
    *Math.max(0,Math.min(a.top+a.height,b.top+b.height)-Math.max(a.top,b.top));
  try{
    for(const {id,selection,pairs} of cases){
      const ref=await loadStructureSkill(id,root);
      const module=await import(pathToFileURL(path.join(ref.assetDir,ref.guide.exampleImplementation)).href);
      const content=module.resolvePreviewParameters(structuredClone(module.previewParameters),selection);
      for(const skin of skins) for(const size of ['medium','small']){
        const frame=await resolveStructureSizeFrame(ref,size,content,skin.theme);
        const component=await loadPreservedComponent(ref,frame,skin.theme,content);
        const tree=await resolveHtmlComponent({component,parameters:content,assetDir:ref.assetDir,theme:skin.theme});
        for(const [first,second] of pairs){
          const a=tree.nodes.find(n=>n.name===first);
          const b=tree.nodes.find(n=>n.name===second);
          assert.ok(a&&b,`${id} ${size} ${skin.id}: missing ${first} or ${second}`);
          assert.ok(overlap(a.frame,b.frame)<1,`${id} ${size} ${skin.id}: ${first} overlaps ${second}`);
        }
      }
    }
  }finally{await closeHtmlComponentRuntime();}
});
