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

function gridItemFrames(frame, itemCount) {
  const columns = itemCount >= 5 ? 3 : 2;
  const rows = Math.ceil(itemCount / columns);
  const columnGap = 20;
  const rowGap = 18;
  const width = (frame.width - columnGap * (columns - 1)) / columns;
  const height = (frame.height - rowGap * (rows - 1)) / rows;
  return Array.from({ length: itemCount }, (_, index) => ({
    left: frame.left + (index % columns) * (width + columnGap),
    top: frame.top + Math.floor(index / columns) * (height + rowGap),
    width,
    height,
  }));
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
    items.forEach((item, index) => {
      const top = frame.top + index * (rowHeight + gap);
      const compact = rowHeight < 92 && item.title && item.body;
      const contentLeft = frame.left + 68;
      const titleWidth = compact ? Math.min(150, Math.max(100, (frame.width - 68) * 0.24)) : frame.width - 68;
      if (item.title) check(item.title, {
        left: contentLeft, top, width: titleWidth, height: compact ? rowHeight : 38,
      }, "rowTitle", slotId);
      if (item.body) check(item.body, {
        left: compact ? contentLeft + titleWidth + 18 : contentLeft,
        top: compact ? top : (item.title ? top + 44 : top),
        width: compact ? frame.width - 68 - titleWidth - 18 : frame.width - 68,
        height: compact ? rowHeight : (item.title ? Math.max(0, rowHeight - 44) : rowHeight),
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
  } else if (layout.id === "editorial-grid") {
    const plan = planPage.textSlots.find((slot) => slot.slotId === "body");
    const frame = slotFrame(layout, "body", bodyFrame);
    const items = plan ? slotItems(content, plan) : [];
    gridItemFrames(frame, items.length).forEach((itemFrame, index) => {
      const item = items[index];
      check(item?.title, {
        left: itemFrame.left + 28, top: itemFrame.top + 30, width: itemFrame.width - 48, height: 38,
      }, "rowTitle", "body");
      check(item?.body, {
        left: itemFrame.left + 28, top: itemFrame.top + 78, width: itemFrame.width - 48, height: itemFrame.height - 96,
      }, "rowBody", "body");
    });
  } else if (layout.id === "editorial-dual-statement") {
    ["left", "right"].forEach((slotId) => {
      const plan = planPage.textSlots.find((slot) => slot.slotId === slotId);
      const frame = slotFrame(layout, slotId, bodyFrame);
      const item = plan ? slotItems(content, plan)[0] : null;
      check(item?.title, { left: frame.left, top: frame.top + 52, width: frame.width, height: 92 }, "dualTitle", slotId);
      check(item?.body, { left: frame.left, top: frame.top + 190, width: frame.width, height: frame.height - 200 }, "dualBody", slotId);
    });
  } else if (layout.id === "component-lead-top") {
    const plan = planPage.textSlots.find((slot) => slot.slotId === "lead");
    const frame = slotFrame(layout, "lead", bodyFrame);
    const item = plan ? slotItems(content, plan)[0] : null;
    const hasTitle = Boolean(item?.title);
    const titleWidth = hasTitle ? Math.min(210, Math.max(140, frame.width * 0.18)) : 0;
    if (hasTitle) check(item.title, {
      left: frame.left + 24, top: frame.top + 8, width: titleWidth - 24, height: frame.height - 16,
    }, "bandTitle", "lead");
    if (item?.body) check(item.body, {
      left: frame.left + (hasTitle ? titleWidth + 24 : 24),
      top: frame.top + 8,
      width: frame.width - (hasTitle ? titleWidth + 42 : 42),
      height: frame.height - 16,
    }, "bandBody", "lead");
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
