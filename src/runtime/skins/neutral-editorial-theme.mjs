import asset from '../../../assets/主题/中性编辑排版-001/asset.json' with { type: 'json' };
import { derivePrimaryTheme } from './primary-tone-palette.mjs';
// Neutral editorial Skin: typography in points, matching the approved page pilots.
export const neutralEditorialTheme = Object.freeze(derivePrimaryTheme({
  id: 'neutral-editorial-001',
  fonts: asset.fonts,
  font: asset.fonts.body,
  // 这份 typography 是全部 catalog/structure-skins/*.json 派生 Skin 的共同基底
  // （listStructureSkins 把 neutralEditorialTheme.typography 直接传进 derivePrimaryTheme），
  // 所以这里改一个值等于改所有派生 Skin。componentMeta 原为 11.25，低于全项目可读性下限，
  // 现托到 12；其余档位都在下限之上，不动。
  typography: { componentHeading: 15.75, componentTitle: 15.75,
    componentItemTitle: 12.75, componentLead: 12.75, componentBody: 12.75,
    componentLabel: 12.75, componentMeta: 12 },
}, asset.mainColor));
