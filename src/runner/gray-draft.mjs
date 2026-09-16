import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { buildChatProviderFromEnv } from './chat-provider.mjs';
import { newRunState, upsertPageBriefs, validateContent, writeState, renderContentMarkdown, renderStateMarkdown } from './state.mjs';
import { fitChineseTextToFrame } from '../render/chinese-typography.mjs';

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

export function regionBody(item) {
  return item.kind === 'text' ? item.text : `表达作用：${item.expression}\n承载内容：${item.text}\n基本关系：${item.relationship}\n制作要求：${item.production}`;
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

/** Extends existing page briefs: sources/text stay in items; composition binds item IDs. */
export function validateGrayPlan(base, plan, area) {
  const issues = [];
  let state;
  try {
    if (!plan?.deckBrief || !Array.isArray(plan.pages) || !plan.pages.length || plan.pages.length > 100) throw new Error('缺少 deckBrief/pages 或页数超出 1..100');
    if (new Set(plan.pages.map(p => p.pageId)).size !== plan.pages.length) throw new Error('pageId 重复');
    state = { ...base, pages: [], phase: 'content', deckBrief: plan.deckBrief };
    for (const page of plan.pages) {
      try { state = upsertPageBriefs(state, [structuredClone(page)]); }
      catch (error) { issues.push({code:'page-fidelity-or-source',pageId:page.pageId,message:error.message}); state.pages.push(structuredClone(page)); }
    }
    issues.push(...validateContent(state).issues);
    for (const page of state.pages) {
      if (!requiredText(page.title) || !requiredText(page.claim)) throw new Error(`${page.pageId} 缺少主题句`);
      const topic = fitGrayText(page.claim, area.width * 0.88, 80, 28);
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
        const body = fitGrayText(regionBody(item), width - 32, height - 70, fontSize);
        if (!heading.fits || !body.fits) issues.push({ headingFits:heading.fits, headingLines:heading.lineCount, headingMaxLines:1, bodyFits:body.fits, code: 'text-capacity', pageId: page.pageId, itemId: item.id, requiredBodyHeight: Math.ceil(body.lineCount * fontSize * 1.35 + 70), actualHeight: height });
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

const CONTRACT = `你是 PPT 内容规划模型。只输出 JSON，不写 Markdown。原稿→内容规划是永久生产环节，本轮输出可编辑灰稿，禁止正式美化。
一页讲清一件事，一块讲清一件小事；按传入内容区域独立规划，可提炼、改写、重组和拆页，但必须覆盖所有来源的重要事实、条件、否定及逻辑。同一论点的数据、依据与必要口径宜集中在一页，区域能容纳时避免碎页。原稿制作说明（原稿篇幅、章节不是布局答案）只保留后台，不上屏，模拟性质免责声明仍保留。不能把同一正文重复放到不同区，不能把次要信息与主信息等权化。禁止凭固定页数切稿。不要给封面或目录凑页数。
Skin 规则提供区域基础约束；通用排版规则负责分页分区层次留白；风格规则后续美化，涉及分组主次关系拆页必须返回规划。
JSON 格式：{deckBrief:{title,audience,objective},pages:[{pageId:"p1",title:"短标题",claim:"实际上屏的简短主题句（结论或动机）",relation:"none|parallel|comparison|sequence",items:[{id:"p1-a",sourceIds:["s1"],heading:"实际上屏的分级标题",text:"真实上屏正文，最多400字",role:"object|criterion|step|global",kind:"text|diagram|flow|chart|table|image",expression:"非text必填：表达作用",relationship:"非text必填：基本关系",production:"非text必填：制作要求"}],composition:{regions:[{itemId:"p1-a",x:0,y:0,width:500,height:300,fontSize:22}]}}],planningNotes:"后台分页分区理由与拆页说明，绝不上屏"}。
几何单位设计px，相对内容区左上角。主题句在内容区外以28px呈现，80px高最多两行，避免长段落，不扣除传入内容区高度；各region必须 y>=0。不允许溢出重叠。正文22..28px，区标题26px，不缩字。每区固定16px内边距，标题占40px，仅容一行，标题必须足够短（建议6至10字），正文可用高=region.height-70。估算每行字数=(width-32)/(fontSize*1.06)，每行高=fontSize*1.35。需要更多高度就增区域/拆页，不要压低字号。
纯文字区灰色，text就是实际上屏的文字。其他种类浅蓝，不画具体结构，正文将同时显示「表达作用、承载内容(text)、基本关系、制作要求」，因此四者合计要纳入容量。
每个region恰好对应一个item，每个item都恰好被一个region承载。可用不等宽列、主区+辅助区、上下分区，网格对齐一致、留白合理。不是每页都必须有非文字区，只有内容需要关系/数据/图片表达时才用。
保留原稿数字书写方式（汉字数字不改阿拉伯数字）。原稿数字/引号必须有来源证据，不能编造。来源id可跨页引用但内容应分工。完整原稿标注的模拟性质必须在页面内容中保留。禁止把页面主张分析/选择理由等后台思考放上屏。`;

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
    draw(slide, fitGrayText(page.claim, area.width * 0.88, 80, 28).text, {left:40,top:20,width:area.width,height:80},28,true);
    for (const region of page.composition.regions) {
      const item = page.items.find(i=>i.id===region.itemId);
      const left=region.x+40, top=region.y+110;
      slide.shapes.add({geometry:'rect',name:`region:${item.id}`,position:{left,top,width:region.width,height:region.height},fill:item.kind==='text'?'#ECEEEF':'#E1EFF9',line:{fill:'none',width:0}});
      draw(slide,fitGrayText(item.heading,region.width-32,40,26).text,{left:left+16,top:top+12,width:region.width-32,height:40},26,true);
      draw(slide,fitGrayText(regionBody(item),region.width-32,region.height-70,region.fontSize).text,{left:left+16,top:top+54,width:region.width-32,height:region.height-70},region.fontSize);
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
  await fs.writeFile(path.join(output,'preview.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>灰稿逐页预览</title><style>body{margin:32px auto;max-width:1280px;padding:0 24px;background:#f3f4f5;color:#20262d;font-family:system-ui}header{position:sticky;top:0;background:#f3f4f5;padding:12px 0}a{color:#17689a}figure{margin:32px 0}img{max-width:100%;height:auto;background:white;border:1px solid #ccd1d5}figcaption{margin:8px 0}</style><header><b>${htmlEscape(area.label)} · ${area.width} × ${area.height} · ${state.pages.length}页</b>　<a href="gray-draft.pptx">下载可编辑 PPT</a><p>模拟内容 · 灰稿候选，等待用户审阅。灰区为实文，浅蓝区为制作说明。</p></header>${inspection.map((p,i)=>`<figure id="page-${i+1}"><figcaption>${i+1} / ${state.pages.length}　${htmlEscape(state.pages[i].title)}</figcaption><img src="${p.preview}" alt="第${i+1}页" loading="lazy"></figure>`).join('')}</html>`);
  return inspection;
}

export async function runGrayDraft({source, output, area, root=process.cwd(), provider, maxRevisions=3, resume=false, feedback=null, freshPlan=false}) {
  area=validateGrayArea(area);
  if (!Number.isInteger(maxRevisions) || maxRevisions < 0 || maxRevisions > 20) throw new Error('max-revisions 必须为0..20整数');
  // Refuse accidental reuse: previous failures and other work are evidence.
  if (!resume) await fs.mkdir(output,{recursive:false});
  const raw=await fs.readFile(source,'utf8');
  let state=resume?JSON.parse(await fs.readFile(path.join(output,'state.json'),'utf8')):newRunState(raw,path.resolve(source));
  if(resume && (state.grayDraft.sourceHash!==sha(raw)||state.grayDraft.area.width!==area.width||state.grayDraft.area.height!==area.height)) throw new Error('续跑原稿或尺寸不匹配');
  if(!resume) await fs.writeFile(path.join(output,'source.md'),raw);
  if(!resume) state.grayDraft={version:'gray-draft-1',area,sourceHash:sha(raw),status:'planning',humanReview:'pending',history:[]};
  state.grayDraft.status='planning';
  const statePath=path.join(output,'state.json');
  await saveGrayState(statePath,state);
  try {
    provider ??= await buildChatProviderFromEnv({root,maxTokens:24000,observer:event=>fs.appendFile(path.join(output,'events.ndjson'),JSON.stringify(event)+'\n')});
    state.grayDraft.provider=provider.identity;
    const sharedRules=await fs.readFile(path.join(root,'rules','排版.md'),'utf8');
    await fs.writeFile(path.join(output,'rules-snapshot.md'),sharedRules,{flag:'wx'}).catch(error=>{if(error.code!=='EEXIST')throw error;});
    const messages=[{role:'system',content:CONTRACT+'\n以下为本项目共用规则真源：\n'+sharedRules},{role:'user',content:json({area,sources:state.sources,fullManuscript:raw})}];
    const start=state.grayDraft.history.length;
    if(feedback) {
      await fs.writeFile(path.join(output,`human-feedback-${start}.md`),feedback);
      messages.push({role:'user',content:'人工实际灰稿审阅反馈，依据此修订完整规划：\n'+feedback});
    }
    if(resume && start && !freshPlan) {
      const previous=path.join(output,`revision-${start-1}`);
      const previousPlan=await fs.readFile(path.join(previous,'plan.json'),'utf8').catch(()=>null);
      const previousReport=await fs.readFile(path.join(previous,'program-check.json'),'utf8');
      const previousSemantic=await fs.readFile(path.join(previous,'semantic-check.json'),'utf8').catch(()=>null);
      if(previousPlan) messages.push({role:'assistant',content:previousPlan});
      messages.push({role:'user',content:'依据当前规则与以下之前的检查反馈重新修订完整规划：'+previousReport+'\n'+(previousSemantic||'')});
    }
    state.runtimeFailure=null;
    for(let revision=start;revision<=start+maxRevisions;revision++) {
      const dir=path.join(output,`revision-${revision}`);
      await fs.mkdir(dir);
      await fs.writeFile(path.join(dir,'system-prompt.txt'),messages[0].content);
      await fs.writeFile(path.join(dir,'runner.sha256'),sha(await fs.readFile(new URL(import.meta.url))));
      let plan,report;
      try { plan=await askJson(provider,messages,path.join(dir,'model-response.json')); report=validateGrayPlan(state,plan,area); }
      catch(error) {report={accepted:false,issues:[{code:'model-output',message:error.message}]};}
      if(plan) await fs.writeFile(path.join(dir,'plan.json'),json(plan));
      await fs.writeFile(path.join(dir,'program-check.json'),json({...report,state:undefined}));
      let semantic=null;
      if(report.accepted) {
        semantic=await askJson(provider,[{role:'system',content:'你是独立一轮的内容审稿人。比较完整原稿和灰稿规划。逐一检查事实/数字/条件/因果/模拟边界是否忠实，重要信息是否遗漏，每页一事和区域职责是否成立，层次主次是否明确，非文字区四要素是否可执行。不得仅看sourceIds覆盖。检查正文和图示是否重复承载相同数据而没有分工；是否把一个论点碎片化拆页；制作元信息不应上屏，但模拟声明应保留；不得把担忧升级为事实或凭空增加因果链。每个图表/指标的关键口径必须随本页图表/指标出现，跨页不等于满足限定。不评价未看到的像素图。先区分真实缺陷与可选建议：必须结合area尺寸与22px以上字号判断容量，不规定合并页数；小区域拆分完整子主题合理，不以大区域标准强迫合并。蓝区text就是图示将承载的数据，不是额外绘制的一份正文，production是该数据的制作要求，二者关联不算重复。主题句与主体呼应不算无意义重复。只有确认的重要遗漏、事实矛盾、无据因果、关键限定丢失或明确重复才拒绝；仅可能、更好、更紧凑的建议放recommendations而非issues。只输出JSON：{accepted:boolean,issues:[{pageId,sourceIds,problem,requiredRevision}],coverage:"本轮实际查了什么",limits:"未看渲染图，不能确认实际视觉"}。只有存在实质问题才拒绝。'}, {role:'user',content:json({source:raw,area,plan})}],path.join(dir,'semantic-response.json'));
        if(typeof semantic.accepted!=='boolean'||!Array.isArray(semantic.issues)) throw new Error('语义审稿响应格式无效');
        await fs.writeFile(path.join(dir,'semantic-check.json'),json(semantic));
      }
      state.grayDraft.history.push({revision,program:report.accepted,semantic:semantic?.accepted??null,directory:`revision-${revision}`});
      await saveGrayState(statePath,state);
      if(report.accepted && semantic.accepted && !semantic.issues.length) {
        state={...report.state,grayDraft:{...state.grayDraft,status:'rendering',planningNotes:plan.planningNotes,programCheck:{...report,state:undefined},semanticCheck:semantic}};
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
      messages.push({role:'assistant',content:plan?json(plan):'上次未能返回合法完整JSON。'}, {role:'user',content:json({instruction:'根据检查修订完整规划，保留所有事实条件，重新返回完整 JSON。需要拆页就拆，不缩小字号。',program:report.issues,semantic})});
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
