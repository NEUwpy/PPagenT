import { northeasternUniversitySkin } from './northeastern-university-contract.mjs';
import { MINIMUM_READABLE_FONT_SIZE_PT } from '../typography-standards.mjs';

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
    componentBody: t.body * .75, componentLabel: t.body * .75,
    // 组件尺度是页面尺度的 .75 倍，meta 的原始值 14 乘下来只有 10.5 pt，低于全项目
    // 可读性下限。这里不抬 t.meta（那会连页面级字号一起改），只把结果托到下限，
    // 让"组件比页面小"的比例关系保留，同时不再产出读不清的标注文字。
    componentMeta: Math.max(MINIMUM_READABLE_FONT_SIZE_PT, t.meta * .75),
  }),
});
