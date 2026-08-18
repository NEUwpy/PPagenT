import fs from "node:fs";
import path from "node:path";
import { resolveTablerIcon, tablerIconSvgMarkup } from "../../../src/icons/tabler-icon-resolver.mjs";

const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const LIMITS = Object.freeze({ name: 6, role: 6, department: 8 });

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function text(value) {
  return String(value ?? "").trim();
}

function charCount(value) {
  return Array.from(value).length;
}

function normalizeImage(value, field) {
  const source = text(value);
  if (!source || source.startsWith("sample-avatar:") || source.startsWith("data:image/")) return source;
  if (/^https?:\/\//i.test(source)) throw new Error(`${field}.image 需要先下载为本地图片，不能在生成时远程读取`);
  const filePath = path.resolve(source);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) throw new Error(`${field}.image 不存在：${source}`);
  const extension = path.extname(filePath).toLowerCase();
  const mimeType = ({ ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml" })[extension];
  if (!mimeType) throw new Error(`${field}.image 仅支持 PNG、JPEG、WebP 或 SVG`);
  return `data:${mimeType};base64,${fs.readFileSync(filePath).toString("base64")}`;
}

function sampleAvatar(seed) {
  return `sample-avatar:${seed}`;
}

function sampleAvatarMarkup(seed) {
  const palettes = [
    ["#dce8f7", "#2f5ea8", "#f0c7a6", "#26384d"],
    ["#e7eef7", "#4b78b5", "#edc3a2", "#382f38"],
    ["#dfe9f4", "#315f91", "#dcae8c", "#233148"],
    ["#e9edf4", "#5677a6", "#f2c9aa", "#49362e"],
    ["#dce9ed", "#346f83", "#e8b995", "#2c3543"],
  ];
  const [background, clothing, skin, hair] = palettes[seed % palettes.length];
  const flip = seed % 2 ? -1 : 1;
  return `<svg viewBox="0 0 100 100" aria-hidden="true">
    <rect width="100" height="100" rx="50" fill="${background}"/>
    <path d="M15 100c3-25 17-37 35-37s32 12 35 37" fill="${clothing}"/>
    <path d="M42 58h16v18H42z" fill="${skin}"/>
    <ellipse cx="50" cy="40" rx="20" ry="24" fill="${skin}"/>
    <path d="M30 40c0-23 12-31 27-27 11 3 17 13 14 28-5-9-15-10-25-8-6 1-11 4-16 7z" fill="${hair}"/>
    <path d="M38 42h8M54 42h8" stroke="#344054" stroke-width="2" stroke-linecap="round"/>
    <path d="M45 52c4 ${flip} 7 ${flip} 10 0" stroke="#a66f64" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M42 69l8 8 8-8 7 31H35z" fill="#fff" opacity=".92"/>
  </svg>`;
}

function validateText(value, field, maxChars) {
  const result = text(value);
  if (!result || charCount(result) > maxChars) throw new Error(`${field} 需要 1–${maxChars} 字`);
  return result;
}

function normalizePerson(person, field, iconFallback) {
  const image = normalizeImage(person?.image, field);
  const iconQuery = text(person?.iconQuery) || iconFallback;
  const icon = image ? null : resolveTablerIcon(text(person?.iconKey) || iconQuery);
  if (!image && !icon) throw new Error(`${field} 需要照片，或需要能够匹配的图标语义`);
  return {
    name: validateText(person?.name, `${field}.name`, LIMITS.name),
    role: validateText(person?.role, `${field}.role`, LIMITS.role),
    image,
    iconQuery,
    icon,
  };
}

function normalizeParameters(parameters) {
  if (!parameters || !Array.isArray(parameters.departments)) throw new Error("三层人物组织树需要 departments 数组");
  const departmentCount = parameters.departments.length;
  if (departmentCount < 2 || departmentCount > 3) throw new Error("三层人物组织树支持 2–3 个部门");
  return {
    leader: normalizePerson(parameters.leader, "leader", "leader manager"),
    departments: parameters.departments.map((department, departmentIndex) => {
      const members = Array.isArray(department?.members) ? department.members : [];
      if (members.length < 1 || members.length > 3) throw new Error(`departments[${departmentIndex}].members 支持 1–3 人`);
      return {
        key: text(department?.key) || `department-${departmentIndex + 1}`,
        name: validateText(department?.name, `departments[${departmentIndex}].name`, LIMITS.department),
        head: normalizePerson(department?.head, `departments[${departmentIndex}].head`, "department manager"),
        members: members.map((member, memberIndex) => normalizePerson(member, `departments[${departmentIndex}].members[${memberIndex}]`, "team member")),
      };
    }),
  };
}

function departmentCenters(count) {
  const margins = { 2: 250, 3: 165, 4: 125 };
  const margin = margins[count];
  const span = DESIGN_FRAME.width - margin * 2;
  return Array.from({ length: count }, (_, index) => count === 1 ? DESIGN_FRAME.width / 2 : margin + (span * index) / (count - 1));
}

function memberCenters(center, count, departmentCount) {
  if (count === 1) return [center];
  const span = departmentCount === 4 ? 190 : 220;
  return Array.from({ length: count }, (_, index) => center - span / 2 + (span * index) / (count - 1));
}

function vLine(x, top, height, name, tier = "primary") {
  return `<div class="hierarchy-line hierarchy-line-${tier}" style="left:${x - 1.5}px;top:${top}px;width:3px;height:${height}px" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="${name}"></div>`;
}

function hLine(left, top, width, name, tier = "primary") {
  return `<div class="hierarchy-line hierarchy-line-${tier}" style="left:${left}px;top:${top - 1.5}px;width:${width}px;height:3px" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="${name}"></div>`;
}

function portraitMarkup(person, frame, kind, slotPrefix, fieldPrefix, seed) {
  const halo = kind === "leader" ? 106 : kind === "head" ? 82 : 58;
  const imageSize = kind === "leader" ? 86 : kind === "head" ? 66 : 48;
  const haloLeft = frame.centerX - halo / 2;
  const haloTop = frame.top;
  const imageLeft = frame.centerX - imageSize / 2;
  const imageTop = haloTop + (halo - imageSize) / 2;
  const image = text(person.image);
  const imageStyle = `left:${imageLeft + 4}px;top:${imageTop + 4}px;width:${imageSize - 8}px;height:${imageSize - 8}px`;
  const slot = `data-slot-id="${slotPrefix}-media" data-slot-role="media" data-slot-field="${fieldPrefix}.image|icon" data-slot-content-type="image-or-icon" data-slot-required="false"`;
  const media = image.startsWith("sample-avatar:")
    ? `<div class="hierarchy-portrait hierarchy-${kind}-portrait hierarchy-sample-avatar" style="${imageStyle}" ${slot}>${sampleAvatarMarkup(Number(image.split(":")[1]) || 0).replace("<svg ", `<svg data-ppt-kind="image" data-ppt-name="${slotPrefix}-sample-avatar" `)}</div>`
    : image
    ? `<img class="hierarchy-portrait hierarchy-${kind}-portrait" style="${imageStyle}" src="${escapeHtml(image)}" alt="${escapeHtml(person.name)}" ${slot} data-ppt-kind="image" data-ppt-shape="ellipse" data-ppt-name="${slotPrefix}-portrait"/>`
    : `<div class="hierarchy-portrait hierarchy-${kind}-portrait hierarchy-icon" style="${imageStyle}" ${slot}>${tablerIconSvgMarkup(person.icon, { name: `${slotPrefix}-icon`, className: "hierarchy-icon-svg" })}</div>`;
  return `<div class="hierarchy-portrait-halo hierarchy-${kind}-halo" style="left:${haloLeft}px;top:${haloTop}px;width:${halo}px;height:${halo}px" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="${slotPrefix}-halo"></div>
    <div class="hierarchy-portrait-shell hierarchy-${kind}-shell" style="left:${imageLeft}px;top:${imageTop}px;width:${imageSize}px;height:${imageSize}px" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="${slotPrefix}-shell"></div>
    ${media}`;
}

function identityLabel(person, centerX, top, width, kind, slotPrefix, fieldPrefix) {
  return `<div class="hierarchy-identity hierarchy-${kind}-identity" style="left:${centerX - width / 2}px;top:${top}px;width:${width}px" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="${slotPrefix}-identity">
    <span class="hierarchy-name" data-slot-id="${slotPrefix}-name" data-slot-role="item-title" data-slot-field="${fieldPrefix}.name" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="single-line" data-slot-list-policy="none" data-slot-max-chars="${LIMITS.name}" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="${slotPrefix}-name">${escapeHtml(person.name)}</span>
    <span class="hierarchy-role" data-slot-id="${slotPrefix}-role" data-slot-role="label" data-slot-field="${fieldPrefix}.role" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="single-line" data-slot-list-policy="none" data-slot-max-chars="${LIMITS.role}" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="${slotPrefix}-role">${escapeHtml(person.role)}</span>
  </div>`;
}

function renderTree(model) {
  const centers = departmentCenters(model.departments.length);
  const connectorParts = [
    vLine(585, 106, 40, "hierarchy-root-trunk"),
    hLine(centers[0], 146, centers.at(-1) - centers[0], "hierarchy-department-bus"),
  ];
  const nodeParts = [];

  nodeParts.push(portraitMarkup(model.leader, { centerX: 585, top: 0 }, "leader", "leader", "leader", 0));
  nodeParts.push(identityLabel(model.leader, 585, 92, 220, "leader", "leader", "leader"));

  model.departments.forEach((department, departmentIndex) => {
    const center = centers[departmentIndex];
    const prefix = `department-${departmentIndex}`;
    connectorParts.push(vLine(center, 146, 38, `${prefix}-head-connector`));
    connectorParts.push(vLine(center, 260, 54, `${prefix}-member-trunk`, "secondary"));
    const memberXs = memberCenters(center, department.members.length, model.departments.length);
    if (memberXs.length > 1) connectorParts.push(hLine(memberXs[0], 314, memberXs.at(-1) - memberXs[0], `${prefix}-member-bus`, "secondary"));
    memberXs.forEach((memberX, memberIndex) => connectorParts.push(vLine(memberX, 314, 21, `${prefix}-member-${memberIndex}-connector`, "secondary")));

    nodeParts.push(`<div class="hierarchy-department-name" style="left:${center - 90}px;top:152px;width:180px" data-slot-id="${prefix}-name" data-slot-role="item-title" data-slot-field="departments[${departmentIndex}].name" data-slot-item-id="${department.key}" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="single-line" data-slot-list-policy="none" data-slot-max-chars="${LIMITS.department}" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="${prefix}-name">${escapeHtml(department.name)}</div>`);
    nodeParts.push(portraitMarkup(department.head, { centerX: center, top: 176 }, "head", `${prefix}-head`, `departments[${departmentIndex}].head`, departmentIndex + 1));
    nodeParts.push(identityLabel(department.head, center, 251, 156, "head", `${prefix}-head`, `departments[${departmentIndex}].head`));

    department.members.forEach((member, memberIndex) => {
      const memberX = memberXs[memberIndex];
      const memberPrefix = `${prefix}-member-${memberIndex}`;
      nodeParts.push(portraitMarkup(member, { centerX: memberX, top: 329 }, "member", memberPrefix, `departments[${departmentIndex}].members[${memberIndex}]`, departmentIndex * 3 + memberIndex + 5));
      nodeParts.push(identityLabel(member, memberX, 387, 104, "member", memberPrefix, `departments[${departmentIndex}].members[${memberIndex}]`));
    });
  });
  return `${connectorParts.join("")}${nodeParts.join("")}`;
}

export const visualComponent = Object.freeze({
  id: "hierarchy-people-tree",
  schemaVersion: 5,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textCapacity: Object.freeze({
    maxPersonNameChars: LIMITS.name,
    maxPersonRoleChars: LIMITS.role,
    maxDepartmentNameChars: LIMITS.department,
  }),
  renderMarkup(parameters) {
    const model = normalizeParameters(parameters);
    return `<section class="hierarchy-review" data-ppt-root data-department-count="${model.departments.length}">${renderTree(model)}</section>`;
  },
});

export const previewParameters = Object.freeze({
  leader: { name: "周明远", role: "项目负责人", image: sampleAvatar(0) },
  departments: [
    {
      key: "research", name: "研究策划部", head: { name: "林清", role: "部门负责人", iconQuery: "research manager" },
      members: [
        { name: "赵宁", role: "研究专员", iconQuery: "research" },
        { name: "孙悦", role: "数据专员", iconQuery: "data analyst" },
        { name: "韩冬", role: "调研专员", iconQuery: "survey" },
      ],
    },
    {
      key: "product", name: "产品设计部", head: { name: "陈昕", role: "部门负责人", iconQuery: "product manager" },
      members: [
        { name: "吴桐", role: "产品专员", iconQuery: "product" },
        { name: "许安", role: "设计专员", iconQuery: "design" },
        { name: "李嘉", role: "体验专员", iconQuery: "user experience" },
      ],
    },
    {
      key: "delivery", name: "实施交付部", head: { name: "顾辰", role: "部门负责人", iconQuery: "delivery manager" },
      members: [
        { name: "何川", role: "实施专员", iconQuery: "implementation" },
        { name: "陆遥", role: "质量专员", iconQuery: "quality check" },
        { name: "宋琪", role: "运维专员", iconQuery: "operations" },
      ],
    },
    {
      key: "operation", name: "运营支持部", head: { name: "方琳", role: "部门负责人", iconQuery: "operations manager" },
      members: [
        { name: "乔木", role: "内容专员", iconQuery: "content" },
        { name: "叶青", role: "传播专员", iconQuery: "communication" },
        { name: "沈星", role: "资源专员", iconQuery: "resources" },
      ],
    },
  ],
});

export function resolvePreviewParameters(base, selection) {
  const departmentCount = Number(selection?.departmentCount);
  const memberCount = Number(selection?.memberCount);
  if (!Number.isInteger(departmentCount) || departmentCount < 2 || departmentCount > 3) throw new Error("三层人物组织树支持 2–3 个部门");
  if (!Number.isInteger(memberCount) || memberCount < 1 || memberCount > 3) throw new Error("三层人物组织树每部门支持 1–3 名成员");
  const result = structuredClone(base);
  result.departments = result.departments.slice(0, departmentCount).map((department) => ({
    ...department,
    members: department.members.slice(0, memberCount),
  }));
  return result;
}
