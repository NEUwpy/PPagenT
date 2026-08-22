import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import {
  previewParameters,
  resolvePreviewParameters,
  visualComponent,
} from "./review.mjs";

export { previewParameters, resolvePreviewParameters, visualComponent };

function sideTone(item, index, emphasizedIndex) {
  if (item?.polarity === "positive" || item?.polarity === "negative") return item.polarity;
  if (emphasizedIndex >= 0) return index === emphasizedIndex ? "positive" : "negative";
  return index === 0 ? "negative" : "positive";
}

function sideItems(item, index) {
  const points = Array.isArray(item?.points) ? item.points.map((point) => String(point).trim()).filter(Boolean) : [];
  if (points.length < 3 || points.length > 5) {
    throw new Error(`双向结论对比要求 items[${index}].points 提供 3–5 条对应要点`);
  }
  return points;
}

export function mapPageContent(content, intent) {
  if (!Array.isArray(content?.items) || content.items.length !== 2) {
    throw new Error("双向结论对比要求 PageContent.items 恰好包含两个比较对象");
  }
  const emphasizedIndex = content.items.findIndex((item) => item.emphasis === true);
  const sides = content.items.map((item, index) => ({
    title: item.title,
    tone: sideTone(item, index, emphasizedIndex),
    items: sideItems(item, index),
  }));
  if (sides[0].tone === sides[1].tone) {
    throw new Error("双向结论对比要求两个对象一正一负；请由内容导演明确 polarity 或 emphasis");
  }
  if (sides[0].items.length !== sides[1].items.length) {
    throw new Error("双向结论对比要求两侧 points 数量一致并逐条对应");
  }
  return renderPayload(intent, "comparison-dual-verdict-001", {
    title: content.title,
    comparisonLabel: "VS",
    sides,
  }, content.items.map((item, index) => mapping(item.id, `sides[${index}]`)));
}
