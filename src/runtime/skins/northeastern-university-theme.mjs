export const northeasternUniversityTheme = Object.freeze({
  // Anchor to the existing university banner, not the generic structure palette.
  // Source: runtime-template.pptx body banner, left-middle blue (#3361AE).
  // The template currently embeds that gradient in artwork; this seed controls
  // native body/structure accents, not a parametric recoloring of the artwork.
  primaryColor: "#3361AE",
  background: "#FFFFFF",
  surface: "#FFFFFF",
  regionSurface: "#F1F5FB",
  headingSurface: "#E7EEF9",
  line: "#C9D7ED",
  layoutStyle: "mckinsey",
  regionAccent: "#C45B13",
  regionHeadingFont: "汉仪粗宋简",
  regionEnglishFont: "Times New Roman",
  structureFinish: "academic-flat",
  regionEnglish: "#E7E6E6",
  regionOutline: "#B4C9E8",
  regionGradientStart: "#F0F5FC",
  // Compiled from 大学Skin设计提示词-v1.md: hierarchy first, light-blue
  // local grouping, and a restrained side rule instead of card walls.
  grayRegionTreatment: Object.freeze({
    heading: 'academic-reference',
    body: 'side-rule-text',
    surface: 'local-group',
    bodyInset: 20,
    headingInset: 16,
  }),
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
