import { runHtmlComponentGenerator } from "../../../src/visual-runtime/html-component-runtime.mjs";
import { visualComponent, previewParameters, resolvePreviewParameters } from "./runtime.mjs";

export { visualComponent, previewParameters, resolvePreviewParameters };

await runHtmlComponentGenerator(
  import.meta.url,
  visualComponent,
  resolvePreviewParameters(previewParameters, { stageCount: 4, roleCount: 3 }),
);
