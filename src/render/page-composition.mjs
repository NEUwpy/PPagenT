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

/**
 * 旧方案回放的角色分带兼容表；新方案由 bandItemIds 显式指定位置。
 *   criterion 选择依据/判断准则——它是**判断的尺子**，不是被比较的第 N 个对象
 *   global    贯穿整个过程、作用于全部步骤的规则——它不是"第 N 步"
 * R1 首版把准则画成第三张并列卡片、把 global 编号成第四步，就是这两条没被表达出来。
 */
export const BAND_ROLES = Object.freeze(["criterion", "global"]);

/**
 * 按页面位置分带；无位置字段时兼容历史角色分带。历史 state 没有 role 字段，
 * 因此它们的 `--replay` 渲染结果逐字不变，这是这次改动的硬边界。
 */
export function splitByRole(items) {
  // placement 来自页面方案；只有旧方案没有显式位置时才沿用历史 role 行为。
  const isBand = (item) => item.placement === undefined
    ? BAND_ROLES.includes(item?.role) : item.placement === "band";
  const band = items.filter(isBand);
  const main = items.filter((item) => !isBand(item));
  return { main, band };
}

export function applySlotPlacement(item, slotPlan) {
  if (!Array.isArray(slotPlan.bandItemIds)) return item;
  return { ...item, placement: slotPlan.bandItemIds.includes(item.id) ? "band" : "main" };
}

// 新方案中标题已经独立显示时，正文不重复同一个精确标签；不改变来源正文。
export function withoutRepeatedLabel(item, slotPlan) {
  if (!Array.isArray(slotPlan.bandItemIds) || slotPlan.contentMode === "body" || !item.title) return item;
  for (const colon of ["：", ":"]) {
    const prefix = item.title + colon;
    if (item.body?.startsWith(prefix)) return { ...item, body: item.body.slice(prefix.length).trimStart() };
  }
  return item;
}

export function supportsBand(layoutId, slotId) {
  return (layoutId === "editorial-grid" && slotId === "body")
    || (layoutId === "editorial-list" && slotId === "body")
    || (["editorial-focus", "editorial-focus-reverse"].includes(layoutId) && slotId === "support");
}

/**
 * 区域帧按角色切开：主区（编号项）在上，独立带（准则/全程规则）在下。
 * 没有被抽出的条目时**原样返回 frame**，一个像素都不动。
 */
export function splitRegionFrame(frame, bandCount) {
  if (!bandCount) return { mainFrame: frame, bandFrame: null };
  const height = Math.min(132, Math.max(84, frame.height * 0.3));
  const gap = 12;
  return {
    mainFrame: { ...frame, height: Math.max(0, frame.height - height - gap) },
    bandFrame: { left: frame.left + 58, top: frame.top + frame.height - height, width: frame.width - 116, height },
  };
}

/** 独立带的正文：各条「短标签：正文」逐行拼接，**不编号**。形状照抄 editorial-single-focus 的 support 带。 */
export function roleBandText(band) {
  return band.map((item) => [item.title, item.body].filter(Boolean).join("：")).join("\n");
}

/** 底部独立带：各条「短标签：正文」，从头到尾没有序号。真值函数，返回是否画了东西。 */
export function renderRoleBand(slide, within, bandFrame, band, typographyRoles) {
  if (!band.length || !bandFrame) return false;
  zone(slide, within, bandFrame);
  const fitted = fittedCompositionText(roleBandText(band), bandFrame, "singleSupport", typographyRoles);
  addText(slide, fitted.text, bandFrame, {
    name: qaElementName({ within, role: "band" }),
    typeface: typographyRoles.bodyTypeface, fontSize: fitted.fontSize, color: COLORS.muted,
    verticalAlignment: "middle", autoFit: "none",
  });
  return true;
}

/**
 * 只画得出**一条**的区域。凡是渲染器里用 `slotItems(...)[0]` 取条目的区都在这里：
 *   lead    renderEditorialList / renderComponentLeadBand
 *   aside   内容版式的旁栏（renderAside 也取 items[0]）
 *   left/right  editorial-dual-statement 的左右两栏
 * 多绑的条目会被**静默丢掉**——页面上找不到，蓝图上却写着，而门禁全过（2026-09-13 R1 重跑实证）。
 * `primary` 只在 focus 系是单条：editorial-single-focus 的 primary 是"主条 + 底部支持行"，吃得下多条。
 */
const ALWAYS_SINGLE_ITEM_SLOTS = Object.freeze(["lead", "aside", "left", "right"]);
const SINGLE_PRIMARY_LAYOUTS = Object.freeze(["editorial-focus", "editorial-focus-reverse"]);

/** 某个版式下只画得出第一条的区域 id。渲染器与两份预检孪生体共用这一份，避免各写一套再漂移。 */
export function singleItemSlotIds(layoutId) {
  return SINGLE_PRIMARY_LAYOUTS.includes(layoutId)
    ? [...ALWAYS_SINGLE_ITEM_SLOTS, "primary"]
    : [...ALWAYS_SINGLE_ITEM_SLOTS];
}

/**
 * 方案结构本身合不合法——**不需要构建就能判**，所以它是一条硬闸门，不是"预检提示"。
 * 两条边界都源自同一类缺陷：渲染器只认第一条，多出来的条目静默消失。
 *
 *   ① duplicate-slot          同一个 slotId 在 textSlots 里出现两次；渲染器用 `.find()` 只认第一次，
 *                             后写的那条整条作废（R1 重跑就是这么丢掉「选择依据」的）。
 *   ② slot-capacity-exceeded  只画一条的区域绑了多条；渲染器取 `[0]`，其余作废。
 *
 * 返回空数组 = 合法。消息里带区域名与条数，模型照着改就行。
 */
export function planStructureIssues(layoutId, planPage) {
  const issues = [];
  const slots = planPage?.textSlots ?? [];
  for (const slot of slots) {
    const band = slot.bandItemIds;
    if (band === undefined) continue; // 历史方案不迁移。
    if (!Array.isArray(band) || new Set(band).size !== band.length
      || band.some((id) => !slot.sourceItemIds?.includes(id))) {
      issues.push({ code: "invalid-band-items", slotId: slot.slotId, message: "辅助带必须引用本区域内不重复的内容项。" });
    } else if (band.length && !supportsBand(layoutId, slot.slotId)) {
      issues.push({ code: "unsupported-band", slotId: slot.slotId, message: "此区域不支持独立辅助带，请换区域或版式。" });
    } else if (band.length && band.length === slot.sourceItemIds.length) {
      issues.push({ code: "empty-main-region", slotId: slot.slotId, message: "所有内容都被放进辅助带，主区为空。若这些条目就是本页主题，请保留在主区；语义为准则不代表次要内容。" });
    }
  }
  const seen = new Map();
  for (const slot of slots) {
    const slotId = slot?.slotId;
    seen.set(slotId, (seen.get(slotId) ?? 0) + 1);
  }
  for (const [slotId, count] of seen) {
    if (count > 1) {
      issues.push({
        code: "duplicate-slot",
        slotId,
        count,
        message: `区域 ${slotId} 在方案里出现了 ${count} 次；渲染器只认第一次，后写的那些条目不会出现在页面上。请把该区域的条目合并到同一条里，或换一个版式。`,
      });
    }
  }
  const single = singleItemSlotIds(layoutId);
  for (const slot of slots) {
    if (!single.includes(slot?.slotId)) continue;
    const count = (slot.sourceItemIds ?? []).length;
    if (count > 1) {
      issues.push({
        code: "slot-capacity-exceeded",
        slotId: slot.slotId,
        count,
        capacity: 1,
        message: `区域 ${slot.slotId} 只画 1 条，方案却绑了 ${count} 条；多出来的不会出现在页面上。请该区域只绑一条，或换用支持多条内容的版式；辅助内容的位置用 bandItemIds 显式指定。`,
      });
    }
  }
  return issues;
}

/**
 * 抬头的短标签（renderLead 上方那行小字）。默认沿用原有文案；
 * 方案可以给 `leadLabel` 覆盖它——首版硬编码的「核心能力」在原稿里没有出处，是编造。
 */
function leadLabel(planPage, fallback) {
  const label = typeof planPage?.leadLabel === "string" ? planPage.leadLabel.trim() : "";
  return label || fallback;
}

function itemMap(content) {
  return new Map(content.items.map((item) => [item.id, item]));
}

function bindClosingPunctuation(value) {
  return String(value ?? "").replace(/([\p{Script=Han}A-Za-z0-9])([。！？；])/gu, "$1\u2060$2");
}

function editorialItem(item) {
  const pointText = (item.points ?? [])
    .map((point) => String(point?.text ?? point ?? "").trim())
    .filter(Boolean)
    .map((point) => `•\u2060${point}`)
    .join("\n");
  return {
    ...item,
    title: bindClosingPunctuation(item.title),
    body: bindClosingPunctuation([item.body, pointText].filter(Boolean).join("\n")),
  };
}

function slotItems(content, slotPlan) {
  const byId = itemMap(content);
  return slotPlan.sourceItemIds.map((id) => byId.get(id)).filter(Boolean).map(editorialItem).map((item) => withoutRepeatedLabel(applySlotPlacement(item, slotPlan), slotPlan)).map((item) => {
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
  const columns = itemCount <= 1 ? 1 : itemCount === 3 || itemCount >= 5 ? 3 : 2;
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
  const { main, band } = splitByRole(plan ? slotItems(content, plan) : []);
  const { mainFrame, bandFrame } = splitRegionFrame(frame, band.length);
  // 编号只发给方案指定的主区项，辅助项不占序号。
  gridItemFrames(mainFrame, main.length).forEach((itemFrame, index) => {
    const item = main[index];
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
  renderRoleBand(slide, "composition-grid-band", bandFrame, band, typographyRoles);
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
  const region = slotFrame(layout, "body", bodyFrame);
  const { main, band } = splitByRole(slotItems(content, bodyPlan));
  const { mainFrame, bandFrame } = splitRegionFrame(region, band.length);
  zone(slide, "composition-lead", leadFrame);
  zone(slide, "composition-body", mainFrame);
  renderLead(slide, leadFrame, slotItems(content, leadPlan)[0], "composition-lead", leadLabel(planPage, "关键追问"), typographyRoles);
  renderEditorialRows(slide, mainFrame, main, "composition-body", typographyRoles);
  renderRoleBand(slide, "composition-band", bandFrame, band, typographyRoles);
}

function renderEditorialFocus(slide, content, layout, planPage, bodyFrame, typographyRoles) {
  const primaryPlan = planPage.textSlots.find((slot) => slot.slotId === "primary");
  const supportPlan = planPage.textSlots.find((slot) => slot.slotId === "support");
  const primaryFrame = slotFrame(layout, "primary", bodyFrame);
  const region = slotFrame(layout, "support", bodyFrame);
  const { main, band } = splitByRole(slotItems(content, supportPlan));
  const { mainFrame, bandFrame } = splitRegionFrame(region, band.length);
  zone(slide, "composition-primary", primaryFrame);
  zone(slide, "composition-support", mainFrame);
  renderLead(slide, primaryFrame, slotItems(content, primaryPlan)[0], "composition-primary", leadLabel(planPage, "核心能力"), typographyRoles);
  renderEditorialRows(slide, mainFrame, main, "composition-support", typographyRoles);
  renderRoleBand(slide, "composition-band", bandFrame, band, typographyRoles);
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
  // 方案结构先判：渲染器画不出来的条目，容量检查也看不见（它同样只取第一条）。
  const issues = [...planStructureIssues(layout.id, planPage)];
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
  // 独立带的预检。帧必须与 renderRoleBand 用同一个 splitRegionFrame，否则会冒出假的 divergence 警告。
  const checkBand = (frame, band, slotId) => {
    if (!band.length) return;
    check(roleBandText(band), splitRegionFrame(frame, band.length).bandFrame, "singleSupport", slotId);
  };
  const checkRows = (slotId) => {
    const plan = planPage.textSlots.find((slot) => slot.slotId === slotId);
    if (!plan) return;
    const region = slotFrame(layout, slotId, bodyFrame);
    const { main: items, band } = splitByRole(slotItems(content, plan));
    const frame = splitRegionFrame(region, band.length).mainFrame;
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
    checkBand(region, band, slotId);
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
    const region = slotFrame(layout, "body", bodyFrame);
    const { main: items, band } = splitByRole(plan ? slotItems(content, plan) : []);
    const frame = splitRegionFrame(region, band.length).mainFrame;
    gridItemFrames(frame, items.length).forEach((itemFrame, index) => {
      const item = items[index];
      check(item?.title, {
        left: itemFrame.left + 28, top: itemFrame.top + 30, width: itemFrame.width - 48, height: 38,
      }, "rowTitle", "body");
      check(item?.body, {
        left: itemFrame.left + 28, top: itemFrame.top + 78, width: itemFrame.width - 48, height: itemFrame.height - 96,
      }, "rowBody", "body");
    });
    checkBand(region, band, "body");
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
  // 失败关闭：方案结构不合法就**不画**，而不是画一半再把剩下的静静丢掉。
  // check_pages 会在构建前就拦下这种方案，所以正常路径到不了这里；留这一手是防有人绕过预检直接调渲染器。
  const structural = planStructureIssues(layout.id, planPage);
  if (structural.length) {
    throw new Error(`页面方案结构不合法：${structural.map((issue) => issue.message).join(" ")}`);
  }
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
