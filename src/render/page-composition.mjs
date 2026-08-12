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

function slotItems(content, slotPlan) {
  const byId = itemMap(content);
  return slotPlan.sourceItemIds.map((id) => byId.get(id)).filter(Boolean).map((item) => {
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

function renderLead(slide, frame, item, within, eyebrow, typographyRoles) {
  accentBar(slide, within, { left: frame.left, top: frame.top, width: 7, height: frame.height });
  addText(slide, eyebrow, {
    left: frame.left + 28, top: frame.top + 4, width: frame.width - 34, height: 26,
  }, {
    name: qaElementName({ within, role: "eyebrow" }),
    fontSize: 17, bold: true, color: COLORS.blue2, autoFit: "none",
  });
  const titleFrame = { left: frame.left + 28, top: frame.top + 42, width: frame.width - 34, height: 150 };
  const title = fittedCompositionText(item?.title || item?.body || "", titleFrame, "leadTitle", typographyRoles);
  addText(slide, title.text, titleFrame, {
    name: qaElementName({ within, role: "title" }),
    typeface: typographyRoles.bodyTypeface,
    fontSize: title.fontSize, bold: true, color: COLORS.dark, verticalAlignment: "top", autoFit: "none",
  });
  if (item?.title && item?.body) {
    const bodyFrame = { left: frame.left + 28, top: frame.top + 190, width: frame.width - 34, height: frame.height - 198 };
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
    addText(slide, String(index + 1).padStart(2, "0"), {
      left: frame.left, top: top + 1, width: 48, height: 32,
    }, {
      name: qaElementName({ within, role: `index-${index}` }),
      fontSize: 18, bold: true, color: COLORS.blue2, alignment: "center", autoFit: "none",
    });
    const titleFrame = { left: frame.left + 68, top, width: frame.width - 68, height: 38 };
    const title = fittedCompositionText(item.title || item.body, titleFrame, "rowTitle", typographyRoles);
    addText(slide, title.text, titleFrame, {
      name: qaElementName({ within, role: `title-${index}` }),
      typeface: typographyRoles.bodyTypeface,
      fontSize: title.fontSize, bold: true, color: COLORS.dark, verticalAlignment: "top", autoFit: "none",
    });
    if (item.title && item.body) {
      const bodyFrame = { left: frame.left + 68, top: top + 44, width: frame.width - 68, height: Math.max(48, rowHeight - 48) };
      const body = fittedCompositionText(item.body, bodyFrame, "rowBody", typographyRoles);
      addText(slide, body.text, bodyFrame, {
        name: qaElementName({ within, role: `body-${index}` }),
        typeface: typographyRoles.bodyTypeface,
        fontSize: body.fontSize, color: COLORS.body, verticalAlignment: "top", autoFit: "none",
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
  const titleFrame = { left: frame.left + 24, top: frame.top + 48, width: frame.width - 28, height: 130 };
  const title = fittedCompositionText(item?.title || "", titleFrame, "asideTitle", typographyRoles);
  addText(slide, title.text, titleFrame, {
    name: qaElementName({ within, role: "title" }),
    typeface: typographyRoles.bodyTypeface,
    fontSize: title.fontSize, bold: true, color: COLORS.dark, verticalAlignment: "top", autoFit: "none",
  });
  const bodyFrame = { left: frame.left + 24, top: frame.top + 192, width: frame.width - 28, height: frame.height - 198 };
  const body = fittedCompositionText(item?.body || "", bodyFrame, "asideBody", typographyRoles);
  addText(slide, body.text, bodyFrame, {
    name: qaElementName({ within, role: "body" }),
    typeface: typographyRoles.bodyTypeface,
    fontSize: body.fontSize, color: COLORS.body, verticalAlignment: "top", autoFit: "none",
  });
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

export function renderPageComposition(slide, content, layout, planPage, bodyFrame, typographyRoles) {
  if (layout.id === "fixed-cover" || layout.id === "fixed-closing") return { componentFrame: null };
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
