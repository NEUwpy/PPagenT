import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
import {
  previewParameters,
  resolvePreviewParameters,
  visualComponent,
} from "./review.mjs";

export { previewParameters, resolvePreviewParameters, visualComponent };

function nodePerson(node, fallbackRole, iconQuery) {
  return {
    name: node.label,
    role: node.role || fallbackRole,
    image: node.portrait || "",
    iconQuery,
  };
}

export function mapPageContent(content, intent) {
  const hierarchy = content?.structuredData;
  if (hierarchy?.type !== "hierarchy" || !hierarchy.root) {
    throw new Error("三层人物组织树要求 PageContent.structuredData.type=hierarchy");
  }
  const departmentNodes = hierarchy.root.children ?? [];
  if (departmentNodes.length < 2 || departmentNodes.length > 3) {
    throw new Error("三层人物组织树要求根节点包含 2–3 个部门负责人节点");
  }
  const departments = departmentNodes.map((headNode, departmentIndex) => {
    const members = headNode.children ?? [];
    if (members.length < 1 || members.length > 3) {
      throw new Error(`三层人物组织树要求第 ${departmentIndex + 1} 个部门包含 1–3 名成员`);
    }
    return {
      key: headNode.id,
      name: headNode.groupLabel || headNode.role || headNode.label,
      head: nodePerson(headNode, "部门负责人", "department manager"),
      members: members.map((member) => nodePerson(member, "团队成员", "team member")),
    };
  });
  return renderPayload(intent, "hierarchy-people-tree-001", {
    title: content.title,
    leader: nodePerson(hierarchy.root, "负责人", "leader manager"),
    departments,
  }, [mapping(hierarchy.root.id, "leader"), ...departmentNodes.map((node, index) => mapping(node.id, `departments[${index}]`))]);
}
