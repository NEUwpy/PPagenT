import { runHtmlComponentGenerator } from "../../../src/visual-runtime/html-component-runtime.mjs";
import {
  previewParameters,
  resolvePreviewParameters,
  visualComponent,
} from "./runtime.mjs";

export { previewParameters, resolvePreviewParameters, visualComponent };

await runHtmlComponentGenerator(
  import.meta.url,
  visualComponent,
  resolvePreviewParameters(previewParameters, {
    prosCount: 3,
    consCount: 3,
    balanceState: "收益侧更重",
  }),
);
