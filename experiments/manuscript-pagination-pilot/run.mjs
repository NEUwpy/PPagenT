import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { manuscriptHash, prepareManuscriptDraft } from '../../src/composition/manuscript-draft.mjs';

const here = import.meta.url;
const rawMarkdown = await fs.readFile(new URL('./manuscript.md', here), 'utf8');
const ref = n => `source-${String(n).padStart(3, '0')}`;
const group = (n, title, role) => ({ id: `g${n}`, title, role, sourceIds: [ref(n)] });
const relation = (type, n, target, meaning) => ({ type, from: [`g${n}`], to: target, meaning });
const pages = [
  {
    pageId: 'P1', purpose: '解释为何当前证据只支持核对原因，不能直接决定增容', topic: { sourceIds: [ref(2)] },
    groups: [group(1, '稿件范围', 'context'), group(3, '预约与未使用的观察', 'evidence'), group(4, '解读及证据边界', 'interpretation-boundary')],
    relations: [relation('context', 1, 'topic', '稿件标题仅说明范围，不构成论据'), relation('support', 3, 'g4', '两组可重叠比例只支持核对'), relation('condition', 4, 'topic', '原因未知且有周期干扰，不能推出增容')],
  },
  {
    pageId: 'P2', purpose: '比较两个同范围方案，并说明B的选择依据及负荷回退', topic: { sourceIds: [ref(5)] },
    groups: [group(6, '同范围投入比较', 'comparison'), group(7, '选择依据与暂停条件', 'decision-boundary')],
    relations: [relation('support', 6, 'g7', '比较估计投入，不能作为实测收益'), relation('condition', 7, 'topic', '信息价值支持B，同时受实际负荷约束')],
  },
  {
    pageId: 'P3', purpose: '定义采证、复核与扩围门槛，保留失败动作和因果边界', topic: { sourceIds: [ref(8)] },
    groups: [group(9, '采证与分支判断', 'sequence-condition'), group(10, '并列门槛及证据边界', 'boundary')],
    relations: [relation('support', 9, 'topic', '用实际记录区分修复与增容'), relation('condition', 10, 'topic', '三项门槛必须同时满足，观察改善不等于因果')],
  },
];
const three = { rawMarkdown, sourceHash: manuscriptHash(rawMarkdown), pages };
const twoPages = structuredClone(pages.slice(0, 2));
twoPages[1].purpose = '同时完成方案比较、试点执行与扩围决策';
twoPages[1].groups.push(group(8, '扩围判断原则', 'decision'), ...structuredClone(pages[2].groups));
twoPages[1].relations.push(relation('support', 8, 'topic', '试点需产生扩围依据'), relation('support', 9, 'g8', '采证决定后续分支'), relation('condition', 10, 'g8', '门槛约束扩大范围'));
const candidates = [{ name: 'two-pages', pages: twoPages }, { name: 'three-pages', pages }];
const results = [];
for (const candidate of candidates) {
  const compiled = prepareManuscriptDraft({ ...three, pages: candidate.pages });
  await fs.writeFile(new URL(`./${candidate.name}.json`, here), JSON.stringify({ plan: { sourceHash: three.sourceHash, pages: candidate.pages }, compiled }, null, 2) + '\n');
  const text = compiled.pages.map(page => {
    const grouping = page.draft.grouping;
    return `## ${page.pageId}｜${page.purpose}\n\n主题原文：${grouping.topic.sourceText}\n\n` + grouping.groups.map(g => `### ${g.title}（${g.role}）\n\n> ${g.sourceText.replace(/\n/g, '\n> ')}`).join('\n\n');
  }).join('\n\n---\n\n');
  await fs.writeFile(new URL(`./${candidate.name}.md`, here), '# 实文组织候选（非视觉验收）\n\n' + text + '\n');
  results.push({ name: candidate.name, coverage: compiled.coverage, pages: compiled.pages.map(page => ({ pageId: page.pageId, characters: page.draft.sourceParagraphs.join('').length })), semanticStatus: compiled.semanticStatus });
}
const omission = structuredClone(three);
omission.pages[2].groups.pop();
omission.pages[2].relations.pop();
let rejection;
try { prepareManuscriptDraft(omission); } catch (error) { rejection = error.message; }
assert.match(rejection, /整稿来源未分配: source-010/);
await fs.writeFile(new URL('./verification.json', here), JSON.stringify({ sourceHash: three.sourceHash, candidates: results, omittedBoundary: { rejected: true, message: rejection }, evidence: '主任务编排的实文候选与机制验证；非独立复现、非PPT视觉验收' }, null, 2) + '\n');
console.log(JSON.stringify({ results, omittedBoundaryRejected: rejection }, null, 2));
