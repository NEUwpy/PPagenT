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
  renderAdaptiveMarkup,
  resolveContentSlots,
  resolvePreviewParameters,
  visualComponent,
} from "./review.mjs";

export { previewParameters, renderAdaptiveMarkup, resolveContentSlots, resolvePreviewParameters, visualComponent };

export function mapPageContent(content, intent) {
  return renderPayload(intent, "cycle-loop-001", {
    title: content.title,
    center: content.notes || content.title,
    steps: content.items.map((item) => ({
      key: item.id,
      title: item.title,
      body: item.body ?? "",
      points: item.points ?? [],
    })),
  }, content.items.map((item, index) => mapping(item.id, `steps[${index}]`)));
}
