import { runHtmlComponentGenerator } from "../../../src/visual-runtime/html-component-runtime.mjs";
import {
  previewParameters,
  resolveContentSlots,
  resolvePreviewParameters,
  visualComponent,
} from "./runtime.mjs";
export { previewParameters, resolveContentSlots, resolvePreviewParameters, visualComponent };

await runHtmlComponentGenerator(
  import.meta.url,
  visualComponent,
  resolvePreviewParameters(previewParameters, { stepCount: 4 }),
);
