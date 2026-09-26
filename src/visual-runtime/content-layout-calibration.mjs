import { composePageLayout } from './page-layout-library.mjs';
import { fitGrayText } from '../runner/gray-draft.mjs';

// 人工映射只存来源片段与职责，排版执行不接受改写正文。
export function bindContentMapping(source, mapping) {
  const ids = new Set();
  const spans = mapping.units.map(unit => {
    if (!unit.id || ids.has(unit.id)) throw new Error('内容 ID 重复或缺失');
    ids.add(unit.id);
    const start = source.indexOf(unit.quote);
    if (!unit.quote || start < 0 || source.indexOf(unit.quote, start + 1) >= 0) throw new Error(`来源片段不唯一：${unit.id}`);
    return { ...unit, start, end: start + unit.quote.length };
  });
  const sorted = [...spans].sort((a,b)=>a.start-b.start);
  let cursor=0;
  for (const unit of sorted) {
    if (unit.start<cursor || source.slice(cursor,unit.start).trim()) throw new Error('映射重叠或遗漏来源内容');
    cursor=unit.end;
  }
  if (source.slice(cursor).trim()) throw new Error('映射遗漏来源末尾');
  const claimed = new Set();
  for (const block of mapping.blocks) {
    if (!block.unitIds.length || !block.reason?.trim()) throw new Error('布局块缺少来源或分块依据');
    for (const id of block.unitIds) {
      if (!ids.has(id) || claimed.has(id)) throw new Error('布局引用无效或重复');
      claimed.add(id);
    }
  }
  if (claimed.size !== ids.size) throw new Error('有内容未进入布局');
  const blockIds = new Set(mapping.blocks.map(b=>b.id));
  if (blockIds.size !== mapping.blocks.length) throw new Error('布局块 ID 重复');
  for (const b of mapping.blocks) if (b.scopeIds?.some(id=>!blockIds.has(id)||id===b.id)) throw new Error('说明作用对象无效');
  return mapping.blocks.map(b=>({...b,text:b.unitIds.map(id=>spans.find(u=>u.id===id).quote).join('\n')}));
}

export function composeContentCalibration(source, mapping, {family='cards',direction='horizontal'}={}) {
  const blocks=bindContentMapping(source,mapping), width=1170,height=492,gap=18;
  const title=blocks.filter(b=>b.role==='title'), shared=blocks.filter(b=>b.role==='shared');
  const objects=blocks.filter(b=>b.role==='object');
  if(title.length!==1 || !objects.length || blocks.some(b=>!['title','shared','object'].includes(b.role))) throw new Error('需要一个标题、主体块及可选共同说明');
  const measure=(text,w)=>fitGrayText(text,w,2000,22);
  const sharedHeights=shared.map(b=>Math.ceil(measure(b.text,width-32).lineCount*22*1.35)+36);
  const bodyHeight=height-sharedHeights.reduce((a,b)=>a+b,0)-gap*shared.length;
  const geometry=composePageLayout({family,direction,width,height:bodyHeight,gap,blocks:objects.map(b=>{
    const m=measure(b.text,(width-gap*(objects.length-1))/objects.length-32);
    const full=measure(b.text,width-49);
    return {weight:family==='cards'?1:Math.max(1,m.lineCount),aspectRatio:1.3,minWidth:180,minHeight:Math.ceil(full.lineCount*22*1.35)+36};
  })});
  const placed=geometry.slots.map((r,i)=>({...objects[i],...r,id:objects[i].id}));
  let y=bodyHeight+gap;
  shared.forEach((b,i)=>{placed.push({...b,x:0,y,width,height:sharedHeights[i]});y+=sharedHeights[i]+gap;});
  const regions=placed.map(b=>{
    const fit=fitGrayText(b.text,b.width-(b.role==='object'?49:32),b.height-36,22);
    if(!fit.fits) throw new Error(`布局块 ${b.id} 不能完整容纳；需调整空间，不能缩字或删文`);
    return {...b,measuredLines:fit.lineCount};
  });
  return {mode:'manual-calibration',title:title[0].text,width,height,regions,blocks,
    note:'人工内容映射＋人工指定布局。用于校准布局能力，不代表自动识别、自动选型或 PPT 交付通过。'};
}
