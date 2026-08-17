import { runHtmlComponentGenerator } from "../../../src/visual-runtime/html-component-runtime.mjs";
import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import { previewParameters, resolveContentSlots, resolvePreviewParameters, visualComponent } from "./review.mjs";
export { previewParameters, resolveContentSlots, resolvePreviewParameters, visualComponent };

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

await runHtmlComponentGenerator(
  import.meta.url,
  visualComponent,
  resolvePreviewParameters(previewParameters, { stepCount: 4 }),
);
