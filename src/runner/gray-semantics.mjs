import { upsertPageBriefs, validateContent } from './state.mjs';
import { checkItemFidelity } from '../content/source-fidelity.mjs';
import { bindExpressionGroups } from '../composition/content-stages.mjs';
import { createHash } from 'node:crypto';

const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const TYPES = new Set(['support', 'criterion', 'implementation', 'sequence', 'parallel', 'condition', 'qualification', 'comparison', 'decomposition', 'context']);
const KINDS = new Set(['text', 'diagram', 'flow', 'chart', 'table', 'image']);

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
 * 类别成组检查（规则毕业：提示词→checker）。原稿的类别线索（"首先是两点不足""其次是四点感悟"）
 * 必须映射为组：组标题承载类别词、条目作为组内块。判定特征确定（前缀+数词+量词+类别词），
 * 误报面窄（不做数词裸匹配："六个月""三个街道""三个市场化"都不算线索）。
 * fail 级：验证过 r7 形态可达（20260917232451），漂移样本为迁移 A/B 与四稿基线（条目即组）。
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

/** 同页双容器目标判定：恰好两个类别线索，且两类别的组标题同页承载（评审 #22 目标形态）。 */
export function samePageCues(cues, plan) {
  if ((cues ?? []).length !== 2) return false;
  const nouns = cues.map(cue => cue.noun);
  return (plan?.pages ?? []).some(page => {
    const headings = (page.groups ?? []).map(group => String(group.heading ?? ''));
    return nouns.every(noun => headings.some(heading => heading.includes(noun)));
  });
}

/**
 * 分页闸门（评审 #22 裁决二；#24 收紧）：同页双容器目标下，按类别分页只认「两轮真压缩（每轮实测更短）」后的仍超；
 * 通用「两次容量失败即分页」在此目标下不生效。minimums 为该形态容量失败的逐次实测高。
 * 未发生同页尝试时同样不接收分页计划（先按类别规则的同页并排规划）。
 */
export function splitGate({ cues, plan, minimums }) {
  const rounds = (() => { let value = 0; const list = minimums ?? []; for (let i = 1; i < list.length; i += 1) if (list[i] < list[i - 1]) value += 1; return value; })();
  if ((cues ?? []).length !== 2) return { blocked: false, rounds };
  if (samePageCues(cues, plan)) return { blocked: false, rounds };
  return { blocked: rounds < 2, rounds };
}
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
      issues.push({ ...issue, sourceIds: missing, message: `正文来源未被引用：${missing.join('、')}` });
      continue;
    }
    issues.push(issue);
  }
  return issues;
}

/** 共享规则片段：SEMANTIC_CONTRACT 与 GRAY_AGENT_PROMPT 的唯一来源；同步由 tests/prompt-sync.test.mjs 守卫。 */
export const SHARED_RULES = Object.freeze({
  category: `原稿自带类别线索时（如"首先是两点不足、其次是四点感悟"、"一是…二是…"分属两类），先恢复两层归属：组是类别层——类别成为组（组标题用类别名），类别内的每个条目是该组的块（label=条目要点，text=条目展开）；条目不升级为组，不得与类别同层铺成多个组，也不得为条目单独开页。条目内部的并列细项（如四方面、三方面原因）无论出现在行文中还是冒号后，都逐项成块、一行一项（行首可用"·"），不压进一个逗号长句；同页并排形态生效时（见本段末），条目内部细项允许散文连写（与范本成品一致，保留对象、条件、数字与限定）——该作用域仅限同页双容器，拆页/全宽形态仍逐项成块、一行一项。类别内条目都是短条目（各 1–2 行）时，整类必须排在一页——先按整类一页规划，容量确有需要才拆页：若只超出不到一行（≤60px），按原稿允许的提炼压紧——优先删排比性复述与修饰语（删修饰不删事实），合并页用紧凑散文、不展开多行链——再试一次合并；仍超出才拆页。类别跨页时，拆出的每页仍保持类别成组：每页一个组、组标题用「类别名＋本页条目提示」的内容词（如"感悟：统一语言与检验标准"），页内条目属于该组；不得把类别拆成多个同级组，也不得沿用类别总数标题（一页只放两条时不许写"四点感悟"）。同一主题区块的两个类别（如"首先是两点不足、其次是四点感悟"）先按同页并排规划：恰好两个类别容器、同一页横向（左一类、右一类），不得默认各占一页；为达成同页先把条目展开提炼为短句（保留对象、条件、数字与限定）；渲染报"放不下"时只许改写正文（每次重试必须比上一版更短：删修饰语、缩短语、并短线，保事实数字），不得同版重试、不得改分组；两轮压缩仍放不下才按类别分页。该形态下条目保持散文实文（细项照录、一字不删）；凡原稿明示的汇聚（"……造成……"）与扇出（"反映出……"后并列 3–4 项）即视为"画图更能表达意思"，必须在该条目之后附一个小结构位（block kind=diagram/flow，四要素齐全、无 label），只写建议画什么图、节点文案与箭头/关系——禁止整条目转蓝、散文消失；其余情形不附，不硬套。`,
  expression: `按内容关系选择表达：两个及以上对象的共同维度对照用diagram，每个对象一个block；步骤、流程与时间顺序（三个及以上节点）用flow，节点按顺序；明确的对照网格用table，每行一个block；数据图表与图片保留蓝区说明，并在制作要求里写明建议表达。分解或构成（总量＝部分之和、对象→去向）、指标随时间变化不用平行卡片，用一条可读文字（"异常 7 台：已修复 5 台，待配件 2 台"）。行式表格只用于多个对象按共同维度互相对照（两种模式×多项指标、多个项目×进度与问题）；单个对象的一组规则、要求、背景说明用文字条目（一句一条），不做成表格。同一页不要所有组都用同一种表达；同一稿件不同页避免重复同一组合。同页双容器形态下，条目内部的明示汇聚/扇出结构位见类别规则（优先于本条"用一条可读文字"的通用建议）。`,
  sketch: `diagram/flow/table会绘制简化草图，框内文字就是实际文案、必须完整可读；不要一律平铺文字，也不要给没有内部关系的内容硬套结构，更不要把该成结构的内容写成流水账。`,
  source: `每个block必须引用来源，所有正文来源至少被一个block引用；标为流转信息（文件头尾、节标题等）的来源无需引用、不得上屏。`,
  declaration: `模拟/假设声明只要原稿给出，就必须上屏且恰好一次：最自然的位置是页面主题句，或紧邻主体的一个条目；不得省略、不得逐条重复、不得独立成组。`,
  condition: `真实条件与否定不能省略，准则不是已满足的证据，并行准备不是下一阶段。`,
  attachment: `条件触发的处置、异常或例外是附着性内容：注明它约束哪些对象或环节，从属并紧邻所依附的内容（作为依附对象的补充说明，或从属职责的supporting组），不与主流程环节、并列要点铺成同层组；判断依据是依附关系，不是篇幅大小。`,
  paging: `页数服从内容量：每页必须有实质展开（对象、条件、范围、动作），某页只剩一两句单薄内容时并入相邻页，不为凑页数摊薄；全稿组数少时控制在两页内——三四个组一页即可，五六个组默认两页；一页放不下就分页，不要反复精简文字硬塞一页，也不要每两三个组单开一页把短稿摊成多页；标题给出判断，正文必须补充标题没有的细节，不整句复述标题。`,
  label: `label可省略，只有帮助读者定位职责时才用，并且必须是内容词（"正常""已修复""待配件"），不用"拆分项一""对象""状态一"这类结构占位名，也不带"（全页适用）"这类版面说明；表格行只有行头与内容两段，不要把多列文字用竖线拼进一个块。`,
  surface: `页面目的、narrative和planningNotes不在灰稿上显示。`,
  meta: `公文头尾、节标题是流转信息、不是演示内容：来源表里标为流转信息的来源一律不上屏（覆盖检查已豁免、无需引用），也不得改写成"通知依据""背景"之类条目；"本部分先讲…"这类结构旁白同样不上屏。`,
});

export const SEMANTIC_CONTRACT = `你的任务是将原稿提炼、重组为适合PPT阅读的信息结构，本轮只生成灰稿内容，只输出JSON。原稿是事实依据，不是必须逐字搬入页面的正文。保留重要事实、对象、条件、否定和关系；允许合并重复信息、删去冗词与重复解释、把长句改写为短语和清楚的分项。提炼不改变事实与关系，不能为了容量删除必要条件。${SHARED_RULES.meta}
本次契约优先于共享规则中可选解析器的字段。不要生成composition-intent、逐句关系图或坐标，不按原稿标题数量分区。
格式：{schemaVersion:"gray-plan-3",deckBrief:{title,audience,objective},pages:[{pageId:"p1",title:"短标题",claim:"简短上屏主题句，建议二十字左右，不复述全部正文",pagePurpose:"本页解决的问题",narrative:"一句话说明必要的先后、并行、判断或归属关系，无需列每条边",groups:[{id:"g1",role:"本组主要职责",heading:"上屏短标题",importance:"primary|supporting",kind:"text|diagram|flow|chart|table|image",blocks:[{id:"b1",label:"可选上屏子标题，不需要可省略",text:"真实上屏文字",sourceIds:["s1"]}],expression:"非text必填：表达作用",relationship:"非text必填：基本关系",production:"非text必填：制作要求"}]}],planningNotes:"简短后台组织说明"}。
先明确页面职责，按内容归属形成groups，再把各分支的条目放进blocks，用label与text区分要点和展开。${SHARED_RULES.category}先形成可阅读的实文提纲，再选择局部表达；不要把分属不同观点的依据摊成同级卡片，也不要把分类、依据、准则混称为证明。这些层级按实际内容使用，不强求每页都有两个分支或固定条目数。文字组内某条需要图示时，该block可选kind及expression、relationship、production，字段含义与整组蓝区相同；其label仍是上屏条目标题。未选kind的block为普通文字，整组非text时不再嵌套蓝区。${SHARED_RULES.expression}${SHARED_RULES.sketch}结构库按局部关系按需调用，本轮仅呈现蓝区制作说明。
每组一个主要职责。claim概括主题或判断，正文展开对象、安排与条件，不把同一句建议分别复制到主题、组标题和正文。blocks按阅读顺序；${SHARED_RULES.label}三列对照改写成一条可读文字或拆成两个块。heading保持短小。蓝区expression写表达作用，relationship写谁与谁怎样关联，production写可执行的组织要求；三者分工，避免重复复述承载内容。必要关系须在实文组织或蓝区制作说明中可见，仅保留关键词或写在narrative里不等于表达完成。
${SHARED_RULES.source}引用表示信息来自哪里，不要求每段原文单独变成一个正文块；页级主题承载的信息可随相关block引用。${SHARED_RULES.declaration}小段共同说明就近融入主体，不因职责不同便独占大栏。${SHARED_RULES.condition}${SHARED_RULES.attachment}
内容区尺寸由输入给定，主题句在内容区外，以28px单行呈现，需简短。排版仅有单主体、横向、纵向、规则网格，空间不够时重新组织或分页。正文22px（同页双容器形态按 18–20px 降档、容量实测选择；拆页/全宽维持 22px），组标题26px一行，组内每个可选label与text各自排字，约每行30px，块间距12px，每块四周8px内边距。每组70px标题/边距开销；按内容估计，不自己写坐标或强制页数。${SHARED_RULES.paging}同组label+text合计不超过400字。保留原稿数字写法。
${SHARED_RULES.surface}正文必须能独立让读者理解必要关系，不能依赖后台说明。内部审查理由不要改写成正文：用“同时”“是否”“根据记录”等原稿已有表达保留关系，不额外解释“不是先后步骤”“不是已满足的证据”等审稿规则。原稿的模拟/假设性质属于读者需要的内容，须在实际标题或正文中明示，引用sourceIds不能代替显示。`;

export const SEMANTIC_REVIEW_CONTRACT = `你是灰稿内容与表达审稿人。输入source是原稿，requirements是后台职责与必要关系，visiblePages是程序从实际渲染内容生成的上屏视图。只用visiblePages证明表达已落实；requirements不能作为上屏证据。尚未分配坐标或查看像素图。
逐页核对：事实、条件、否定和模拟性质是否完整；主题与正文是否各有职责；组角色是否通过分项、对应、层级或结构草图落实；必要关系能否直接读出，而非由读者从两个长段落自行拼接。只有标题改名、主辅标签或并排放置，不证明关系已表达。可用结构手段仅限三种：diagram（对象并置卡片）、flow（顺序节点与箭头）、table（行式表格：每行一个对象，行内用文字写各维度）；chart/image 只有蓝区说明。不要要求系统不具备的结构（列对照网格、条件分支图、字段对应表、嵌套层级图）；条件与后果、对象与时限用一行可读文字写清楚即可，在可用手段内评判是否可读，不因没有专门图形而打回。文字本身组织清楚可以通过；diagram、flow、table 本轮绘制简化草图，框内文字为实际文案，chart/image 仍是蓝区说明。对比应配对、时序应有序；该成结构却写成流水账、没有内部关系硬套结构、分解或构成被拆成平行卡片、指标随时间变化被卡片化、单对象规则或说明硬做成表格，都要指出。同页并列的两个类别（如两点不足与四点感悟）是并列关系，不得要求一一配对卡片或对应表；对照、因果、依赖关系必须有原稿明示依据，否则视为制造虚假对应。同页双容器形态下，条目须保留散文实文（细项一字不删）；原稿明示的汇聚/扇出（"……造成……""反映出……"）画成图比文字更能表达意思时，可在条目之后附小结构位（蓝区只写建议画什么图、节点文案、关系与制作）；蓝区是附注——整条目转蓝或散文缺失要指出；反之，明示结构完全无结构位时也指出；无明示关系不得要求结构位。
准则是选择尺度，不能充当已验证的证据；并行不能写成先后；条件须对应被约束的行动。附着性内容（条件触发的处置、异常、例外）不能与主体步骤或并列要点铺成同层区域；主体职责的内容必须作为实际文案或结构草图文字出现，只在蓝区制作说明中复述不算落实。条目标签必须是内容词，出现"拆分项一""对象""状态一"这类结构占位名要指出；表格行里用竖线拼接多列文字也要指出；标为流转信息的来源被上屏，或正文整句复述标题，都要指出。不要添加原稿未给出的因果、依赖或效果。引用当前可见文案指出具体缺陷；不能仅因个人偏好、估计容量或未知坐标拒绝。打回时描述"哪条关系或职责不能直读"的可读性要求，不指定具体媒介；同一关系只要能通过任一可用手段（文字分项、卡片、表格、流程）直读即通过。若有reviewFeedback，只复核所提问题是否实质解决，解决即通过，不追加新的媒介偏好。主题概括后正文展开是合法分工，长句机械复述和以后台解释代替组织则须修订。
声明必须恰好出现一次且不独立成组：遗漏、重复、或把模拟/假设声明单独做成一个区域都要指出。后台审查解释不得进入灰区正文；蓝区制作要求可以说明关系组织与绘制要求。若有reviewFeedback，检查是否实质解决。
只输出JSON：{accepted:boolean,issues:[{pageId,sourceIds,problem,requiredRevision}],coverage:"逐页引用visiblePages中的具体措辞或组织，说明它怎样承担职责和关系；不能仅复述requirements",limits:"未看灰稿像素图，不能确认视觉可读性"}。`;

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

const STRUCTURE_LEAD = Object.freeze({ diagram: '建议画结构图', flow: '建议画结构图', table: '建议画表格', chart: '建议画数据图', image: '建议配图' });

export function regionBody(item) {
  if (item.kind === 'text' && item.blocks) return grayDisplayBlocks(item).map(block=>block.text).join('\n');
  if (SKETCH_KINDS.has(item.kind) && item.blocks) return item.blocks.map(blockText).join('\n');
  // 蓝区平直中文（评审 #59）：不用字段代码前缀，一两句说清「建议画什么图＋节点文案＋关系/制作」。
  if (item.kind === 'text') return item.text;
  const lead = STRUCTURE_LEAD[item.kind] ?? '制作说明';
  return `${lead}：${item.expression}。节点文案：${item.text}。${item.relationship}。${item.production}。`;
}

const ORDINALS = Object.freeze(['一','二','三','四','五','六','七','八','九','十']);
const ordinalLabel = index => ORDINALS[index - 1] ?? String(index);

/** One display projection for review, measurement and native rendering. No backstage prose. */
export function grayDisplayBlocks(item, { ordinal = 0 } = {}) {
  if (SKETCH_KINDS.has(item.kind) && item.blocks) {
    // 结构草图：审稿、测量与渲染看到的是同一份逐卡片/节点的实际文案（"是结构"这一事实由 surface 描述）。
    return item.blocks.flatMap((block,index)=>[
      ...(block.label ? [{text:block.label,bold:true,gapBefore:index ? 12 : 0}] : []),
      {text:block.text,bold:false,gapBefore:!block.label && index ? 12 : 0},
    ]);
  }
  if (item.kind !== 'text' || !item.blocks) return [{text:regionBody(item),bold:false,gapBefore:0}];
  // 条目编号标签（评审 #25）：文字组内带标签条目按实际顺序编号（跳条不串号）；单条目组不编号。
  // ordinal 用于逐块测量路径（grayBodyLayout 逐块投影）与组级投影保持同一编号。
  const labeledCount = item.blocks.filter(block => nonempty(block.label)).length;
  const numbered = ordinal > 0 || labeledCount >= 2;
  return item.blocks.flatMap((block,index) => [
    ...(block.label ? [{text:numbered ? `${ordinalLabel(ordinal > 0 ? ordinal : index + 1)} ${block.label}` : block.label,bold:true,gapBefore:index ? 12 : 0}] : []),
    {text:block.kind && block.kind!=='text' ? regionBody(block) : block.text,bold:false,gapBefore:!block.label && index ? 12 : 0,
      ...(block.kind && block.kind!=='text' ? {kind:block.kind} : {})},
  ]);
}

export function semanticReviewInput({source,area,plan,reviewFeedback=null}) {
  const pages = semanticPages(plan);
  return {
    source, area:{width:area.width,height:area.height}, reviewFeedback,
    requirements:plan.pages.map(page=>({pageId:page.pageId,pagePurpose:page.pagePurpose,narrative:page.narrative,
      groups:page.groups.map(group=>({id:group.id,role:group.role,importance:group.importance}))})),
    visiblePages:pages.map(page=>({pageId:page.pageId,claim:page.claim,regions:page.items.map(item=>({
      id:item.id,kind:item.kind,surface:SKETCH_KINDS.has(item.kind)
        ? `结构草图：${SKETCH_LABELS[item.kind]}，框内文字为实际文案`
        : item.kind==='text'
          ? (item.blocks?.some(block=>block.kind && block.kind!=='text') ? '灰区为实际文案；body中非text的kind为块内浅蓝制作说明，四项均上屏' : '灰区：实际文案')
          : '浅蓝区：制作说明，四项均须上屏',heading:item.heading,body:grayDisplayBlocks(item),
    }))})),
  };
}

/** Compile once from structured copy. Layout never supplies or rewrites content. */
export function semanticPages(plan) {
  return plan.pages.map(page => ({
    pageId: page.pageId, title: page.title, claim: page.claim, relation: 'none',
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
          if (!KINDS.has(kind)) throw new Error(`${blockLabel} 的媒介 ${JSON.stringify(block.kind)} 未知；可选：${[...KINDS].join('|')}`);
          if (kind !== 'text' && group.kind !== 'text') throw new Error(`${blockLabel} 选择了局部媒介 ${kind}，但所属组 kind 已是 ${group.kind}；整组非 text 时不要再给块选媒介`);
          if (kind !== 'text' && ![block.expression,block.relationship,block.production].every(nonempty)) throw new Error(`${blockLabel} 选择了局部媒介 ${kind}，必须同时提供 expression、relationship、production 三项制作说明`);
          if (kind === 'text' && [block.expression,block.relationship,block.production].some(value=>value!==undefined)) throw new Error(`${blockLabel} 是文字块，不能携带 expression/relationship/production（只有选了非 text 媒介才提供）`);
          const fidelity = checkItemFidelity({text:blockText(block),sourceText:block.sourceIds.map(id=>sources.get(id)).join('\n')});
          if (!fidelity.accepted) fail('block-fidelity', page.pageId, `${blockLabel} 的文案与来源不一致：${JSON.stringify(fidelity.issues)}`);
        }
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
    // 流转信息来源（文件头尾、节标题等）：无需覆盖、不得上屏。死结在数据层消解，不让模型在矛盾指令里自行平衡。
    // 扫描全部上屏字段（页标题/组标题/块标签/块正文），不只块正文——元信息可能被塞进标题层。
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
        for (const [where, value] of fields) {
          if (String(value ?? '').replace(/\s+/gu, '').includes(needle)) {
            fail('flow-source-onscreen', page.pageId, `流转信息来源（${source.flow}）不得上屏：${source.id} 的内容出现在${where}；正文只写实质内容，不搬文件头尾`);
          }
        }
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
    // 类别成组：原稿有类别线索时，类别词必须由组标题承载（页标题不算）。
    const cueList = categoryCues(base.sources);
    for (const cue of cueList) {
      const headings = plan.pages.flatMap(page => (page.groups ?? []).map(group => String(group.heading ?? '')));
      if (!headings.some(heading => heading.includes(cue.noun))) {
        fail('category-not-grouped', plan.pages[0]?.pageId, `原稿有类别线索「${cue.phrase}」：类别必须成为组——组标题承载「${cue.noun}」（跨页用「${cue.noun}＋本页条目提示」），条目作为组内块；当前没有任何组标题承载它（写在页标题不算）。请重组后再提交。`);
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
