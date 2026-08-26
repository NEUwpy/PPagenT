import { runHtmlComponentGenerator } from "../../../src/visual-runtime/html-component-runtime.mjs";
import { previewParameters, resolvePreviewParameters, visualComponent } from "./runtime.mjs";

export { previewParameters, resolvePreviewParameters, visualComponent };

await runHtmlComponentGenerator(
  import.meta.url,
  visualComponent,
  resolvePreviewParameters(previewParameters, { connectionMode: "无箭头", nodeCount: 6 }),
);
