import { runHtmlComponentGenerator } from "../../../src/visual-runtime/html-component-runtime.mjs";
import { mapPageContent, previewParameters, visualComponent } from "./runtime.mjs";

export { mapPageContent, previewParameters, visualComponent };

await runHtmlComponentGenerator(import.meta.url, visualComponent, {
  ...previewParameters,
  items: previewParameters.items.slice(0, 4),
});
