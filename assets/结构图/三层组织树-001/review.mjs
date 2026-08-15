import { clonePreviewParameters, createVisualComponent } from "../../../src/visual-review/style-group-html.mjs";

export const visualComponent = createVisualComponent("organization", "organization-tree-default");
export const previewParameters = Object.freeze({ title: "项目组织结构", leader: { name: "总负责人", role: "统筹资源" }, departments: [
  { name: "研究组", head: "研究组长", members: [{ name: "成员 A", role: "方法" }, { name: "成员 B", role: "实验" }, { name: "成员 C", role: "分析" }] },
  { name: "产品组", head: "产品组长", members: [{ name: "成员 D", role: "需求" }, { name: "成员 E", role: "设计" }, { name: "成员 F", role: "验证" }] },
  { name: "工程组", head: "工程组长", members: [{ name: "成员 G", role: "开发" }, { name: "成员 H", role: "测试" }, { name: "成员 I", role: "运维" }] },
  { name: "运营组", head: "运营组长", members: [{ name: "成员 J", role: "推广" }, { name: "成员 K", role: "反馈" }, { name: "成员 L", role: "协同" }] },
] });
export function resolvePreviewParameters(base, selection) { const result = clonePreviewParameters(base); result.departments = result.departments.slice(0, selection.departmentCount).map((department) => ({ ...department, members: department.members.slice(0, selection.membersPerDepartment) })); return result; }
