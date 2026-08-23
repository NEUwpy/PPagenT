import { runHtmlComponentGenerator } from "../../../src/visual-runtime/html-component-runtime.mjs";
import {
  argumentEvidenceVisualComponent,
  previewParameters,
  resolvePreviewParameters,
} from "./runtime.mjs";

export { argumentEvidenceVisualComponent, previewParameters, resolvePreviewParameters };

await runHtmlComponentGenerator(
  import.meta.url,
  argumentEvidenceVisualComponent,
  resolvePreviewParameters(previewParameters, {
    evidenceCount: 3,
    claimTextMode: "标题+说明",
    conclusionTextMode: "标题+说明",
  }),
);
