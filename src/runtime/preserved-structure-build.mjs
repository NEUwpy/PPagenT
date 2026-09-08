import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveHtmlComponent, compileResolvedVisualTree } from '../visual-runtime/html-component-runtime.mjs';
import { preservedNeutralSkinCss } from '../visual-runtime/preserved-neutral-skin.mjs';

export function preservedComponent(component, frame, theme = {}) {
  if (typeof component.renderAdaptiveMarkup !== 'function') throw new Error('该结构尚未实现保留造型的区域适配');
  return {
    ...component, designFrame: { width: frame.width, height: frame.height },
    renderMarkup(content) {
      const markup = component.renderAdaptiveMarkup(content, { frame, theme })
        .replace('data-ppt-root', 'data-ppt-root data-ppt-preserve-font="true"');
      return markup.replace('</section>', `${preservedNeutralSkinCss(component.id, theme)}</section>`);
    },
  };
}

export async function buildPreservedStructure({ slide, skin, frame, content, references }) {
  if (references.length !== 1) throw new Error('保留造型构建当前仅支持单一结构');
  const ref = references[0];
  if (ref.guide?.implementation?.mode !== 'preserved-design') throw new Error('该结构尚未登记保留造型构建方法');
  const entry = path.resolve(ref.assetDir, ref.guide.exampleImplementation);
  const relative = path.relative(ref.assetDir, entry);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('结构实现必须位于资产目录内');
  const { visualComponent } = await import(pathToFileURL(entry).href);
  const component = preservedComponent(visualComponent, frame, skin);
  const tree = await resolveHtmlComponent({ component, parameters: content, assetDir: ref.assetDir, theme: skin, targetFrame: frame });
  compileResolvedVisualTree(slide, tree, frame);
  return { mode: 'preserved-design', componentId: tree.componentId, nodeCount: tree.nodes.length };
}
