import { runHtmlComponentGenerator } from "../../../src/visual-runtime/html-component-runtime.mjs";
import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import { previewParameters, resolvePreviewParameters, visualComponent } from "./review.mjs";
export { previewParameters, resolvePreviewParameters, visualComponent };

export function mapPageContent(content, intent) {
  return renderPayload(intent, "cycle-loop-001", {
    title: content.title,
    center: content.notes || content.title,
    centerLabel: content.centerLabel,
    steps: content.items.map((item) => ({
      key: item.id,
      title: item.title,
      english: item.english ?? "",
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
