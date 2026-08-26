import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import {
  previewParameters,
  resolvePreviewParameters,
  visualComponent,
} from "./review.mjs";

export { previewParameters, resolvePreviewParameters, visualComponent };

export function mapPageContent(content, intent) {
  const structured = content?.structuredData;
  if (structured?.type !== "iceberg-visible-hidden") {
    throw new Error("冰山显隐能力层要求 PageContent.structuredData.type=iceberg-visible-hidden");
  }
  const itemById = new Map((content.items ?? []).map((item) => [item.id, item]));
  const visible = structured.visibleIds.map((id) => itemById.get(id)?.title).filter(Boolean);
  const hidden = structured.hiddenIds.map((id) => itemById.get(id)?.title).filter(Boolean);
  if (visible.length < 1 || visible.length > 5) throw new Error("冰山显隐能力层要求 1–5 个可见成果");
  if (hidden.length < 2 || hidden.length > 5) throw new Error("冰山显隐能力层要求 2–5 个隐含支撑层");
  return renderPayload(intent, "layered-iceberg-depth-006", { visible, hidden }, [
    ...structured.visibleIds.map((id, index) => mapping(id, `visible[${index}]`)),
    ...structured.hiddenIds.map((id, index) => mapping(id, `hidden[${index}]`)),
  ]);
}
