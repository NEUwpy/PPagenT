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

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function resolveConvergenceLayout(frame = DESIGN_FRAME, count = 5) {
  const width = Number(frame?.width ?? DESIGN_FRAME.width);
  const height = Number(frame?.height ?? DESIGN_FRAME.height);
  if (width === DESIGN_FRAME.width && height === DESIGN_FRAME.height) {
    return {
      frame: { width, height },
      inputLeft: 8,
      inputWidth: 310,
      inputHeight: count === 6 ? 66 : 78,
      inputTop: 22,
      inputArea: 392,
      resultRight: 8,
      resultTop: 116,
      resultWidth: 300,
      resultHeight: 260,
      pathWidth: 16,
      adaptive: false,
    };
  }
  const resultWidth = clamp(width * 0.26, 210, 300);
  const inputWidth = clamp(width * 0.265, 190, 310);
  const inputHeight = clamp(height * (count >= 6 ? 0.135 : 0.16), 58, 78);
  const inputTop = clamp(height * 0.05, 12, 22);
  const resultHeight = clamp(height * 0.52, 180, 260);
  const resultTop = (height - resultHeight) / 2;
  return {
    frame: { width, height },
    inputLeft: Math.max(6, width * 0.012),
    inputWidth,
    inputHeight,
    inputTop,
    inputArea: Math.max(inputHeight, height - inputTop * 2 - inputHeight),
    resultRight: Math.max(6, width * 0.012),
    resultTop,
    resultWidth,
    resultHeight,
    pathWidth: clamp(width * 0.014, 10, 16),
    adaptive: true,
  };
}

function pathMarkup(index, count, layout) {
  const y = layout.inputTop + index * (layout.inputArea / Math.max(1, count - 1));
  const startX = layout.inputLeft + layout.inputWidth;
  const startY = y + layout.inputHeight / 2;
  const endX = layout.frame.width - layout.resultRight - layout.resultWidth;
  const endY = layout.resultTop + layout.resultHeight / 2;
  const span = Math.max(20, endX - startX);
  const controlOne = startX + span * 0.4;
  const controlTwo = endX - span * 0.32;
  return `<path d="M ${startX.toFixed(2)} ${startY.toFixed(2)} C ${controlOne.toFixed(2)} ${startY.toFixed(2)}, ${controlTwo.toFixed(2)} ${endY.toFixed(2)}, ${endX.toFixed(2)} ${endY.toFixed(2)}" fill="none" stroke="${COLORS[index]}" stroke-width="${layout.pathWidth}" stroke-linecap="round" data-ppt-kind="path" data-ppt-name="merge-lane-${index + 1}"></path>`;
}

function inputMarkup(input, index, count, layout) {
  const top = layout.inputTop + index * (layout.inputArea / Math.max(1, count - 1));
  const slotId = `${input.key}-content`;
  return `<article class="input" style="--top:${top}px;--input-left:${layout.inputLeft}px;--input-width:${layout.inputWidth}px;--input-height:${layout.inputHeight}px;--color:${COLORS[index]}" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-sm" data-ppt-name="merge-input-${index + 1}">
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

function resultMarkup(result, layout = resolveConvergenceLayout()) {
  return `<article class="result" style="--result-right:${layout.resultRight}px;--result-top:${layout.resultTop}px;--result-width:${layout.resultWidth}px;--result-height:${layout.resultHeight}px" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-md" data-ppt-name="merge-result">
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
      <svg viewBox="0 0 1170 492" aria-hidden="true">${model.inputs.map((_, index) => pathMarkup(index, model.inputs.length, resolveConvergenceLayout())).join("")}</svg>
      ${model.inputs.map((input, index) => inputMarkup(input, index, model.inputs.length, resolveConvergenceLayout())).join("")}
      ${resultMarkup(model.result)}
    </section>`;
  },
});

export function renderAdaptiveMarkup(parameters, { frame } = {}) {
  const model = normalize(parameters);
  const layout = resolveConvergenceLayout(frame ?? DESIGN_FRAME, model.inputs.length);
  const style = [
    `width:${layout.frame.width}px`,
    `height:${layout.frame.height}px`,
    `--merge-frame-width:${layout.frame.width}px`,
    `--merge-frame-height:${layout.frame.height}px`,
    `--merge-font-scale:${layout.adaptive ? Math.max(0.86, Math.min(1, layout.frame.width / DESIGN_FRAME.width)) : 1}`,
  ].join(";");
  return `<section class="merge" style="${style}" data-ppt-root data-input-count="${model.inputs.length}" data-adaptive-profile="convergence">
    <svg viewBox="0 0 ${layout.frame.width} ${layout.frame.height}" aria-hidden="true">${model.inputs.map((_, index) => pathMarkup(index, model.inputs.length, layout)).join("")}</svg>
    ${model.inputs.map((input, index) => inputMarkup(input, index, model.inputs.length, layout)).join("")}
    ${resultMarkup(model.result, layout)}
  </section>`;
}

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
