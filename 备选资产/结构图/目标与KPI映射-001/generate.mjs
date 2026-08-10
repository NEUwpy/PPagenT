import { buildGoalKpiMap, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";
export { buildGoalKpiMap };
await runGenerator(import.meta.url, buildGoalKpiMap, {
  title: "目标与 KPI 映射",
  goal: "年度总目标：稳定增长、提升体验并形成可持续能力",
  rows: [
    { title: "内容运营", body: "提高优质内容供给与传播效率", metrics: [{ value: "355万", label: "阅读量" }, { value: "+18%", label: "增长率" }], outcome: "扩大品牌影响" },
    { title: "电商运营", body: "改善交易转化与重点品类收益", metrics: [{ value: "963万", label: "销售额" }, { value: "6.2%", label: "转化率" }], outcome: "提升经营收益" },
    { title: "用户增长", body: "扩大有效用户并提升持续活跃", metrics: [{ value: "66.8万", label: "新增用户" }, { value: "42%", label: "留存率" }], outcome: "改善用户体验" },
    { title: "产品技术", body: "保障产品稳定并缩短交付周期", metrics: [{ value: "99.95%", label: "可用性" }, { value: "21天", label: "交付周期" }], outcome: "提高产品稳定" },
    { title: "商业合作", body: "拓展优质伙伴并提高合作质量", metrics: [{ value: "220个", label: "合作伙伴" }, { value: "82%", label: "续约率" }], outcome: "增强盈利能力" }
  ],
  summary: "总目标向责任单元拆解，KPI 与最终贡献保持一一对应"
});
