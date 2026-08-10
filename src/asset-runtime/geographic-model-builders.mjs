import {
  THEME,
  addBox,
  addCircle,
  addLine,
  addText,
  isEmbeddedSlide,
  runGenerator,
} from "./component-builders.mjs";

export { runGenerator };

function prepareSlide(presentation, title, subtitle) {
  const slide = presentation.slides.add();
  if (isEmbeddedSlide(slide)) return slide;
  slide.background.fill = THEME.background;
  addText(slide, title, { left: 72, top: 42, width: 1040, height: 48 }, {
    fontSize: 36, bold: true, color: THEME.accent,
  });
  addText(slide, subtitle, { left: 74, top: 92, width: 720, height: 26 }, {
    fontSize: 16, color: THEME.muted,
  });
  return slide;
}

export function buildGeographicNetwork(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "地域网络分布");
  const locations = params.locations.slice(0, 10);
  const stats = params.stats.slice(0, 5);
  if (locations.length < 3 || stats.length < 2) throw new Error("地域网络分布至少需要 3 个地点和 2 项统计");
  const map = { left: 52, top: 148, width: 850, height: 500 };
  addBox(slide, map, {
    fill: "#EEF5FA", line: { style: "dashed", fill: "#B7CCDE", width: 1.5 }, shadow: "shadow-none",
  });
  [
    { left: 150, top: 260, width: 260, height: 160 },
    { left: 360, top: 210, width: 310, height: 210 },
    { left: 600, top: 300, width: 230, height: 145 },
    { left: 410, top: 430, width: 250, height: 120 },
  ].forEach((blob, index) => addBox(slide, blob, {
    geometry: "ellipse", fill: index % 2 ? "#D9E8F3" : "#E1EDF6",
    line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
  }));
  for (let index = 1; index < 5; index += 1) {
    addLine(slide, { x: map.left + index * map.width / 5, y: map.top }, { x: map.left + index * map.width / 5, y: map.top + map.height }, "#DCE7F0", 1);
    addLine(slide, { x: map.left, y: map.top + index * map.height / 5 }, { x: map.left + map.width, y: map.top + index * map.height / 5 }, "#DCE7F0", 1);
  }
  const points = new Map(locations.map((location) => [location.id, {
    x: map.left + 40 + Math.max(0, Math.min(1, location.x)) * (map.width - 80),
    y: map.top + 40 + Math.max(0, Math.min(1, location.y)) * (map.height - 80),
  }]));
  params.routes.slice(0, 12).forEach((route) => {
    const from = points.get(route.from);
    const to = points.get(route.to);
    if (from && to) addLine(slide, from, to, THEME.accentAlt, 3);
  });
  locations.forEach((location, index) => {
    const point = points.get(location.id);
    addCircle(slide, { left: point.x - 17, top: point.y - 17, width: 34, height: 34 }, {
      fill: index ? THEME.accent : "#E29B62", line: { style: "solid", fill: "#FFFFFF", width: 3 }, shadow: "shadow-md",
      text: String(index + 1), fontSize: 13, bold: true, color: "#FFFFFF",
    });
    addBox(slide, { left: point.x - 62, top: point.y + 22, width: 124, height: 42 }, {
      fill: "#FFFFFF", line: { style: "solid", fill: "#C9D9E6", width: 1 }, shadow: "shadow-sm",
      text: `${location.name}\n${location.value}`, fontSize: 12, color: THEME.body,
      insets: { top: 2, right: 4, bottom: 2, left: 4 },
    });
  });
  addBox(slide, { left: 930, top: 148, width: 300, height: 500 }, {
    fill: "#173F68", line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-md",
  });
  addText(slide, params.panelTitle, { left: 960, top: 176, width: 240, height: 38 }, {
    fontSize: 23, bold: true, color: "#FFFFFF", alignment: "center",
  });
  stats.forEach((stat, index) => addBox(slide, { left: 962, top: 238 + index * 78, width: 236, height: 62 }, {
    fill: index % 2 ? "#225982" : "#2A6895", line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
    text: `${stat.value}  ${stat.label}`, fontSize: 18, bold: true, color: "#FFFFFF", alignment: "left",
    insets: { top: 8, right: 12, bottom: 8, left: 14 },
  }));
  return slide;
}
