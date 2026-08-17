/**
 * 通用学术汇报正文 Shell 的固定几何契约。
 *
 * 坐标来自 PPT源/PPT模板-封面正文尾页.pptx 第 3 页与当前东北大学
 * Skin 的实际运行区域。学校 Logo、颜色、字体和页注文案属于 Skin，
 * 不属于本文件定义的几何骨架。
 */
export const academicReportShell = {
  id: "academic-report-shell-001",
  slideSize: { width: 1280, height: 720 },
  slots: {
    pageNumber: { left: 44.45, top: 31.9, width: 71.23, height: 48.47 },
    sectionLabel: { left: 98.87, top: 31.9, width: 177.93, height: 45.24 },
    logo: { left: 984.21, top: 20.82, width: 280.94, height: 62.29 },
    titleBand: { left: 35.17, top: 87.55, width: 1209.67, height: 52.42 },
    pageTitle: { left: 9.04, top: 88.85, width: 1250.55, height: 48.47 },
    contentFrame: { left: 55, top: 166, width: 1170, height: 492 },
    bottomReserve: { left: 35.17, top: 658, width: 1209.67, height: 62 },
  },
  rules: {
    titleDividerY: 147.22,
    bottomRuleY: 689.24,
    logicFrame: "contentFrame",
    componentSizing: "responsive-within-frame",
    shellOwned: ["pageNumber", "sectionLabel", "logo", "titleBand", "pageTitle", "bottomReserve"],
    componentOwned: ["contentFrame"],
  },
};
