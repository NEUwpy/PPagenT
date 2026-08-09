import { buildCustomerJourneyMap, runGenerator } from "../../../src/asset-runtime/analysis-model-builders.mjs";

export { buildCustomerJourneyMap };

await runGenerator(import.meta.url, buildCustomerJourneyMap, {
  title: "用户完成一次材料生成的体验地图",
  stages: ["准备内容", "选择样式", "提交生成", "检查修改", "导出使用"],
  behaviors: ["整理稿件与图片", "选择符合场景的版式", "上传内容并确认参数", "核对结构与文字", "下载并继续编辑"],
  touchpoints: ["文档与素材库", "样式预览页", "生成页面", "在线预览", "导出入口"],
  emotion: [0.2, 0.65, 0.35, -0.45, 0.75],
  pains: ["素材分散", "样式差异难判断", "等待结果", "局部内容不合适", "字体或环境差异"],
  opportunities: ["自动整理素材", "按功能推荐样式", "展示生成进度", "支持局部重排", "导出前完整检查"]
});
