import { grayBodyLayout, fitGrayText } from '../runner/gray-draft.mjs';
import { bindVisualBlocks } from '../runner/visual-block-mapping.mjs';
import { addText, addBox, qaElementName } from '../asset-runtime/component-builders.mjs';

export const TEXT_PROGRAM = 'source-text-v1';
export const TEXT_PROGRAM_CONTRACT = Object.freeze({
  id:TEXT_PROGRAM,
  accepts:'纯文字页（text/note）；原始区域、组内映射及共同作用范围保持不变',
  input:'regionVisuals 每组仅提交 {itemId,reason,program:"source-text-v1"}；不接受坐标、正文、字号或装饰',
  typography:'标题 26px、正文整页统一选可承载的 22/20/18px、附注 16px；字体与颜色从当前 Skin 角色取值',
  excludes:'图示、跨组共同范围、自由调区；容量不足返回规划，不删字或缩到档位以下',
  status:'construction-candidate',
});

/** Compile original content, not model-authored geometry or duplicate text. */
export function resolveTextProgram(page, plan, area, bodyFrame={left:0,top:0,...area}) {
  if(![area?.width,area?.height,bodyFrame.left,bodyFrame.top,bodyFrame.width,bodyFrame.height].every(Number.isFinite) || area.width<=0 || area.height<=0 || bodyFrame.width<=0 || bodyFrame.height<=0) throw new Error('文字程序缺少有效画布');
  if(plan.structure) throw new Error(`${TEXT_PROGRAM} 不接受结构绑定`);
  if(!Array.isArray(plan.regionVisuals) || plan.regionVisuals.length!==page.items.length) throw new Error('文字程序必须完整覆盖所有组');
  const seen=new Set();
  for(const visual of plan.regionVisuals) {
    if(!visual || Object.keys(visual).some(k=>!['itemId','reason','program'].includes(k)) || visual.program!==TEXT_PROGRAM || typeof visual.reason!=='string' || !visual.reason.trim()) throw new Error('文字程序仅接受 itemId、reason 和已登记 program，不能混用自由坐标');
    if(!page.items.some(i=>i.id===visual.itemId) || seen.has(visual.itemId)) throw new Error('文字程序区域必须唯一且属于本页');
    seen.add(visual.itemId);
  }
  for(const item of page.items) {
    if(item.kind!=='text' || !item.blocks?.length || item.blocks.some(b=>!['text','note'].includes(b.kind??'text'))) throw new Error('文字程序暂不支持图示或缺少原始 blocks 的组');
  }
  // Persisted derived bindings are untrusted until they match original blocks.
  const mapping=page.semantics?.visualMapping;
  const bound=mapping?bindVisualBlocks({pageId:page.pageId,groups:page.items,readingOrder:page.semantics.readingOrder},mapping):null;
  for(const item of page.items) {
    const expected=bound?{...bound.groups.find(g=>g.groupId===item.id),blocks:bound.blocks.filter(b=>b.groupId===item.id)}:undefined;
    if(JSON.stringify(expected)!==JSON.stringify(item.visualMapping)) throw new Error('文字程序的视觉绑定与原始计划不一致');
  }
  const sx=bodyFrame.width/area.width,sy=bodyFrame.height/area.height;
  const regions=page.grayComposition?.regions??[];
  if(regions.length!==page.items.length || new Set(regions.map(r=>r.itemId)).size!==regions.length || regions.some(r=>!seen.has(r.itemId))) throw new Error('文字程序缺少原始灰稿区域');
  const frames=regions.map(r=>{
    if(![r.x,r.y,r.width,r.height].every(Number.isFinite) || r.width<=0 || r.height<=0 || r.x<0 || r.y<0 || r.x+r.width>area.width+.01 || r.y+r.height>area.height+.01) throw new Error('文字程序原始区域越界或无效');
    return {itemId:r.itemId,left:bodyFrame.left+r.x*sx,top:bodyFrame.top+r.y*sy,width:r.width*sx,height:r.height*sy};
  });
  for(const [i,a] of frames.entries()) for(const b of frames.slice(i+1)) if(Math.min(a.left+a.width,b.left+b.width)-Math.max(a.left,b.left)>.01 && Math.min(a.top+a.height,b.top+b.height)-Math.max(a.top,b.top)>.01) throw new Error('文字程序原始区域重叠');
  for(const fontSize of [22,20,18]) {
    const groups=frames.map(frame=>{
      const item=page.items.find(i=>i.id===frame.itemId);
      const heading=fitGrayText(item.heading,frame.width-32,40,26);
      const body=grayBodyLayout(item,frame.width-32,fontSize,undefined,{noteFontSize:16});
      return {itemId:item.id,frame,heading:heading.text,body,fontSize,fits:heading.fits && body.fits && body.height<=frame.height-70};
    });
    if(groups.every(g=>g.fits)) return {program:TEXT_PROGRAM,fontSize,groups};
  }
  throw new Error('文字程序容量不足：正文 18px / 附注 16px 仍无法完整承载，请返回分页或灰稿规划');
}

export function renderTextProgram(slide, resolved, tokens) {
  for(const group of resolved.groups) {
    const f=group.frame,parent=`text-program-${group.itemId}`;
    addBox(slide,f,{name:qaElementName({parent,domains:['page-composition-zones']}),geometry:'rect',borderRadius:0,fill:'none',line:{fill:'none',width:0},shadow:'shadow-none'});
    const draw=(text,frame,size,bold,role,color)=>addText(slide,text,frame,{
      name:qaElementName({within:parent,role}),fontSize:size,typeface:role==='heading'?tokens.fonts.heading:tokens.fonts.body,
      color,bold,verticalAlignment:'top',lineHeight:1.35,autoFit:'none',
    });
    draw(group.heading,{left:f.left+16,top:f.top+12,width:f.width-32,height:40},26,true,'heading',tokens.colors.accent);
    for(const [index,run] of group.body.runs.entries()) draw(run.text,
      {left:f.left+16+run.x,top:f.top+54+run.y,width:run.width,height:run.height},
      run.fontSize??group.fontSize,Boolean(run.bold),`body-${index}`,run.kind==='note'?tokens.colors.muted:tokens.colors.ink);
  }
  return {componentFrame:undefined};
}
