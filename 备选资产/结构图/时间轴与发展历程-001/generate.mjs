import { buildTimelineRoadmap, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";
export { buildTimelineRoadmap };
await runGenerator(import.meta.url, buildTimelineRoadmap, {
  title: "时间轴与发展历程",
  milestones: [
    { period: "阶段一", title: "起步", body: "说明本阶段的重要事项" },
    { period: "阶段二", title: "扩展", body: "说明本阶段的重要事项" },
    { period: "阶段三", title: "成熟", body: "说明本阶段的重要事项" },
    { period: "阶段四", title: "升级", body: "说明本阶段的重要事项" }
  ]
});
