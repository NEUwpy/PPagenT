import { buildFunnelConversion, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";
export { buildFunnelConversion };
await runGenerator(import.meta.url, buildFunnelConversion, {
  title: "转化漏斗",
  stages: [
    { rate: "100%", label: "收到稿件", note: "原始信息完整进入处理流程，保留来源锚点" },
    { rate: "78%", label: "形成页面", note: "内容导演完成叙事拆页和页面职责判断" },
    { rate: "52%", label: "匹配资产", note: "视觉导演只从合法候选中选择适配结构" },
    { rate: "36%", label: "可靠交付", note: "容量、几何和渲染检查通过后输出可编辑文件" }
  ]
});
