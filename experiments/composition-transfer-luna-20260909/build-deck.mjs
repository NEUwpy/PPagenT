import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { PresentationFile } from "@oai/artifact-tool";
import { createNortheasternUniversityStarter } from "../../src/runtime/skins/northeastern-university.mjs";
import { invokeUniversityStructure, closeStructureRuntime, universityMckinseySkin, universityMckinseyTypography } from "../../src/runtime/invoke-university-structure.mjs";
import { resolveStructureTheme } from "../../src/visual-runtime/html-component-theme.mjs";
import { loadCompositionLayouts, resolveNormalizedFrame } from "../../src/composition/layouts.mjs";
import { renderPageComposition } from "../../src/render/page-composition.mjs";
import { addBox, addText, addLine, qaElementName } from "../../src/asset-runtime/component-builders.mjs";

const taskDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(taskDir, "..", "..");
const mode = process.argv[2] ?? "first";
const outDir = mode === "final" ? path.join(taskDir, "final") : path.join(taskDir, "first");
const outPptx = path.join(outDir, mode === "final" ? "deck-candidate.pptx" : "first-deck.pptx");
const qaDir = path.join(outDir, "qa");
const evidencePath = path.join(taskDir, "checks", "structure-invocations.ndjson");
const templatePath = path.join(root, "assets", "主题", "东北大学-001", "runtime-template.pptx");
const bodyFrame = universityMckinseySkin.bodyFrame;
const theme = resolveStructureTheme(universityMckinseySkin);
const layouts = await loadCompositionLayouts(root);

const pages = [
  { payload:{assetId:"northeastern-university-cover-001", parameters:{title:"共享实验平台试点决策", subtitle:"先验证记录能力，再讨论开放范围", presenter:"平台管理者与课题负责人", organization:"方案讨论稿｜全部为拟议安排", date:"2026.09"}}, content:{pageId:"COVER", title:"共享实验平台试点决策"}, meta:{sectionName:"试点方案"} },
  { payload:{assetId:"northeastern-university-agenda-001", parameters:{title:"目录", items:[{title:"准入与渐进",description:"谁能进入，进入后如何推进"},{title:"记录与处置",description:"如何保留责任归属"},{title:"扩围与暂停",description:"何时扩大，何时停下"}]}}, content:{pageId:"AGENDA", title:"目录"}, meta:{sectionName:"目录"} },
  { payload:{assetId:"northeastern-university-body-001", parameters:{}}, content:{pageId:"P1", title:"试点准入先看可追溯性，开放范围再按证据逐级扩大"}, meta:{sectionName:"准入与渐进"}, composition:{compositionId:"component-full", textSlots:[]} },
  { payload:{assetId:"northeastern-university-body-001", parameters:{}}, content:{pageId:"P2", title:"责任链必须与完整记录绑定，异常先补证据再关闭"}, meta:{sectionName:"记录与处置"}, composition:{compositionId:"editorial-dual-statement", textSlots:[
    {slotId:"left",sourceItemIds:["record"],contentMode:"all"},{slotId:"right",sourceItemIds:["gates"],contentMode:"all"}
  ]} },
  { payload:{assetId:"northeastern-university-body-001", parameters:{}}, content:{pageId:"P3", title:"扩围以能力达标为门槛，并保留清晰的暂停条件"}, meta:{sectionName:"扩围与暂停"}, composition:{compositionId:"component-full", textSlots:[]} },
  { payload:{assetId:"northeastern-university-closing-001", parameters:{text:"请讨论并确认：准入条件、异常复核责任与扩围门槛"}}, content:{pageId:"CLOSING", title:"请讨论并确认"}, meta:{sectionName:"收束"} }
];
pages.forEach((page) => {
  page.intent = { intentId: "composition-transfer-luna-20260909" };
  page.decision = { selectedAssetId: page.payload.assetId };
});

const p2Content = {
  items:[
    {id:"record", title:"四类记录并列", body:"申请来源、审批依据、执行结果、异常处置共同形成责任链，彼此不能互相替代。"},
    {id:"gates", title:"异常逐层收敛", body:"先核对记录是否完整，再确认责任是否明确，最后检查复核是否通过。任一条件不满足，补齐后再提交。"}
  ]
};

function addTextRole(slide, text, frame, role="body", options={}) {
  const sizes = universityMckinseyTypography;
  return addText(slide, text, frame, { name:qaElementName({within:options.within??"composition-transfer",role}), typeface:universityMckinseySkin.fonts.body, fontSize:sizes[role]??sizes.body, color:options.color??theme.body, bold:options.bold??false, alignment:options.alignment??"left", verticalAlignment:options.verticalAlignment??"top", autoFit:"none", insets:options.insets??{top:0,right:0,bottom:0,left:0} });
}

function drawPage2(slide) {
  const left = {left:78, top:204, width:610, height:398};
  const right = {left:756, top:204, width:430, height:398};
  addBox(slide,left,{name:qaElementName({within:"record-fields",role:"surface"}),geometry:"rect",fill:theme.primaryWash,line:{style:"solid",fill:theme.line,width:1},shadow:"shadow-none",borderRadius:0});
  addBox(slide,{left:left.left,top:left.top,width:left.width,height:6},{name:qaElementName({within:"record-fields",role:"accent"}),geometry:"rect",fill:theme.primaryColor,line:{style:"solid",fill:"none",width:0},shadow:"shadow-none",borderRadius:0});
  addTextRole(slide,"四类记录并列，形成完整责任链",{left:104,top:228,width:520,height:32},"heading",{color:theme.primaryColor,bold:true,within:"record-fields"});
  const rows = [
    ["01","申请来源","申请人与任务"],
    ["02","审批依据","责任人与时间"],
    ["03","执行结果","参数与输出"],
    ["04","异常处置","原因与结论"]
  ];
  rows.forEach((row,i)=>{
    const y=284+i*72;
    addTextRole(slide,row[0],{left:106,top:y,width:42,height:30},"body",{color:theme.muted,bold:true,within:"record-fields"});
    addTextRole(slide,row[1],{left:164,top:y,width:180,height:30},"heading",{color:theme.dark,bold:true,within:"record-fields"});
    addTextRole(slide,row[2],{left:372,top:y+2,width:260,height:28},"body",{color:theme.body,within:"record-fields"});
    if(i<rows.length-1) addBox(slide,{left:106,top:y+48,width:550,height:1},{geometry:"rect",fill:theme.line,line:{style:"solid",fill:"none",width:0},shadow:"shadow-none",borderRadius:0});
  });
  addTextRole(slide,"记录内容保证有据可查",{left:104,top:560,width:520,height:28},"meta",{color:theme.muted,within:"record-fields"});

  addTextRole(slide,"异常关闭需通过三道关口",{left:right.left,top:222,width:right.width,height:34},"heading",{color:theme.primaryColor,bold:true,within:"exception-gates"});
  const gates=[
    ["01","记录完整","缺项则补齐记录"],
    ["02","责任明确","确认由谁负责事实"],
    ["03","复核通过","确认结论可以关闭"]
  ];
  gates.forEach((g,i)=>{
    const y=286+i*82;
    addBox(slide,{left:right.left,top:y,width:46,height:46},{geometry:"ellipse",fill:theme.primaryPale,line:{style:"solid",fill:theme.primaryLight,width:1},shadow:"shadow-none",text:g[0],fontSize:14,typeface:universityMckinseySkin.fonts.body,bold:true,color:theme.primaryColor,autoFit:"none",insets:{top:0,right:0,bottom:0,left:0}});
    addTextRole(slide,g[1],{left:right.left+66,top:y-2,width:right.width-66,height:28},"heading",{color:theme.dark,bold:true,within:"exception-gates"});
    addTextRole(slide,g[2],{left:right.left+66,top:y+32,width:right.width-66,height:24},"body",{color:theme.body,within:"exception-gates"});
    if(i<gates.length-1) addBox(slide,{left:right.left+22,top:y+48,width:2,height:26},{geometry:"rect",fill:theme.line,line:{style:"solid",fill:"none",width:0},shadow:"shadow-none",borderRadius:0});
  });
  addBox(slide,{left:756,top:536,width:430,height:1},{geometry:"rect",fill:theme.line,line:{style:"solid",fill:"none",width:0},shadow:"shadow-none",borderRadius:0});
  addTextRole(slide,"课题负责人确认事实；平台管理者复核处理结论。意见不一致时保留异常，提交协调。",{left:756,top:554,width:430,height:52},"body",{color:theme.body,within:"role-handling"});
}

function drawP1Aside(slide) {
  addBox(slide,{left:790,top:220,width:6,height:370},{geometry:"rect",fill:theme.primaryLight,line:{style:"solid",fill:"none",width:0},shadow:"shadow-none",borderRadius:0});
  addTextRole(slide,"申请来源与准入条件",{left:816,top:218,width:410,height:30},"heading",{color:theme.primaryColor,bold:true,within:"screening"});
  addTextRole(slide,"课题自荐、平台推荐、合作项目",{left:816,top:258,width:410,height:30},"body",{color:theme.body,within:"screening"});
  addTextRole(slide,"逐项核对",{left:816,top:304,width:410,height:30},"heading",{color:theme.primaryColor,bold:true,within:"screening"});
  addTextRole(slide,"资格：明确设备使用条件\n责任：明确一位负责人\n记录：保存任务来源、执行参数和输出",{left:816,top:344,width:410,height:96},"body",{color:theme.body,within:"screening"});
  addTextRole(slide,"任一项缺失，暂缓进入试点",{left:816,top:448,width:410,height:30},"body",{color:theme.primaryColor,bold:true,within:"screening"});
  addTextRole(slide,"通过筛选后逐级发展",{left:816,top:488,width:410,height:30},"heading",{color:theme.primaryColor,bold:true,within:"evidence-ladder"});
  addTextRole(slide,"可记录：先留台账\n可追溯：关联来源、参数、输出\n可复用：复核后沉淀方法",{left:816,top:528,width:410,height:64},"body",{color:theme.body,within:"evidence-ladder"});
  addTextRole(slide,"前一阶段证据具备，才进入下一阶段。",{left:816,top:608,width:410,height:30},"body",{color:theme.primaryColor,bold:true,within:"scope-boundary"});
}

function drawP3Aside(slide) {
  addBox(slide,{left:900,top:220,width:6,height:370},{geometry:"rect",fill:theme.primaryLight,line:{style:"solid",fill:"none",width:0},shadow:"shadow-none",borderRadius:0});
  addTextRole(slide,"扩围边界",{left:924,top:218,width:300,height:30},"heading",{color:theme.primaryColor,bold:true,within:"expansion-boundaries"});
  addTextRole(slide,"人员：责任人可持续履职\n资源：设备与支持能力可覆盖\n方法：适用范围清楚，例外有记录",{left:924,top:258,width:300,height:84},"body",{color:theme.body,within:"expansion-boundaries"});
  addTextRole(slide,"推广与暂停",{left:924,top:366,width:300,height:30},"heading",{color:theme.primaryColor,bold:true,within:"pause-rule"});
  addTextRole(slide,"达到可复用前，不宣称跨项目推广\n任一边界无法满足，暂停扩围\n保留当前试点规模，明确补齐任务",{left:924,top:406,width:300,height:84},"body",{color:theme.body,within:"pause-rule"});
  addTextRole(slide,"下一步",{left:924,top:516,width:300,height:30},"heading",{color:theme.primaryColor,bold:true,within:"next-step"});
  addTextRole(slide,"下次先检查证据是否达到门槛，再讨论增加项目",{left:924,top:556,width:300,height:56},"body",{color:theme.body,within:"next-step"});
}

async function addBodyContent(slides) {
  const p1 = slides[2];
  const p2 = slides[3];
  const p3 = slides[4];
  drawP1Aside(p1);
  drawPage2(p2);
  drawP3Aside(p3);
  const p1Frame = {left:55, top:220, width:680, height:360};
  const p3Frame = {left:75, top:220, width:820, height:370};
  const p1Result = await invokeUniversityStructure({root,slide:p1,assetId:"convergence-simple-funnel-001",targetFrame:p1Frame,content:{inputs:[{key:"self",label:"课题自荐",iconQuery:"file"},{key:"platform",label:"平台推荐",iconQuery:"building"},{key:"partner",label:"合作项目",iconQuery:"handshake"}],steps:[{key:"qualification",title:"资格核对"},{key:"owner",title:"责任确认"},{key:"records",title:"记录准备"}]},evidencePath,pageId:"P1",regionId:"screening",reason:"三类申请来源需经过资格、责任与记录准备逐项筛选；漏斗保留共享中轴、分层收窄与随形导流，完整条件与证据阶梯由相邻文字区承载"});
  const p3Result = await invokeUniversityStructure({root,slide:p3,assetId:"progression-maturity-steps-002",targetFrame:p3Frame,content:{levels:[{key:"recordable",title:"可记录",body:"基本台账齐全"},{key:"traceable",title:"可追溯",body:"来源、参数、输出相互关联"},{key:"reusable",title:"可复用",body:"关键步骤经复核，边界清楚"}],showStatus:false},evidencePath,pageId:"P3",regionId:"capability-levels",reason:"三个能力门槛沿连续阶台递进；阶内保留能力定义，人员、资源、方法边界与失败后的暂停处置由右侧文字区承载"});
  return {p1Result,p3Result};
}

await fs.mkdir(outDir,{recursive:true});
await fs.mkdir(qaDir,{recursive:true});
await fs.mkdir(path.dirname(evidencePath),{recursive:true});
const {presentation,slides} = await createNortheasternUniversityStarter({starterPptx:path.join(outDir,".runtime","template-starter.pptx"),pages,manuscriptSource:"experiments/university-multi-structure-07/manuscript.md"});
await addBodyContent(slides);
await fs.mkdir(path.dirname(outPptx),{recursive:true});
const exported = await PresentationFile.exportPptx(presentation);
await exported.save(outPptx);
await closeStructureRuntime();
console.log(JSON.stringify({mode,outPptx,qaDir,evidencePath,slides:slides.length},null,2));
