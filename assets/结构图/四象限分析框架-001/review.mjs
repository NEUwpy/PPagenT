import { clonePreviewParameters, createVisualComponent } from "../../../src/visual-review/style-group-html.mjs";

export const visualComponent = createVisualComponent("matrix", "matrix-pest-p69");
const shortQuadrants = [
  { title: "政策环境", body: "政策窗口与行业规则" }, { title: "经济环境", body: "成本与市场规模" },
  { title: "社会环境", body: "用户需求与接受度" }, { title: "技术环境", body: "技术成熟度与工具链" },
];
const longQuadrants = [
  { title: "政策环境", body: "关注政策窗口、行业规则以及监管环境的阶段性变化" }, { title: "经济环境", body: "分析成本水平、资金条件和市场规模对项目推进的影响" },
  { title: "社会环境", body: "判断用户需求、组织协同和社会接受度是否形成支撑" }, { title: "技术环境", body: "评估技术成熟度、基础设施和工具链能否稳定承载" },
];
export const previewParameters = Object.freeze({ title: "外部环境分析", quadrants: longQuadrants });
export function resolvePreviewParameters(base, selection) { const result = clonePreviewParameters(base); result.quadrants = clonePreviewParameters(selection.textDensity === "short" ? shortQuadrants : longQuadrants); return result; }
