import asset from '../../../assets/主题/中性编辑排版-001/asset.json' with { type: 'json' };
import { derivePrimaryTheme } from './primary-tone-palette.mjs';
// Neutral editorial Skin: typography in points, matching the approved page pilots.
export const neutralEditorialTheme = Object.freeze(derivePrimaryTheme({
  id: 'neutral-editorial-001',
  fonts: asset.fonts,
  font: asset.fonts.body,
  typography: { componentHeading: 15.75, componentTitle: 15.75,
    componentItemTitle: 12.75, componentLead: 12.75, componentBody: 12.75,
    componentLabel: 12.75, componentMeta: 11.25 },
}, asset.mainColor));
