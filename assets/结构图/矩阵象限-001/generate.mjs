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
    q0Count: 2,
    q1Count: 2,
    q2Count: 2,
    q3Count: 2,
    focusQuadrant: "左上",
    definitionRail: "有",
  }),
);
