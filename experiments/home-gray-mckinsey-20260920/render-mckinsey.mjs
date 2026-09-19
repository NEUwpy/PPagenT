import fs from 'node:fs/promises';
import path from 'node:path';
import { Presentation, PresentationFile, FileBlob } from '../../src/ppt-engine/index.mjs';
import { createNortheasternUniversityStarter } from '../../src/runtime/skins/northeastern-university.mjs';
import { universityMckinseySkin, universityMckinseyTypography } from '../../src/runtime/skins/university-mckinsey.mjs';
import { resolveStructureTheme } from '../../src/visual-runtime/html-component-theme.mjs';
import { execFileSync } from 'node:child_process';
import { wrapChineseText } from '../../src/render/chinese-typography.mjs';
import { invokeStructure } from '../../.codex/skills/ppagent-structure/scripts/invoke.mjs';
import { validateBlueprint } from './visual-contract.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const frame = universityMckinseySkin.bodyFrame;
const t = universityMckinseyTypography;
const sizes = { page:t.title, heading:t.heading, label:t.heading, body:t.body, node:t.body, meta:t.meta };

export async function renderMckinsey(gray, blueprint, outputDir, {primaryColor = universityMckinseySkin.primaryColor} = {}) {
  if(!/^#[0-9a-f]{6}$/i.test(primaryColor)) throw new Error('primaryColor must be a six-digit hex color');
  const invalid = validateBlueprint(gray, blueprint);
  if (invalid.length) throw new Error(invalid.join('; '));
  await fs.mkdir(outputDir, { recursive: true });
  const theme = resolveStructureTheme({...universityMckinseySkin, primaryColor}), fonts = universityMckinseySkin.fonts;
  const page = gray.pages[0];
  const {presentation:p, slides:[slide]} = await createNortheasternUniversityStarter({
    starterPptx:path.join(outputDir,'template-starter.pptx'),
    manuscriptSource:'experiments/home-gray-magazine-20260919/input/gray-state.json',
    pages:[{content:{title:blueprint.headline},meta:{sectionName:blueprint.sectionTitle},
      payload:{assetId:'northeastern-university-body-001',parameters:{}},
      intent:{intentId:'gray-to-mckinsey'},decision:{selectedAssetId:'northeastern-university-body-001'}}],
  });
  await fs.writeFile(path.join(outputDir,'shell-before.layout.json'), await (await slide.export({format:'layout'})).text());
  const textBoxes = [], coverage = [], geometry = [];
  function measure(value, width, role) {
    const size = sizes[role];
    const lines = wrapChineseText(value, (width - 4) / (size * 1.04)).split('\n');
    return { lines, height: lines.length * (role === 'body' ? 26 : size * 1.38) };
  }
  function txt(value, x, y, width, role, name, color = theme.body, center = false) {
    const m = measure(value, width, role), lineH = m.height / m.lines.length;
    m.lines.forEach((line, i) => {
      const box = { left: x, top: y + i * lineH, width, height: lineH };
      const s = slide.shapes.add({ geometry: 'textbox', name: `${name}-${i}`, position: box, fill: 'none', line: { fill: 'none', width: 0 } });
      s.text = line;
      s.text.style = { typeface: role === 'page' ? fonts.display : fonts.body,
        fontSize: sizes[role], bold: ['page','heading','label'].includes(role), color,
        alignment: center ? 'center' : 'left', verticalAlignment: 'middle', autoFit: 'none',
        insets: { top: 0, right: 0, bottom: 0, left: 0 } };
      textBoxes.push({ name: `${name}-${i}`, text: line, role, ...box });
    });
    return m.height;
  }
  function rule(x, y, w, color = theme.line) {
    slide.shapes.add({ geometry: 'line', position: { left: x, top: y, width: w, height: 0 }, fill: 'none', line: { fill: color, width: 1 } });
  }
  function box(x,y,w,h,fill,name,radius=6) {
    slide.shapes.add({ name, geometry: 'roundRect', borderRadius: radius,
      position: { left:x,top:y,width:w,height:h }, fill, line: { fill:theme.line,width:1 } });
  }
  const gap = 32, totalWeight = blueprint.groupWeights.reduce((a,b)=>a+b,0);
  let x = frame.left;
  for (const [gi, group] of page.groups.entries()) {
    const width = (frame.width - gap*(page.groups.length-1))*blueprint.groupWeights[gi]/totalWeight;
    const top = frame.top;
    txt(group.heading,x,top,width,'heading',group.id,theme.primaryColor);
    rule(x,top+34,width);
    let y = top+48;
    for (const [bi, block] of group.blocks.entries()) {
      const bx = x + 36, bw = width - 36, start = y;
      txt(String(bi+1).padStart(2,'0'),x,y+1,29,'meta',`${block.id}-number`,theme.primaryColor);
      if (block.label) y += txt(block.label,bx,y,bw,'label',`${block.id}-label`,theme.dark) + 7;
      const d = blueprint.diagrams.find(d=>d.groupId===group.id && d.blockId===block.id);
      if (d) {
        if (d.context) y += txt(d.context,bx,y,bw,'body',`${block.id}-context`) + 8;
        const graphH = Math.max(222,d.inputs.length*74);
        const graphFrame = { left:bx,top:y,width:bw,height:graphH };
        await invokeStructure({ root,slide,skin:{...theme,bodyFrame:frame},targetFrame:graphFrame,
          references:[{assetId:d.assetId,preservedFeatures:['分离输入、平滑粗汇聚路径和唯一结果','所有路径真正接入结果']}],
          content:d,evidencePath:path.join(outputDir,'structure-invocations.ndjson'),pageId:page.pageId,regionId:block.id,reason:d.reason,
          build:async ({frame:f,content})=>{
            const inW = f.width*.49, outW=f.width*.275, outX=f.left+f.width-outW;
            const outH=100, outY=f.top+(f.height-outH)/2;
            const sourceColors=[theme.primaryPale,theme.primaryLight,theme.accentAlt,theme.primaryColor,theme.primaryDark,theme.primaryDeep];
            const nodes=content.inputs.map((s,i)=>{
              const h=Math.max(48,measure(s,inW-24,'node').height+16);
              const cy=f.top+(i+.5)*f.height/content.inputs.length;
              return {text:s,x:f.left,y:cy-h/2,w:inW,h,cy};
            });
            for(let i=0;i<nodes.length;i++) {
              if(nodes[i].y<f.top || nodes[i].y+nodes[i].h>f.top+f.height) throw new Error('Structure node exceeds its assigned frame');
              if(i && nodes[i].y-(nodes[i-1].y+nodes[i-1].h)<8) throw new Error('Structure input nodes require at least 8px separation');
            }
            // Same cubic control ratios as asset review.mjs:pathMarkup (.40/.32).
            // Sampled polyline paths remain editable in the native PPT engine.
            for (const [i,n] of nodes.entries()) {
              const sx=n.x+n.w, sy=n.cy, ex=outX, ey=outY+outH/2, span=ex-sx;
              const points=Array.from({length:49},(_,j)=>{
                const t=j/48,u=1-t;
                return {x:u*u*u*sx+3*u*u*t*(sx+span*.4)+3*u*t*t*(ex-span*.32)+t*t*t*ex,
                  y:u*u*u*sy+3*u*u*t*sy+3*u*t*t*ey+t*t*t*ey};
              });
              const minY=Math.min(sy,ey), h=Math.max(1,Math.abs(sy-ey));
              slide.shapes.add({geometry:'custom',name:`${block.id}-lane-${i}`,position:{left:sx,top:minY,width:span,height:h},
                fill:'none',line:{fill:sourceColors[i],width:7},
                customPaths:[{width:span,height:h,commands:points.map((v,k)=>({[k?'lineTo':'moveTo']:{x:v.x-sx,y:v.y-minY}}))}]});
              geometry.push({kind:'curve',from:[sx,sy],to:[ex,ey],resultBoundary:outX,controlRatios:[.4,.32]});
            }
            for(const [i,n] of nodes.entries()) {
              box(n.x,n.y,n.w,n.h,theme.surface,`${block.id}-input-${i}`);
              slide.shapes.add({geometry:'rect',name:`${block.id}-input-accent-${i}`,position:{left:n.x,top:n.y+6,width:5,height:n.h-12},fill:sourceColors[i],line:{fill:'none',width:0}});
              const h=measure(n.text,n.w-24,'node').height;
              txt(n.text,n.x+12,n.y+(n.h-h)/2,n.w-24,'node',`${block.id}-input-${i}`,theme.dark);
            }
            box(outX,outY,outW,outH,theme.primaryColor,`${block.id}-result`,12);
            const h=measure(content.result,outW-24,'node').height;
            txt(content.result,outX+12,outY+(outH-h)/2,outW-24,'node',`${block.id}-result`,theme.background,true);
            return {mode:'task-local-native-adaptation',source:'assets/结构图/多路汇聚结果-003/review.mjs',curves:nodes.length};
          }});
        y += graphH;
      } else {
        y += txt(block.text,bx,y,bw,'body',`${block.id}-body`);
      }
      coverage.push({groupId:group.id,blockId:block.id,sourceIds:block.sourceIds,kind:d?'diagram':'text',frame:{x,y:start,width,height:y-start}});
      if(y>frame.top+frame.height) throw new Error(`Capacity exceeded for ${group.id}/${block.id}: ${y} > ${frame.top+frame.height}; change proportions or return to planning`);
      if(bi<group.blocks.length-1){rule(x,y+12,width);y+=27;}
    }
    x += width + gap;
  }
  // Test actual text rectangles, not containing surfaces, against one another.
  const overlaps=[];
  for(let i=0;i<textBoxes.length;i++)for(let j=i+1;j<textBoxes.length;j++){
    const a=textBoxes[i],b=textBoxes[j];
    const w=Math.min(a.left+a.width,b.left+b.width)-Math.max(a.left,b.left);
    const h=Math.min(a.top+a.height,b.top+b.height)-Math.max(a.top,b.top);
    if(w>1 && h>1)overlaps.push([a.name,b.name]);
  }
  if(overlaps.length)throw new Error(`Text rectangles overlap: ${JSON.stringify(overlaps)}`);
  slide.speakerNotes.textFrame.setText(`[Sources]\n- Frozen gray input: experiments/home-gray-magazine-20260919/input/gray-state.json and gray.pptx\n- Source manuscript is retained in gray-state.json:sources.\n- Style: rules/排版体系/麦肯锡式.md and original Northeastern University template\n- Structure: convergence-many-to-one-003, task-local geometry adaptation from review.mjs\n[/Sources]`);
  const pptx=path.join(outputDir,'deck.pptx');
  await (await PresentationFile.exportPptx(p)).save(pptx);
  execFileSync(process.env.MCKINSEY_PYTHON, [path.join(import.meta.dirname,'preserve-theme.py'), pptx], {stdio:'inherit'});
  // Inspect final exported package through reimport, never substitute authoring preview.
  const final=await PresentationFile.importPptx(await FileBlob.load(pptx));
  await fs.writeFile(path.join(outputDir,'slide-01.png'),new Uint8Array(await (await final.export({slide:final.slides.items[0],format:'png',scale:1})).arrayBuffer()));
  await fs.writeFile(path.join(outputDir,'slide-01.layout.json'),await (await final.slides.items[0].export({format:'layout'})).text());
  const qa={slideCount:final.slides.items.length,nativeShapes:slide.shapes.items.length,images:slide.images.items.length,
    coverage,textBoxes,overlaps,geometry,primaryColor:theme.primaryColor,humanReview:'pending',semanticReview:'external-review-required',headline:blueprint.headline,headlineEvidence:blueprint.headlineEvidence,skin:'northeastern-university-001',structureExecution:'task-local migration adapter; not registered preserved-design'};
  await fs.writeFile(path.join(outputDir,'build-check.json'),JSON.stringify(qa,null,2));
  return {accepted:true,pptx,preview:path.join(outputDir,'slide-01.png'),coverage:coverage.map(x=>x.blockId),nativeShapes:qa.nativeShapes,
    note:'Program checks passed; actual image and causal membership still require review.'};
}
