import { buildFlowMap, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";
export { buildFlowMap };
await runGenerator(import.meta.url, buildFlowMap, {
  title: "多阶段流向",
  columns: [
    { label: "阶段一", items: [{ title: "方向 A", value: "40" }, { title: "方向 B", value: "35" }, { title: "方向 C", value: "25" }] },
    { label: "阶段二", items: [{ title: "方向 A", value: "30" }, { title: "方向 B", value: "45" }, { title: "方向 C", value: "25" }] },
    { label: "阶段三", items: [{ title: "方向 A", value: "50" }, { title: "方向 B", value: "30" }, { title: "方向 C", value: "20" }] }
  ],
  flows: [
    { fromColumn: 0, fromIndex: 0, toColumn: 1, toIndex: 0, weight: 10 },
    { fromColumn: 0, fromIndex: 0, toColumn: 1, toIndex: 1, weight: 6 },
    { fromColumn: 0, fromIndex: 1, toColumn: 1, toIndex: 1, weight: 12 },
    { fromColumn: 0, fromIndex: 2, toColumn: 1, toIndex: 2, weight: 8 },
    { fromColumn: 1, fromIndex: 0, toColumn: 2, toIndex: 1, weight: 7 },
    { fromColumn: 1, fromIndex: 1, toColumn: 2, toIndex: 0, weight: 12 },
    { fromColumn: 1, fromIndex: 2, toColumn: 2, toIndex: 2, weight: 8 }
  ]
});
