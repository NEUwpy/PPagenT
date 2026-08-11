import { buildOrganizationTree, runGenerator } from "../../../src/asset-runtime/history-organization-builders.mjs";

export { buildOrganizationTree };

await runGenerator(import.meta.url, buildOrganizationTree, {
  title: "项目团队组织架构",
  leader: { name: "李明", role: "项目负责人" },
  departments: [
    { name: "产品组", head: "吴飞", members: [{ name: "苏芳", role: "需求" }, { name: "江源", role: "研究" }] },
    { name: "技术组", head: "徐阳", members: [{ name: "周楠", role: "前端" }, { name: "叶琳", role: "后端" }, { name: "陈浩", role: "测试" }] },
    { name: "运营组", head: "陈军", members: [{ name: "林清", role: "内容" }, { name: "沈嘉", role: "渠道" }] }
  ]
});
