import { runHtmlComponentGenerator } from "../../../src/visual-runtime/html-component-runtime.mjs";
import {
  previewParameters,
  problemMethodVisualComponent,
  resolvePreviewParameters,
} from "./runtime.mjs";

export { previewParameters, problemMethodVisualComponent, resolvePreviewParameters };

await runHtmlComponentGenerator(
  import.meta.url,
  problemMethodVisualComponent,
  resolvePreviewParameters(previewParameters, {
    methodCount: 3,
    problemTextMode: "标题+说明",
    resultTextMode: "标题+说明",
  }),
);
