// 布局规范分配区域；示例只是规则的一组输入，不是可用布局的枚举。
export const layoutRules = [
  { id: 'cards', name: '卡片式', description: '沿同一方向排列；数量和面积随内容需求变化。',
    advice: '并列内容适用。选择横向或纵向，再按各块面积需求分配空间。',
    rules: ['适用：可独立阅读的并列内容；强流程、因果、层级关系应优先使用关系结构。', '规则：单行或单列，统一间距与外边界；面积可以均分，也可以按内容需求分配。', '调整：先调整方向与区域面积，仍不能承载时拆页或换布局，不缩字硬塞。'] },
  { id: 'album', name: '相册式', description: '按内容需求切分空间，形成大小错落的图文区域。',
    advice: '适合相对独立的图文块。权重表达面积需求，不自动代表内容重要性。',
    rules: ['适用：可分块的图文内容，允许大小不同；不能把必须连续阅读的论证任意切碎。', '规则：按面积需求、横竖倾向和最小承载尺寸分区；统一间距，铺满内容区，避免狭窄碎块。', '阅读：保持输入顺序；每次切分按左→右或上→下阅读。内容分组与主次由规划阶段决定。', '调整：空间不足时重组内容、换布局或拆页；几何可放下不等于文字和语义已通过验收。'] },
];
const examples = [
  { id:'cards-horizontal-2', name:'横向 · 2 卡片', family:'cards', direction:'horizontal', weights:[1,1] },
  { id:'cards-horizontal-3', name:'横向 · 3 卡片', family:'cards', direction:'horizontal', weights:[1,1,1] },
  { id:'cards-vertical-2', name:'纵向 · 2 卡片', family:'cards', direction:'vertical', weights:[1,1] },
  { id:'cards-vertical-3', name:'纵向 · 3 卡片', family:'cards', direction:'vertical', weights:[1,1,1] },
  { id:'cards-vertical-4', name:'纵向 · 4 卡片', family:'cards', direction:'vertical', weights:[1,1,1,1] },
  { id:'album-focus-3', name:'示例 · 3 块有主次', family:'album', weights:[3,1,1] },
  { id:'album-mosaic-4', name:'示例 · 4 块不同体量', family:'album', weights:[2,1,1,2] },
  { id:'album-focus-5', name:'示例 · 5 块图文', family:'album', weights:[4,1,2,1,2] },
];

/** 当前采用有序矩形递归切分实现规范；不是所有相册构图的穷举器。
 * blocks: weight 面积需求，aspectRatio 横竖倾向，minWidth/minHeight 承载下限。
 * 下限应由后续内容测量提供；默认下限仅用于示意，不保证正文可读。
 */
export function composePageLayout({ family='album', blocks, direction='horizontal', width=1170, height=492, gap=20 } = {}) {
  if (!layoutRules.some(r=>r.id===family)) throw new Error('未知布局规范');
  if (![width,height,gap].every(Number.isFinite) || width<240 || height<240 || gap<0 || gap>48) throw new Error('布局尺寸或间距无效');
  if (!['horizontal','vertical'].includes(direction)) throw new Error('排列方向无效');
  // 数量上限是计算保护，不是规范限定的模板数量。
  if (!Array.isArray(blocks) || blocks.length<1 || blocks.length>24) throw new Error('本次试排支持 1–24 个内容块；更多内容请分批或分页');
  const items=blocks.map((b,i)=>({ id:'slot-'+(i+1), order:i+1, weight:b.weight??1, aspectRatio:b.aspectRatio??1.6, minWidth:b.minWidth??140, minHeight:b.minHeight??80 }));
  if(items.some(b=> ![b.weight,b.aspectRatio,b.minWidth,b.minHeight].every(v=>Number.isFinite(v)&&v>0))) throw new Error('面积需求、横竖比和最小尺寸必须为正数');
  const sum=xs=>xs.reduce((s,b)=>s+b.weight,0);
  if(!Number.isFinite(sum(items))) throw new Error('面积需求数值过大');
  const fits=(b,w,h)=>w+1e-7>=b.minWidth && h+1e-7>=b.minHeight;
  let slots;
  if(family==='cards'){
    const horizontal=direction==='horizontal', available=(horizontal?width:height)-gap*(items.length-1), total=sum(items);
    let cursor=0;
    slots=items.map(b=>{
      const extent=available*b.weight/total;
      const box={...b,x:horizontal?cursor:0,y:horizontal?0:cursor,width:horizontal?extent:width,height:horizontal?height:extent};
      cursor+=extent+gap;
      return box;
    });
    if(slots.some(b=>!fits(b,b.width,b.height))) slots=null;
  }else{
    let budget=16000;
    function split(xs,x,y,w,h){
      if(--budget<0) return null;
      if(xs.length===1) return fits(xs[0],w,h)?[{...xs[0],x,y,width:w,height:h}]:null;
      if(xs.reduce((s,b)=>s+b.minWidth*b.minHeight,0)>w*h) return null;
      const total=sum(xs), candidates=[];
      for(let k=1;k<xs.length;k++){
        const a=xs.slice(0,k), b=xs.slice(k), ratio=sum(a)/total;
        for(const axis of ['x','y']){
          const extent=(axis==='x'?w:h)-gap, first=extent*ratio;
          const boxes=axis==='x'?[[x,y,first,h],[x+first+gap,y,extent-first,h]]:[[x,y,w,first],[x,y+first+gap,w,extent-first]];
          const groups=[a,b];
          if(boxes.some((r,j)=>groups[j].some(t=>t.minWidth>r[2]+1e-7||t.minHeight>r[3]+1e-7))) continue;
          const score=boxes.reduce((s,r,j)=>s+groups[j].reduce((v,t)=>v+t.weight*Math.abs(Math.log((r[2]/r[3])/t.aspectRatio)),0)/sum(groups[j]),0);
          candidates.push({groups,boxes,score});
        }
      }
      candidates.sort((a,b)=>a.score-b.score);
      for(const c of candidates){
        const left=split(c.groups[0],...c.boxes[0]);
        if(!left) continue;
        const right=split(c.groups[1],...c.boxes[1]);
        if(right) return [...left,...right];
      }
      return null;
    }
    slots=split(items,0,0,width,height);
  }
  if(!slots) throw new Error('本次规则试排未找到满足最小尺寸的分区；请调整面积需求、排列方向或拆页。不会自动缩小内容。');
  return { id:family+'-composed', name:family==='album'?'相册式 · 按规则试排':'卡片式 · 按规则试排', family,width,height,gap,slots };
}
export function resolvePageLayout(id, options={}) {
  const e=examples.find(x=>x.id===id);
  if(!e) throw new Error('未知布局示例：'+id);
  return {...composePageLayout({...e,blocks:e.weights.map(weight=>({weight})),...options}),id,name:e.name};
}

const xml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const palettes = [
  ['#edf2f7', '#345779', '#ced9e5'], ['#ecf2f0', '#47675e', '#ccdcd6'],
  ['#f5efe5', '#806843', '#e3d7c4'], ['#eeedf5', '#645b80', '#d8d3e5'], ['#f4ebed', '#855d68', '#e5d1d8'],
];

/** 预览以槽位边界为主，不伪装成已有的正式稿件/PPT。 */
export function pageLayoutPreview(id, options = {}) {
  const layout = typeof id === 'object' ? id : resolvePageLayout(id, options);
  const skeleton = options.mode === 'skeleton';
  const parts = layout.slots.map((slot, i) => {
    const [fill, ink, line] = palettes[i % palettes.length];
    const pad = Math.min(30, slot.height * .19);
    const compact = slot.height < 145;
    const landscape = slot.width > slot.height * 2.5;
    const titleSize = compact ? 23 : 28;
    const x = slot.x, y = slot.y, w = slot.width, h = slot.height;
    const label = `${layout.family === 'cards' ? '卡片' : '区域'} ${String(i + 1).padStart(2, '0')}`;
    let body;
    if (skeleton) {
      body = `<text x="${x + w / 2}" y="${y + h / 2 - 6}" text-anchor="middle" fill="${ink}" font-size="26" font-weight="600">${label}</text><text x="${x + w / 2}" y="${y + h / 2 + 26}" text-anchor="middle" fill="${ink}" opacity=".72" font-size="17">${Math.round(w)} × ${Math.round(h)}</text>`;
    } else if (landscape) {
      const labelWidth = Math.min(w * .45, Math.max(160, Math.min(210, w * .28)));
      body = `<text x="${x + pad}" y="${y + h / 2 + 8}" fill="${ink}" font-size="${titleSize}" font-weight="650">${label}</text><path d="M${x + labelWidth} ${y + pad}V${y + h - pad}" stroke="${line}" stroke-width="1.5"/>`;
      const lx = x + labelWidth + 28;
      body += `<rect x="${lx}" y="${y + h / 2 - 12}" width="${(w - labelWidth - 2 * pad) * .78}" height="7" rx="3.5" fill="${line}"/><rect x="${lx}" y="${y + h / 2 + 12}" width="${(w - labelWidth - 2 * pad) * .54}" height="7" rx="3.5" fill="${line}"/>`;
    } else {
      body = `<text x="${x + pad}" y="${y + pad + 24}" fill="${ink}" font-size="${titleSize}" font-weight="650">${label}</text>`;
      const mediaTop = y + pad + 49, mediaH = Math.max(20, h - 2 * pad - 97);
      body += `<rect x="${x + pad}" y="${mediaTop}" width="${w - 2 * pad}" height="${mediaH}" rx="5" fill="${line}" opacity=".58"/>`;
      if (mediaH > 95 && w - 2 * pad > 230) body += `<text x="${x + w / 2}" y="${mediaTop + mediaH / 2 + 7}" text-anchor="middle" fill="${ink}" opacity=".65" font-size="18">文字 / 图形 / 图片</text>`;
      body += `<rect x="${x + pad}" y="${y + h - pad - 22}" width="${(w - 2 * pad) * .82}" height="6" rx="3" fill="${line}"/><rect x="${x + pad}" y="${y + h - pad - 6}" width="${(w - 2 * pad) * .55}" height="6" rx="3" fill="${line}"/>`;
    }
    return `<g><rect x="${x + .75}" y="${y + .75}" width="${w - 1.5}" height="${h - 1.5}" rx="10" fill="${skeleton ? '#f5f7fa' : fill}" stroke="${line}" stroke-width="1.5"/>${body}</g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="${xml(layout.name)}布局示意" style="display:block;width:100%;height:auto;font-family:'Microsoft YaHei',sans-serif"><title>${xml(layout.name)} · 内容区铺满</title>${parts.join('')}</svg>`;
}

export function listPageLayouts() {
  return layoutRules.map(family=>({...family,variants:examples.filter(e=>e.family===family.id).map(e=>({
    ...e,count:e.weights.length,geometry:resolvePageLayout(e.id),preview:pageLayoutPreview(e.id),skeleton:pageLayoutPreview(e.id,{mode:'skeleton'})
  }))}));
}
