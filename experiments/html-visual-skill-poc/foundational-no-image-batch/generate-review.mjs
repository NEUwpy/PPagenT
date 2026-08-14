import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";
import {
  renderComponentIntoSlide,
} from "../../../src/asset-runtime/component-builders.mjs";
import {
  buildComparison, buildFrameworkMatrix, buildHierarchyPyramid,
  buildLayeredArchitectureAdaptive, buildSequentialProcess,
} from "../../../src/asset-runtime/component-builders.mjs";
import { buildFishboneAnalysis } from "../../../src/asset-runtime/analysis-model-builders.mjs";
import { academicReportShell } from "../../../src/runtime/shells/academic-report.mjs";

const here = import.meta.dirname;
const projectRoot = path.resolve(here, "../../..");
function parseArgs(argv){
  const values={input:"batch-input.json",out:"output"};
  for(let i=0;i<argv.length;i+=2){ const key=argv[i]?.replace(/^--/,""),value=argv[i+1]; if(!key||value===undefined||!(key in values)) throw new Error(`不支持的参数：${argv[i]??"<empty>"}`); values[key]=value; }
  return values;
}
const args=parseArgs(process.argv.slice(2));
const inputPath = path.resolve(here, args.input);
const outputDir = path.resolve(here, args.out);
const sourcePptx = path.join(projectRoot, "PPT源", "PPT模板-封面正文尾页.pptx");
const frame = academicReportShell.slots.contentFrame;
const theme = { background: "#FFFFFF", surface: "#FFFFFF", accent: "#2F5EA8", accentAlt: "#4C88E8", accentSoft: "#DCE9FA", cyan: "#18B5D2", dark: "#2B2B2B", body: "#404040", muted: "#6F7D91", line: "#AFC6E8", font: "Microsoft YaHei" };

function parseRows(snapshot) { return snapshot.ndjson.split(/\r?\n/).filter(Boolean).map(JSON.parse); }
function one(rows, slide, kind, match, label) {
  const found = rows.filter((x) => x.slide === slide && x.kind === kind && match(x));
  if (found.length !== 1) throw new Error(`第 ${slide} 页 ${label} 匹配 ${found.length} 个`);
  return found[0];
}

async function editShell(deck, slideNumber, group) {
  const rows = parseRows(await deck.inspect({ kind: "textbox,shape,image", include: "id,slide,kind,name,text", maxChars: 300000 }));
  const replace = (source, value, style) => {
    const target = deck.resolve(one(rows, slideNumber, "textbox", (x) => x.text === source, source).id);
    target.text.replace(source, value);
    if (style) target.text.style = { ...target.text.style, ...style };
  };
  replace("01", String(slideNumber).padStart(2, "0"));
  replace("正文页", group.section);
  replace("主旨句", `${group.title}｜${group.state}`, { typeface: "HYWenRunSongYun U", fontSize: 30, bold: true, autoFit: "none" });
  deck.resolve(one(rows, slideNumber, "textbox", (x) => x.text === "正文", "正文占位符").id).text = "";
  deck.resolve(one(rows, slideNumber, "shape", (x) => x.name === "箭头: 下 9", "来源箭头").id).delete();
  deck.resolve(one(rows, slideNumber, "image", (x) => x.name === "图片 10", "来源图片").id).delete();
}

function buildParallel(slide, data) {
  const count = data.items.length, gap = 20, left = 78, width = (1124 - gap * (count - 1)) / count;
  data.items.forEach((item, i) => {
    const x = left + i * (width + gap);
    slide.shapes.add({ geometry:"roundRect", position:{left:x,top:190,width,height:390}, fill:i%2?"#F1F8FF":"#F7FBFF", line:{style:"solid",fill:i%2?"#7EB7ED":"#A8CBEA",width:1.4}, shadow:"shadow-sm", borderRadius:"rounded-xl" });
    slide.shapes.add({ geometry:"rect", position:{left:x,top:190,width,height:8}, fill:i%2?"#4C88E8":"#2F5EA8", line:{style:"solid",fill:"none",width:0} });
    const disk=slide.shapes.add({geometry:"ellipse",position:{left:x+20,top:222,width:54,height:54},fill:i%2?"#4C88E8":"#2F5EA8",line:{style:"solid",fill:"#FFFFFF",width:2}}); disk.text=String(i+1).padStart(2,"0"); disk.text.style={typeface:"Microsoft YaHei",fontSize:17,bold:true,color:"#FFFFFF",alignment:"center",verticalAlignment:"middle",insets:{top:0,right:0,bottom:0,left:0}};
    const title=slide.shapes.add({geometry:"textbox",position:{left:x+20,top:310,width:width-40,height:55},fill:"none",line:{style:"solid",fill:"none",width:0}}); title.text=item.title; title.text.style={typeface:"Microsoft YaHei",fontSize:22,bold:true,color:"#174D87",alignment:"center",verticalAlignment:"middle",autoFit:"shrinkText",insets:{top:0,right:0,bottom:0,left:0}};
    const body=slide.shapes.add({geometry:"textbox",position:{left:x+22,top:382,width:width-44,height:100},fill:"none",line:{style:"solid",fill:"none",width:0}}); body.text=item.body; body.text.style={typeface:"Microsoft YaHei",fontSize:17,color:"#607895",alignment:"center",verticalAlignment:"top",autoFit:"shrinkText",insets:{top:0,right:0,bottom:0,left:0}};
  });
}

function cycleSegmentPath(size, startDeg, sweepDeg, outerRadius = 150, innerRadius = 92) {
  const c=size/2, point=(r,d)=>({x:c+r*Math.cos(d*Math.PI/180),y:c+r*Math.sin(d*Math.PI/180)});
  const gap=Math.min(8,sweepDeg*0.14), start=startDeg+gap/2, sweep=sweepDeg-gap, n=Math.max(10,Math.ceil(sweep/5));
  const outer=Array.from({length:n+1},(_,i)=>point(outerRadius,start+i*sweep/n));
  const inner=Array.from({length:n+1},(_,i)=>point(innerRadius,start+sweep-i*sweep/n));
  const tip=point((outerRadius+innerRadius)/2,start+sweep+5);
  return [{width:size,height:size,commands:[{moveTo:outer[0]},...outer.slice(1).map(lineTo=>({lineTo})),{lineTo:tip},...inner.map(lineTo=>({lineTo})),{close:{}}]}];
}

function addNativeText(slide,text,position,{fontSize=18,bold=false,color="#404040",align="left"}={}){
  const shape=slide.shapes.add({geometry:"textbox",position,fill:"none",line:{style:"solid",fill:"none",width:0}}); shape.text=text; shape.text.style={typeface:"Microsoft YaHei",fontSize,bold,color,alignment:align,verticalAlignment:"middle",autoFit:"shrinkText",insets:{top:0,right:0,bottom:0,left:0}}; return shape;
}

function buildCyclePdca(slide,data){
  const steps=data.steps, size=330, cx=640, cy=407, left=cx-size/2, top=cy-size/2, sweep=360/steps.length, palette=["#315FC3","#2D80D9","#1AA7D8","#18BFD0","#4672D1","#3459B6"];
  steps.forEach((step,i)=>{
    slide.shapes.add({geometry:"custom",position:{left,top,width:size,height:size},fill:palette[i%palette.length],line:{style:"solid",fill:"#FFFFFF",width:2},customPaths:cycleSegmentPath(size,-90+i*sweep,sweep),shadow:"shadow-none"});
    const a=(-90+(i+.5)*sweep)*Math.PI/180, r=121, bx=cx+r*Math.cos(a)-24, by=cy+r*Math.sin(a)-24;
    const badge=slide.shapes.add({geometry:"ellipse",position:{left:bx,top:by,width:48,height:48},fill:"#FFFFFF",line:{style:"solid",fill:palette[i%palette.length],width:2}}); badge.text=String(i+1).padStart(2,"0"); badge.text.style={typeface:"Microsoft YaHei",fontSize:16,bold:true,color:palette[i%palette.length],alignment:"center",verticalAlignment:"middle",insets:{top:0,right:0,bottom:0,left:0}};
  });
  const center=slide.shapes.add({geometry:"ellipse",position:{left:cx-76,top:cy-76,width:152,height:152},fill:"#2459AE",line:{style:"solid",fill:"#FFFFFF",width:3},shadow:"shadow-md"}); center.text="持续改进"; center.text.style={typeface:"Microsoft YaHei",fontSize:22,bold:true,color:"#FFFFFF",alignment:"center",verticalAlignment:"middle",insets:{top:4,right:4,bottom:4,left:4}};
  const leftSteps=steps.map((s,i)=>({s,i})).filter(x=>x.i%2===0), rightSteps=steps.map((s,i)=>({s,i})).filter(x=>x.i%2===1);
  const render=(arr,side)=>{ const h=86,gap=18,total=arr.length*h+(arr.length-1)*gap,start=cy-total/2; arr.forEach(({s,i},row)=>{ const x=side==="left"?72:938,y=start+row*(h+gap); const card=slide.shapes.add({geometry:"roundRect",position:{left:x,top:y,width:270,height:h},fill:"#FFFFFF",line:{style:"solid",fill:"#D4E3F1",width:1.2},shadow:"shadow-sm",borderRadius:"rounded-lg"}); const disk=slide.shapes.add({geometry:"ellipse",position:{left:side==="left"?x+210:x+14,top:y+19,width:48,height:48},fill:palette[i%palette.length],line:{style:"solid",fill:"#FFFFFF",width:2}}); disk.text=String(i+1).padStart(2,"0"); disk.text.style={typeface:"Microsoft YaHei",fontSize:16,bold:true,color:"#FFFFFF",alignment:"center",verticalAlignment:"middle",insets:{top:0,right:0,bottom:0,left:0}}; const tx=side==="left"?x+16:x+72; addNativeText(slide,s.title,{left:tx,top:y+10,width:182,height:28},{fontSize:19,bold:true,color:palette[i%palette.length],align:side==="left"?"left":"left"}); addNativeText(slide,s.body,{left:tx,top:y+40,width:182,height:34},{fontSize:16,color:"#607895"}); }); };
  render(leftSteps,"left"); render(rightSteps,"right");
}

const builders = {
  sequence: [buildSequentialProcess, (d) => ({ title:"结构", steps:d.items })],
  comparison: [buildComparison, (d) => ({ title:"结构", left:{...d.left,polarity:"neutral"}, right:{...d.right,polarity:"positive"}, centerLabel:"VS" })],
  hierarchy: [buildHierarchyPyramid, (d) => ({ title:"结构", levels:d.levels })],
  matrix: [buildFrameworkMatrix, (d) => ({ title:"结构", quadrants:d.quadrants })],
  causal: [buildFishboneAnalysis, (d) => ({ title:"结构", effect:d.effect, branches:d.branches })],
  layered: [buildLayeredArchitectureAdaptive, (d) => ({ title:"结构", ...d })],
};

function componentHtml(group) {
  const css = path.relative(outputDir, path.join(here,"components.css")).split(path.sep).join("/");
  const js = path.relative(outputDir, path.join(here,"components.js")).split(path.sep).join("/");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><link rel="stylesheet" href="${css}"></head><body><main id="frame"></main><script src="${js}"></script><script>renderStyleGroup(document.querySelector('#frame'),${JSON.stringify(group).replace(/</g,"\\u003c")})</script></body></html>`;
}

async function renderHtml(groups) {
  const require=createRequire(import.meta.url); const {chromium}=require("playwright");
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH});
  try { for(const [index,group] of groups.entries()){ const stem=`${String(index+1).padStart(2,"0")}-${group.skillId}-${String(group.state).replaceAll(/[^\p{L}\p{N}]+/gu,"-")}`; const html=path.join(outputDir,`${stem}.html`); await fs.writeFile(html,componentHtml(group),"utf8"); const page=await browser.newPage({viewport:{width:frame.width,height:frame.height}}); await page.goto(`file:///${html.replaceAll("\\","/")}`,{waitUntil:"networkidle"}); await page.screenshot({path:path.join(outputDir,`html-${stem}.png`)}); await page.close(); } } finally { await browser.close(); }
}

function expandGroups(input){
  if(Array.isArray(input.groups)) return input.groups;
  if(!Array.isArray(input.expansions)) throw new Error("输入必须包含 groups 或 expansions");
  const groups=[];
  for(const spec of input.expansions){
    if(Array.isArray(spec.states)){
      for(const state of spec.states) groups.push({...spec,state:state.label,data:state.data,states:undefined});
      continue;
    }
    for(const count of spec.stateCounts){
      let data;
      if(spec.type==="comparison") data={left:{...spec.data.left,items:spec.data.left.items.slice(0,count)},right:{...spec.data.right,items:spec.data.right.items.slice(0,count)}};
      else if(spec.type==="layered") data={platform:spec.data.platform,sources:spec.data.sources.slice(0,count),apps:spec.data.apps.slice(0,count)};
      else if(spec.type==="causal") data={effect:spec.data.effect,branches:spec.data.branches.slice(0,count)};
      else if(spec.type==="hierarchy") data={levels:spec.data.levels.slice(0,count)};
      else if(spec.type==="cycle") data={steps:spec.data.steps.slice(0,count)};
      else data={items:spec.data.items.slice(0,count)};
      const suffix=spec.type==="comparison"?`2组×${count}项`:spec.type==="layered"?`${count}+1+${count}`:spec.type==="hierarchy"?`${count}层`:spec.type==="cycle"?`${count}步`:spec.type==="causal"?`${count}类原因`:`${count}项`;
      groups.push({...spec,state:suffix,data,stateCounts:undefined});
    }
  }
  return groups;
}

async function main(){
  const input=JSON.parse(await fs.readFile(inputPath,"utf8")), groups=expandGroups(input); await fs.mkdir(outputDir,{recursive:true}); await renderHtml(groups);
  const deck=await PresentationFile.importPptx(await FileBlob.load(sourcePptx)); const originals=[...deck.slides.items], source=originals[2]; const slides=groups.map(()=>source.duplicate()); originals.forEach(x=>x.delete()); slides.forEach((s,i)=>s.moveTo(i));
  for(let i=0;i<groups.length;i+=1){ const group=groups[i], slide=slides[i]; await editShell(deck,i+1,group); if(group.type==="parallel") buildParallel(slide,group.data); else if(group.type==="cycle") buildCyclePdca(slide,group.data); else { const [builder,map]=builders[group.type]; renderComponentIntoSlide(builder,slide,map(group.data),{sourceFrame:{left:40,top:135,width:1200,height:520},targetFrame:frame,theme}); } slide.speakerNotes.textFrame.setText(`[Sources]\n- Shell：PPT源/PPT模板-封面正文尾页.pptx 第 3 页\n- Style Group 来源：${group.source}\n- 结构：${group.skillId} / ${group.styleGroupId} / ${group.state}\n- 媒体契约：no-image\n[/Sources]`); }
  const output=path.join(outputDir,`${input.outputName}.pptx`); (await PresentationFile.exportPptx(deck)).save(output);
  for(let i=0;i<slides.length;i+=1){ const png=await deck.export({slide:slides[i],format:"png",scale:1}); await fs.writeFile(path.join(outputDir,`pptx-${String(i+1).padStart(2,"0")}-${groups[i].skillId}-${String(groups[i].state).replaceAll(/[^\p{L}\p{N}]+/gu,"-")}.png`),Buffer.from(await png.arrayBuffer())); }
  const inspect=await deck.inspect({kind:"slide,textbox,shape,image,notes",maxChars:500000}); await fs.writeFile(path.join(outputDir,"inspection.ndjson"),inspect.ndjson,"utf8");
  await fs.writeFile(path.join(outputDir,"run-summary.json"),JSON.stringify({shell:academicReportShell.id,contentFrame:frame,mediaContract:"no-image",groups:groups.map(({skillId,styleGroupId,source,state})=>({skillId,styleGroupId,source,state,status:"candidate"})),outputPptx:path.basename(output)},null,2),"utf8");
  console.log(output);
}
main().catch(e=>{console.error(e);process.exitCode=1});
