import { textRegionMarkup } from "../../../src/visual-runtime/text-layout-library.mjs";

const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const TONES = Object.freeze([
  Object.freeze({ dark: "#28557a", light: "#4d80a7", facet: "#6d9abb" }),
  Object.freeze({ dark: "#35688f", light: "#699abb", facet: "#87aec7" }),
  Object.freeze({ dark: "#4d80a7", light: "#8bb2ca", facet: "#a8c7d9" }),
  Object.freeze({ dark: "#699abb", light: "#abc8da", facet: "#c1d7e4" }),
]);

function text(value) { return String(value ?? "").trim(); }

function requireText(value, field, maxChars) {
  const normalized = text(value);
  if (!normalized) throw new Error(`${field} 不能为空`);
  if ([...normalized].length > maxChars) throw new Error(`${field} 不得超过 ${maxChars} 字`);
  return normalized;
}

function normalize(parameters) {
  const root = requireText(parameters?.root, "root", 20);
  if (!Array.isArray(parameters?.packages) || parameters.packages.length < 2 || parameters.packages.length > 4) throw new Error("不均衡任务分解树支持 2–4 个工作包");
  const packages = parameters.packages.map((item, packageIndex) => {
    const title = requireText(item?.title, `packages[${packageIndex}].title`, 10);
    if (!Array.isArray(item?.tasks) || item.tasks.length < 1 || item.tasks.length > 4) throw new Error(`packages[${packageIndex}].tasks 必须包含 1–4 项任务`);
    const tasks = item.tasks.map((task, taskIndex) => requireText(task, `packages[${packageIndex}].tasks[${taskIndex}]`, 14));
    return { key: text(item?.key) || `package-${packageIndex + 1}`, title, tasks };
  });
  const textLayoutBindings = parameters?.textLayoutBindings && typeof parameters.textLayoutBindings === "object" ? { ...parameters.textLayoutBindings } : {};
  return { root, packages, textLayoutBindings };
}

function selectedLayout(bindings, regionId, fallback) { return text(bindings?.[regionId]) || fallback; }

function layoutForCount(count) {
  if (count === 2) return { top: 61, height: 174, gap: 22 };
  if (count === 3) return { top: 23, height: 140, gap: 13 };
  return { top: 13, height: 107, gap: 12 };
}

function connectorMarkup(centerY, index) {
  const tone = TONES[index];
  const bendX = 244 + index * 6;
  return `<path d="M 190 246 C ${bendX} 246, ${bendX} ${centerY}, 326 ${centerY}" fill="none" stroke="${tone.light}" stroke-width="8" stroke-linecap="round" data-ppt-kind="path" data-ppt-name="wbs-branch-${index + 1}"></path>`;
}

function rootMarkup(root, textLayoutBindings) {
  const regionId = "root-content";
  return `<article class="root-anchor">
    <div class="root-ribbon" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-sm" data-ppt-name="wbs-root">
      ${textRegionMarkup({ id: regionId, field: "root", itemId: "root", regionId: "root", layoutId: selectedLayout(textLayoutBindings, regionId, "statement-flow"), compatibleLayoutIds: ["statement-flow"], content: { title: root }, className: "root-content", align: "center", valign: "middle", density: "compact", required: true, names: { heading: "wbs-root-title" } })}
    </div>
  </article>`;
}

function ribbonMarkup(item, index, textLayoutBindings) {
  const tone = TONES[index];
  const regionId = `package-${index + 1}-title`;
  return `<div class="package-ribbon" style="--tone:${tone.dark}" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-sm" data-ppt-name="wbs-package-${index + 1}">
    ${textRegionMarkup({ id: regionId, field: `packages[${index}].title`, itemId: item.key, regionId: "title", layoutId: selectedLayout(textLayoutBindings, regionId, "statement-flow"), compatibleLayoutIds: ["statement-flow"], content: { title: item.title }, className: "package-title-region", align: "center", valign: "middle", density: "compact", required: true, names: { heading: `wbs-package-${index + 1}-title` } })}
  </div>`;
}

function taskMarkup(item, index, textLayoutBindings) {
  const regionId = `package-${index + 1}-tasks`;
  return `<div class="task-surface" data-task-count="${item.tasks.length}" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-sm" data-ppt-name="wbs-task-surface-${index + 1}">
    <div class="task-rule" style="--tone:${TONES[index].light}" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="wbs-task-rule-${index + 1}"></div>
    ${textRegionMarkup({ id: regionId, field: `packages[${index}].tasks`, itemId: item.key, regionId: "tasks", layoutId: selectedLayout(textLayoutBindings, regionId, "heading-content-flow"), compatibleLayoutIds: ["heading-content-flow"], content: { points: item.tasks, listMarker: "bullet" }, className: "task-region", align: "left", valign: "middle", density: "compact", required: true, names: { list: `wbs-package-${index + 1}-task` } })}
  </div>`;
}

function packageMarkup(item, index, geometry, textLayoutBindings) {
  const top = geometry.top + index * (geometry.height + geometry.gap);
  return `<article class="package-row" style="--top:${top}px;--row-height:${geometry.height}px" data-package-index="${index}" data-task-count="${item.tasks.length}">${taskMarkup(item, index, textLayoutBindings)}${ribbonMarkup(item, index, textLayoutBindings)}</article>`;
}

export const visualComponent = Object.freeze({
  id: "hierarchy-unbalanced-wbs",
  schemaVersion: 6,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textFlow: Object.freeze({ profile: "text-region-layout-library", scope: "per-contiguous-region" }),
  renderMarkup(parameters) {
    const model = normalize(parameters);
    const geometry = layoutForCount(model.packages.length);
    const centers = model.packages.map((_, index) => geometry.top + index * (geometry.height + geometry.gap) + geometry.height / 2);
    return `<section class="wbs-review" data-ppt-root data-package-count="${model.packages.length}"><svg class="connector-field" viewBox="0 0 1170 492" aria-hidden="true">${centers.map((centerY, index) => connectorMarkup(centerY, index)).join("")}</svg>${rootMarkup(model.root, model.textLayoutBindings)}${model.packages.map((item, index) => packageMarkup(item, index, geometry, model.textLayoutBindings)).join("")}</section>`;
  },
});

export const previewParameters = Object.freeze({
  root: "建立可靠的 Visual Skill",
  packages: Object.freeze([
    Object.freeze({ key: "distill", title: "来源蒸馏", tasks: Object.freeze(["筛选参考页", "提取结构精髓", "建立黄金状态"]) }),
    Object.freeze({ key: "expand", title: "组件扩散", tasks: Object.freeze(["扩散数量状态", "声明容量边界"]) }),
    Object.freeze({ key: "review", title: "审核与入库", tasks: Object.freeze(["HTML 审美审核", "边界状态检查", "原生可编辑检查", "用户确认入库"]) }),
    Object.freeze({ key: "feedback", title: "运行反馈", tasks: Object.freeze(["记录真实缺口"]) }),
  ]),
});

export function resolvePreviewParameters(base, selection) {
  const packageCount = Number(selection?.packageCount ?? 3);
  if (![2, 3, 4].includes(packageCount)) throw new Error("不均衡任务分解树支持 2、3 或 4 个工作包");
  const result = structuredClone(base);
  result.packages = result.packages.slice(0, packageCount);
  return result;
}
