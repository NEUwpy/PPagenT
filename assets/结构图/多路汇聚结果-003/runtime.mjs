import { createRequire } from "node:module";
import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import { resolveStructureSpatialRequirement } from "../../../src/runtime/structure-adaptation.mjs";

// 传清单本身，不传裸 id。resolveStructureSpatialRequirement 只有在拿到 asset 时才读
// spatialContract.adaptiveMinimumFrame；只传 id 会静默走 profile 回退分支
// （basis: "profile-lower-bound"、verified: false），清单里登记的下界被绕过——
// 两份数据一旦分叉，运行期与清单就会各说各话。新测试里的等式断言正是为拦这一点。
// 真源：src/runtime/structure-adaptation.mjs 的 adaptiveMinimumFrame()。
const require = createRequire(import.meta.url);
const asset = require("./asset.json");

export function resolveSpatialRequirement(parameters, targetFrame, options = {}) {
  return resolveStructureSpatialRequirement(asset, parameters, targetFrame, options);
}
import {
  previewParameters,
  resolvePreviewParameters,
  visualComponent,
} from "./review.mjs";

export { previewParameters, resolvePreviewParameters, visualComponent };

function selectedItems(content, compositionPage) {
  const ids = new Set(compositionPage?.componentItemIds ?? []);
  return ids.size ? content.items.filter((item) => ids.has(item.id)) : content.items;
}

function bodyOf(item) {
  return [item.body, ...(item.points ?? [])].map((value) => String(value ?? "").trim()).filter(Boolean).join("；");
}

export function mapPageContent(content, intent, _decision, compositionPage) {
  const items = selectedItems(content, compositionPage);
  if (items.length < 3 || items.length > 6) {
    throw new Error("多路汇聚结果要求选择 3–6 个同级输入节点");
  }
  const resultBody = (compositionPage?.componentText ?? []).find((item) => item.targetRole === "result-body")?.text ?? "";
  return renderPayload(intent, "convergence-many-to-one-003", {
    inputs: items.map((item) => ({ key: item.id, title: item.title, body: bodyOf(item) })),
    result: { title: content.title, body: resultBody },
  }, items.map((item, index) => mapping(item.id, `inputs[${index}]`)));
}
