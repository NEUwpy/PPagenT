/*
 * Local adapted derivation of assets/结构图/多路汇聚结果-003.
 * The source component uses a responsive input lane formula and cubic SVG paths.
 * This local variant keeps that construction method while making the target
 * frame explicit for a two-column editorial page.
 */

export const COLORS = Object.freeze(["#DCC1BA", "#C2948B", "#A35D4F"]);

export const CONTENT = Object.freeze({
  inputs: [
    { key: "field", title: "现场记录", body: "故障现象与发生时间" },
    { key: "test", title: "检测记录", body: "测量读数与测试条件" },
    { key: "parts", title: "备件记录", body: "替换型号与领用数量" },
  ],
  result: { title: "维修交接单", body: "让接班人员追溯本次处理" },
});

export const TARGET = Object.freeze({
  left: 62,
  top: 140,
  width: 700,
  height: 470,
});

export function cubicBezier(p0, p1, p2, p3, steps = 32) {
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const u = 1 - t;
    points.push({
      x: u ** 3 * p0.x + 3 * u ** 2 * t * p1.x + 3 * u * t ** 2 * p2.x + t ** 3 * p3.x,
      y: u ** 3 * p0.y + 3 * u ** 2 * t * p1.y + 3 * u * t ** 2 * p2.y + t ** 3 * p3.y,
    });
  }
  return points;
}

export function laneGeometry(target = TARGET, count = CONTENT.inputs.length) {
  const innerWidth = target.width - 32;
  const cardWidth = Math.round(Math.min(230, Math.max(210, innerWidth * 0.34)));
  const cardHeight = Math.round(Math.min(82, Math.max(72, target.height * 0.166)));
  const resultWidth = Math.round(Math.min(184, Math.max(168, innerWidth * 0.27)));
  const resultHeight = Math.round(Math.min(190, Math.max(176, target.height * 0.404)));
  const card = { left: target.left + 16, width: cardWidth, height: cardHeight };
  const result = {
    left: target.left + target.width - resultWidth - 8,
    top: target.top + Math.round(target.height * 0.319),
    width: resultWidth,
    height: resultHeight,
  };
  const laneYs = [
    target.top + Math.round(target.height * 0.196),
    target.top + Math.round(target.height * 0.5),
    target.top + Math.round(target.height * 0.804),
  ];
  const merge = { x: result.left, y: result.top + result.height / 2 };
  const inputs = laneYs.slice(0, count).map((y, index) => ({
    ...card,
    top: y,
    key: CONTENT.inputs[index].key,
    title: CONTENT.inputs[index].title,
    body: CONTENT.inputs[index].body,
  }));
  const lanes = inputs.map((input, index) => {
    const start = { x: input.left + input.width, y: input.top + input.height / 2 };
    const spread = index - (inputs.length - 1) / 2;
    const curve = cubicBezier(
      start,
      { x: start.x + (merge.x - start.x) * 0.31, y: start.y },
      { x: merge.x - (merge.x - start.x) * 0.20, y: merge.y + spread * Math.min(28, target.height * 0.06) },
      merge,
    );
    return { index, color: COLORS[index], start, merge, points: curve };
  });
  return { target, card, result, inputs, lanes, merge };
}

function addText(slide, text, position, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name: style.name,
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = String(text ?? "");
  shape.text.style = {
    fontSize: style.fontSize ?? 17,
    typeface: style.typeface ?? "Noto Sans SC",
    color: style.color ?? "#4B4A45",
    bold: style.bold ?? false,
    alignment: style.alignment ?? "left",
    verticalAlignment: style.verticalAlignment ?? "middle",
    autoFit: "none",
    insets: style.insets ?? { top: 0, right: 0, bottom: 0, left: 0 },
  };
  return shape;
}

function addRect(slide, position, options = {}) {
  return slide.shapes.add({
    geometry: options.geometry ?? "roundRect",
    name: options.name,
    position,
    fill: options.fill ?? "none",
    line: options.line ?? { style: "solid", fill: "none", width: 0 },
    shadow: options.shadow ?? "shadow-none",
    borderRadius: options.borderRadius ?? 12,
  });
}

function addLane(slide, lane) {
  const xs = lane.points.map((point) => point.x);
  const ys = lane.points.map((point) => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const width = Math.max(...xs) - left;
  const height = Math.max(...ys) - top;
  const commands = lane.points.map((point, index) => (index === 0
    ? { moveTo: { x: point.x - left, y: point.y - top } }
    : { lineTo: { x: point.x - left, y: point.y - top } }));
  return slide.shapes.add({
    geometry: "custom",
    name: `adaptive-merge-lane-${lane.index + 1}`,
    position: { left, top, width, height },
    fill: "none",
    line: { style: "solid", fill: lane.color, width: 10 },
    customPaths: [{ id: `adaptive-lane-${lane.index + 1}`, width, height, commands }],
  });
}

export function buildAdaptiveConvergence(slide, options = {}) {
  const model = laneGeometry(options.target ?? TARGET, 3);
  const { result } = model;

  model.lanes.forEach((lane) => addLane(slide, lane));
  model.inputs.forEach((input, index) => {
    addRect(slide, input, {
      name: `adaptive-merge-input-${index + 1}`,
      fill: "#F5F4EF",
      line: { style: "solid", fill: "#D8D5CC", width: 1 },
      shadow: "shadow-none",
    });
    addRect(slide, {
      left: input.left,
      top: input.top,
      width: 7,
      height: input.height,
    }, {
      geometry: "rect",
      name: `adaptive-merge-input-${index + 1}-accent`,
      fill: COLORS[index],
      line: { style: "solid", fill: "none", width: 0 },
    });
    addText(slide, input.title, {
      left: input.left + 22,
      top: input.top + 13,
      width: input.width - 36,
      height: 27,
    }, {
      name: `adaptive-merge-input-${index + 1}-title`,
      fontSize: 21,
      typeface: "Noto Serif SC",
      bold: true,
      color: "#20201D",
    });
    addText(slide, input.body, {
      left: input.left + 22,
      top: input.top + 45,
      width: input.width - 36,
      height: 22,
    }, {
      name: `adaptive-merge-input-${index + 1}-body`,
      fontSize: 17,
      color: "#4B4A45",
    });
  });

  addRect(slide, result, {
    name: "adaptive-merge-result",
    fill: "#EEECE5",
    line: { style: "solid", fill: "#A35D4F", width: 2 },
    borderRadius: 24,
  });
  addText(slide, "共同结果", {
    left: result.left + 18,
    top: result.top + 41,
    width: result.width - 36,
    height: 23,
  }, {
    name: "adaptive-merge-result-label",
    fontSize: 15,
    color: "#85837B",
    alignment: "center",
  });
  addText(slide, CONTENT.result.title, {
    left: result.left + 18,
    top: result.top + 76,
    width: result.width - 36,
    height: 31,
  }, {
    name: "adaptive-merge-result-title",
    fontSize: 21,
    bold: true,
    color: "#20201D",
    alignment: "center",
  });
  addText(slide, CONTENT.result.body, {
    left: result.left + 18,
    top: result.top + 122,
    width: result.width - 36,
    height: 46,
  }, {
    name: "adaptive-merge-result-body",
    fontSize: 17,
    color: "#4B4A45",
    alignment: "center",
  });

  return model;
}
