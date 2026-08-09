import { buildRadialHub, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";
export { buildRadialHub };
await runGenerator(import.meta.url, buildRadialHub, {
  title: "中心辐射关系",
  center: "核心主题",
  items: ["方向一", "方向二", "方向三", "方向四", "方向五", "方向六"]
});
