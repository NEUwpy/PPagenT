import { buildImageCaseGallery, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";
export { buildImageCaseGallery };
await runGenerator(import.meta.url, buildImageCaseGallery, {
  title: "图片案例展示",
  cases: [
    { label: "案例一", metric: "指标 01", imageLabel: "图片区域", caption: "填写案例说明或结果摘要" },
    { label: "案例二", metric: "指标 02", imageLabel: "图片区域", caption: "填写案例说明或结果摘要" },
    { label: "案例三", metric: "指标 03", imageLabel: "图片区域", caption: "填写案例说明或结果摘要" }
  ]
});
