// Adapt paint roles before HTML measurement, so the native compiler sees the
// same result as the dashboard. Geometry, content and font capacity stay intact.
const colorToken = /#[\da-f]{8}\b|#[\da-f]{6}\b|#[\da-f]{3}\b|rgba?\([^)]*\)|\bwhite\b|\bblack\b/gi;

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

// A continuous transfer curve retains the authored light/dark ordering. White
// shape surfaces stay visibly separate from the page; white strokes are seams.
export function neutralPaint(token, role, theme) {
  const l=lightness(token);
  const mix=(a,b,t)=>'#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('').toUpperCase();
  const surface=mix(theme.background,theme.line,.32);
  const shape=mix(surface,theme.intensity4??theme.line,Math.pow(1-l,.85)*.86);
  const color=role==='canvas'?mix(theme.background,theme.line,(1-l)*.5):role==='text'?theme.body:role==='title'?theme.dark:role==='accent'?theme.primaryColor
    :role==='stroke'&&l>.985?theme.background:shape;
  const alpha=token.startsWith('#')&&token.length===9?token.slice(7):null;
  const rgbaAlpha=/^rgba/i.test(token)?token.match(/,\s*([\d.]+)\s*\)$/)?.[1]:null;
  if(alpha)return color+alpha;
  if(rgbaAlpha)return `rgba(${[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)).join(',')},${rgbaAlpha})`;
  return color;
}

function paint(value, role, theme) {
  // Resolve legacy tokens in the SOURCE palette, then transfer once. Mapping
  // already-derived destination tokens again would destroy the source levels.
  const source=value.replace(/var\(--ppagent-color-([\w-]+)(?:,([^)]*))?\)/g,(_,name,fallback)=>{
    const key=name==='primary'?'primaryColor':name.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
    return fallback?.trim()||theme.sourceTheme?.[key]||theme.sourceTheme?.primaryColor||'#315F91';
  });
  return source.replace(colorToken,token=>neutralPaint(token,role,theme));
}

function declarations(source, context, theme) {
  context=context.replace(/\/\*[\s\S]*?\*\//g,'').trim();
  return source.replace(/([\w-]+)\s*:\s*([^;{}]+)/g, (all, property, value) => {
    if (/url\(/i.test(value)) return all;
    if (property === 'box-shadow' || property === 'text-shadow') return `${property}:none`;
    let role;
    if (property === 'color' || /(?:title|heading|label|body|text|ink|muted)-?color$/.test(property) || /^--(?:ink|muted)$/.test(property))
      role = /title|heading|ink/.test(property + context) ? 'title' : accentRole.test(context) ? 'accent' : 'text';
    else if (property === 'stroke') role = 'stroke';
    else if (/^border/.test(property) || property === 'outline-color') role = 'line';
    else if (property === 'fill') role = /(?:title|text|number|label|english)/i.test(context) ? 'title' : /arrow|connector|edge|link|rail|line/i.test(context) ? 'relation' : 'surface';
    else if (/background|stop-color/.test(property) || property.startsWith('--')) role = 'surface';
    if (/^background/.test(property) && theme.rootSelectors?.has(context.trim())) role='canvas';
    if (!role) return all;
    return `${property}:${paint(value, role, theme)}`;
  });
}

function stylesheet(source, theme) {
  return source.replace(/([^{}]+)\{([^{}]*)\}/g, (all, selector, body) => `${selector}{${declarations(body, selector, theme)}}`);
}

export function adaptNeutralStructure({markup, css, theme, sourceTheme}) {
  const rootTag=markup.match(/<[^>]*\sdata-ppt-root(?:\s|=|>)[^>]*>/)?.[0]??'';
  const rootClasses=(rootTag.match(/class="([^"]*)"/)?.[1]??'').split(/\s+/).filter(Boolean);
  theme={...theme,sourceTheme,rootSelectors:new Set([...rootClasses.map(c=>'.'+c),'[data-ppt-root]',rootClasses.map(c=>'.'+c).join('')])};
  if (theme.id !== 'neutral-editorial-001') return {markup,css};
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
      const role = name === 'text' || name === 'tspan' ? 'title' : property === 'stroke' ? 'stroke'
        : property === 'color' ? 'text' : /arrow|connector|link|rail/.test(context) ? 'relation' : 'surface';
      return `${space}${property}${equal}${quote}${paint(value,role,theme)}${quote}`;
    });
  });
  css = stylesheet(css,theme) + `
  [data-ppt-root]{color:${theme.body};font-family:var(--ppagent-font-body)}
  [data-ppt-root] svg text{fill:${theme.dark}}
  [data-ppt-root] .ppagent-text-primitive--heading{font-family:${JSON.stringify(theme.fonts?.display??theme.font)}}
  [data-ppt-root] .ppagent-text-flow__title,[data-ppt-root] .ppagent-text-primitive--heading{color:${theme.dark};--title-color:${theme.dark}}
  [data-ppt-root] .ppagent-text-flow__body,[data-ppt-root] .ppagent-text-primitive--body,[data-ppt-root] .ppagent-text-list__item{color:${theme.body};--body-color:${theme.body}}
  /* Noto's glyph box exceeds the legacy one-em clipping boxes. Keep font sizes
     and increase line boxes inside the existing shapes instead of clipping. */
  [data-ppt-root].mechanism .mediator__title,.causal-review .cause-title{line-height:1.45}
  .problem-solution-review .outcome-wrap .outcome-card h2,
  .problem-solution-review .outcome-wrap .outcome-card strong{line-height:1.45}
  `;
  return {markup,css};
}
