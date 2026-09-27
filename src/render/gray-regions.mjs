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

export function renderGrayRegions(slide,content,plan,bodyFrame,typography) {
  const result = grayRegionElements(content,plan,bodyFrame);
  for (const [index,entry] of result.text.entries()) {
    const fit = fitChineseTextToFrame(entry.value,{...entry.frame,fontSizes:entry.heading?[24,22]:[22,20,18],maxLines:entry.heading?1:12,lineHeight:1.35});
    if (!fit.fits) throw new Error(`灰稿文字区无法容纳：${entry.value}`);
    addText(slide,fit.text,entry.frame,{name:`gray-region-text-${index}`,fontSize:fit.fontSize,typeface:typography.bodyTypeface,color:'#303238',bold:Boolean(entry.heading),verticalAlignment:'top',autoFit:'none'});
  }
  addBox(slide,result.componentFrame,{name:qaElementName({parent:'composition-component',domains:['page-composition-zones']}),geometry:'rect',fill:'none',line:{fill:'none',width:0},shadow:'shadow-none'});
  return {componentFrame:result.componentFrame};
}
