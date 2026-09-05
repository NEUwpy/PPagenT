import { defaultStructurePrimaryColor } from "../../visual-runtime/html-component-theme.mjs";

export const northeasternUniversityTheme = Object.freeze({
  // Source: 阶段门禁流程-004 gate-check, the structure's strongest emphasis blue.
  primaryColor: defaultStructurePrimaryColor,
  background: "#FFFFFF",
  surface: "#FFFFFF",
  dark: "#2B2B2B",
  body: "#404040",
  muted: "#6F6F6F",
  font: "Microsoft YaHei",
  typography: Object.freeze({
    componentHeading: 22,
    componentTitle: 20,
    componentItemTitle: 18,
    componentLead: 16,
    componentBody: 14,
    componentLabel: 14,
    componentMeta: 12,
  }),
});
