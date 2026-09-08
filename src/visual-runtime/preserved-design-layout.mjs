import { resolveComponentTypography } from './html-component-theme.mjs';
import { listTextPrimitives } from './text-primitives.mjs';

// Representative sizes, not three different drawings. Intermediate frames still fit.
export const preservedSizeExamples = Object.freeze({ large: 1, medium: 0.85, small: 0.7 });

export function preservedTypography(scale, theme = {}) {
  const base = { ...resolveComponentTypography(theme), funnelStepTitle: theme.typography?.componentLabel ?? 15 };
  const primitives = Object.fromEntries(listTextPrimitives().map(p => [p.id, p.fontSizesPt]));
  const roles = {
    componentHeading: ['heading', 'heading'], componentTitle: ['title', 'heading'],
    componentItemTitle: ['item-title', 'heading'], componentLead: ['lead', 'heading'],
    componentBody: ['body', 'body'], componentLabel: ['label', 'label'], componentMeta: ['meta', 'annotation'],
    funnelStepTitle: ['funnel-step-title', 'label'],
  };
  const sizes = {}, css = [];
  for (const [role, [token, primitive]] of Object.entries(roles)) {
    const skinRole = role === 'funnelStepTitle' ? 'componentLabel' : role;
    // An explicitly assigned Skin size stays fixed unless Skin also supplies its allowed tiers.
    const tiers = theme.typographyTiers?.[skinRole] ?? (theme.typography?.[skinRole] != null ? [base[role]] : [...primitives[primitive], base[role]]);
    const skinAssigned = theme.typography?.[skinRole] != null;
    if (!Array.isArray(tiers) || !tiers.length || tiers.some(n => !Number.isFinite(n) || (skinAssigned ? n <= 0 : n < 12))) {
      throw new Error(`${skinRole} 字号档位必须是至少 12 pt 的非空数值数组`);
    }
    const allowed = [...new Set(tiers)].filter(n => n <= base[role]).sort((a,b) => b-a);
    if (!allowed.length) throw new Error(`${skinRole} 没有不超过 Skin 设定字号的可用档位`);
    const target = base[role] * Math.min(1, scale);
    sizes[role] = allowed.reduce((best,n) => Math.abs(n-target) < Math.abs(best-target) ? n : best);
    css.push(`--ppagent-${role === 'funnelStepTitle' ? token : `component-${token}`}-size:${sizes[role]}pt`);
  }
  return { sizes, base, css: css.join(';'),
    // Accessories can shrink, but their text and glyphs retain usable breathing room.
    accessoryScale: Math.min(1, Math.max(scale, 0.8, sizes.componentMeta / 15)),
  };
}

// Move and uniformly resize existing geometry; typography is laid out separately.
export function fitPreservedDesign(frame, bounds = { left: 0, top: 0, width: 1170, height: 492 }) {
  if (!frame || ![frame.width, frame.height].every(v => Number.isFinite(v) && v > 0)) {
    throw new Error('结构适配区域需要有限正数宽高');
  }
  const scale = Math.min(frame.width / bounds.width, frame.height / bounds.height);
  const left = (frame.width - bounds.width * scale) / 2 - bounds.left * scale;
  const top = (frame.height - bounds.height * scale) / 2 - bounds.top * scale;
  return {
    scale, left, top, frame,
    point: p => ({ x: left + p.x * scale, y: top + p.y * scale }),
    viewBox: `${-left / scale} ${-top / scale} ${frame.width / scale} ${frame.height / scale}`,
  };
}
