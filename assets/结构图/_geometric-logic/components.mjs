const FRAME = Object.freeze({ width: 1170, height: 492 });

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
})[char]);

const clone = (value) => structuredClone(value);
const take = (items, count) => clone(items).slice(0, Number(count));
const BRANCH_TONES = Object.freeze([
  Object.freeze({ dark: "#28557a", light: "#4d80a7" }),
  Object.freeze({ dark: "#35688f", light: "#699abb" }),
  Object.freeze({ dark: "#4d80a7", light: "#8bb2ca" }),
  Object.freeze({ dark: "#699abb", light: "#abc8da" }),
  Object.freeze({ dark: "#8bb2ca", light: "#c4d9e5" }),
  Object.freeze({ dark: "#abc8da", light: "#dce8ef" }),
]);
const slot = (field, value, tag = "span", role = "text") =>
  `<${tag} data-slot-id="${esc(field)}" data-slot-role="${esc(role)}" data-slot-field="${esc(field)}" data-slot-content-type="text">${esc(value)}</${tag}>`;

const BASE_STYLE = `
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}body{font-family:var(--ppagent-font-body,"Microsoft YaHei"),sans-serif;background:transparent;color:#25435d}
.geo{position:relative;width:1170px;height:492px;overflow:hidden;background:transparent}
.geo svg{position:absolute;inset:0;width:1170px;height:492px;overflow:visible}
.geo .path{fill:none;stroke-linecap:round;stroke-linejoin:round}
.geo .soft{fill:#f3f6f8;stroke:#dce5eb;stroke-width:1.2}
.geo .paper{background:#fff;border:1px solid #dfe7ec;border-radius:14px;box-shadow:0 8px 20px rgba(35,72,103,.08)}
.geo .anchor{display:flex;align-items:center;justify-content:center;text-align:center;color:#fff;font-weight:700;line-height:1.35;background:linear-gradient(135deg,#285f89,#4f86ac);box-shadow:0 12px 25px rgba(40,91,130,.18)}
.geo h3,.geo p{margin:0}.geo small{font-size:10.5pt;letter-spacing:.08em;color:#7890a2}
`;

function component(id, extraCss, render, preview, resolve) {
  return Object.freeze({
    visualComponent: Object.freeze({
      id,
      schemaVersion: 6,
      designFrame: FRAME,
      cssFile: "component.css",
      renderMarkup(parameters) {
        return `<style>${BASE_STYLE}${extraCss}</style>${render(parameters)}`;
      },
    }),
    previewParameters: Object.freeze(preview),
    resolvePreviewParameters: resolve,
  });
}

const rejoinCss = `
.rejoin .endpoint{position:absolute;z-index:3;top:171px;width:176px;height:150px;border-radius:75px;padding:26px 20px}.rejoin .start{left:15px}.rejoin .result{right:15px;background:linear-gradient(135deg,#a76142,#d08a62)}
.rejoin .endpoint small{display:block;color:rgba(255,255,255,.7);margin-bottom:9px}.rejoin .endpoint p{font-size:16pt}
.rejoin .route{position:absolute;z-index:4;left:392px;width:386px;transform:translateY(-50%);padding:12px 18px 12px 58px;min-height:67px}
.rejoin .route b{position:absolute;left:14px;top:14px;width:36px;height:36px;border-radius:18px;background:var(--tone);color:#fff;text-align:center;line-height:36px;font-size:12pt}.rejoin .route h3{font-size:15.5pt;color:var(--tone);margin-bottom:3px}.rejoin .route p{font-size:12.5pt;color:#5e707e;line-height:1.35}
`;
function renderRejoin(p) {
  const routes = p.routes ?? [];
  const ys = Array.from({ length: routes.length }, (_, i) => 70 + i * (352 / Math.max(1, routes.length - 1)));
  const paths = ys.map((y, i) => { const tone = BRANCH_TONES[i]; return `<path class="path" d="M170 246 C270 246 292 ${y} 410 ${y} L760 ${y} C878 ${y} 900 246 1000 246" stroke="url(#r${i})" stroke-width="${14 - i * .6}"/><linearGradient id="r${i}" gradientUnits="userSpaceOnUse" x1="170" y1="${y}" x2="1000" y2="${y}"><stop stop-color="${tone.dark}"/><stop offset="1" stop-color="${tone.light}"/></linearGradient>`; }).join("");
  return `<section class="geo rejoin" data-ppt-root data-route-count="${routes.length}"><svg viewBox="0 0 1170 492">${paths}</svg><article class="endpoint start anchor"><div><small>共同起点</small>${slot("start", p.start, "p", "start")}</div></article>${routes.map((r, i) => `<article class="route paper" style="top:${ys[i]}px;--tone:${BRANCH_TONES[i].dark}"><b>${String(i + 1).padStart(2, "0")}</b>${slot(`routes[${i}].title`, r.title, "h3", "route-title")}${slot(`routes[${i}].body`, r.body, "p", "route-body")}</article>`).join("")}<article class="endpoint result anchor"><div><small>共同结果</small>${slot("result", p.result, "p", "result")}</div></article></section>`;
}
export const geometricBranchingRejoin = component("branching-rejoin-routes", rejoinCss, renderRejoin, {
  start: "形成明确的研究问题",
  routes: [
    { title: "文献路径", body: "梳理理论脉络与证据缺口" },
    { title: "数据路径", body: "用同条件样本完成实证分析" },
    { title: "访谈路径", body: "补充机制解释与情境边界" },
    { title: "仿真路径", body: "在控制条件下检验关键假设" },
  ],
  result: "形成可检验的综合结论",
}, (base, state) => ({ ...clone(base), routes: take(base.routes, state?.routeCount ?? 3) }));

const decisionTreeCss = `
.decision-tree .root{position:absolute;z-index:4;left:425px;top:16px;width:320px;height:78px;border-radius:39px;font-size:16pt}.decision-tree .decision{position:absolute;z-index:4;top:174px;transform:translateX(-50%);width:240px;min-height:76px;padding:12px 16px;text-align:center}.decision-tree .decision h3{font-size:14.5pt;color:#285777}.decision-tree .decision small{display:block;margin-bottom:5px}.decision-tree .leaf{position:absolute;z-index:4;top:382px;transform:translateX(-50%);width:132px;min-height:62px;padding:13px 10px;text-align:center;background:#f3f6f8;border-radius:12px;color:#425d71;font-size:12pt;font-weight:600}.decision-tree .leaf.no{background:#f7f0ec;color:#765440}
`;
function renderDecisionTree(p) {
  const branches = p.branches ?? [];
  const xs = Array.from({ length: branches.length }, (_, i) => 225 + i * (720 / Math.max(1, branches.length - 1)));
  const gradients = branches.map((_, i) => `<linearGradient id="dt${i}" gradientUnits="userSpaceOnUse" x1="585" y1="90" x2="${xs[i]}" y2="174"><stop stop-color="${BRANCH_TONES[i].dark}"/><stop offset="1" stop-color="${BRANCH_TONES[i].light}"/></linearGradient>`).join("");
  const paths = branches.map((_, i) => `<path class="path" d="M585 90 C585 128 ${xs[i]} 126 ${xs[i]} 174" stroke="url(#dt${i})" stroke-width="13"/><path class="path" d="M${xs[i]} 250 C${xs[i]} 300 ${xs[i] - 75} 314 ${xs[i] - 75} 382" stroke="${BRANCH_TONES[i].dark}" stroke-width="9"/><path class="path" d="M${xs[i]} 250 C${xs[i]} 300 ${xs[i] + 75} 314 ${xs[i] + 75} 382" stroke="${BRANCH_TONES[i].light}" stroke-width="9"/>`).join("");
  return `<section class="geo decision-tree" data-ppt-root data-branch-count="${branches.length}"><svg viewBox="0 0 1170 492"><defs>${gradients}</defs>${paths}</svg><div class="root anchor">${slot("root", p.root, "span", "root")}</div>${branches.map((b, i) => `<article class="decision paper" style="left:${xs[i]}px"><small>判断 ${String(i + 1).padStart(2, "0")}</small>${slot(`branches[${i}].decision`, b.decision, "h3", "decision")}</article>${(b.outcomes ?? []).map((outcome, j) => `<article class="leaf ${j ? "no" : "yes"}" style="left:${xs[i] + (j ? 75 : -75)}px">${slot(`branches[${i}].outcomes[${j}]`, outcome, "span", "outcome")}</article>`).join("")}`).join("")}</section>`;
}
export const geometricBranchingMultilevel = component("branching-multilevel-tree", decisionTreeCss, renderDecisionTree, {
  root: "哪种生成路径更适合当前页面",
  branches: [
    { decision: "是否有成熟结构资产", outcomes: ["调用已审核结构", "退化为简洁排版"] },
    { decision: "是否具备必要媒体", outcomes: ["启用媒体结构", "选择无媒体结构"] },
    { decision: "内容是否满足容量", outcomes: ["按原结构填充", "重新拆页或换组"] },
  ],
}, (base, state) => ({ ...clone(base), branches: take(base.branches, state?.branchCount ?? 3) }));

const scenarioCss = `
.scenario .assumption{position:absolute;z-index:4;left:395px;top:20px;width:380px;height:76px;border-radius:38px;padding:0 30px;background:#285f89;font-size:16pt}.scenario .scenario-card{position:absolute;z-index:4;top:278px;transform:translateX(-50%);width:200px;min-height:148px;padding:18px 16px 14px}.scenario .scenario-card-surface{position:absolute;z-index:0;inset:0;border:1px solid #dfe7ec;border-radius:14px;background:#fff;box-shadow:0 8px 20px rgba(35,72,103,.08)}.scenario .scenario-card-accent{position:absolute;z-index:1;left:0;right:0;top:0;height:6px;border-radius:3px;background:var(--tone)}.scenario .scenario-card small,.scenario .scenario-card h3,.scenario .scenario-card p{position:relative;z-index:2}.scenario .scenario-card small{display:block;margin-bottom:7px;color:var(--tone)}.scenario .scenario-card h3{font-size:14pt;color:#2c5573;margin-bottom:12px}.scenario .scenario-card p{font-size:12pt;color:#5a6e7d;line-height:1.4;margin-top:5px}.scenario .scenario-card b{color:#315f7f}
`;
function renderScenario(p) {
  const scenarios = p.scenarios ?? [];
  const xs = Array.from({ length: scenarios.length }, (_, i) => 120 + i * (930 / Math.max(1, scenarios.length - 1)));
  const tones = BRANCH_TONES.map((tone) => tone.dark);
  const paths = scenarios.map((_, i) => `<path class="path" d="M585 96 C585 170 ${xs[i]} 174 ${xs[i]} 278" stroke="${tones[i]}" stroke-width="${13 - i * .5}" data-ppt-kind="path" data-ppt-name="scenario-path-${i}"/>`).join("");
  const text = (field, value, tag, role, name, maxChars, maxLines = 1) => `<${tag} data-slot-id="${esc(field)}" data-slot-role="${esc(role)}" data-slot-field="${esc(field)}" data-slot-content-type="text" data-slot-required="true" data-slot-max-chars="${maxChars}" data-slot-max-lines="${maxLines}" data-slot-text-mode="${maxLines > 1 ? "flow" : "single-line"}" data-ppt-kind="text" data-ppt-name="${esc(name)}">${esc(value)}</${tag}>`;
  return `<section class="geo scenario" data-ppt-root data-scenario-count="${scenarios.length}"><svg viewBox="0 0 1170 492">${paths}</svg><div class="assumption anchor" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-sm" data-ppt-name="scenario-assumption-surface">${text("assumption", p.assumption, "span", "assumption", "scenario-assumption", 30, 2)}</div>${scenarios.map((s, i) => `<article class="scenario-card" style="left:${xs[i]}px;--tone:${tones[i]}"><div class="scenario-card-surface" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-sm" data-ppt-name="scenario-card-surface-${i}"></div><i class="scenario-card-accent" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="scenario-card-accent-${i}"></i><small data-ppt-kind="text" data-ppt-name="scenario-index-${i}">SCENARIO ${String(i + 1).padStart(2, "0")}</small>${text(`scenarios[${i}].title`, s.title, "h3", "scenario-title", `scenario-title-${i}`, 8)}${text(`scenarios[${i}].trigger`, `触发：${s.trigger}`, "p", "trigger", `scenario-trigger-${i}`, 19, 2)}${text(`scenarios[${i}].outcome`, `结果：${s.outcome}`, "p", "outcome", `scenario-outcome-${i}`, 19, 2)}</article>`).join("")}</section>`;
}
export const geometricBranchingScenario = component("branching-scenario-fan", scenarioCss, renderScenario, {
  assumption: "未来稿件复杂度与资产覆盖度存在不确定性",
  scenarios: [
    { title: "稳定扩张", trigger: "需求集中于已覆盖逻辑", outcome: "持续复用核心结构组" },
    { title: "快速增长", trigger: "新场景集中出现", outcome: "并行建设候选资产" },
    { title: "质量受压", trigger: "内容经常越过容量", outcome: "加强拆页与回调机制" },
    { title: "结构短缺", trigger: "出现新型表达关系", outcome: "退化排版并发起蒸馏" },
    { title: "生态开放", trigger: "外部组件质量成熟", outcome: "纳入统一审核与编译" },
  ],
}, (base, state) => ({ ...clone(base), scenarios: take(base.scenarios, state?.scenarioCount ?? 4) }));

const probabilityCss = `
.probability .root{position:absolute;z-index:4;left:425px;top:18px;width:320px;height:72px;border-radius:36px;font-size:15pt}.probability .branch-card{position:absolute;z-index:4;top:177px;transform:translateX(-50%);width:230px;padding:12px 16px;text-align:center}.probability .branch-card h3{font-size:14pt;color:#285777}.probability .branch-card strong{display:inline-block;margin-top:6px;color:#6a92ac;font-size:12pt}.probability .prob-leaf{position:absolute;z-index:4;top:382px;transform:translateX(-50%);width:126px;min-height:58px;padding:12px 8px;border-radius:12px;background:#f3f6f8;text-align:center;color:#455d70;font-size:11.5pt}.probability .prob-leaf.alt{background:#f7f0ec}
`;
function renderProbability(p) {
  const branches = p.branches ?? [];
  const xs = Array.from({ length: branches.length }, (_, i) => 255 + i * (660 / Math.max(1, branches.length - 1)));
  const paths = branches.map((_, i) => `<path class="path" d="M585 90 C585 132 ${xs[i]} 132 ${xs[i]} 177" stroke="${BRANCH_TONES[i].dark}" stroke-width="12"/><path class="path" d="M${xs[i]} 253 C${xs[i]} 305 ${xs[i] - 70} 315 ${xs[i] - 70} 382" stroke="${BRANCH_TONES[i].dark}" stroke-width="8"/><path class="path" d="M${xs[i]} 253 C${xs[i]} 305 ${xs[i] + 70} 315 ${xs[i] + 70} 382" stroke="${BRANCH_TONES[i].light}" stroke-width="8"/>`).join("");
  return `<section class="geo probability" data-ppt-root data-branch-count="${branches.length}"><svg viewBox="0 0 1170 492">${paths}</svg><div class="root anchor">${slot("root", p.root, "span", "root")}</div>${branches.map((b, i) => `<article class="branch-card paper" style="left:${xs[i]}px">${slot(`branches[${i}].title`, b.title, "h3", "scenario")}${slot(`branches[${i}].probability`, b.probability, "strong", "probability")}</article>${(b.outcomes ?? []).map((v, j) => `<article class="prob-leaf ${j ? "alt" : ""}" style="left:${xs[i] + (j ? 70 : -70)}px">${slot(`branches[${i}].outcomes[${j}]`, v, "span", "outcome")}</article>`).join("")}`).join("")}</section>`;
}
export const geometricBranchingProbability = component("branching-probability-tree", probabilityCss, renderProbability, {
  root: "未来一个季度的需求变化",
  branches: [
    { title: "需求稳定", probability: "45%", outcomes: ["复用现有结构", "小幅优化组件"] },
    { title: "需求增长", probability: "35%", outcomes: ["并行蒸馏资产", "扩充逻辑覆盖"] },
    { title: "需求突变", probability: "20%", outcomes: ["启用简洁兜底", "建立新逻辑定义"] },
  ],
}, (base, state) => ({ ...clone(base), branches: take(base.branches, state?.branchCount ?? 3) }));

const decisionTableCss = `
.rule-loom{padding:24px 30px}.rule-loom .condition-labels{position:absolute;left:22px;top:94px;width:220px}.rule-loom .condition-labels div{height:64px;display:flex;align-items:center;padding-left:18px;border-bottom:1px solid #e3eaee;color:#435d70;font-size:13pt}.rule-loom .rules{position:absolute;left:260px;right:20px;top:20px;height:448px;display:grid;grid-template-columns:repeat(var(--rules),1fr);gap:12px}.rule-loom .rule{position:relative;text-align:center}.rule-loom .rule h3{height:54px;padding-top:13px;border-radius:27px;background:var(--tone);color:#fff;font-size:13.5pt}.rule-loom .rail{position:absolute;left:50%;top:60px;bottom:82px;width:8px;transform:translateX(-50%);border-radius:4px;background:linear-gradient(var(--tone),var(--light))}.rule-loom .marks{position:absolute;left:0;right:0;top:74px}.rule-loom .mark{height:64px;display:flex;align-items:center;justify-content:center}.rule-loom .mark span{position:relative;z-index:2;width:34px;height:34px;border-radius:17px;background:#fff;border:3px solid var(--tone);color:var(--tone);line-height:27px;font-weight:700}.rule-loom .mark .no{border-style:dashed;opacity:.7}.rule-loom .action{position:absolute;left:4px;right:4px;bottom:0;min-height:68px;padding:14px 8px;border-radius:14px;background:#f3f5f3;color:#53616a;font-size:12pt;font-weight:700;display:flex;align-items:center;justify-content:center}
`;
function renderDecisionTable(p) {
  const conditions = p.conditions ?? [], rules = p.rules ?? [];
  return `<section class="geo rule-loom" data-ppt-root style="--rules:${rules.length}"><div class="condition-labels"><div><strong>条件组合</strong></div>${conditions.map((c, i) => `<div>${slot(`conditions[${i}]`, c, "span", "condition")}</div>`).join("")}<div><strong>执行动作</strong></div></div><div class="rules">${rules.map((r, i) => `<article class="rule" style="--tone:${BRANCH_TONES[i].dark};--light:${BRANCH_TONES[i].light}"><h3>规则 ${String(i + 1).padStart(2, "0")}</h3><div class="rail"></div><div class="marks">${conditions.map((_, j) => `<div class="mark"><span class="${r.when?.[j] ? "yes" : "no"}">${r.when?.[j] ? "是" : "否"}</span></div>`).join("")}</div><div class="action">${slot(`rules[${i}].action`, r.action, "span", "action")}</div></article>`).join("")}</div></section>`;
}
export const geometricBranchingDecisionTable = component("branching-decision-table", decisionTableCss, renderDecisionTable, {
  conditions: ["已有合适结构", "内容满足容量", "必要媒体齐全", "用户已审核"],
  rules: [
    { when: [true, true, true, true], action: "正式调用" },
    { when: [true, false, true, true], action: "拆页或换组" },
    { when: [true, true, false, true], action: "选择无媒体组" },
    { when: [false, true, true, false], action: "简洁兜底" },
    { when: [false, false, false, false], action: "发起资产建设" },
  ],
}, (base, state) => {
  const result = clone(base);
  result.conditions = result.conditions.slice(0, Number(state?.conditionCount ?? 3));
  result.rules = result.rules.slice(0, Number(state?.ruleCount ?? 4)).map((rule) => ({ ...rule, when: rule.when.slice(0, result.conditions.length) }));
  return result;
});

const authorityCss = `
.authority{padding:20px 75px}.authority .tiers{height:452px;display:flex;flex-direction:column;justify-content:center;gap:9px}.authority .tier{height:var(--h);margin:0 auto;display:grid;grid-template-columns:170px 1fr;align-items:center;padding:0 28px 0 40px;clip-path:polygon(4% 0,96% 0,100% 50%,96% 100%,4% 100%,0 50%);background:linear-gradient(90deg,var(--tone),#d9e7ef)}.authority .tier h3{color:#fff;font-size:14pt}.authority .roles{display:flex;gap:9px}.authority .roles span{flex:1;min-width:0;padding:10px 8px;border-radius:9px;background:rgba(255,255,255,.92);text-align:center;color:#4c6170;font-size:11.5pt;box-shadow:0 3px 8px rgba(48,81,103,.06)}
`;
function renderAuthority(p) {
  const tiers = p.tiers ?? [], tones = BRANCH_TONES.map((tone) => tone.dark);
  return `<section class="geo authority" data-ppt-root data-tier-count="${tiers.length}"><div class="tiers">${tiers.map((tier, i) => `<article class="tier" style="width:${690 + i * 74}px;--h:${Math.min(86, 410 / tiers.length)}px;--tone:${tones[i]}">${slot(`tiers[${i}].name`, tier.name, "h3", "tier")}<div class="roles">${(tier.roles ?? []).map((role, j) => slot(`tiers[${i}].roles[${j}]`, role, "span", "role")).join("")}</div></article>`).join("")}</div></section>`;
}
export const geometricHierarchyAuthority = component("hierarchy-tiered-authority", authorityCss, renderAuthority, {
  tiers: [
    { name: "决策层", roles: ["产品负责人"] },
    { name: "编排层", roles: ["内容导演", "视觉导演"] },
    { name: "执行层", roles: ["组件运行时", "原生编译", "质量检查"] },
    { name: "资产层", roles: ["Skin", "Composition", "Visual Skill"] },
    { name: "来源层", roles: ["稿件", "模板", "媒体"] },
  ],
}, (base, state) => ({ ...clone(base), tiers: take(base.tiers, state?.tierCount ?? 4) }));

const pyramidCss = `
.concept-pyramid{padding:14px 18px}.concept-pyramid .level{position:absolute;left:80px;top:var(--top);width:var(--w);height:var(--h);display:flex;align-items:center;justify-content:center;clip-path:polygon(7% 0,93% 0,100% 100%,0 100%);background:linear-gradient(90deg,var(--tone),var(--tone2));color:#fff;font-size:15.5pt;font-weight:700}.concept-pyramid .note{position:absolute;left:650px;top:var(--top);height:var(--h);width:455px;display:flex;align-items:center;gap:15px;border-bottom:1px solid #e0e7ec}.concept-pyramid .note b{width:42px;color:#86a3b7;font-size:13pt}.concept-pyramid .note span{color:#4b6070;font-size:13pt}
`;
function renderPyramid(p) {
  const levels = p.levels ?? [], h = 440 / levels.length;
  const tones = BRANCH_TONES.map((tone) => [tone.dark, tone.light]);
  return `<section class="geo concept-pyramid" data-ppt-root data-level-count="${levels.length}">${levels.map((level, i) => { const w = 290 + i * 72, top = 18 + i * h; return `<div class="level" style="--top:${top}px;--h:${h - 5}px;--w:${w}px;--tone:${tones[i][0]};--tone2:${tones[i][1]}">${slot(`levels[${i}].title`, level.title, "span", "level-title")}</div><article class="note" style="--top:${top}px;--h:${h - 5}px"><b>${String(i + 1).padStart(2, "0")}</b>${slot(`levels[${i}].body`, level.body, "span", "level-body")}</article>`; }).join("")}</section>`;
}
export const geometricHierarchyPyramid = component("hierarchy-concept-pyramid", pyramidCss, renderPyramid, {
  levels: [
    { title: "愿景层", body: "定义长期方向与价值边界" },
    { title: "战略层", body: "选择关键路径与资源配置" },
    { title: "能力层", body: "形成支撑战略的核心能力" },
    { title: "执行层", body: "把能力落实到任务与动作" },
    { title: "基础层", body: "提供制度、数据与资源底座" },
  ],
}, (base, state) => ({ ...clone(base), levels: take(base.levels, state?.levelCount ?? 4) }));

const cascadeCss = `
.cascade{padding:18px 40px}.cascade .row{position:absolute;left:50%;top:var(--top);transform:translateX(-50%);width:var(--w);height:var(--h);display:grid;grid-template-columns:118px 1fr;align-items:center;padding:0 24px;clip-path:polygon(3% 0,97% 0,100% 50%,97% 100%,3% 100%,0 50%);background:linear-gradient(90deg,var(--tone),#dbe8ef)}.cascade .row h3{color:#fff;font-size:14pt}.cascade .values{display:flex;gap:8px}.cascade .values span{flex:1;min-width:0;padding:10px 7px;border-radius:8px;background:rgba(255,255,255,.94);text-align:center;color:#465f71;font-size:10.8pt}.cascade .spine{position:absolute;left:581px;top:35px;width:8px;height:420px;border-radius:4px;background:linear-gradient(#275f89,#9ab8c8);opacity:.22}
`;
function renderCascade(p) {
  const rows = [
    ["目标", [p.goal], "goal"],
    ["策略", p.strategies ?? [], "strategies"],
    ["举措", p.initiatives ?? [], "initiatives"],
    ["任务", p.tasks ?? [], "tasks"],
  ];
  const tones = BRANCH_TONES.map((tone) => tone.dark);
  return `<section class="geo cascade" data-ppt-root><div class="spine"></div>${rows.map((row, i) => `<article class="row" style="--top:${18 + i * 115}px;--w:${690 + i * 118}px;--h:94px;--tone:${tones[i]}"><h3>${row[0]}</h3><div class="values">${row[1].map((value, j) => slot(`${row[2]}[${j}]`, value, "span", row[2])).join("")}</div></article>`).join("")}</section>`;
}
export const geometricHierarchyCascade = component("hierarchy-goal-cascade", cascadeCss, renderCascade, {
  goal: "可靠生成固定场景 PPTX",
  strategies: ["视觉计算前移", "运行期合法选择", "统一原生编译", "数据驱动迭代"],
  initiatives: ["建设逻辑覆盖库", "声明容量与槽位", "建立导演反馈", "完善看板审核", "沉淀失败边界"],
  tasks: ["蒸馏模板", "扩散状态", "验证边界", "用户确认", "登记核心库", "运行评估"],
}, (base, state) => {
  const count = Number(state?.strategyCount ?? 3), result = clone(base);
  result.strategies = result.strategies.slice(0, count);
  result.initiatives = result.initiatives.slice(0, count + 1);
  result.tasks = result.tasks.slice(0, count + 2);
  return result;
});

const directedHubCss = `
.directed-hub .driver{position:absolute;z-index:4;left:455px;top:158px;width:260px;height:176px;border-radius:88px;padding:28px 32px}.directed-hub .driver h3{font-size:18pt;margin-bottom:8px}.directed-hub .driver p{font-size:12.5pt;font-weight:400;color:#dfeaf1;line-height:1.4}
.directed-hub .outcome{position:absolute;z-index:4;transform:translate(-50%,-50%);width:216px;min-height:82px;padding:13px 15px 12px 20px;border-left:7px solid var(--tone)}.directed-hub .outcome h3{font-size:14.5pt;color:var(--tone);margin-bottom:4px}.directed-hub .outcome p{font-size:11.5pt;color:#5c707e;line-height:1.35}
`;
function renderDirectedHub(p) {
  const items = p.items ?? [], centerX = 585, centerY = 246;
  const rx = items.length === 4 ? 420 : 445, ry = items.length === 4 ? 175 : 188;
  const offset = items.length === 4 ? -135 : -90;
  const positions = items.map((_, i) => {
    const angle = (offset + i * 360 / items.length) * Math.PI / 180;
    return { x: centerX + Math.cos(angle) * rx, y: centerY + Math.sin(angle) * ry };
  });
  const defs = items.map((_, i) => `<marker id="hubArrow${i}" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L8,3 z" fill="${BRANCH_TONES[i].dark}"/></marker>`).join("");
  const paths = positions.map((point, i) => `<path class="path" d="M${centerX} ${centerY} C${centerX + (point.x - centerX) * .38} ${centerY},${centerX + (point.x - centerX) * .68} ${point.y},${point.x} ${point.y}" stroke="${BRANCH_TONES[i].dark}" stroke-width="10" marker-end="url(#hubArrow${i})"/>`).join("");
  return `<section class="geo directed-hub" data-ppt-root data-item-count="${items.length}"><svg viewBox="0 0 1170 492"><defs>${defs}</defs>${paths}</svg><article class="driver anchor">${slot("center.title", p.center?.title, "h3", "center-title")}${slot("center.body", p.center?.body, "p", "center-body")}</article>${items.map((item, i) => `<article class="outcome paper" style="left:${positions[i].x}px;top:${positions[i].y}px;--tone:${BRANCH_TONES[i].dark}">${slot(`items[${i}].title`, item.title, "h3", "outcome-title")}${slot(`items[${i}].body`, item.body, "p", "outcome-body")}</article>`).join("")}</section>`;
}
export const geometricHubDirected = component("hub-directed-outcomes", directedHubCss, renderDirectedHub, {
  center: { title: "响应式引擎", body: "统一求解结构与内容边界" },
  items: [
    { title: "输出可靠", body: "减少随机排版与结构误用" },
    { title: "原生可编", body: "形状和文字均能继续编辑" },
    { title: "生成高效", body: "运行期只做选择与参数填写" },
    { title: "数量适配", body: "按真实内容重新求解布局" },
    { title: "风格一致", body: "共享同一 Shell 与视觉语言" },
    { title: "过程可审", body: "来源组件结果统一查看" },
  ],
}, (base, state) => ({ ...clone(base), items: take(base.items, state?.itemCount ?? 6) }));
