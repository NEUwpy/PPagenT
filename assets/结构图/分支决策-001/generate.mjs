import { runHtmlComponentGenerator } from "../../../src/visual-runtime/html-component-runtime.mjs";
import {
  branchingDecisionVisualComponent,
  previewParameters,
  resolvePreviewParameters,
} from "./runtime.mjs";

export { branchingDecisionVisualComponent, previewParameters, resolvePreviewParameters };

await runHtmlComponentGenerator(
  import.meta.url,
  branchingDecisionVisualComponent,
  resolvePreviewParameters(previewParameters, {
    branchCount: 3,
    contextTextMode: "标题+说明",
    outcomeMode: "显示结果",
  }),
);
