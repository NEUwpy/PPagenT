import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { buildChatProviderFromEnv } from './chat-provider.mjs';
import { newRunState, upsertPageBriefs, validateContent, writeState, renderContentMarkdown, renderStateMarkdown } from './state.mjs';
import { fitChineseTextToFrame } from '../render/chinese-typography.mjs';
import { SEMANTIC_CONTRACT, SEMANTIC_REVIEW_CONTRACT, EXPRESSION_CONTRACT, LAYOUT_CONTRACT, validateSemanticPlan, bindSemanticLayout, bindGrayExpressions, semanticPlanFromPages, blockText, regionBody, grayDisplayBlocks, semanticReviewInput } from './gray-semantics.mjs';
import { resolveGrayLayout } from './gray-layout.mjs';
import { resolveLayoutTree } from '../composition/resolve.mjs';

export { regionBody } from './gray-semantics.mjs';

const KINDS = ['text', 'diagram', 'flow', 'chart', 'table', 'image'];
const sha = text => createHash('sha256').update(text).digest('hex');
const json = value => JSON.stringify(value, null, 2);
const requiredText = value => typeof value === 'string' && value.trim().length > 0;
const htmlEscape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

export async function saveGrayState(statePath, state) {
  await writeState(statePath, state);
  await fs.writeFile(path.join(path.dirname(statePath),'state.md'),
    renderStateMarkdown(state).replace(/- 下一步：.*/u, `- 下一步：灰稿状态 ${state.grayDraft.status}；${state.grayDraft.status==='awaiting-user-review'?'等待用户审阅，尚未验收':'按检查记录继续规划修订'}`).replace('宿主依赖失败，运行已停止','灰稿运行失败，已停止').replace('恢复方式：undefined','恢复方式：查看本次 revision 检查记录；修正原因后 --resume'));
}

export function validateGrayArea(area) {
  for (const key of ['width', 'height']) if (!Number.isFinite(area[key]) || area[key] < 240 || area[key] > 4000) throw new Error(`${key} 必须为 240..4000 设计像素`);
  return { width: area.width, height: area.height, label: String(area.label || '自定义内容区') };
}

export function fitGrayText(text, width, height, fontSize) {
  let result;
  // The shared balanced wrapper can leave a long token over its target width.
  // Rewrap at a narrower target; never reduce the actual font or discard text.
  for (const factor of [1.06, 1.12, 1.18]) {
    result = fitChineseTextToFrame(text, { width, height, fontSizes: [fontSize], maxLines: 200, lineHeight: 1.35, glyphWidthFactor: factor });
    if (result.fits || result.lineCount * fontSize * 1.35 > height) return result;
  }
  return result;
}

// Capacity checking and rendering share this exact internal text layout.
export function grayBodyLayout(item, width, fontSize, availableHeight) {
  const padding=8, gap=12, labelGap=4;
  const sections=item.kind==='text' && item.blocks
    ? item.blocks.map(block=>({kind:block.kind ?? 'text',parts:grayDisplayBlocks({kind:'text',blocks:[block]})}))
    : [{kind:item.kind,parts:grayDisplayBlocks(item)}];
  const contracts={};
  const measured=sections.map((section,index)=>{
    const parts=section.parts.map(part=>{
      const fit=fitGrayText(part.text,width-2*padding,100000,fontSize);
      return {...part,text:fit.text,height:fit.lineCount*fontSize*1.35,fits:fit.fits};
    });
    const id=`section-${index}`;
    const minHeight=Math.ceil(parts.reduce((sum,part)=>sum+part.height,0)+labelGap*(parts.length-1)+2*padding);
    contracts[id]={minWidth:width,minHeight};
    return {id,kind:section.kind,parts,minHeight};
  });
  const minimum=measured.reduce((sum,section)=>sum+section.minHeight,0)+gap*(measured.length-1);
  const children=measured.map(section=>({groupId:section.id}));
  const solved=resolveLayoutTree({
    composition:children.length===1?children[0]:{op:'column',children,weights:measured.map(section=>section.minHeight)},
    bodyFrame:{left:0,top:0,width,height:availableHeight ?? minimum},contracts,style:{gap},
  });
  const runs=[];
  const frames=measured.map(section=>{
    const frame=solved.regions[section.id];
    let y=frame.top+padding+(frame.height-section.minHeight)/2;
    for(const part of section.parts){
      runs.push({text:part.text,x:padding,y,width:width-2*padding,height:part.height,bold:part.bold,fits:part.fits,...(part.kind?{kind:part.kind}:{})});
      y+=part.height+labelGap;
    }
    return {...frame,kind:section.kind,id:section.id,minHeight:section.minHeight};
  });
  return {runs,sections:frames,height:availableHeight ?? minimum,minimumHeight:minimum,fits:runs.every(r=>r.fits)};
}

/** Extends existing page briefs: sources/text stay in items; composition binds item IDs. */
export function validateGrayPlan(base, plan, area) {
  const issues = [];
  let state;
  try {
    if (!plan?.deckBrief || !Array.isArray(plan.pages) || !plan.pages.length || plan.pages.length > 100) throw new Error('缺少 deckBrief/pages 或页数超出 1..100');
    if (new Set(plan.pages.map(p => p.pageId)).size !== plan.pages.length) throw new Error('pageId 重复');
    if (plan.pages.some(p=>p.semantics) || ['gray-draft-2','gray-draft-3'].includes(base.grayDraft?.version)) {
      issues.push(...validateSemanticPlan(base,semanticPlanFromPages(plan)).issues);
      for (const page of plan.pages) if (JSON.stringify(page.composition?.regions?.map(r=>r.itemId)) !== JSON.stringify(page.semantics?.readingOrder)) throw new Error(`${page.pageId} 区域顺序与语义阅读顺序不同`);
    }
    state = { ...base, pages: [], phase: 'content', deckBrief: plan.deckBrief };
    for (const page of plan.pages) {
      try { state = upsertPageBriefs(state, [structuredClone(page)]); }
      catch (error) { issues.push({code:'page-fidelity-or-source',pageId:page.pageId,message:error.message}); state.pages.push(structuredClone(page)); }
    }
    issues.push(...validateContent(state).issues);
    for (const page of state.pages) {
      if (!requiredText(page.title) || !requiredText(page.claim)) throw new Error(`${page.pageId} 缺少主题句`);
      const topic = fitGrayText(page.claim, area.width * 0.88, 40, 28);
      if (!topic.fits) issues.push({ code: 'topic-overflow', pageId: page.pageId });
      const regions = page.composition?.regions;
      if (!Array.isArray(regions) || !regions.length) throw new Error(`${page.pageId} 缺少 regions`);
      const seen = new Set();
      for (const region of regions) {
        const item = page.items.find(i => i.id === region.itemId);
        if (!item || seen.has(region.itemId)) throw new Error(`${page.pageId} region 引用重复或未知 item`);
        seen.add(item.id);
        if (!KINDS.includes(item.kind) || !requiredText(item.heading) || !requiredText(item.text)) throw new Error(`${item.id} 缺少 kind/heading/text`);
        if (item.kind !== 'text' && ['expression', 'relationship', 'production'].some(k => !requiredText(item[k]))) throw new Error(`${item.id} 缺少非文字区四要素`);
        const { x, y, width, height, fontSize } = region;
        if (![x, y, width, height, fontSize].every(Number.isFinite) || width < 100 || height < 80 || fontSize < 22 || fontSize > 28) throw new Error(`${item.id} 几何/字号非法，正文必须 22..28px`);
        if (x < 0 || y < 0 || x + width > area.width + .1 || y + height > area.height + .1) issues.push({ code: 'region-outside', pageId: page.pageId, itemId: item.id });
        const heading = fitGrayText(item.heading, width - 32, 40, 26);
        if (item.blocks && item.text !== item.blocks.map(blockText).join('\n')) throw new Error(`${item.id} 正文与内部结构不一致`);
        const body = grayBodyLayout(item, width - 32, fontSize);
        if (!heading.fits || !body.fits || body.height > height-70) issues.push({ headingFits:heading.fits, headingLines:heading.lineCount, headingMaxLines:1, bodyFits:body.fits && body.height<=height-70, code: 'text-capacity', pageId: page.pageId, itemId: item.id, requiredBodyHeight: Math.ceil(body.height + 70), actualHeight: height });
      }
      if (seen.size !== page.items.length) issues.push({ code: 'unrendered-items', pageId: page.pageId });
      for (let i = 0; i < regions.length; i++) for (let j = i + 1; j < regions.length; j++) {
        const a = regions[i], b = regions[j];
        if (Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>0.1 && Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>0.1) issues.push({code:'overlap',pageId:page.pageId,itemIds:[a.itemId,b.itemId]});
      }
    }
  } catch (error) { issues.push({ code: 'invalid-plan', message: error.message }); }
  return { accepted: issues.length === 0, issues, state, coverage: '来源引用、数字/引号保真、区域边界/重叠、固定字号保守容量；不证明语义忠实或视觉美观。' };
}


async function askJson(provider, messages, file) {
  const response = await provider.complete({ messages });
  await fs.writeFile(file, json(response));
  if (response.finishReason === 'length') throw new Error('模型输出截断；保留响应，不能以截断规划继续');
  const text = (response.content ?? '').trim().replace(/^```(?:json)?\s*/u, '').replace(/\s*```$/u, '');
  return JSON.parse(text);
}

export async function renderGrayDraft(state, output) {
  const { Presentation, PresentationFile, FileBlob } = await import('../ppt-engine/index.mjs');
  const { addText } = await import('../asset-runtime/component-builders.mjs');
  const area = state.grayDraft.area;
  const presentation = Presentation.create({ slideSize: { width: area.width + 80, height: area.height + 150 } });
  const preview = path.join(output, 'preview');
  await fs.mkdir(preview, { recursive: true });
  const inspection = [];
  const draw = (slide, text, position, size, bold = false) => addText(slide, text, position, {fontSize:size,bold,color:'#20262D',verticalAlignment:'top',autoFit:'none'});
  for (const [index, page] of state.pages.entries()) {
    const slide = presentation.slides.add();
    draw(slide, fitGrayText(page.claim, area.width * 0.88, 40, 28).text, {left:40,top:20,width:area.width,height:40},28,true);
    for (const region of page.composition.regions) {
      const item = page.items.find(i=>i.id===region.itemId);
      const left=region.x+40, top=region.y+110;
      slide.shapes.add({geometry:'rect',name:`region:${item.id}`,position:{left,top,width:region.width,height:region.height},fill:'#F7F8F9',line:{fill:'#D4D8DC',width:1}});
      draw(slide,fitGrayText(item.heading,region.width-32,40,26).text,{left:left+16,top:top+12,width:region.width-32,height:40},26,true);
      const body=grayBodyLayout(item,region.width-32,region.fontSize,region.height-70);
      for(const section of body.sections){
        slide.shapes.add({geometry:'rect',name:`block:${item.id}:${section.id}`,position:{left:left+16+section.left,top:top+54+section.top,width:section.width,height:section.height},fill:section.kind==='text'?'#ECEEEF':'#E1EFF9',line:{fill:'none',width:0}});
      }
      for (const run of body.runs) {
        draw(slide,run.text,{left:left+16+run.x,top:top+54+run.y,width:run.width,height:run.height},region.fontSize,run.bold);
      }
    }

    const stem=`slide-${String(index+1).padStart(2,'0')}`;
    const image=await presentation.export({slide,format:'png',scale:1});
    await fs.writeFile(path.join(preview,`${stem}.png`),Buffer.from(await image.arrayBuffer()));
    const layout=await slide.export({format:'layout'});
    const layoutText=await layout.text();
    await fs.writeFile(path.join(preview,`${stem}.layout.json`),layoutText);
    inspection.push({pageId:page.pageId,preview:`preview/${stem}.png`});
  }
  await (await PresentationFile.exportPptx(presentation)).save(path.join(output,'gray-draft.pptx'));
  const JSZip=(await import('jszip')).default;
  const zip=await JSZip.loadAsync(await fs.readFile(path.join(output,'gray-draft.pptx')));
  const normalize=text=>String(text).replace(/\s/gu,'');
  const decode=text=>text.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
  const editable=[];
  for(const [index,page] of state.pages.entries()) {
    const xml=await zip.file(`ppt/slides/slide${index+1}.xml`).async('string');
    const actual=normalize([...xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map(m=>decode(m[1])).join(''));
    const expected=[page.claim,...page.items.flatMap(item=>[item.heading,regionBody(item)])];
    const missing=expected.filter(text=>!actual.includes(normalize(text)));
    editable.push({pageId:page.pageId,textShapes:(xml.match(/<p:sp>/g)||[]).length,missingText:missing});
  }
  await fs.writeFile(path.join(output,'editable-check.json'),json({accepted:editable.every(p=>!p.missingText.length),pages:editable,coverage:'PPTX OOXML 原生文字包含每项实际文本及主题句；不等于视觉验收'}));
  if(editable.some(p=>p.missingText.length)) throw new Error('导出 PPTX 原生文字缺失，见 editable-check.json');
  // Final previews come from the exported PPTX, not a separate HTML approximation.
  const reimported=await PresentationFile.importPptx(await FileBlob.load(path.join(output,'gray-draft.pptx')));
  if(reimported.slides.items.length!==state.pages.length) throw new Error('PPTX 重导入页数不一致');
  for(const [index,slide] of reimported.slides.items.entries()) {
    const stem=`slide-${String(index+1).padStart(2,'0')}`;
    const png=await reimported.export({slide,format:'png',scale:1});
    await fs.writeFile(path.join(preview,`${stem}.png`),Buffer.from(await png.arrayBuffer()));
    await fs.writeFile(path.join(preview,`${stem}.layout.json`),await (await slide.export({format:'layout'})).text());
  }
  await fs.writeFile(path.join(output,'preview-index.json'),json(inspection));
  await fs.writeFile(path.join(output,'preview.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>灰稿逐页预览</title><style>body{margin:32px auto;max-width:1280px;padding:0 24px;background:#f3f4f5;color:#20262d;font-family:system-ui}header{position:sticky;top:0;background:#f3f4f5;padding:12px 0}a{color:#17689a}figure{margin:32px 0}img{max-width:100%;height:auto;background:white;border:1px solid #ccd1d5}figcaption{margin:8px 0}</style><header><b>${htmlEscape(area.label)} · ${area.width} × ${area.height} · ${state.pages.length}页</b>　<a href="gray-draft.pptx">下载可编辑 PPT</a><p>灰稿候选，等待用户审阅。灰区为实文，浅蓝区为制作说明。</p></header>${inspection.map((p,i)=>`<figure id="page-${i+1}"><figcaption>${i+1} / ${state.pages.length}　${htmlEscape(state.pages[i].title)}</figcaption><img src="${p.preview}" alt="第${i+1}页" loading="lazy"></figure>`).join('')}</html>`);
  return inspection;
}

export async function runGrayDraft({source, output, area, root=process.cwd(), provider, maxRevisions=3, resume=false, feedback=null, freshPlan=false}) {
  area=validateGrayArea(area);
  const contentArea={width:area.width,height:area.height};
  if (!Number.isInteger(maxRevisions) || maxRevisions < 0 || maxRevisions > 20) throw new Error('max-revisions 必须为0..20整数');
  // Refuse accidental reuse: previous failures and other work are evidence.
  if (!resume) await fs.mkdir(output,{recursive:false});
  const raw=await fs.readFile(source,'utf8');
  let state=resume?JSON.parse(await fs.readFile(path.join(output,'state.json'),'utf8')):newRunState(raw,path.resolve(source));
  if(resume && (state.grayDraft.sourceHash!==sha(raw)||state.grayDraft.area.width!==area.width||state.grayDraft.area.height!==area.height)) throw new Error('续跑原稿或尺寸不匹配');
  if(!resume) await fs.writeFile(path.join(output,'source.md'),raw);
  if(!resume) state.grayDraft={version:'gray-draft-3',area,sourceHash:sha(raw),status:'planning',humanReview:'pending',history:[]};
  state.grayDraft.status='planning';
  const statePath=path.join(output,'state.json');
  await saveGrayState(statePath,state);
  try {
    provider ??= await buildChatProviderFromEnv({root,maxTokens:24000,observer:event=>fs.appendFile(path.join(output,'events.ndjson'),JSON.stringify(event)+'\n')});
    state.grayDraft.provider=provider.identity;
    state.grayDraft.providerSettings={model:provider.model,thinking:provider.extraBody?.thinking?.type,maxTokens:provider.maxTokens};
    const sharedRules=(await Promise.all(['内容结构.md','页面组合.md','排版.md'].map(name=>fs.readFile(path.join(root,'rules',name),'utf8')))).join('\n\n');
    await fs.writeFile(path.join(output,'rules-snapshot.md'),sharedRules,{flag:'wx'}).catch(error=>{if(error.code!=='EEXIST')throw error;});
    const messages=[{role:'system',content:SEMANTIC_CONTRACT+'\n以下为本项目共用规则真源：\n'+sharedRules},{role:'user',content:json({area:contentArea,sources:state.sources,fullManuscript:raw})}];
    const start=state.grayDraft.history.length;
    if(resume && start && !freshPlan) {
      const previous=path.join(output,`revision-${start-1}`);
      const previousPlan=await fs.readFile(path.join(previous,'semantic-plan.json'),'utf8').catch(()=>null);
      const previousReport=await fs.readFile(path.join(previous,'program-check.json'),'utf8');
      const previousSemantic=await fs.readFile(path.join(previous,'semantic-check.json'),'utf8').catch(()=>null);
      if(previousPlan) messages.push({role:'assistant',content:previousPlan});
      messages.push({role:'user',content:'依据当前规则与以下之前的检查反馈重新修订完整规划：'+previousReport+'\n'+(previousSemantic||'')});
    }
    if(feedback) {
      await fs.writeFile(path.join(output,`human-feedback-${start}.md`),feedback);
      messages.push({role:'user',content:'人工实际灰稿审阅反馈，依据此修订完整规划：\n'+feedback});
    }
    state.runtimeFailure=null;
    for(let revision=start;revision<=start+maxRevisions;revision++) {
      const dir=path.join(output,`revision-${revision}`);
      await fs.mkdir(dir);
      await fs.writeFile(path.join(dir,'system-prompt.txt'),messages[0].content);
      await fs.writeFile(path.join(dir,'runner.sha256'),sha(await fs.readFile(new URL(import.meta.url))));
      let plan,architecture,report,semantic=null;
      try {
        architecture=await askJson(provider,messages,path.join(dir,'model-response.json'));
        await fs.writeFile(path.join(dir,'content-plan.json'),json(architecture));
        await fs.writeFile(path.join(dir,'semantic-plan.json'),json(architecture));
        report=validateSemanticPlan(state,architecture);
        if(report.accepted && architecture.schemaVersion==='gray-plan-3') {
          await fs.writeFile(path.join(dir,'expression-prompt.txt'),EXPRESSION_CONTRACT);
          const selection=await askJson(provider,[{role:'system',content:EXPRESSION_CONTRACT},{role:'user',content:json({source:raw,area:contentArea,plan:architecture})}],path.join(dir,'expression-response.json'));
          architecture=bindGrayExpressions(architecture,selection);
          await fs.writeFile(path.join(dir,'semantic-plan.json'),json(architecture));
          report=validateSemanticPlan(state,architecture);
        }
        await fs.writeFile(path.join(dir,'structure-check.json'),json(report));
        if(report.accepted) {
          await fs.writeFile(path.join(dir,'semantic-prompt.txt'),SEMANTIC_REVIEW_CONTRACT);
          const reviewInput=semanticReviewInput({source:raw,area,plan:architecture,reviewFeedback:feedback});
          await fs.writeFile(path.join(dir,'visible-plan.json'),json(reviewInput.visiblePages));
          semantic=await askJson(provider,[{role:'system',content:SEMANTIC_REVIEW_CONTRACT},{role:'user',content:json(reviewInput)}],path.join(dir,'semantic-response.json'));
          if(typeof semantic.accepted!=='boolean'||!Array.isArray(semantic.issues)) throw new Error('语义审稿响应格式无效');
          await fs.writeFile(path.join(dir,'semantic-check.json'),json(semantic));
          if(semantic.accepted && !semantic.issues.length) {
            await fs.writeFile(path.join(dir,'layout-prompt.txt'),LAYOUT_CONTRACT);
            const layoutMessages=[{role:'system',content:LAYOUT_CONTRACT},{role:'user',content:json({area:contentArea,plan:architecture})}];
            // Geometry failures first repair geometry, without regenerating approved copy.
            for(let attempt=0;attempt<3;attempt++) {
              const layout=await askJson(provider,layoutMessages,path.join(dir,`layout-response-${attempt}.json`));
              try {
                if (architecture.schemaVersion === 'gray-plan-3') {
                  const built=resolveGrayLayout(architecture,layout,area,{measureBody:grayBodyLayout,fitText:fitGrayText});
                  plan=built.plan;
                  await fs.writeFile(path.join(dir,`layout-resolved-${attempt}.json`),json(built.receipts));
                } else plan=bindSemanticLayout(architecture,layout);
                report=validateGrayPlan(state,plan,area);
              } catch(error) {report={accepted:false,issues:[{code:error.code || 'layout-binding',message:error.message,details:error.details}]};}
              await fs.writeFile(path.join(dir,`layout-check-${attempt}.json`),json({...report,state:undefined}));
              if(report.accepted || layout.needsReplan || report.issues.some(issue=>issue.code==='topic-overflow')) break;
              layoutMessages.push({role:'assistant',content:json(layout)},{role:'user',content:json({instruction:'只调整基础组合或横向比例，不改内容。details给出实际测量容量；可尝试其他组合，确实无法容纳时返回needsReplan，不写坐标。',issues:report.issues})});
            }
          }
        }
      } catch(error) {report={accepted:false,issues:[{code:'model-output',message:error.message}]};}
      if(plan) await fs.writeFile(path.join(dir,'plan.json'),json(plan));
      await fs.writeFile(path.join(dir,'program-check.json'),json({...report,state:undefined}));
      state.grayDraft.history.push({revision,program:report.accepted,semantic:semantic ? semantic.accepted && !semantic.issues.length : null,directory:`revision-${revision}`});
      await saveGrayState(statePath,state);
      if(plan && report.accepted && semantic?.accepted && !semantic.issues.length) {
        state={...report.state,grayDraft:{...state.grayDraft,version:architecture.schemaVersion==='gray-plan-3'?'gray-draft-3':'gray-draft-2',status:'rendering',semanticPlan:architecture,planningNotes:plan.planningNotes,programCheck:{...report,state:undefined},semanticCheck:semantic}};
        await saveGrayState(statePath,state);
        const artifactOutput=await fs.access(path.join(output,'gray-draft.pptx')).then(()=>path.join(dir,'artifacts')).catch(()=>output);
        await fs.mkdir(artifactOutput,{recursive:true});
        state.grayDraft.artifactDirectory=path.relative(output,artifactOutput)||'.';
        await renderGrayDraft(state,artifactOutput);
        state.grayDraft.status='awaiting-user-review';
        state.artifactState=Object.fromEntries(state.pages.map(p=>[p.pageId,{status:'rendered-awaiting-review',revision:p.revision,pptxPath:path.join(artifactOutput,'gray-draft.pptx')}]));
        await saveGrayState(statePath,state);
        await fs.writeFile(path.join(output,'plan.json'),json({sourceHash:state.grayDraft.sourceHash,area,deckBrief:state.deckBrief,pages:state.pages,planningNotes:state.grayDraft.planningNotes}));
        await fs.writeFile(path.join(output,'content.md'),renderContentMarkdown(state));
        return state;
      }
      messages.push({role:'assistant',content:architecture?json(architecture):'上次未能返回合法完整JSON。'}, {role:'user',content:json({instruction:'根据检查修订完整语义规划（不含坐标），保留所有事实条件。容量不足先调整表达组织再分页，不缩小字号。',program:report.issues,semantic})});
    }
    throw new Error('规划修订预算耗尽，保留全部失败记录；不能静默交付失败灰稿');
  } catch(error) {
    state.grayDraft.status='blocked';state.runtimeFailure={message:error.message};
    await saveGrayState(statePath,state);throw error;
  }
}

if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const {values}=parseArgs({options:{source:{type:'string'},output:{type:'string'},width:{type:'string'},height:{type:'string'},label:{type:'string'},'max-revisions':{type:'string',default:'3'},replay:{type:'string'},resume:{type:'boolean',default:false},feedback:{type:'string'},'fresh-plan':{type:'boolean',default:false}}});
  if(values.replay) {
    const state=JSON.parse(await fs.readFile(path.resolve(values.replay),'utf8'));
    if(state.grayDraft?.status!=='awaiting-user-review') throw new Error('仅能重编译已生成的灰稿候选；当前规划未完成，不能沿用旧页冒充最新结果');
    const check=validateGrayPlan(state,{deckBrief:state.deckBrief,pages:state.pages},state.grayDraft.area);
    if(!check.accepted) throw new Error(json(check.issues));
    if(!values.output) throw new Error('--replay 需要 --output 新目录');
    await fs.mkdir(path.resolve(values.output),{recursive:false});
    await renderGrayDraft(state,path.resolve(values.output));
  } else {
    if(!values.source||!values.output) throw new Error('--source/--output 必填');
    const state=await runGrayDraft({source:path.resolve(values.source),output:path.resolve(values.output),area:{width:Number(values.width),height:Number(values.height),label:values.label},maxRevisions:Number(values['max-revisions']),resume:values.resume,freshPlan:values['fresh-plan'],feedback:values.feedback?await fs.readFile(path.resolve(values.feedback),'utf8'):null});
    console.log(json({status:state.grayDraft.status,pages:state.pages.length,output:path.resolve(values.output)}));
  }
}
