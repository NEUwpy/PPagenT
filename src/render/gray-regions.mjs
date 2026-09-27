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
    text.push({value:item.heading, frame:frame(region.x+16,region.y+12,region.width-32,40), heading:true});
    const body = grayBodyLayout(item,region.width-32,region.fontSize,region.height-70);
    for (const [index,section] of body.sections.entries()) {
      const node = item.kind==='text' ? item.blocks[index] : item;
      const location = item.kind==='text' ? `${item.id}/${node.id ?? index}` : item.id;
      const target = frame(region.x+16+section.left,region.y+54+section.top,section.width,section.height);
      if (section.kind !== 'text') {
        if (location !== plan.structure.sourceLocation || componentFrame) throw new Error(`Unbound gray expression ${location}`);
        componentFrame = target;
      } else text.push({value:node.text ?? node.sourceText ?? '',frame:{...target,left:target.left+8,top:target.top+8,width:target.width-16,height:target.height-16}});
    }
  }
  if (!componentFrame) throw new Error('Missing gray expression frame');
  return {text,componentFrame};
}

export function renderGrayRegions(slide,content,plan,bodyFrame,typography,theme = {}) {
  const result = grayRegionElements(content,plan,bodyFrame);
  for (const [index,entry] of result.text.entries()) {
    const surface = entry.heading ? (theme.headingSurface ?? theme.surface ?? '#FFFFFF') : (theme.regionSurface ?? theme.surface ?? '#FFFFFF');
    addBox(slide,entry.frame,{name:`gray-region-surface-${index}`,geometry:'roundRect',fill:surface,line:{fill:theme.line ?? '#D5DFEC',width:1},shadow:'shadow-none'});
    const role = entry.heading ? typography.composition?.rowTitle : typography.composition?.rowBody;
    const fit = fitChineseTextToFrame(entry.value,{...entry.frame,fontSizes:role?.fontSizes ?? (entry.heading?[24,22]:[18,16,14]),maxLines:role?.maxLines ?? (entry.heading?1:12),lineHeight:role?.lineHeight ?? 1.35});
    if (!fit.fits) throw new Error(`灰稿文字区无法容纳：${entry.value}`);
    addText(slide,fit.text,{...entry.frame,left:entry.frame.left+12,top:entry.frame.top+8,width:entry.frame.width-24,height:entry.frame.height-16},{name:`gray-region-text-${index}`,fontSize:fit.fontSize,typeface:entry.heading ? (theme.displayFont ?? typography.displayTypeface ?? typography.bodyTypeface) : typography.bodyTypeface,color:entry.heading ? (theme.primaryColor ?? theme.dark ?? '#303238') : (theme.body ?? theme.dark ?? '#303238'),bold:Boolean(entry.heading),verticalAlignment:'top',autoFit:'none'});
  }
  addBox(slide,result.componentFrame,{name:qaElementName({parent:'composition-component',domains:['page-composition-zones']}),geometry:'rect',fill:'none',line:{fill:'none',width:0},shadow:'shadow-none'});
  return {componentFrame:result.componentFrame};
}
