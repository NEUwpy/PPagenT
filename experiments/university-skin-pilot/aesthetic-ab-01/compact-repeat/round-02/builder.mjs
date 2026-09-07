import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { FileBlob, Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = path.resolve("experiments/university-skin-pilot/aesthetic-ab-01/compact-repeat/round-02");
const PPTX = path.join(OUT, "deck.pptx");
const FONT = "Microsoft YaHei";
const C = { primary:"#315F91", ink:"#252B33", muted:"#707780", bg:"#FFFFFF", paleBlue:"#EAF2F9", pale:"#F4F7FA", line:"#D7DEE6", white:"#FFFFFF" };
const linePaths = [];
const connections = [];
let activeSlide = 0;

async function writeBlob(filePath, blob) { await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer())); }
function shapeBox(slide, name, x, y, w, h, fill, rounded = false, stroke = "none") {
  return slide.shapes.add({ geometry: rounded ? "roundRect" : "rect", name, position:{left:x,top:y,width:w,height:h}, fill,
    line:{style:"solid",fill:stroke,width:stroke === "none" ? 0 : 1}, ...(rounded ? {borderRadius:"rounded-md"} : {}) });
}
function text(slide, name, value, x, y, w, h, size, color=C.ink, bold=false, align="left", vertical="top") {
  const s = slide.shapes.add({ geometry:"textbox", name, position:{left:x,top:y,width:w,height:h}, fill:"none", line:{style:"solid",fill:"none",width:0} });
  s.text = value;
  s.text.style = {fontSize:size,color,bold,typeface:FONT,alignment:align,verticalAlignment:vertical,wrap:"square",autoFit:"shrinkText",insets:{top:0,right:0,bottom:0,left:0}};
  if (align === "center") s.text.alignment = "center";
  if (vertical === "middle") s.text.verticalAlignment = "middle";
  return s;
}
function rule(slide, name, x, y, w, h=1, fill=C.line, relation="separator") {
  shapeBox(slide,name,x,y,w,h,fill,false,"none");
  linePaths.push({slide:activeSlide,id:name,type:"line-path",x1:x,y1:y+h/2,x2:x+w,y2:y+h/2,relation,separator:relation === "separator"});
}
function title(slide, n, value) { text(slide,`slide-${n}-title`,value,55,38,1170,48,30,C.ink,true); rule(slide,`slide-${n}-divider`,55,98,1170,1,C.line,"title-divider"); }
function footer(slide, n) { text(slide,`footer-${n}`,`实验归档试点｜拟定分析  ·  ${n}/4`,55,688,1170,18,12,C.muted); }

function makeSlide1(slide) {
  activeSlide=1; slide.background.fill=C.bg;
  title(slide,1,"一组可追溯记录共同解释一次结果");
  shapeBox(slide,"record-analysis",55,150,790,480,C.pale,false,"none");
  text(slide,"record-analysis-label","记录单元｜共同解释同一结果",80,174,700,30,21,C.ink,true);
  text(slide,"record-analysis-note","五项是并列依据，不是五个先后步骤。",80,206,700,24,16,C.muted);
  const rows=[
    ["原始数据位置","说明这份结果对应哪一处原始数据。"],
    ["样本与采集条件","保留样本、采集条件和原始数据背景。"],
    ["处理脚本版本","定位实际运行代码。"],
    ["结果文件","保留结果图、表和输出文件的落点。"],
    ["异常及排除说明","未纳入结果的样本也保留排除依据。"]
  ];
  rows.forEach((r,i)=>{const y=252+i*67; text(slide,`record-row-${i+1}-label`,r[0],80,y,220,28,21,C.primary,true); text(slide,`record-row-${i+1}-body`,r[1],320,y+2,465,28,18,C.ink); if(i<rows.length-1)rule(slide,`record-row-${i+1}-rule`,80,y+48,705,1,C.line,"record-row-divider");});
  text(slide,"record-boundary-note","原始数据保持原貌，清洗处理另存；脚本版本定位实际运行代码。",80,578,705,28,16,C.muted);
  shapeBox(slide,"access-boundary",885,150,340,480,C.paleBlue,false,"none");
  text(slide,"access-boundary-title","访问边界",910,176,290,30,21,C.primary,true);
  text(slide,"access-boundary-body","记录完整不意味着全部文件开放。\n\n讨论材料含结果图与可公开解释。\n\n受限数据保留原授权位置；记录只含受控引用与访问条件。\n\n路径不代表访问权。",910,224,290,280,18,C.ink);
  footer(slide,1);
}

function makeSlide2(slide) {
  activeSlide=2; slide.background.fill=C.bg;
  title(slide,2,"范围选择：先记新增，再补真正需要复核的历史");
  shapeBox(slide,"history-column",55,150,520,465,C.pale,false,"none");
  shapeBox(slide,"new-column",705,150,520,465,C.paleBlue,false,"none");
  text(slide,"history-title","集中补历史",80,176,470,30,21,C.ink,true);
  text(slide,"new-title","先记新增",730,176,470,30,21,C.primary,true);
  const rows=[
    ["收益","一次形成较大目录","上下文清楚时记录新增实验"],
    ["代价","追查遗失上下文耗时；\n不确定记忆可能写成确定说明","短期无法解决全部历史材料追溯"],
    ["判断","暂不作为第一步","建议先做；历史结果逐项补充"]
  ];
  rows.forEach((r,i)=>{const y=240+i*112; if(i>0){rule(slide,`compare-row-${i}-rule`,80,y-22,1120,1,C.line,"comparison-row-divider");} text(slide,`compare-row-${i+1}-dimension`,r[0],590,y+18,100,24,21,C.ink,true,"center","middle"); text(slide,`compare-row-${i+1}-history-text`,r[1],80,y,470,66,18,C.ink); text(slide,`compare-row-${i+1}-new-text`,r[2],730,y,470,66,18,C.ink);});
  rule(slide,"slide-2-boundary-rule",55,635,1170,1,C.line,"boundary-divider");
  text(slide,"slide-2-boundary-text","这是范围选择，没有证明效率提升。",55,646,1170,24,16,C.muted);
  footer(slide,2);
}

function makeSlide3(slide) {
  activeSlide=3; slide.background.fill=C.bg;
  title(slide,3,"复核按提交、定位、补充、确认推进");
  text(slide,"review-boundary-text","复核检查结果如何产生；不要求复做实验，也不代替科学结论审查。",55,126,1170,24,16,C.muted);
  const xs=[55,345,635,925], titles=["提交","定位缺项","补充","确认"], bodies=["执行者提交结果记录及受控引用。","另一成员定位数据、脚本、条件，提出缺项。","执行者补充缺项和说明。","负责人确认后进入可讨论版本。"];
  const nodes=xs.map((x,i)=>shapeBox(slide,`review-node-${i+1}`,x,205,250,176,C.white,true,C.line));
  for(let i=0;i<3;i++){const c=slide.shapes.connect(nodes[i],nodes[i+1],{kind:"straight",fromSide:"right",toSide:"left",line:{style:"solid",fill:C.primary,width:2},tail:{type:"triangle",width:"sm",length:"sm"}}); connections.push({slide:3,id:c.id,source:`review-node-${i+1}`,target:`review-node-${i+2}`,arrowAt:"target",sourceText:titles[i],targetText:titles[i+1],basis:"原稿复核顺序"});}
  xs.forEach((x,i)=>{text(slide,`review-node-${i+1}-title`,titles[i],x+20,226,210,30,21,i===3?C.primary:C.ink,true,"center","middle"); text(slide,`review-node-${i+1}-body`,bodies[i],x+20,276,210,82,18,C.ink,false,"center","middle");});
  rule(slide,"exception-rule",55,445,1170,1,C.line,"exception-divider");
  text(slide,"exception-title","新增访问授权",55,470,170,28,21,C.primary,true);
  const exSpecs=[
    {x:285,w:170,title:"触发",body:"新增访问授权"},
    {x:570,w:170,title:"暂停共享",body:"等待授权处理"},
    {x:855,w:300,title:"负责人处理授权后继续",body:"恢复共享"}
  ];
  const ex=exSpecs.map((s,i)=>shapeBox(slide,`exception-node-${i+1}`,s.x,450,s.w,80,"none",true,"none"));
  exSpecs.forEach((s,i)=>{
    text(slide,`exception-node-${i+1}-title`,s.title,s.x+8,461,s.w-16,26,21,C.ink,true,"center","middle");
    text(slide,`exception-node-${i+1}-body`,s.body,s.x+8,499,s.w-16,20,18,C.muted,false,"center","middle");
  });
  for(let i=0;i<2;i++){const c=slide.shapes.connect(ex[i],ex[i+1],{kind:"straight",fromSide:"right",toSide:"left",line:{style:"solid",fill:C.primary,width:1.5},tail:{type:"triangle",width:"sm",length:"sm"}}); connections.push({slide:3,id:c.id,source:`exception-node-${i+1}-title`,target:`exception-node-${i+2}-title`,arrowAt:"target",sourceText:i===0?"触发":"暂停共享",targetText:i===0?"暂停共享":"负责人处理授权后继续",basis:"原稿新增访问授权条件"});}
  text(slide,"exception-note","遇到新增访问授权，主路径暂停；授权处理后继续。",55,532,1170,26,16,C.muted);
  footer(slide,3);
}

function makeSlide4(slide) {
  activeSlide=4; slide.background.fill=C.bg;
  title(slide,4,"四周试点的去留由复核过程和成员反馈决定");
  text(slide,"pilot-scope-title","试点范围（拟定）",55,140,240,30,21,C.primary,true);
  text(slide,"pilot-scope-body","仅一个课题方向\n两名自愿成员\n记录新增实验",55,188,240,88,18,C.ink);
  rule(slide,"scope-divider",320,140,1,170,C.line,"scope-divider");
  text(slide,"timeline-title","四周推进",365,140,200,30,21,C.ink,true);
  rule(slide,"timeline-axis",430,210,700,2,C.primary,"timeline-axis");
  const weeks=[["第 1 周","确认最少字段；\n试填一个结果"],["第 2–3 周","记录缺项和\n填写负担"],["第 4 周","决定保留、\n修改或停止"]]; const wx=[520,760,1000];
  wx.forEach((x,i)=>{slide.shapes.add({geometry:"ellipse",name:`week-${i+1}-dot`,position:{left:x,top:200,width:22,height:22},fill:i===2?C.primary:C.white,line:{style:"solid",fill:C.primary,width:2}}); text(slide,`week-${i+1}-title`,weeks[i][0],x-70,240,160,28,21,i===2?C.primary:C.ink,true,"center"); text(slide,`week-${i+1}-body`,weeks[i][1],x-90,278,200,44,18,C.ink,false,"center");});
  rule(slide,"lower-divider",55,370,1170,1,C.line,"group-divider");
  text(slide,"evaluation-group-title","评估依据",55,400,510,30,21,C.primary,true);
  text(slide,"evaluation-group-body","来源能否定位\n处理与排除依据能否理解\n负担是否愿意长期承担",55,448,510,88,18,C.ink);
  text(slide,"evaluation-group-note","依据具体复核过程及成员反馈；不设统一分数。",55,564,510,28,16,C.muted);
  rule(slide,"lower-column-divider",640,400,1,208,C.line,"group-column-divider");
  text(slide,"stop-group-title","缩小要求或停止",680,400,545,30,21,C.primary,true);
  text(slide,"stop-group-body","持续挤占实验时间\n权限不明\n只有重复抄写而不帮助解释结果",680,448,545,88,18,C.ink);
  text(slide,"stop-group-note","上述范围为拟定，没有实测效率或完成率。",680,564,545,28,16,C.muted);
  footer(slide,4);
}

async function main(){
  await fs.mkdir(OUT,{recursive:true});
  const pres=Presentation.create({slideSize:{width:1280,height:720}});
  makeSlide1(pres.slides.add()); makeSlide2(pres.slides.add()); makeSlide3(pres.slides.add()); makeSlide4(pres.slides.add());
  for(const [i,slide] of pres.slides.items.entries()){const l=await slide.export({format:"layout"}); await fs.writeFile(path.join(OUT,`slide-${i+1}.layout.json`),await l.text());}
  const pptx=await PresentationFile.exportPptx(pres); await pptx.save(PPTX);
  const imported=await PresentationFile.importPptx(await FileBlob.load(PPTX));
  const snap=await imported.inspect({kind:"slide,textbox,shape",maxChars:300000}); await fs.writeFile(path.join(OUT,"actual-text.ndjson"),snap.ndjson??JSON.stringify(snap,null,2));
  await fs.writeFile(path.join(OUT,"connections.json"),JSON.stringify(connections,null,2)); await fs.writeFile(path.join(OUT,"line-paths.json"),JSON.stringify(linePaths,null,2));
  const hash=crypto.createHash("sha256").update(await fs.readFile(PPTX)).digest("hex"); await fs.writeFile(path.join(OUT,"final-hash.txt"),`${hash}  deck.pptx\n`);
  await fs.writeFile(path.join(OUT,"report.txt"),`Generated 4-slide native editable PPTX in round-02.\nPPTX: ${PPTX}\nSHA-256: ${hash}\nStructure calls: none; reference-only usage recorded in structure-usage.txt.\nVisual QA is intentionally left to the parent task; deterministic checks are run after this build.\n`);
}
main().catch(err=>{console.error(err);process.exitCode=1;});
