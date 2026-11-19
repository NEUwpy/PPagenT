import { bindingKey, onSlideFields } from "./validate.mjs";

export async function measureGrayPage(browserPage, plan) {
  const measurement = await browserPage.evaluate(async () => {
    await document.fonts.ready;
    const slide = document.querySelector("[data-slide]");
    const body = document.querySelector("[data-content-frame]");
    if (!slide || !body) return { errors: [{ code: "renderer-contract", message: "缺少画布或正文区域" }] };
    const { left, top } = slide.getBoundingClientRect();
    const box = (rect) => ({ x: rect.left - left, y: rect.top - top, width: rect.width, height: rect.height });
    const nodeBox = (node) => box(node.getBoundingClientRect());
    const frame = nodeBox(body);
    const canvas = { width: innerWidth, height: innerHeight };
    const errors = [];
    const nodes = [];
    const texts = [];
    const groups = [];
    const paths = [];
    const ids = new Set();
    const tolerance = 1.5;
    function outside(inner, outer) {
      return inner.x < outer.x - tolerance || inner.y < outer.y - tolerance
        || inner.x + inner.width > outer.x + outer.width + tolerance
        || inner.y + inner.height > outer.y + outer.height + tolerance;
    }
    const slideBox = nodeBox(slide);
    if (outside(slideBox, { x: 0, y: 0, ...canvas }) || document.documentElement.scrollWidth > canvas.width + 1
      || document.documentElement.scrollHeight > canvas.height + 1) {
      errors.push({ code: "canvas-overflow", id: "slide", bounds: slideBox });
    }
    if (outside(frame, slideBox)) errors.push({ code: "frame-outside-slide", id: "body", bounds: frame });
    const textRange = document.createRange();
    const segmenter = new Intl.Segmenter("zh-CN", { granularity: "grapheme" });

    for (const element of slide.querySelectorAll("[data-node]")) {
      const id = element.dataset.node;
      if (ids.has(id)) errors.push({ code: "duplicate-object", id });
      ids.add(id);
      const style = getComputedStyle(element);
      if (!element.getClientRects().length || style.visibility === "hidden" || style.opacity === "0") {
        if (element.hasAttribute("data-text")) errors.push({ code: "invisible-field", id });
        continue;
      }
      const bounds = nodeBox(element);
      const owner = element.closest("[data-group]");
      const record = { id, bounds, role: element.dataset.role ?? (element.hasAttribute("data-text") ? "text" : "region") };
      if (element.dataset.component) {
        record.component = { id: element.dataset.component, ...(element.dataset.componentVersion
          ? { version: element.dataset.componentVersion } : {}) };
        if (element.dataset.asset) record.asset = element.dataset.asset;
      }
      if (element.dataset.appliesTo) record.appliesTo = element.dataset.appliesTo.split(/\s+/u);
      if (element.dataset.from && element.dataset.to) {
        record.connection = { from: element.dataset.from, to: element.dataset.to };
      }
      if (element instanceof SVGPathElement) {
        const svg = element.ownerSVGElement;
        const transform = element.getScreenCTM();
        const point = (length) => {
          const screen = element.getPointAtLength(length).matrixTransform(transform);
          return [screen.x - left, screen.y - top];
        };
        const start = point(0);
        const end = point(element.getTotalLength());
        record.path = {
          d: element.getAttribute("d"), viewport: nodeBox(svg),
          viewBox: svg.getAttribute("viewBox"), strokeWidth: parseFloat(style.strokeWidth),
          strokeLineCap: style.strokeLinecap, start, end,
        };
        paths.push(element);
      }
      if (element instanceof SVGPolygonElement) {
        const svg = element.ownerSVGElement;
        record.polygon = { points: element.getAttribute("points"), viewport: nodeBox(svg), viewBox: svg.getAttribute("viewBox") };
      }

      nodes.push(record);
      const inBody = body.contains(element);
      if (inBody && outside(bounds, frame)) {
        errors.push({ code: "object-outside-body", id, bounds });
      }
      if (owner && owner !== element && outside(bounds, nodeBox(owner))) {
        errors.push({ code: "object-outside-group", id, group: owner.dataset.node, bounds });
      }
      if (!element.hasAttribute("data-text")) continue;
      const sourceIds = (element.dataset.sourceIds ?? "").split(/\s+/u).filter(Boolean);
      const lineMap = new Map();
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let offset = 0;
      for (let textNode = walker.nextNode(); textNode; textNode = walker.nextNode()) {
        for (const { segment, index } of segmenter.segment(textNode.textContent)) {
          textRange.setStart(textNode, index);
          textRange.setEnd(textNode, index + segment.length);
          const rect = textRange.getBoundingClientRect();
          if (!rect.width || !rect.height) continue;
          const lineKey = Math.round(rect.y);
          const rangeStart = offset + index;
          const rangeEnd = rangeStart + segment.length;
          const line = lineMap.get(lineKey) ?? { xmin: rect.left, ymin: rect.top, xmax: rect.right, ymax: rect.bottom,
            start: rangeStart, end: rangeEnd };
          line.xmin = Math.min(rect.left, line.xmin);
          line.xmax = Math.max(rect.right, line.xmax);
          line.ymin = Math.min(rect.top, line.ymin);
          line.ymax = Math.max(rect.bottom, line.ymax);
          line.start = Math.min(line.start, rangeStart);
          line.end = Math.max(line.end, rangeEnd);
          lineMap.set(lineKey, line);
        }
        offset += textNode.textContent.length;
      }
      const text = element.textContent;
      const lines = [...lineMap.values()].map(({ xmin, ymin, xmax, ymax, start, end }) => ({
        bounds: { x: xmin - left, y: ymin - top, width: xmax - xmin, height: ymax - ymin }, start, end,
        text: text.slice(start, end),
      }));
      const clip = element.closest("[data-clip]");
      const safeFrames = [slideBox, ...(inBody ? [frame] : []), ...(owner ? [nodeBox(owner)] : []),
        ...(clip ? [nodeBox(clip)] : [])];
      if (!lines.length || lines.some((line) => safeFrames.some((area) => outside(line.bounds, area)))) {
        errors.push({ code: "text-clipped", id, bounds });
      }
      const sizePx = parseFloat(style.fontSize);
      if (inBody && sizePx < 18) errors.push({ code: "body-font", id, sizePx, minimumPx: 18 });
      texts.push({ id, text, sourceIds, bounds, lines, role: record.role, typography: {
        family: style.fontFamily, sizePx, lineHeightPx: parseFloat(style.lineHeight),
        weight: Number(style.fontWeight), align: style.textAlign,
      } });
    }

    for (const group of body.querySelectorAll("[data-group]")) {
      const bounds = nodeBox(group);
      const children = texts.filter(({ id }) => group.contains(slide.querySelector(`[data-node="${CSS.escape(id)}"]`)));
      const lowest = Math.max(bounds.y, ...children.flatMap(({ lines }) => lines.map(({ bounds }) => bounds.y + bounds.height)));
      groups.push({ id: group.dataset.node, bounds, visibleHeight: lowest - bounds.y });
    }
    const claim = nodes.find(({ id }) => id === "claim");
    const title = nodes.find(({ id }) => id === "title");
    if (!claim || !title || claim.bounds.y + claim.bounds.height > title.bounds.y + tolerance
      || title.bounds.y + title.bounds.height > frame.y + tolerance) {
      errors.push({ code: "heading-order", id: "claim", message: "主旨、页面标题与正文区域的顺序不符" });
    }
    for (const path of paths.filter((node) => node.closest(".merge"))) {
      const diagram = path.closest(".merge");
      const index = [...diagram.querySelectorAll("path")].indexOf(path);
      const input = diagram.querySelectorAll(".input")[index];
      const result = diagram.querySelector(".result");
      const measurement = nodes.find(({ id }) => id === path.dataset.node);
      if (!input || !result || !measurement) {
        errors.push({ code: "missing-connector-anchor", id: path.dataset.node });
        continue;
      }
      const from = nodeBox(input);
      const target = nodeBox(result);
      const { start, end } = measurement.path;
      const anchorError = Math.max(Math.hypot(start[0] - (from.x + from.width), start[1] - (from.y + from.height / 2)),
        Math.hypot(end[0] - target.x, end[1] - (target.y + target.height / 2)));
      if (anchorError > 0.5) errors.push({ code: "connector-gap", id: path.dataset.node, anchorError });
      Object.assign(measurement.path, { from: input.dataset.node, to: result.dataset.node, anchorError });
    }

    const overlaps = (a, b) => Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1.5
      && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 3;
    for (let index = 0; index < texts.length; index += 1) {
      const text = texts[index];
      for (const other of texts.slice(index + 1)) {
        if (text.lines.some((a) => other.lines.some((b) => overlaps(a.bounds, b.bounds)))) {
          errors.push({ code: "text-overlap", id: text.id, other: other.id });
        }
      }
    }
    return { errors, canvas, frame, slide: slideBox, nodes, texts, groups };
  });

  if (!measurement.texts) return measurement;
  const counts = new Map();
  for (const { field, location } of onSlideFields(plan.page)) {
    const key = bindingKey(field.text, field.sourceIds);
    const entries = counts.get(key) ?? [];
    entries.push(location);
    counts.set(key, entries);
  }
  for (const { text, sourceIds, id } of measurement.texts) {
    const entries = counts.get(bindingKey(text, sourceIds));
    if (!entries?.length) measurement.errors.push({ code: "unexpected-text-binding", id, text, sourceIds });
    else entries.pop();
  }
  for (const [key, locations] of counts) {
    for (const location of locations) measurement.errors.push({ code: "missing-text-binding", location, binding: JSON.parse(key) });
  }
  return measurement;
}
