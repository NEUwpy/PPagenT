import { runGenerator } from "../../../src/asset-runtime/component-builders.mjs";
import { buildParallelCards, mapPageContent, previewParameters, visualComponent } from "./runtime.mjs";

export { buildParallelCards, mapPageContent, previewParameters, visualComponent };

await runGenerator(import.meta.url, buildParallelCards, {
  ...previewParameters,
  items: previewParameters.items.slice(0, 4),
});
