import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Presentation,PresentationFile} from '../../src/ppt-engine/index.mjs';
import {addText,addBox,addLine} from '../../src/asset-runtime/component-builders.mjs';
import {createNortheasternUniversityStarter} from '../../src/runtime/skins/northeastern-university.mjs';
import {northeasternUniversitySkin} from '../../src/runtime/skins/northeastern-university-contract.mjs';
import {neutralEditorialTheme} from '../../src/runtime/skins/neutral-editorial-theme.mjs';
import {renderStructureAsset,closeHtmlComponentRuntime} from '../../src/runtime/legacy-structure-assets.mjs';
import {wrapChineseText} from '../../src/render/chinese-typography.mjs';
import {invokeStructure} from '../../.codex/skills/ppagent-structure/scripts/invoke.mjs';
import {loadStructureSkill} from '../../src/runtime/structure-skills.mjs';
import {invokeUniversityStructure} from '../../src/runtime/invoke-university-structure.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.join(path.dirname(fileURLToPath(import.meta.url)),'artifacts');
const source='experiments/gray-structure-coverage-20260926/artifacts/state.json';
const state=JSON.parse(await fs.readFile(path.join(root,source),'utf8'));
const frame={left:55,top:166,width:1170,height:492};
const themes={neutral:{accent:'#796F60',soft:'#E9E6DE',ink:'#25251F',muted:'#625F57',line:'#CFC9BD',paper:'#F5F4EF',font:'Noto Sans SC',heading:'Noto Serif SC'},university:{accent:'#315EA4',soft:'#E9EFF8',ink:'#182E4D',muted:'#4D6080',line:'#BFCDE2',paper:'#FFFFFF',font:'Microsoft YaHei',heading:'Microsoft YaHei'}};
let slide,theme,skin,serial=0,pageNum;const receipts=[];
const rect=(x,y,w,h)=>({left:x,top:y,width:w,height:h});
function text(value,f,size=23,bold=false,color=theme.ink,align='left'){
 const wrapped=wrapChineseText(value,Math.max(1,Math.floor(f.width/size))); const lines=wrapped.split('\n').length;
 if(lines*size*1.23>f.height+2)throw new Error(`p${pageNum}: text cannot fit ${value} ${JSON.stringify(f)} size=${size}`);
 return addText(slide,wrapped,f,{fontSize:size,bold,color,alignment:align,typeface:theme.font,verticalAlignment:'middle',autoFit:'none',name:`copy-${pageNum}-${++serial}`});
}
function box(f,label='',strong=false,size=23){const b=addBox(slide,f,{geometry:'roundRect',borderRadius:6,fill:strong?theme.accent:theme.soft,line:{fill:theme.line,width:1},shadow:'none'});if(label)text(label,rect(f.left+10,f.top+5,f.width-20,f.height-10),size,strong,strong?'#FFFFFF':theme.ink,'center');return b;}
function line(x,y,xx,yy,arrow=false){addLine(slide,{x,y},{x:xx,y:yy},theme.accent,2);if(arrow){const a=Math.atan2(yy-y,xx-x),l=9;addLine(slide,{x:xx,y:yy},{x:xx-l*Math.cos(a-.5),y:yy-l*Math.sin(a-.5)},theme.accent,2);addLine(slide,{x:xx,y:yy},{x:xx-l*Math.cos(a+.5),y:yy-l*Math.sin(a+.5)},theme.accent,2);}}
function chain(labels,f,{vertical=false,caption=''}={}){const gap=24;const h=vertical?Math.min(60,(f.height-gap*(labels.length-1))/labels.length):Math.min(74,f.height-30);const w=vertical?Math.min(f.width-30,240):(f.width-gap*(labels.length-1))/labels.length;const x=f.left+(vertical?(f.width-w)/2:0),y=f.top+(f.height-(vertical?(h+gap)*labels.length-gap:h))/2;labels.forEach((v,i)=>{if(i<labels.length-1)line(x+(vertical?w/2:(i+1)*w+i*gap),y+(vertical?(i+1)*h+i*gap:h/2),x+(vertical?w/2:(i+1)*(w+gap)),y+(vertical?(i+1)*(h+gap):h/2),true);});labels.forEach((v,i)=>box(rect(x+(vertical?0:i*(w+gap)),y+(vertical?i*(h+gap):0),w,h),v,i===labels.length-1,22));if(caption)text(caption,rect(f.left,f.top,f.width,28),18,false,theme.muted);}
function branch(pairs,f){const y=f.top+20,h=Math.min(64,(f.height-45)/pairs.length),gap=16; pairs.forEach(([condition,action],i)=>{const yy=y+i*(h+gap),cw=f.width*.40,aw=f.width*.43;line(f.left+cw,yy+h/2,f.left+f.width-aw,yy+h/2,true);box(rect(f.left,yy,cw,h),condition,false,21);box(rect(f.left+f.width-aw,yy,aw,h),action,true,21);});}
function table(headers,rows,f){const rh=Math.min(85,f.height/(rows.length+1));const widths=headers.map((_,i)=>i===0?f.width*.25:f.width*.75/(headers.length-1));[headers,...rows].forEach((r,ri)=>{let x=f.left;r.forEach((v,ci)=>{addBox(slide,rect(x,f.top+ri*rh,widths[ci],rh),{geometry:'rect',fill:ri===0?theme.accent:ri%2?theme.soft:theme.paper,line:{fill:theme.line,width:1},shadow:'none'});text(v,rect(x+12,f.top+ri*rh+8,widths[ci]-24,rh-16),ri===0?23:22,ri===0,ri===0?'#FFFFFF':theme.ink);x+=widths[ci];});});}
async function library(assetId,parameters,f){const options={root,slide,targetFrame:f,content:parameters,evidencePath:path.join(out,'structure-calls.ndjson'),pageId:`p${pageNum}`,regionId:assetId,reason:'按灰稿局部区域保留顺序或递进关系'};if(skin.id==='neutral-editorial-001'){const ref=await loadStructureSkill(assetId,root);await invokeStructure({...options,skin:{...neutralEditorialTheme,id:skin.id,bodyFrame:frame},execution:'preserved-design',references:[{assetId,preservedFeatures:ref.guide.designBoundary.invariants}]});}else await invokeUniversityStructure({...options,assetId});receipts.push({page:pageNum,skin:skin.id,assetId,frame:f});}
async function graphic(groupIndex,f){const key=`${pageNum}:${groupIndex}`;
 if(key==='1:0'){const w=f.width*.28,h=58,y=f.top+15;line(f.left+w,y+h/2,f.left+f.width*.38,y+h/2,true);line(f.left+w,y+110+h/2,f.left+f.width*.38,y+110+h/2,true);line(f.left+f.width*.63,y+h/2,f.left+f.width*.76,y+82,true);line(f.left+f.width*.63,y+110+h/2,f.left+f.width*.76,y+82,true);box(rect(f.left,y,w,h),'访谈记录');box(rect(f.left,y+110,w,h),'流程记录');box(rect(f.left+f.width*.38,y,f.width*.25,h),'入口难找');box(rect(f.left+f.width*.38,y+110,f.width*.25,h),'交接等待');box(rect(f.left+f.width*.76,y+52,f.width*.24,60),'先修复试点',true);return;}
 if(key==='3:0'||key==='17:0'){await library('sequence-flow-001',{items:(pageNum===3?['受理','分派','处理','反馈']:['校验权限','查询状态','返回结果']).map((title,i)=>({title,body:pageNum===3?['记录受理时间','记录接收人','补件暂停计时','交接状态可追溯'][i]:['申请人或授权代办人','仅查询获准的状态','内部记录按权限控制'][i]}))},rect(f.left,f.top,f.width,f.height-(pageNum===17?36:0)));if(pageNum===17)text('校验失败 → 停止查询',rect(f.left,f.top+f.height-30,f.width,28),18,false,theme.muted);return;}
 if(key==='4:1'){await library('progression-maturity-steps-002',{levels:['记录完整','过程可见','趋势分析','预测辅助'].map((title,i)=>({title,body:['补齐记录与责任归属','过程能够稳定追踪','以前级稳定运行为前提','以前级稳定运行为前提'][i]})),showStatus:false},f);return;}
 if(pageNum===2){const vals=groupIndex===0?['启动投入低','依赖原系统','受现有接口约束']:['启动投入高','需要专职维护','更便于跨系统协作'];table(['比较维度','方案特点'],['启动投入','维护方式','扩展能力'].map((v,i)=>[v,vals[i]]),f);return;}
 if(key==='5:1'){branch([['规则明确','直接办理'],['存在争议','组织会商']],f);return;}
 if(key==='6:1'){const w=Math.min(135,(f.width-75)/2),h=48,x=f.left+(f.width-2*w-50)/2,y=f.top+12;const pts=[[x,y],[x+w+50,y],[x+w+50,y+85],[x,y+85]];line(x+w,y+h/2,x+w+50,y+h/2,true);line(x+w+50+w/2,y+h,x+w+50+w/2,y+85,true);line(x+w+50,y+85+h/2,x+w,y+85+h/2,true);line(x+w/2,y+85,x+w/2,y+h,true);['执行','记录','复盘','修订'].forEach((v,i)=>box(rect(...pts[i],w,h),v,i===3,22));return;}
 if(key==='7:2'){const h=50,w=200,y=f.top+(f.height-120)/2,x=f.left;line(x+w,y+25,x+f.width*.49,y+60,true);line(x+w,y+95,x+f.width*.49,y+60,true);line(x+f.width*.49+200,y+60,x+f.width-200,y+60,true);box(rect(x,y,w,h),'用户反馈');box(rect(x,y+70,w,h),'服务记录');box(rect(x+f.width*.49,y+35,200,h),'去重核验');box(rect(x+f.width-200,y+35,200,h),'需求清单',true);return;}
 if(key==='8:0'){branch([['入口分散','统一受理'],['责任不清','明确分派']],rect(f.left,f.top,f.width*.63,f.height));text('预期结果 · 待验证',rect(f.left+f.width*.7,f.top+25,f.width*.3,36),23,true,theme.accent);text('减少寻找入口\n与交接等待',rect(f.left+f.width*.7,f.top+70,f.width*.3,80),23);return;}
 if(key==='9:1'){const labels=['服务应用','流程协同','数据基础'],w=f.width-50,h=65,y=f.top+65;for(let i=0;i<2;i++)line(f.left+f.width/2,y+(i+1)*105,f.left+f.width/2,y+i*105+h,true);labels.forEach((v,i)=>box(rect(f.left+25,y+i*105,w,h),v,i===0));text('下层支撑上层',rect(f.left,y+325,f.width,28),18,false,theme.muted,'center');return;}
 if(key==='10:0'){const w=(f.width-22)/2,h=70,y=f.top+65;line(f.left+f.width/2,y+h,f.left+f.width/2,y+h+35);line(f.left+w/2,y+h+35,f.left+f.width-w/2,y+h+35);for(const x of [f.left+w/2,f.left+f.width-w/2])line(x,y+h+35,x,y+h+70,true);box(rect(f.left+20,y,f.width-40,h),'服务改善',true);box(rect(f.left,y+h+70,w,h),'入口优化',false,20);box(rect(f.left+w+22,y+h+70,w,h),'流转提速',false,20);text('每项工作明确负责人',rect(f.left,y+h+150,f.width,34),19,false,theme.muted,'center');return;}
 if(key==='11:2'){const cx=f.left+f.width/2,cy=f.top+f.height/2;const pts=[[cx-72,f.top+12],[f.left,f.top+f.height-78],[f.left+f.width-140,f.top+f.height-78]];pts.forEach(([x,y],i)=>{const sx=cx+(i===0?0:i===1?-28:28),sy=cy+(i===0?-32:32),ex=x+70,ey=y+(i===0?60:0);line(sx,sy,ex,ey,true);line(ex,ey,sx,sy,true);});box(rect(cx-80,cy-32,160,64),'协调组',true);['业务组','技术组','服务组'].forEach((v,i)=>box(rect(...pts[i],140,60),v));return;}
 if(key==='13:0'){const x=f.left+40,y=f.top+25,w=f.width-60,h=f.height-62;addBox(slide,rect(x,y,w/2,h/2),{geometry:'rect',fill:theme.soft,line:{fill:'none',width:0},shadow:'none'});line(x,y+h,x+w,y+h,true);line(x,y+h,x,y,true);line(x+w/2,y,x+w/2,y+h);line(x,y+h/2,x+w,y+h/2);text('入口',rect(x+14,y+10,w/2-22,30),23,true,theme.accent);text('迁移',rect(x+w/2+14,y+h/2+10,w/2-22,30),23);text('高',rect(f.left,y,35,28),18);text('低',rect(f.left,y+h-28,35,28),18);text('价值',rect(f.left,y-26,70,26),17);text('难度低 → 高',rect(x,y+h+8,w,26),18,false,theme.muted,'center');return;}
 if(pageNum===14){chain(groupIndex===0?['规则不清','重复补件']:['无人接收','交接等待'],f,{caption:'待验证假设'});return;}
 if(key==='16:0'){const x=f.left+10,y=f.top+10,w=f.width*.65;addBox(slide,rect(x,y,w,f.height-20),{geometry:'roundRect',fill:theme.soft,line:{fill:theme.accent,width:2},shadow:'none'});text('在线受理 · 试点范围内',rect(x+20,y+10,w-40,32),24,true,theme.accent);box(rect(x+30,y+65,(w-90)/2,60),'材料上传');box(rect(x+60+(w-90)/2,y+65,(w-90)/2,60),'状态查询');box(rect(f.left+f.width*.73,y+65,f.width*.25,60),'线下核验');text('范围外 · 原业务流程承担',rect(f.left+f.width*.70,y+130,f.width*.30,28),18,false,theme.muted,'center');return;}
 if(pageNum===18){branch(groupIndex===0?[['材料缺失','业务人员通知补齐'],['争议材料','负责人复核']]:[['短暂故障','重试'],['持续故障','技术人员处理']],f);return;}
 if(key==='19:0'){table(['角色 / 阶段','准备期 →','试点期 →','验收期'],[['业务组','确认规则','处理例外','核对结果'],['技术组','核对接口','监控运行','提交记录'],['服务组','整理常见问题','记录反馈','汇总体验问题']],f);return;}
 if(key==='20:0'){const x=f.left,y=f.top,w=f.width,h=f.height;const pts=[[x+40,y+50],[x+w-240,y+50],[x+40,y+h-110],[x+w-240,y+h-110]];line(x+240,y+80,x+w-240,y+80);line(x+140,y+110,x+140,y+h-110);line(x+w-140,y+110,x+w-140,y+h-110);line(x+240,y+100,x+w-240,y+h-80);['业务组','技术组','服务组','数据组'].forEach((v,i)=>box(rect(...pts[i],200,60),v,false));text('核对规则实现',rect(x+300,y+38,w-600,30),20,false,theme.muted,'center');text('确认用户说明',rect(x+10,y+h/2-15,260,32),20,false,theme.muted);text('核对数据口径',rect(x+w-265,y+h/2-15,260,32),20,false,theme.muted);text('复核异常记录',rect(x+w/2-100,y+h/2+30,230,32),20,false,theme.muted,'center');return;}
 if(key==='22:0'){slide.charts.add('bar',{position:rect(f.left,f.top,f.width,f.height),categories:['第一期','第二期','第三期'],series:[{name:'平均等待时间（分钟）',values:[12,10,8],fill:theme.accent}],hasLegend:false,barOptions:{direction:'column',gapWidth:130},yAxis:{minimumScale:0,maximumScale:15,majorUnit:5,title:'分钟'},dataLabels:{showValue:true},title:'模拟数据 · 分钟',titleTextStyle:{fontSize:20,color:theme.ink},chartFill:theme.paper});return;}
 if(key==='23:1'){table(['团队','交付物','核对状态'],[['业务组','规则清单','待核对'],['技术组','联调记录','待核对'],['服务组','反馈汇总','待核对']],f);return;}
 if(key==='24:0'){const x=f.left,y=f.top,w=f.width,h=f.height;addBox(slide,rect(x,y,w,h),{geometry:'rect',fill:theme.soft,line:{fill:theme.line,width:1},shadow:'none'});text('模拟空间示意 · 非实拍',rect(x+18,y+12,w-36,30),20,false,theme.muted);box(rect(x+30,y+70,w*.55,65),'服务窗口',true);box(rect(x+w*.72,y+70,w*.22,145),'自助终端',false,22);box(rect(x+30,y+185,w*.55,100),'排队区');text('入口',rect(x+30,y+h-48,100,35),23,true,theme.accent);return;}
 throw new Error(`No authored graphic for ${key}`);
}
async function body(page){for(const [gi,g] of page.items.entries()){
 const r=page.composition.regions.find(r=>r.itemId===g.id);const f=rect(frame.left+r.x,frame.top+r.y,r.width,r.height); const pad=16;
 line(f.left,f.top+36,f.left+f.width,f.top+36);
 text(g.heading,rect(f.left+pad,f.top,f.width-pad*2,34),25,true,theme.accent);
 const inner=rect(f.left+pad,f.top+52,f.width-2*pad,f.height-60);
 const graphicWhole=g.kind!=='text';const blocks=g.blocks;const graphicBlock=graphicWhole?-1:blocks.findIndex(b=>b.kind&&b.kind!=='text');
 if(graphicWhole){await graphic(gi,inner);continue;}
 const font=inner.width<380?21:23;let y=inner.top;
 const heights=blocks.map(b=>(b.kind&&b.kind!=='text')?0:(wrapChineseText(b.text,Math.floor(inner.width/font)).split('\n').length*font*1.3+(b.label?32:0)+18));
 if(pageNum===18)heights[0]=Math.max(heights[0],font*1.3*2+18);
 const totalText=heights.reduce((a,b)=>a+b,0),graphicH=inner.height-totalText;
 if(graphicBlock>=0&&graphicH<125)throw new Error(`p${pageNum} graphic cramped ${graphicH}`);
 const extra=graphicBlock<0?Math.max(0,(inner.height-totalText)/(blocks.length+1)):0;y+=extra;
 for(const [bi,b] of blocks.entries()){if(b.kind&&b.kind!=='text'){await graphic(gi,rect(inner.left,y,inner.width,graphicH));y+=graphicH;continue;}
 if(b.label){text(b.label,rect(inner.left,y,inner.width,30),22,true,theme.accent);y+=32;}
 const hh=heights[bi]-(b.label?32:0)-18;text(b.text,rect(inner.left,y,inner.width,hh),font);y+=hh+18+extra;}
 }}
function neutralHeader(page,index){slide.background.fill=theme.paper;text(String(index+1).padStart(2,'0')+'  '+page.title,rect(55,35,1170,34),25,true,theme.accent);text(page.claim.replace(/^模拟｜/,''),rect(55,90,1170,48),34,true);line(55,144,1225,144);text('模拟灰稿 → Skin 试验 · 待验收',rect(55,681,650,20),14,false,theme.muted);text(String(index+1).padStart(2,'0'),rect(1160,681,65,20),14,false,theme.muted,'right');}
await fs.mkdir(out,{recursive:true});
for(const skinId of ['neutral','university']){
 theme=themes[skinId];skin=skinId==='neutral'?{id:'neutral-editorial-001',bodyFrame:frame,componentSourceFrame:frame,componentTheme:{...neutralEditorialTheme,structureColorMode:'continuous-tone-v1'}}:northeasternUniversitySkin;
 let presentation,slides;if(skinId==='university'){
 const pages=state.pages.map(p=>({content:{pageId:p.pageId,title:p.claim.replace(/^模拟｜/,''),items:[]},payload:{assetId:'gray-layout-trial',parameters:{}},intent:{intentId:'gray-layout-trial'},decision:{selectedAssetId:'gray-layout-trial'},meta:{sectionName:'灰稿美化'}}));
 ({presentation,slides}=await createNortheasternUniversityStarter({starterPptx:path.join(out,'runtime','university-starter.pptx'),pages,manuscriptSource:source}));
 }else{presentation=Presentation.create({slideSize:{width:1280,height:720}});slides=state.pages.map(()=>presentation.slides.add());}
 for(const [i,page] of state.pages.entries()){slide=slides[i];pageNum=i+1;if(skinId==='neutral')neutralHeader(page,i);await body(page);slide.speakerNotes.textFrame.setText(`[Sources]\n- ${source} · ${page.pageId}\n- 区域沿用 composition.regions；保留内容归属，制作说明转为本页图示\n- 模拟内容，人工验收 pending\n[/Sources]`);console.log(`${skinId} ${pageNum}/24`);}
 await (await PresentationFile.exportPptx(presentation)).save(path.join(out,`${skinId}.pptx`));
}
await closeHtmlComponentRuntime();
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify({source,status:'awaiting-user-review',humanReview:'pending',pages:state.pages.map((p,i)=>({page:i+1,pageId:p.pageId,title:p.title,skins:Object.fromEntries(['neutral','university'].map(s=>[s,{preview:`${s}/slide-${i+1}.png`,pptx:`${s}.pptx`}]))})),structureCalls:receipts},null,2));

