import { textRegionMarkup } from "../../../src/visual-runtime/text-layout-library.mjs";

const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const COLORS = Object.freeze(["#abc8da", "#8bb2ca", "#699abb", "#4d80a7", "#35688f", "#28557a"]);

function text(value) { return String(value ?? "").trim(); }

function normalize(parameters) {
  if (!Array.isArray(parameters?.inputs) || parameters.inputs.length < 3 || parameters.inputs.length > 6) {
    throw new Error("多路汇聚结果支持 3–6 路输入");
  }
  const inputs = parameters.inputs.map((input, index) => {
    const title = text(input?.title);
    const body = text(input?.body);
    if (!title || [...title].length > 8 || [...body].length > 22) {
      throw new Error(`inputs[${index}] 超出容量`);
    }
    return { key: text(input?.key) || `input-${index + 1}`, title, body };
  });
  const result = {
    title: text(parameters?.result?.title),
    body: text(parameters?.result?.body),
  };
  if (!result.title || [...result.title].length > 10 || [...result.body].length > 28) {
    throw new Error("result 超出容量");
  }
  return { inputs, result };
}

function pathMarkup(index, count) {
  const y = 32 + index * (392 / Math.max(1, count - 1));
  return `<path d="M 318 ${y + 38} C 500 ${y + 38}, 645 246, 862 246" fill="none" stroke="${COLORS[index]}" stroke-width="16" stroke-linecap="round" data-ppt-kind="path" data-ppt-name="merge-lane-${index + 1}"></path>`;
}

function inputMarkup(input, index, count) {
  const top = 22 + index * (392 / Math.max(1, count - 1));
  const slotId = `${input.key}-content`;
  return `<article class="input" style="--top:${top}px;--color:${COLORS[index]}" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-sm" data-ppt-name="merge-input-${index + 1}">
    ${textRegionMarkup({
      id: slotId,
      field: `inputs[${index}]`,
      itemId: input.key,
      regionId: "input",
      layoutId: "heading-content-flow",
      compatibleLayoutIds: ["heading-content-flow", "statement-flow"],
      content: input,
      className: "input-content",
      align: "left",
      valign: "middle",
      density: "compact",
      required: true,
      names: { heading: `merge-input-${index + 1}-title`, body: `merge-input-${index + 1}-body` },
    })}
  </article>`;
}

function resultMarkup(result) {
  return `<article class="result" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-md" data-ppt-name="merge-result">
    ${textRegionMarkup({
      id: "merge-result-content",
      field: "result",
      itemId: "result",
      regionId: "result",
      layoutId: "label-content-flow",
      compatibleLayoutIds: ["label-content-flow", "heading-content-flow", "statement-flow"],
      content: { label: "共同结果", ...result },
      className: "result-content",
      align: "center",
      valign: "middle",
      density: "loose",
      required: true,
      names: { label: "merge-result-label", heading: "merge-result-title", body: "merge-result-body" },
    })}
  </article>`;
}

export const visualComponent = Object.freeze({
  id: "convergence-many-to-one",
  schemaVersion: 6,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textFlow: Object.freeze({ profile: "text-region-layout-library", scope: "per-contiguous-region" }),
  renderMarkup(parameters) {
    const model = normalize(parameters);
    return `<section class="merge" data-ppt-root data-input-count="${model.inputs.length}">
      <svg viewBox="0 0 1170 492" aria-hidden="true">${model.inputs.map((_, index) => pathMarkup(index, model.inputs.length)).join("")}</svg>
      ${model.inputs.map((input, index) => inputMarkup(input, index, model.inputs.length)).join("")}
      ${resultMarkup(model.result)}
    </section>`;
  },
});

export const previewParameters = Object.freeze({
  inputs: Object.freeze([
    Object.freeze({ key: "content", title: "内容需求", body: "事实、叙事与页面目标" }),
    Object.freeze({ key: "logic", title: "逻辑结构", body: "关系类型与内容角色" }),
    Object.freeze({ key: "visual", title: "视觉意图", body: "参考模板的结构精髓" }),
    Object.freeze({ key: "contract", title: "容量契约", body: "数量、字数和失败边界" }),
    Object.freeze({ key: "shell", title: "Shell 规范", body: "标题、页脚与正文空间" }),
    Object.freeze({ key: "quality", title: "质量反馈", body: "审核意见与修正记录" })
  ]),
  result: Object.freeze({ title: "可靠可编辑页面", body: "统一编排并编译为原生 PPTX" }),
});

export function resolvePreviewParameters(base, selection) {
  const inputCount = Number(selection?.inputCount ?? 5);
  if (![3, 4, 5, 6].includes(inputCount)) throw new Error("多路汇聚结果支持 3–6 路输入");
  const result = structuredClone(base);
  result.inputs = result.inputs.slice(0, inputCount);
  return result;
}
