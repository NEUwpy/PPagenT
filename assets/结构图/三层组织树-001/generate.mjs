import { buildOrganizationTree, runGenerator } from "../../../src/asset-runtime/history-organization-builders.mjs";
import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";

export { buildOrganizationTree };

export function mapPageContent(content, intent) {
  const hierarchy = content.structuredData;
  if (hierarchy?.type !== "hierarchy" || !hierarchy.root) {
    throw new Error(`${content.pageId} 的三层组织树需要 hierarchy structuredData`);
  }
  const departments = hierarchy.root.children ?? [];
  return renderPayload(intent, "organization-tree-001", {
    title: content.title,
    leader: { name: hierarchy.root.label, role: hierarchy.root.role ?? "" },
    departments: departments.map((department) => ({
      name: department.label,
      head: department.role ?? "",
      members: (department.children ?? []).map((member) => ({
        name: member.label,
        role: member.role ?? "",
      })),
    })),
  }, [
    mapping(hierarchy.root.id, "leader"),
    ...departments.map((department, index) => mapping(department.id, `departments[${index}]`)),
  ]);
}

await runGenerator(import.meta.url, buildOrganizationTree, {
  title: "项目团队组织架构",
  leader: { name: "李明", role: "项目负责人" },
  departments: [
    { name: "产品组", head: "吴飞", members: [{ name: "苏芳", role: "需求" }, { name: "江源", role: "研究" }] },
    { name: "技术组", head: "徐阳", members: [{ name: "周楠", role: "前端" }, { name: "叶琳", role: "后端" }, { name: "陈浩", role: "测试" }] },
    { name: "运营组", head: "陈军", members: [{ name: "林清", role: "内容" }, { name: "沈嘉", role: "渠道" }] }
  ]
});
