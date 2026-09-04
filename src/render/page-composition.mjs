import { addBox, addText, qaElementName } from "../asset-runtime/component-builders.mjs";
import { resolveNormalizedFrame } from "../composition/layouts.mjs";
import { fitChineseTextToFrame } from "./chinese-typography.mjs";

const COLORS = {
  blue: "#2F5EA8",
  blue2: "#4C88E8",
  pale: "#DCE9FA",
  dark: "#2B2B2B",
  body: "#404040",
  muted: "#6F7D91",
  line: "#D5DFEC",
  white: "#FFFFFF",
};

function itemMap(content) {
  return new Map(content.items.map((item) => [item.id, item]));
}

function editorialItem(item) {
  const pointText = (item.points ?? []).map((point) => `• ${point}`).join("\n");
  return { ...item, body: [item.body, pointText].filter(Boolean).join("\n") };
}

function slotItems(content, slotPlan) {
  const byId = itemMap(content);
  return slotPlan.sourceItemIds.map((id) => byId.get(id)).filter(Boolean).map(editorialItem).map((item) => {
    if (slotPlan.contentMode === "title") return { ...item, body: "" };
    if (slotPlan.contentMode === "body") return { ...item, title: "" };
    return item;
  });
}

function slotFrame(layout, slotId, bodyFrame) {
  const slot = layout.slots.find((item) => item.id === slotId);
  if (!slot) throw new Error(`${layout.id} does not define slot ${slotId}`);
  return resolveNormalizedFrame(bodyFrame, slot.frame);
}

function zone(slide, id, frame) {
  return addBox(slide, frame, {
    name: qaElementName({ parent: id, domains: ["page-composition-zones"] }),
    geometry: "rect",
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
    shadow: "shadow-none",
    borderRadius: 0,
  });
}

function accentBar(slide, within, frame, color = COLORS.blue) {
  return addBox(slide, frame, {
    name: qaElementName({ within, role: "accent" }),
    geometry: "rect",
    fill: color,
    line: { style: "solid", fill: "none", width: 0 },
    shadow: "shadow-none",
    borderRadius: 0,
  });
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
  if (!result?.fits) {
    const error = new Error(`${roleName} 无法在正文槽位允许的字号档位内排下`);
    error.code = "COMPOSITION_TEXT_FIT_FAILED";
    error.role = roleName;
    error.text = value;
    throw error;
  }
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

function renderEditorialGrid(slide, content, layout, planPage, bodyFrame, typographyRoles) {
  const plan = planPage.textSlots.find((slot) => slot.slotId === "body");
  const frame = slotFrame(layout, "body", bodyFrame);
  const items = plan ? slotItems(content, plan) : [];
  gridItemFrames(frame, items.length).forEach((itemFrame, index) => {
    const item = items[index];
    const within = `composition-grid-${index}`;
    zone(slide, within, itemFrame);
    addBox(slide, itemFrame, {
      name: qaElementName({ within, role: "card" }),
      geometry: "roundRect",
      fill: index % 3 === 0 ? "#F5F8FD" : "#FAFBFD",
      line: { style: "solid", fill: "#D9E3F0", width: 1 },
      shadow: "shadow-none",
      borderRadius: 14,
    });
    addBox(slide, { left: itemFrame.left, top: itemFrame.top, width: 7, height: itemFrame.height }, {
      name: qaElementName({ within, role: "accent" }),
      geometry: "roundRect",
      fill: index % 3 === 0 ? COLORS.blue : COLORS.blue2,
      line: { style: "solid", fill: "none", width: 0 },
      shadow: "shadow-none",
      borderRadius: 4,
    });
    addText(slide, String(index + 1).padStart(2, "0"), {
      left: itemFrame.left + itemFrame.width - 48, top: itemFrame.top + 18, width: 28, height: 22,
    }, {
      name: qaElementName({ within, role: "index" }), fontSize: 12, bold: true,
      color: COLORS.muted, alignment: "right", autoFit: "none",
    });
    const titleFrame = { left: itemFrame.left + 28, top: itemFrame.top + 30, width: itemFrame.width - 48, height: 38 };
    const title = fittedCompositionText(item?.title || "", titleFrame, "rowTitle", typographyRoles);
    addText(slide, title.text, titleFrame, {
      name: qaElementName({ within, role: "title" }), typeface: typographyRoles.bodyTypeface,
      fontSize: title.fontSize, bold: true, color: COLORS.dark, autoFit: "none",
    });
    const itemBodyFrame = {
      left: itemFrame.left + 28, top: itemFrame.top + 78,
      width: itemFrame.width - 48, height: itemFrame.height - 96,
    };
    const body = fittedCompositionText(item?.body || "", itemBodyFrame, "rowBody", typographyRoles);
    addText(slide, body.text, itemBodyFrame, {
      name: qaElementName({ within, role: "body" }), typeface: typographyRoles.bodyTypeface,
      fontSize: body.fontSize, color: COLORS.body, verticalAlignment: "top", autoFit: "none",
    });
  });
}

function renderComponentLeadBand(slide, content, layout, planPage, bodyFrame, typographyRoles) {
  const plan = planPage.textSlots.find((slot) => slot.slotId === "lead");
  const frame = slotFrame(layout, "lead", bodyFrame);
  const item = plan ? slotItems(content, plan)[0] : null;
  const within = "composition-component-lead";
  zone(slide, within, frame);
  addBox(slide, frame, {
    name: qaElementName({ within, role: "surface" }),
    geometry: "roundRect",
    fill: "#F3F7FC",
    line: { style: "solid", fill: "#D5E2F2", width: 1 },
    shadow: "shadow-none",
    borderRadius: 10,
  });
  accentBar(slide, within, { left: frame.left, top: frame.top, width: 7, height: frame.height });
  const hasTitle = Boolean(item?.title);
  const titleWidth = hasTitle ? Math.min(210, Math.max(140, frame.width * 0.18)) : 0;
  if (hasTitle) {
    const titleFrame = {
      left: frame.left + 24, top: frame.top + 8, width: titleWidth - 24, height: frame.height - 16,
    };
    const title = fittedCompositionText(item.title, titleFrame, "bandTitle", typographyRoles);
    addText(slide, title.text, titleFrame, {
      name: qaElementName({ within, role: "title" }), typeface: typographyRoles.bodyTypeface,
      fontSize: title.fontSize, bold: true, color: COLORS.blue, verticalAlignment: "middle", autoFit: "none",
    });
    addBox(slide, {
      left: frame.left + titleWidth, top: frame.top + 13, width: 1, height: frame.height - 26,
    }, {
      name: qaElementName({ within, role: "divider" }), geometry: "rect", fill: COLORS.line,
      line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none", borderRadius: 0,
    });
  }
  if (item?.body) {
    const bodyFrame = {
      left: frame.left + (hasTitle ? titleWidth + 24 : 24),
      top: frame.top + 8,
      width: frame.width - (hasTitle ? titleWidth + 42 : 42),
      height: frame.height - 16,
    };
    const body = fittedCompositionText(item.body, bodyFrame, "bandBody", typographyRoles);
    addText(slide, body.text, bodyFrame, {
      name: qaElementName({ within, role: "body" }), typeface: typographyRoles.bodyTypeface,
      fontSize: body.fontSize, color: COLORS.body, verticalAlignment: "middle", autoFit: "none",
    });
  }
}

function renderLead(slide, frame, item, within, eyebrow, typographyRoles) {
  accentBar(slide, within, { left: frame.left, top: frame.top, width: 7, height: frame.height });
  addText(slide, eyebrow, {
    left: frame.left + 28, top: frame.top + 4, width: frame.width - 34, height: 26,
  }, {
    name: qaElementName({ within, role: "eyebrow" }),
    fontSize: 17, bold: true, color: COLORS.blue2, autoFit: "none",
  });
  if (item?.title) {
    const titleFrame = { left: frame.left + 28, top: frame.top + 42, width: frame.width - 34, height: 150 };
    const title = fittedCompositionText(item.title, titleFrame, "leadTitle", typographyRoles);
    addText(slide, title.text, titleFrame, {
      name: qaElementName({ within, role: "title" }),
      typeface: typographyRoles.bodyTypeface,
      fontSize: title.fontSize, bold: true, color: COLORS.dark, verticalAlignment: "top", autoFit: "none",
    });
  }
  if (item?.body) {
    const bodyOnly = !item.title;
    const bodyFrame = { left: frame.left + 28, top: frame.top + 190, width: frame.width - 34, height: frame.height - 198 };
    if (bodyOnly) {
      bodyFrame.top = frame.top + 42;
      bodyFrame.height = frame.height - 50;
    }
    const body = fittedCompositionText(item.body, bodyFrame, "leadBody", typographyRoles);
    addText(slide, body.text, bodyFrame, {
      name: qaElementName({ within, role: "body" }),
      typeface: typographyRoles.bodyTypeface,
      fontSize: body.fontSize, color: COLORS.body, verticalAlignment: "top", autoFit: "none",
    });
  }
}

function renderEditorialRows(slide, frame, items, within, typographyRoles) {
  const gap = 16;
  const rowHeight = (frame.height - gap * Math.max(0, items.length - 1)) / Math.max(1, items.length);
  items.forEach((item, index) => {
    const top = frame.top + index * (rowHeight + gap);
    const compact = rowHeight < 92 && item.title && item.body;
    const contentLeft = frame.left + 68;
    const titleWidth = compact ? Math.min(150, Math.max(100, (frame.width - 68) * 0.24)) : frame.width - 68;
    const titleFrame = {
      left: contentLeft,
      top,
      width: titleWidth,
      height: compact ? rowHeight : 38,
    };
    const bodyFrame = {
      left: compact ? contentLeft + titleWidth + 18 : contentLeft,
      top: compact ? top : (item.title ? top + 44 : top),
      width: compact ? frame.width - 68 - titleWidth - 18 : frame.width - 68,
      height: compact ? rowHeight : (item.title ? Math.max(0, rowHeight - 44) : rowHeight),
    };
    addText(slide, String(index + 1).padStart(2, "0"), {
      left: frame.left, top: top + 1, width: 48, height: 32,
    }, {
      name: qaElementName({ within, role: `index-${index}` }),
      fontSize: 18, bold: true, color: COLORS.blue2, alignment: "center", autoFit: "none",
    });
    if (item.title) {
      const title = fittedCompositionText(item.title, titleFrame, "rowTitle", typographyRoles);
      addText(slide, title.text, titleFrame, {
        name: qaElementName({ within, role: `title-${index}` }),
        typeface: typographyRoles.bodyTypeface, fontSize: title.fontSize, bold: true, color: COLORS.dark,
        verticalAlignment: compact ? "middle" : "top", autoFit: "none",
      });
    }
    if (item.body) {
      const body = fittedCompositionText(item.body, bodyFrame, "rowBody", typographyRoles);
      addText(slide, body.text, bodyFrame, {
        name: qaElementName({ within, role: `body-${index}` }),
        typeface: typographyRoles.bodyTypeface, fontSize: body.fontSize, color: COLORS.body,
        verticalAlignment: compact ? "middle" : "top", autoFit: "none",
      });
    }
    if (index < items.length - 1) {
      addBox(slide, {
        left: frame.left + 68, top: top + rowHeight + gap / 2, width: frame.width - 68, height: 1,
      }, {
        geometry: "rect", fill: COLORS.line,
        line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none", borderRadius: 0,
      });
    }
  });
}

function renderAside(slide, frame, items, within, typographyRoles) {
  const item = items[0];
  accentBar(slide, within, { left: frame.left, top: frame.top, width: 7, height: frame.height }, COLORS.blue2);
  addText(slide, "核心判断", {
    left: frame.left + 24, top: frame.top + 6, width: frame.width - 28, height: 26,
  }, {
    name: qaElementName({ within, role: "eyebrow" }),
    fontSize: 17, bold: true, color: COLORS.blue2, autoFit: "none",
  });
  if (item?.title) {
    const titleFrame = { left: frame.left + 24, top: frame.top + 48, width: frame.width - 28, height: 130 };
    const title = fittedCompositionText(item.title, titleFrame, "asideTitle", typographyRoles);
    addText(slide, title.text, titleFrame, {
      name: qaElementName({ within, role: "title" }),
      typeface: typographyRoles.bodyTypeface,
      fontSize: title.fontSize, bold: true, color: COLORS.dark, verticalAlignment: "top", autoFit: "none",
    });
  }
  if (item?.body) {
    const bodyFrame = {
      left: frame.left + 24,
      top: item.title ? frame.top + 192 : frame.top + 48,
      width: frame.width - 28,
      height: item.title ? frame.height - 198 : frame.height - 54,
    };
    const body = fittedCompositionText(item.body, bodyFrame, "asideBody", typographyRoles);
    addText(slide, body.text, bodyFrame, {
      name: qaElementName({ within, role: "body" }),
      typeface: typographyRoles.bodyTypeface,
      fontSize: body.fontSize, color: COLORS.body, verticalAlignment: "top", autoFit: "none",
    });
  }
}

function renderEditorialList(slide, content, layout, planPage, bodyFrame, typographyRoles) {
  const leadPlan = planPage.textSlots.find((slot) => slot.slotId === "lead");
  const bodyPlan = planPage.textSlots.find((slot) => slot.slotId === "body");
  const leadFrame = slotFrame(layout, "lead", bodyFrame);
  const body = slotFrame(layout, "body", bodyFrame);
  zone(slide, "composition-lead", leadFrame);
  zone(slide, "composition-body", body);
  renderLead(slide, leadFrame, slotItems(content, leadPlan)[0], "composition-lead", "关键追问", typographyRoles);
  renderEditorialRows(slide, body, slotItems(content, bodyPlan), "composition-body", typographyRoles);
}

function renderEditorialFocus(slide, content, layout, planPage, bodyFrame, typographyRoles) {
  const primaryPlan = planPage.textSlots.find((slot) => slot.slotId === "primary");
  const supportPlan = planPage.textSlots.find((slot) => slot.slotId === "support");
  const primaryFrame = slotFrame(layout, "primary", bodyFrame);
  const supportFrame = slotFrame(layout, "support", bodyFrame);
  zone(slide, "composition-primary", primaryFrame);
  zone(slide, "composition-support", supportFrame);
  renderLead(slide, primaryFrame, slotItems(content, primaryPlan)[0], "composition-primary", "核心能力", typographyRoles);
  renderEditorialRows(slide, supportFrame, slotItems(content, supportPlan), "composition-support", typographyRoles);
}

function renderSingleFocus(slide, content, layout, planPage, bodyFrame, typographyRoles) {
  const primaryPlan = planPage.textSlots.find((slot) => slot.slotId === "primary");
  const frame = slotFrame(layout, "primary", bodyFrame);
  const items = slotItems(content, primaryPlan);
  const primary = items.find((item) => item.emphasis) ?? items[0];
  const support = items.filter((item) => item !== primary);
  zone(slide, "composition-single-focus", frame);
  addBox(slide, {
    left: frame.left + frame.width * 0.12,
    top: frame.top + 8,
    width: frame.width * 0.76,
    height: 5,
  }, {
    name: qaElementName({ within: "composition-single-focus", role: "accent" }),
    geometry: "rect",
    fill: COLORS.blue2,
    line: { style: "solid", fill: "none", width: 0 },
    shadow: "shadow-none",
    borderRadius: 0,
  });
  const titleFrame = { left: frame.left + 48, top: frame.top + 58, width: frame.width - 96, height: 74 };
  const title = fittedCompositionText(primary?.title || "", titleFrame, "singleTitle", typographyRoles);
  addText(slide, title.text, titleFrame, {
    name: qaElementName({ within: "composition-single-focus", role: "title" }),
    typeface: typographyRoles.bodyTypeface,
    fontSize: title.fontSize,
    bold: true,
    color: COLORS.dark,
    alignment: "center",
    verticalAlignment: "middle",
    autoFit: "none",
  });
  const primaryBodyFrame = { left: frame.left + 76, top: frame.top + 145, width: frame.width - 152, height: support.length ? 132 : 190 };
  const body = fittedCompositionText(primary?.body || "", primaryBodyFrame, "singleBody", typographyRoles);
  addText(slide, body.text, primaryBodyFrame, {
    name: qaElementName({ within: "composition-single-focus", role: "body" }),
    typeface: typographyRoles.bodyTypeface,
    fontSize: body.fontSize,
    color: COLORS.body,
    alignment: "center",
    verticalAlignment: "middle",
    autoFit: "none",
  });
  if (support.length) {
    const supportText = support.map((item) => [item.title, item.body].filter(Boolean).join("：")).join("\n");
    addBox(slide, {
      left: frame.left + frame.width * 0.2,
      top: frame.top + frame.height - 112,
      width: frame.width * 0.6,
      height: 1,
    }, {
      geometry: "rect",
      fill: COLORS.line,
      line: { style: "solid", fill: "none", width: 0 },
      shadow: "shadow-none",
      borderRadius: 0,
    });
    const supportFrame = { left: frame.left + 58, top: frame.top + frame.height - 92, width: frame.width - 116, height: 78 };
    const fittedSupport = fittedCompositionText(supportText, supportFrame, "singleSupport", typographyRoles);
    addText(slide, fittedSupport.text, supportFrame, {
      name: qaElementName({ within: "composition-single-focus", role: "support" }),
      typeface: typographyRoles.bodyTypeface,
      fontSize: fittedSupport.fontSize,
      color: COLORS.muted,
      alignment: "center",
      verticalAlignment: "middle",
      autoFit: "none",
    });
  }
}

function renderDualStatement(slide, content, layout, planPage, bodyFrame, typographyRoles) {
  const plans = ["left", "right"].map((slotId) => planPage.textSlots.find((slot) => slot.slotId === slotId));
  const frames = ["left", "right"].map((slotId) => slotFrame(layout, slotId, bodyFrame));
  const items = plans.map((plan) => slotItems(content, plan)[0]);
  addBox(slide, {
    left: bodyFrame.left + bodyFrame.width / 2,
    top: bodyFrame.top + 42,
    width: 2,
    height: bodyFrame.height - 84,
  }, {
    name: "composition-dual-divider",
    geometry: "rect",
    fill: COLORS.line,
    line: { style: "solid", fill: "none", width: 0 },
    shadow: "shadow-none",
    borderRadius: 0,
  });
  frames.forEach((frame, index) => {
    const item = items[index];
    const within = `composition-dual-${index}`;
    zone(slide, within, frame);
    addText(slide, String(index + 1).padStart(2, "0"), {
      left: frame.left, top: frame.top, width: 52, height: 30,
    }, {
      name: qaElementName({ within, role: "index" }),
      fontSize: 17,
      bold: true,
      color: item?.emphasis ? COLORS.blue2 : COLORS.muted,
      autoFit: "none",
    });
    const titleFrame = { left: frame.left, top: frame.top + 52, width: frame.width, height: 92 };
    const title = fittedCompositionText(item?.title || "", titleFrame, "dualTitle", typographyRoles);
    addText(slide, title.text, titleFrame, {
      name: qaElementName({ within, role: "title" }),
      typeface: typographyRoles.bodyTypeface,
      fontSize: title.fontSize,
      bold: true,
      color: COLORS.dark,
      verticalAlignment: "middle",
      autoFit: "none",
    });
    addBox(slide, {
      left: frame.left,
      top: frame.top + 160,
      width: item?.emphasis ? frame.width * 0.62 : frame.width * 0.38,
      height: 4,
    }, {
      name: qaElementName({ within, role: "accent" }),
      geometry: "rect",
      fill: item?.emphasis ? COLORS.blue2 : COLORS.line,
      line: { style: "solid", fill: "none", width: 0 },
      shadow: "shadow-none",
      borderRadius: 0,
    });
    const bodyFrameForItem = { left: frame.left, top: frame.top + 190, width: frame.width, height: frame.height - 200 };
    const body = fittedCompositionText(item?.body || "", bodyFrameForItem, "dualBody", typographyRoles);
    addText(slide, body.text, bodyFrameForItem, {
      name: qaElementName({ within, role: "body" }),
      typeface: typographyRoles.bodyTypeface,
      fontSize: body.fontSize,
      color: COLORS.body,
      verticalAlignment: "top",
      autoFit: "none",
    });
  });
}

export function validatePageCompositionTextFit(content, layout, planPage, bodyFrame, typographyRoles) {
  if (["fixed-cover", "fixed-agenda", "fixed-closing"].includes(layout.id)) return [];
  const issues = [];
  const check = (value, frame, role, slotId) => {
    if (!value) return;
    try {
      fittedCompositionText(value, frame, role, typographyRoles);
    } catch (error) {
      issues.push({
        code: "composition-text-fit-failed",
        role,
        slotId,
        message: error.message,
      });
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

export function renderPageComposition(slide, content, layout, planPage, bodyFrame, typographyRoles) {
  if (["fixed-cover", "fixed-agenda", "fixed-closing"].includes(layout.id)) return { componentFrame: null };
  if (layout.id === "editorial-list") {
    renderEditorialList(slide, content, layout, planPage, bodyFrame, typographyRoles);
    return { componentFrame: null };
  }
  if (["editorial-focus", "editorial-focus-reverse"].includes(layout.id)) {
    renderEditorialFocus(slide, content, layout, planPage, bodyFrame, typographyRoles);
    return { componentFrame: null };
  }
  if (layout.id === "editorial-single-focus") {
    renderSingleFocus(slide, content, layout, planPage, bodyFrame, typographyRoles);
    return { componentFrame: null };
  }
  if (layout.id === "editorial-grid") {
    renderEditorialGrid(slide, content, layout, planPage, bodyFrame, typographyRoles);
    return { componentFrame: null };
  }
  if (layout.id === "editorial-dual-statement") {
    renderDualStatement(slide, content, layout, planPage, bodyFrame, typographyRoles);
    return { componentFrame: null };
  }
  if (layout.id === "component-lead-top") {
    renderComponentLeadBand(slide, content, layout, planPage, bodyFrame, typographyRoles);
  }
  const componentSlot = layout.slots.find((slot) => slot.role === "component");
  const componentFrame = componentSlot ? resolveNormalizedFrame(bodyFrame, componentSlot.frame) : null;
  if (componentFrame) zone(slide, "composition-component", componentFrame);
  const asidePlan = planPage.textSlots.find((slot) => slot.slotId === "aside");
  if (asidePlan) {
    const asideFrame = slotFrame(layout, "aside", bodyFrame);
    zone(slide, "composition-aside", asideFrame);
    renderAside(slide, asideFrame, slotItems(content, asidePlan), "composition-aside", typographyRoles);
  }
  return { componentFrame };
}
