import { buildBusinessModelCanvas, runGenerator } from "../../../src/asset-runtime/analysis-model-builders.mjs";

export { buildBusinessModelCanvas };

await runGenerator(import.meta.url, buildBusinessModelCanvas, {
  title: "校园内容服务商业模式画布",
  partners: ["学校职能部门", "内容提供方", "技术服务商", "渠道合作伙伴"],
  activities: ["内容生产", "产品运营", "数据分析"],
  resources: ["品牌资源", "内容资产", "技术平台"],
  valuePropositions: ["快速形成规范材料", "保持品牌一致性", "降低重复制作成本", "输出可编辑成果"],
  relationships: ["专属服务", "社群支持", "持续反馈"],
  channels: ["校内平台", "线下活动", "合作推广"],
  segments: ["行政部门", "教师团队", "学生组织", "合作机构"],
  costs: ["内容生产", "技术维护", "运营推广", "人员服务"],
  revenue: ["项目服务费", "订阅收入", "定制收入", "合作分成"]
});
