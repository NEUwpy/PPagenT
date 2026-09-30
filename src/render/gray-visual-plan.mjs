// Model-authored local layout; source text and ownership still come from gray.
import Ajv2020 from 'ajv/dist/2020.js';
import {addBox,addText,qaElementName} from '../asset-runtime/component-builders.mjs';
import {fitChineseTextToFrame} from './chinese-typography.mjs';

const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const number=(minimum,maximum)=>({type:'number',minimum,maximum});
const choice=(...values)=>({type:'string',enum:values});
const frame=object({x:number(0,1),y:number(0,1),width:number(.001,1),height:number(.001,1)});
const color=choice('paper','ink','muted','primary','accent','english','outline','wash');
const textProperties={frame,fontRole:choice('heading','body','english'),fontSize:number(16,48),colorRole:color,
  bold:{type:'boolean'},align:choice('left','center','right'),verticalAlign:choice('top','middle','bottom'),lineHeight:number(1,1.8)};
const textRequired=['frame','fontRole','fontSize','colorRole'];
const paint=object({kind:choice('none','solid','linear'),colorRole:color,endColorRole:color,angleDeg:number(0,360)},['kind']);
const localLayoutSchema=object({itemId:{type:'string'},reason:{type:'string',minLength:1},layout:object({
  frame:{...frame,description:'可选：正文区归一化坐标，微调本组范围；缺省沿用灰稿。组内 frame 均相对此组，不是整页。保留原有上下/左右归属。'},
  heading:object(textProperties,textRequired),
  titlePair: {type:'string',enum:['skin-overlap'],description:'使用 Skin 的统一中英文叠合样式；英文位置与字号从中文统一派生，仍由模型指定标题起点。'},
  english:object({text:{type:'string',maxLength:36,pattern:'^[A-Za-z0-9 &/()–-]*$'},...textProperties},['text',...textRequired]),
  blocks:{type:'array',items:object({sourceLocation:{type:'string'},...textProperties},['sourceLocation',...textRequired])},
  structureFrame:{...frame,description:'仅图示所属组提供；本组内的结构占用区域。'},
  decorations:{type:'array',maxItems:8,items:object({frame,geometry:choice('rect','roundRect','ellipse'),fill:paint,
    line:object({width:number(0,3),dash:choice('solid','dashed'),fill:paint}),radius:number(0,16),titleGap:{type:'boolean',description:'上边线在标题处留空，不绘制任何标题底板。用于 rect 分区框。'}},['frame','geometry','fill','line'])},
},['heading','blocks','decorations'])});
export const regionVisualSchema={oneOf:[localLayoutSchema,object({
  itemId:{type:'string'},reason:{type:'string',minLength:1},program:{type:'string',const:'source-text-v1'},
})]};
const validateSchema=new Ajv2020({strict:false,allErrors:true}).compile(regionVisualSchema);

export function grayTextSources(item) {
  if(item.kind!=='text') return [];
  return (item.blocks?.length?item.blocks:[item]).flatMap((b,i)=>{
    const kind=b.kind ?? 'text';
    if(kind!=='text' && kind!=='note') return [];
    const text=b.text??b.sourceText??'';
    const label=typeof b.label==='string' ? b.label : '';
    return [{sourceLocation:item.blocks?.length?`${item.id}/${b.id??i}`:item.id,label,text,
      displayText:[label,text].filter(Boolean).join('\n'),kind}];
  });
}
export function grayVisualTokens(theme={},typography={}) {
  return {colors:{paper:theme.background??'#FFFFFF',ink:theme.body??'#404040',muted:theme.muted??'#777777',
    primary:theme.primaryColor??'#3361AE',accent:theme.regionAccent??theme.primaryColor??'#3361AE',
    english:theme.regionEnglish??theme.line??'#DDDFE3',outline:theme.regionOutline??theme.line??'#B4C9E8',wash:theme.regionGradientStart??theme.regionSurface??theme.surface??'#FFFFFF'},
    fonts:{heading:theme.regionHeadingFont??typography.displayTypeface??theme.font??'Microsoft YaHei',
      body:typography.bodyTypeface??theme.font??'Microsoft YaHei',english:theme.regionEnglishFont??'Times New Roman'}};
}
function contained(f,label) {
  if(f.x+f.width>1.00001 || f.y+f.height>1.00001) throw new Error(`${label} 越过所属区域`);
}
function overlaps(a,b) { return Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>.002 && Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>.002; }
export function regionBounds(region,layout,area) {
  return layout?.frame??{x:region.x/area.width,y:region.y/area.height,width:region.width/area.width,height:region.height/area.height};
}
export function validateRegionLayouts(page,plan,area={width:1170,height:492}) {
  const styles=plan.regionVisuals??[];
  if(!styles.some(s=>s.layout)) return; // Old runs replay through the legacy path.
  if(styles.some(s=>!s.layout)) throw new Error('不可混用旧框预设和模型局部排版');
  const groupFrames=[];
  for(const s of styles) {
    if(!validateSchema(s)) throw new Error(`区域 ${s.itemId} 排版不合法：${JSON.stringify(validateSchema.errors)}`);
    const item=page.items.find(i=>i.id===s.itemId),l=s.layout;
    const region=page.grayComposition.regions.find(r=>r.itemId===s.itemId);
    const bounds=regionBounds(region,l,area); contained(bounds,s.itemId); groupFrames.push({bounds,region});
    const sources=grayTextSources(item),refs=l.blocks.map(b=>b.sourceLocation);
    if(refs.length!==sources.length || new Set(refs).size!==refs.length || sources.some(b=>!refs.includes(b.sourceLocation))) throw new Error(`${s.itemId} 必须逐块保留原文，禁止漏字、重复或引用其他组`);
    const ownsStructure=Boolean(plan.structure?.sourceItemIds?.includes(s.itemId));
    if(ownsStructure!==Boolean(l.structureFrame)) throw new Error(`${s.itemId} 结构区域必须且只能属于原图示组`);
    const semantic=[l.heading.frame,...l.blocks.map(b=>b.frame),...(l.structureFrame?[l.structureFrame]:[])];
    for(const f of [...semantic,...l.decorations.map(d=>d.frame),...(l.english?[l.english.frame]:[])]) contained(f,s.itemId);
    for(let i=0;i<semantic.length;i++) for(let j=i+1;j<semantic.length;j++) if(overlaps(semantic[i],semantic[j])) throw new Error(`${s.itemId} 标题、实文或结构占用区重叠`);
    // English may underlay its heading, but cannot obscure body or diagram.
    if(l.english && semantic.slice(1).some(f=>overlaps(f,l.english.frame))) throw new Error(`${s.itemId} 英文衬字侵入正文或结构`);
    for(const d of l.decorations) for(const p of [d.fill,d.line.fill]) if(p.kind!=='none' && (!p.colorRole || p.kind==='linear'&&!p.endColorRole)) throw new Error(`${s.itemId} 渐变/填色缺少 Skin 色彩角色`);
  }
  for(let i=0;i<groupFrames.length;i++) for(let j=i+1;j<groupFrames.length;j++) {
    const a=groupFrames[i],b=groupFrames[j];
    if(overlaps(a.bounds,b.bounds)) throw new Error('成稿分组互相侵占，请调整区域间距');
    if(a.region.y+a.region.height<=b.region.y && a.bounds.y+a.bounds.height>b.bounds.y+.002) throw new Error('不能改变灰稿上下归属');
    if(b.region.y+b.region.height<=a.region.y && b.bounds.y+b.bounds.height>a.bounds.y+.002) throw new Error('不能改变灰稿上下归属');
    if(a.region.x+a.region.width<=b.region.x && a.bounds.x+a.bounds.width>b.bounds.x+.002) throw new Error('不能改变灰稿左右归属');
    if(b.region.x+b.region.width<=a.region.x && b.bounds.x+b.bounds.width>a.bounds.x+.002) throw new Error('不能改变灰稿左右归属');
  }
}
function absolute(f,parent) {return {left:parent.left+f.x*parent.width,top:parent.top+f.y*parent.height,width:f.width*parent.width,height:f.height*parent.height};}
function nativePaint(p,tokens) {
  if(p.kind==='none') return 'none';
  if(p.kind==='solid') return tokens.colors[p.colorRole];
  return {type:'gradient',gradientKind:'linear',angleDeg:p.angleDeg??90,stops:[{offset:0,color:tokens.colors[p.colorRole]},{offset:100000,color:tokens.colors[p.endColorRole]}]};
}
export function renderGrayVisualPlan(slide,content,plan,bodyFrame,typography,theme) {
  const tokens=grayVisualTokens(theme,typography); let componentFrame;
  for(const s of plan.regionVisuals) {
    const item=content.items.find(i=>i.id===s.itemId).grayItem,l=s.layout;
    const region=plan.grayRegions.find(r=>r.itemId===s.itemId);
    const group=absolute(regionBounds(region,l,plan.grayArea),bodyFrame);
    const pair=theme.regionTitlePair;
    const heading=l.titlePair==='skin-overlap' && pair ? {...l.heading,fontSize:pair.fontSize,bold:true,verticalAlign:'top',lineHeight:pair.lineHeight} : l.heading;
    const english=l.titlePair==='skin-overlap' && pair && l.english ? {...l.english,fontSize:pair.fontSize,bold:false,align:heading.align??'left',verticalAlign:'top',lineHeight:pair.lineHeight,frame:{...l.english.frame,x:heading.frame.x,y:heading.frame.y+pair.englishOffsetY/group.height},text:l.english.text.toUpperCase()} : l.english;
    if(english){contained(english.frame,s.itemId);if([...l.blocks.map(b=>b.frame),...(l.structureFrame?[l.structureFrame]:[])].some(f=>overlaps(f,english.frame)))throw new Error(`${s.itemId} 统一标题衬字侵入正文或结构，请留出标题区`);}
    for(const [i,d] of l.decorations.entries()) {
      const f=absolute(d.frame,group),line={width:d.line.width,style:d.line.dash,fill:nativePaint(d.line.fill,tokens)};
      const name=`region-${s.itemId}-decoration-${i}`;
      addBox(slide,f,{name,geometry:d.geometry,borderRadius:d.radius??0,fill:nativePaint(d.fill,tokens),line:d.titleGap?{width:0,fill:'none'}:line,shadow:'shadow-none'});
      if(d.titleGap) {
        const h=absolute(heading.frame,group);
        const inkWidth=Math.max([...item.heading].length*heading.fontSize,english?english.text.length*english.fontSize*.67:0);
        const start=Math.max(f.left,h.left-5),end=Math.min(f.left+f.width,h.left+inkWidth+5);
        const segments=[[f.left,f.top,start-f.left,0],[end,f.top,f.left+f.width-end,0],[f.left,f.top,0,f.height],[f.left+f.width,f.top,0,f.height],[f.left,f.top+f.height,f.width,0]];
        segments.forEach(([left,top,width,height],j)=>{if(width||height)addBox(slide,{left,top,width,height},{name:`${name}-edge-${j}`,geometry:'line',fill:'none',line,shadow:'shadow-none'});});
      }
    }
    const text=(value,spec,name)=>{
      const f=absolute(spec.frame,group),lineHeight=spec.lineHeight??1.25;
      const fit=fitChineseTextToFrame(value,{...f,fontSizes:[spec.fontSize],lineHeight,maxLines:Math.max(1,Math.floor(f.height/(spec.fontSize*lineHeight)))});
      if(!fit.fits) throw new Error(`${name} 空间不足：当前 frame 宽 ${Math.round(f.width)}px、高 ${Math.round(f.height)}px；按当前宽度排 ${fit.lineCount} 行，需高 ${Math.ceil(fit.lineCount*spec.fontSize*lineHeight)}px。请调整本元素 frame 或模型选择的字号，不得删字、删框或撤掉英文`);
      addText(slide,fit.text,f,{name,fontSize:spec.fontSize,typeface:tokens.fonts[spec.fontRole],color:tokens.colors[spec.colorRole],bold:spec.bold??false,
        alignment:spec.align??'left',verticalAlignment:spec.verticalAlign??'top',lineHeight,autoFit:'none'});
    };
    if(english?.text) text(english.text,english,`region-${s.itemId}-english`);
    text(item.heading,heading,`region-${s.itemId}-heading`);
    const sources=grayTextSources(item);
    for(const [i,b] of l.blocks.entries()) {
      const source=sources.find(n=>n.sourceLocation===b.sourceLocation);
      text(source.displayText ?? source.text,b,`region-${s.itemId}-body-${i}`);
    }
    if(l.structureFrame) componentFrame=absolute(l.structureFrame,group);
    // Audit the actual region and semantic frames even on pages without a
    // structure. English may overlap its heading intentionally; body may not.
    const groupId=`gray-region-${s.itemId}`;
    const witness=(f,name)=>addBox(slide,f,{name,geometry:'rect',fill:'none',line:{fill:'none',width:0},shadow:'shadow-none'});
    witness(group,qaElementName({parent:groupId,domains:['gray-regions']}));
    for(const [i,f] of [heading.frame,...l.blocks.map(b=>b.frame),...(l.structureFrame?[l.structureFrame]:[])].entries()) {
      witness(absolute(f,group),qaElementName({parent:`${groupId}-content-${i}`,within:groupId,domains:[`${groupId}-content`]}));
    }
  }
  return {componentFrame};
}
