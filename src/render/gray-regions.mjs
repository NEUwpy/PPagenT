import { grayBodyLayout } from '../runner/gray-draft.mjs';
import { addText, addBox, qaElementName } from '../asset-runtime/component-builders.mjs';
import { fitChineseTextToFrame } from './chinese-typography.mjs';

// Reuse the gray renderer's section solver so production notes and final
// structures occupy the same region. Geometry is never model-authored here.
export function grayRegionElements(content, plan, bodyFrame) {
  const sx = bodyFrame.width / plan.grayArea.width, sy = bodyFrame.height / plan.grayArea.height;
  const frame = (x,y,width,height) => ({left:bodyFrame.left+x*sx,top:bodyFrame.top+y*sy,width:width*sx,height:height*sy});
  const text = []; let componentFrame;
  for (const region of plan.grayRegions) {
    const item = content.items.find(i=>i.id===region.itemId)?.grayItem;
    if (!item) throw new Error(`Missing gray region owner ${region.itemId}`);
    text.push({itemId:item.id,value:item.heading, frame:frame(region.x+16,region.y+12,region.width-32,40), heading:true});
    const body = grayBodyLayout(item,region.width-32,region.fontSize,region.height-70);
    for (const [index,section] of body.sections.entries()) {
      const node = item.kind==='text' ? item.blocks[index] : item;
      const location = item.kind==='text' ? `${item.id}/${node.id ?? index}` : item.id;
      const target = frame(region.x+16+section.left,region.y+54+section.top,section.width,section.height);
      if (section.kind !== 'text') {
        if (location !== plan.structure.sourceLocation || componentFrame) throw new Error(`Unbound gray expression ${location}`);
        componentFrame = target;
      } else text.push({itemId:item.id,value:node.text ?? node.sourceText ?? '',frame:{...target,left:target.left+8,top:target.top+8,width:target.width-16,height:target.height-16}});
    }
  }
  if (!componentFrame) throw new Error('Missing gray expression frame');
  return {text,componentFrame};
}

export function renderGrayRegions(slide,content,plan,bodyFrame,typography,theme = {}) {
  const result = grayRegionElements(content,plan,bodyFrame);
  const treatment = theme.grayRegionTreatment ?? {
    heading: theme.layoutStyle === 'magazine' ? 'editorial-marker-line' : 'academic-group-bar',
    body: theme.layoutStyle === 'magazine' ? 'flat-text' : 'side-rule-text',
    surface: theme.layoutStyle === 'magazine' ? 'none' : 'local-group',
    bodyInset: 20,
    headingInset: theme.layoutStyle === 'magazine' ? 20 : 16,
  };
  const magazine = treatment.heading === 'editorial-marker-line';
  if (treatment.heading === 'academic-reference') {
    renderAcademicRegions(slide,result,plan,bodyFrame,typography,theme);
    addBox(slide,result.componentFrame,{name:qaElementName({parent:'composition-component',domains:['page-composition-zones']}),geometry:'rect',fill:'none',line:{fill:'none',width:0},shadow:'shadow-none'});
    return {componentFrame:result.componentFrame};
  }
  for (const [index,entry] of result.text.entries()) {
    const surface = entry.heading ? (theme.headingSurface ?? theme.surface ?? '#FFFFFF') : (theme.regionSurface ?? theme.surface ?? '#FFFFFF');
    if (!magazine) {
      addBox(slide,entry.frame,{name:`gray-region-surface-${index}`,geometry:'rect',fill:entry.heading || treatment.surface === 'local-group' ? surface : 'none',line:{fill:entry.heading ? (theme.line ?? '#D5DFEC') : 'none',width:entry.heading ? 1 : 0},shadow:'shadow-none'});
      if (!entry.heading && treatment.body === 'side-rule-text') addBox(slide,{left:entry.frame.left,top:entry.frame.top,width:3,height:entry.frame.height},{name:`gray-region-rule-${index}`,geometry:'rect',fill:theme.primaryColor ?? '#3361AE',line:{fill:'none',width:0},shadow:'shadow-none'});
    } else if (entry.heading) {
      addBox(slide,{left:entry.frame.left,top:entry.frame.top+entry.frame.height-3,width:entry.frame.width,height:2},{name:`gray-region-editorial-rule-${index}`,geometry:'rect',fill:theme.primaryColor ?? '#A35D4F',line:{fill:'none',width:0},shadow:'shadow-none'});
      addBox(slide,{left:entry.frame.left,top:entry.frame.top+5,width:10,height:10},{name:`gray-region-editorial-marker-${index}`,geometry:'ellipse',fill:theme.primaryColor ?? '#A35D4F',line:{fill:'none',width:0},shadow:'shadow-none'});
    }
    const role = entry.heading ? typography.composition?.rowTitle : typography.composition?.rowBody;
    const fit = fitChineseTextToFrame(entry.value,{...entry.frame,fontSizes:role?.fontSizes ?? (entry.heading?[24,22]:[18,16,14]),maxLines:role?.maxLines ?? (entry.heading?1:12),lineHeight:role?.lineHeight ?? 1.35});
    if (!fit.fits) throw new Error(`灰稿文字区无法容纳：${entry.value}`);
    const inset = entry.heading ? (treatment.headingInset ?? 16) : (treatment.bodyInset ?? 12);
    addText(slide,fit.text,{...entry.frame,left:entry.frame.left+inset,top:entry.frame.top+8,width:entry.frame.width-(inset+8),height:entry.frame.height-16},{name:`gray-region-text-${index}`,fontSize:fit.fontSize,typeface:entry.heading ? (theme.displayFont ?? typography.displayTypeface ?? typography.bodyTypeface) : typography.bodyTypeface,color:entry.heading ? (theme.primaryColor ?? theme.dark ?? '#303238') : (theme.body ?? theme.dark ?? '#303238'),bold:Boolean(entry.heading),verticalAlignment:'top',autoFit:'none'});
  }
  addBox(slide,result.componentFrame,{name:qaElementName({parent:'composition-component',domains:['page-composition-zones']}),geometry:'rect',fill:'none',line:{fill:'none',width:0},shadow:'shadow-none'});
  return {componentFrame:result.componentFrame};
}

// The visual director selects a treatment for each owned region. The compiler
// supplies Skin colors and native primitives, never page-specific coordinates.
function renderAcademicRegions(slide,result,plan,bodyFrame,typography,theme) {
  const sx=bodyFrame.width/plan.grayArea.width, sy=bodyFrame.height/plan.grayArea.height;
  for (const region of plan.grayRegions) {
    const visual=plan.regionVisuals?.find(v=>v.itemId===region.itemId) ?? {surface:'plain',headingEnglish:''};
    const f={left:bodyFrame.left+(region.x+16)*sx,top:bodyFrame.top+(region.y+28)*sy,width:(region.width-32)*sx,height:(region.height-36)*sy};
    if (visual.surface !== 'plain') addBox(slide,f,{
      name:`academic-region-${region.itemId}`,geometry:'roundRect',borderRadius:6,shadow:'shadow-none',
      fill:visual.surface==='dashed-gradient' ? {type:'gradient',gradientKind:'linear',angleDeg:90,stops:[{offset:0,color:'#FFFFFF'},{offset:100000,color:theme.regionGradientStart}]} : '#FFFFFF',
      line:{style:visual.surface==='dashed-gradient'?'dashed':'solid',fill:theme.regionOutline,width:1},
    });
    for (const [index,entry] of result.text.filter(t=>t.itemId===region.itemId).entries()) {
      const fontSizes=entry.heading?[24]:[22,20,18];
      const box={...entry.frame,left:entry.frame.left+16,width:entry.frame.width-32,top:entry.frame.top+(entry.heading?0:8),height:entry.frame.height-(entry.heading?0:16)};
      const fit=fitChineseTextToFrame(entry.value,{...box,fontSizes,maxLines:entry.heading?1:12,lineHeight:1.35});
      if(!fit.fits) throw new Error(`灰稿文字区无法容纳：${entry.value}`);
      if(entry.heading) {
        const titleWidth=Math.min(box.width,entry.value.length*fit.fontSize+12);
        const english=visual.headingEnglish.toUpperCase();
        const englishWidth=english ? Math.min(box.width-titleWidth-8,english.length*11+12) : 0;
        addBox(slide,{left:box.left-6,top:box.top,width:titleWidth+Math.max(0,englishWidth)+14,height:34},{geometry:'rect',borderRadius:0,fill:'#FFFFFF',line:{fill:'none',width:0},shadow:'shadow-none'});
        if(english && englishWidth>0) {
          const ebox={left:box.left+titleWidth+8,top:box.top+9,width:englishWidth,height:25};
          const ef=fitChineseTextToFrame(english,{...ebox,fontSizes:[18,16,14],maxLines:1,lineHeight:1.1});
          if(!ef.fits) throw new Error(`英文衬字过长，请缩短：${english}`);
          addText(slide,english,ebox,{name:`academic-English-${region.itemId}`,fontSize:ef.fontSize,typeface:'Georgia',color:theme.regionEnglish,autoFit:'none'});
        }
      }
      addText(slide,fit.text,box,{name:`academic-text-${region.itemId}-${index}`,fontSize:fit.fontSize,typeface:typography.bodyTypeface,color:entry.heading?theme.regionAccent:theme.body,bold:entry.heading,verticalAlignment:'top',autoFit:'none'});
    }
  }
}
