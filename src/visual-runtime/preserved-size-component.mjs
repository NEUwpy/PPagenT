import fs from 'node:fs/promises';
import path from 'node:path';
import { preservedTypography, fitPreservedDesign } from './preserved-design-layout.mjs';
import { measureHtmlComponentBounds } from './html-component-runtime.mjs';
import { htmlTextFlowCss } from './text-flow.mjs';
import { resolveComponentTypography } from './html-component-theme.mjs';

export function sizeTypographyTheme(theme = {}) {
  const base = resolveComponentTypography(theme);
  return { ...theme, typographyTiers: Object.fromEntries(Object.entries(base).map(([role, size]) =>
    [role, theme.typographyTiers?.[role] ?? [...new Set([size, 20, 18, 16, 14, 12].filter(n => n <= size))]])) };
}

export const structureSizeFrames = Object.freeze({
  large: Object.freeze({ width: 1170, height: 492 }),
  medium: Object.freeze({ width: 780, height: 369 }),
  small: Object.freeze({ width: 585, height: 328 }),
});

// Rebase the original drawing's CSS coordinates, not a raster or a transformed
// text layer. SVG viewBoxes stay in source coordinates; their CSS frames move
// with the HTML geometry. Typography is selected independently before measuring.
export function resizeDesignCss(source, scale, type) {
  return source.replace(/([\w-]+)\s*:\s*([^;{}]+)([;}])/g, (all, property, value, end) => {
    if(property==='line-height' && scale<1 && /^\s*\d+(?:\.\d+)?px\s*$/.test(value)) return `${property}:max(1.2em,${parseFloat(value)*scale}px)${end}`;
    if (/^(font-size|--(?:title|body|label|heading|meta|item-title)-size)$/.test(property) && type) {
      const match=value.trim().match(/^(\d+(?:\.\d+)?)(px|pt)$/);
      if(match) {
        const pt=Number(match[1])*(match[2]==='px'?.75:1);
        const role=Object.keys(type.base).reduce((a,b)=>Math.abs(type.base[a]-pt)<=Math.abs(type.base[b]-pt)?a:b);
        return `${property}:${type.sizes[role]}pt${end}`;
      }
    }
    if (/^(font(?:-.*)?|line-height|letter-spacing)$/.test(property)
      || /--ppagent-.*-size$/.test(property)) return all;
    const spacing = /^(padding(?:-.*)?|(?:row-|column-)?gap)$/.test(property) || /--ppagent-text-.*gap$/.test(property);
    const factor = spacing && scale < 1 ? scale * scale : scale;
    const resized = value.replace(/(-?(?:\d*\.)?\d+)px\b/g, (_, n) => `${Number((Number(n) * factor).toFixed(5))}px`);
    return `${property}:${resized}${end}`;
  });
}

export async function sharedPreservedComponent(component, assetDir, frame, theme = {}, content) {
  const natural = { left: 0, top: 0, ...component.designFrame };
  const bounds = content && (frame.width < natural.width || frame.height < natural.height)
    ? await measureHtmlComponentBounds({ component, parameters: content, assetDir, theme })
    : natural;
  const local = frame.width < natural.width || frame.height < natural.height;
  const { scale: fittedScale } = fitPreservedDesign(local ? {width:Math.max(1,frame.width-16),height:Math.max(1,frame.height-24)} : frame, bounds);
  // The occupied footprint can be much smaller than the source design frame.
  // In that case a medium/small target would otherwise fit at scale 1 and keep
  // large typography. The size tier is a minimum visual reduction; geometry
  // still shrinks further when the actual content needs more room.
  const tierScale = { large: 1, medium: .85, small: .7 }[frame.size] ?? 1;
  const scale = Math.min(fittedScale, tierScale);
  const type = preservedTypography(scale, sizeTypographyTheme(theme));
  type.css += `;--ppagent-component-body-small-size:${type.sizes.componentMeta}pt;--structure-geometry-scale:${scale}`;
  const width = bounds.width * scale, height = bounds.height * scale;
  const cssPath = path.resolve(assetDir, component.cssFile ?? 'component.css');
  const relative = path.relative(path.resolve(assetDir), cssPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('结构 CSS 必须位于资产目录内');
  const css = component.cssText ?? await fs.readFile(cssPath, 'utf8');
  let compactCss = '';
  if(scale < .99) {
    try { compactCss = await fs.readFile(path.join(assetDir,'compact.css'),'utf8'); }
    catch(error) {if(error.code !== 'ENOENT') throw error;}
  }
  return {
    ...component,
    footprintFit: true,
    designFrame: { width: frame.width, height: frame.height },
    cssText: resizeDesignCss(htmlTextFlowCss()+css, scale, type) + (scale < 1 ? '\n[data-ppt-fit-footprint] [data-ppt-kind="text"]{min-height:1.2em}' : ''),
    renderMarkup(content) {
      let markup = component.renderMarkup(content);
      markup = markup.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_,css)=>`<style>${resizeDesignCss(css,scale,type)}</style>`);
      markup = markup.replace(/style="([^"]*)"/g, (_, style) => `style="${resizeDesignCss(`${style};`, scale,type)}"`);
      // Keep SVG paths, arc radii and viewBoxes intact. Only inline CSS is rebased.
      const left = (frame.width-width)/2-bounds.left*scale;
      const top = (frame.height-height)/2-bounds.top*scale;
      markup = markup.replace(/<([^>]*\bdata-ppt-root\b[^>]*)>/, (_, tag) => {
        const style = `position:absolute;left:${left}px;top:${top}px;width:${natural.width*scale}px;height:${natural.height*scale}px;overflow:visible;background:transparent;${type.css}`;
        const updated = /style="/.test(tag)
          ? tag.replace(/style="([^"]*)"/, (_, original) => `style="${original};${style}"`)
          : `${tag} style="${style}"`;
        return `<${updated.replace(/\bdata-ppt-root\b/, 'data-preserved-source')}>`;
      });
      return `<section data-ppt-root data-ppt-fit-footprint="true" data-ppt-preserve-font="true" style="position:relative;width:${frame.width}px;height:${frame.height}px;${type.css}">${markup}${compactCss ? `<style>${compactCss}</style>` : ''}</section>`;
    },
  };
}
