// Adapt paint roles before HTML measurement, so the native compiler sees the
// same result as the dashboard. Geometry, content and font capacity stay intact.
const colorToken = /#[\da-f]{8}\b|#[\da-f]{6}\b|#[\da-f]{3}\b|rgba?\([^)]*\)|\bwhite\b|\bblack\b/gi;
const pilot = /(?:notes-adapted|simple-funnel-adapted|maturity-ladder)/;
const accentRole = /icon|badge|marker|accent|dot|bullet|highlight|code|status|polarity/i;

function lightness(token) {
  if (token.toLowerCase() === 'white') return 1;
  if (token.toLowerCase() === 'black') return 0;
  let rgb;
  if (token.startsWith('#')) {
    let hex = token.slice(1, 7);
    if (hex.length === 3) hex = [...hex].map(c => c+c).join('');
    rgb = [0,2,4].map(i => parseInt(hex.slice(i,i+2),16));
  } else rgb = token.match(/[\d.]+/g)?.slice(0,3).map(Number);
  return rgb ? (Math.max(...rgb) + Math.min(...rgb)) / 510 : 0.5;
}

function paint(value, role, theme) {
  return value.replace(colorToken, token => {
    const l = lightness(token);
    const color = role === 'text' ? theme.body : role === 'title' ? theme.dark
      : role === 'accent' ? theme.primaryColor : role === 'line' ? theme.line
      : role === 'relation' ? theme.muted
      : l > .94 ? theme.background : l > .7 ? theme.surface : theme.line;
    // Retain authored transparency without copying the old hue.
    const alpha = token.startsWith('#') && token.length === 9 ? token.slice(7) : null;
    const rgbaAlpha = /^rgba/i.test(token) ? token.match(/,\s*([\d.]+)\s*\)$/)?.[1] : null;
    if (alpha) return color + alpha;
    if (rgbaAlpha) return `rgba(${[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)).join(',')},${rgbaAlpha})`;
    return color;
  }).replace(/var\(--ppagent-color-([\w-]+)(?:,[^)]*)?\)/g, (_,token) => {
    if (role === 'title') return theme.dark;
    if (role === 'text') return theme.body;
    if (role === 'accent') return theme.primaryColor;
    if (role === 'relation') return theme.muted;
    if (role === 'line') return theme.line;
    return /wash|background/.test(token) ? theme.background : /pale|surface|soft/.test(token) ? theme.surface : theme.line;
  });
}

function declarations(source, context, theme) {
  return source.replace(/([\w-]+)\s*:\s*([^;{}]+)/g, (all, property, value) => {
    if (/url\(/i.test(value)) return all;
    if (property === 'box-shadow' || property === 'text-shadow') return `${property}:none`;
    let role;
    if (property === 'color' || /(?:title|heading|label|body|text|ink|muted)-?color$/.test(property) || /^--(?:ink|muted)$/.test(property))
      role = /title|heading|ink/.test(property + context) ? 'title' : accentRole.test(context) ? 'accent' : 'text';
    else if (property === 'stroke') role = /breath|mask|separator|glint/.test(context) ? 'line' : 'relation';
    else if (/^border/.test(property) || property === 'outline-color') role = 'line';
    else if (property === 'fill') role = /(?:title|text|number|label|english)/i.test(context) ? 'title' : /arrow|connector|edge|link|rail|line/i.test(context) ? 'relation' : 'surface';
    else if (/background|stop-color/.test(property) || property.startsWith('--')) role = 'surface';
    if (!role) return all;
    return `${property}:${paint(value, role, theme)}`;
  });
}

function stylesheet(source, theme) {
  return source.replace(/([^{}]+)\{([^{}]*)\}/g, (all, selector, body) => `${selector}{${declarations(body, selector, theme)}}`);
}

export function adaptNeutralStructure({markup, css, theme}) {
  if (theme.id !== 'neutral-editorial-001' || pilot.test(markup)) return {markup,css};
  markup = markup.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_,content)=>`<style>${stylesheet(content,theme)}</style>`);
  markup = markup.replace(/<[a-z][^>]*>/gi, tag => {
    // Images, URLs, paths and labels are never recolored as raw strings.
    if (/^<(?:img|image)\b/i.test(tag)) return tag;
    const name = tag.match(/^<([\w-]+)/)[1];
    const context = tag.match(/class="([^"]*)"/)?.[1] ?? '';
    return tag.replace(/(\s)([\w:-]+)(\s*=\s*)("[^"]*"|'[^']*')/g, (all,space,property,equal,quoted) => {
      const value = quoted.slice(1,-1), quote = quoted[0];
      if (property === 'style') return `${space}${property}${equal}${quote}${declarations(value,context,theme)}${quote}`;
      if (!['fill','stroke','stop-color','color'].includes(property)) return all;
      const role = name === 'text' || name === 'tspan' ? 'title' : property === 'stroke' ? 'relation'
        : property === 'color' ? 'text' : /arrow|connector|link|rail/.test(context) ? 'relation' : 'surface';
      return `${space}${property}${equal}${quote}${paint(value,role,theme)}${quote}`;
    });
  });
  css = stylesheet(css,theme) + `
  [data-ppt-root]{color:${theme.body};font-family:var(--ppagent-font-body)}
  [data-ppt-root] svg text{fill:${theme.dark}}
  [data-ppt-root] .ppagent-text-flow__title,[data-ppt-root] .ppagent-text-primitive--heading{color:${theme.dark};--title-color:${theme.dark}}
  [data-ppt-root] .ppagent-text-flow__body,[data-ppt-root] .ppagent-text-primitive--body,[data-ppt-root] .ppagent-text-list__item{color:${theme.body};--body-color:${theme.body}}
  .hub-review .hub-orbit-dot{background:${theme.muted}}
  .cycle-review .cycle-breath{stroke:${theme.background}}
  .cycle-review .cycle-number{fill:${theme.muted};opacity:1}
  .sequence-review .sequence-rail path{fill:${theme.line}}
  .intersection-review .set-circle{border:1px solid ${theme.muted}}
  .intersection-review .set-ring{border-color:${theme.line}}
  /* Noto's glyph box exceeds the legacy one-em clipping boxes. Keep font sizes
     and increase line boxes inside the existing shapes instead of clipping. */
  [data-ppt-root].mechanism .mediator__title,.causal-review .cause-title{line-height:1.45}
  .problem-solution-review .outcome-wrap .outcome-card h2,
  .problem-solution-review .outcome-wrap .outcome-card strong{line-height:1.45}
  `;
  return {markup,css};
}
