import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";

export function mapPageContent(content, intent) {
  return renderPayload(intent, "northeastern-university-agenda-001", {
    title: content.title || "目录",
    items: content.items.map((item) => item.title || item.body).filter(Boolean),
  }, content.items.map((item) => mapping(item.id, "items")));
}
