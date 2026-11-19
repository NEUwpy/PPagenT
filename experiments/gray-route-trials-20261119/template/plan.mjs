import assert from 'node:assert/strict';

// Frozen by reading these four manuscripts. Source numbers refer to splitSources().
// No generated copy is needed for source fields. Labels below are presentation metadata.
export const cases = [
  { id: 'options', file: '稿件/模拟稿库/布局试排-options.md', type: 'comparison', title: 1, objects: [2, 3], shared: 4 },
  {
    id: 'services', file: '稿件/模拟稿库/布局试排-services.md', type: 'parallel',
    title: 1, objects: [2, 3, 4, 5], shared: 6,
    icons: ['device-desktop', 'door', 'files', 'id-badge'],
  },
  {
    id: 'dense', file: '稿件/模拟稿库/布局试排-dense.md', type: 'parallel',
    title: 1, objects: [2, 3, 4, 5], shared: 6,
    icons: ['clipboard-list', 'clipboard-list', 'clipboard-list', 'clipboard-list'],
  },
  {
    id: 'hr', file: '稿件/变革不足与感悟-v3-条件否定.md', type: 'grouped-prose', title: 1,
    groups: [
      { source: 2, cue: '首先是两点不足。', markers: ['一是', '二是'] },
      { source: 3, cue: '其次是四点感悟。', markers: ['一是', '二是', '三是', '四是'] },
    ],
    icons: ['messages', 'target-arrow', 'refresh', 'adjustments'],
  },
];

export const comparisonLabels = ['实施方式', '收益', '风险或代价'];

export function bindManuscript(plan, sources) {
  const bindings = [];
  function source(number) {
    const entry = sources[number - 1];
    assert(entry, `Unknown source s${number}`);
    return entry;
  }
  function bind(number, key, start = 0, end = source(number).text.length) {
    const entry = source(number);
    const text = entry.text.slice(start, end);
    assert(text.trim(), `Empty field ${key}`);
    const field = { key, sourceId: entry.id, start, end, text };
    bindings.push(field);
    return field;
  }
  const title = bind(plan.title, 'title');
  if (plan.type === 'grouped-prose') {
    const groups = plan.groups.map(({ source: n, cue, markers }, groupIndex) => {
      const raw = source(n).text;
      assert(raw.startsWith(cue), `Changed group boundary at s${n}`);
      const lead = bind(n, `group-${groupIndex + 1}`, 0, cue.length);
      const starts = markers.map(marker => {
        const position = raw.indexOf(`。${marker}`, cue.length - 1);
        assert(position >= 0, `Missing ${marker} in s${n}`);
        return position + 1;
      });
      assert(starts[0] === cue.length && starts.every((start, i) => i === 0 || start > starts[i - 1]));
      const items = starts.map((start, index) => {
        const key = `${lead.key}-item-${index + 1}`;
        const end = starts[index + 1] ?? raw.length;
        const cut = raw.indexOf('。', start) + 1;
        assert(cut > start && cut < end, `Missing heading or text in ${key}`);
        return { key, title: bind(n, `${key}-title`, start, cut), body: bind(n, `${key}-body`, cut, end) };
      });
      return { key: lead.key, lead, items };
    });
    return { ...plan, title, bindings, groups };
  }
  const objects = plan.objects.map((n, index) => {
    const raw = source(n).text;
    const key = `object-${index + 1}`;
    const cut = raw.indexOf('：') + 1;
    assert(cut > 0 && cut < raw.length, `Missing title or text in ${key}`);
    const title = bind(n, `${key}-title`, 0, cut);
    if (plan.type === 'parallel') {
      return { key, title, body: bind(n, `${key}-body`, cut), iconKey: plan.icons[index] };
    }
    const markers = [
      ['优势是', '风险是'],
      ['优点是', '代价是'],
    ][index];
    const bounds = [cut, ...markers.map(marker => raw.indexOf(marker, cut)), raw.length];
    assert(bounds.every((offset, i) => i === 0 || offset > bounds[i - 1]), `Changed comparison boundary in ${key}`);
    const cells = comparisonLabels.map((_, i) => bind(n, `${key}-cell-${i + 1}`, bounds[i], bounds[i + 1]));
    return { key, title, cells };
  });
  const shared = bind(plan.shared, 'shared');
  return { ...plan, title, objects, shared, bindings };
}

// Prove exact coverage of each source paragraph, including repeated sentences.
export function assertCoverage(sources, bindings) {
  for (const source of sources) {
    const fields = bindings.filter(field => field.sourceId === source.id).sort((a, b) => a.start - b.start);
    let cursor = 0;
    for (const field of fields) {
      assert.equal(field.start, cursor, `Gap or duplication in ${source.id}`);
      assert.equal(field.text, source.text.slice(field.start, field.end));
      cursor = field.end;
    }
    assert.equal(cursor, source.text.length, `Unmapped text in ${source.id}`);
  }
}
