import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createPresentation,
  renderComponentIntoSlide,
} from "../src/asset-runtime/component-builders.mjs";
import {
  ORGANIZATION_TREE_SOURCE_FRAME,
  ORGANIZATION_TREE_TEXT_LIMITS,
  buildOrganizationTree,
  computeOrganizationTreeLayout,
} from "../src/asset-runtime/history-organization-builders.mjs";
import { northeasternUniversitySkin } from "../src/runtime/skins/northeastern-university.mjs";
import { auditRenderedGeometry } from "../src/tools/audit-rendered-typography.mjs";

function departments(memberCounts) {
  return memberCounts.map((memberCount, departmentIndex) => ({
    name: `部门${departmentIndex + 1}`,
    head: `主管${departmentIndex + 1}`,
    members: Array.from({ length: memberCount }, (_, memberIndex) => ({
      name: `成员${memberIndex + 1}`,
      role: `岗位${memberIndex + 1}`,
    })),
  }));
}

function paramsFor(memberCounts) {
  return {
    title: "项目组织架构",
    leader: { name: "李明", role: "项目负责人" },
    departments: departments(memberCounts),
  };
}

function center(frame) {
  return { x: frame.left + frame.width / 2, y: frame.top + frame.height / 2 };
}

function assertContained(frame, container, message) {
  const tolerance = 0.01;
  assert.ok(frame.left >= container.left - tolerance, `${message}: left`);
  assert.ok(frame.top >= container.top - tolerance, `${message}: top`);
  assert.ok(frame.left + frame.width <= container.left + container.width + tolerance, `${message}: right`);
  assert.ok(frame.top + frame.height <= container.top + container.height + tolerance, `${message}: bottom`);
}

function componentFrames(layout) {
  const frames = [
    layout.leader.nodeFrame,
    layout.leader.innerFrame,
    layout.leader.labelFrame,
    layout.departmentBusRoot,
  ];
  for (const department of layout.departments) {
    frames.push(
      department.nodeFrame,
      department.innerFrame,
      department.labelFrame,
      department.branchJunction,
      department.memberBusRoot,
    );
    for (const member of department.members) {
      frames.push(member.nodeFrame, member.labelFrame, member.branchJunction);
    }
  }
  return frames;
}

async function embeddedLayout(params, targetFrame = ORGANIZATION_TREE_SOURCE_FRAME) {
  const deck = createPresentation();
  const slide = deck.slides.add();
  renderComponentIntoSlide(buildOrganizationTree, slide, params, {
    sourceFrame: ORGANIZATION_TREE_SOURCE_FRAME,
    targetFrame,
    theme: northeasternUniversitySkin.componentTheme,
  });
  const exported = await slide.export({ format: "layout" });
  return JSON.parse(await exported.text());
}

function organizationElements(layout) {
  return (layout.elements ?? []).filter((element) =>
    element.name?.startsWith("PPAGENT_QA|parent=org-")
      || element.name?.startsWith("PPAGENT_QA|within=org-")
      || element.name?.startsWith("PPAGENT_CONNECTOR|from=org-"));
}

function expectedConnectorCount(memberCounts) {
  return 3 + memberCounts.length
    + memberCounts.reduce((total, count) => total + 1 + count + (count > 1 ? 2 : 0), 0);
}

const validStates = [
  [1, 1], [2, 2], [3, 3],
  [1, 1, 1], [2, 2, 2], [3, 3, 3],
  [1, 1, 1, 1], [2, 2, 2, 2], [3, 3, 3, 3],
  [3, 2, 3],
  [1, 3, 2, 1],
];

test("organization tree v2 supports every declared count and representative uneven states", () => {
  for (const memberCounts of validStates) {
    const layout = computeOrganizationTreeLayout(paramsFor(memberCounts));
    assert.equal(layout.departments.length, memberCounts.length);
    assert.deepEqual(layout.departments.map((department) => department.members.length), memberCounts);
  }
});

test("organization tree v2 validates before adding a slide and returns stable error codes", () => {
  const cases = [
    ["ORG_TREE_PARAMS_REQUIRED", null],
    ["ORG_TREE_TEXT_REQUIRED", { ...paramsFor([1, 1]), title: "" }],
    ["ORG_TREE_LEADER_REQUIRED", { ...paramsFor([1, 1]), leader: null }],
    ["ORG_TREE_DEPARTMENTS_REQUIRED", { ...paramsFor([1, 1]), departments: null }],
    ["ORG_TREE_DEPARTMENT_COUNT", paramsFor([1])],
    ["ORG_TREE_DEPARTMENT_COUNT", paramsFor([1, 1, 1, 1, 1])],
    ["ORG_TREE_DEPARTMENT_REQUIRED", { ...paramsFor([1, 1]), departments: [null, departments([1])[0]] }],
    ["ORG_TREE_MEMBERS_REQUIRED", {
      ...paramsFor([1, 1]),
      departments: [{ ...departments([1])[0], members: null }, departments([1])[0]],
    }],
    ["ORG_TREE_MEMBER_COUNT", paramsFor([0, 1])],
    ["ORG_TREE_MEMBER_COUNT", paramsFor([4, 1])],
    ["ORG_TREE_MEMBER_REQUIRED", {
      ...paramsFor([1, 1]),
      departments: [{ ...departments([1])[0], members: [null] }, departments([1])[0]],
    }],
  ];
  for (const [expectedCode, params] of cases) {
    const deck = createPresentation();
    assert.throws(
      () => buildOrganizationTree(deck, params),
      (error) => error?.code === expectedCode,
      expectedCode,
    );
    assert.equal(deck.slides.items.length, 0, `${expectedCode} must not leave a partial slide`);
  }
});

test("organization tree v2 enforces every declared text limit and rejects control characters", () => {
  const repeat = (count) => "文".repeat(count);
  const maximum = paramsFor([3, 3, 3, 3]);
  maximum.title = repeat(ORGANIZATION_TREE_TEXT_LIMITS.title);
  maximum.leader = {
    name: repeat(ORGANIZATION_TREE_TEXT_LIMITS.leaderName),
    role: repeat(ORGANIZATION_TREE_TEXT_LIMITS.leaderRole),
  };
  maximum.departments = maximum.departments.map((department) => ({
    ...department,
    name: repeat(ORGANIZATION_TREE_TEXT_LIMITS.departmentName),
    head: repeat(ORGANIZATION_TREE_TEXT_LIMITS.departmentHead),
    members: department.members.map((member) => ({
      ...member,
      name: repeat(ORGANIZATION_TREE_TEXT_LIMITS.memberName),
      role: repeat(ORGANIZATION_TREE_TEXT_LIMITS.memberRole),
    })),
  }));
  const validDeck = createPresentation();
  buildOrganizationTree(validDeck, maximum);
  assert.equal(validDeck.slides.items.length, 1);

  const overflowCases = [
    ["title", (params) => { params.title = repeat(ORGANIZATION_TREE_TEXT_LIMITS.title + 1); }],
    ["leader.name", (params) => { params.leader.name = repeat(ORGANIZATION_TREE_TEXT_LIMITS.leaderName + 1); }],
    ["leader.role", (params) => { params.leader.role = repeat(ORGANIZATION_TREE_TEXT_LIMITS.leaderRole + 1); }],
    ["departments[0].name", (params) => { params.departments[0].name = repeat(ORGANIZATION_TREE_TEXT_LIMITS.departmentName + 1); }],
    ["departments[0].head", (params) => { params.departments[0].head = repeat(ORGANIZATION_TREE_TEXT_LIMITS.departmentHead + 1); }],
    ["departments[0].members[0].name", (params) => { params.departments[0].members[0].name = repeat(ORGANIZATION_TREE_TEXT_LIMITS.memberName + 1); }],
    ["departments[0].members[0].role", (params) => { params.departments[0].members[0].role = repeat(ORGANIZATION_TREE_TEXT_LIMITS.memberRole + 1); }],
  ];
  for (const [field, mutate] of overflowCases) {
    const params = structuredClone(maximum);
    mutate(params);
    const deck = createPresentation();
    assert.throws(
      () => buildOrganizationTree(deck, params),
      (error) => error?.code === "ORG_TREE_TEXT_TOO_LONG" && error?.field === field,
      field,
    );
    assert.equal(deck.slides.items.length, 0);
  }

  const controlCharacter = paramsFor([1, 1]);
  controlCharacter.departments[0].members[0].role = "视觉\n设计";
  const controlDeck = createPresentation();
  assert.throws(
    () => buildOrganizationTree(controlDeck, controlCharacter),
    (error) => error?.code === "ORG_TREE_TEXT_CONTROL_CHARACTER",
  );
  assert.equal(controlDeck.slides.items.length, 0);

  for (const paddedRole of [
    ` ${repeat(ORGANIZATION_TREE_TEXT_LIMITS.leaderRole)}`,
    `${repeat(ORGANIZATION_TREE_TEXT_LIMITS.leaderRole)} `,
  ]) {
    const surroundingWhitespace = paramsFor([1, 1]);
    surroundingWhitespace.leader.role = paddedRole;
    const whitespaceDeck = createPresentation();
    assert.throws(
      () => buildOrganizationTree(whitespaceDeck, surroundingWhitespace),
      (error) => error?.code === "ORG_TREE_TEXT_SURROUNDING_WHITESPACE"
        && error?.field === "leader.role",
    );
    assert.equal(whitespaceDeck.slides.items.length, 0);
  }
});

test("organization tree v2 keeps all states centered, equally spaced, and inside its source frame", () => {
  for (const memberCounts of validStates) {
    const layout = computeOrganizationTreeLayout(paramsFor(memberCounts));
    componentFrames(layout).forEach((frame, index) => assertContained(frame, layout.sourceFrame, `${memberCounts.join("-")}:${index}`));

    const departmentCenters = layout.departments.map((department) => department.centerX);
    assert.equal((departmentCenters[0] + departmentCenters.at(-1)) / 2, 640);
    if (departmentCenters.length > 2) {
      const gaps = departmentCenters.slice(1).map((value, index) => value - departmentCenters[index]);
      gaps.forEach((gap) => assert.ok(Math.abs(gap - gaps[0]) < 1e-9));
    }
    layout.departments.forEach((department, departmentIndex) => {
      const memberCenters = department.members.map((member) => member.centerX);
      const average = memberCenters.reduce((sum, value) => sum + value, 0) / memberCenters.length;
      assert.ok(Math.abs(average - department.centerX) < 1e-9, `department ${departmentIndex} member center`);
      if (memberCenters.length > 2) {
        const gaps = memberCenters.slice(1).map((value, index) => value - memberCenters[index]);
        gaps.forEach((gap) => assert.ok(Math.abs(gap - gaps[0]) < 1e-9));
      }
    });
  }
});

test("organization tree v2 exports a complete auditable connector topology", async (t) => {
  const memberCounts = [1, 3, 2, 1];
  const layout = await embeddedLayout(paramsFor(memberCounts));
  const elements = organizationElements(layout);
  const connectors = elements.filter((element) => element.name.startsWith("PPAGENT_CONNECTOR|"));
  assert.equal(connectors.length, expectedConnectorCount(memberCounts));
  assert.ok(elements.some((element) => element.name.includes("parent=org-leader-node")));
  assert.ok(elements.some((element) => element.name.includes("parent=org-department-node-0")));
  assert.ok(elements.some((element) => element.name.includes("parent=org-member-node-1-2")));

  const qaDir = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-org-tree-v2-"));
  t.after(() => fs.rm(qaDir, { recursive: true, force: true }));
  await fs.writeFile(path.join(qaDir, "slide-01.layout.json"), JSON.stringify(layout));
  const audit = await auditRenderedGeometry(qaDir, { tolerance: 0.6, requireQaParents: true });
  assert.equal(audit.status, "passed", JSON.stringify(audit.violations));
  assert.equal(audit.connectorCount, expectedConnectorCount(memberCounts));
});

test("organization tree v2 stays inside the Northeastern University Skin body frame", async () => {
  for (const memberCounts of [[1, 1], [3, 3, 3, 3], [1, 3, 2, 1]]) {
    const layout = await embeddedLayout(paramsFor(memberCounts), northeasternUniversitySkin.bodyFrame);
    for (const element of organizationElements(layout)) {
      assert.ok(Array.isArray(element.bbox), element.name);
      const [left, top, width, height] = element.bbox;
      assertContained({ left, top, width, height }, northeasternUniversitySkin.bodyFrame, element.name);
    }
  }
});
