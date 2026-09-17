// 灰稿 Agent 自主闭环运行器。与 gray-draft.mjs 的阶段链（程序固定编排：规划→表达→审稿→布局→渲染）
// 不同，这里把编排权交给模型：模型拿到原稿、规则与一组确定性工具（程序检查、独立语义审稿、布局求解与
// 原生渲染），自己决定先做什么、何时检查、何时修订、何时渲染；程序只提供工具与闸门（什么算通过）。
//
// 产物导向：本轮产物就是灰稿候选（PPTX＋逐页预览＋可编辑性检查），渲染成功并停住等待审阅即完成。
// 证据：每轮模型响应与工具调用、每次渲染尝试（含失败）分别落盘，不覆盖历史。

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { runToolLoop, transcriptSummary } from './loop.mjs';
import { createToolRegistry, defineTool } from './tools/index.mjs';
import { buildChatProviderFromEnv } from './chat-provider.mjs';
import { loadDeepSeekLocalConfig } from '../agent/deepseek-provider-from-env.mjs';
import { newRunState, writeState, renderContentMarkdown, renderStateMarkdown } from './state.mjs';
import { SEMANTIC_REVIEW_CONTRACT, VISION_REVIEW_CONTRACT, validateSemanticPlan, semanticReviewInput, markFlowSources } from './gray-semantics.mjs';
import { resolveGrayLayout } from './gray-layout.mjs';
import { grayBodyLayout, fitGrayText, validateGrayArea, validateGrayPlan, renderGrayDraft } from './gray-draft.mjs';

const sha = text => createHash('sha256').update(text).digest('hex');
const json = value => JSON.stringify(value, null, 2);

/** Agent 的角色、工作方式与规划规则。规则正文（共用规则）由调用方附加在后。 */
export const GRAY_AGENT_PROMPT = `你是灰稿制作 Agent。目标：把用户给的原稿做成可审阅的灰稿——把内容提炼、重组为适合 PPT 阅读的信息结构，选好每块的表达方式，通过程序检查与独立审稿后渲染成灰稿候选。渲染成功即完成，不要在没有获得通过前放弃。
工作方式（按自己的判断安排顺序；每步做完都要用工具验证，不要凭想象宣布完成）：
1. 先读懂原稿，判断各部分的关系类型（对比、流程/时序、分类、数据、纯说明等）与主次；
2. 写出完整规划（gray-plan-3，格式见下），调用 check_plan 做程序检查；有 issues 先自己修，别把坏规划交出去；
3. 调用 semantic_review 对照原稿复核（模拟声明、条件、否定、结构选择与关系表达）；有实质问题就修订；
4. 为每页选择基础组合（single/row/column/grid，可选 weights/columns），调用 render_draft 求解并渲染；
5. render_draft 返回失败时，按其中的 reason 与 issues 修订规划或组合后重试；渲染成功即完成。
你可以多次调用工具。check_plan 与 semantic_review 都通过后再渲染是正常路径，但不是硬性顺序；按你判断最有效的方式推进。
交付观：审稿是辅助而不是关口——事实性遗漏、编造、模拟声明缺失必须修复；纯粹的形式偏好随交付记录即可。程序检查通过后即可渲染交付。
**计划的传递方式：把你当前完整的 gray-plan-3 计划 JSON 写在每轮消息的正文里（这是唯一事实来源）；check_plan、semantic_review、render_draft 都读取你本轮正文中的计划，不要在工具参数里重复它，也不要只写差异——每次修订都重写完整计划。**
容量与分页：页数服从内容量——每页必须有实质展开（对象、条件、范围、动作），某页只剩一两句单薄的话（每组仅一句、无细节）时就并入相邻页，不为凑页数摊薄；全稿组数少时控制在两页内——三四个组一页即可，五六个组默认两页；一页放不下就分页，不要反复精简文字硬塞一页，也不要每两三个组单开一页把短稿摊成多页；标题给出判断，正文必须补充标题没有的细节，不整句复述标题。渲染回执报"一页放不下"时，优先把内容拆到多页（pages 增加一页），其次才考虑合并相关组、精简文字；连续两次容量失败就改用分页，不要继续在单页上换组合死磕。
布局选择（调用 render_draft 时给出）：简式 {type:"single|row|column|grid",weights?,columns?} 的子节点默认按阅读顺序取本页全部组；页面有分层关系时用嵌套式 {type,children:[{groupId},或嵌套]}，例如主区在上、一条注记横贯下方 = {type:"column",children:[{type:"row",children:[{groupId:"g1"},{groupId:"g2"}]},{groupId:"g3"}]}。row 横向分栏、column 纵向排列、grid 规则网格；weights（仅 row）分配多余宽度，columns（仅 grid）是列数；children 必须按阅读顺序恰好覆盖本页全部组一次；嵌套最多三层。主次通过空间份额与组标题层级体现，少量内容不必拉满一页，不要为了变化而嵌套。
格式：{schemaVersion:"gray-plan-3",deckBrief:{title,audience,objective},pages:[{pageId:"p1",title:"短标题",claim:"简短上屏主题句，建议二十字左右",pagePurpose:"本页解决的问题",narrative:"一句话说明必要的先后、并行、判断或归属关系",groups:[{id:"g1",role:"本组主要职责",heading:"上屏短标题",importance:"primary|supporting",kind:"text|diagram|flow|chart|table|image",blocks:[{id:"b1",label:"可选上屏子标题",text:"真实上屏文字",sourceIds:["s1"]}],expression:"非text必填：表达作用",relationship:"非text必填：基本关系",production:"非text必填：制作要求"}]}],planningNotes:"简短后台组织说明"}。
先明确页面职责，按内容归属形成groups，再把各分支的条目放进blocks，用label与text区分要点和展开。公文头尾是流转信息、不是演示内容：来源表里标为流转信息的来源一律不上屏（无需引用），也不得改写成"通知依据""背景"之类条目。不要把分属不同观点的依据摊成同级卡片，也不要把分类、依据、准则混称为证明。label可省略；要用时必须是内容词（如"正常""已修复"），不用"拆分项一""对象""状态一"这类结构占位名，也不带"（全页适用）"这类版面说明；表格行只有行头与内容两段，不要把多列文字用竖线拼进一个块。文字组内某条需要图示时，该block可选kind及expression、relationship、production；其label仍是上屏条目标题。按内容关系选择表达：两个及以上对象的共同维度对照用diagram，每个对象一个block；步骤、流程与时间顺序（三个及以上节点）用flow，节点按顺序；明确的对照网格用table，每行一个block；数据图表与图片保留蓝区说明，并在制作要求里写明建议表达。分解或构成（总量＝部分之和、对象→去向）、指标随时间变化不用平行卡片，用一条可读文字（"异常 7 台：已修复 5 台，待配件 2 台"）。行式表格只用于多个对象按共同维度互相对照（两种模式×多项指标、多个项目×进度与问题）；单个对象的一组规则、要求、背景说明用文字条目（一句一条），不做成表格。同一页不要所有组都用同一种表达；同一稿件不同页避免重复同一组合。diagram/flow/table会绘制简化草图，框内文字就是实际文案、必须完整可读；不要一律平铺文字，也不要给没有内部关系的内容硬套结构。
每个block必须引用来源，所有正文来源至少被一个block引用；标为流转信息（文件头尾等）的来源无需引用、不得上屏。来源切分表随稿件给出（id、开头预览与流转标记），引用 sourceIds 以它为准，不要猜。模拟/假设声明只要原稿给出，就必须上屏且恰好一次：最自然的位置是页面主题句，或紧邻主体的一个条目；不得省略、不得逐条重复、不得独立成组。真实条件与否定不能省略，准则不是已满足的证据，并行准备不是下一阶段。条件触发的处置、异常或例外是附着性内容：注明它约束哪些对象或环节，从属并紧邻所依附的内容，不与主流程环节、并列要点铺成同层组。页面目的、narrative和planningNotes不在灰稿上显示；内部审查理由不要改写成正文。`;
// 注：与阶段链相同的规划规则文本（附着性内容、模拟声明、结构选择界限等）刻意保持一致，
// 改一处必须同步另一处——两边是同一份规则的两种编排方式，不能各说各话。

function parseModelJson(response) {
  if (response.finishReason === 'length') throw new Error('模型输出截断；不能以截断内容继续');
  const text = (response.content ?? '').trim().replace(/^```(?:json)?\s*/u, '').replace(/\s*```$/u, '');
  return JSON.parse(text);
}

/** 从模型本轮正文里提取完整计划：优先代码围栏块，其次首尾大括号区间。 */
function extractPlan(content) {
  const text = content ?? '';
  const candidates = [];
  const fences = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map(match => match[1]);
  if (fences.length) candidates.push(fences[fences.length - 1]);
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1));
  let lastError = null;
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.pages)) return parsed;
      lastError = new Error('JSON 里缺少 pages 数组');
    } catch (error) { lastError = error; }
  }
  throw new Error(`本轮正文里没有可解析的完整计划 JSON：${lastError?.message ?? '未找到 JSON'}。修复：把当前完整 gray-plan-3 计划 JSON 写进本轮消息正文（工具参数只放 layouts），再重试本工具。`);
}

/**
 * 视觉质检：把渲染出的逐页截图交给视觉模型，只报明显缺陷（溢出、重叠、异常空白、错位）。
 * 只判定，不修改；不可用时由调用方 fail-open 并如实标注。
 */
async function visualReview(attemptDir, pages, visionProvider) {
  const images = [];
  for (const [index] of pages.entries()) {
    const file = path.join(attemptDir, 'preview', `slide-${String(index + 1).padStart(2, '0')}.png`);
    const data = await fs.readFile(file);
    images.push({ type: 'text', text: `第 ${index + 1} 页：` });
    images.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${data.toString('base64')}` } });
  }
  const response = await visionProvider.complete({ messages: [
    { role: 'system', content: VISION_REVIEW_CONTRACT },
    { role: 'user', content: [{ type: 'text', text: `以下是本次灰稿全部 ${pages.length} 页截图（按页序）。` }, ...images] },
  ] });
  const parsed = parseModelJson(response);
  if (typeof parsed.accepted !== 'boolean' || !Array.isArray(parsed.issues)) throw new Error('视觉质检响应格式无效');
  return { accepted: parsed.accepted && !parsed.issues.length, issues: parsed.issues.slice(0, 12), coverage: parsed.coverage ?? null, unavailable: false };
}

/** 灰稿 Agent 的自主循环。除 state.json 的状态字段外不写业务数据；具体产物由工具写。 */
export async function runGrayAgent({ source, output, area, root = process.cwd(), provider, maxTurns = 24, observer = null, visualReview = false }) {
  area = validateGrayArea(area);
  await fs.mkdir(output, { recursive: false }).catch(error => { if (error.code !== 'EEXIST') throw error; });
  if (await fs.access(path.join(output, 'state.json')).then(() => true, () => false)) throw new Error('输出目录里已有运行状态（可能属于旧运行或误复用），请使用新目录');
  const raw = await fs.readFile(source, 'utf8');
  const sourcePath = path.resolve(source);
  const base = newRunState(raw, sourcePath);
  base.sources = markFlowSources(base.sources);
  const statePath = path.join(output, 'state.json');
  const agentDir = path.join(output, 'agent');

  const agentState = {
    ...base,
    grayDraft: {
      version: 'gray-agent-1', area, sourceHash: sha(raw), status: 'planning', humanReview: 'pending',
      turns: [], renders: [], startedAt: new Date().toISOString(),
    },
  };
  const saveAgentState = async () => {
    await writeState(statePath, agentState);
    await fs.writeFile(path.join(output, 'state.md'),
      renderStateMarkdown(agentState)
        .replace(/- 下一步：.*/u, `- 下一步：灰稿 Agent ${agentState.grayDraft.status}；${agentState.grayDraft.status === 'awaiting-user-review' ? '等待用户审阅，尚未验收' : '按工具反馈继续推进'}`)
        .replace('宿主依赖失败，运行已停止', 'Agent 运行失败，已停止')
        .replace('恢复方式：undefined', '恢复方式：查看 agent/transcript.json，修正原因后重跑'),
      'utf8');
  };
  await fs.writeFile(path.join(output, 'source.md'), raw, 'utf8');
  const sharedRules = (await Promise.all(['内容结构.md', '页面组合.md', '排版.md'].map(name => fs.readFile(path.join(root, 'rules', name), 'utf8')))).join('\n\n');
  await fs.writeFile(path.join(output, 'rules-snapshot.md'), sharedRules, { flag: 'wx' }).catch(error => { if (error.code !== 'EEXIST') throw error; });
  const systemPrompt = `${GRAY_AGENT_PROMPT}\n\n以下为本项目共用规则真源：\n${sharedRules}`;
  await fs.writeFile(path.join(output, 'agent-system-prompt.txt'), systemPrompt, 'utf8');

  // 视觉质检（可选）：渲染完成后用视觉模型看逐页截图。缺配置时如实标注不可用并放行，不卡流程。
  let visionProvider = null;
  try {
    const local = await loadDeepSeekLocalConfig(root);
    const visionModel = process.env.PPAGENT_DEEPSEEK_VISUAL_COMPOSITION_MODEL || local?.roles?.visualComposition?.model;
    if (visionModel) visionProvider = await buildChatProviderFromEnv({ root, model: visionModel, maxTokens: 4000, observer: observer ?? undefined });
  } catch { visionProvider = null; }

  let renderCount = 0;
  let lastContent = '';
  let lastReview = null;
  let lastPlan = null;
  // 模型偶尔忘记在正文里重写完整计划（协议失误）。兜底沿用上一轮已解析的计划并在回执标注
  // planSource，避免一次失误白烧一整轮；模型看到标注后应在下一轮正文补写完整计划。
  const resolvePlan = () => {
    try {
      lastPlan = extractPlan(lastContent);
      return { plan: lastPlan, source: 'message' };
    } catch (error) {
      if (lastPlan) return { plan: lastPlan, source: 'fallback-previous-turn', note: '本轮正文没有完整计划 JSON，已按上一轮计划执行；请在下一轮正文重写完整计划。' };
      throw error;
    }
  };
  const tools = [
    defineTool({
      name: 'check_plan',
      description: '对你本轮消息正文中的完整 gray-plan-3 计划做程序检查：结构字段、来源引用与覆盖、块级数字/引文保真。不接收计划参数——计划写在本轮正文里。返回 {accepted, issues, coverage}。任何规划改动后都应重新调用。',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      handler: async () => {
        const { plan, source, note } = resolvePlan();
        const report = validateSemanticPlan(base, plan);
        return { accepted: report.accepted, issues: report.issues.slice(0, 20), coverage: report.coverage, planSource: source, ...(note ? { note } : {}) };
      },
    }),
    defineTool({
      name: 'semantic_review',
      description: '用独立审稿调用对照原稿复核你本轮正文中的计划：事实/条件/否定与模拟声明完整性、页面职责、关系表达与结构选择。不接收计划参数。返回 {accepted, issues, coverage, limits}。渲染前应通过。',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      handler: async () => {
        const { plan, source, note } = resolvePlan();
        const reviewInput = semanticReviewInput({ source: raw, area, plan, reviewFeedback: lastReview?.issues ?? null });
        const response = await provider.complete({ messages: [{ role: 'system', content: SEMANTIC_REVIEW_CONTRACT }, { role: 'user', content: JSON.stringify(reviewInput) }] });
        const parsed = parseModelJson(response);
        if (typeof parsed.accepted !== 'boolean' || !Array.isArray(parsed.issues)) throw new Error('审稿响应格式无效');
        lastReview = { accepted: parsed.accepted && !parsed.issues.length, issues: parsed.issues.slice(0, 12), at: new Date().toISOString() };
        return { accepted: lastReview.accepted, issues: lastReview.issues, coverage: parsed.coverage ?? null, limits: parsed.limits ?? null, planSource: source, ...(note ? { note } : {}) };
      },
    }),
    defineTool({
      name: 'render_draft',
      description: '按你本轮正文中的计划与每页基础组合求解几何并渲染灰稿。layouts 是逐页数组 [{pageId,layout}]；layout 为简式 {type:"single|row|column|grid",weights?,columns?} 或嵌套 {type,weights?,columns?,children:[…]}（children 项为 {groupId} 或嵌套组合，按阅读顺序恰好覆盖本页全部组一次，最多三层）。这是小参数，仍走工具参数。程序检查通过即可交付；独立审稿的遗留问题随交付记录，不阻塞渲染。成功返回 {accepted:true, preview, pptx, editable}；失败返回 {accepted:false, stage:"geometry|check", reason, issues}，据此修订后重试。',
      inputSchema: {
        type: 'object',
        properties: {
          layouts: { type: 'array', items: { type: 'object', properties: { pageId: { type: 'string' }, layout: { type: 'object' } }, required: ['pageId', 'layout'] } },
        },
        required: ['layouts'], additionalProperties: false,
      },
      handler: async ({ layouts }) => {
        const { plan, source: planSource, note: planNote } = resolvePlan();
        renderCount += 1;
        const attemptDir = path.join(output, 'agent-renders', `render-${renderCount}`);
        await fs.mkdir(attemptDir, { recursive: true });
        let built;
        try {
          built = resolveGrayLayout(plan, { pages: layouts }, area, { measureBody: grayBodyLayout, fitText: fitGrayText });
        } catch (error) {
          const failure = { accepted: false, stage: 'geometry', reason: error.message, details: error.details ?? null };
          await fs.writeFile(path.join(attemptDir, 'failure.json'), json({ ...failure, plan, layouts }), 'utf8');
          agentState.grayDraft.renders.push({ render: renderCount, accepted: false, stage: 'geometry', reason: error.message });
          await saveAgentState();
          return failure;
        }
        const report = validateGrayPlan(base, built.plan, area);
        if (!report.accepted) {
          const failure = { accepted: false, stage: 'check', reason: '规划或组合检查未通过', issues: report.issues.slice(0, 20) };
          await fs.writeFile(path.join(attemptDir, 'failure.json'), json({ ...failure, plan, layouts }), 'utf8');
          agentState.grayDraft.renders.push({ render: renderCount, accepted: false, stage: 'check', issues: report.issues.length });
          await saveAgentState();
          return failure;
        }
        await fs.writeFile(path.join(attemptDir, 'plan.json'), json({ ...built.plan, planningNotes: plan.planningNotes }), 'utf8');
        await fs.writeFile(path.join(attemptDir, 'layout.json'), json(layouts), 'utf8');
        // 渲染到独立尝试目录：每次尝试都留证据；交付版复制到运行根目录。
        const renderState = { ...report.state, grayDraft: { ...agentState.grayDraft, status: 'rendering' } };
        await renderGrayDraft(renderState, attemptDir);
        // 视觉评审：**可选诊断开关**（默认关）。正常生成线不做"质检-打回"循环——那会把单次生成
        // 拖到分钟级、成本成倍；评审发现的模式性问题由开发侧改提示词解决，不放进生成路径。
        if (visionProvider && visualReview) {
          let visual;
          try { visual = await visualReview(attemptDir, renderState.pages, visionProvider); }
          catch (error) { visual = { accepted: false, unavailable: true, issues: [], note: error?.message ?? String(error) }; }
          await fs.writeFile(path.join(attemptDir, 'visual-review.json'), json(visual), 'utf8');
          agentState.grayDraft.visualReview = { at: new Date().toISOString(), ...visual };
        }
        for (const name of ['gray-draft.pptx', 'editable-check.json', 'preview-index.json', 'plan.json']) {
          await fs.copyFile(path.join(attemptDir, name), path.join(output, name));
        }
        await fs.cp(path.join(attemptDir, 'preview'), path.join(output, 'preview'), { recursive: true });
        agentState.pages = renderState.pages;
        agentState.artifactState = Object.fromEntries(renderState.pages.map(page => [page.pageId, {
          status: 'rendered-awaiting-review', revision: page.revision,
          pptxPath: path.join(path.relative(output, attemptDir), 'gray-draft.pptx'),
        }]));
        // 交付不依赖审稿全绿：审稿遗留随交付记录，供界面与用户知情。
        agentState.grayDraft.reviewNotes = lastReview
          ? (lastReview.accepted ? { status: 'clean', at: lastReview.at } : { status: 'open-issues', issues: lastReview.issues, at: lastReview.at })
          : { status: 'not-reviewed' };
        agentState.grayDraft.status = 'awaiting-user-review';
        agentState.grayDraft.renders.push({ render: renderCount, accepted: true, artifactDirectory: path.relative(output, attemptDir) });
        agentState.grayDraft.artifactDirectory = path.relative(output, attemptDir);
        agentState.grayDraft.plan = built.plan;
        agentState.grayDraft.programCheck = { ...report, state: undefined };
        await saveAgentState();
        const preview = renderState.pages.map((page, index) => `${path.relative(output, attemptDir)}/preview/slide-${String(index + 1).padStart(2, '0')}.png`);
        return { accepted: true, preview, pptx: `${path.relative(output, attemptDir)}/gray-draft.pptx`, pages: renderState.pages.length, planSource, ...(planNote ? { note: planNote } : {}) };
      },
    }),
  ];

  const registry = createToolRegistry({ tools, runDir: agentDir });
  const observed = observer
    ? {
      ...registry,
      dispatch: async (name, args) => {
        const outcome = await registry.dispatch(name, args);
        await observer({ type: 'tool-call', status: outcome.result?.accepted === false ? 'failed' : 'succeeded', stage: 'gray-agent', output: { tool: name, accepted: outcome.result?.accepted ?? null } });
        return outcome;
      },
    }
    : registry;

  const result = await runToolLoop({
    provider,
    systemPrompt,
    userMessage: `稿件全文：\n${raw}\n\n来源切分（引用 sourceIds 必须以此表为准；preview 是该来源的开头，完整内容见稿件全文）：\n${JSON.stringify(base.sources.map(source => ({
      id: source.id,
      ...(source.heading ? { heading: source.heading } : {}),
      ...(source.flow ? { flow: `流转信息（${source.flow}）：无需引用、不得上屏` } : {}),
      preview: source.text.length > 80 ? `${source.text.slice(0, 80)}…` : source.text,
    })), null, 1)}\n\n目标区尺寸：宽 ${area.width} × 高 ${area.height}（设计像素）。请把它做成灰稿：先规划，用工具检查与审稿，最后渲染；渲染成功即完成。`,
    registry: observed,
    maxTurns,
    onTurn: async record => {
      const turnDir = path.join(agentDir, `turn-${record.turn}`);
      await fs.mkdir(turnDir, { recursive: true });
      await fs.writeFile(path.join(turnDir, 'response.json'), json({ content: record.content, toolCalls: record.toolCalls.map(call => ({ name: call.name, args: call.args })), stalled: record.stalled }), 'utf8');
      agentState.grayDraft.turns.push({ turn: record.turn, stalled: record.stalled, tools: record.toolCalls.map(call => call.name) });
      await saveAgentState();
    },
    onReply: async reply => { lastContent = reply.content ?? ''; },
    shouldStop: async () => {
      const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
      if (state.grayDraft?.status === 'awaiting-user-review') return { reason: 'delivered', detail: { renders: state.grayDraft.renders.length } };
      if (state.runtimeFailure) return { reason: 'runtime-failure', detail: state.runtimeFailure };
      return null;
    },
  });

  await fs.writeFile(path.join(agentDir, 'transcript.json'), json({ stopReason: result.stopReason, detail: result.detail ?? null, note: result.note ?? null, ...transcriptSummary(result), tools: registry.names() }), 'utf8');
  agentState.grayDraft.turnSummary = transcriptSummary(result);
  if (result.stopReason !== 'delivered') {
    agentState.grayDraft.status = 'blocked';
    agentState.runtimeFailure = { message: result.note ?? `Agent 循环停止：${result.stopReason}` };
  }
  await saveAgentState();
  if (agentState.pages?.length) await fs.writeFile(path.join(output, 'content.md'), renderContentMarkdown(agentState), 'utf8');
  return { state: agentState, loop: result };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: {
    source: { type: 'string' }, output: { type: 'string' }, width: { type: 'string' }, height: { type: 'string' },
    label: { type: 'string' }, 'max-turns': { type: 'string', default: '24' }, 'visual-review': { type: 'boolean', default: false },
  } });
  if (!values.source || !values.output) throw new Error('--source/--output 必填');
  const provider = await buildChatProviderFromEnv({ root: process.cwd(), maxTokens: 24000 });
  const result = await runGrayAgent({
    source: path.resolve(values.source), output: path.resolve(values.output),
    area: { width: Number(values.width), height: Number(values.height), label: values.label },
    root: process.cwd(), provider, maxTurns: Number(values['max-turns']), visualReview: values['visual-review'],
  });
  console.log(json({ status: result.state.grayDraft.status, stopReason: result.loop.stopReason, turns: result.loop.turns.length, renders: result.state.grayDraft.renders.length, output: path.resolve(values.output) }));
}
