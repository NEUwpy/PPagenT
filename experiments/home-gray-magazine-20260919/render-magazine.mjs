import fs from 'node:fs/promises';
import path from 'node:path';
import { Presentation, PresentationFile, FileBlob } from '../../src/ppt-engine/index.mjs';
import { derivePrimaryTheme } from '../../src/runtime/skins/primary-tone-palette.mjs';
import { neutralPaint } from '../../src/visual-runtime/neutral-structure-theme.mjs';
import { wrapChineseText } from '../../src/render/chinese-typography.mjs';
import { invokeStructure } from '../../.codex/skills/ppagent-structure/scripts/invoke.mjs';
import { validateBlueprint } from './visual-contract.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const frame = { left: 56, top: 112, width: 1168, height: 536 };
const sizes = { page: 25, heading: 21, label: 21, body: 17, node: 17, meta: 15 };

export async function renderMagazine(gray, blueprint, outputDir) {
  const invalid = validateBlueprint(gray, blueprint);
  if (invalid.length) throw new Error(invalid.join('; '));
  await fs.mkdir(outputDir, { recursive: true });
  const asset = JSON.parse(await fs.readFile(path.join(root, 'assets/主题/中性编辑排版-001/asset.json'), 'utf8'));
  const theme = derivePrimaryTheme(asset, asset.mainColor), fonts = asset.fonts;
  const p = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const slide = p.slides.add(); slide.background.fill = theme.background;
  const textBoxes = [], coverage = [], geometry = [];
  function measure(value, width, role) {
    const size = sizes[role];
    const lines = wrapChineseText(value, (width - 4) / (size * 1.04)).split('\n');
    return { lines, height: lines.length * (role === 'body' ? 27 : size * 1.38) };
  }
  function txt(value, x, y, width, role, name, color = theme.body, center = false) {
    const m = measure(value, width, role), lineH = m.height / m.lines.length;
    m.lines.forEach((line, i) => {
      const box = { left: x, top: y + i * lineH, width, height: lineH };
      const s = slide.shapes.add({ geometry: 'textbox', name: `${name}-${i}`, position: box, fill: 'none', line: { fill: 'none', width: 0 } });
      s.text = line;
      s.text.style = { typeface: ['page','heading','label','node'].includes(role) ? fonts.display : fonts.body,
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
  const page = gray.pages[0];
  txt('01',56,32,32,'meta','chapter',theme.primaryColor);
  const titleWidth = Math.min(950, [...page.title].length * sizes.page * 1.06 + 8);
  txt(page.title,104,28,titleWidth,'page','title',theme.dark);
  rule(104 + titleWidth + 28, 47, 1224 - (104 + titleWidth + 28));
  txt('01',1194,676,30,'meta','page-number',theme.muted);
  const gap = 38, totalWeight = blueprint.groupWeights.reduce((a,b)=>a+b,0);
  let x = frame.left;
  for (const [gi, group] of page.groups.entries()) {
    const width = (frame.width - gap*(page.groups.length-1))*blueprint.groupWeights[gi]/totalWeight;
    const top = frame.top;
    txt(group.heading,x,top,width,'heading',group.id,theme.primaryColor);
    rule(x,top+38,width);
    let y = top+60;
    for (const [bi, block] of group.blocks.entries()) {
      const bx = x + 36, bw = width - 36, start = y;
      txt(String(bi+1).padStart(2,'0'),x,y+1,29,'meta',`${block.id}-number`,theme.primaryColor);
      if (block.label) y += txt(block.label,bx,y,bw,'label',`${block.id}-label`,theme.dark) + 9;
      const d = blueprint.diagrams.find(d=>d.groupId===group.id && d.blockId===block.id);
      if (d) {
        if (d.context) y += txt(d.context,bx,y,bw,'body',`${block.id}-context`) + 12;
        const graphH = Math.max(196,d.inputs.length*66);
        const graphFrame = { left:bx,top:y,width:bw,height:graphH };
        await invokeStructure({ root,slide,skin:{...theme,bodyFrame:frame},targetFrame:graphFrame,
          references:[{assetId:d.assetId,preservedFeatures:['分离输入、平滑粗汇聚路径和唯一结果','所有路径真正接入结果']}],
          content:d,evidencePath:path.join(outputDir,'structure-invocations.ndjson'),pageId:page.pageId,regionId:block.id,reason:d.reason,
          build:async ({frame:f,content})=>{
            const inW = f.width*.49, outW=f.width*.275, outX=f.left+f.width-outW;
            const outH=104, outY=f.top+(f.height-outH)/2;
            const sourceColors=['#abc8da','#8bb2ca','#699abb','#4d80a7','#35688f','#28557a'];
            const nodes=content.inputs.map((s,i)=>{
              const h=Math.max(48,measure(s,inW-24,'node').height+16);
              const cy=f.top+(i+.5)*f.height/content.inputs.length;
              return {text:s,x:f.left,y:cy-h/2,w:inW,h,cy};
            });
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
                fill:'none',line:{fill:neutralPaint(sourceColors[i],'relation',theme),width:7},
                customPaths:[{width:span,height:h,commands:points.map((v,k)=>({[k?'lineTo':'moveTo']:{x:v.x-sx,y:v.y-minY}}))}]});
              geometry.push({kind:'curve',from:[sx,sy],to:[ex,ey],resultBoundary:outX,controlRatios:[.4,.32]});
            }
            for(const [i,n] of nodes.entries()) {
              box(n.x,n.y,n.w,n.h,theme.surface,`${block.id}-input-${i}`);
              const h=measure(n.text,n.w-24,'node').height;
              txt(n.text,n.x+12,n.y+(n.h-h)/2,n.w-24,'node',`${block.id}-input-${i}`,theme.dark);
            }
            box(outX,outY,outW,outH,neutralPaint('#2a5a82','surface',theme),`${block.id}-result`,12);
            const h=measure(content.result,outW-24,'node').height;
            txt(content.result,outX+12,outY+(outH-h)/2,outW-24,'node',`${block.id}-result`,theme.dark,true);
            return {mode:'task-local-native-adaptation',source:'assets/结构图/多路汇聚结果-003/review.mjs',curves:nodes.length};
          }});
        y += graphH;
      } else {
        y += txt(block.text,bx,y,bw,'body',`${block.id}-body`);
      }
      coverage.push({groupId:group.id,blockId:block.id,sourceIds:block.sourceIds,kind:d?'diagram':'text',frame:{x,y:start,width,height:y-start}});
      if(y>frame.top+frame.height) throw new Error(`Capacity exceeded for ${group.id}/${block.id}: ${y} > ${frame.top+frame.height}; change proportions or return to planning`);
      if(bi<group.blocks.length-1){rule(x,y+15,width);y+=34;}
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
  slide.speakerNotes.textFrame.setText(`[Sources]\n- Frozen gray input: ../input/gray-state.json and gray.pptx\n- Source manuscript is retained in gray-state.json:sources.\n- Style: rules/排版体系/杂志风.md and assets/主题/中性编辑排版-001/asset.json\n- Structure: convergence-many-to-one-003, task-local geometry adaptation from review.mjs\n[/Sources]`);
  const pptx=path.join(outputDir,'deck.pptx');
  await (await PresentationFile.exportPptx(p)).save(pptx);
  // Inspect final exported package through reimport, never substitute authoring preview.
  const final=await PresentationFile.importPptx(await FileBlob.load(pptx));
  await fs.writeFile(path.join(outputDir,'slide-01.png'),new Uint8Array(await (await final.export({slide:final.slides.items[0],format:'png',scale:1})).arrayBuffer()));
  await fs.writeFile(path.join(outputDir,'slide-01.layout.json'),await (await final.slides.items[0].export({format:'layout'})).text());
  const qa={slideCount:final.slides.items.length,nativeShapes:slide.shapes.items.length,images:slide.images.items.length,
    coverage,textBoxes,overlaps,geometry,humanReview:'pending',semanticReview:'external-review-required'};
  await fs.writeFile(path.join(outputDir,'build-check.json'),JSON.stringify(qa,null,2));
  return {accepted:true,pptx,preview:path.join(outputDir,'slide-01.png'),coverage:coverage.map(x=>x.blockId),nativeShapes:qa.nativeShapes,
    note:'Program checks passed; actual image and causal membership still require review.'};
}
