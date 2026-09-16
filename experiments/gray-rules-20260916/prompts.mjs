import {SEMANTIC_CONTRACT,EXPRESSION_CONTRACT,SEMANTIC_REVIEW_CONTRACT,LAYOUT_CONTRACT} from '../../src/runner/gray-semantics.mjs';
export const original={content:SEMANTIC_CONTRACT,expression:EXPRESSION_CONTRACT,review:SEMANTIC_REVIEW_CONTRACT,layout:LAYOUT_CONTRACT};
const output='仅返回一个可直接JSON.parse的JSON对象，键和字符串使用双引号，字符串内换行与引号按JSON转义。';
const source='每个block都填写非空sourceIds，从输入来源标识中原样复制。数字、单位及引文沿用来源写法，其余文案可提炼；保留事实、条件、否定、时点和不确定程度。';
const medium='kind为text、diagram、flow、chart、table或image。普通文字用text；非text填写expression（表达作用）、relationship（对象间关系）、production（组织要求），三项简短分工，承载实文只放blocks。文字组内可让单个block使用非text及这三项说明；未选kind的block仍为文字，整组非text时blocks保持普通文字。灰稿的蓝区会显示承载实文和三项说明，本轮只做说明，不绘制内部节点。';
export const positive={
content:`你负责将原稿提炼为可读、可制作的PPT灰稿内容。${output}
格式：{"schemaVersion":"gray-plan-3","deckBrief":{"title":"题目","audience":"听众","objective":"目的"},"pages":[{"pageId":"p1","title":"短标题","claim":"短主题句","pagePurpose":"本页回答的问题","narrative":"必要关系的一句话说明","groups":[{"id":"g1","role":"主要职责","heading":"短区域标题","importance":"primary","kind":"text","blocks":[{"id":"b1","text":"实际文案","sourceIds":["s1"]}]}]}]}。importance取primary或supporting，block可选label作短条目标题；非文字字段按下文填写。
先按读者问题决定各页目的与范围，让主题覆盖本页全部主体；每页按归属组织分支和条目，相关限定就近附着于被限定内容。每条实质信息有一个主要展开位置，标题负责定位，主题负责概括，正文负责展开；合并重复说明，将长段提炼成要点与必要解释。完整原稿信息由全稿覆盖，所有来源至少引用一次。模拟或假设性质在覆盖其适用范围的可见文案中明示一次即可。
${source}
${medium}
信息关系通过文字组织或蓝区说明可读，后台narrative仅供规划。采用原稿事实语气呈现并行、先后、判断尺度及前提。页面分组按内容归属而非角色名数量，短限定随主体阅读。
依据输入内容区容量规划页数。正文22px、区域标题26px一行、主题28px一行；正文每行约30px，每组标题边距70px，每块四周8px、块间12px。蓝区的实文和说明均占空间。同组label和text合计不超过400字。优先精简重复文案；容量仍不足则按页目的拆分，页数由内容决定。输出内容而非几何。`,
expression:`你负责将已有内容组织为灰稿表达。${output}
格式：{"pages":[{"pageId":"原页ID","expressions":[{"groupIds":["原组ID"],"heading":"短区域标题","kind":"text","blocks":[{"id":"b1","text":"实文","sourceIds":["原来源ID"]}]}]}]}。
按原页序覆盖全部页面。每页每个原组在groupIds中恰好出现一次，相关组可合并为一个表达；保留页主题与角色，按归属重组正文，合并复述，使标题定位、条目要点和展开各有作用。短条件随对应动作或判断就近阅读。
${source}本阶段每个block的sourceIds仅从所绑定组已有blocks的sourceIds并集中选取，即使重写或合并也逐块填写。
${medium}
关系组织清楚的文字保留文字，只有局部需要图示就仅选择该条目，多个关联组确需共同表达才合并。跨条目、跨组的重复说明压缩，实际关系与必要条件保留。若必须改变分页或页面职责才能成立，返回{"needsReplan":true,"reason":"具体原因"}。`,
review:`你核对灰稿的内容与组织。${output}
source是事实依据；visiblePages是本轮实际会显示的全部文字；requirements只是后台职责。灰区实文与蓝区承载内容都是上屏证据，蓝区还显示表达作用、基本关系、制作要求，本轮以说明审阅图示计划。按这个完成阶段评价。
逐页对照原稿与visiblePages，检查事实、对象、数字、单位、条件、否定、时点、不确定性和模拟性质是否忠实；再检查主题覆盖本页主体、正文有清楚归属、每条实质信息有主要展开位置。主题概括与正文展开合法，纯粹重复的区域需要合并。条件对应行动、准则保持选择尺度、并行与先后按原意呈现。关系清楚的文字与蓝区说明均可成立。
每条拒绝理由给出原稿要求及可见文案中的具体缺失或矛盾。原稿有信息而可见内容没有才判断遗漏；后台职责不补足可见缺失。模拟声明覆盖适用内容一次即可。若有反馈，核对实质变化。容量和像素效果由后续测量及看图检查。
返回{"accepted":true,"issues":[],"coverage":"逐页引用可见文案说明核对结果","limits":"未看像素图"}，或accepted为false且issues为[{"pageId":"页ID","sourceIds":["来源ID"],"problem":"依据及具体缺陷","requiredRevision":"保持原意的修订要求"}]。`,
layout:`你只为已冻结内容选择基础空间组合。${output}
返回{"pages":[{"pageId":"原页ID","layout":合法组合}]}，每页按原页序出现，组按原阅读顺序安排。
layout每次选以下一种形状：
{"type":"single"}：该页恰好一个组。
{"type":"row"}：横向分栏；可选weights，若填写则长度等于该页组数，每项为正数，按组顺序分配宽度。
{"type":"column"}：纵向分组，程序按实文最小高度分配空间。
{"type":"grid","columns":2}：规则网格，columns为1到组数之间的整数。
只填写所选形状适用字段。程序负责实际测量、固定字号、坐标及块内分配。按组数、文字长度和阅读关系选择合理组合；同排上下对齐。优先让长文字有足够宽度，避免狭窄长栏；少量内容无需额外切栏。
若测量报错，按返回的组ID、宽高和最小容量修订组合，保留文字与组。只有容量证据表明需要重新组织内容才返回{"needsReplan":true,"reason":"具体容量问题"}。`
};
export const guarded=Object.fromEntries(Object.entries(positive).map(([k,v])=>[k,v+'\n'+({
content:'不要按段落数或角色名数量分栏；不要让短声明独占区域；不要用缩字、删条件或重复跨页展开来解决容量。',
expression:'不要省略重写block的sourceIds，不把组ID当来源ID；不要复述整段实文充当三项制作说明；不要改变数字写法。',
review:'不要把蓝区当成未上屏占位，也不要要求本轮完成图示；不要凭后台说明、个人版式偏好或对容量的猜测放行或拒绝。',
layout:'不要复制其他页的组数或示例权重；不要给single、column携带weights或columns；不要改变正文、分组、页序或字号。'
}[k])]));
const reviewV2=`你核对原稿与灰稿可见内容。${output}
证据分两类：visiblePages中的claim、heading和body会显示，灰区正文与蓝区承载实文同样有效；deckBrief、requirements及后台叙述不显示。蓝区的表达作用、基本关系和制作要求用于审阅本轮图示计划，不能当成已经画出的图示，也不能仅因它是蓝区拒绝承载实文。
先逐项核对原稿的事实、对象、数字及单位、条件、否定、时点、模拟/假设性质和不确定程度，在全部可见页中定位对应文字。模拟/假设性质在适用范围内显示一次即可；后台有而可见内容没有，仍是缺失。区分原稿事实、选择准则、待验证解释和计划，不增添因果或门槛。
再检查页面主题能否概括本页全部主体，内容按归属展开、必要条件就近附着，每项信息有主要展开位置。标题概括和正文展开合法，重复的正文或机械拆成多个角色框应修订。文字表达与蓝区说明均可承载关系。
拒绝必须指出原稿要求及可见内容的具体缺失或矛盾；不以个人偏好、未知坐标或估计容量拒绝。放行前确认上述各项已在可见内容中找到依据，而不是在后台找到。
输出{"accepted":true,"issues":[],"coverage":"引用实际可见文字说明事实、必要限定和模拟性质的对应位置","limits":"未看像素图"}；有缺陷则accepted为false且issues为[{"pageId":"页ID","sourceIds":["来源ID"],"problem":"来源要求与可见缺陷","requiredRevision":"修订要求"}]。`;
const expressionV2=positive.expression.replace('本阶段每个block的sourceIds仅从所绑定组已有blocks的sourceIds并集中选取，即使重写或合并也逐块填写。','本阶段每个block的sourceIds仅从所绑定组已有blocks的sourceIds并集中选取。只选择媒介而不改文案时可省略blocks，由程序沿用；一旦重写则完整填写每块text和sourceIds。保留原可见文案的模拟/假设性质及限定。');
export const focused={content:original.content,expression:expressionV2,review:reviewV2,layout:positive.layout};
export const compact={...focused,content:positive.content.replace('让主题覆盖本页全部主体','让主题用约二十字概括本页全部主体，细节条件留在正文').replace('后台narrative仅供规划。','deckBrief、pagePurpose、narrative均不上屏，模拟/假设性质与必要限定须落在claim或blocks中。')};
export const layoutOnly={...original,layout:positive.layout};
export const evidenceReview={...original,review:`你核对灰稿是否忠实表达原稿。仅输出合法JSON。
先建立证据对应，再作结论。source提供待核对事实；visiblePages的claim、heading、body提供实际显示证据，包括灰区实文和蓝区承载文字及制作说明。requirements及其他后台文字只说明意图，不能补足显示内容。本轮蓝区审阅的是图示计划，不要求成品绘图。
从原稿提取会改变理解的事实及限定：对象、数字单位、条件、否定、先后并行、确定程度、模拟或假设性质。对每项找到visiblePages中的原句与所在页；找不到写null。核对可见句的含义是否保持原限定，标题也参与核对。模拟性质不等同于建议语气，适用范围内显示一次即可。
再检查页主题与主体对应、分支归属、条件附着和重复展开。只按具体缺失或矛盾提出修订；容量与像素留给后续检查。
输出{"evidence":[{"sourceFact":"原稿事实及限定","pageId":"页ID或null","visibleQuote":"可见原句或null","consistent":true}],"accepted":true,"issues":[],"coverage":"组织核对结论","limits":"未看像素图"}。缺失证据或含义改变时consistent为false、accepted为false，并在issues中填写{pageId,sourceIds,problem,requiredRevision}。证据引文必须来自visiblePages，不能从source或requirements复制来冒充可见内容。`};
export const bidirectional={...original,review:`你审核灰稿是否忠实且可读。只输出JSON。source是事实依据；visiblePages的claim、heading、body是本轮全部上屏内容，含蓝区承载实文和制作要求。其他字段不上屏。本轮不要求画出图示。
做两个方向的核对：
从原稿到页面：逐项检查事实及适用范围、模拟或假设性质、条件、否定和不确定程度是否有可见承载。列出缺失项；来源引用不能代替显示，未找到相应可见文字就记为缺失。
从页面到原稿：逐句检查每页claim和heading，再检查body。逐一核实其中的比较判断、因果、先后、共同完成门槛及确定程度是否由source支持。标题中的概括也不能新增关系。列出新增或强化项。
最后核对分支归属、条件附着、页主题覆盖和重复展开。灰区文字与蓝区说明都可证明关系，后台职责不能证明。容量与像素不在本轮判断。
输出{"missing":[{"sourceQuote":"来源限定原句","visibleLocation":null}],"unsupported":[{"pageId":"页ID","visibleQuote":"可见原句","reason":"为何来源不支持"}],"accepted":true,"issues":[],"coverage":"组织核对结论","limits":"未看像素图"}。任一missing或unsupported非空，或存在组织缺陷时accepted必须为false，issues逐项填写{pageId,sourceIds,problem,requiredRevision}。缺陷为空才可通过。`};
export const profiles={original,positive,guarded,focused,compact,layoutOnly,evidenceReview,bidirectional};
