import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildSourceBlocks } from '../../../src/content/source-blocks.mjs';
import { compileHtmlComponentTheme } from '../../../src/visual-runtime/html-component-theme.mjs';
import { visualComponent as cards } from '../../../assets/结构图/等权并列卡片-001/review.mjs';
import { visualComponent as notes } from '../../../assets/结构图/双排折角便签-002/review.mjs';
import { visualComponent as pillars } from '../../../assets/结构图/长文并列论述柱-003/review.mjs';

export const root = new URL('../../../', import.meta.url);
export const canvas = { left: 0, top: 0, width: 1280, height: 720 };
const standard = { left: 55, top: 166, width: 1170, height: 492 };
const narrow = { ...standard, width: 1020, height: 450 };
const inputs = {
  options: '稿件/模拟稿库/布局试排-options.md',
  services: '稿件/模拟稿库/布局试排-services.md',
  dense: '稿件/模拟稿库/布局试排-dense.md',
  hr: '稿件/变革不足与感悟-v3-条件否定.md',
};
export const theme = {
  primaryColor: '#484848', font: 'Microsoft YaHei',
  typography: { componentBody: 14.25, componentItemTitle: 16.5, componentHeading: 18 },
};
const assets = {
  cards: { directory: '等权并列卡片-001', component: cards },
  notes: { directory: '双排折角便签-002', component: notes },
  pillars: { directory: '长文并列论述柱-003', component: pillars },
};

export const escapeHtml = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
export const sha256 = value => createHash('sha256').update(value).digest('hex');

async function loadSource(input) {
  const file = inputs[input];
  const bytes = await fs.readFile(new URL(file, root));
  const raw = bytes.toString('utf8');
  const lineAt = index => raw.slice(0, index).split('\n').length;
  const blocks = buildSourceBlocks(raw).map(block => ({ ...block, firstLine: lineAt(block.start), lastLine: lineAt(block.end) }));
  return { file, sha256: sha256(bytes), blocks };
}

function span(block, start = 0, end = block.text.length) {
  return { block: block.id, start, end, text: block.text.slice(start, end) };
}

function colonItem(block) {
  const end = block.text.indexOf('：') + 1;
  if (end <= 0) throw new Error(`${block.id} 缺少预期的冒号`);
  return { title: span(block, 0, end), body: span(block, end) };
}

function hrGroup(block, markers) {
  // Frozen boundaries selected from the original draft. No rewriting or inference at runtime.
  const starts = markers.map(marker => block.text.indexOf(marker));
  if (!starts.every((start, i) => start > (i ? starts[i - 1] : 0))) {
    throw new Error(`${block.id} 的原始边界变化，需要重新判断段落关系`);
  }
  const items = starts.map((start, i) => {
    const end = starts[i + 1] ?? block.text.length;
    const split = block.text.indexOf('。', start) + 1;
    if (split <= start || split >= end) throw new Error(`${block.id} 缺少条目标题或正文`);
    return { title: span(block, start, split), body: span(block, split, end) };
  });
  return { heading: span(block, 0, starts[0]), items };
}

function author(source, frame) {
  const bindings = {};
  const calls = [];
  const attr = (name, sourceSpan, role) => {
    if (bindings[name]) throw new Error(`重复的文字绑定 ${name}`);
    bindings[name] = { ...sourceSpan, role };
    const checkRole = role.startsWith('shared-') ? 'scope-note' : role;
    return `data-bind="${name}" data-role="${checkRole}" data-source="${source.file}#${sourceSpan.block}:${sourceSpan.start}-${sourceSpan.end}"`;
  };
  const leaf = (tag, name, sourceSpan, role, className = '') =>
    `<${tag} data-ppt-kind="text" data-ppt-name="${name}" data-ppt-valign="top" ${attr(name, sourceSpan, role)} class="${className}">${escapeHtml(sourceSpan.text)}</${tag}>`;
  const pair = (key, item) => `${leaf('h3', `${key}-title`, item.title, 'heading')}${leaf('p', `${key}-body`, item.body, 'body')}`;
  const heading = leaf('h1', 'title', span(source.blocks[0]), 'page-title');
  function asset(key, usage, items, { icons, componentFrame, adaptive = false } = {}) {
    const entry = assets[key];
    const parameters = { items: items.map((item, i) => ({
      key: `${usage}-${i + 1}`, title: item.title.text, body: item.body.text,
      ...(item.lead ? { lead: item.lead.text } : {}),
      ...(icons ? { iconKey: icons[i] } : {}),
    })) };
    const info = { usage, key, entry, parameters, frame: componentFrame, adaptive };
    calls.push(info);
    let markup = adaptive
      ? entry.component.renderAdaptiveMarkup(parameters, { frame: componentFrame, theme })
      : entry.component.renderMarkup(parameters);
    const prefix = key === 'notes' ? 'note' : 'parallel';
    for (const [i, item] of items.entries()) {
      for (const [field, name, role] of [['title', `${prefix}-${key === 'notes' ? 'heading' : 'title'}-${i}`, 'heading'], ['body', `${prefix}-body-${i}`, 'body']]) {
        const token = `data-ppt-name="${name}"`;
        if (!markup.includes(token)) throw new Error(`${usage} 的对象 ${name} 缺少原生名称`);
        markup = markup.replace(token, `${token} ${attr(name, item[field], role)}`);
      }
    }
    // The entire slide is the compiler root. Keep the asset root as component identity.
    markup = markup.replace('data-ppt-root', `data-component="${usage}"`);
    return markup;
  }
  return { bindings, calls, leaf, pair, heading, asset, frame, source };
}

const rect = (name, className) => `<div aria-hidden="true" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="${name}" class="${className}"></div>`;
const icons = ['devices', 'calendar-event', 'file-text', 'users'];

function optionsPage(p, free) {
  const [, concentrated, staggered, condition] = p.source.blocks;
  const comparison = p.asset('cards', 'options-cards', [concentrated, staggered].map(colonItem), {
    icons: ['layout-grid', 'calendar-event'],
  });
  // Same rendered silhouette, first through unrestricted CSS and then through a supported path.
  const plate = free ? rect('condition-plate', 'condition-plate free-plate') :
    `<svg class="condition-plate" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true"><path data-ppt-kind="path" data-ppt-name="condition-plate" d="M 0 0 L 1000 0 L 1000 100 L 18 100 L 0 72 Z"></path></svg>`;
  return `${comparison}<aside class="condition" data-component="shared-precondition">${plate}${p.leaf('p', 'precondition', span(condition), 'shared-condition')}</aside>`;
}

function servicesPage(p) {
  const [, ...blocks] = p.source.blocks;
  const common = blocks.pop();
  const cardFrame = { width: p.frame.width - 282, height: p.frame.height };
  const grid = p.asset('notes', 'service-notes', blocks.map(colonItem), { icons, componentFrame: cardFrame, adaptive: true });
  return `${grid}<aside class="service-entry" data-component="shared-entry">${rect('entry-panel', 'entry-panel')}${p.leaf('p', 'entry', span(common), 'shared-entry')}</aside>`;
}

function densePage(p) {
  const [, ...blocks] = p.source.blocks;
  const common = blocks.pop();
  const cells = blocks.map((block, i) => `<article data-component="dense-item-${i + 1}">${p.pair(`dense-${i + 1}`, colonItem(block))}</article>`).join('');
  return `<div class="dense-grid">${cells}</div><aside class="dense-common" data-component="dense-common">${p.leaf('p', 'dense-common', span(common), 'shared-condition')}</aside>`;
}

function hrPage(p, useNotes) {
  const ratio = 0.58;
  const gap = 40;
  const [, limitations, reflections] = p.source.blocks;
  const limits = hrGroup(limitations, ['一是势能', '二是合规']);
  const insights = hrGroup(reflections, ['一是统一', '二是解决', '三是顶层', '四是统筹']);
  const group = (key, value, customItems) => `<section class="hr-group hr-${key}" data-component="hr-${key}">
    ${p.leaf('h2', `${key}-heading`, value.heading, 'group-heading')}
    <div class="hr-items">${customItems ?? value.items.map((item, i) => `<article>${p.pair(`${key}-${i + 1}`, item)}</article>`).join('')}</div>
  </section>`;
  const adaptiveMarkup = useNotes ? p.asset('notes', 'hr-notes', insights.items, {
    icons: ['users', 'shield-check', 'layout-grid', 'edit'],
    componentFrame: { width: Math.floor((p.frame.width - gap) / (1 + ratio)), height: 438 }, adaptive: true,
  }) : null;
  return `<div class="hr-columns" style="--hr-gap:${gap}px;--hr-divider-share:${ratio / (1 + ratio)}">${group('limits', limits)}${rect('hr-divider', 'hr-divider')}${group('insights', insights, adaptiveMarkup)}</div>`;
}

export const plans = [
  { id: 'options-free', input: 'options', build: p => optionsPage(p, true), project: true },
  { id: 'options', input: 'options', build: p => optionsPage(p, false), project: true },
  { id: 'services', input: 'services', build: servicesPage, project: true },
  { id: 'services-narrow', input: 'services', frame: narrow, build: servicesPage, project: true },
  { id: 'dense', input: 'dense', build: densePage },
  { id: 'hr-notes', input: 'hr', build: p => hrPage(p, true) },
  { id: 'hr', input: 'hr', build: p => hrPage(p, false), project: true },
];

export const relations = {
  options: { kind: 'balanced-alternatives', component: 'options-cards', items: ['options-cards-1', 'options-cards-2'], shared: 'shared-precondition' },
  services: { kind: 'parallel-services', component: 'service-notes', items: ['service-notes-1', 'service-notes-2', 'service-notes-3', 'service-notes-4'], shared: 'shared-entry' },
  dense: { kind: 'parallel-items', items: ['dense-item-1', 'dense-item-2', 'dense-item-3', 'dense-item-4'], shared: 'dense-common' },
  hr: { kind: 'parallel-groups', groups: ['hr-limits', 'hr-insights'], edges: [] },
};

async function componentRecord({ usage, key, entry, parameters, frame, adaptive }) {
  const directory = `assets/结构图/${entry.directory}`;
  const revision = {};
  for (const file of ['asset.json', 'review.mjs', entry.component.cssFile]) {
    revision[file] = sha256(await fs.readFile(new URL(`${directory}/${file}`, root)));
  }
  return { usage, key, id: JSON.parse(await fs.readFile(new URL(`${directory}/asset.json`, root), 'utf8')).id,
    directory, revision, schemaVersion: entry.component.schemaVersion, parameters, requestedFrame: frame ?? null,
    invocation: adaptive ? 'renderAdaptiveMarkup' : 'renderMarkup' };
}

export async function buildPlan(plan) {
  const source = await loadSource(plan.input);
  const p = author(source, plan.frame ?? standard);
  const body = plan.build(p);
  const frame = p.frame;
  const frameStyle = `left:${frame.left}px;top:${frame.top}px;width:${frame.width}px;height:${frame.height}px`;
  const markup = `<main class="slide page-${plan.input}" data-ppt-root>${p.heading}
    ${rect('title-rule', 'title-rule')}<div data-content-frame style="${frameStyle}">${body}</div></main>`;
  const assetCss = [];
  for (const { key, entry } of p.calls) {
    const sourceCss = await fs.readFile(new URL(`assets/结构图/${entry.directory}/${entry.component.cssFile}`, root), 'utf8');
    const compiled = compileHtmlComponentTheme({ css: sourceCss, theme });
    assetCss.push(`/* ${key} */\n${compiled.css}`);
  }
  return { markup, assetCss: assetCss.join('\n'), bindings: p.bindings, frame,
    source: { file: source.file, sha256: source.sha256, blocks: source.blocks },
    assetCalls: await Promise.all(p.calls.map(componentRecord)) };
}

export async function probeAssetGates() {
  const source = await loadSource('hr');
  const [, limitations, reflections] = source.blocks;
  const limits = hrGroup(limitations, ['一是势能', '二是合规']);
  const insights = hrGroup(reflections, ['一是统一', '二是解决', '三是顶层', '四是统筹']);
  const probe = async (key, id, items) => {
    const entry = assets[key];
    const info = await componentRecord({ usage: id, key, entry, parameters: { items }, adaptive: false });
    try {
      entry.component.renderMarkup(info.parameters);
      return { ...info, status: 'accepted-by-renderMarkup' };
    } catch (error) {
      return { ...info, status: 'rejected-by-renderMarkup', reason: error.message,
        fieldLengths: items.map(item => Object.fromEntries(Object.entries(item).map(([name, text]) => [name, [...text].length]))) };
    }
  };
  const notesItems = insights.items.map((item, i) => ({ title: item.title.text, body: item.body.text, iconKey: icons[i] }));
  const pillarItems = limits.items.map(item => {
    const end = item.body.text.indexOf('。') + 1;
    return { title: item.title.text, lead: item.body.text.slice(0, end), body: item.body.text.slice(end) };
  });
  return [await probe('notes', 'hr-notes-natural', notesItems), await probe('pillars', 'hr-pillars-natural', pillarItems)];
}

export const outputPath = name => fileURLToPath(new URL(name, import.meta.url));
