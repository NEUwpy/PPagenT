import { northeasternUniversitySkin } from './northeastern-university-contract.mjs';

// Independent page authoring uses design px; preserved HTML typography uses pt.
export const universityMckinseyTypography = Object.freeze({ title: 32, heading: 21, body: 18, meta: 14, metric: 36 });
const t = universityMckinseyTypography;
export const universityMckinseySkin = Object.freeze({
  ...northeasternUniversitySkin.componentTheme,
  id: northeasternUniversitySkin.id,
  layout: 'mckinsey',
  bodyFrame: northeasternUniversitySkin.bodyFrame,
  fonts: Object.freeze({
    display: northeasternUniversitySkin.typographyRoles.displayTypeface,
    body: northeasternUniversitySkin.typographyRoles.bodyTypeface,
  }),
  structureHeadingFont: northeasternUniversitySkin.typographyRoles.bodyTypeface,
  typography: Object.freeze({
    componentHeading: t.heading * .75, componentTitle: t.heading * .75,
    componentItemTitle: t.heading * .75, componentLead: t.body * .75,
    componentBody: t.body * .75, componentLabel: t.body * .75, componentMeta: t.meta * .75,
  }),
});
