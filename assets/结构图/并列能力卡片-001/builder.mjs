import {
  THEME,
  addBox,
  addCircle,
  addText,
  addTitle,
  isEmbeddedSlide,
  qaElementName,
} from "../../../src/asset-runtime/component-builders.mjs";

/**
 * 这是 parallel-cards-p135 审美定稿后的原生 PPT Builder。
 * HTML/CSS 保留为入库设计与 State 审核工作台；正式生成只调用本 Builder。
 */
export function buildParallelCards(presentation, params) {
  const slide = presentation.slides.add();
  if (!isEmbeddedSlide(slide)) {
    slide.background.fill = THEME.background;
    addTitle(slide, params.title, "并列关系 · 同级能力");
  }

  const items = params.items ?? [];
  if (!Array.isArray(items) || items.length < 3 || items.length > 7) {
    throw new Error("并列能力卡片支持 3–7 项");
  }

  const gap = 20;
  const left = 78;
  const width = (1124 - gap * (items.length - 1)) / items.length;
  items.forEach((item, index) => {
    const x = left + index * (width + gap);
    const primary = index % 2 ? "#4C88E8" : "#2F5EA8";
    const panelId = `parallel-card-${index}`;
    addBox(slide, { left: x, top: 190, width, height: 390 }, {
      name: qaElementName({ parent: panelId, domains: ["parallel-card", "parallel-content"] }),
      fill: index % 2 ? "#F1F8FF" : "#F7FBFF",
      line: { style: "solid", fill: index % 2 ? "#7EB7ED" : "#A8CBEA", width: 1.4 },
      shadow: "shadow-sm",
    });
    addBox(slide, { left: x, top: 190, width, height: 8 }, {
      name: qaElementName({ within: panelId, role: "accent-rail" }),
      geometry: "rect",
      fill: primary,
      line: { style: "solid", fill: "none", width: 0 },
      shadow: "shadow-none",
      borderRadius: 0,
    });
    addCircle(slide, { left: x + 20, top: 222, width: 54, height: 54 }, {
      name: qaElementName({ within: panelId, role: "index" }),
      fill: primary,
      line: { style: "solid", fill: "#FFFFFF", width: 2 },
      shadow: "shadow-none",
      text: String(index + 1).padStart(2, "0"),
      fontSize: 17,
      bold: true,
      color: "#FFFFFF",
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    addText(slide, item.title, { left: x + 20, top: 310, width: width - 40, height: 55 }, {
      name: qaElementName({ within: panelId, role: "title" }),
      fontSize: 22,
      bold: true,
      color: "#174D87",
      alignment: "center",
    });
    addText(slide, item.body ?? "", { left: x + 22, top: 382, width: width - 44, height: 100 }, {
      name: qaElementName({ within: panelId, role: "body" }),
      fontSize: 17,
      color: "#607895",
      alignment: "center",
      verticalAlignment: "top",
    });
  });
  return slide;
}
