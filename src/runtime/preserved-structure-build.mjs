import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveHtmlComponent, compileResolvedVisualTree, measureHtmlComponentBounds } from '../visual-runtime/html-component-runtime.mjs';
import { sharedPreservedComponent, sizeTypographyTheme } from '../visual-runtime/preserved-size-component.mjs';

export function preservedComponent(component, frame, theme = {}) {
  if (typeof component.renderAdaptiveMarkup !== 'function') throw new Error('该结构尚未实现保留造型的区域适配');
  const sizeScale = { large: 1, medium: .85, small: .7 }[frame.size] ?? 1;
  return {
    ...component, designFrame: { width: frame.width, height: frame.height },
    renderMarkup(content) {
      const markup = component.renderAdaptiveMarkup(content, { frame, theme, sizeScale })
        .replace('data-ppt-root', 'data-ppt-root data-ppt-preserve-font="true"');
      return markup;
    },
  };
}

export async function loadPreservedComponent(ref, frame, skin = {}, content) {
  if (ref.guide?.implementation?.mode !== 'preserved-design') throw new Error('该结构尚未登记保留造型构建方法');
  const entry = path.resolve(ref.assetDir, ref.guide.exampleImplementation);
  const relative = path.relative(ref.assetDir, entry);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('结构实现必须位于资产目录内');
  const module = await import(pathToFileURL(entry).href);
  const visualComponent = module[ref.runtime?.review?.componentExport ?? 'visualComponent'] ?? module.visualComponent;
  return ref.guide.implementation.adapter === 'shared-css-geometry'
    ? sharedPreservedComponent(visualComponent, ref.assetDir, frame, skin, content)
    : preservedComponent(visualComponent, frame, sizeTypographyTheme(skin));
}

// Presets describe occupied page area, not a fixed aspect ratio for every shape.
// Callers may further adjust this frame; final text measurement still applies.
export async function resolveStructureSizeFrame(ref, size, content, skin = {}, scale = 1) {
  const ratios = {large: 1, medium: .5, small: 1/3};
  if (!(size in ratios) || !Number.isFinite(scale) || scale <= 0) throw new Error('结构尺寸需为 large / medium / small，scale 必须为正数');
  const body = skin.bodyFrame ?? { left: 0, top: 0, width: 1170, height: 492 };
  if(size==='large') return {...body,width:body.width*scale,height:body.height*scale,size};
  const module = await import(pathToFileURL(path.resolve(ref.assetDir,ref.guide.exampleImplementation)).href);
  const component = module[ref.runtime?.review?.componentExport ?? 'visualComponent'] ?? module.visualComponent;
  const bounds = await measureHtmlComponentBounds({component,parameters:content,assetDir:ref.assetDir,theme:skin});
  const factor = Math.min(1, Math.sqrt(body.width*body.height*ratios[size]/(bounds.width*bounds.height)),body.width/bounds.width,body.height/bounds.height);
  return {left:body.left,top:body.top,width:Math.min(body.width,bounds.width*factor+16)*scale,height:Math.min(body.height,bounds.height*factor+24)*scale,size};
}

export async function buildPreservedStructure({ slide, skin, frame, content, references }) {
  if (references.length !== 1) throw new Error('保留造型构建当前仅支持单一结构');
  const ref = references[0];
  const component = await loadPreservedComponent(ref, frame, skin, content);
  const tree = await resolveHtmlComponent({ component, parameters: content, assetDir: ref.assetDir, theme: skin, targetFrame: frame });
  compileResolvedVisualTree(slide, tree, frame);
  return { mode: 'preserved-design', componentId: tree.componentId, nodeCount: tree.nodes.length };
}
