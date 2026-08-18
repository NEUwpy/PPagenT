import { resolveNormalizedFrame } from "../composition/layouts.mjs";
import { fitChineseTextToFrame } from "./chinese-typography.mjs";

function slotItems(content, slotPlan) {
  const byId = new Map(content.items.map((item) => [item.id, item]));
  return slotPlan.sourceItemIds.map((id) => byId.get(id)).filter(Boolean).map((item) => {
    const pointText = (item.points ?? []).map((point) => `• ${point}`).join("\n");
    const normalized = { ...item, body: [item.body, pointText].filter(Boolean).join("\n") };
    if (slotPlan.contentMode === "title") return { ...normalized, body: "" };
    if (slotPlan.contentMode === "body") return { ...normalized, title: "" };
    return normalized;
  });
}

function slotFrame(layout, slotId, bodyFrame) {
  const slot = layout.slots.find((item) => item.id === slotId);
  if (!slot) throw new Error(`${layout.id} does not define slot ${slotId}`);
  return resolveNormalizedFrame(bodyFrame, slot.frame);
}

function fittedCompositionText(value, frame, roleName, typographyRoles) {
  const role = typographyRoles?.composition?.[roleName];
  if (!role) throw new Error(`Skin 缺少正文文字角色：${roleName}`);
  const result = fitChineseTextToFrame(value, {
    width: frame.width,
    height: frame.height,
    lineHeight: 1.18,
    ...role,
  });
  if (!result?.fits) throw new Error(`${roleName} 无法在正文槽位允许的字号档位内排下`);
  return result;
}

export function validatePageCompositionTextFit(content, layout, planPage, bodyFrame, typographyRoles) {
  if (["fixed-cover", "fixed-agenda", "fixed-closing"].includes(layout.id)) return [];
  const issues = [];
  const check = (value, frame, role, slotId) => {
    if (!value) return;
    try {
      fittedCompositionText(value, frame, role, typographyRoles);
    } catch (error) {
      issues.push({ code: "composition-text-fit-failed", role, slotId, message: error.message });
    }
  };
  const checkLead = (slotId) => {
    const plan = planPage.textSlots.find((slot) => slot.slotId === slotId);
    if (!plan) return;
    const frame = slotFrame(layout, slotId, bodyFrame);
    const item = slotItems(content, plan)[0];
    if (!item) return;
    if (item.title) check(item.title, { left: frame.left + 28, top: frame.top + 42, width: frame.width - 34, height: 150 }, "leadTitle", slotId);
    if (item.body) {
      const bodyOnly = !item.title;
      check(item.body, {
        left: frame.left + 28,
        top: bodyOnly ? frame.top + 42 : frame.top + 190,
        width: frame.width - 34,
        height: bodyOnly ? frame.height - 50 : frame.height - 198,
      }, "leadBody", slotId);
    }
  };
  const checkRows = (slotId) => {
    const plan = planPage.textSlots.find((slot) => slot.slotId === slotId);
    if (!plan) return;
    const frame = slotFrame(layout, slotId, bodyFrame);
    const items = slotItems(content, plan);
    const gap = 16;
    const rowHeight = (frame.height - gap * Math.max(0, items.length - 1)) / Math.max(1, items.length);
    items.forEach((item) => {
      if (item.title) check(item.title, { left: frame.left + 68, top: frame.top, width: frame.width - 68, height: 38 }, "rowTitle", slotId);
      if (item.body) check(item.body, {
        left: frame.left + 68,
        top: item.title ? frame.top + 44 : frame.top,
        width: frame.width - 68,
        height: item.title ? Math.max(48, rowHeight - 48) : rowHeight,
      }, "rowBody", slotId);
    });
  };

  if (layout.id === "editorial-list") {
    checkLead("lead");
    checkRows("body");
  } else if (["editorial-focus", "editorial-focus-reverse"].includes(layout.id)) {
    checkLead("primary");
    checkRows("support");
  } else if (layout.id === "editorial-single-focus") {
    const plan = planPage.textSlots.find((slot) => slot.slotId === "primary");
    const frame = slotFrame(layout, "primary", bodyFrame);
    const items = plan ? slotItems(content, plan) : [];
    const primary = items.find((item) => item.emphasis) ?? items[0];
    const support = items.filter((item) => item !== primary);
    check(primary?.title, { left: frame.left + 48, top: frame.top + 58, width: frame.width - 96, height: 74 }, "singleTitle", "primary");
    check(primary?.body, { left: frame.left + 76, top: frame.top + 145, width: frame.width - 152, height: support.length ? 132 : 190 }, "singleBody", "primary");
    if (support.length) {
      const supportText = support.map((item) => [item.title, item.body].filter(Boolean).join("：")).join("\n");
      check(supportText, { left: frame.left + 58, top: frame.top + frame.height - 92, width: frame.width - 116, height: 78 }, "singleSupport", "primary");
    }
  } else if (layout.id === "editorial-dual-statement") {
    ["left", "right"].forEach((slotId) => {
      const plan = planPage.textSlots.find((slot) => slot.slotId === slotId);
      const frame = slotFrame(layout, slotId, bodyFrame);
      const item = plan ? slotItems(content, plan)[0] : null;
      check(item?.title, { left: frame.left, top: frame.top + 52, width: frame.width, height: 92 }, "dualTitle", slotId);
      check(item?.body, { left: frame.left, top: frame.top + 190, width: frame.width, height: frame.height - 200 }, "dualBody", slotId);
    });
  } else {
    const asidePlan = planPage.textSlots.find((slot) => slot.slotId === "aside");
    if (asidePlan) {
      const frame = slotFrame(layout, "aside", bodyFrame);
      const item = slotItems(content, asidePlan)[0];
      check(item?.title, { left: frame.left + 24, top: frame.top + 48, width: frame.width - 28, height: 130 }, "asideTitle", "aside");
      check(item?.body, {
        left: frame.left + 24,
        top: item?.title ? frame.top + 192 : frame.top + 48,
        width: frame.width - 28,
        height: item?.title ? frame.height - 198 : frame.height - 54,
      }, "asideBody", "aside");
    }
  }
  return issues;
}
