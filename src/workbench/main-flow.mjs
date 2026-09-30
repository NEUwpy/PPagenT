// 新主线的有序建设目录。implemented 只表示独立入口已接入，不表示用户已验收。
import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizeManuscript } from './manuscript-normalizer.mjs';

export const MAIN_FLOW_STEPS = Object.freeze([
  { id: 'manuscript-normalization', name: '原稿读取与规范化', input: '长稿件文件（Markdown / TXT / DOCX）', output: '规范化原稿、转换提示', check: '正文、标题、条件和数字没有在读取时丢失', implemented: true },
  { id: 'pagination-draft', name: '长稿件 → 分页稿', input: '规范化原稿与生成要求', output: '逐页稿：页序、每页目的、主题句、正文与来源', check: '一页一事，必要内容不漏、不重复，稿量相称', implemented: false },
  { id: 'pagination-check', name: '分页稿检查', input: '原稿与逐页稿', output: '分页检查结果、遗漏或重复与修订意见', check: '页间叙事、来源覆盖、限定条件完整', implemented: false },
  { id: 'page-expression-contract', name: '分页稿 → 页面表达契约', input: '通过检查的分页稿', output: '内容 ID、分组、主次、关系、表达需求（无坐标）', check: '分组与作用范围正确，表达不引入新事实', implemented: false },
  { id: 'contract-check', name: '页面表达契约检查', input: '原稿、分页稿与页面表达契约', output: '契约检查结果及问题位置', check: '来源、内容、关系和表达需求一致', implemented: false },
  { id: 'candidate-measurement', name: '候选发现与容量测量', input: '页面表达契约、区域尺寸、资产目录', output: '合法版式与结构候选、容量及拒绝原因', check: '候选承载关系与实文量；缺口如实返回', implemented: false },
  { id: 'candidate-selection', name: 'JEV 选择版式 / 结构', input: '页面表达契约与合法候选', output: '候选 ID 与判断回执', check: '只选择合法 ID，不写坐标、不修改正文', implemented: false },
  { id: 'content-binding', name: '内容绑定与布局检查', input: '页面表达契约与选定候选', output: '区域 / 槽位绑定、测量几何与检查结果', check: '内容完整绑定，字号、边界与容量通过', implemented: false },
  { id: 'gray-compilation', name: '灰稿编译', input: '绑定并检查通过的页面契约', output: '灰稿 PPTX、逐页预览与可编辑性检查', check: '灰稿是契约编译视图，显示真实文字与结构占位', implemented: false },
  { id: 'gray-review', name: '灰稿验收', input: '原稿、冻结契约、灰稿与检查证据', output: '用户审阅结论与退回责任点', check: '页序、目的、内容、主次、关系和承载成立', implemented: false },
]);
export const MAIN_FLOW_STAGES = MAIN_FLOW_STEPS.map(step => [step.id, step.name, `${step.input} → ${step.output}`]);
export const MAIN_FLOW_HANDOFFS = Object.fromEntries(MAIN_FLOW_STEPS.map(step => [step.id, `${step.check}。${step.implemented ? '当前独立入口已接入，运行后等待用户验收。' : '当前独立步骤待建设；不会调用旧 Agent 代跑。'}`]));

export function validateMainRange(start, end) {
  const first = MAIN_FLOW_STEPS.findIndex(step => step.id === start);
  const last = MAIN_FLOW_STEPS.findIndex(step => step.id === end);
  if (first < 0 || last < 0 || first > last) throw new Error('生成段的起点、终点必须按生成顺序选择');
  const selected = MAIN_FLOW_STEPS.slice(first, last + 1);
  const missing = selected.find(step => !step.implemented);
  if (missing) throw new Error(`「${missing.name}」的独立入口待建设；请先验收前一步`);
  return selected;
}

export async function runMainNormalization({ inputPath, originalName, output, recorder }) {
  const stage = 'manuscript-normalization';
  const startedAt = Date.now();
  await recorder.observe({ source: 'workflow', type: 'stage-call', stage, status: 'running', input: { originalName, artifact: `input/${originalName}`, bytes: (await fs.stat(inputPath)).size } });
  try {
    const normalized = await normalizeManuscript({ inputPath, originalName });
    if (!normalized.rawMarkdown.trim()) throw new Error('稿件没有可读取正文');
    // 文本格式保留原读取结果，包括首尾空白；不进行语义改写或分页。
    await fs.writeFile(path.join(output, 'input', 'normalized.md'), normalized.rawMarkdown, 'utf8');
    const result = { format: normalized.format, messages: normalized.messages, contentMarkdown: normalized.rawMarkdown, artifact: 'input/normalized.md', nextStep: 'pagination-draft', note: '只完成原稿读取，不做分页或灰稿编译；等待本步骤验收。' };
    await fs.writeFile(path.join(output, 'normalization-result.json'), JSON.stringify(result, null, 2), 'utf8');
    await recorder.observe({ source: 'workflow', type: 'stage-call', stage, status: 'succeeded', durationMs: Date.now() - startedAt, output: result });
    return result;
  } catch (error) {
    await recorder.observe({ source: 'workflow', type: 'stage-call', stage, status: 'failed', durationMs: Date.now() - startedAt, error: { message: error.message } });
    throw error;
  }
}
