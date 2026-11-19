import { buildSourceBlocks } from '../../../src/content/source-blocks.mjs';

const standard = { x: 55, y: 166, width: 1170, height: 492 };
const samples = {
  options: '稿件/模拟稿库/布局试排-options.md',
  services: '稿件/模拟稿库/布局试排-services.md',
  dense: '稿件/模拟稿库/布局试排-dense.md',
  hr: '稿件/变革不足与感悟-v3-条件否定.md',
};
export const cases = [
  ...Object.entries(samples).map(([id, file]) => ({ id, kind: id, file, frame: standard })),
  { id: 'hr-narrow', kind: 'hr', file: samples.hr, frame: { ...standard, width: 1020, height: 450 } },
];

// Frozen editorial plans for the four known manuscripts. Bound wording is read
// from the MD; regular expressions assert the planned source structure.
const planModes = {
  options: { relation: 'shared-prerequisite', layoutIntent: 'compare-options', count: 2 },
  services: { relation: 'shared-service-entry', layoutIntent: 'equal-services', count: 4 },
  dense: { relation: 'shared-record-requirement', layoutIntent: 'parallel-procedures', count: 4 },
  hr: { relation: 'independent', layoutIntent: 'two-analysis-groups' },
};

export function planFor(kind, markdown) {
  const mode = planModes[kind];
  const blocks = buildSourceBlocks(markdown);
  const bindings = [];
  function bind(id, block, start = 0, end = block.text.length) {
    if (start < 0 || end <= start || end > block.text.length) throw new Error(`Invalid span: ${id}`);
    const offset = markdown.slice(block.start, block.end).indexOf(block.text);
    const span = [block.start + offset + start, block.start + offset + end];
    const bound = { id, sourceId: block.id, span, text: markdown.slice(...span) };
    bindings.push(bound);
    return bound;
  }

  const title = bind('title', blocks[0]);
  const plan = { ...mode, title, blocks, bindings };
  if (kind === 'hr') {
    if (blocks.length !== 3) throw new Error('HR plan expects title and two source paragraphs');
    plan.groups = blocks.slice(1).map((block, groupIndex) => {
      const id = groupIndex === 0 ? 'issues' : 'insights';
      const anchors = [...block.text.matchAll(/[一二三四]是[^。]+。/g)];
      if (anchors.length !== [2, 4][groupIndex]) throw new Error(`Unexpected section: ${id}`);
      const heading = bind(`${id}-heading`, block, 0, anchors[0].index);
      const items = anchors.map((match, index) => {
        const key = `${id}-${index + 1}`;
        const end = anchors[index + 1]?.index ?? block.text.length;
        const bodyStart = match.index + match[0].length;
        const label = bind(`${key}-title`, block, match.index, bodyStart);
        const text = block.text.slice(bodyStart, end);
        if (groupIndex !== 0 || index !== 0) {
          return { key, label, body: [bind(`${key}-body`, block, bodyStart, end)] };
        }
        const parts = /^(.+?。)([^，]+，)([^，]+，)([^，]+，)(造成.+。)$/.exec(text);
        if (!parts) throw new Error('Expected context, three inputs and one result');
        let next = bodyStart;
        const body = parts.slice(1).map((part, i) => {
          const partId = ['context', 'factor-1', 'factor-2', 'factor-3', 'effect'][i];
          const piece = bind(partId, block, next, next + part.length);
          next += part.length;
          return piece;
        });
        return { key, label, body };
      });
      return { id, heading, items };
    });
    plan.relations = [
      { type: 'independent', members: ['issues', 'insights'] },
      ...plan.groups.map(group => ({ type: 'contains', from: group.id, to: group.items.map(item => item.key) })),
      { type: 'converges-to', from: ['factor-1', 'factor-2', 'factor-3'], to: 'effect', within: 'issues-1' },
    ];
  } else {
    if (blocks.length !== mode.count + 2) throw new Error(`Unexpected ${kind} block count`);
    plan.items = blocks.slice(1, -1).map((block, i) => {
      const key = `item-${i + 1}`;
      const colon = block.text.indexOf('：');
      if (colon <= 0) throw new Error(`Missing item label: ${key}`);
      const label = bind(`${key}-title`, block, 0, colon + 1);
      const text = block.text.slice(colon + 1);
      // The comparison's own advantages/risks get separate reading lines.
      const sections = kind === 'options' ? text.match(/[^。]+。/g) : [text];
      if (!sections || sections.join('') !== text) throw new Error(`Uncovered content: ${key}`);
      let next = colon + 1;
      const body = sections.map((section, index) => {
        const piece = bind(`${key}-body-${index + 1}`, block, next, next + section.length);
        next += section.length;
        return piece;
      });
      return { key, label, body };
    });
    plan.shared = bind('shared', blocks.at(-1));
    plan.relations = [
      { type: kind === 'options' ? 'peer-options' : 'parallel', members: plan.items.map(item => item.key) },
      { type: mode.relation, from: 'shared', to: plan.items.map(item => item.key) },
    ];
  }

  for (const block of blocks) {
    const reconstructed = bindings.filter(binding => binding.sourceId === block.id).map(binding => binding.text).join('');
    if (reconstructed !== block.text) throw new Error(`Source coverage mismatch: ${block.id}`);
  }
  return plan;
}
