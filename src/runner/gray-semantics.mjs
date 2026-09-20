import { upsertPageBriefs, validateContent } from './state.mjs';
import { checkItemFidelity } from '../content/source-fidelity.mjs';
import { bindExpressionGroups } from '../composition/content-stages.mjs';
import { createHash } from 'node:crypto';

const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const TYPES = new Set(['support', 'criterion', 'implementation', 'sequence', 'parallel', 'condition', 'qualification', 'comparison', 'decomposition', 'context']);
const KINDS = new Set(['text', 'diagram', 'flow', 'chart', 'table', 'image']);
const BLOCK_KINDS = new Set([...KINDS, 'note']);

/**
 * label 序号检测（确定性，评审 #41-A）：序号由程序按条目顺序统一添加，label 只写内容词；
 * 覆盖「一、」「1.」「（一）」「第一条」「原因一/不足一」等最小合规形态。
 * 「统一/唯一」等常用词与「安全第一」类惯用语不误伤；不依赖任何稿件词表。
 */
const ORDINAL_SUFFIX_ALLOW = new Set(['统一', '唯一', '单一', '万一', '合一', '归一', '不一', '划一', '不二', '无双']);
export function labelHasOrdinal(value) {
  const text = String(value ?? '').trim();
  if (!text) return false;
  const head = text.split(/[：:、，,．.。；;（）()\s]/u).filter(Boolean)[0] ?? '';
  if (head && /^[一二三四五六七八九十\d]+$/u.test(head)) return true;
  if (/^[一二三四五六七八九十\d]+[、.．：:]/u.test(text)) return true;
  if (/^第[一二三四五六七八九十\d]+[个条项页步点类种部分]?$/u.test(head)) return true;
  if (/[（(][一二三四五六七八九十\d]+[）)]/u.test(text)) return true;
  if (head.length === 0 || head.length > 3 || ORDINAL_SUFFIX_ALLOW.has(head)) return false;
  return /[一二三四五六七八九十]$/u.test(head);
}

/** 本轮灰稿会绘制简化草图的媒介；chart 与 image 仍只有蓝区说明。 */
export const SKETCH_KINDS = Object.freeze(new Set(['diagram', 'flow', 'table']));
export const SKETCH_LABELS = Object.freeze({ diagram: '并置结构（对象卡片）', flow: '顺序结构（节点与箭头）', table: '行式表格' });

/**
 * 流转信息标记（来源层数据打标）：公文头尾段（文件标题、称谓、发文字号、落款）与节标题不上屏，
 * 却又被覆盖检查强制引用——这是结构性死结，模型只有"违禁上屏"或"引用掺假"两条错路。
 * 修法：切段后由程序打标，灰稿侧覆盖结果豁免、上屏机械禁止；正式线（validateContent 不带豁免）不受影响。
 * 只认窄模式，宁可漏标不误标；标记结果随来源表给模型（无需引用、不得上屏）。
 */
const FLOW_PATTERNS = Object.freeze({
  serial: /^[^，。；：!？\s]{0,20}〔\d{4}〕第?\d+号$/u,
  section: /^第[一二三四五六七八九十百千零0-9]{1,4}(?:部分|章|节)(?:[：:、，,．.\s]\S{0,40})?$/u,
  title: /^(?:关于.{2,60}的(?:通知|公告|通报|通告|报告|请示|批复|意见|函|决定|命令|纪要|方案|办法|规定|细则|规则|标准)|《[^》]{2,60}》)$/u,
  salutation: /^(?:尊敬的|亲爱的|各位|全体|同志们|朋友们|各)([^：:]{0,18})[：:]$/u,
  dateOnly: /^(?:\d{4}年\d{1,2}月\d{1,2}日|\d{4}-\d{1,2}-\d{1,2}|二[〇零一二三四五六七八九]{3}年[一二三四五六七八九十]{1,3}月[一二三四五六七八九十]{1,3}日)$/u,
  unitLine: /^[\u4e00-\u9fa5A-Za-z0-9（）()·]{2,20}$/u,
});
const SALUTATION_STOP = /(职责|任务|要求|安排|如下|事项|内容|分工|名单|标准|办法|规定|说明|流程|步骤|要点)/u;

/** 给来源段打流转信息标记（标题/称谓/发文字号/落款/节标题）。不改原文，只加 flow 字段；已是流转载段或带标题的段不动。 */
export function markFlowSources(sources) {
  return sources.map((source, index) => {
    if (source.flow || source.heading) return source;
    const lines = String(source.text ?? '').split('\n').map(line => line.trim()).filter(Boolean);
    if (!lines.length) return source;
    const single = lines.length === 1 ? lines[0] : null;
    if (single && FLOW_PATTERNS.serial.test(single)) return { ...source, flow: '发文字号' };
    if (single && FLOW_PATTERNS.title.test(single)) return { ...source, flow: '文种标题' };
    if (single && FLOW_PATTERNS.section.test(single)) return { ...source, flow: '节标题' };
    if (single) {
      const match = single.match(FLOW_PATTERNS.salutation);
      if (match && !SALUTATION_STOP.test(match[1])) return { ...source, flow: '称谓' };
    }
    const inTail = index >= sources.length - 3;
    const unitLines = lines.filter(line => !FLOW_PATTERNS.dateOnly.test(line) && FLOW_PATTERNS.unitLine.test(line));
    if (inTail && lines.length <= 3 && lines.some(line => FLOW_PATTERNS.dateOnly.test(line)) && unitLines.length && lines.every(line => FLOW_PATTERNS.dateOnly.test(line) || FLOW_PATTERNS.unitLine.test(line))) {
      return { ...source, flow: '落款' };
    }
    return source;
  });
}

/**
 * 覆盖检查的灰稿侧封装：validateContent 的缺源问题里剔除流转信息来源（文件头尾等无需覆盖）。
 * 只服务灰稿线；正式线（tools/generation.mjs）继续直调 validateContent，逐字覆盖保证不被动摇。
 */
/**
 * 提取显式类别线索用于非阻塞提示。字面匹配不能证明或否定语义归属，
 * 不作为分页、字号、媒介选择或接受规划的硬条件；未匹配到也不表示原稿没有类别。
 */
const CATEGORY_CUE = /(?:首先|其次|再次|最后)是[，,]?([一二两三四五六七八九十]+)(?:点|项|条)([\u4e00-\u9fa5]{1,6})[。；]/gu;

/**
 * 结构旁白禁则（元信息上屏，客观违规）：模型自造的组织说明（"本部分先讲两点不足，再讲四点感悟"）
 * 与原稿节标题同属不上屏的元信息。窄模式：以"本部分/本节/本篇/本页"起句且带讲述动词；
 * 不误伤正文里的"本部分工作由……"（无讲述动词不匹配）。实证样本：Boss 攻坚 run 6 g7。
 */
const STRUCTURAL_NARRATION = /^本(?:部分|章节|章|节|篇|页)(?:先|将|会|拟|主要|重点)?(?:讲|说|介绍|说明|阐述|分(?:述|为|成)|包括|包含|围绕)/u;

export function categoryCues(sources) {
  const cues = new Map();
  for (const source of sources ?? []) {
    for (const match of String(source.text ?? '').matchAll(CATEGORY_CUE)) {
      const noun = match[2];
      if (noun && !cues.has(noun)) cues.set(noun, { count: match[1], noun, phrase: match[0].replace(/[。；]$/u, '') });
    }
  }
  return [...cues.values()];
}

const CHINESE_DIGITS = Object.freeze({ 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 });

export function chineseCount(text) {
  const value = String(text ?? '');
  if (/^\d+$/u.test(value)) return Number(value);
  if (value === '十') return 10;
  const match = value.match(/^([一二两三四五六七八九])?十([一二三四五六七八九])?$/u);
  if (match) return (match[1] ? CHINESE_DIGITS[match[1]] : 1) * 10 + (match[2] ? CHINESE_DIGITS[match[2]] : 0);
  return [...value].reduce((sum, char) => sum + (CHINESE_DIGITS[char] ?? 0), 0);
}

/**
 * 渲染尝试指纹（方案 A 项 1，评审 #21 批准）：文案＋版式形状归一化后的 SHA-1。
 * 用于「同版重试」检测——容量失败后若指纹未变，本轮重试没有意义（确定性结果）。
 * 任何文案或版式变化都会改变指纹；不参与规划内容，只服务成本守卫。
 */
export function attemptFingerprint(plan, layouts) {
  const parts = [];
  for (const page of plan?.pages ?? []) {
    parts.push(page.pageId ?? '', page.title ?? '', page.claim ?? '');
    for (const group of page.groups ?? []) {
      parts.push(group.id ?? '', group.heading ?? '', group.importance ?? '', group.kind ?? '');
      for (const block of group.blocks ?? []) parts.push(block.id ?? '', block.label ?? '', block.text ?? '');
    }
  }
  parts.push(JSON.stringify(layouts ?? null));
  return createHash('sha1').update(parts.join('\u0001'), 'utf8').digest('hex');
}

/** 同版重试判定：该指纹的版本此前已因容量失败过——直接拒绝，反馈要求「比上一版更短」。 */
export function isStalledRetry(previousAttempts, fingerprint) {
  return (previousAttempts ?? []).some(attempt => attempt?.accepted === false && attempt?.stage === 'geometry' && attempt?.fingerprint === fingerprint);
}

/**
 * 计划内容指纹（评审 #119 版本绑定）：只覆盖影响可见文案与审稿判断的字段——页标题/主题句、
 * 组标题/主次/媒介与蓝区三项、块标签/正文/媒介/作用范围。backstage（pagePurpose/narrative/planningNotes）
 * 与来源 id 不参与：它们不改变可见内容，补齐/改绑来源不应作废已通过的审稿。
 */
export function planContentFingerprint(plan) {
  const parts = [];
  for (const page of plan?.pages ?? []) {
    parts.push(page.pageId ?? '', page.title ?? '', page.claim ?? '');
    for (const group of page.groups ?? []) {
      parts.push(group.id ?? '', group.heading ?? '', group.importance ?? '', group.kind ?? '',
        group.expression ?? '', group.relationship ?? '', group.production ?? '');
      for (const block of group.blocks ?? []) parts.push(block.id ?? '', block.label ?? '', block.text ?? '', block.kind ?? '', block.scope ?? '');
    }
  }
  return createHash('sha1').update(parts.join('\u0001'), 'utf8').digest('hex');
}

/**
 * 审稿覆盖判定（评审 #119 要求 1）：只有「最近一次审稿通过、且所审内容与当前计划内容一致」才算覆盖。
 * 内容改动后上一版通过即失效（stale）；从未审稿 not-reviewed；最近一次未通过 open-issues。
 * 通过状态不跨内容改动继承——交付版本必须由有效审稿覆盖，或如实标记未复核。
 */
export function checkReviewCoverage(lastReview, plan) {
  const fingerprint = planContentFingerprint(plan);
  if (!lastReview || !lastReview.fingerprint) return { covered: false, status: 'not-reviewed', fingerprint, reviewedFingerprint: null };
  if (!lastReview.accepted) return { covered: false, status: 'open-issues', fingerprint, reviewedFingerprint: lastReview.fingerprint };
  if (lastReview.fingerprint !== fingerprint) return { covered: false, status: 'stale', fingerprint, reviewedFingerprint: lastReview.fingerprint };
  return { covered: true, status: 'covered', fingerprint, reviewedFingerprint: fingerprint };
}

/** 计划文本量（评审 #26「同最小高重试」）：影响渲染高度的可见字段总量，用于判断重试是否真的在缩短。 */
export function planTextVolume(plan) {
  return (plan?.pages ?? []).reduce((total, page) => total + (page.groups ?? []).reduce((sum, group) => sum
    + String(group.heading ?? '').length
    + (group.blocks ?? []).reduce((blocks, block) => blocks
      + String(block.label ?? '').length + String(block.text ?? '').length
      + String(block.expression ?? '').length + String(block.relationship ?? '').length + String(block.production ?? '').length, 0), 0), 0);
}

/**
 * 同最小高重试判定（评审 #26 批准）：容量失败后，本次实测最小高不低于上一版（差异 <1px 视同未降）
 * 且文本量未缩短——属于停滞重试，按「必须真正压缩」拒绝。
 */
export function isSameMinimumRetry({ previousMinimum, currentMinimum, previousTextLength, currentTextLength }) {
  if (!Number.isFinite(previousMinimum) || !Number.isFinite(currentMinimum) || currentMinimum <= 0) return false;
  if (!Number.isFinite(previousTextLength) || !Number.isFinite(currentTextLength)) return false;
  return currentMinimum >= previousMinimum - 1 && currentTextLength >= previousTextLength;
}

export function grayCoverageIssues(state) {
  const flowIds = new Set((state.sources ?? []).filter(source => source.flow).map(source => source.id));
  const issues = [];
  for (const issue of validateContent(state).issues) {
    if (issue.code === 'missing-source-coverage') {
      const missing = (issue.sourceIds ?? []).filter(id => !flowIds.has(id));
      if (!missing.length) continue;
      issues.push({ ...issue, sourceIds: missing, message: `来源未被承载（正文条目未引用、所在页 sourceIds 也未认领）：${missing.join('、')}` });
      continue;
    }
    issues.push(issue);
  }
  return issues;
}

/** 共享规则片段：SEMANTIC_CONTRACT 与 GRAY_AGENT_PROMPT 的唯一来源；同步由 tests/prompt-sync.test.mjs 守卫。 */
export const SHARED_RULES = Object.freeze({
  category: `先恢复内容归属：类别成为组，类别内条目成为块，label 写要点、text 写必要展开；类别数量、条目数量和原稿措辞都不决定页数或版式。类别名可以忠实概括，不以重复原词证明归属正确。原稿以类别总起统辖多条目时，组结构体现"类别→条目"两级：组标题概括类别与条目的共同性质，条目在组内编号展开；类别与条目的层级关系要有可见载体，不只留在主题句前缀、条目标签前缀或后台说明里。分支内的条目与细项保持层级，表达可用短句、分项或图示，选择依据是读者能否直接读出必要关系。同一主题的相关类别可同页呈现；内容目的不同或容量不足时可分页，跨页保留归属和准确的本页标题，不把类别总数冒充本页条目数。允许提炼冗词、合并重复解释，保留重要事实、对象、条件、否定和关系，不要求固定压缩次数，不为复现样稿强制同页。`,
  hierarchy: `多因素、多子项、多环节的内容，先让成员可辨认、归属不丢失：可以拆成带内容词标签的条目，也可以保留连续文字——选择依据是读者能否直接读出成员与结果、总述与分项的关系，以及版面是否更清楚。拆开时不得删去连接总述与分项的归属、成因语（"反映出""表现为"是内容关系本身，删掉即归因不可读），下级内容要以归属可读的标签或就近从属呈现；同一信息不要正文条目与结构位重复承载，择一种主要承载，信息留在灰稿本体。共同导出的结果或目标如何收束（编号条目、注文、独立区域）不作为对错标准——判据是会不会被误读成并列原因，会被误读就要改。拆层依据是内容里真实的并列与导出关系，不是特定词句或数量；单纯罗列同类名词不构成拆层理由。顺序框架词（"起点/收尾/随后"）可用；非原稿的修饰词删除后关系读法仍清楚就不保留。`,
  expression: `按真实关系选择表达，所选表达必须让读者直接理解对象、归属和联系。并列分类不自动构成对照；对照、因果、依赖必须有原稿依据，flow 只用于原文有先后线索的真实时序。行式表格只用于多个对象按共同维度对照；单对象说明可用文字条目。原稿在一个条目内明示"多项并列成员共同导向一个结果"（聚合）或"一个总述分出多项并列方面"（扇出）时，让关系可直接读出：拆条、连续文字、条目内结构位都是可选手段，选择依据是读者能否直读成员与结果、总述与分项的关系；不为恢复某种参考形态强制拆条或强制配结构位。若用条目内结构位：散文按需保留（不必全文复述），结构位 kind 写在该 block（不用整组图示替代散文、不把整段散文吞进图卡），节点用成员与结果的实文短语（不整句入卡），relationship 与 production 写明节点和方向。聚合与扇出按内容关系判定；共同约束（任一成员单独缺失即不成立的并列要求）不是聚合，按范围呈现、不画汇聚图；单纯并列不加结构位，不凭某个连接词、数量或左右双栏形态画图。`,
  sketch: `灰稿规划文字与图形的位置和面积。整组 diagram/flow/table 使用已有简化草图；文字条目内的非文字块预留蓝框图形区，框内标注表达作用与节点短语，不绘制内部节点。局部结构位就近附着所属条目，保留完整必要内容，节点短语按条目实文与来源忠实提炼（允许压缩，不得引入来源没有的对象或改变顺序），不再抄一份全文；整组图示可以直接承载内容，不强制另配重复散文。`,
  source: `每个block必须引用来源；所有正文来源必须被承载：由正文条目引用，或在页面级 sourceIds 中认领（认领表示本页负责承载这段来源，不代表它必须上屏）。标为流转信息（文件头尾、节标题等）的来源无需引用、无需认领。未打标的来源若判断为文件标题、称谓一类结构性内容，不必为它单列条目：可由页面认领；确有展示价值时可让它自然出现在相称位置，没有展示价值时安静认领即可。覆盖不等于逐段复制，来源内容在页标题或主题句中自然体现同样算承载。`,
  fidelity: `提炼不改变事实、关系、程度、条件、时态与确定性：原稿的限定与范围表述（程度、条件、时态、确定性等任何限定）在概括中不得升格、弱化或删除，主题句、页面标题与条目标签对照原稿逐处核对；claim 的主题句概括以"不改变限定"为界。`,
  declaration: `模拟/假设声明只要原稿给出，就必须上屏且恰好一次：最自然的位置是页面主题句，或紧邻主体的一个条目；不得省略、不得逐条重复、不得独立成组。`,
  condition: `真实条件与否定不能省略，准则不是已满足的证据，并行准备不是下一阶段。`,
  attachment: `条件触发的处置、异常或例外是附着性内容：注明它约束哪些对象或环节，从属并紧邻所依附的内容（作为依附对象的补充说明，或从属职责的supporting组），不与主流程环节、并列要点铺成同层组；判断依据是依附关系，不是篇幅大小。共同限定、否定与前提若不构成主体条目本身，用块级附注承载：该块 kind 写 "note"，紧随所依附的条目之后，不编号、不占条目位，也不需要制作说明三项。约束本组全部条目的共同前提/共同说明用块级 scope 写 "group"：程序不编号、以 12px 小字随组渲染，作用范围是整组而不是某一条；作用范围（一条、多条还是整组）由块级语义决定，判断依据是它约束谁，不是句子写法或篇幅。共同约束的呈现以范围为判据：范围要一眼可读、不被误读成只管某一条——可用 scope:"group"，也可让注文自己写明范围（"以上三项"式），形态不限；做成独立区域或同级条目而范围仍清楚也可，被读成并列项或只管单条就要改。内容要点不是共同说明，不要标 scope:"group"。`,
  paging: `页数服从内容量、页面目的和真实关系，先确定每页讲什么，再结合实际容量决定合并、分区或分页。每页应有实质展开，短小附注就近融入主体。容量失败后可调整组合与比例、忠实精简冗词或沿语义边界分页；不能牺牲必要条件、拆散归属或持续缩字来满足固定页数。跨页仍标明条目所属类别；标题给出判断，正文补充细节，不整句复述标题。`,
  label: `label可省略，只有帮助读者定位职责时才用，并且必须是内容词（"正常""已修复""待配件"），不用"拆分项一""对象""状态一"这类结构占位名，也不带"（全页适用）"这类版面说明；标签与正文近复述（正文只比标签多一两个字）时省标签或合并，不要「一 要点／要点加一两字」式重复；序号由程序按条目顺序统一添加，label 不写序号（"一、""原因一""不足一"式前后缀都不行）；表格行只有行头与内容两段，不要把多列文字用竖线拼进一个块。`,
  surface: `页面目的、narrative和planningNotes不在灰稿上显示。`,
  meta: `公文头尾、节标题不是正文实质内容：识别为标题不必然单独成区，也不一律禁止上屏——确有展示价值时（如文档标题、署名）可以在相称位置自然出现，没有展示价值时不出现；不得为凑覆盖把它们改写成"通知依据""背景"之类条目或单列成区（"适用范围"式空壳区域不合格，由评审按信息价值判断）。"本部分先讲…"这类结构旁白不得上屏。`,
});

export const SEMANTIC_CONTRACT = `你的任务是将原稿提炼、重组为适合PPT阅读的信息结构，本轮只生成灰稿内容，只输出JSON。原稿是事实依据，不是必须逐字搬入页面的正文。保留重要事实、对象、条件、否定和关系；允许合并重复信息、删去冗词与重复解释、把长句改写为短语和清楚的分项。${SHARED_RULES.fidelity}不能为了容量删除必要条件。${SHARED_RULES.meta}
本次契约优先于共享规则中可选解析器的字段。不要生成composition-intent、逐句关系图或坐标，不按原稿标题数量分区。
格式：{schemaVersion:"gray-plan-3",deckBrief:{title,audience,objective},pages:[{pageId:"p1",title:"短标题",claim:"简短上屏主题句，建议二十字左右，不复述全部正文",pagePurpose:"本页解决的问题",narrative:"一句话说明必要的先后、并行、判断或归属关系，无需列每条边",sourceIds:["s1"]（可选：页级认领，用于本页承载但不单列条目的结构性来源）,groups:[{id:"g1",role:"本组主要职责",heading:"上屏短标题",importance:"primary|supporting",kind:"text|diagram|flow|chart|table|image",blocks:[{id:"b1",label:"可选上屏子标题（内容词，不写序号），不需要可省略",text:"真实上屏文字",sourceIds:["s1"],scope:"group"（可选：约束整组全部条目的共同说明，程序不编号）}],expression:"非text必填：表达作用",relationship:"非text必填：基本关系",production:"非text必填：制作要求"}]}],planningNotes:"简短后台组织说明"}。
先明确页面职责，按内容归属形成groups，再把各分支的条目放进blocks，用label与text区分要点和展开。${SHARED_RULES.category}${SHARED_RULES.hierarchy}先形成可阅读的实文提纲，再选择局部表达；不要把分属不同观点的依据摊成同级卡片，也不要把分类、依据、准则混称为证明。这些层级按实际内容使用，不强求每页都有两个分支或固定条目数。文字组内某条需要图示时，该block可选kind及expression、relationship、production，字段含义与整组蓝区相同；其label仍是上屏条目标题。附着说明块 kind 写 "note"：紧随它所依附的条目之后，不编号、不占条目位，也不需要制作说明三项。未选kind的block为普通文字，整组非text时不再嵌套蓝区。${SHARED_RULES.expression}${SHARED_RULES.sketch}结构库按局部关系按需调用，本轮仅呈现蓝区制作说明。
每组一个主要职责。claim概括主题或判断，正文展开对象、安排与条件，不把同一句建议分别复制到主题、组标题和正文。blocks按阅读顺序；${SHARED_RULES.label}三列对照改写成一条可读文字或拆成两个块。heading保持短小。蓝区expression写表达作用，relationship写谁与谁怎样关联，production写可执行的组织要求；三者分工，避免重复复述承载内容。必要关系须在实文组织或蓝区制作说明中可见，仅保留关键词或写在narrative里不等于表达完成。
${SHARED_RULES.source}引用表示信息来自哪里，不要求每段原文单独变成一个正文块；页级 sourceIds 是认领通道：判断为结构性、不单列条目的来源写进所在页的 sourceIds，它不上屏、不占版面。${SHARED_RULES.declaration}小段共同说明就近融入主体，不因职责不同便独占大栏。${SHARED_RULES.condition}${SHARED_RULES.attachment}
内容区尺寸由输入给定，主题句在内容区外，以28px单行呈现，需简短。排版可用单主体、横向、纵向和网格。正文按统一的可读字号候选测量，优先大字号、12px为下限；这一测量策略适用于所有页面，不由稿件措辞或类别数量触发。块级蓝注独立12px。组标题26px一行，组内label与text各自排字，块间距12px，每块四周8px内边距；每组70px标题/边距开销。不自己写坐标或强制页数。${SHARED_RULES.paging}同组label+text合计不超过400字。保留原稿数字写法。
${SHARED_RULES.surface}正文必须能独立让读者理解必要关系，不能依赖后台说明。内部审查理由不要改写成正文：用“同时”“是否”“根据记录”等原稿已有表达保留关系，不额外解释“不是先后步骤”“不是已满足的证据”等审稿规则。原稿的模拟/假设性质属于读者需要的内容，须在实际标题或正文中明示，引用sourceIds不能代替显示。`;

export const SEMANTIC_REVIEW_CONTRACT = `你是灰稿内容与表达审稿人。输入source是原稿，requirements是后台职责与必要关系，visiblePages是程序从实际渲染内容生成的上屏视图，flowSources（如有）是程序标出的流转信息（文件头尾、节标题）。审稿只看交付版本的实际可见文案：visiblePages 已含渲染器的自动编号等变换，规划意图、修改要求、块字段标注都不是已实现的事实；requirements不能作为上屏证据。尚未分配坐标或查看像素图。
逐页核对事实、条件、否定和模拟性质是否完整，程度、时态与确定性等限定是否保留，页面职责与归属是否成立，必要关系是否能从可见文案或图形规划直接理解。主题句与页面标题逐字对照原稿：升格、弱化或删除限定（程度/条件/时态/确定性）必须指出——主题句是读者最先读的行，失真权重最高。类别数量、某个连接词或页数不是表达正确的证据。仅有标题改名、主辅标签或并排放置不证明关系成立。对照、因果、依赖必须有原稿明示依据；拆层或改写后归属、成因词被删，或扇出关系在可见内容里没有承载，都要指出；只有并列关系时不得要求一一配对卡片或对应表。flow 只用于原文有先后线索的真实时序；并列汇聚/扇出用 diagram 的制作说明规划节点与方向，不能强造时序。整组diagram/flow/table会画已有简化草图；文字组内的非文字块是蓝框图形占位，检查它是否交代了放什么图、承载哪些内容及必要关系，不要求已经画出内部节点和箭头。局部节点短语须与所属条目实文或来源顺序对应（允许压缩提炼，不得引入来源没有的对象或改变顺序）；不得跨条目摘引——该口径仅适用于文字条目内的蓝框占位，不适用于整组草图。整组结构草图的节点文字按来源保真核对（实际文案，允许忠实提炼）。图示明显有助于理解却没有规划相应位置时，指出具体理解困难；清楚的文字关系可以通过，不仅凭缺少某种媒介打回。
区域合理性按内容贡献＋逻辑关系＋空间分配综合判断：为凑覆盖把标题/元信息单列成区、或区域装不下相称信息价值（"适用范围"式空壳），要不合格——按价值判断，与格式无关；即使角色识别没有触发，也要主动指出无相称信息价值的区域。识别为标题不必然单独成区，也不一律禁止上屏：标题在相称位置自然出现（页标题、署名）不算缺陷，按展示价值判断。页级认领的来源（carriedSources）必须与该页实际承载相称：认领了却有信息价值的内容在该页不体现，或把有信息价值的名称/标题/适用条件压掉，都要指出。流转信息（flowSources：文件头尾、节标题）无需上屏，也不要求为归属补组级标识——归属由组标题与页面标题承担，未出现流转信息不构成缺陷。
准则是选择尺度，不能充当已验证的证据；并行不能写成先后；条件须对应被约束的行动。附着性内容（条件触发的处置、异常、例外）不能与主体步骤或并列要点铺成同层区域；kind:note 附注由程序以 12px 小字紧随所属条目、不编号渲染，程序保证的只是呈现形态；限定约束的对象与作用范围（一条、多条还是整页）是否正确，仍须对照内容核对，呈现不得让读者误解约束范围。附注的依附对象与位置也要按内容核对：注文约束的对象与它紧随的条目不相称（例如整组共同要求只附在首条或末条）时，要指出并让它落到相称位置或写明范围。计划表示与呈现方式是否再调整，由具体缺口决定，不预先统一实现。可见条目的序号（一/二…）由程序按条目顺序添加：用它核对编号与层级是否一致。组内条目层级是规划职责：原稿的总起句、并列因素、推进方式、目标、做法等可以成为带标签条目，也可以保留连续文字，只要关系可直读就不算缺陷；不得以"依附性标签不得与主体同级"为由打回这类组内分解。真正不得与主体环节铺成同层组的是条件触发的处置、异常、例外（组间层级）；多因素共同导出的结果收束条编号与否不是缺陷判据，但被读者读成同级并列原因时要指出。组级共同说明（scope=group）由程序不编号、以 12px 小字随组渲染，作用范围是整组——共同约束的呈现按效果核：范围一眼可读、不被误读成只管某一条或并列项，范围不可读或会被误读就要改（形态不限）；把内容要点误标为组级共同说明要指出。序号不是模型标签，不要因为没有原稿序号或签号写法不同而拒绝。复核修改时，除确认上一问题是否解决，还要检查修改是否引入新的事实、层级或归属错误；"不追加个人媒介偏好"不等于"上一条问题消失就通过"。主体职责的内容必须作为实际文案或结构草图文字出现，只在蓝区制作说明中复述不算落实。条目标签必须是内容词，出现"拆分项一""对象""状态一"这类结构占位名要指出；表格行里用竖线拼接多列文字也要指出；标为流转信息的来源被当作正文条目搬运（单列成区凑覆盖），或正文整句复述标题，都要指出；标题在相称位置自然出现不算缺陷。不要添加原稿未给出的因果、依赖、效果或事实；顺序框架词（"起点/收尾/随后/完成后进入"等由"依次推进"类枚举蕴含）不属于添加，不因它拒绝；非原稿的修饰词若删除后关系读法仍清楚，则不保留。引用当前可见文案指出具体缺陷；不能仅因个人偏好、估计容量或未知坐标拒绝。打回时描述"哪条关系或职责不能直读"的可读性要求；载体/媒介选择是规划层职责——你可以提出载体取向作为建议，但它不具约束力、不会被程序执行或删除；规划层可不采纳，且不采纳不构成拒绝理由，不得因载体建议未被采纳而拒绝已可直读的呈现。同一关系只要能通过任一可用手段（文字分项、卡片、表格、流程）直读即通过。若有reviewFeedback，只复核所提问题是否实质解决，解决即通过，不追加新的媒介偏好。主题概括后正文展开是合法分工，长句机械复述和以后台解释代替组织则须修订。
声明必须恰好出现一次且不独立成组：遗漏、重复、或把模拟/假设声明单独做成一个区域都要指出。后台审查解释不得进入灰区正文；蓝区制作要求可以说明关系组织与绘制要求。若有reviewFeedback，检查是否实质解决。
只输出JSON：{accepted:boolean,issues:[{pageId,sourceIds,problem,requiredRevision}],coverage:"逐页引用visiblePages中的具体措辞或组织，说明它怎样承担职责和关系；不能仅复述requirements",limits:"未看灰稿像素图，不能确认视觉可读性"}。`;

/**
 * 审稿响应记录（评审 #102 REVISE：只记不改）。审稿原文完整送达规划层并完整入档；
 * 缺陷判断写在 problem，载体/媒介取向为建议、不具约束力，不由程序执行或删除。
 */
export function snapshotSemanticReview(review) {
  if (!review || typeof review !== 'object') return { accepted: false, issues: [], coverage: null, limits: null };
  return {
    accepted: Boolean(review.accepted),
    issues: Array.isArray(review.issues) ? review.issues : [],
    coverage: review.coverage ?? null,
    limits: review.limits ?? null,
  };
}

export const LAYOUT_CONTRACT = `你是页面基础排版选择者。内容已检查，不再判断因果或重写内容，只选择空间组合。
只输出JSON：{pages:[{pageId,layout:…}]}。每页必须出现，页序不变。
layout 有两种形态：
- 简式：{type:"single|row|column|grid",weights?:[…],columns?:2}——子节点默认按阅读顺序取本页全部组；row 横向分栏（weights 分配多余宽度），column 上下安排（按实文所需高度分配），grid 用于同等角色的规则网格（columns 是列数）。weights 只在 row 可用，columns 只在 grid 可用。
- 嵌套式：{type:"row|column|grid",weights?,columns?,children:[…]}——children 每项是 {groupId:"g1"} 或再次嵌套的组合。表达分层关系时用它，例如：主区在上、一条注记横贯下方 = {type:"column",children:[{type:"row",children:[{groupId:"g1"},{groupId:"g2"}]},{groupId:"g3"}]}。
嵌套约束：children 必须按阅读顺序恰好覆盖本页全部组一次（不允许换位）；最多三层；weights/columns 只作用于本节点的直接子节点。没有坐标、字号、正文或新分组；程序按真实文字容量求区域。
少量内容无需拉满整页；主次通过适当的空间份额与原有标题层级体现；不强制结构图，不为了变化使用嵌套。若确实需要改写或拆页，返回{needsReplan:true,reason:"具体问题"}。`;

/** 视觉质检契约：渲染完成后由视觉模型看逐页截图，只报明显缺陷，不评价审美。 */
export const VISION_REVIEW_CONTRACT = `你是灰稿视觉审稿人。输入是程序渲染出的灰稿页面截图（灰色为实际内容区、浅蓝为制作说明区、白色带框为结构草图）。只依据图片判断，报告明显缺陷：
- 文字被裁切、溢出框外或紧贴边框；
- 文字互相重叠、压住框线或图形；
- 内容区大面积异常空白（超过半页没有内容）或明显过挤到无法阅读；
- 结构草图的卡片、节点、表格明显错位、未对齐、破形或超出区域。
灰稿是草图：不评价美观、配色、字体与创意，不提装饰建议，不要求配图；没有明显缺陷就通过。
输出JSON：{accepted:boolean,issues:[{page:页码,problem:"图上的直接现象",requiredRevision:"要改成什么样"}],coverage:"逐页一句话说明检查了什么"}。`;

export const EXPRESSION_CONTRACT = `你负责把已有内容职责与必要关系落实为灰稿表达。读取source与plan中的role、importance、narrative和实文，选择哪些内容共同进入一个表达。尚未排版，不写坐标。
只输出JSON：{pages:[{pageId,expressions:[{groupIds:["g1","g2"],heading:"简短区域标题",kind:"text|diagram|flow|chart|table|image",blocks:[{id:"b1",label:"可选分项标题",text:"提炼重组后的实际文案",sourceIds:["s1"]}],expression:"非text必填：表达作用",relationship:"非text必填：基本关系",production:"非text必填：制作要求"}]}]}。文字组中的block也可选kind及expression、relationship、production来承载局部图示，字段含义与整组相同，未选kind仍为文字。整组选择非text时，不再给其block选择局部媒介。
每页原有内容组必须恰好被引用一次；不可跨页，不改变role或claim，不增加原稿事实。按表达需要提炼并重组blocks，允许合并复述、长句变短语、共同说明就近附着；保留对象、条件、否定、时间与关系，sourceIds只可引用所绑定组的来源。独立文字保持一个组，也可让关联内容共用同一表达。原有kind是初选，必须重新检查它是否真正承担内容职责；内容在这一阶段可以修订，进入几何阶段后才冻结。
先检查组标题、条目要点、必要说明是否各有职责且归属清楚，再决定哪一部分用结构表达。同口径对象对应，条件附着于动作，整体与部分体现归属，先后与并行区别，尺度说明用于什么选择。普通文字组织清楚就保留；某条目需要结构时只选择该block的媒介，不连带吞并其所属分支的其他条目。结构表达按内容关系选择：对比用diagram（对象各一个block）、时序用flow（节点按顺序）、对照网格用table；本轮会绘制简化草图，框内文字可读，不要为稳妥一律文字，也不要为结构而结构；附着性内容（条件触发的处置、异常、例外）跟随它所依附的内容，不单独升级成并列组。确需共同图示时可合用蓝区，说明内部关系。不要把每个角色独立变成框，也不要一律合并；不能增加原稿没有的共同完成门槛、因果或证明。
蓝区只写制作说明，不绘图或调用结构Skill。expression、relationship、production各司其职，简洁可执行；承载内容由程序填入，不要再在三项说明中复述全文。若现有分页或实文无法成立，返回{needsReplan:true,reason:"具体内容问题"}。`;

/** Bind grounded content, then allow expression-aware copy. Geometry receives only the checked result. */
export function bindGrayExpressions(plan, selection) {
  if (selection?.needsReplan) throw new Error(`表达需要重新规划：${selection.reason}`);
  if (!selection || Object.keys(selection).some(k=>k!=='pages') || !Array.isArray(selection.pages) || selection.pages.length!==plan.pages.length) throw new Error('表达选择须覆盖原页面');
  const result=structuredClone(plan);
  result.pages.forEach((page,index)=>{
    const entry=selection.pages[index];
    if(entry?.pageId!==page.pageId || Object.keys(entry).some(k=>!['pageId','expressions'].includes(k))) throw new Error('表达选择不得改页序或正文');
    const bound=bindExpressionGroups(page.groups,entry.expressions);
    if(page.relations?.length && bound.some(item=>item.groups.length>1)) throw new Error('带旧显式关系端点的页面须回到内容规划，不能在合并时丢失端点');
    page.groups=bound.map(({selection:choice,groups})=>{
      if(Object.keys(choice).some(k=>!['groupIds','heading','kind','blocks','expression','relationship','production'].includes(k))) throw new Error('表达选择只能引用内容、提炼blocks及选择媒介，不能改角色或页级内容');
      if(!nonempty(choice.heading) || !KINDS.has(choice.kind) || (choice.kind!=='text' && ![choice.expression,choice.relationship,choice.production].every(nonempty))) throw new Error('表达缺少标题、媒介或蓝区制作说明');
      const sources=new Set(groups.flatMap(g=>g.blocks.flatMap(b=>b.sourceIds)));
      const blocks=choice.blocks ?? groups.flatMap(g=>g.blocks.map(b=>({...b,id:groups.length>1?`${g.id}/${b.id}`:b.id})));
      if(!Array.isArray(blocks) || !blocks.length || blocks.some(b=>!Array.isArray(b.sourceIds) || !b.sourceIds.length || b.sourceIds.some(id=>!sources.has(id)))) throw new Error('表达文案缺少所绑定内容组的来源，或越界引用');
      return {id:groups[0].id,role:groups.map(g=>g.role).join('；'),importance:groups.some(g=>g.importance==='primary')?'primary':'supporting',
        heading:choice.heading,kind:choice.kind,blocks:structuredClone(blocks),
        ...(choice.kind==='text'?{}:{expression:choice.expression,relationship:choice.relationship,production:choice.production})};
    });
    if(page.readingOrder) page.readingOrder=page.groups.map(g=>g.id);
  });
  return result;
}

export function blockText(block) { return [block.label,block.text].filter(nonempty).join('\n'); }

const STRUCTURE_LEAD = Object.freeze({ diagram: '本条建议画结构图', flow: '本条建议画结构图', table: '本条建议画表格', chart: '本条建议画数据图', image: '本条建议配图' });
const SKETCH_NODE_LABEL = Object.freeze({ diagram: '节点短语（摘引）', flow: '节点短语（摘引）', table: '行要点（摘引）', chart: '要点（摘引）', image: '要点（摘引）' });

export function regionBody(item) {
  if (item.kind === 'text' && item.blocks) return grayDisplayBlocks(item).map(block=>block.text).join('\n');
  if (SKETCH_KINDS.has(item.kind) && item.blocks) return item.blocks.map(blockText).join('\n');
  // 附注最小化（评审 #28/#32）：关系一句＋摘引短语；收尾标点去重（评审 #33，连续同一闭标点折叠）。
  if (item.kind === 'text') return item.text;
  const lead = STRUCTURE_LEAD[item.kind] ?? '制作说明';
  const nodes = SKETCH_NODE_LABEL[item.kind] ?? '要点（摘引）';
  const expression = String(item.expression ?? '').replace(/[。！？；]+$/u, '');
  const text = String(item.text ?? '').replace(/[。！？；]+$/u, '');
  const composed = `${lead}：${expression}；${nodes}：${text}。`;
  return composed.replace(/([。！？；])[。！？；]+/gu, '$1');
}

const ORDINALS = Object.freeze(['一','二','三','四','五','六','七','八','九','十']);
const ordinalLabel = index => ORDINALS[index - 1] ?? String(index);

/** One display projection for review, measurement and native rendering. No backstage prose. */
export function grayDisplayBlocks(item, { ordinal = 0, numbered = true } = {}) {
  if (SKETCH_KINDS.has(item.kind) && item.blocks) {
    // 结构草图：审稿、测量与渲染看到的是同一份逐卡片/节点的实际文案（"是结构"这一事实由 surface 描述）。
    return item.blocks.flatMap((block,index)=>[
      ...(block.label ? [{text:block.label,bold:true,gapBefore:index ? 12 : 0}] : []),
      {text:block.text,bold:false,gapBefore:!block.label && index ? 12 : 0},
    ]);
  }
  if (item.kind !== 'text' || !item.blocks) return [{text:regionBody(item),bold:false,gapBefore:0}];
  // 条目编号标签（评审 #25/#32/#71）：仅带标签的正文条目参与编号（按条目顺序）；附注块不编号、不占号。
  // 序号由程序统一添加：label 自带序号时不再叠加（评审 #41-A，防「二 原因一」）；text 与 note 都直接上屏文案。
  // scope:"group" 的块是组级共同说明（评审 #119 层级机制）：约束整组全部条目，不编号、不占条目位，
  // 以 12px 小字随组呈现——作用范围由块级语义决定，不由句子写法或篇幅决定。
  const isEntry = block => (block.kind ?? 'text') === 'text' && nonempty(block.label) && block.scope !== 'group';
  const isGroupScoped = block => block.scope === 'group';
  const labeledCount = item.blocks.filter(isEntry).length;
  const useNumbers = numbered && (ordinal > 0 || labeledCount >= 2);
  let labeledIndex = 0;
  const parts = [];
  for (const [index, block] of item.blocks.entries()) {
    if (block.label) {
      let label = block.label;
      if (isEntry(block)) {
        labeledIndex += 1;
        if (useNumbers && !labelHasOrdinal(label)) label = `${ordinalLabel(ordinal > 0 ? ordinal : labeledIndex)} ${label}`;
      }
      parts.push({text:label,bold:true,gapBefore:index ? 12 : 0,...(block.kind === 'note' || isGroupScoped(block) ? {attachment:true} : {})});
    }
    const kind = block.kind ?? 'text';
    parts.push({text:kind === 'text' || kind === 'note' ? block.text : regionBody(block),bold:false,gapBefore:!block.label && index ? 12 : 0,
      ...(kind === 'text' ? {} : {kind}),...(kind === 'note' || isGroupScoped(block) ? {attachment:true} : {})});
  }
  return parts;
}

export function semanticReviewInput({source,area,plan,reviewFeedback=null,flowSources=[]}) {
  const pages = semanticPages(plan);
  return {
    source, area:{width:area.width,height:area.height}, reviewFeedback,
    ...(flowSources.length ? { flowSources } : {}),
    requirements:plan.pages.map(page=>({pageId:page.pageId,pagePurpose:page.pagePurpose,narrative:page.narrative,
      carriedSources:page.sourceIds??[],
      groups:page.groups.map(group=>({id:group.id,role:group.role,importance:group.importance}))})),
    visiblePages:pages.map(page=>({pageId:page.pageId,claim:page.claim,regions:page.items.map(item=>({
      id:item.id,kind:item.kind,surface:SKETCH_KINDS.has(item.kind)
        ? `结构草图：${SKETCH_LABELS[item.kind]}，框内文字为实际文案`
        : item.kind==='text'
          ? ['灰区：实际文案',
              item.blocks?.some(block=>block.kind && block.kind!=='text' && block.kind!=='note') ? '非text的kind为块内浅蓝制作说明，四项均上屏' : null,
              item.blocks?.some(block=>block.kind==='note') ? 'attachment=true 的块为附着说明：程序以 12px 小字紧随所属条目渲染、不编号' : null,
              item.blocks?.some(block=>block.scope==='group') ? 'scope=group 的块为组级共同说明：程序不编号，以 12px 小字随组渲染，作用范围是本组全部条目' : null,
            ].filter(Boolean).join('；')
          : '浅蓝区：制作说明，四项均须上屏',heading:item.heading,body:grayDisplayBlocks(item),
    }))})),
  };
}

/** Compile once from structured copy. Layout never supplies or rewrites content. */
export function semanticPages(plan) {
  return plan.pages.map(page => ({
    pageId: page.pageId, title: page.title, claim: page.claim, relation: 'none',
    ...(page.sourceIds?.length ? { sourceIds: [...page.sourceIds] } : {}),
    semantics: { schemaVersion:plan.schemaVersion, pagePurpose: page.pagePurpose, narrative: page.narrative, relations: page.relations ?? [], readingOrder: page.readingOrder ?? page.groups.map(g=>g.id) },
    items: page.groups.map(group => ({
      id: group.id, role: 'object', semanticRole: group.role, importance: group.importance,
      heading: group.heading, kind: group.kind, blocks: structuredClone(group.blocks),
      text: group.blocks.map(blockText).join('\n'),
      sourceIds: [...new Set(group.blocks.flatMap(block => block.sourceIds))],
      ...(group.kind === 'text' ? {} : { expression: group.expression, relationship: group.relationship, production: group.production }),
    })),
  }));
}

export function semanticPlanFromPages(plan) {
  return {schemaVersion:plan.pages[0]?.semantics?.schemaVersion,deckBrief:plan.deckBrief, pages:plan.pages.map(page=>({
    pageId:page.pageId,title:page.title,claim:page.claim,...page.semantics,
    ...(page.sourceIds?.length ? {sourceIds:[...page.sourceIds]} : {}),
    groups:page.items.map(item=>({id:item.id,role:item.semanticRole,heading:item.heading,importance:item.importance,kind:item.kind,blocks:item.blocks,expression:item.expression,relationship:item.relationship,production:item.production})),
  }))};
}

export function validateSemanticPlan(base, plan) {
  const issues = [];
  const warnings = [];
  const simple = plan?.schemaVersion === 'gray-plan-3';
  const fail = (code, pageId, message) => issues.push({ code, pageId, message });
  try {
    if (!plan?.deckBrief || !Array.isArray(plan.pages) || !plan.pages.length || plan.pages.length > 100) throw new Error('缺少 deckBrief/pages 或页数超出1..100');
    const pageIds = new Set();
    const sources = new Map(base.sources.map(source => [source.id, source.text]));
    for (const page of plan.pages) {
      if (!nonempty(page.pageId) || pageIds.has(page.pageId)) throw new Error('pageId 缺失或重复');
      pageIds.add(page.pageId);
      for (const key of ['title', 'claim', 'pagePurpose', 'narrative']) if (!nonempty(page[key])) fail('missing-page-semantics', page.pageId, key);
      if (page.sourceIds !== undefined) {
        const bad = !Array.isArray(page.sourceIds) || page.sourceIds.some(id => !sources.has(id));
        if (bad) throw new Error(`页面 ${page.pageId} 的 sourceIds 必须是已知来源 id 数组（页级认领通道）`);
      }
      if (page.composition || !Array.isArray(page.groups) || !page.groups.length) throw new Error('语义阶段须有groups且不得有composition');
      const nodes = new Set(['$claim']);
      for (const [groupIndex, group] of page.groups.entries()) {
        const groupLabel = nonempty(group.id) ? `组 ${group.id}` : `第 ${groupIndex + 1} 个组（缺少 id）`;
        if (!nonempty(group.id) || nodes.has(group.id)) throw new Error(`${groupLabel}：id 缺失或与前面重复`);
        nodes.add(group.id);
        const missingGroupFields = [
          nonempty(group.role) ? null : 'role', nonempty(group.heading) ? null : 'heading',
          KINDS.has(group.kind) ? null : `kind（须为 ${[...KINDS].join('|')}，当前 ${JSON.stringify(group.kind)}）`,
          ['primary','supporting'].includes(group.importance) ? null : `importance（须为 primary|supporting，当前 ${JSON.stringify(group.importance)}）`,
        ].filter(Boolean);
        if (missingGroupFields.length) throw new Error(`${groupLabel} 缺少或不合法的字段：${missingGroupFields.join('、')}`);
        if (group.kind !== 'text' && ![group.expression,group.relationship,group.production].every(nonempty)) throw new Error(`${groupLabel} 的 kind 是 ${group.kind}，必须同时提供 expression、relationship、production 三项制作说明`);
        if (!Array.isArray(group.blocks) || !group.blocks.length) throw new Error(`${groupLabel} 缺少 blocks（每组至少一个块）`);
        const blockIds=new Set();
        for (const [blockIndex, block] of group.blocks.entries()) {
          const blockLabel = nonempty(block.id) ? `块 ${block.id}（${groupLabel}）` : `${groupLabel} 的第 ${blockIndex + 1} 个块（缺少 id）`;
          if (!nonempty(block.id) || blockIds.has(block.id) || ((!simple || page.relations?.length) && nodes.has(block.id))) throw new Error(`${blockLabel}：id 缺失或与前面重复`);
          blockIds.add(block.id);
          nodes.add(block.id);
          if (simple) {
            if (!nonempty(block.text)) throw new Error(`${blockLabel} 缺少 text`);
            if (block.label !== undefined && typeof block.label !== 'string') throw new Error(`${blockLabel} 的 label 必须是字符串（可省略）`);
            if (!Array.isArray(block.sourceIds) || !block.sourceIds.length) throw new Error(`${blockLabel} 缺少 sourceIds（每个块必须引用至少一个来源）`);
            const unknown = block.sourceIds.filter(id => !sources.has(id));
            if (unknown.length) throw new Error(`${blockLabel} 引用了未知来源：${unknown.join('、')}；可用来源：${[...sources.keys()].join('、')}`);
          } else if (![block.role,block.label,block.text].every(nonempty) || !Array.isArray(block.sourceIds) || !block.sourceIds.length || block.sourceIds.some(id => !sources.has(id))) throw new Error(`${blockLabel} 的 role/label/text/sourceIds 不完整或引用了未知来源`);
          const kind=block.kind ?? 'text';
          if (!BLOCK_KINDS.has(kind)) throw new Error(`${blockLabel} 的媒介 ${JSON.stringify(block.kind)} 未知；可选：${[...BLOCK_KINDS].join('|')}`);
          if (block.scope !== undefined) {
            if (block.scope !== 'group') throw new Error(`${blockLabel} 的 scope ${JSON.stringify(block.scope)} 未知；只支持 "group"（组级共同说明，不编号）`);
            if (kind !== 'text') throw new Error(`${blockLabel} 的 scope:"group" 只能用于文字块；结构/附注块不需要它`);
          }
          if (kind !== 'text' && group.kind !== 'text') throw new Error(`${blockLabel} 选择了局部媒介 ${kind}，但所属组 kind 已是 ${group.kind}；整组非 text 时不要再给块选媒介`);
          if (kind !== 'text' && kind !== 'note' && ![block.expression,block.relationship,block.production].every(nonempty)) throw new Error(`${blockLabel} 选择了局部媒介 ${kind}，必须同时提供 expression、relationship、production 三项制作说明`);
          if ((kind === 'text' || kind === 'note') && [block.expression,block.relationship,block.production].some(value=>value!==undefined)) throw new Error(`${blockLabel} 是${kind === 'note' ? '附着说明' : '文字'}块，不能携带 expression/relationship/production（只有选了非 text 媒介才提供）`);
          if (block.label !== undefined && labelHasOrdinal(block.label)) fail('label-ordinal', page.pageId, `${blockLabel} 的标签「${block.label}」携带序号：序号由程序按条目顺序统一添加，label 只写内容词（去掉"一、""原因一""不足一"式前后缀）。`);
          if (kind === 'note') {
            const previous = group.blocks[blockIndex - 1];
            if (!previous || (previous.kind ?? 'text') !== 'text') fail('attachment-not-adjacent', page.pageId, `${blockLabel} 是附着说明，必须紧跟它所依附的文字条目（不能是组内首块或紧随另一个附注）；把附着关系写进结构，不要只写在 narrative。`);
          }
          const fidelity = checkItemFidelity({text:blockText(block),sourceText:block.sourceIds.map(id=>sources.get(id)).join('\n')});
          if (!fidelity.accepted) fail('block-fidelity', page.pageId, `${blockLabel} 的文案与来源不一致：${JSON.stringify(fidelity.issues)}`);
        }
        if (group.blocks.every(block => block.scope === 'group')) throw new Error(`${groupLabel} 的块全部是组级共同说明：组内至少需要一个普通条目，共同说明才有所依附。`);
      }
      if (!simple || page.readingOrder !== undefined) if (!Array.isArray(page.readingOrder) || page.readingOrder.length !== page.groups.length || new Set(page.readingOrder).size !== page.groups.length || page.groups.some(g=>!page.readingOrder.includes(g.id))) throw new Error('readingOrder须恰好包含全部组');
      if (!simple && (!Array.isArray(page.relations) || !page.relations.length)) throw new Error('必须记录真实关系');
      const touched = new Set();
      for (const edge of page.relations ?? []) {
        if (!TYPES.has(edge.type)) throw new Error(`未知关系类型 ${edge.type}，允许：${[...TYPES].join('|')}`);
        if (!nodes.has(edge.from) || !nodes.has(edge.to) || edge.from === edge.to) throw new Error(`关系端点非法 ${edge.from} -> ${edge.to}；本页节点：${[...nodes].join(',')}`);
        if (!nonempty(edge.meaning)) throw new Error(`关系 ${edge.from} -> ${edge.to} 缺少具体含义`);
        touched.add(edge.from); touched.add(edge.to);
      }
      if (!simple) for (const group of page.groups) {
        if (![group.id,...group.blocks.map(b=>b.id)].some(id=>touched.has(id))) fail('unrelated-group', page.pageId, group.id);
        if (group.blocks.length > 1 && !group.blocks.some(b=>touched.has(b.id))) fail('missing-internal-relation', page.pageId, `${group.id} 有多个blocks，但relations未关联其中任何块；记录真实内部关系，不能只修改叙事文字`);
        for (const block of group.blocks.filter(b=>['condition','qualification'].includes(b.role))) if (!page.relations.some(e=>e.from===block.id && ['condition','qualification'].includes(e.type))) fail('unattached-condition', page.pageId, `${block.id} 必须在relations中以condition或qualification作为from指向被约束对象；不要仅改角色名称绕过`);
      }
      if (!simple && !touched.has('$claim')) fail('unrelated-claim', page.pageId, 'relations数组缺少以$claim为端点的真实关系；必须补齐相应关系记录，仅改写claim正文或planningNotes不能修复此错误');
    }
    // 收尾标点去重（评审 #33）：连续同一闭标点为机械客观违例（附注模板已去重，此处守卫模型文案）。
    for (const page of plan.pages) for (const group of page.groups ?? []) for (const block of group.blocks ?? []) {
      if (/([。！？；])[。！？；]+/u.test(String(block.label ?? ''))) fail('duplicate-punctuation', page.pageId, `块 ${block.id} 标签出现连续重复的收尾标点：去掉多余标点。`);
      if (/([。！？；])[。！？；]+/u.test(String(block.text ?? ''))) fail('duplicate-punctuation', page.pageId, `块 ${block.id} 正文出现连续重复的收尾标点：去掉多余标点。`);
    }
    // 流转信息来源（文件头尾、节标题等）：无需覆盖、无需认领。展示判断与角色/覆盖分离（评审 #111 契约三分）：
    // 识别为标题不必然单独成区，也不一律禁止上屏——出现即记非阻塞提示，是否有相称展示价值交独立审稿按内容贡献判断，
    // 不再用格式规则硬拦；"为凑覆盖单列成区/搬运文件头尾"仍由审稿按信息价值判不合格。
    for (const source of base.sources.filter(item => item.flow)) {
      const needle = String(source.text ?? '').replace(/\s+/gu, '');
      if (needle.length < 3) continue;
      for (const page of plan.pages) {
        const fields = [
          ['页标题', page.title],
          ...(page.groups ?? []).flatMap(group => [
            [`组标题 ${group.id}`, group.heading],
            ...(group.blocks ?? []).flatMap(block => [
              [`块 ${block.id} 标签`, block.label],
              [`块 ${block.id} 正文`, block.text],
            ]),
          ]),
        ];
        const hit = fields.find(([, value]) => String(value ?? '').replace(/\s+/gu, '').includes(needle));
        if (hit) warnings.push({ code: 'flow-source-onscreen', pageId: page.pageId, message: `流转信息来源（${source.flow}）出现在${hit[0]}：确认此位置有相称展示价值；搬运文件头尾或单列成区凑覆盖不合格。` });
      }
    }
    // 结构旁白（"本部分先讲…再讲…"）：模型自造的组织说明，不是原稿内容——元信息上屏，机械禁止（客观违规免证据）。
    for (const page of plan.pages) for (const group of page.groups ?? []) {
      const narratedFields = [
        [`组标题 ${group.id}`, group.heading],
        ...(group.blocks ?? []).flatMap(block => [
          [`块 ${block.id} 标签`, block.label],
          [`块 ${block.id} 正文`, block.text],
        ]),
      ];
      for (const [where, value] of narratedFields) {
        const narrated = String(value ?? '').split('\n').some(line => STRUCTURAL_NARRATION.test(line.trim()));
        if (narrated) fail('structural-narration', page.pageId, `结构旁白不得上屏：${where} 出现「本部分/本节先讲…」式组织说明；页面上只放内容，组织关系由版面结构承担`);
      }
    }
    // 字面类别线索仅作审稿提示；概括改写与真实归属交由语义判断，不能用原词充当硬闸门。
    const cueList = categoryCues(base.sources);
    for (const cue of cueList) {
      const headings = plan.pages.flatMap(page => (page.groups ?? []).map(group => String(group.heading ?? '')));
      if (!headings.some(heading => heading.includes(cue.noun))) {
        warnings.push({ code: 'category-not-grouped', pageId: plan.pages[0]?.pageId, message: `原稿类别线索「${cue.phrase}」未在组标题中复现：请语义核对该类别及条目归属是否保留；忠实改写不因缺少原词而被拒绝。` });
      }
    }
    // 仅检查已经选定的局部结构位，不从样稿连接词或类别数量推导必选媒介。
    // 无 label、紧邻文字块的非文字块按渲染器约定附着在前一条目；节点与所属条目实文或来源顺序对应（评审 #128：
    // 允许压缩提炼，不得引入来源没有的对象或改变顺序），跨条目摘引仍不允许。
    const compactQuote = value => String(value ?? '').replace(/[\s。，；：、！？（）()「」『』“”"'·—－-]/gu, '');
    const orderedSubsequence = (phrase, text) => {
      let index = 0;
      for (const char of text) { if (index < phrase.length && char === phrase[index]) index += 1; }
      return index === phrase.length;
    };
    for (const page of plan.pages) for (const group of page.groups ?? []) {
      if (group.kind !== 'text') continue;
      const blocks = group.blocks ?? [];
      for (let i = 1; i < blocks.length; i += 1) {
        const note = blocks[i], parent = blocks[i - 1];
        if (!note.kind || note.kind === 'text' || note.kind === 'note' || note.label || (parent.kind ?? 'text') !== 'text') continue;
        const corpus = compactQuote(parent.text);
        const phrases = String(note.text ?? '').split(/[／/]|→|->/u).map(compactQuote).filter(Boolean);
        const mismatch = phrases.find(phrase => !orderedSubsequence(phrase, corpus));
        if (mismatch) fail('structure-quote-mismatch', page.pageId, `结构位 ${note.id} 的节点短语「${mismatch}」在所属条目 ${parent.id} 的实文与来源中找不到顺序对应（允许压缩提炼，不得引入来源没有的对象或改变顺序）；核对归属并保留必要限定。`);
      }
    }
    // 非阻塞 warnings（评审 #7 (b)）：只验字面会被模型走最小合规路径（"不足一/感悟一"前缀），
    // 容器形态移交第 7 条模板化解决；此处只记录博弈样本，不阻塞交付。
    for (const cue of cueList) {
      const named = plan.pages.flatMap(page => (page.groups ?? []).map(group => ({ pageId: page.pageId, heading: String(group.heading ?? ''), blocks: (group.blocks ?? []).length })))
        .filter(group => group.heading.includes(cue.noun));
      const numbered = named.filter(group => new RegExp(`${cue.noun}[一二两三四五六七八九十\\d]`, 'u').test(group.heading));
      if (numbered.length) {
        warnings.push({ code: 'category-prefix-only', pageId: numbered[0].pageId, message: `「${cue.noun}」由编号前缀承载（${numbered.map(g => g.heading).join('、')}）：形式合规但类别容器缺失（see 评审 #7 字面合规博弈）` });
      }
      const count = chineseCount(cue.count);
      if (count >= 2 && named.length > Math.ceil(count / 2)) {
        warnings.push({ code: 'category-fragmented', pageId: named[0]?.pageId, message: `类别「${cue.noun}」涉及 ${named.length} 个组（线索为「${cue.phrase}」）：组数超过整页/拆页两种合法形态（${Math.ceil(count / 2)}）——记录为碎裂样本，不阻塞交付。` });
      }
    }
    const state = upsertPageBriefs({...base, pages:[], phase:'content', deckBrief:plan.deckBrief}, semanticPages(plan));
    issues.push(...grayCoverageIssues(state));
  } catch (error) { fail('invalid-semantic-plan', undefined, error.message); }
  return {accepted:issues.length===0,issues,warnings,coverage:simple ? '内容字段、表达方式、来源覆盖、块级数字/引文及已提供的关系端点；必要关系与限定是否正确仍需语义和实际审阅。' : '结构、引用、块级数字/引文、关系端点及条件归属；不证明语义正确或灰稿可读。'};
}

export function bindSemanticLayout(plan, layout) {
  if (layout?.needsReplan) throw new Error(`需要重新组织：${layout.reason}`);
  if (!layout || Object.keys(layout).some(k=>k!=='pages') || !Array.isArray(layout.pages) || layout.pages.length !== plan.pages.length) throw new Error('排版只能返回同页数的pages');
  const pages = semanticPages(plan);
  for (const [index,page] of pages.entries()) {
    const entry = layout.pages[index];
    if (entry?.pageId !== page.pageId || Object.keys(entry).some(k=>!['pageId','regions'].includes(k)) || !Array.isArray(entry.regions)) throw new Error('排版不能改变页序或内容');
    if (entry.regions.length !== page.items.length || entry.regions.some((r,i)=>r.itemId!==page.semantics.readingOrder[i] || Object.keys(r).some(k=>!['itemId','x','y','width','height','fontSize'].includes(k)))) throw new Error('排版只能按阅读顺序绑定原组ID与几何');
    page.composition = {regions:structuredClone(entry.regions)};
  }
  return {deckBrief:structuredClone(plan.deckBrief),pages,planningNotes:plan.planningNotes};
}
