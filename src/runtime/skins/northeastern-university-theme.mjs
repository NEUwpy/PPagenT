export const northeasternUniversityTheme = Object.freeze({
  // Anchor to the existing university banner, not the generic structure palette.
  // Source: runtime-template.pptx body banner, left-middle blue (#3361AE).
  // The template currently embeds that gradient in artwork; this seed controls
  // native body/structure accents, not a parametric recoloring of the artwork.
  primaryColor: "#3361AE",
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
