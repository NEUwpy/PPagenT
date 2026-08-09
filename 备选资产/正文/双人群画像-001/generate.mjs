import { buildPersonaProfile, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";
export { buildPersonaProfile };
await runGenerator(import.meta.url, buildPersonaProfile, {
  title: "双人群画像",
  personas: [
    { name: "人群 A", initial: "A", meta: "基础特征 · 场景 · 需求", tags: ["标签一", "标签二", "标签三"], scores: [{ label: "偏好一", value: 0.8 }, { label: "偏好二", value: 0.6 }, { label: "偏好三", value: 0.7 }, { label: "偏好四", value: 0.5 }] },
    { name: "人群 B", initial: "B", meta: "基础特征 · 场景 · 需求", tags: ["标签一", "标签二", "标签三"], scores: [{ label: "偏好一", value: 0.6 }, { label: "偏好二", value: 0.9 }, { label: "偏好三", value: 0.5 }, { label: "偏好四", value: 0.8 }] }
  ]
});
