import { buildDualCoreEnablement, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";

export { buildDualCoreEnablement };
await runGenerator(import.meta.url, buildDualCoreEnablement, {
  title: "双主体协同",
  left: {
    title: "内容导演",
    body: "理解原稿、组织叙事\n决定每页要讲什么",
    items: ["拆页", "主次", "证据", "节奏", "标题", "压缩"]
  },
  right: {
    title: "视觉导演",
    body: "安排整页构图\n选择合法核心资产",
    items: ["对齐", "层级", "留白", "均衡", "变体", "Skin"]
  },
  center: "共同完成\n表达",
  topDriver: "同一份原稿",
  bottomDriver: "同一套目标"
});
