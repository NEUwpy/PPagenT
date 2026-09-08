import asset from '../../../assets/主题/中性编辑排版-001/asset.json' with { type: 'json' };
// Neutral editorial Skin: typography in points, matching the approved page pilots.
export const neutralEditorialTheme = Object.freeze({
  id: 'neutral-editorial-001',
  fonts: asset.fonts,
  font: asset.fonts.body, primaryColor: '#A35D4F', background: '#F5F4EF',
  surface: '#EEECE5', dark: '#20201D', body: '#4B4A45', muted: '#85837B', line: '#D8D5CC',
  typography: { componentHeading: 15.75, componentTitle: 15.75,
    componentItemTitle: 12.75, componentLead: 12.75, componentBody: 12.75,
    componentLabel: 12.75, componentMeta: 11.25 },
});
