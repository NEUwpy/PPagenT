import { runHtmlComponentGenerator } from "../../../src/visual-runtime/html-component-runtime.mjs";
import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import { previewParameters, resolvePreviewParameters, visualComponent } from "./review.mjs";
export { previewParameters, resolvePreviewParameters, visualComponent };
export function mapPageContent(content,intent){return renderPayload(intent,"framework-matrix-001",{title:content.title,quadrants:content.items.map((item)=>({title:item.title,body:item.body}))},content.items.map((item,index)=>mapping(item.id,`quadrants[${index}]`)));}
await runHtmlComponentGenerator(import.meta.url,visualComponent,resolvePreviewParameters(previewParameters,{textDensity:"long"}));
