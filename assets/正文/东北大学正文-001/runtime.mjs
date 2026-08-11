import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";

export function mapPageContent(content, intent) {
  return renderPayload(intent, "northeastern-university-body-001", {
    title: content.title,
    compositionOnly: true,
  }, content.items.map((item) => mapping(item.id, "composition")));
}
