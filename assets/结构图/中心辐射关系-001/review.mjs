import { clonePreviewParameters, createVisualComponent } from "../../../src/visual-review/style-group-html.mjs";

export const visualComponent = createVisualComponent("radial", "radial-hub-orbit");
export const previewParameters = Object.freeze({ title: "中心辐射关系", center: "协同能力", items: ["统一标准", "快速响应", "质量可控", "持续积累", "资源整合", "跨域协作", "风险识别", "成果复用"] });
export function resolvePreviewParameters(base, selection) { const result = clonePreviewParameters(base); result.items = result.items.slice(0, selection.itemCount); return result; }
