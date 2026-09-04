import { academicReportShell } from "../shells/academic-report.mjs";
import { northeasternUniversityTheme } from "./northeastern-university-theme.mjs";

/** Lightweight Skin contract used during planning; contains no PPT runtime. */
export const northeasternUniversitySkin = {
  id: "northeastern-university-001",
  shell: academicReportShell,
  bodyFrame: academicReportShell.slots.contentFrame,
  componentSourceFrame: academicReportShell.slots.contentFrame,
  componentTheme: northeasternUniversityTheme,
  typographyRoles: {
    displayTypeface: "HYWenRunSongYun U",
    bodyTypeface: "Microsoft YaHei",
    coverTitle: { fontSizes: [64, 58, 52], maxLines: 2, lineHeight: 1.15 },
    coverSubtitle: { fontSizes: [30, 28, 26], maxLines: 2, lineHeight: 1.2 },
    coverMeta: { fontSizes: [24, 22, 20], maxLines: 2, lineHeight: 1.2 },
    agendaItems: { fontSizes: [24, 22, 20], maxLines: 5, lineHeight: 1.35 },
    pageTitle: { fontSizes: [32], maxLines: 1, lineHeight: 1.1 },
    closingTitle: {
      fontSizes: [40, 36, 32],
      maxLines: 3,
      lineHeight: 1.15,
      glyphWidthFactor: 1.25,
    },
    composition: {
      leadTitle: { fontSizes: [30, 27, 24], maxLines: 4 },
      leadBody: { fontSizes: [19, 18, 17], maxLines: 6 },
      rowTitle: { fontSizes: [23, 21, 19], maxLines: 1 },
      rowBody: { fontSizes: [18, 17, 16], maxLines: 4 },
      asideTitle: { fontSizes: [27, 24, 22], maxLines: 4 },
      asideBody: { fontSizes: [18, 17, 16], maxLines: 8 },
      singleTitle: { fontSizes: [36, 32, 28], maxLines: 2 },
      singleBody: { fontSizes: [24, 22, 20], maxLines: 5 },
      singleSupport: { fontSizes: [19, 18, 17], maxLines: 3 },
      dualTitle: { fontSizes: [32, 29, 26], maxLines: 2 },
      dualBody: { fontSizes: [21, 19, 17], maxLines: 7 },
      bandTitle: { fontSizes: [19, 18, 17], maxLines: 2 },
      bandBody: { fontSizes: [18, 17, 16], maxLines: 2 },
    },
  },
};
