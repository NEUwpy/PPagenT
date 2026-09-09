import fs from 'node:fs/promises';
import path from 'node:path';
import { prepareContentDraft } from '../../src/composition/content-stages.mjs';
const here = import.meta.dirname;
const manuscript = await fs.readFile(path.join(here, '../visual-balance-cold-run/manuscript.md'), 'utf8');
const source = manuscript.split('## P3｜')[1].split('## N1｜')[0];
const sourceParagraphs = source.split(/\r?\n/).slice(1).map(x => x.trim()).filter(x => x && !x.startsWith('#'));
const raw = JSON.parse(await fs.readFile(path.join(here, 'luna-grouping.json'), 'utf8'));
// Normalize serialization only. Keep Luna's groups, wording and logical meanings.
const grouping = structuredClone(raw);
grouping.relations.forEach(r => { if (typeof r.from === 'string') r.from = [r.from]; });
const draft = prepareContentDraft({ pageId: 'P3', sourceParagraphs, grouping });
await fs.writeFile(path.join(here, 'content-draft.json'), JSON.stringify(draft, null, 2));
console.log(JSON.stringify({ contentHash: draft.contentHash, coverage: draft.coverage, groups: draft.grouping.groups.length }));
