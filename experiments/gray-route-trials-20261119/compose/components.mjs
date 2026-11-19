import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { compileHtmlComponentTheme, htmlComponentThemeCss } from '../../../src/visual-runtime/html-component-theme.mjs';
import { htmlTextFlowCss } from '../../../src/visual-runtime/text-flow.mjs';
import { visualComponent as equalCards } from '../../../assets/结构图/等权并列卡片-001/review.mjs';

export const capabilities = {
  'comparison-columns': { accepts: 'peer-options', count: [2, 2], roles: ['title', 'body'], origin: '实验通用双栏和顺序阅读' },
  'parallel-text': { accepts: 'parallel', count: [2, 5], roles: ['title', 'body'], origin: '实验文本布局，Grid 约束并列' },
  'shared-note': { accepts: 'shared-*', count: [1, 1], roles: ['body'], origin: '实验共同条件带，保留与所有项关系' },
  'independent-groups': { accepts: 'independent', count: [2, 2], roles: ['heading', 'items'], origin: '实验两独立分区' },
  'parallel-equal-cards-001': {
    accepts: 'parallel', count: [2, 5], roles: ['items[].title', 'items[].body'], sourceVersion: equalCards.schemaVersion,
    origin: 'assets/结构图/等权并列卡片-001', variants: ['fixed-original', 'adaptive-single-row'],
    invariants: ['equal complete card boundaries', 'circle anchors', 'consistent title/body hierarchy', 'shared alignment and spacing', 'no connectors'],
  },
  'convergence-many-to-one-003': {
    accepts: 'converges-to', count: [3, 6], roles: ['inputs[].body', 'result.title'], sourceVersion: 6,
    origin: 'assets/结构图/多路汇聚结果-003', variants: ['original-geometry', 'locally-adapted-geometry'],
    invariants: ['separate input boxes', 'thick smooth cubic paths', 'single result box', 'every path meets both boxes'],
  },
};

const assetDir = id => new URL(`../../../${capabilities[id].origin}/`, import.meta.url);
const convergenceId = 'convergence-many-to-one-003';
const cardsId = 'parallel-equal-cards-001';
const hash = data => createHash('sha256').update(data).digest('hex');
const read = url => fs.readFile(url, 'utf8');
const sourceGraphUrl = new URL('review.mjs', assetDir(convergenceId));
const baselineGraphUrl = new URL('convergence-baseline.generated.mjs', import.meta.url);

function changeOnce(source, before, after) {
  if (source.split(before).length !== 2) throw new Error(`Asset source changed around ${before}`);
  return source.replace(before, after);
}

export async function loadComponents(stage) {
  const localModule = stage === 'initial' ? 'convergence-initial.generated.mjs' : 'convergence-adapted.generated.mjs';
  const localGraphUrl = new URL(localModule, import.meta.url);
  const [original, graphCss, cardsSource, cardsCss, styles] = await Promise.all([
    read(sourceGraphUrl), read(new URL('component.css', assetDir(convergenceId))),
    read(new URL('review.mjs', assetDir(cardsId))), read(new URL('component.css', assetDir(cardsId))),
    read(new URL('page.css', import.meta.url)),
  ]);
  // Only the capacity declaration changes for the baseline. It lets the
  // original geometry receive source-exact, unlabeled phrases for comparison.
  let baseline = changeOnce(original, 'if (!title || [...title].length > 8 || [...body].length > 22)',
    'if ((!title && !body) || [...title].length > 8 || [...body].length > 30)');
  baseline = changeOnce(baseline, '[...result.title].length > 10', '[...result.title].length > 14');
  let adapted = changeOnce(baseline, 'clamp(width * 0.265, 190, 310)',
    `clamp(width * ${stage === 'initial' ? '0.395' : '0.45'}, 190, 310)`);
  adapted = changeOnce(adapted, 'clamp(height * (count >= 6 ? 0.135 : 0.16), 58, 78)',
    stage === 'initial' ? 'clamp(height * (count === 3 ? 0.30 : count >= 6 ? 0.135 : 0.16), 58, 78)'
      : 'count === 3 ? Math.min(78, Math.floor((height - 2 * clamp(height * 0.05, 12, 22) - 16) / count)) : clamp(height * (count >= 6 ? 0.135 : 0.16), 58, 78)');
  await Promise.all([fs.writeFile(localGraphUrl, adapted), fs.writeFile(baselineGraphUrl, baseline)]);
  const [adaptedGraph, baselineGraph] = await Promise.all([
    import(`${localGraphUrl.href}?${hash(adapted)}`), import(`${baselineGraphUrl.href}?${hash(baseline)}`),
  ]);
  const theme = { primaryColor: '#505050', font: 'Microsoft YaHei', typography: { componentItemTitle: 15, componentLabel: 13.5, componentBody: 13.5 } };
  const commonCss = htmlComponentThemeCss(theme) + htmlTextFlowCss();
  const compiledGraph = compileHtmlComponentTheme({ css: graphCss, theme }).css;
  const compiledCards = compileHtmlComponentTheme({ css: cardsCss, theme }).css;
  return {
    theme, adaptedGraph, baselineGraph, commonCss, compiledGraph, compiledCards, styles,
    assetEvidence: {
      [convergenceId]: { reviewSha256: hash(original), cssSha256: hash(graphCss), baselineSha256: hash(baseline), adaptedSha256: hash(adapted),
        unchanged: ['pathMarkup', 'inputMarkup', 'resultMarkup', 'renderAdaptiveMarkup'], localModule },
      [cardsId]: { reviewSha256: hash(cardsSource), cssSha256: hash(cardsCss), localModule: null },
    },
  };
}

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const bindingAttributes = binding => `data-bind="${binding.id}" data-source="${binding.sourceId}"`;
const leaf = (tag, cls, binding) => `<${tag} class="${cls}" ${bindingAttributes(binding)}>${escape(binding.text)}</${tag}>`;

function bindAssetLeaves(markup, bindings) {
  for (const [name, binding] of bindings) {
    markup = changeOnce(markup, `data-ppt-name="${name}"`, `data-ppt-name="${name}" ${bindingAttributes(binding)}`);
  }
  return markup;
}

function equalCardGroup(plan, candidate, loaded) {
  const icons = ['tool', 'door', 'files', 'users'];
  const markup = equalCards.renderMarkup({ items: plan.items.map((item, i) => ({
    key: item.key, title: item.label.text, body: item.body[0].text, iconKey: icons[i],
  })) });
  const bindings = plan.items.flatMap((item, i) => [
    [`parallel-title-${i}`, item.label], [`parallel-body-${i}`, item.body[0]],
  ]);
  const compiled = compileHtmlComponentTheme({ markup: bindAssetLeaves(markup, bindings), theme: loaded.theme });
  return `<section class="cards-host ${candidate.compact ? 'adapt-cards' : ''}" data-component="${cardsId}" data-geometry="services" style="--card-h:${candidate.height}px">${compiled.markup}</section>`;
}

function convergence(item, candidate, loaded) {
  const [, ...factorsAndEffect] = item.body;
  const factors = factorsAndEffect.slice(0, -1);
  const effect = factorsAndEffect.at(-1);
  const frame = { width: candidate.left, height: candidate.height };
  const graph = candidate.baseline ? loaded.baselineGraph : loaded.adaptedGraph;
  const markup = graph.renderAdaptiveMarkup({
    inputs: factors.map(f => ({ key: f.id, body: f.text })), result: { title: effect.text },
  }, { frame });
  const bindings = [
    ...factors.map((factor, i) => [`merge-input-${i + 1}-body`, factor]), ['merge-result-title', effect],
  ];
  const compiled = compileHtmlComponentTheme({ markup: bindAssetLeaves(markup, bindings), theme: loaded.theme });
  return {
    markup: `<div class="graph-host ${candidate.profile === 'stock' ? 'stock-graph' : 'adapt-graph'}" data-component="${convergenceId}" data-geometry="graph">${compiled.markup}</div>`,
    layout: graph.resolveConvergenceLayout(frame, factors.length),
  };
}

function plainItem(item, options = false) {
  const label = leaf('h3', 'item-title', item.label);
  const parts = item.body.map(part => options ? leaf('p', 'copy', part) : leaf('span', 'source-part', part));
  const body = options ? parts.join('') : `<p class="copy">${parts.join('')}</p>`;
  return `<article data-unit="${item.key}" data-geometry="${item.key}">${label}${body}</article>`;
}

export function renderCandidate({ plan, frame, kind, candidate, loaded, debug = false }) {
  let body;
  let graphLayout;
  const { component, bodyPx } = candidate;
  if (kind === 'hr') {
    const markup = plan.groups.map(({ id, heading, items }) => {
      const rendered = items.map(item => {
        if (component !== convergenceId || item.key !== 'issues-1') return plainItem(item);
        const graph = convergence(item, candidate, loaded);
        graphLayout = graph.layout;
        return `<article data-unit="${item.key}" data-geometry="${item.key}">${leaf('h3', 'item-title', item.label)}${leaf('p', 'copy', item.body[0])}${graph.markup}</article>`;
      }).join('');
      return `<section class="hr-group ${id}" data-geometry="${id}" data-group="${id}">${leaf('h2', 'group-title', heading)}<div class="hr-items">${rendered}</div></section>`;
    }).join('');
    body = `<div class="hr-body ${candidate.layout}" data-component="independent-groups" data-geometry="groups" style="--left-w:${candidate.left ?? 0}px">${markup}</div>`;
  } else {
    const primary = component === cardsId ? equalCardGroup(plan, candidate, loaded)
      : `<section class="text-items ${kind}" data-cols="${candidate.cols}" data-component="${component}" data-geometry="items" style="--cols:${candidate.cols}">${plan.items.map(item => plainItem(item, kind === 'options')).join('')}</section>`;
    body = `<div class="general-body ${kind}" data-geometry="body">${primary}<aside class="shared" data-component="shared-note" data-geometry="shared">${leaf('p', 'copy', plan.shared)}</aside></div>`;
  }
  const css = loaded.commonCss + loaded.compiledGraph + loaded.compiledCards + loaded.styles;
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escape(plan.title.text)}</title><style>${css}</style></head>
<body><div class="slide ${loaded.stage} ${debug ? 'diagnostic' : ''}"><header class="masthead">${leaf('h1', 'slide-title', plan.title)}</header>
<main data-content-frame="" data-geometry="content-frame" style="left:${frame.x}px;top:${frame.y}px;width:${frame.width}px;height:${frame.height}px;--body-px:${bodyPx}px">${body}</main></div></body></html>`;
  return { html, graphLayout };
}
