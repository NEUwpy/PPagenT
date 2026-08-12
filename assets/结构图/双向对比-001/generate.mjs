import { buildComparison, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";
import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";

export { buildComparison };

function splitPoints(value) {
  return String(value ?? "").split(/\r?\n|[;；]/).map((item) => item.trim()).filter(Boolean);
}

export function mapPageContent(content, intent) {
  const [left, right] = content.items;
  if (!left || !right) throw new Error(`${content.pageId} 的双向对比需要两个内容组`);
  return renderPayload(intent, "comparison-structure-001", {
    title: content.title,
    left: {
      title: left.title,
      items: splitPoints(left.body),
      emphasis: Boolean(left.emphasis),
      polarity: left.polarity ?? "neutral",
    },
    right: {
      title: right.title,
      items: splitPoints(right.body),
      emphasis: Boolean(right.emphasis),
      polarity: right.polarity ?? "neutral",
    },
    centerLabel: content.notes || "对比",
  }, [mapping(left.id, "left"), mapping(right.id, "right")]);
}

await runGenerator(import.meta.url, buildComparison, {
  title: "两种生成路线",
  left: { title: "自由生成", items: ["结果难以复现", "版式质量波动", "反复消耗判断", "经验难以沉淀"] },
  right: { title: "受控生成", items: ["输出稳定可靠", "版式边界明确", "问题可以回归", "能力持续积累"], emphasis: true },
  centerLabel: "VS",
});
