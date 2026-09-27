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
import { SEMANTIC_REVIEW_CONTRACT, VISION_REVIEW_CONTRACT, validateSemanticPlan, semanticReviewInput, snapshotSemanticReview, markFlowSources, SHARED_RULES, attemptFingerprint, isStalledRetry, planTextVolume, isSameMinimumRetry, planContentFingerprint, checkReviewCoverage, semanticPlanFromPages } from './gray-semantics.mjs';
import { applyTemplateDefaults, describeDefaults } from './gray-templates.mjs';
import { auditGeometry, voidWarnings, VOID_THRESHOLDS } from './gray-audit.mjs';
import { resolveGrayLayout, compressionMemory } from './gray-layout.mjs';
import { selectMeasuredLayouts, measuredLayoutCandidates, adjacentPageLayoutAdvice } from './gray-layout-selection.mjs';
import { grayBodyLayout, fitGrayText, validateGrayArea, validateGrayPlan, renderGrayDraft, topicFits } from './gray-draft.mjs';

const sha = text => createHash('sha256').update(text).digest('hex');
const json = value => JSON.stringify(value, null, 2);

/**
 * render_draft 的 layouts 入参形状（任务 #222 单一来源：工具 schema 与定向测试共用）。
 * 每项为 {pageId, layout?, override?}：pageId 必填；省略 layout 采用该页默认版式；
 * 使用非默认组合时 override 与 layout 同级，override.reason 由模板层入档。
 */
export const RENDER_LAYOUTS_SCHEMA = {
  type: 'object',
  properties: {
    layouts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pageId: { type: 'string' },
          layout: { type: 'object' },
          override: {
            type: 'object',
            properties: { reason: { type: 'string' }, template: { type: 'string' } },
            required: ['reason'],
            additionalProperties: false,
          },
        },
        required: ['pageId'],
        additionalProperties: false,
      },
    },
  },
  required: ['layouts'],
  additionalProperties: false,
};

/** Agent 的角色、工作方式与规划规则。规则正文（共用规则）由调用方附加在后。 */
export const GRAY_AGENT_PROMPT = `你是灰稿制作 Agent。目标：把用户给的原稿提炼、重组为**可读**的灰稿——读者应能直接看出每页的主要判断、支撑与关系，不必自行从长句里拆成员。选好每块的表达方式，通过程序检查与独立审稿后渲染候选，并复核真实阅读质量后 finish_draft 才算完成；没有 finish 就停下会被如实标为未完成复核的候选。完成标准不是"保真＋无溢出"：保真是底线，读不出组织就等于没做完。不要在没有获得通过前放弃。
工作方式（按自己的判断安排顺序；每步做完都要用工具验证，不要凭想象宣布完成）：
1. 先读懂原稿，判断各部分的关系类型（对比、流程/时序、分类、数据、纯说明等）与主次；
2. 先写可扫读的上屏提纲（每页的主要判断、相称支撑、共同限定与条件范围），再据此写出完整规划（gray-plan-3，格式见下），调用 check_plan 做程序检查；有 issues 先自己修，别把坏规划交出去；
3. 调用 semantic_review 对照原稿复核（模拟声明、条件、否定、结构选择与关系表达）；有实质问题就修订；
4. 为每页选择基础组合（single/row/column/grid，可选 weights/columns），调用 render_draft 求解并渲染；
5. render_draft 返回失败时，按其中的 reason 与 issues 修订规划或组合后重试；渲染成功是候选，先复核诊断再 finish_draft 或做一次有界修订。
你可以多次调用工具。check_plan 与 semantic_review 都通过后再渲染是正常路径，但不是硬性顺序；按你判断最有效的方式推进。
交付观：审稿是辅助而不是关口——审稿回执的 issues 是阻塞项（实质改变理解的失真、遗漏、层级/归属/关系错误），必须修复；notes 是建议/已解决说明，不阻塞渲染。审稿通过绑定当前内容版本：任何内容改动（含失败后的修订）都会让上一版通过失效——改后再次渲染前必须重新 semantic_review；程序会拒绝未复核、有阻塞项或复核已过期的版本，未复核版本不得继承通过状态。交付只由 finish_draft 触发：它必须在该候选的 render 回执进入后续回合之后调用（同一轮 render+finish 不算看过诊断），并附复核结论；选定候选与当前计划内容不一致、或不是最新候选时，要写明退回/未采用修订的原因。首次成功渲染后最多一次修订周期；修订失败（模板/几何/坏提交）不计入，但预算耗尽仍以第一次成功候选如实交付并标注未完成复核。
渲染后复核（只有文字与几何，没有像素图）：render_draft 成功回执带逐页/区域的实际分配宽高、字号、区域最小高与占用（minimumRegionHeight/allocatedRegionHeight 两边同口径、都含 70px 标题与边距开销；textOccupancy 为两边都扣该开销的正文口径）、权重与实际来源（无权重时 weightsSource 为 null）和既有几何警告。**复核要判阅读质量，不只看占用**：①正文是否完成提炼——读者是否需要自行从长句拆出成员、判断与支撑；②对照是否用一致维度直接对应，还是要把句子拆开才能配对；③短说明占的空间是否相称（程序最小高含条目/标题/间距开销，不等于内容多）；④字号是否与页面内容相称（字号被选小不能自动解释成"内容密集"）。pageBottomWhitespace 是框外页底空白，不是内容填充率——缩小它未必改善阅读。发现具体问题时，在这一次修订里优先改内容组织或组合（内容改动照常重审，纯布局不重审）；保留首稿要给出真实取舍，不能把影响阅读的问题转交后续美化并称本轮已解决。这些是选择依据，不是稀疏/字号硬阈值。需要看图的能力不在本线内，不要声称看过像素图。
**计划的传递方式：提交或修订计划时，把完整的 gray-plan-3 计划 JSON 写进本轮消息正文——提交新内容会让旧审稿失效、需重新审稿；没有写新 JSON 时，三个工具对当前已提交版本继续（同版审稿复用结论，不重复运行）。正文想提交计划但 JSON 损坏＝本次提交失败（不会被当作已修订），请重发完整合法 JSON；工具回执的 planSource 标明本轮计划来源（message=新提交 / current-plan=沿用 / submission-failed=坏提交）。不要在工具参数里重复计划，也不要只写差异。**
容量与分页：${SHARED_RULES.paging} 布局规则模式正文只用22/20/18px三档，程序逐页选择最大可承载档，18px以下仍须重新规划；组标题保持26px，不以缩字代替内容组织。
布局选择（调用 render_draft 时给出）：简式 {type:"single|row|column|grid",weights?,columns?} 的子节点默认按阅读顺序取本页全部组；页面有分层关系时用嵌套式 {type,children:[{groupId},或嵌套]}，例如主区在上、一条注记横贯下方 = {type:"column",children:[{type:"row",children:[{groupId:"g1"},{groupId:"g2"}]},{groupId:"g3"}]}。row 横向分栏、column 纵向排列、grid 规则网格；weights（仅 row）分配多余宽度，按各栏实文行数/展开需要给比例（如 3:2、5:4），不要默认等分，columns（仅 grid）是列数；children 必须按阅读顺序恰好覆盖本页全部组一次；嵌套最多三层。主次通过空间份额与组标题层级体现，少量内容不必拉满一页，不要为了变化而嵌套。每页有程序默认版式（1 组多条=类别容器、1 组单条=单主体、2 组=双栏对照、≥3 组=行式清单）；layouts 的页条目只写 {pageId} 即采用默认。自己选与默认不同的组合时，在 layouts 的该页条目里把 override 与 layout 同级写：{pageId:"p2", layout:{...}, override:{reason:"一句话理由"}}（override 不能放进 layout 对象；理由会入档分析）；仅微调 weights 不算覆盖。
格式：{schemaVersion:"gray-plan-3",deckBrief:{title,audience,objective},pages:[{pageId:"p1",title:"短标题",claim:"简短上屏主题句，建议二十字左右",pagePurpose:"本页解决的问题",narrative:"一句话说明必要的先后、并行、判断或归属关系",sourceIds:["s1"]（可选：页级认领，用于本页承载但不单列条目的结构性来源）,groups:[{id:"g1",role:"本组主要职责",heading:"上屏短标题",importance:"primary|supporting",kind:"text|diagram|flow|chart|table|image",blocks:[{id:"b1",label:"可选上屏子标题（内容词，不写序号）",text:"真实上屏文字",sourceIds:["s1"],scope:"group"（可选：约束整组全部条目的共同说明，程序不编号）}],expression:"非text必填：表达作用",relationship:"非text必填：基本关系",production:"非text必填：制作要求"}]}],planningNotes:"简短后台组织说明"}。
先明确页面职责，按内容归属形成groups，再把各分支的条目放进blocks，用label与text区分要点和展开。${SHARED_RULES.organize}${SHARED_RULES.category}${SHARED_RULES.hierarchy}${SHARED_RULES.meta}${SHARED_RULES.claim}不要把分属不同观点的依据摊成同级卡片，也不要把分类、依据、准则混称为证明。${SHARED_RULES.label}文字组内某条需要图示时，该block可选kind及expression、relationship、production；其label仍是上屏条目标题。附着说明块 kind 写 "note"，紧随所依附条目、不编号、无需制作说明三项。${SHARED_RULES.expression}${SHARED_RULES.timeline}${SHARED_RULES.sketch}
${SHARED_RULES.source}来源切分表随稿件给出（id、开头预览与流转标记），引用 sourceIds 以它为准，不要猜。${SHARED_RULES.fidelity}${SHARED_RULES.declaration}${SHARED_RULES.condition}${SHARED_RULES.attachment}${SHARED_RULES.surface}内部审查理由不要改写成正文。`;
// 注：与 SEMANTIC_CONTRACT 共用的规则片段（附着性内容、模拟声明、结构选择界限等）已抽为
// SHARED_RULES 单一来源；「改一处必须同步另一处」由 tests/prompt-sync.test.mjs 守卫（源码中恰好出现一次）。

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
  let parsedWithoutPages = false;
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.pages)) return parsed;
      if (parsed && typeof parsed === 'object') parsedWithoutPages = true;
      lastError = new Error('JSON 里缺少 pages 数组');
    } catch (error) { lastError = error; }
  }
  // 任务 #173/#175：区分"想提交但坏"（截断/缺 pages/围栏未闭合）与"没写计划"——
  // 前者必须显式报提交失败；普通散文里的花括号不算提交。
  const planLikeMarkers = /"\s*(?:schemaVersion|deckBrief|pages)\s*"\s*:/u.test(text);
  const error = new Error(`本轮正文里没有可解析的完整计划 JSON：${lastError?.message ?? '未找到 JSON'}。修复：把当前完整 gray-plan-3 计划 JSON 写进本轮消息正文（工具参数只放 layouts），再重试本工具。`);
  error.code = parsedWithoutPages || planLikeMarkers ? 'PLAN_INVALID' : 'PLAN_MISSING';
  throw error;
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
/**
 * D 类简短需求（一句话需求、无内容展开）需要先生成内容稿；本管线暂未接入该阶段，
 * 检测到时诚实拒绝（评审 #11 授权），不产出需求复述页。阈值取 60 字：库内 D 类 16–36 字，
 * 其余稿件均 ≥168 字，分界宽裕。
 */
export function requireExpandedManuscript(raw) {
  const length = String(raw ?? '').replace(/\s+/gu, '').length;
  if (length < 60) throw new Error('该稿件是简短需求（无内容展开）：D 类稿需先生成内容稿，灰稿管线暂未接入该阶段；请先补充内容稿或改用材料稿。');
}

/**
 * 规划期前移信号（任务 #151）：复用渲染期同一测量，把主题句单行预算与容量问题
 * 在规划尚可调整时暴露。主题句超预算与渲染门禁同一判定（确定性），按 issue 返回；
 * 容量、充实度均为「按默认组合」的预估，按 warning 返回、不阻断——单一留白比例不得阻止
 * 有实质内容的候选进入布局与预览（任务 #169-G02）；是否合理由实际页面判断。
 * 充实度阈值 0.4（页底）与 0.7/160px（区域）沿用几何审计的归档线。
 * 逐页独立：某页超容量只影响该页（warning），不得中断其余页的充实度检查。
 */
const SPARSE_VOID_LIMIT = 0.4;
export function planFitIssues(plan, area, { legacyEstimates = true } = {}) {
  const issues = [];
  const warnings = [];
  for (const page of plan?.pages ?? []) {
    if (topicFits(page.claim, area)) continue;
    const budget = Math.max(1, Math.floor((area.width * 0.88) / 28));
    issues.push({
      code: 'topic-overflow', pageId: page.pageId,
      message: `主题句超 28px 单行预算（本版面约 ${budget} 字内）：claim 只承担本页主要判断；范围、时间、条件、数字等限定改放正文、组标题或附注。`,
    });
  }
  for (const page of legacyEstimates ? plan?.pages ?? [] : []) {
    let estimatedVoid = null;
    try {
      const single = { ...plan, pages: [page] };
      const applied = applyTemplateDefaults(single, []);
      const built = resolveGrayLayout(single, { pages: applied.layouts }, area, {
        measureBody: grayBodyLayout, fitText: fitGrayText,
        fontSizes: () => [22, 20, 18, 16, 15, 14, 13, 12],
      });
      const bound = built.plan.pages[0];
      let maxBottom = 0;
      for (const region of bound.composition.regions) {
        const item = bound.items.find(candidate => candidate.id === region.itemId);
        const available = region.height - 70;
        const body = grayBodyLayout(item, region.width - 32, region.fontSize ?? 22, Math.max(0, available));
        maxBottom = Math.max(maxBottom, region.y + 54 + Math.max(0, ...body.sections.map(section => section.top + section.height)));
        // 区域级充实度（任务 #167-G02，按 #169 降为非阻断）：阈值沿用几何审计归档线（容器 ≥160px 且空洞 ≥70%）。
        const voidRatio = 1 - body.minimumHeight / Math.max(1, available);
        if (available >= 160 && voidRatio >= 0.7) {
          warnings.push({
            code: 'region-too-sparse', pageId: page.pageId, itemId: region.itemId,
            message: `该页组 ${region.itemId} 内容只占容器约 ${Math.round((1 - voidRatio) * 100)}%（按默认组合预估）：可考虑并组、改归属、换分区或改用相称的组合；由实际页面判断，不阻断。`,
          });
        }
      }
      estimatedVoid = 1 - maxBottom / area.height;
    } catch (error) {
      const details = error?.details;
      if (details?.pageId && Number.isFinite(details?.minimum?.height) && details.minimum.height > area.height) {
        warnings.push({
          code: 'plan-capacity', pageId: details.pageId,
          message: `按默认组合预估放不下：该页最小可读尺寸约 ${Math.ceil(details.minimum.width ?? 0)}×${Math.ceil(details.minimum.height)}，正文区 ${area.width}×${area.height}（超出约 ${Math.ceil(details.minimum.height - area.height)}px）。先按语义边界分页、合并同归属组或忠实压词；也可改用更省空间的组合后重试。`,
        });
      }
    }
    if (Number.isFinite(estimatedVoid) && estimatedVoid >= SPARSE_VOID_LIMIT) {
      warnings.push({
        code: 'page-too-sparse', pageId: page.pageId,
        message: `该页预估页底留白 ${Math.round(estimatedVoid * 100)}%（按默认组合预估）：可考虑并入相邻页、在本页承载原稿其余实质内容，或重新组织分页；由实际页面判断，不阻断。`,
      });
    }
  }
  return { issues, warnings };
}

export async function runGrayAgent({ source, output, area, root = process.cwd(), provider, maxTurns = 24, observer = null, visualReview = false, useLayoutRules = false, initialPlan = null }) {
  area = validateGrayArea(area);
  await fs.mkdir(output, { recursive: false }).catch(error => { if (error.code !== 'EEXIST') throw error; });
  if (await fs.access(path.join(output, 'state.json')).then(() => true, () => false)) throw new Error('输出目录里已有运行状态（可能属于旧运行或误复用），请使用新目录');
  const raw = await fs.readFile(source, 'utf8');
  requireExpandedManuscript(raw);
  const sourcePath = path.resolve(source);
  const base = newRunState(raw, sourcePath);
  base.sources = markFlowSources(base.sources);
  if (initialPlan) {
    const checked = validateSemanticPlan(base, initialPlan);
    if (!checked.accepted) throw new Error(`人工固定计划无效：${JSON.stringify(checked.issues)}`);
    await fs.writeFile(path.join(output, 'controlled-plan.json'), json(initialPlan));
  }
  const statePath = path.join(output, 'state.json');
  const agentDir = path.join(output, 'agent');

  const agentState = {
    ...base,
    grayDraft: {
      version: 'gray-agent-1', area, sourceHash: sha(raw), status: 'planning', humanReview: 'pending',
      layoutMode: useLayoutRules ? 'measured-rule-selection' : 'legacy-defaults',
      turns: [], renders: [], candidates: [], startedAt: new Date().toISOString(),
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
  const selectionInstruction = useLayoutRules ? `\n本次正式工作台启用已建布局规范选择：render_draft 内先测量候选，再调用独立选择器对照原稿判断关系、选择看板同源卡片式或相册式。以上旧默认模板/override说明不适用于本次布局执行，layouts 每页只需 {pageId}。不得按块数推断关系；跨组对照、因果、先后超出目前两类规范能力时会明确退回；主体与共同说明可保留为 primary / supporting 组并按主辅横带尝试，说明必须连续且正确限定主体，不能改错关系凑布局。可以保留真实关系重组为共同阅读的组，或据实说明能力缺口，不能为布局修改事实。主题句可引出、概括或总结。选择结果和理由会入运行记录，不代表视觉验收。` : '';
  const systemPrompt = `${GRAY_AGENT_PROMPT}\n\n以下为本项目共用规则真源：\n${sharedRules}${selectionInstruction}`;
  await fs.writeFile(path.join(output, 'agent-system-prompt.txt'), systemPrompt, 'utf8');

  // 视觉质检（可选）：渲染完成后用视觉模型看逐页截图。缺配置时如实标注不可用并放行，不卡流程。
  let visionProvider = null;
  try {
    const local = await loadDeepSeekLocalConfig(root);
    const visionModel = process.env.PPAGENT_DEEPSEEK_VISUAL_COMPOSITION_MODEL || local?.roles?.visualComposition?.model;
    if (visionModel) visionProvider = await buildChatProviderFromEnv({ root, model: visionModel, maxTokens: 4000, observer: observer ?? undefined });
  } catch { visionProvider = null; }

  let renderCount = 0;
  let completedTurns = 0;
  let lastContent = '';
  let lastReview = null;
  let lastPlan = initialPlan ? structuredClone(initialPlan) : null;
  let lastCheckedFingerprint = null;
  // 压缩记忆（方案 A 项 2）：逐页记录上一版容量失败实测高，随反馈回给模型。
  const lastMinimums = new Map();
  // 计划版本流（任务 #171-G03a，口径统一见 #173）：提交计划（正文含完整 JSON）与对已提交版本执行
  // 检查/审稿/渲染是两件事。正文没有新计划 JSON 时按当前已提交计划继续（内容指纹不变，审稿同版复用）；
  // 正文想提交但 JSON 损坏＝本次提交失败：计划不更新、显式报失败，继续用上一有效版本；审稿通过状态
  // 只随内容指纹变化失效（评审 #119），坏提交不会被静默当作已修订。
  const resolvePlan = () => {
    try {
      const submitted = extractPlan(lastContent);
      if (initialPlan && JSON.stringify(submitted) !== JSON.stringify(initialPlan)) {
        return { plan: lastPlan, source: 'submission-failed', note: '人工固定组织对照禁止更改计划：请不提交新JSON，沿用固定计划检查、审稿、选版与渲染；无法承载或语义审稿失败应如实报告。' };
      }
      lastPlan = submitted;
      return { plan: lastPlan, source: 'message' };
    } catch (error) {
      if (!lastPlan) throw error;
      if (error.code === 'PLAN_INVALID') {
        return { plan: lastPlan, source: 'submission-failed', note: '本次提交失败：正文里的计划 JSON 无法解析，未更新计划（仍按上一有效版本继续）。如需修订，请把完整的 gray-plan-3 计划重新写进正文。' };
      }
      return { plan: lastPlan, source: 'current-plan', note: '本轮正文没有新计划 JSON：按当前已提交计划（内容指纹不变）继续；如已修订，请把完整 gray-plan-3 计划写进正文，修订才会生效并需重新审稿。' };
    }
  };
  // 任务 #198：渲染成功后进入有界复核。首次成功存候选（firstGood），模型在后续回合消费文字/几何诊断，
  // 只能 finish_draft（保持，可退回更早候选）或做一次修订周期；交付只由 finish 触发，预算耗尽时按
  // 第一次成功候选如实标注未完成复核交付（candidateDelivery），不冒充已复核。
  const candidates = agentState.grayDraft.candidates;
  const currentTurnNumber = () => completedTurns + 1;
  const buildDiagnostics = (built, plan) => built.plan.pages.map((page, index) => {
    const receipt = built.receipts[index];
    const groupsById = new Map((plan.pages[index]?.groups ?? []).map(group => [group.id, group]));
    const regions = page.composition.regions.map(region => {
      const group = groupsById.get(region.itemId);
      const textChars = (group?.blocks ?? []).reduce((sum, block) => sum + String(block.label ?? '').length + String(block.text ?? '').length, 0);
      const minimum = receipt?.contentMinimums?.[region.itemId]?.minHeight ?? null;
      const allocated = Math.round(region.height);
      const bodyOverhead = 70;
      const textMinimum = Number.isFinite(minimum) ? Math.max(0, minimum - bodyOverhead) : null;
      const textAllocated = Math.max(1, allocated - bodyOverhead);
      return {
        itemId: region.itemId, width: Math.round(region.width), allocatedRegionHeight: allocated, fontSize: region.fontSize,
        textChars,
        // 同一口径：两边都含 70px 标题/边距开销；不 clamp，真溢出就 >1。
        minimumRegionHeight: minimum,
        occupancy: Number.isFinite(minimum) ? Number((minimum / Math.max(1, allocated)).toFixed(2)) : null,
        // 正文口径：两边都扣同一开销，看实际文字占用与外框占用的差别。
        textOccupancy: Number.isFinite(textMinimum) ? Number((textMinimum / textAllocated).toFixed(2)) : null,
      };
    });
    const bottom = Math.max(0, ...page.composition.regions.map(region => region.y + region.height));
    const weights = receipt?.layout?.weights ?? null;
    return {
      pageId: page.pageId, title: page.title, fontSize: receipt?.fontSize ?? null,
      weights,
      ...(receipt?.selection ? { layoutSelection: receipt.selection, family: receipt.layout.family } : {}),
      weightsSource: weights ? (receipt?.formPick ? (receipt.formPick.requested ? 'requested' : 'fallback') : null) : null,
      reweighted: receipt?.reweighted ?? null,
      // 框外页底空白（按最下方区域框计），不是内容填充率：缩小它未必改善阅读。
      pageBottomWhitespace: Number((1 - bottom / area.height).toFixed(2)),
      frameHeight: Math.round(bottom), areaHeight: area.height,
      regions,
    };
  });
  /** 把选定候选的产物、计划、审稿覆盖与状态发布到运行根目录（交付或候选交付）；同一版本成套复制。 */
  const publishCandidate = async (candidate, { mode, delivery = null, stopReason = null, note = null }) => {
    const candidatePlan = JSON.parse(await fs.readFile(path.join(output, candidate.directory, 'plan.json'), 'utf8'));
    // 任务 #200：发布前断言磁盘计划与登记指纹同版，且审稿覆盖的就是该版本；不一致就报缺口，不冒充成功。
    const diskFingerprint = planContentFingerprint(semanticPlanFromPages(candidatePlan));
    if (diskFingerprint !== candidate.contentFingerprint) throw new Error(`候选计划指纹与登记不一致：磁盘 ${diskFingerprint} vs 登记 ${candidate.contentFingerprint}`);
    if (candidate.reviewedFingerprint !== candidate.contentFingerprint) throw new Error(`候选审稿指纹与内容指纹不一致：${candidate.reviewedFingerprint} vs ${candidate.contentFingerprint}`);
    const report = validateGrayPlan(base, candidatePlan, area);
    if (!report.accepted) throw new Error(`选定候选的计划复检未通过：${JSON.stringify(report.issues.slice(0, 3))}`);
    for (const name of ['gray-draft.pptx', 'editable-check.json', 'preview-index.json', 'plan.json']) {
      await fs.copyFile(path.join(output, candidate.directory, name), path.join(output, name));
    }
    await fs.cp(path.join(output, candidate.directory, 'preview'), path.join(output, 'preview'), { recursive: true });
    agentState.pages = report.state?.pages ?? agentState.pages;
    agentState.artifactState = Object.fromEntries((report.state?.pages ?? []).map(page => [page.pageId, {
      status: 'rendered-awaiting-review', revision: page.revision,
      pptxPath: path.join(candidate.directory, 'gray-draft.pptx'),
    }]));
    agentState.grayDraft.plan = candidatePlan;
    agentState.grayDraft.reviewNotes = { status: 'clean', at: candidate.at, fingerprint: candidate.reviewedFingerprint };
    agentState.grayDraft.reviewCoverage = {
      status: 'covered', deliveredFingerprint: candidate.contentFingerprint, reviewedFingerprint: candidate.reviewedFingerprint,
      checkedAt: new Date().toISOString(), ...(mode === 'candidate' ? { candidate: true } : {}),
    };
    const post = agentState.grayDraft.postRender;
    post.completed = mode === 'finish';
    post.stopReason = stopReason;
    if (mode === 'finish') post.delivery = delivery;
    else post.candidate = { renderId: candidate.renderId, directory: candidate.directory, contentFingerprint: candidate.contentFingerprint, note };
    agentState.grayDraft.candidateDelivery = mode === 'candidate';
    if (mode === 'candidate') agentState.grayDraft.candidateNote = note;
    agentState.grayDraft.status = 'awaiting-user-review';
    await saveAgentState();
  };
  const tools = [
    defineTool({
      name: 'check_plan',
      description: '对你当前已提交的完整 gray-plan-3 计划做程序检查：结构字段、来源引用与覆盖、块级数字/引文保真；并返回逐页默认版式（defaults，含特征依据）与规划期预估（主题句单行预算、按默认组合的容量与充实度，均为非阻断提示）。计划通过"提交"更新：把完整计划 JSON 写进本轮正文即提交新版本（旧审稿失效）；未写新 JSON 时对当前已提交版本继续（结论同上会标注）；正文里想提交但 JSON 损坏＝本次提交失败，本工具只回报失败、不检查。不接收计划参数——计划写在本轮正文里。返回 {accepted, issues, coverage, defaults, planSource}。任何规划改动后都应重新调用。',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      handler: async () => {
        const { plan, source, note } = resolvePlan();
        // 任务 #175：坏提交是失败控制流——不检查、不更新计划、不冒充已修订。
        if (source === 'submission-failed') {
          return { accepted: false, planSource: source, issues: [], coverage: null, note: '本次提交失败：正文中的计划 JSON 无法解析，未运行检查。请重发完整合法 JSON；下一轮明确沿用上一版（不写新计划）可继续。' };
        }
        const fingerprint = planContentFingerprint(plan);
        const repeated = lastCheckedFingerprint === fingerprint;
        lastCheckedFingerprint = fingerprint;
        const report = validateSemanticPlan(base, plan);
        const fit = planFitIssues(plan, area, { legacyEstimates: !useLayoutRules });
        const issues = [...report.issues, ...fit.issues].slice(0, 20);
        const warnings = [...(report.warnings ?? []), ...fit.warnings];
        let spatialRequirements, paginationAdvice;
        if (useLayoutRules && report.accepted) {
          spatialRequirements = measuredLayoutCandidates(plan, area, { measureBody: grayBodyLayout, fitText: fitGrayText });
          paginationAdvice = adjacentPageLayoutAdvice(plan, area, { measureBody: grayBodyLayout, fitText: fitGrayText });
          for (const page of spatialRequirements) {
            if (!page.candidates.length) issues.push({ code: 'layout-capacity', pageId: page.pageId, message: '当前分组没有可承载布局，请在语义不变的前提下重新组织；宽度与高度测量见 spatialRequirements。' });
          }
        }
        const notes = [note, repeated ? '该版本自上次检查后未变化：结论同上；有修订请提交新计划。' : null].filter(Boolean);
        return { accepted: report.accepted && !issues.length, issues, coverage: report.coverage, defaults: useLayoutRules ? [] : describeDefaults(plan), layoutMode: useLayoutRules ? 'measured-rule-selection' : 'legacy-defaults', ...(spatialRequirements ? { spatialRequirements, paginationAdvice } : {}), planSource: source, ...(warnings.length ? { warnings } : {}), ...(notes.length ? { note: notes.join(' ') } : {}) };
      },
    }),
    defineTool({
      name: 'semantic_review',
      description: '用独立审稿调用对照原稿复核你当前已提交的计划：事实/条件/否定与模拟声明完整性、页面职责、关系表达与结构选择。issues 是阻塞项（实质改变理解的失真、遗漏、层级/归属/关系错误），notes 是建议/已解决说明（不阻塞渲染）。同一内容指纹已审过时复用结论、不重复调用；提交新计划后自动重新审稿。正文里想提交但 JSON 损坏＝本次提交失败，本工具只回报失败、不审稿。渲染前须有覆盖当前内容指纹的有效通过。',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      handler: async () => {
        const { plan, source, note } = resolvePlan();
        // 任务 #175：坏提交时先于缓存判定——不审稿、不覆盖失败信息、不写审稿记录。
        if (source === 'submission-failed') {
          agentState.grayDraft.submissionFailures = (agentState.grayDraft.submissionFailures ?? 0) + 1;
          await saveAgentState();
          return { accepted: false, planSource: source, issues: [], notes: [], reviewedFingerprint: null, coverage: null, limits: null, note: '本次提交失败：正文中的计划 JSON 无法解析，未运行审稿（不得用旧版结论冒充通过）。请重发完整合法 JSON；下一轮明确沿用上一版可继续。' };
        }
        const fingerprint = planContentFingerprint(plan);
        // 同版复用（任务 #171-G03a）：同一内容指纹已审过且未修订时不重复付费调用审稿，直接复用结论；
        // 修订内容后指纹变化，审稿会重新运行（通过状态也随之失效，评审 #119）。
        if (lastReview && lastReview.fingerprint === fingerprint) {
          return { accepted: lastReview.accepted, issues: lastReview.issues, notes: lastReview.notes ?? [], reviewedFingerprint: fingerprint, coverage: lastReview.coverage ?? null, limits: lastReview.limits ?? null, planSource: source, note: '该版本与最近一次审稿的内容一致：结论复用（未重复调用审稿）；修订内容后会自动重新审稿。' };
        }
        const reviewFeedback = Array.isArray(lastReview?.issues) && lastReview.issues.length
          ? lastReview.issues.map(issue => ({
            ...(issue.pageId ? { pageId: issue.pageId } : {}),
            ...(Array.isArray(issue.sourceIds) ? { sourceIds: issue.sourceIds } : {}),
            problem: issue.problem,
            verify: '上轮发现是否仍存在：按当前可见内容与原稿复核；已用其他呈现解决即算解决，不要求采用上轮建议的措辞、载体或位置。',
          }))
          : null;
        const reviewInput = semanticReviewInput({ source: raw, area, plan, reviewFeedback, flowSources: base.sources.filter(item => item.flow).map(item => ({ id: item.id, flow: item.flow, preview: String(item.text).slice(0, 60) })) });
        const response = await provider.complete({ messages: [{ role: 'system', content: SEMANTIC_REVIEW_CONTRACT }, { role: 'user', content: JSON.stringify(reviewInput) }] });
        const parsed = parseModelJson(response);
        if (typeof parsed.accepted !== 'boolean' || !Array.isArray(parsed.issues)) throw new Error('审稿响应格式无效');
        if (parsed.notes !== undefined && !Array.isArray(parsed.notes)) throw new Error('审稿响应格式无效（notes 必须是数组）');
        // 任务 #173：issues 只承载阻塞项——非空即阻塞（accepted 不得绕过门禁）；notes 为建议/已解决说明，不阻塞。
        const blocking = parsed.issues;
        const notes = Array.isArray(parsed.notes) ? parsed.notes.slice(0, 12) : [];
        const accepted = parsed.accepted === true && blocking.length === 0;
        // 版本绑定（评审 #119 要求 1）：记录所审内容的内容指纹；通过状态只覆盖这一版内容。
        const at = new Date().toISOString();
        agentState.grayDraft.reviewRecord = [...(agentState.grayDraft.reviewRecord ?? []), { at, source, fingerprint, ...snapshotSemanticReview(parsed) }];
        await saveAgentState();
        lastReview = { accepted, issues: blocking.slice(0, 12), notes, at, fingerprint, coverage: parsed.coverage ?? null, limits: parsed.limits ?? null };
        return { accepted: lastReview.accepted, issues: lastReview.issues, notes: lastReview.notes, reviewedFingerprint: fingerprint, coverage: lastReview.coverage, limits: lastReview.limits, planSource: source, ...(note ? { note } : {}) };
      },
    }),
    defineTool({
      name: 'render_draft',
      description: '按你当前已提交的计划与每页基础组合求解几何并渲染灰稿候选。layouts 是逐页数组 [{pageId, layout?, override?}]：pageId 必填；layout 可省略（省略即采用该页默认版式）；layout 为简式 {type:"single|row|column|grid",weights?,columns?} 或嵌套 {type,weights?,columns?,children:[…]}（children 项为 {groupId} 或嵌套组合，按阅读顺序恰好覆盖本页全部组一次，最多三层）。每页有程序默认版式（按组数与实文量）；改用其它组合时，在 layouts 的该页条目里把 override 与 layout 同级写：{pageId:"p2", layout:{...}, override:{reason:"一句话理由"}}——override 不能放进 layout 对象里，理由入档分析；仅微调 weights 不算覆盖。这是小参数，仍走工具参数。程序检查通过且审稿覆盖当前内容指纹即可渲染；成功返回候选 {accepted:true, candidate:true, renderId, diagnostics, preview, pptx}——本轮尚未交付，复核 diagnostics 后调用 finish_draft。审稿的阻塞项（issues）未通过前不得渲染；正文里想提交但 JSON 损坏＝本次提交失败，本工具只回报失败、不渲染旧版。失败返回 {accepted:false, stage:"template|geometry|check|submission-failed|revision-budget|stall|…", reason, issues}，据此修订后重试；首次成功后的修订周期上限为一次，失败尝试不计入。',
      inputSchema: RENDER_LAYOUTS_SCHEMA,
      handler: async ({ layouts }) => {
        const { plan, source: planSource, note: planNote } = resolvePlan();
        // 任务 #175：坏提交不得渲染旧版冒充本次提交（失败控制流）。
        if (planSource === 'submission-failed') {
          agentState.grayDraft.submissionFailures = (agentState.grayDraft.submissionFailures ?? 0) + 1;
          agentState.grayDraft.renders.push({ render: renderCount + 1, accepted: false, stage: 'submission-failed', reason: '本次提交失败：计划 JSON 无法解析' });
          await saveAgentState();
          return { accepted: false, stage: 'submission-failed', reason: '本次提交失败：正文中的计划 JSON 无法解析，未渲染（不得用旧版冒充本次提交）。请重发完整合法 JSON；下一轮明确沿用上一版可继续。' };
        }
        // 任务 #198：首次成功后的修订周期上限——成功渲染只计一次修订；坏提交/模板/几何失败不计入，
        // 避免"失败反复重开周期"，同时保住已有候选。
        const postRender = agentState.grayDraft.postRender;
        if (postRender && postRender.revisions >= postRender.maxRevisions) {
          const reason = `首次成功后的修订周期已用完（成功渲染 ${1 + postRender.revisions} 次）：请用 finish_draft 保持候选（可用 renderId 退回更早候选并写明原因），不要再渲染。`;
          return { accepted: false, stage: 'revision-budget', reason };
        }
        // 版本绑定门禁（评审 #119 要求 1）：审稿通过只覆盖它所审的那一版内容；内容改动后通过即失效。
        // 未复核（not-reviewed）、有遗留问题（open-issues）或已过期（stale）的版本不得继承通过状态，也不得渲染交付。
        const coverage = checkReviewCoverage(lastReview, plan);
        if (!coverage.covered) {
          const reason = coverage.status === 'not-reviewed'
            ? '当前计划尚未通过独立审稿：先 semantic_review 本版本，通过后再渲染；未复核版本不得交付。'
            : coverage.status === 'open-issues'
              ? '最近一次审稿未通过（遗留问题尚未解决）：修订后重新 semantic_review，通过后再渲染；未复核版本不得交付。'
              : '计划内容在上次审稿通过后已改动：通过状态不跨内容改动继承——请对当前版本重新 semantic_review，通过后再渲染。';
          agentState.grayDraft.renders.push({ render: renderCount + 1, accepted: false, stage: 'review-stale', status: coverage.status, reason, contentFingerprint: coverage.fingerprint });
          await saveAgentState();
          return { accepted: false, stage: 'review-stale', status: coverage.status, reason };
        }
        // 同版重试检测（方案 A 项 1）：该指纹版本已因容量失败过——确定性结果，直接拒绝并反馈压缩要求。
        const fingerprint = attemptFingerprint(plan, layouts);
        if (isStalledRetry(agentState.grayDraft.renders, fingerprint)) {
          const reason = '本轮文案与版式与已失败版本相同，重复求解不会改变容量。请根据页面目的调整组合、比例或分页，或忠实精简冗词；保留必要内容与归属。';
          agentState.grayDraft.stalls = [...(agentState.grayDraft.stalls ?? []), { at: new Date().toISOString(), fingerprint, reason }];
          await saveAgentState();
          return { accepted: false, stage: 'stall', reason };
        }
        // 任务 #208：同一计划＋同一布局请求的模板门失败不允许原样重发——第二次就按停滞拒绝并给出可行动出路。
        // 指纹沿用 attemptFingerprint（含计划内容指纹与 layouts 的稳定序列化，覆盖嵌套/weights/columns/页序）。
        const priorTemplateFailure = [...(agentState.grayDraft.renders ?? [])].reverse()
          .some(record => record?.accepted === false && record?.stage === 'template' && record?.fingerprint === fingerprint);
        if (priorTemplateFailure) {
          const reason = '同一计划与同一布局请求已因模板门失败过（重复模板请求）：采用模板默认（该页只写 {pageId}、省略 layout），或在 layouts 的页条目把 override 与 layout 同级写：{pageId, layout:{...}, override:{reason:"一句话理由"}} 后重试；不要原样重发同一请求。';
          agentState.grayDraft.stalls = [...(agentState.grayDraft.stalls ?? []), { at: new Date().toISOString(), stage: 'template', fingerprint, reason }];
          await saveAgentState();
          return { accepted: false, stage: 'stall', reason };
        }
        renderCount += 1;
        const attemptDir = path.join(output, 'agent-renders', `render-${renderCount}`);
        await fs.mkdir(attemptDir, { recursive: true });
        let applied;
        try {
          applied = useLayoutRules ? { layouts: [], decisions: [] } : applyTemplateDefaults(plan, layouts);
        } catch (error) {
          const failure = { accepted: false, stage: 'template', reason: error.message };
          await fs.writeFile(path.join(attemptDir, 'failure.json'), json({ ...failure, plan, layouts }), 'utf8');
          agentState.grayDraft.renders.push({ render: renderCount, accepted: false, stage: 'template', reason: error.message, fingerprint });
          // 任务 #208：模板失败的稳定指纹/原因也入 stalls，供重复请求检测与审计。
          agentState.grayDraft.stalls = [...(agentState.grayDraft.stalls ?? []), { at: new Date().toISOString(), stage: 'template', fingerprint, reason: error.message }];
          await saveAgentState();
          return failure;
        }
        await fs.writeFile(path.join(attemptDir, 'templates.json'), json({
          defaults: applied.decisions.filter(decision => decision.mode === 'default').length,
          overrides: applied.decisions.filter(decision => decision.mode === 'override').length,
          decisions: applied.decisions,
        }), 'utf8');
        let built;
        try {
          built = useLayoutRules ? await selectMeasuredLayouts({ plan, area, source: raw, provider, directory: attemptDir, metrics: { measureBody: grayBodyLayout, fitText: fitGrayText } }) : resolveGrayLayout(plan, { pages: applied.layouts }, area, {
            measureBody: grayBodyLayout, fitText: fitGrayText,
            fontSizes: () => [22, 20, 18, 16, 15, 14, 13, 12],
          });
        } catch (error) {
          const details = error.details ?? null;
          const pageMinimum = Math.ceil(details?.minimum?.height ?? 0);
          const previousMinimum = details?.pageId && lastMinimums.has(details.pageId) ? lastMinimums.get(details.pageId) : undefined;
          const memory = pageMinimum > 0 ? compressionMemory({ currentMinimum: pageMinimum, areaHeight: area.height, previousMinimum }) : null;
          // 同最小高重试检测（评审 #26 批准）：实测高未降且文本量未缩短——按停滞拒绝，逼真压缩。
          const textVolume = planTextVolume(plan);
          const previousGeometry = [...agentState.grayDraft.renders].reverse().find(record => record?.accepted === false && record?.stage === 'geometry');
          if (details?.pageId && isSameMinimumRetry({ previousMinimum, currentMinimum: pageMinimum, previousTextLength: previousGeometry?.textVolume, currentTextLength: textVolume })) {
            const reason = `本轮实测最小高 ${pageMinimum}px，未比上一版 ${previousMinimum}px 更小（文本量也未缩短）：当前改动尚未缓解容量问题，请根据语义边界调整组合或分页，也可忠实精简冗词，不能删掉必要条件。`;
            agentState.grayDraft.stalls = [...(agentState.grayDraft.stalls ?? []), { at: new Date().toISOString(), fingerprint, reason }];
            agentState.grayDraft.renders.push({ render: renderCount, accepted: false, stage: 'stall-minimum', reason, fingerprint, textVolume, ...(pageMinimum > 0 ? { pageMinimums: { [details.pageId]: pageMinimum } } : {}) });
            await saveAgentState();
            return { accepted: false, stage: 'stall', reason };
          }
          if (details?.pageId && pageMinimum > 0) lastMinimums.set(details.pageId, pageMinimum);
          const failure = {
            accepted: false, stage: 'geometry',
            reason: `${error.message}${memory ? memory.note : ''}`,
            details: details ? { ...details, ...(memory ? { previousMinimum: memory.previousMinimum, targetDelta: memory.targetDelta, previousTargetDelta: memory.previousTargetDelta } : {}) } : null,
          };
          await fs.writeFile(path.join(attemptDir, 'failure.json'), json({ ...failure, plan, layouts }), 'utf8');
          agentState.grayDraft.renders.push({ render: renderCount, accepted: false, stage: 'geometry', reason: error.message, fingerprint, textVolume, ...(details?.pageId && pageMinimum > 0 ? { pageMinimums: { [details.pageId]: pageMinimum } } : {}) });
          await saveAgentState();
          return failure;
        }
        const report = validateGrayPlan(base, built.plan, area);
        if (!report.accepted) {
          const failure = { accepted: false, stage: 'check', reason: '规划或组合检查未通过', issues: report.issues.slice(0, 20) };
          await fs.writeFile(path.join(attemptDir, 'failure.json'), json({ ...failure, plan, layouts }), 'utf8');
          agentState.grayDraft.renders.push({ render: renderCount, accepted: false, stage: 'check', issues: report.issues.length, fingerprint });
          await saveAgentState();
          return failure;
        }
        await fs.writeFile(path.join(attemptDir, 'plan.json'), json({ ...built.plan, planningNotes: plan.planningNotes }), 'utf8');
        await fs.writeFile(path.join(attemptDir, 'layout.json'), json(layouts), 'utf8');
        // 渲染到独立尝试目录：每次尝试都留证据；交付版复制到运行根目录。
        const renderState = { ...report.state, grayDraft: { ...agentState.grayDraft, status: 'rendering' } };
        await renderGrayDraft(renderState, attemptDir);
        // 几何审计（空洞检测）：逐页留白指标与 warn 记录，不阻塞交付（评审 #3 任务合同）。
        const audit = auditGeometry(renderState.pages, area);
        const geometryWarnings = voidWarnings(audit);
        await fs.writeFile(path.join(attemptDir, 'geometry-audit.json'), json({ audit, warnings: geometryWarnings, thresholds: VOID_THRESHOLDS }), 'utf8');
        // 视觉评审：**可选诊断开关**（默认关）。正常生成线不做"质检-打回"循环——那会把单次生成
        // 拖到分钟级、成本成倍；评审发现的模式性问题由开发侧改提示词解决，不放进生成路径。
        if (visionProvider && visualReview) {
          let visual;
          try { visual = await visualReview(attemptDir, renderState.pages, visionProvider); }
          catch (error) { visual = { accepted: false, unavailable: true, issues: [], note: error?.message ?? String(error) }; }
          await fs.writeFile(path.join(attemptDir, 'visual-review.json'), json(visual), 'utf8');
          agentState.grayDraft.visualReview = { at: new Date().toISOString(), ...visual };
        }
        const reweighted = (built.receipts ?? []).filter(receipt => receipt.reweighted).map(receipt => ({ pageId: receipt.pageId, ...receipt.reweighted }));
        const formFont = (built.receipts ?? []).filter(receipt => Number.isFinite(receipt.fontSize) && receipt.fontSize !== 22).map(receipt => ({ pageId: receipt.pageId, fontSize: receipt.fontSize }));
        // 任务 #198：成功渲染只登记候选，不交付——模型须在后续回合复核诊断后 finish_draft。
        const candidate = {
          renderId: renderCount, directory: path.relative(output, attemptDir), at: new Date().toISOString(),
          contentFingerprint: coverage.fingerprint, reviewedFingerprint: coverage.reviewedFingerprint,
          reviewCovered: coverage.covered, turn: currentTurnNumber(),
          fonts: built.receipts.map(receipt => ({ pageId: receipt.pageId, fontSize: receipt.fontSize })),
          ...(reweighted.length ? { reweighted } : {}), ...(formFont.length ? { formFont } : {}),
        };
        candidates.push(candidate);
        agentState.grayDraft.renders.push({ render: renderCount, accepted: true, artifactDirectory: candidate.directory, fingerprint, ...(reweighted.length ? { reweighted } : {}), ...(formFont.length ? { formFont } : {}) });
        agentState.grayDraft.artifactDirectory = candidate.directory;
        agentState.grayDraft.plan = built.plan;
        agentState.grayDraft.programCheck = { ...report, state: undefined };
        const post = agentState.grayDraft.postRender ?? { startedAt: new Date().toISOString(), firstRenderId: renderCount, revisions: 0, maxRevisions: 1, completed: false };
        if (post.firstRenderId !== renderCount) post.revisions += 1;
        agentState.grayDraft.postRender = post;
        agentState.grayDraft.status = 'rendered-review';
        await saveAgentState();
        const diagnostics = buildDiagnostics(built, plan);
        const preview = renderState.pages.map((page, index) => `${path.relative(output, attemptDir)}/preview/slide-${String(index + 1).padStart(2, '0')}.png`);
        return { accepted: true, candidate: true, renderId: renderCount, preview, pptx: `${path.relative(output, attemptDir)}/gray-draft.pptx`, pages: renderState.pages.length, planSource, templates: { defaults: applied.decisions.filter(decision => decision.mode === 'default').length, overrides: applied.decisions.filter(decision => decision.mode === 'override').length }, ...(reweighted.length ? { reweighted } : {}), ...(formFont.length ? { formFont } : {}), ...(geometryWarnings.length ? { geometry: geometryWarnings } : {}),           ...(report.warnings?.length ? { warnings: report.warnings } : {}), diagnostics, note: '本轮渲染成功但尚未交付：复核 diagnostics（只有文字与几何，无像素图）后 finish_draft 保持，或在正文提交一次修订后重渲染再 finish。' };
      },
    }),
    defineTool({
      name: 'finish_draft',
      description: '明确结束并交付审阅：保持某个已渲染候选。必须在该候选的 render 回执进入后续回合之后调用（同一轮 render+finish 不算看过诊断）。参数：review（必填，一句复核结论或剩余问题：对照原稿与当前页首/区域内容检查因果对象、条件范围、编辑口吻等实际语义，并判阅读质量——正文是否完成提炼、对照维度能否直接对应、短说明空间是否相称、字号与内容是否匹配；保留首稿要写真实取舍，不能把影响阅读的问题转交后续美化）；renderId（可选，默认最新候选；可显式退回更早候选）；reason（选定候选与当前计划内容不一致、或退回旧候选/未采用修订时必须写明原因）。程序核对所选候选的计划、审稿覆盖、布局与产物属于同一版本；本线复核只有文字与几何，未看像素图。成功返回 {accepted:true, delivered:true, renderId, contentFingerprint, revisionNotAdopted}；失败返回 {accepted:false, stage:"finish-before-render|finish-same-turn|finish-version-mismatch|finish-needs-review|finish-unknown-render|finish-invalid|finish-submission-failed", reason}。',
      inputSchema: {
        type: 'object',
        properties: {
          review: { type: 'string' },
          renderId: { type: 'number' },
          reason: { type: 'string' },
        },
        required: ['review'], additionalProperties: false,
      },
      handler: async ({ review, renderId, reason }) => {
        const { plan, source: planSource } = resolvePlan();
        // 任务 #200：坏提交＋finish 不得用旧计划宣布成功——与另外三工具同口径显式报提交失败。
        if (planSource === 'submission-failed') {
          agentState.grayDraft.submissionFailures = (agentState.grayDraft.submissionFailures ?? 0) + 1;
          await saveAgentState();
          return { accepted: false, stage: 'finish-submission-failed', reason: '本次提交失败：正文里的计划 JSON 无法解析，本轮不 finish（不得用旧计划冒充已复核的修订）。请重发完整合法 JSON；下一轮明确沿用旧候选再 finish。' };
        }
        const post = agentState.grayDraft.postRender;
        if (!post || !candidates.length) {
          return { accepted: false, stage: 'finish-before-render', reason: '还没有成功渲染的候选：先 render_draft，再在后续回合 finish_draft。' };
        }
        if (typeof review !== 'string' || !review.trim()) {
          return { accepted: false, stage: 'finish-needs-review', reason: 'finish_draft 需要 review：写一句复核结论或剩余问题（对照原稿与当前页首/区域内容）。' };
        }
        const chosen = renderId !== undefined
          ? candidates.find(candidate => candidate.renderId === renderId)
          : candidates[candidates.length - 1];
        if (!chosen) {
          return { accepted: false, stage: 'finish-unknown-render', reason: `renderId ${renderId} 不是本 run 的成功候选：${candidates.map(candidate => candidate.renderId).join('、')}。` };
        }
        if (chosen.turn >= currentTurnNumber()) {
          return { accepted: false, stage: 'finish-same-turn', reason: '该渲染发生在本轮：请在后续回合复核诊断后再 finish_draft（同一轮的 render+finish 不算看过诊断）。' };
        }
        const currentFingerprint = planContentFingerprint(plan);
        const contentChanged = currentFingerprint !== chosen.contentFingerprint;
        // 任务 #200：选择非最新候选（即使内容指纹相同、只是布局不同）也要说明退回原因，并记录未采用的修订。
        const superseded = chosen !== candidates[candidates.length - 1];
        const revisionNotAdopted = contentChanged || superseded;
        if (revisionNotAdopted && (typeof reason !== 'string' || !reason.trim())) {
          return { accepted: false, stage: 'finish-version-mismatch', reason: `选定候选${contentChanged ? '与当前计划内容不一致' : '不是最新候选（有未采用的布局修订）'}：请在 reason 里写明退回原因。` };
        }
        if (!chosen.reviewCovered) {
          return { accepted: false, stage: 'finish-uncovered', reason: '该候选没有有效审稿覆盖：先 semantic_review 该版本，再渲染并 finish。' };
        }
        const delivery = {
          renderId: chosen.renderId, directory: chosen.directory, contentFingerprint: chosen.contentFingerprint,
          reviewedFingerprint: chosen.reviewedFingerprint, review: review.trim(),
          reason: typeof reason === 'string' && reason.trim() ? reason.trim() : null,
          contentChanged, superseded,
          ...(superseded ? { supersededRenderId: candidates[candidates.length - 1].renderId } : {}),
          revisionNotAdopted, currentPlanFingerprint: currentFingerprint, at: new Date().toISOString(),
        };
        try {
          await publishCandidate(chosen, { mode: 'finish', delivery });
        } catch (error) {
          return { accepted: false, stage: 'finish-invalid', reason: error.message };
        }
        return { accepted: true, delivered: true, renderId: chosen.renderId, contentFingerprint: chosen.contentFingerprint, revisionNotAdopted, contentChanged, superseded, note: '已交付审阅（候选，等待用户验收）；复核只有文字与几何，未看像素图。' };
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
    userMessage: `${initialPlan ? `人工固定组织受控对照（不代表自动分页能力）：以下计划已加载，禁止改动页面、分组、文案、来源与关系；不要重新提交JSON，直接check_plan与semantic_review，之后照常render_draft、finish_draft。审稿失败或容量不足则如实报告，不绕过。布局不固定，由正式选择器选择。\n固定计划：${JSON.stringify(initialPlan)}\n\n` : ''}稿件全文：\n${raw}\n\n来源切分（引用 sourceIds 必须以此表为准；preview 是该来源的开头，完整内容见稿件全文）：\n${JSON.stringify(base.sources.map(source => ({
      id: source.id,
      ...(source.heading ? { heading: source.heading } : {}),
      ...(source.flow ? { flow: `流转信息（${source.flow}）：无需引用；默认不上屏，确有展示价值（如文档标题、署名）时可自然出现` } : {}),
      preview: source.text.length > 80 ? `${source.text.slice(0, 80)}…` : source.text,
    })), null, 1)}\n\n目标区尺寸：宽 ${area.width} × 高 ${area.height}（设计像素）。请把它做成灰稿：先规划，用工具检查与审稿，渲染成功后在后续回合复核诊断并 finish_draft 交付；没有 finish 就停下会被如实标为未完成复核的候选。`,
    registry: observed,
    maxTurns,
    onTurn: async record => {
      const turnDir = path.join(agentDir, `turn-${record.turn}`);
      await fs.mkdir(turnDir, { recursive: true });
      await fs.writeFile(path.join(turnDir, 'response.json'), json({ content: record.content, toolCalls: record.toolCalls.map(call => ({ name: call.name, args: call.args })), stalled: record.stalled }), 'utf8');
      agentState.grayDraft.turns.push({ turn: record.turn, stalled: record.stalled, tools: record.toolCalls.map(call => call.name) });
      completedTurns = record.turn;
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
    // 任务 #198：预算耗尽/未 finish 时，把**第一次成功渲染**作为"未完成复核的候选"如实交付：
    // 不设正常交付记录（postRender.delivery 只由 finish 写）、不冒充已复核；记录真实 stopReason、
    // 首次成功后的失败尝试与未渲染/未采用的计划改动。没有成功候选时才退回确定性兜底渲染。
    let candidateRendered = false;
    if (candidates.length) {
      try {
        const first = candidates[0];
        const currentFingerprint = lastPlan ? planContentFingerprint(lastPlan) : null;
        const unapplied = currentFingerprint && currentFingerprint !== first.contentFingerprint
          ? { planFingerprint: currentFingerprint, note: '当前计划有未渲染或未采用的改动；交付的是第一次成功候选。' }
          : null;
        const lastFailed = [...agentState.grayDraft.renders].reverse().find(record => record?.accepted === false);
        const note = `未完成复核的候选：模型未调用 finish_draft（stopReason=${result.stopReason}${result.note ? `；${result.note}` : ''}）；交付的是第一次成功候选（renderId ${first.renderId}）。`
          + (unapplied ? ` ${unapplied.note}` : '')
          + (lastFailed ? ` 首次成功后另有失败尝试：${lastFailed.stage}。` : '');
        await publishCandidate(first, { mode: 'candidate', stopReason: result.stopReason, note });
        agentState.grayDraft.postRender.failure = lastFailed ? { stage: lastFailed.stage, reason: lastFailed.reason ?? null } : null;
        agentState.grayDraft.postRender.unappliedPlan = unapplied;
        await saveAgentState();
        candidateRendered = true;
      } catch (error) {
        agentState.grayDraft.candidateFailure = String(error?.message ?? error);
      }
    }
    if (!candidateRendered && lastPlan && !useLayoutRules) {
      // 确定性兜底（评审 #58）：从未成功渲染时按默认组合渲染候选并如实标未复核——候选仅供人审，
      // 绝不继承通过状态；渲染失败或检查未过仍按 blocked 记录。
      try {
        const candidateDir = path.join(output, 'agent-renders', `candidate-${renderCount + 1}`);
        await fs.mkdir(candidateDir, { recursive: true });
        const applied = applyTemplateDefaults(lastPlan, []);
        const built = resolveGrayLayout(lastPlan, { pages: applied.layouts }, area, {
          measureBody: grayBodyLayout, fitText: fitGrayText,
          fontSizes: () => [22, 20, 18, 16, 15, 14, 13, 12],
        });
        const report = validateGrayPlan(base, built.plan, area);
        if (report.accepted) {
          await fs.writeFile(path.join(candidateDir, 'plan.json'), json({ ...built.plan, planningNotes: lastPlan.planningNotes ?? null }), 'utf8');
          const renderState = { ...report.state, grayDraft: { ...agentState.grayDraft, status: 'rendering' } };
          await renderGrayDraft(renderState, candidateDir);
          for (const name of ['gray-draft.pptx', 'editable-check.json', 'preview-index.json', 'plan.json']) {
            await fs.copyFile(path.join(candidateDir, name), path.join(output, name));
          }
          await fs.cp(path.join(candidateDir, 'preview'), path.join(output, 'preview'), { recursive: true });
          agentState.pages = renderState.pages;
          agentState.artifactState = Object.fromEntries(renderState.pages.map(page => [page.pageId, {
            status: 'rendered-awaiting-review', revision: page.revision,
            pptxPath: path.join(path.relative(output, candidateDir), 'gray-draft.pptx'),
          }]));
          agentState.grayDraft.plan = built.plan;
          agentState.grayDraft.programCheck = { ...report, state: undefined };
          const coverage = checkReviewCoverage(lastReview, lastPlan);
          agentState.grayDraft.reviewNotes = { status: coverage.status, at: lastReview?.at ?? null, issues: lastReview?.issues ?? null, fingerprint: coverage.fingerprint };
          agentState.grayDraft.reviewCoverage = { status: coverage.status, deliveredFingerprint: coverage.fingerprint, reviewedFingerprint: coverage.reviewedFingerprint, checkedAt: new Date().toISOString(), candidate: true };
          agentState.grayDraft.candidateDelivery = true;
          // 任务 #175：候选如实标明未应用修订（坏提交发生在候选计划之后时）。
          if ((agentState.grayDraft.submissionFailures ?? 0) > 0) {
            agentState.grayDraft.candidateNote = `候选基于上一有效版本；本轮另有 ${agentState.grayDraft.submissionFailures} 次提交失败（修订未应用，候选不代表这些修订）。`;
          }
          agentState.grayDraft.status = 'awaiting-user-review';
          candidateRendered = true;
        }
      } catch (error) {
        agentState.grayDraft.candidateFailure = String(error?.message ?? error);
      }
    }
    if (!candidateRendered) {
      agentState.grayDraft.status = 'blocked';
      agentState.runtimeFailure = { message: result.note ?? `Agent 循环停止：${result.stopReason}` };
    }
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
