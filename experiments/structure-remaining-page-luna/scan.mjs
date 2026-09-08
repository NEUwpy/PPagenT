// A page minus occupied regions, without assuming the dimensions of future text.
export function scanRemainingPage(occupancy,page){
 const right=page.left+page.width,bottom=page.top+page.height;
 const clipped=occupancy.areas.map(a=>a.frame).map(f=>({left:Math.max(page.left,f.left),right:Math.min(right,f.left+f.width),top:Math.max(page.top,f.top),bottom:Math.min(bottom,f.top+f.height)})).filter(f=>f.right>f.left&&f.bottom>f.top);
 const ys=[...new Set([page.top,bottom,...clipped.flatMap(f=>[f.top,f.bottom])])].sort((a,b)=>a-b);
 const bands=[];
 for(let i=0;i<ys.length-1;i++){
  const top=ys[i],end=ys[i+1],blocked=clipped.filter(f=>f.top<end&&f.bottom>top).sort((a,b)=>a.left-b.left);
  let cursor=page.left;const intervals=[];
  for(const f of blocked){if(f.left>cursor)intervals.push({left:cursor,width:f.left-cursor});cursor=Math.max(cursor,f.right);}
  if(cursor<right)intervals.push({left:cursor,width:right-cursor});
  bands.push({top,height:end-top,free:intervals});
 }
 return {page,bands,freeArea:bands.reduce((s,b)=>s+b.height*b.free.reduce((x,f)=>x+f.width,0),0),note:'自由区域按横向带表示，尚未选择文字框或文字角色；段落由排版决定。'};
}
