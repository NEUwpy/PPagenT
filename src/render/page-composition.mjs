import { addBox, addText, qaElementName } from "../asset-runtime/component-builders.mjs";
import { resolveNormalizedFrame } from "../composition/layouts.mjs";
import { wrapChineseText } from "./chinese-typography.mjs";

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

function renderLead(slide, frame, item, within, eyebrow) {
  accentBar(slide, within, { left: frame.left, top: frame.top, width: 7, height: frame.height });
  addText(slide, eyebrow, {
    left: frame.left + 28, top: frame.top + 4, width: frame.width - 34, height: 26,
  }, {
    name: qaElementName({ within, role: "eyebrow" }),
    fontSize: 17, bold: true, color: COLORS.blue2, autoFit: "none",
  });
  addText(slide, wrapChineseText(item?.title || item?.body || "", 10), {
    left: frame.left + 28, top: frame.top + 42, width: frame.width - 34, height: 150,
  }, {
    name: qaElementName({ within, role: "title" }),
    fontSize: 30, bold: true, color: COLORS.dark, verticalAlignment: "top",
  });
  if (item?.title && item?.body) {
    addText(slide, wrapChineseText(item.body, 12), {
    left: frame.left + 28, top: frame.top + 190, width: frame.width - 34, height: frame.height - 198,
    }, {
      name: qaElementName({ within, role: "body" }),
      fontSize: 19, color: COLORS.body, verticalAlignment: "top", protectLineBreaks: true,
    });
  }
}

function renderEditorialRows(slide, frame, items, within) {
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
    addText(slide, item.title || item.body, {
      left: frame.left + 68, top, width: frame.width - 68, height: 38,
    }, {
      name: qaElementName({ within, role: `title-${index}` }),
      fontSize: 23, bold: true, color: COLORS.dark, verticalAlignment: "top",
    });
    if (item.title && item.body) {
      addText(slide, wrapChineseText(item.body, Math.max(18, Math.floor((frame.width - 68) / 19))), {
        left: frame.left + 68, top: top + 44, width: frame.width - 68, height: Math.max(48, rowHeight - 48),
      }, {
        name: qaElementName({ within, role: `body-${index}` }),
        fontSize: 18, color: COLORS.body, verticalAlignment: "top",
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

function renderAside(slide, frame, items, within) {
  const item = items[0];
  accentBar(slide, within, { left: frame.left, top: frame.top, width: 7, height: frame.height }, COLORS.blue2);
  addText(slide, "核心判断", {
    left: frame.left + 24, top: frame.top + 6, width: frame.width - 28, height: 26,
  }, {
    name: qaElementName({ within, role: "eyebrow" }),
    fontSize: 17, bold: true, color: COLORS.blue2, autoFit: "none",
  });
  addText(slide, wrapChineseText(item?.title || "", 9), {
    left: frame.left + 24, top: frame.top + 48, width: frame.width - 28, height: 130,
  }, {
    name: qaElementName({ within, role: "title" }),
    fontSize: 27, bold: true, color: COLORS.dark, verticalAlignment: "top",
  });
  addText(slide, wrapChineseText(item?.body || "", 13), {
    left: frame.left + 24, top: frame.top + 192, width: frame.width - 28, height: frame.height - 198,
  }, {
    name: qaElementName({ within, role: "body" }),
    fontSize: 18, color: COLORS.body, verticalAlignment: "top",
  });
}

function renderEditorialList(slide, content, layout, planPage, bodyFrame) {
  const leadPlan = planPage.textSlots.find((slot) => slot.slotId === "lead");
  const bodyPlan = planPage.textSlots.find((slot) => slot.slotId === "body");
  const leadFrame = slotFrame(layout, "lead", bodyFrame);
  const body = slotFrame(layout, "body", bodyFrame);
  zone(slide, "composition-lead", leadFrame);
  zone(slide, "composition-body", body);
  renderLead(slide, leadFrame, slotItems(content, leadPlan)[0], "composition-lead", "关键追问");
  renderEditorialRows(slide, body, slotItems(content, bodyPlan), "composition-body");
}

function renderEditorialFocus(slide, content, layout, planPage, bodyFrame) {
  const primaryPlan = planPage.textSlots.find((slot) => slot.slotId === "primary");
  const supportPlan = planPage.textSlots.find((slot) => slot.slotId === "support");
  const primaryFrame = slotFrame(layout, "primary", bodyFrame);
  const supportFrame = slotFrame(layout, "support", bodyFrame);
  zone(slide, "composition-primary", primaryFrame);
  zone(slide, "composition-support", supportFrame);
  renderLead(slide, primaryFrame, slotItems(content, primaryPlan)[0], "composition-primary", "核心能力");
  renderEditorialRows(slide, supportFrame, slotItems(content, supportPlan), "composition-support");
}

export function renderPageComposition(slide, content, layout, planPage, bodyFrame) {
  if (layout.id === "fixed-cover" || layout.id === "fixed-closing") return { componentFrame: null };
  if (layout.id === "editorial-list") {
    renderEditorialList(slide, content, layout, planPage, bodyFrame);
    return { componentFrame: null };
  }
  if (["editorial-focus", "editorial-focus-reverse"].includes(layout.id)) {
    renderEditorialFocus(slide, content, layout, planPage, bodyFrame);
    return { componentFrame: null };
  }
  const componentSlot = layout.slots.find((slot) => slot.role === "component");
  const componentFrame = componentSlot ? resolveNormalizedFrame(bodyFrame, componentSlot.frame) : null;
  if (componentFrame) zone(slide, "composition-component", componentFrame);
  const asidePlan = planPage.textSlots.find((slot) => slot.slotId === "aside");
  if (asidePlan) {
    const asideFrame = slotFrame(layout, "aside", bodyFrame);
    zone(slide, "composition-aside", asideFrame);
    renderAside(slide, asideFrame, slotItems(content, asidePlan), "composition-aside");
  }
  return { componentFrame };
}
