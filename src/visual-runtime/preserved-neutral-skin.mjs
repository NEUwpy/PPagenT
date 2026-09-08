// Explicit semantic adaptation for the three preserved pilots only.
// Shapes, paths, topology and type sizes remain owned by their original builds.
export function preservedNeutralSkinCss(componentId, theme) {
  if (theme.id !== 'neutral-editorial-001') return '';
  const display = JSON.stringify(theme.fonts?.display ?? theme.font ?? 'Noto Serif SC');
  const common = `[data-ppt-root] .ppagent-text-primitive--heading,[data-ppt-root] .simple-step-title{font-family:${display}}
  [data-ppt-root] [data-ppt-shadow]{box-shadow:none}
  [data-ppt-root] .ppagent-text-primitive--body,[data-ppt-root] .ppagent-text-list__item{color:var(--ppagent-color-body)}`;
  const css = {
    'parallel-folded-notes-grid': `
      .notes-adapted .note-sheet-paper{fill:var(--ppagent-color-background);stroke:var(--ppagent-color-line)}
      .notes-adapted .note-card .note-sheet-header{fill:var(--ppagent-color-surface)}
      .notes-adapted .note-sheet-fold{fill:var(--ppagent-color-surface);stroke:var(--ppagent-color-muted)}
      .notes-adapted .note-sheet-shadow{fill:var(--ppagent-color-line);opacity:.35}
      .notes-adapted .note-icon-panel{background:transparent}
      .notes-adapted .note-icon-slot{color:var(--ppagent-color-primary)}
      .notes-adapted .note-card[data-has-title="true"] .note-text-region .ppagent-text-primitive--heading{color:var(--ppagent-color-dark)}`,
    'convergence-simple-funnel': `
      .simple-funnel-adapted .simple-funnel-step-body{fill:var(--ppagent-color-surface);stroke:var(--ppagent-color-muted);stroke-width:1}
      .simple-funnel-adapted .simple-funnel-step-cap{fill:var(--ppagent-color-background);stroke:var(--ppagent-color-muted);stroke-width:1}
      .simple-funnel-adapted .simple-step-title{color:var(--ppagent-color-dark)}
      .simple-funnel-adapted .simple-input-core{background:var(--ppagent-color-background);border-color:var(--ppagent-color-line);color:var(--ppagent-color-primary);box-shadow:none}
      .simple-funnel-adapted .simple-input-marker-text{color:var(--ppagent-color-dark)}
      .simple-funnel-adapted .simple-funnel-orbit ellipse{stroke:var(--ppagent-color-line)}
      .simple-funnel-adapted .simple-flow-arrow{opacity:.6}`,
    'progression-maturity-steps': `
      .maturity-ladder .level-support{fill:var(--ppagent-color-surface)}
      .maturity-ladder .step-top{fill:var(--ppagent-color-background);stroke:var(--ppagent-color-muted);stroke-width:1}
      .maturity-ladder .step-riser{fill:var(--ppagent-color-line);stroke:var(--ppagent-color-muted);stroke-width:1}
      .maturity-ladder .step-inset,.maturity-ladder .projection-edge{stroke:var(--ppagent-color-line);stroke-width:1}
      .maturity-ladder .level-copy .ppagent-text-primitive--heading{color:var(--ppagent-color-dark)}
      .maturity-ladder .level-index,.maturity-ladder .status-tag{background:var(--ppagent-color-background);color:var(--ppagent-color-primary);border-color:var(--ppagent-color-line);box-shadow:none}`,
  }[componentId];
  return css ? `<style>${common}${css}</style>` : '';
}
