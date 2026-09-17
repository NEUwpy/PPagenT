import { resolveLayoutTree, CompositionFitError } from '../composition/resolve.mjs';
import { semanticPages, bindSemanticLayout } from './gray-semantics.mjs';

/** Four flat arrangements over the existing geometry solver, with measured copy. */
export function resolveGrayLayout(plan, selection, area, { measureBody, fitText }) {
  if (selection?.needsReplan) throw new CompositionFitError(selection.reason || '模型请求重组');
  if (!selection || Object.keys(selection).some(k=>k!=='pages') || !Array.isArray(selection.pages) || selection.pages.length !== plan.pages.length) throw new Error('排版只能返回同页数的pages');
  const pages = semanticPages(plan), layouts = [], receipts = [];
  for (const [index,page] of pages.entries()) {
    const entry = selection.pages[index];
    if (entry?.pageId !== page.pageId || Object.keys(entry).some(k=>!['pageId','layout'].includes(k))) throw new Error('基础排版不能改正文或页序');
    const choice = entry.layout, ids = page.semantics.readingOrder;
    const n = ids.length, gap = 24;
    if (!choice || !['single','row','column','grid'].includes(choice.type) || Object.keys(choice).some(k=>!['type','weights','columns'].includes(k))) throw new Error('只能选择single/row/column/grid，不能返回坐标或其他字段');
    if (choice.type === 'single' && n !== 1) throw new Error('single只能承载一个内容组');
    if (choice.weights !== undefined && choice.type !== 'row') throw new Error(`weights 只能用于 row；当前 type=${choice.type}，去掉 weights 即可（${choice.type} 的空间分配由程序按实文高度自动处理）`);
    if (choice.type === 'row' && choice.weights !== undefined && (!Array.isArray(choice.weights) || choice.weights.length !== n || choice.weights.some(w => !Number.isFinite(w) || w <= 0))) throw new Error(`row 的 weights 必须是长度 ${n}（与组数一致）的正数数组；当前收到 ${JSON.stringify(choice.weights)}。本页组数：${n}（${ids.join('、')}）`);
    if (choice.columns !== undefined && choice.type !== 'grid') throw new Error(`columns 只能用于 grid；当前 type=${choice.type}，去掉 columns 即可`);
    if (choice.columns !== undefined && (!Number.isInteger(choice.columns) || choice.columns < 1 || choice.columns > n)) throw new Error(`grid 的 columns 必须是 1 到 ${n} 之间的整数（本页 ${n} 个组）；当前收到 ${JSON.stringify(choice.columns)}`);
    const columns = choice.columns ?? Math.ceil(Math.sqrt(n));
    const weights = choice.weights ?? ids.map(()=>1), total = weights.reduce((a,b)=>a+b,0);
    const widths = ids.map((_,i)=> choice.type==='row' ? (area.width-gap*(n-1))*weights[i]/total : choice.type==='grid' ? (area.width-gap*(columns-1))/columns : area.width);
    const contracts = {};
    ids.forEach((id,i)=>{
      const item=page.items.find(item=>item.id===id), width=widths[i];
      if (width<100) throw new CompositionFitError('基础分栏过窄，请减少同排组数或调整比例',{pageId:page.pageId,itemId:id,width});
      const heading=fitText(item.heading,width-32,40,26);
      if (!heading.fits) throw new CompositionFitError('组标题无法单行容纳，请改组合或返回规划缩短标题',{pageId:page.pageId,itemId:id,width,heading:item.heading});
      const body=measureBody(item,width-32,22);
      if (!body.fits) throw new CompositionFitError('该宽度不能完整容纳正文',{pageId:page.pageId,itemId:id,width});
      contracts[id]={minWidth:width,minHeight:Math.max(80,Math.ceil(70+body.height))};
    });
    const heights=ids.map(id=>contracts[id].minHeight);
    const naturalHeight=choice.type==='column' ? heights.reduce((a,b)=>a+b,0)+gap*(n-1) : choice.type==='grid' ? Math.ceil(n/columns)*Math.max(...heights)+gap*(Math.ceil(n/columns)-1) : Math.max(...heights);
    const children=ids.map(groupId=>({groupId}));
    const composition=choice.type==='single'?children[0]:{op:choice.type,children,...(choice.type==='grid'?{columns}:choice.type==='column'?{weights:heights}:{})};
    let solved;
    try {
      solved=resolveLayoutTree({composition,bodyFrame:{left:0,top:0,width:area.width,height:area.height},contracts,style:{gap}});
    } catch(error) {
      if (error.code==='COMPOSITION_RECOMPOSE_REQUIRED') error.details={...error.details,pageId:page.pageId,layout:choice,requiredHeight:naturalHeight,availableHeight:area.height,groupCapacities:contracts};
      throw error;
    }
    const regions=ids.map(id=>{
      const frame=solved.regions[id];
      // Region boundaries express the page allocation; measured copy controls internal distribution.
      return {itemId:id,x:frame.left,y:frame.top,width:frame.width,height:frame.height,fontSize:22};
    });
    layouts.push({pageId:page.pageId,regions});
    receipts.push({pageId:page.pageId,layout:structuredClone(choice),resolved:solved,occupiedRegions:regions,contentMinimums:contracts});
  }
  const bound=bindSemanticLayout(plan,{pages:layouts});
  bound.pages.forEach((page,i)=>{page.composition.basicLayout=receipts[i].layout;});
  return {plan:bound,receipts};
}
